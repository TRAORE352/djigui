// =====================================================================
//  DJIGUI — configuration Web Push (VAPID).
//  Un seul point de configuration, comme db.js pour la base : le reste
//  du service importe l'instance déjà configurée, jamais le module
//  web-push directement.
//
//  Le push est un canal EN PLUS du canal « application », jamais une
//  dépendance : sans clés VAPID dans .env, ce module reste inerte
//  (configure = false) et le service démarre normalement. Seul
//  l'envoi de notifications sera indisponible.
// =====================================================================
const webpush = require('web-push');
const { pool } = require('./db');
const abonnementsPush = require('./requetes/abonnements-push');

const cleContact = process.env.VAPID_CONTACT || 'mailto:contact@djigui.app';
const configure = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configure) {
  webpush.setVapidDetails(cleContact, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

// E18 — envoyerAlerte (requetes/alertes.js) appelle ceci APRÈS son COMMIT,
// en fire-and-forget : rien ici ne doit jamais remonter jusqu'à l'agent.
// L'alerte a déjà réussi ; le push n'est qu'un canal en plus du canal
// « application ». Un donneur sans abonnement, une clé VAPID absente, un
// service de push en panne : silence, jamais une exception qui remonte.
async function envoyerPushCandidats(candidats, alerte) {
  if (!configure || candidats.length === 0) return;

  const idsDonneurs = candidats.map((candidat) => candidat.id_donneur);
  const abonnements = await abonnementsPush.abonnementsPourDonneurs(idsDonneurs);
  if (abonnements.length === 0) return;

  const structureResultat = await pool.query(
    'SELECT nom FROM structure_sang WHERE id_structure = $1', [alerte.id_structure]);
  const nomStructure = structureResultat.rows[0]?.nom || 'Un centre';

  const charge = JSON.stringify({
    titre: 'DJIGUI — appel au don',
    corps: `${nomStructure} recherche des donneurs ${alerte.groupe_cible}.`,
    url: '/alertes'
  });

  await Promise.all(abonnements.map(async (abonnement) => {
    try {
      await webpush.sendNotification({
        endpoint: abonnement.endpoint,
        keys: { p256dh: abonnement.cle_p256dh, auth: abonnement.cle_auth }
      }, charge);
      await abonnementsPush.marquerEnvoiReussi(abonnement.id_abonnement).catch(() => {});
    } catch (erreur) {
      if (erreur.statusCode === 404 || erreur.statusCode === 410) {
        await abonnementsPush.supprimerAbonnementParId(abonnement.id_abonnement).catch(() => {});
      }
      // Toute autre erreur (réseau, service de push en panne, etc.) :
      // avalée. Un push raté ne doit jamais faire échouer les autres,
      // ni remonter jusqu'à l'appelant.
    }
  }));
}

module.exports = {
  webpush, configure, clePublique: process.env.VAPID_PUBLIC_KEY || null, envoyerPushCandidats
};
