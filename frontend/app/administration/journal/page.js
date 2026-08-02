'use client';
// =====================================================================
//  E31 · Journal d'activité.
//  Lecture seule, sans exception : aucune colonne d'actions, aucun
//  moyen de corriger ou d'effacer une ligne, pas même pour un
//  administrateur. Les refus et les échecs du système sont montrés au
//  même titre que les réussites (règle RG20, RG47).
//  Ce qui s'écrit ici s'écrit en français lisible, jamais en JSON ni en
//  nom technique (contrainte U3) : une cible ancienne qui contiendrait
//  encore du JSON ne s'affiche pas brute, elle porte un tiret — les
//  lignes déjà écrites ne se corrigent jamais, ce registre est
//  inaltérable.
// =====================================================================
import { useEffect, useState } from 'react';
import { listerJournal, listerComptes } from '@/lib/api';
import Bouton from '../../composants/Bouton';
import Etat from '../../composants/Etat';
import Repliable from '../../composants/Repliable';
import { MessageErreur } from '../../composants/Message';
import { LignesEnAttente } from '../../composants/Squelette';
import { useAide, BoutonAide, PanneauAide } from '../../composants/AideEcran';
import { dateHeure, pluriel } from '@/lib/format';

const RESULTATS_FILTRE = [
  { cle: '', mot: 'Tous' },
  { cle: 'reussie', mot: 'Réussie' },
  { cle: 'refusee', mot: 'Refusée' },
  { cle: 'echouee', mot: 'Échouée' }
];

// Le ton « alerte » donne l'icône CircleAlert sur fond Sang, différente
// de l'icône TriangleAlert du ton « sang » : Refusée et Échouée doivent
// se distinguer au pictogramme, pas seulement au mot.
const RESULTAT_ETAT = {
  reussie: { mot: 'Réussie', ton: 'seve' },
  refusee: { mot: 'Refusée', ton: 'alerte' },
  echouee: { mot: 'Échouée', ton: 'sang' }
};
const RESULTAT_MOT = { reussie: 'réussie', refusee: 'refusée', echouee: 'échouée' };

// Mêmes catégories que ACTIONS_PAR_CATEGORIE (requetes/journal.js) :
// dupliquées ici pour les mots du filtre, la liste des actions qui s'y
// rangent reste décidée côté service.
const TYPES_ACTION_FILTRE = [
  { cle: '', mot: 'Tous' },
  { cle: 'acces', mot: 'Accès' },
  { cle: 'comptes', mot: 'Comptes' },
  { cle: 'referentiels', mot: 'Référentiels et réglages' },
  { cle: 'stock', mot: 'Stock et poches' },
  { cle: 'appels', mot: 'Appels au don' },
  { cle: 'consultations', mot: 'Consultations' },
  { cle: 'profil_donneur', mot: 'Profil donneur' }
];
const TYPE_ACTION_MOT = Object.fromEntries(
  TYPES_ACTION_FILTRE.filter((t) => t.cle).map((t) => [t.cle, t.mot])
);

const FILTRES_VIDES = { utilisateur: '', resultat: '', type_action: '', depuis: '', jusqu_a: '' };
const LIMITE = 20;

