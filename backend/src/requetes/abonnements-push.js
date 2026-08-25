// =====================================================================
//  DJIGUI — abonnements Web Push (E10, section Notifications).
//  Le push est un canal en plus du canal « application » : cette table
//  peut rester vide sans que rien d'autre ne casse.
// =====================================================================
const { pool } = require('../db');

// Un même appareil peut se réabonner (permission redemandée, navigateur
// réinstallé) sans changer d'endpoint : ON CONFLICT (endpoint) rafraîchit
// la ligne plutôt que d'en créer une seconde pour le même point de
// terminaison (contrainte uk_abonnement_endpoint).
async function enregistrerAbonnement(idDonneur, endpoint, clep256dh, cleAuth) {
  await pool.query(
    `INSERT INTO abonnement_push (id_donneur, endpoint, cle_p256dh, cle_auth, date_creation)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       id_donneur = EXCLUDED.id_donneur, cle_p256dh = EXCLUDED.cle_p256dh,
       cle_auth = EXCLUDED.cle_auth, date_creation = NOW()`,
    [idDonneur, endpoint, clep256dh, cleAuth]);
}

// Ne retire que l'abonnement de CET appareil (par endpoint) : désactiver
// depuis un téléphone ne doit jamais couper les autres appareils du
// même donneur.
async function supprimerAbonnement(idDonneur, endpoint) {
  await pool.query(
    'DELETE FROM abonnement_push WHERE id_donneur = $1 AND endpoint = $2',
    [idDonneur, endpoint]);
}

// E18/envoyerAlerte — tous les abonnements des donneurs qui viennent de
// recevoir l'appel (un même donneur peut avoir plusieurs appareils).
async function abonnementsPourDonneurs(idsDonneurs) {
  if (!idsDonneurs.length) return [];
  const resultat = await pool.query(
    `SELECT id_abonnement, id_donneur, endpoint, cle_p256dh, cle_auth
       FROM abonnement_push
      WHERE id_donneur = ANY($1::int[])`,
    [idsDonneurs]);
  return resultat.rows;
}

async function marquerEnvoiReussi(idAbonnement) {
  await pool.query('UPDATE abonnement_push SET date_dernier_envoi = NOW() WHERE id_abonnement = $1', [idAbonnement]);
}

// Le service de push répond 404/410 quand l'appareil n'existe plus
// (désinstallation, données de navigateur effacées...) : l'abonnement
// est mort, on le retire plutôt que de retenter indéfiniment dans le vide.
async function supprimerAbonnementParId(idAbonnement) {
  await pool.query('DELETE FROM abonnement_push WHERE id_abonnement = $1', [idAbonnement]);
}

module.exports = {
  enregistrerAbonnement, supprimerAbonnement,
  abonnementsPourDonneurs, marquerEnvoiReussi, supprimerAbonnementParId
};
