// =====================================================================
//  DJIGUI — toutes les communications avec la couche de service.
//  Règle du projet : aucun fetch ailleurs que dans ce fichier.
// =====================================================================

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const CLE_JETON = 'djigui_jeton';

export function lireJeton() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CLE_JETON);
}

export function enregistrerJeton(jeton) {
  if (typeof window !== 'undefined') window.localStorage.setItem(CLE_JETON, jeton);
}

export function effacerJeton() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(CLE_JETON);
}

// Erreur porteuse : le champ fautif et le code permettent à l'écran de
// réagir précisément, au lieu d'afficher un message générique.
export class ErreurService extends Error {
  constructor(message, options = {}) {
    super(message);
    this.statut = options.statut;
    this.champ = options.champ;
    this.code = options.code;
    this.donnees = options.donnees;
  }
}

async function appel(chemin, options = {}) {
  const entetes = {};
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  const jeton = options.jeton !== undefined ? options.jeton : lireJeton();
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      method: options.methode || 'GET',
      headers: entetes,
      body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined
    });
  } catch {
    throw new ErreurService(
      'Le service ne répond pas. Vérifiez qu\u2019il est démarré, puis réessayez.',
      { code: 'service_injoignable' });
  }

  // La session professionnelle se prolonge à chaque appel (règle RG39).
  const rafraichi = reponse.headers.get('X-Jeton-Rafraichi');
  if (rafraichi) enregistrerJeton(rafraichi);

  if (reponse.status === 204) return null;

  let donnees = null;
  try { donnees = await reponse.json(); } catch { /* réponse sans corps */ }

  if (!reponse.ok) {
    if (reponse.status === 401 && typeof window !== 'undefined') effacerJeton();
    throw new ErreurService(
      donnees?.erreur || 'Le service a rencontré un problème. Réessayez.',
      { statut: reponse.status, champ: donnees?.champ, code: donnees?.code, donnees });
  }
  return donnees;
}

/* ------------------------- Diagnostic ------------------------------- */
export const sante = () => appel('/api/sante', { jeton: null });

/* --------------------- Données publiques ---------------------------- */
export const listerZones = () => appel('/api/zones', { jeton: null });

/* ------------------------ Authentification -------------------------- */
export const inscription = (corps) =>
  appel('/api/auth/inscription', { methode: 'POST', corps, jeton: null });

export const connexion = (identifiant, motDePasse) =>
  appel('/api/auth/connexion', {
    methode: 'POST', jeton: null,
    corps: { identifiant, mot_de_passe: motDePasse }
  });

export const deconnexion = () => appel('/api/auth/deconnexion', { methode: 'POST' });
export const monCompte = () => appel('/api/auth/moi');

export const recuperationQuestion = (numero, dateNaissance) =>
  appel('/api/auth/recuperation/question', {
    methode: 'POST', jeton: null,
    corps: { numero, date_naissance: dateNaissance }
  });

export const recuperationVerifier = (numero, dateNaissance, reponse) =>
  appel('/api/auth/recuperation/verifier', {
    methode: 'POST', jeton: null,
    corps: { numero, date_naissance: dateNaissance, reponse }
  });

// Sert au temps 3 de E11, à E14 et à E32.
export const changerMotDePasse = (corps, jeton) =>
  appel('/api/auth/mot-de-passe', { methode: 'POST', corps, jeton });

/* -------------------------- Espace donneur -------------------------- */
export const monProfil = () => appel('/api/donneurs/moi');
export const modifierProfil = (corps) => appel('/api/donneurs/moi', { methode: 'PUT', corps });
export const changerQuestionSecurite = (corps) =>
  appel('/api/donneurs/moi/question', { methode: 'PUT', corps });
export const mesTelephones = () => appel('/api/donneurs/moi/telephones');
export const ajouterTelephone = (numero) =>
  appel('/api/donneurs/moi/telephones', { methode: 'POST', corps: { numero } });
export const retirerTelephone = (id) =>
  appel(`/api/donneurs/moi/telephones/${id}`, { methode: 'DELETE' });
export const remplacerNumeroPrincipal = (corps) =>
  appel('/api/donneurs/moi/numero-principal', { methode: 'PUT', corps });
