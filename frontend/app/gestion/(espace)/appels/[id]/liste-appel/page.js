'use client';
// =====================================================================
//  E20 · Liste d'appel — l'écran que l'agent regarde le téléphone à la
//  main. Un donneur déjà joint reste visible avec son résultat : on ne
//  rappelle jamais deux fois. La position dans la série se voit au
//  filet, jamais à la seule couleur.
// =====================================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, SkipForward } from 'lucide-react';
import { listeAppelGestion, changerJoignabiliteGestion } from '@/lib/api';
import Bouton from '../../../../../composants/Bouton';
import Etat from '../../../../../composants/Etat';
import { MessageErreur } from '../../../../../composants/Message';
import { LignesEnAttente } from '../../../../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../../../../composants/AideEcran';
import { numeroLisible, dateCourte } from '@/lib/format';

const RESULTATS = [
  { cle: 'joint', mot: 'Joint' },
  { cle: 'ne_repond_pas', mot: 'Ne répond pas' },
  { cle: 'invalide', mot: 'Numéro invalide' }
];

function etatNumero(tel) {
  if (tel.statut_joignabilite === 'confirme') return { mot: 'Confirmé', ton: 'seve' };
  if (tel.statut_joignabilite === 'injoignable') {
    return {
      mot: tel.date_dernier_controle ? `Signalé injoignable le ${dateCourte(tel.date_dernier_controle)}` : 'Signalé injoignable',
      ton: 'ocre'
    };
  }
  return { mot: 'Jamais vérifié', ton: 'neutre' };
}

export default function ListeAppel() {
  const { id } = useParams();
  const [donneurs, setDonneurs] = useState(null);
  const [erreur, setErreur] = useState('');
  const [resultats, setResultats] = useState({});
  const [ignores, setIgnores] = useState(new Set());
  const [aideOuverte, alternerAide] = useAide('liste-appel');

  useEffect(() => {
    listeAppelGestion(id)
      .then((r) => setDonneurs(r.donneurs))
      .catch((probleme) => setErreur(probleme.message));
  }, [id]);

  if (erreur && !donneurs) {
    return (
      <div className="contenu-formulaire pile-xl">
        <Link href={`/gestion/appels/${id}`} className="lien"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour au suivi</Link>
        <MessageErreur>{erreur}</MessageErreur>
      </div>
    );
  }
  if (!donneurs) {
    return <div className="contenu-formulaire pile-xl"><LignesEnAttente nombre={5} /></div>;
  }

  const total = donneurs.length;
  const traites = Object.keys(resultats).length;
  const donneurCourant = donneurs.find((d) => !resultats[d.id_donneur] && !ignores.has(d.id_donneur));
  const minutesRestantes = Math.max(1, Math.ceil((total - traites) * 1.5));

  async function agir(donneur, telephone, resultat) {
    setErreur('');
    try {
      await changerJoignabiliteGestion(telephone.id_telephone, resultat);
      setResultats((r) => ({ ...r, [donneur.id_donneur]: { resultat, numero: telephone.numero } }));
    } catch (probleme) {
      setErreur(probleme.message);
    }
  }

  if (total === 0) {
    return (
      <div className="contenu-formulaire pile-xl">
        <Link href={`/gestion/appels/${id}`} className="lien"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour au suivi</Link>
        <div className="etat-vide pile-s">
          <p className="lead">Personne à appeler.</p>
          <p className="appui">Tous les destinataires de cet appel ont déjà répondu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contenu-formulaire pile-xl">
      <div className="rang-espace">
        <Link href={`/gestion/appels/${id}`} className="lien">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Retour au suivi
        </Link>
        <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran sert à appeler, un par un, les donneurs qui n’ont pas encore répondu à cet
        appel. Pour chaque numéro, notez le résultat de l’appel : joint, ne répond pas, ou
        numéro invalide. Un donneur déjà joint reste visible avec son résultat, pour ne jamais
        le rappeler deux fois.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="pile-s">
        <p className="lead">
          {traites} appel{traites > 1 ? 's' : ''} passé{traites > 1 ? 's' : ''} sur {total}
        </p>
        <span className="jauge">
          <span className="jauge-encre" style={{ width: `${Math.round((traites / total) * 100)}%` }} />
        </span>
        {donneurCourant && (
          <span className="petit">
            Environ {minutesRestantes} minute{minutesRestantes > 1 ? 's' : ''} restante{minutesRestantes > 1 ? 's' : ''}.
          </span>
        )}
      </div>

      {donneurCourant && (
        <Bouton variante="principal" large enfantIcone={SkipForward}
                onClick={() => setIgnores(new Set([...ignores, donneurCourant.id_donneur]))}>
          Passer au donneur suivant
        </Bouton>
      )}

      <div className="pile">
        {donneurs.map((donneur) => {
          const fait = resultats[donneur.id_donneur];
          const estCourant = donneur.id_donneur === donneurCourant?.id_donneur;
          return (
            <div key={donneur.id_donneur} className={`carte pile-s ${estCourant ? 'courante' : ''}`}>
              <div className="rang-espace">
                <span style={{ fontWeight: 600 }}>{donneur.prenom} {donneur.nom}</span>
                {fait && (
                  <Etat ton={fait.resultat === 'joint' ? 'seve' : fait.resultat === 'invalide' ? 'sang' : 'ocre'}>
                    {RESULTATS.find((r) => r.cle === fait.resultat)?.mot}
                  </Etat>
                )}
              </div>
              {(donneur.telephones || []).map((tel) => {
                const etat = etatNumero(tel);
                return (
                  <div key={tel.id_telephone} className="pile-s" style={{ paddingTop: 'var(--e2)', borderTop: '1px solid var(--trait)' }}>
                    <div className="rang-espace">
                      <span className="mono">{numeroLisible(tel.numero)}</span>
                      <Etat ton={etat.ton} taille={16}>{etat.mot}</Etat>
                    </div>
                    {!fait && (
                      <div className="rang" style={{ gap: 'var(--e2)' }}>
                        {RESULTATS.map((r) => (
                          <button key={r.cle} type="button" className="touche" style={{ flex: 1 }}
                                  onClick={() => agir(donneur, tel, r.cle)}>
                            {r.mot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
