// =====================================================================
//  DJIGUI — déverrouillage par empreinte/Face ID (WebAuthn), verrou
//  d'application. Aucune bibliothèque tierce : l'API du navigateur
//  suffit, seul l'encodage base64url des tampons binaires demande un
//  peu de code. L'empreinte elle-même ne quitte jamais l'appareil ;
//  ce fichier ne manipule que des clés et des identifiants opaques.
// =====================================================================
import {
  optionsEnregistrementPasskey, enregistrerPasskeyApi,
  optionsDeverrouillagePasskey, deverrouillerAvecPasskeyApi
} from './api';

function tamponVersBase64url(tampon) {
  const octets = new Uint8Array(tampon);
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlVersTampon(texte) {
  const normalise = texte.replace(/-/g, '+').replace(/_/g, '/');
  const complete = normalise + '='.repeat((4 - (normalise.length % 4)) % 4);
  const binaire = atob(complete);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets.buffer;
}

const CLE_PASSKEY_ACTIF = 'djigui_passkey_actif';
const CLE_PASSKEY_PROPOSE = 'djigui_passkey_propose';

// Drapeaux locaux, pour décider instantanément quoi afficher au verrou
// sans attendre un aller-retour réseau. La vérité reste côté service
// (table passkey_donneur) ; un drapeau périmé ne fait au pire
// qu'échouer proprement sur un appel, jamais un risque de sécurité.
export function passkeyActifLocalement() {
  return typeof window !== 'undefined' && window.localStorage.getItem(CLE_PASSKEY_ACTIF) === '1';
}
export function marquerPasskeyActifLocalement() {
  if (typeof window !== 'undefined') window.localStorage.setItem(CLE_PASSKEY_ACTIF, '1');
}
export function oublierPasskeyLocalement() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(CLE_PASSKEY_ACTIF);
}
export function passkeyDejaPropose() {
  return typeof window !== 'undefined' && window.localStorage.getItem(CLE_PASSKEY_PROPOSE) === '1';
}
export function marquerPasskeyPropose() {
  if (typeof window !== 'undefined') window.localStorage.setItem(CLE_PASSKEY_PROPOSE, '1');
}

export function biometrieDisponible() {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}

export async function biometrieVerifiablePourAppareil() {
  if (!biometrieDisponible()) return false;
  try { return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

// Premier déverrouillage réussi au mot de passe → propose d'enregistrer
// l'empreinte de cet appareil pour la prochaine fois.
export async function enregistrerPasskey() {
  const options = await optionsEnregistrementPasskey();
  const creation = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: base64urlVersTampon(options.challenge),
      user: { ...options.user, id: base64urlVersTampon(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({
        ...c, id: base64urlVersTampon(c.id)
      }))
    }
  });
  const reponse = {
    id: creation.id,
    rawId: tamponVersBase64url(creation.rawId),
    type: creation.type,
    response: {
      attestationObject: tamponVersBase64url(creation.response.attestationObject),
      clientDataJSON: tamponVersBase64url(creation.response.clientDataJSON)
    },
    clientExtensionResults: creation.getClientExtensionResults?.() || {}
  };
  return enregistrerPasskeyApi(reponse);
}

// Écran de verrouillage → déverrouille par empreinte/Face ID plutôt
// que par mot de passe. Retourne { jeton } comme le déverrouillage au
// mot de passe : même contrat, même appelant.
export async function deverrouillerAvecPasskey() {
  const options = await optionsDeverrouillagePasskey();
  const assertion = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: base64urlVersTampon(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((c) => ({
        ...c, id: base64urlVersTampon(c.id)
      }))
    }
  });
  const reponse = {
    id: assertion.id,
    rawId: tamponVersBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: tamponVersBase64url(assertion.response.authenticatorData),
      clientDataJSON: tamponVersBase64url(assertion.response.clientDataJSON),
      signature: tamponVersBase64url(assertion.response.signature),
      userHandle: assertion.response.userHandle ? tamponVersBase64url(assertion.response.userHandle) : undefined
    },
    clientExtensionResults: assertion.getClientExtensionResults?.() || {}
  };
  return deverrouillerAvecPasskeyApi(reponse);
}