export const desactiverMonCompte = () =>
  appel('/api/donneurs/moi/desactivation', { methode: 'PUT' });
export const mesDons = () => appel('/api/donneurs/moi/dons');

// Le rappel d'agenda est un fichier : il passe par un téléchargement.
export async function telechargerRappel() {
  const reponse = await fetch(`${BASE}/api/donneurs/moi/rappel.ics`, {
    headers: { Authorization: `Bearer ${lireJeton()}` }
  });
  if (!reponse.ok) {
    let donnees = null;
    try { donnees = await reponse.json(); } catch { /* rien */ }
    throw new ErreurService(donnees?.erreur || 'Le rappel n\u2019est pas disponible.');
  }
  const fichier = await reponse.blob();
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = 'rappel-djigui.ics';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(adresse);
}

/* ----------------------- Espace administration ---------------------- */
export const etatAdministration = () => appel('/api/administration/etat');
export const listerComptes = () => appel('/api/administration/comptes');
export const identifiantPropose = (prenom, nom) =>
  appel(`/api/administration/comptes/identifiant-propose?prenom=${encodeURIComponent(prenom)}&nom=${encodeURIComponent(nom)}`);
export const creerCompte = (corps) =>
  appel('/api/administration/comptes', { methode: 'POST', corps });
export const accuserRemise = (id) =>
  appel(`/api/administration/comptes/${id}/provisoire-remis`, { methode: 'POST' });
export const reinitialiserMotDePasse = (id) =>
  appel(`/api/administration/comptes/${id}/reinitialiser`, { methode: 'POST' });
export const changerStatutCompte = (id, statut) =>
  appel(`/api/administration/comptes/${id}/statut`, { methode: 'PUT', corps: { statut } });

export const listerReferentiels = () => appel('/api/administration/referentiels');
export const creerStructure = (corps) =>
  appel('/api/administration/structures', { methode: 'POST', corps });
export const modifierStructure = (id, corps) =>
  appel(`/api/administration/structures/${id}`, { methode: 'PUT', corps });
export const supprimerStructure = (id) =>
  appel(`/api/administration/structures/${id}`, { methode: 'DELETE' });
export const creerZone = (corps) =>
  appel('/api/administration/zones', { methode: 'POST', corps });
export const modifierZone = (id, corps) =>
  appel(`/api/administration/zones/${id}`, { methode: 'PUT', corps });
export const supprimerZone = (id) =>
  appel(`/api/administration/zones/${id}`, { methode: 'DELETE' });

export const listerParametres = () => appel('/api/administration/parametres');
export const modifierParametres = (modifications) =>
  appel('/api/administration/parametres', { methode: 'PUT', corps: { modifications } });
export const listerJournal = (filtres = {}) => {
  const parametres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') parametres.set(cle, valeur);
  }
  const suite = parametres.toString();
  return appel(`/api/administration/journal${suite ? `?${suite}` : ''}`);
};

/* -------------------------- Espace de gestion ------------------------ */
export const tableauDeBordGestion = () => appel('/api/gestion/tableau-de-bord');
export const detailGroupeGestion = (groupe) =>
  appel(`/api/gestion/groupes/${encodeURIComponent(groupe)}`);
export const listerSeuilsGestion = () => appel('/api/gestion/seuils');
export const modifierSeuilsGestion = (liste) =>
  appel('/api/gestion/seuils', { methode: 'PUT', corps: { seuils: liste } });

// E21 — enregistrer un don.
export const rechercherDonneurGestion = (q) =>
  appel(`/api/gestion/donneurs/recherche?q=${encodeURIComponent(q)}`);
export const enregistrerDonGestion = (corps) =>
  appel('/api/gestion/dons', { methode: 'POST', corps });

// E22 — registre des poches.
export const listerPochesGestion = (filtres = {}) => {
  const parametres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') parametres.set(cle, valeur);
  }
  const suite = parametres.toString();
  return appel(`/api/gestion/poches${suite ? `?${suite}` : ''}`);
};

// E23 et E27 gestion — une poche par son code.
export const trouverPocheGestion = (code) =>
  appel(`/api/gestion/poches/${encodeURIComponent(code)}`);
