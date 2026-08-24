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

const cleContact = process.env.VAPID_CONTACT || 'mailto:contact@djigui.app';
const configure = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configure) {
  webpush.setVapidDetails(cleContact, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

module.exports = { webpush, configure, clePublique: process.env.VAPID_PUBLIC_KEY || null };
