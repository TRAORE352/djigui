// =====================================================================
//  DJIGUI — configuration WebAuthn (déverrouillage par empreinte/Face
//  ID). Canal en plus du mot de passe, jamais une dépendance : sans
//  passkey enregistré, ce module reste inerte et le verrou continue de
//  fonctionner exactement comme avant, au mot de passe seul.
//
//  RP_ID doit être le nom de domaine exact (sans protocole ni port) sur
//  lequel l'application est servie, ORIGIN l'origine complète
//  (protocole + domaine + port). Pour Render, ce sont deux variables à
//  régler dans l'environnement du service au moment du déploiement —
//  voir le README. En local, les valeurs par défaut conviennent aux
//  deux ports habituels du projet.
//
//  Le défi (challenge) d'une cérémonie WebAuthn est une valeur à usage
//  unique, valable quelques minutes : un Map en mémoire suffit pour un
//  service à instance unique (celui de ce projet), comme le reste du
//  code ne prévoit déjà aucun état partagé entre plusieurs instances.
// =====================================================================
const RP_NAME = 'DJIGUI';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGINES = (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:3002')
  .split(',').map((o) => o.trim()).filter(Boolean);

const DEFIS = new Map();
const DUREE_DEFI_MS = 5 * 60 * 1000;

function poserDefi(idDonneur, defi) {
  DEFIS.set(idDonneur, { defi, expire: Date.now() + DUREE_DEFI_MS });
}

function lireDefi(idDonneur) {
  const entree = DEFIS.get(idDonneur);
  if (!entree) return null;
  DEFIS.delete(idDonneur);
  if (entree.expire < Date.now()) return null;
  return entree.defi;
}

module.exports = { RP_NAME, RP_ID, ORIGINES, poserDefi, lireDefi };