export const changerSituationPocheGestion = (code, corps) =>
  appel(`/api/gestion/poches/${encodeURIComponent(code)}/situation`, { methode: 'PUT', corps });

// E24 — registre des donneurs. Les filtres tableaux (groupes, zones)
// partent en une seule valeur séparée par des virgules.
function parametresDonneurs(filtres = {}) {
  const parametres = new URLSearchParams();
  if (filtres.texte) parametres.set('texte', filtres.texte);
  if (filtres.groupes?.length) parametres.set('groupes', filtres.groupes.join(','));
  if (filtres.zones?.length) parametres.set('zones', filtres.zones.join(','));
  if (filtres.eligibilite === 'aujourd_hui') parametres.set('eligibilite', 'aujourd_hui');
  if (filtres.joignabilite && filtres.joignabilite !== 'tous') parametres.set('joignabilite', filtres.joignabilite);
  if (filtres.sans_don_depuis_un_an) parametres.set('sans_don_depuis_un_an', '1');
  if (filtres.limite !== undefined) parametres.set('limite', filtres.limite);
  if (filtres.depart !== undefined) parametres.set('depart', filtres.depart);
  return parametres.toString();
}
export const listerDonneursGestion = (filtres = {}) => {
  const suite = parametresDonneurs(filtres);
  return appel(`/api/gestion/donneurs${suite ? `?${suite}` : ''}`);
};
export const resumerDonneursGestion = (filtres = {}) => {
  const suite = parametresDonneurs(filtres);
  return appel(`/api/gestion/donneurs/resume${suite ? `?${suite}` : ''}`);
};
export const ficheDonneurGestion = (id) => appel(`/api/gestion/donneurs/${id}`);

// E26 — statistiques. Aucun nom de donneur ne transite par ces appels.
export const statistiquesGestion = (depuis, jusquA) =>
  appel(`/api/gestion/statistiques?depuis=${encodeURIComponent(depuis)}&jusqu_a=${encodeURIComponent(jusquA)}`);

// E18, E19, E20 — appel au don, espace gestion.
export const cibleAlerteGestion = (groupe, zones, elargir) => {
  const parametres = new URLSearchParams();
  parametres.set('groupe', groupe);
  if (zones?.length) parametres.set('zones', zones.join(','));
  if (elargir) parametres.set('elargir', '1');
  return appel(`/api/gestion/alertes/cibles?${parametres.toString()}`);
};
export const listerAlertesGestion = () => appel('/api/gestion/alertes');
export const creerAlerteGestion = (corps) => appel('/api/gestion/alertes', { methode: 'POST', corps });
export const modifierAlerteGestion = (id, corps) =>
  appel(`/api/gestion/alertes/${id}`, { methode: 'PUT', corps });
export const envoyerAlerteGestion = (id) =>
  appel(`/api/gestion/alertes/${id}/envoi`, { methode: 'POST' });
export const suiviAlerteGestion = (id) => appel(`/api/gestion/alertes/${id}/suivi`);
export const listeAppelGestion = (id) => appel(`/api/gestion/alertes/${id}/liste-appel`);
export const cloturerAlerteGestion = (id) =>
  appel(`/api/gestion/alertes/${id}/cloture`, { methode: 'POST' });
export const supprimerAlerteGestion = (id) =>
  appel(`/api/gestion/alertes/${id}`, { methode: 'DELETE' });
export const changerJoignabiliteGestion = (idTelephone, resultat) =>
  appel(`/api/gestion/telephones/${idTelephone}/joignabilite`, { methode: 'PUT', corps: { resultat } });

/* ---------------------- Espace donneur : alertes ---------------------- */
export const mesAlertesDonneur = () => appel('/api/donneurs/moi/alertes');
export const detailAlerteDonneur = (id) => appel(`/api/donneurs/moi/alertes/${id}`);
export const repondreAlerteDonneur = (id, corps) =>
  appel(`/api/donneurs/moi/alertes/${id}/reponse`, { methode: 'POST', corps });
export const enregistrerDisponibiliteDonneur = (id, corps) =>
  appel(`/api/donneurs/moi/alertes/${id}/disponibilite`, { methode: 'POST', corps });