// Une cible ancienne peut encore porter du JSON écrit avant la
// correction : elle ne s'affiche jamais brute (contrainte U3). La
// ligne au journal reste inchangée, seul l'écran filtre.
function cibleLisible(cible) {
  if (!cible) return '';
  const texte = String(cible).trim();
  if (/^[{[]/.test(texte)) return '';
  return texte;
}

// L'écran s'ouvre sur les sept derniers jours, jamais sur tout
// l'historique : un journal qui grossit chaque jour resterait sinon
// long à charger pour la consultation la plus courante.
function filtresParDefaut() {
  const iso = (date) => date.toISOString().slice(0, 10);
  const aujourdHui = new Date();
  const ilYASeptJours = new Date();
  ilYASeptJours.setDate(aujourdHui.getDate() - 7);
  return { ...FILTRES_VIDES, depuis: iso(ilYASeptJours), jusqu_a: iso(aujourdHui) };
}

export default function Journal() {
  const [comptes, setComptes] = useState([]);
  const [filtres, setFiltres] = useState(filtresParDefaut);
  const [lignes, setLignes] = useState(null);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState('');
  const [enCoursSuite, setEnCoursSuite] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [aideOuverte, alternerAide] = useAide('journal');

  useEffect(() => { listerComptes().then((r) => setComptes(r.comptes)).catch(() => setComptes([])); }, []);

  function charger(depart) {
    return listerJournal({ ...filtres, limite: LIMITE, depart });
  }

  useEffect(() => {
    setLignes(null);
    setSuggestion(null);
    charger(0)
      .then((resultat) => { setLignes(resultat.lignes); setTotal(resultat.total); })
      .catch((probleme) => setErreur(probleme.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres.utilisateur, filtres.resultat, filtres.type_action, filtres.depuis, filtres.jusqu_a]);

  function voirPlus() {
    setEnCoursSuite(true);
    charger(lignes.length)
      .then((resultat) => setLignes([...lignes, ...resultat.lignes]))
      .catch((probleme) => setErreur(probleme.message))
      .finally(() => setEnCoursSuite(false));
  }

  // Filtre sans résultat : quel réglage est de trop, et ce que donnerait
  // son retrait — même principe que l'état vide de E24.
  useEffect(() => {
    if (!lignes || lignes.length > 0) return;

    const actifs = [];
    if (filtres.utilisateur) {
      const compte = comptes.find((c) => String(c.id_utilisateur) === String(filtres.utilisateur));
      actifs.push({
        cle: 'utilisateur',
        dans: compte ? `pour ${compte.prenom} ${compte.nom}` : 'pour cet agent',
        retrait: 'le filtre sur cet agent',
        retirer: () => setFiltres((f) => ({ ...f, utilisateur: '' }))
      });
    }
    if (filtres.resultat) {
      actifs.push({
        cle: 'resultat',
        dans: `au résultat ${RESULTAT_MOT[filtres.resultat]}`,
        retrait: 'le filtre de résultat',
        retirer: () => setFiltres((f) => ({ ...f, resultat: '' }))
      });
    }
    if (filtres.type_action) {
      actifs.push({
        cle: 'type_action',
        dans: `au type ${TYPE_ACTION_MOT[filtres.type_action]}`,
        retrait: 'le filtre de type d’action',
        retirer: () => setFiltres((f) => ({ ...f, type_action: '' }))
      });
    }
    if (filtres.depuis || filtres.jusqu_a) {
      actifs.push({
        cle: 'periode',
        dans: 'sur cette période',
        retrait: 'la période',
        retirer: () => setFiltres((f) => ({ ...f, depuis: '', jusqu_a: '' }))
      });
    }

    if (actifs.length === 0) {
      setSuggestion({ texte: 'Aucune ligne n’a encore été inscrite au journal.' });
      return;
    }

    let annule = false;
    async function chercher() {
      let meilleure = null;
      for (const filtre of actifs) {
        const sansCe = { ...filtres };
        if (filtre.cle === 'utilisateur') sansCe.utilisateur = '';
        else if (filtre.cle === 'resultat') sansCe.resultat = '';
        else if (filtre.cle === 'type_action') sansCe.type_action = '';
        else { sansCe.depuis = ''; sansCe.jusqu_a = ''; }
        try {
          const essai = await listerJournal({ ...sansCe, limite: 1 });
          if (essai.total > 0 && (!meilleure || essai.total > meilleure.total)) {
            meilleure = { ...filtre, total: essai.total };
          }
        } catch { /* piste ignorée */ }
      }
      if (annule) return;
      const identite = actifs.map((a) => a.dans).join(' et ');
      if (meilleure) {
        setSuggestion({
          texte: `Aucune ligne ${identite}. En retirant ${meilleure.retrait}, `
            + `${pluriel(meilleure.total, 'ligne')} ${meilleure.total > 1 ? 'apparaissent' : 'apparaît'}.`,
          retirer: meilleure.retirer
        });
      } else {
        setSuggestion({ texte: `Aucune ligne ${identite}. Essayez d’élargir la période ou de changer les filtres.` });
      }
    }
    chercher();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes]);

  const periodeActive = Boolean(filtres.depuis || filtres.jusqu_a);
  const filtreActif = Boolean(filtres.utilisateur || filtres.resultat || filtres.type_action || periodeActive);

  return (
    <div className="contenu-registre pile-xl">
      <div className="entete-ecran">
        <div className="rang" style={{ gap: 'var(--e3)', alignItems: 'center' }}>
          <h1 className="titre-grand">Journal d’activité</h1>
          <Etat ton="neutre" taille={16}>Lecture seule</Etat>
          <BoutonAide ouvert={aideOuverte} onClick={alternerAide} />
        </div>
      </div>

      <PanneauAide ouvert={aideOuverte}>
        Cet écran liste tout ce qui a été fait dans le produit, filtrable par agent, résultat,
        type d’action et période. Aucune ligne ne peut être supprimée ni modifiée, même par un
        administrateur : c’est ce qui rend possible de reconstituer une décision passée. Les
        refus du système figurent au même titre que les réussites, rien n’est masqué.
      </PanneauAide>

      <p className="lead">
        Le journal conserve la trace de tout ce qui a été fait dans le produit : qui, quoi,
        quand, et avec quel résultat. Il permet de reconstituer une décision passée. Les refus
        du système y figurent au même titre que les réussites.
      </p>

      <Repliable titre="Que veulent dire Réussie, Refusée et Échouée ?">
        <div className="pile-s">
          <p className="appui"><strong>Réussie</strong> : l’action a été faite.</p>
          <p className="appui">
            <strong>Refusée</strong> : le système a empêché l’action, parce qu’une règle
            l’interdisait. Par exemple, désactiver le dernier administrateur.
          </p>
          <p className="appui">
            <strong>Échouée</strong> : l’action n’a pas abouti, par exemple une tentative de
            connexion avec un mauvais mot de passe.
          </p>
        </div>
      </Repliable>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="pile-s">
        <span className="etiquette">Agent</span>
        <select className="champ-saisie" style={{ maxWidth: 320 }}
                value={filtres.utilisateur}
                onChange={(e) => setFiltres((f) => ({ ...f, utilisateur: e.target.value }))}>
          <option value="">Tous les comptes</option>
          {comptes.map((compte) => (
            <option key={compte.id_utilisateur} value={compte.id_utilisateur}>
              {compte.prenom} {compte.nom} ({compte.identifiant})
            </option>
          ))}
        </select>
      </div>

      <div className="pile-s">
        <span className="etiquette">Résultat</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {RESULTATS_FILTRE.map(({ cle, mot }) => (
            <button key={cle} type="button" className="touche"
                    aria-pressed={filtres.resultat === cle}
                    onClick={() => setFiltres((f) => ({ ...f, resultat: cle }))}>
              {mot}
            </button>
          ))}
        </div>
      </div>

      <div className="pile-s">
        <span className="etiquette">Type d’action</span>
        <div className="rang" style={{ gap: 'var(--e2)', flexWrap: 'wrap' }}>
          {TYPES_ACTION_FILTRE.map(({ cle, mot }) => (
            <button key={cle} type="button" className="touche"
                    aria-pressed={filtres.type_action === cle}
                    onClick={() => setFiltres((f) => ({ ...f, type_action: cle }))}>
              {mot}
            </button>
          ))}
        </div>
      </div>

      <div className="pile-s">
        <span className="etiquette">Période</span>
        <div className="rang" style={{
          gap: 'var(--e4)', padding: 'var(--e2)',
          border: `1px solid ${periodeActive ? 'var(--encre)' : 'transparent'}`
        }}>
          <label className="champ champ-encadre">
            <span className="champ-etiquette">Depuis le</span>
            <input type="date" className="champ-saisie mono" value={filtres.depuis}
                   max={filtres.jusqu_a || undefined}
                   onChange={(e) => setFiltres((f) => ({ ...f, depuis: e.target.value }))} />
          </label>
          <label className="champ champ-encadre">
            <span className="champ-etiquette">Jusqu’au</span>
            <input type="date" className="champ-saisie mono" value={filtres.jusqu_a}
                   min={filtres.depuis || undefined}
                   onChange={(e) => setFiltres((f) => ({ ...f, jusqu_a: e.target.value }))} />
          </label>
        </div>
      </div>

      {filtreActif && (
        <button type="button" className="lien" style={{ fontSize: 'var(--t-petit)' }}
                onClick={() => setFiltres(FILTRES_VIDES)}>
          Retirer tous les filtres
        </button>
      )}

      {!lignes ? (
        <LignesEnAttente nombre={6} />
      ) : lignes.length === 0 ? (
        <div className="etat-vide pile-s">
          <p className="lead">Aucune ligne ne correspond à ces filtres.</p>
          <p className="appui">{suggestion?.texte || 'Recherche d’une suggestion…'}</p>
          {suggestion?.retirer && (
            <Bouton variante="discret" compact onClick={suggestion.retirer}>Appliquer ce retrait</Bouton>
          )}
        </div>
      ) : (
        <>
          <div className="registre-defilant">
            <table className="registre">
              <thead>
                <tr>
                  <th>Date et heure</th><th>Auteur</th><th>Action</th><th>Cible</th><th>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => {
                  const etat = RESULTAT_ETAT[ligne.resultat] || RESULTAT_ETAT.reussie;
                  const cible = cibleLisible(ligne.cible);
                  const tronquee = cible.length > 60;
                  return (
                    <tr key={ligne.id_journal}>
                      <td className="mono appui">{dateHeure(ligne.date_action)}</td>
                      <td className="mono">{ligne.auteur || '—'}</td>
                      <td>{ligne.action}</td>
                      <td className="appui" title={tronquee ? cible : undefined}>
                        {tronquee ? `${cible.slice(0, 60)}…` : (cible || '—')}
                      </td>
                      <td><Etat ton={etat.ton} taille={16}>{etat.mot}</Etat></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rang-espace">
            <span className="petit">{pluriel(lignes.length, 'ligne')} sur {pluriel(total, 'ligne')}</span>
            {lignes.length < total && (
              <Bouton variante="discret" compact enCours={enCoursSuite} onClick={voirPlus}>
                Charger les lignes plus anciennes
              </Bouton>
            )}
          </div>
        </>
      )}

      <p className="petit">
        Aucune ligne ne peut être supprimée ni modifiée, par personne, y compris par un
        administrateur.
      </p>
    </div>
  );
}
