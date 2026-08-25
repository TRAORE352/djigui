// =====================================================================
//  DJIGUI — abonnement aux notifications Web Push.
//  Canal EN PLUS du canal « application » : aucune fonction ici ne
//  lève, chacune retourne un état lisible par l'écran appelant. La
//  permission n'est JAMAIS demandée toute seule : seul un clic explicite
//  du donneur (bouton Compte, invite Alertes) appelle activerNotifications().
// =====================================================================
import { configPublique, enregistrerAbonnementPush, retirerAbonnementPush } from './api';

function supporte() {
  return typeof window !== 'undefined'
    && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Une clé VAPID publique s'échange en base64 URL-safe ; pushManager.subscribe
// attend des octets bruts.
function urlBase64VersOctets(base64UrlString) {
  const remplissage = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + remplissage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

// État courant, sans rien demander à l'utilisateur : à lire librement
// pour décider quoi afficher (bouton, invite, message).
// { supporte, permission: 'default'|'granted'|'denied'|'indisponible', abonne }
export async function etatNotifications() {
  if (!supporte()) return { supporte: false, permission: 'indisponible', abonne: false };
  const permission = Notification.permission;
  if (permission !== 'granted') return { supporte: true, permission, abonne: false };
  try {
    const inscription = await navigator.serviceWorker.ready;
    const abonnement = await inscription.pushManager.getSubscription();
    return { supporte: true, permission, abonne: Boolean(abonnement) };
  } catch {
    return { supporte: true, permission, abonne: false };
  }
}

// À appeler UNIQUEMENT depuis un clic. Retourne { etat } avec
// etat parmi : 'granted', 'denied', 'default', 'indisponible', 'erreur'.
export async function activerNotifications() {
  if (!supporte()) return { etat: 'indisponible' };

  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { etat: 'erreur' };
  }
  if (permission !== 'granted') return { etat: permission };

  try {
    const inscription = await navigator.serviceWorker.ready;
    const { vapid_public_key: clePublique } = await configPublique();
    if (!clePublique) {
      return { etat: 'erreur', message: 'Les notifications ne sont pas encore prêtes côté service.' };
    }

    let abonnement = await inscription.pushManager.getSubscription();
    if (!abonnement) {
      abonnement = await inscription.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64VersOctets(clePublique)
      });
    }
    const { endpoint, keys } = abonnement.toJSON();
    await enregistrerAbonnementPush({ endpoint, keys });
    return { etat: 'granted' };
  } catch (probleme) {
    return { etat: 'erreur', message: probleme.message };
  }
}

// Désabonne cet appareil : local d'abord, puis le backend. Ne lève jamais.
export async function desactiverNotifications() {
  if (!supporte()) return { ok: false };
  try {
    const inscription = await navigator.serviceWorker.ready;
    const abonnement = await inscription.pushManager.getSubscription();
    if (abonnement) {
      const { endpoint } = abonnement;
      await abonnement.unsubscribe();
      await retirerAbonnementPush(endpoint);
    }
    return { ok: true };
  } catch (probleme) {
    return { ok: false, message: probleme.message };
  }
}
