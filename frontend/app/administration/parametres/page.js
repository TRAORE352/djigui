'use client';
// =====================================================================
//  E30 · Paramètres du système.
//  Trois sections dans l'ordre du risque (annexe B, champ categorie) :
//  conditions médicales, conservation des poches, sécurité des accès.
//  Le service applique déjà les bornes et la cohérence entre la durée
//  de conservation et l'alerte de péremption (admin.controleur.js) :
//  cet écran ne fait qu'annoncer ces bornes avant la saisie et relire
//  les changements avant de les envoyer.
// =====================================================================
import { useEffect, useState } from 'react';
import { ShieldAlert, Save } from 'lucide-react';
import { listerParametres, modifierParametres } from '@/lib/api';
import Bouton from '../../composants/Bouton';
import Confirmation from '../../composants/Confirmation';
import { MessageErreur, MessageReussite } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../composants/AideEcran';
import { dateHeure } from '@/lib/format';

// Bornes de sécurité : copie exacte de celles du service
// (admin.controleur.js, constante BORNES). Dupliquées ici pour être
// annoncées AVANT la saisie ; le service reste seul juge au moment de
// l'enregistrement.
const BORNES = {
  age_min: [16, 30], age_max: [50, 80], poids_min: [40, 70],
  delai_homme_mois: [1, 12], delai_femme_mois: [1, 12],
  max_dons_homme_an: [1, 8], max_dons_femme_an: [1, 8],
  duree_conservation_jours: [7, 400], alerte_peremption_jours: [1, 30],
  nb_telephones_max: [1, 6], recup_tentatives_heure: [1, 10],
  mdp_longueur_min: [8, 32], mdp_donneur_longueur_min: [6, 32],
  echecs_avant_verrou: [3, 10], duree_verrou_minutes: [5, 120],
  session_inactivite_minutes: [5, 240], validite_provisoire_heures: [1, 168]
};

const CATEGORIES = [
  {
    cle: 'medical', titre: 'Conditions médicales',
    description: 'Qui peut donner son sang, et à quel rythme. Ces valeurs viennent de la '
      + 'direction médicale du centre.'
  },
  {
    cle: 'conservation', titre: 'Conservation des poches',
    description: 'Combien de temps une poche reste utilisable, et quand le centre est '
      + 'prévenu avant la péremption.'
  },
  {
    cle: 'securite', titre: 'Sécurité des accès',
    description: 'Ce qui protège les comptes professionnels sur un poste partagé.'
  }
];

