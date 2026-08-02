'use client';
// =====================================================================
//  E16 · Tableau de bord — le cœur de l'espace de gestion.
//  Requête C.1 : le stock est un comptage des poches disponibles,
//  jamais une colonne saisie (règle RG16). Chaque ligne ouvre E17.
// =====================================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Clock, Info } from 'lucide-react';
import { tableauDeBordGestion } from '@/lib/api';
import BlocGroupe from '../../../composants/BlocGroupe';
import Etat from '../../../composants/Etat';
import { MessageErreur } from '../../../composants/Message';
import { LignesEnAttente } from '../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../composants/AideEcran';
import { dateHeure, dateCourte, ancienneteDepuis, pluriel } from '@/lib/format';

// Phrase de lecture, calculée à partir du stock réel : elle répond
// directement à la question de l'agent le matin, sans jamais être
// écrite en dur.
function phraseLecture(stock) {
  const critiques = stock.filter((ligne) => ligne.niveau === 'critique');
  if (critiques.length === 0) {
    return 'Les huit groupes sont au-dessus de leurs seuils. Rien ne presse aujourd’hui.';
  }
  const noms = critiques.map((ligne) => ligne.groupe_sanguin).join(', ');
  return `${pluriel(critiques.length, 'groupe')} ${critiques.length > 1 ? 'sont' : 'est'} au niveau critique : `
    + `${noms}. Un appel au don est conseillé pour ${critiques.length > 1 ? 'ces groupes' : 'ce groupe'}.`;
}

function ReferenceJauge(disponibles, seuilBas) {
  const reference = Math.max((seuilBas || 0) * 2, disponibles, 1);
  return Math.min(100, Math.round((disponibles / reference) * 100));
}

export default function TableauDeBord() {
  const routeur = useRouter();
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [aideOuverte, alternerAide] = useAide('tableau-de-bord');

  useEffect(() => {
    tableauDeBordGestion()
      .then(setDonnees)
      .catch((probleme) => setErreur(probleme.message));
  }, []);

  if (erreur) {
    return (
      <div className="contenu-registre pile-xl">
        <MessageErreur>{erreur}</MessageErreur>
      </div>
    );
  }

  if (!donnees) {
    return <div className="contenu-registre pile-xl"><LignesEnAttente nombre={8} /></div>;
  }

  const { stock, proches_peremption: prochesPeremption, dernier_mouvement: dernierMouvement } = donnees;
  const centreSansPoche = stock.every((ligne) => ligne.niveau === 'en_attente');

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Tableau de bord</h1>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran donne l’état du stock de sang, groupe par groupe, au moment où vous le
        consultez. Chaque ligne compare le nombre de poches réellement disponibles aux deux
        seuils fixés pour votre centre. Un niveau Critique ou Bas signale qu’il faut réagir :
        ouvrez le groupe pour voir le détail ou lancer un appel au don directement. Les poches
        proches de la péremption sont rappelées plus bas, pour ne pas les oublier.
      </PanneauAide>

      {centreSansPoche ? (
        <div className="encadre">
          <Info size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            Ce centre n’a pas encore enregistré de don. Le stock se remplira à mesure des
            enregistrements, et les niveaux d’alerte prendront leur sens.
          </span>
        </div>
      ) : (
        <>
          <p className="lead">{phraseLecture(stock)}</p>
          <p className="ligne-registre">
            {dernierMouvement
              ? `${dateHeure(dernierMouvement)} · dernière entrée ${ancienneteDepuis(dernierMouvement)}`
              : 'Aucune entrée pour l’instant'}
            {' · 8 groupes suivis'}
          </p>
        </>
      )}

      <p className="petit">
        Disponibles : poches prêtes à être transfusées maintenant. Les poches en contrôle ou
        réservées ne sont pas comptées ici.
      </p>

      <div className="registre-defilant">
        <table className="registre">
          <thead>
            <tr>
              <th>Groupe</th>
              <th className="nombre">Disponibles</th>
              <th className="nombre">Seuil bas</th>
              <th className="nombre">Seuil critique</th>
              <th>Niveau</th>
              <th>Remplissage</th>
              <th>Dernière entrée</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((ligne) => {
              const pourcentage = ReferenceJauge(ligne.poches_disponibles, ligne.seuil_bas);
              const teinte = ligne.niveau === 'critique' ? 'sang' : ligne.niveau === 'bas' ? 'ocre' : 'encre';
              return (
                <tr key={ligne.groupe_sanguin}
                    className={`cliquable ${ligne.niveau === 'critique' ? 'niveau-critique' : ''} ${ligne.niveau === 'bas' ? 'niveau-bas' : ''}`}
                    tabIndex={0}
                    role="link"
                    aria-label={`Voir le détail du groupe ${ligne.groupe_sanguin}`}
                    onClick={() => routeur.push(`/gestion/groupes/${encodeURIComponent(ligne.groupe_sanguin)}`)}
                    onKeyDown={(evenement) => {
                      if (evenement.key === 'Enter' || evenement.key === ' ') {
                        evenement.preventDefault();
                        routeur.push(`/gestion/groupes/${encodeURIComponent(ligne.groupe_sanguin)}`);
                      }
                    }}>
                  <td><BlocGroupe groupe={ligne.groupe_sanguin} taille="s" /></td>
                  <td className="nombre">{pluriel(ligne.poches_disponibles, 'poche')}</td>
                  <td className="nombre">{ligne.seuil_bas ?? '—'}</td>
                  <td className="nombre">{ligne.seuil_critique ?? '—'}</td>
                  <td>
                    {ligne.niveau === 'critique' && <Etat ton="sang"><CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />Critique</Etat>}
                    {ligne.niveau === 'bas' && <Etat ton="ocre"><Clock size={16} strokeWidth={1.75} aria-hidden="true" />Bas</Etat>}
                    {ligne.niveau === 'normal' && <span className="appui">Normal</span>}
                    {ligne.niveau === 'en_attente' && <span className="appui">En attente de premier don</span>}
                  </td>
                  <td>
                    <span className="jauge">
                      <span className={`jauge-${teinte}`} style={{ width: `${pourcentage}%` }} />
                    </span>
                  </td>
                  <td className="mono appui">
                    {ligne.dernier_mouvement ? dateHeure(ligne.dernier_mouvement) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e7)' }}>
        <section className="pile">
          <h2 className="lead">Poches proches de la péremption</h2>
          {prochesPeremption.length === 0 ? (
            <div className="etat-vide pile-s">
              <p className="appui">Aucune poche n’approche la péremption pour l’instant.</p>
            </div>
          ) : (
            <div className="registre-defilant">
              <table className="registre">
                <thead>
                  <tr><th>Code</th><th>Groupe</th><th className="nombre">Jours restants</th><th>Périme le</th></tr>
                </thead>
                <tbody>
                  {prochesPeremption.map((poche) => (
                    <tr key={poche.id_poche}>
                      <td className="mono">{poche.code_poche}</td>
                      <td><BlocGroupe groupe={poche.groupe_sanguin} taille="xs" /></td>
                      <td className="nombre">{pluriel(poche.jours_restants, 'jour')}</td>
                      <td className="mono">{dateCourte(poche.date_peremption)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pile">
          <h2 className="lead">Alertes en cours</h2>
          <div className="etat-vide pile-s">
            <p className="appui">
              Les alertes en cours s’afficheront ici lorsque les appels au don
              seront construits.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