export default function Parametres() {
  const [origine, setOrigine] = useState(null);
  const [valeurs, setValeurs] = useState({});
  const [erreur, setErreur] = useState('');
  const [cleErreur, setCleErreur] = useState('');
  const [reussite, setReussite] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [aideOuverte, alternerAide] = useAide('parametres');

  async function recharger() {
    const resultat = await listerParametres();
    setOrigine(resultat.parametres);
    setValeurs(Object.fromEntries(resultat.parametres.map((p) => [p.cle, String(p.valeur)])));
  }
  useEffect(() => { recharger().catch((probleme) => setErreur(probleme.message)); }, []);

  useEffect(() => {
    if (!reussite) return;
    const minuterie = setTimeout(() => setReussite(''), 3000);
    return () => clearTimeout(minuterie);
  }, [reussite]);

  if (!origine) {
    return <div className="contenu-registre pile-l"><LignesEnAttente nombre={8} /></div>;
  }

  function modifierChamp(cle, valeur) {
    setValeurs((v) => ({ ...v, [cle]: valeur }));
    setCleErreur('');
  }

  const modifiees = origine.filter((p) => valeurs[p.cle] !== String(p.valeur));
  const horsBornes = modifiees.some((p) => {
    const bornes = BORNES[p.cle];
    const nombre = Number(valeurs[p.cle]);
    return bornes && (!Number.isFinite(nombre) || nombre < bornes[0] || nombre > bornes[1]);
  });

  const derniereModif = origine.reduce((plusRecente, p) => {
    if (!p.date_modification) return plusRecente;
    if (!plusRecente || p.date_modification > plusRecente.date_modification) return p;
    return plusRecente;
  }, null);

  async function enregistrer() {
    setErreur(''); setCleErreur(''); setEnCours(true);
    try {
      await modifierParametres(modifiees.map((p) => ({ cle: p.cle, valeur: Number(valeurs[p.cle]) })));
      await recharger();
      setConfirmationOuverte(false);
      setReussite('Réglages enregistrés.');
    } catch (probleme) {
      setConfirmationOuverte(false);
      setErreur(probleme.message);
      setCleErreur(probleme.donnees?.cle || '');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="contenu-registre pile-xl">
      <div className="encadre encadre-ocre">
        <ShieldAlert size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>
          Les valeurs médicales sont décidées par la direction médicale du centre. Elles ne
          sont saisies ici que sur instruction écrite et signée.
        </span>
      </div>

      <p className="appui">
        Ces valeurs commandent le comportement du produit dans tous les écrans. Changer le
        délai entre deux dons, par exemple, change immédiatement qui peut donner et qui reçoit
        les appels au don.
      </p>

      <div className="entete-ecran">
        <div className="pile-s">
          <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
            <h1 className="titre-grand">Paramètres</h1>
            <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
          </div>
          {derniereModif && (
            <p className="ligne-registre">
              Dernière modification le <span className="mono">{dateHeure(derniereModif.date_modification)}</span>
              {' '}par <span className="mono">{derniereModif.modifie_par || '—'}</span>
            </p>
          )}
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran règle les valeurs qui commandent le comportement du produit : âges et poids
        acceptés, délais entre deux dons, durée de conservation d’une poche, verrouillage des
        comptes. Chaque ligne annonce ses bornes avant la saisie et sa conséquence concrète.
        Rien ne part sans une relecture récapitulative, et rien ne s’enregistre tant qu’aucune
        valeur n’a changé.
      </PanneauAide>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {CATEGORIES.map(({ cle, titre, description }) => {
        const lignes = origine.filter((p) => p.categorie === cle);
        if (lignes.length === 0) return null;
        return (
          <section key={cle} className="pile">
            <div className="pile-s">
              <h2 className="lead">{titre}</h2>
              <p className="appui">{description}</p>
            </div>
            <div className="registre-defilant">
              <table className="registre">
                <thead>
                  <tr><th>Réglage</th><th>Valeur</th><th>Conséquence</th></tr>
                </thead>
                <tbody>
                  {lignes.map((p) => {
                    const modifiee = valeurs[p.cle] !== String(p.valeur);
                    const bornes = BORNES[p.cle];
                    const nombre = Number(valeurs[p.cle]);
                    const champHorsBornes = bornes && (!Number.isFinite(nombre) || nombre < bornes[0] || nombre > bornes[1]);
                    return (
                      <tr key={p.cle} className={modifiee ? 'niveau-modifiee' : ''}>
                        <td style={{ fontWeight: 600 }}>{p.libelle}</td>
                        <td>
                          <div className={`champ ${champHorsBornes || cleErreur === p.cle ? 'champ-erreur' : ''}`}>
                            <div className="rang" style={{ gap: 'var(--e2)', alignItems: 'center' }}>
                              <input
                                className="champ-saisie mono" type="number" style={{ width: 90 }}
                                min={bornes ? bornes[0] : undefined} max={bornes ? bornes[1] : undefined}
                                value={valeurs[p.cle] ?? ''}
                                onChange={(e) => modifierChamp(p.cle, e.target.value)}
                              />
                              <span className="mono appui">{p.unite}</span>
                            </div>
                            {bornes && (
                              <span className="champ-aide">Entre {bornes[0]} et {bornes[1]} {p.unite}.</span>
                            )}
                            {modifiee && (
                              <span className="petit"> (auparavant {p.valeur} {p.unite})</span>
                            )}
                          </div>
                        </td>
                        <td className="appui">{p.consequence}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <Bouton variante="encre" enfantIcone={Save}
              disabled={modifiees.length === 0 || horsBornes}
              title={
                modifiees.length === 0
                  ? 'Aucune valeur modifiée.'
                  : horsBornes ? 'Une valeur dépasse les bornes autorisées.' : undefined
              }
              onClick={() => setConfirmationOuverte(true)}>
        Enregistrer les réglages
      </Bouton>

      <Confirmation
        ouverte={confirmationOuverte}
        titre="Confirmer ces réglages ?"
        motAction="Enregistrer" varianteAction="encre" enCours={enCours}
        surConfirmer={enregistrer} surAnnuler={() => setConfirmationOuverte(false)}
      >
        <div className="pile-s">
          {modifiees.map((p) => (
            <div key={p.cle} className="ligne-fait">
              <span className="appui">{p.libelle}</span>
              <span className="mono">{p.valeur} → {valeurs[p.cle]} {p.unite}</span>
            </div>
          ))}
        </div>
      </Confirmation>
    </div>
  );
}
