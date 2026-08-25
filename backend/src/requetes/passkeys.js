// =====================================================================
//  DJIGUI — clé d'accès biométrique (T. passkey_donneur), verrou
//  d'application. Un seul passkey par donneur : ré-enregistrer en
//  remplace un ancien (ON CONFLICT), plutôt que d'accumuler des
//  appareils morts qu'il faudrait gérer.
// =====================================================================
const { pool } = require('../db');

async function trouverParDonneur(idDonneur) {
  const resultat = await pool.query(
    'SELECT id_donneur, credential_id, cle_publique, compteur, transports FROM passkey_donneur WHERE id_donneur = $1',
    [idDonneur]);
  return resultat.rows[0] || null;
}

async function trouverParCredential(credentialId) {
  const resultat = await pool.query(
    'SELECT id_donneur, credential_id, cle_publique, compteur, transports FROM passkey_donneur WHERE credential_id = $1',
    [credentialId]);
  return resultat.rows[0] || null;
}

async function enregistrer(idDonneur, credentialId, clePublique, compteur, transports) {
  await pool.query(
    `INSERT INTO passkey_donneur (id_donneur, credential_id, cle_publique, compteur, transports)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_donneur) DO UPDATE SET
       credential_id = EXCLUDED.credential_id, cle_publique = EXCLUDED.cle_publique,
       compteur = EXCLUDED.compteur, transports = EXCLUDED.transports, date_creation = NOW()`,
    [idDonneur, credentialId, clePublique, compteur, transports ? JSON.stringify(transports) : null]);
}

async function mettreAJourCompteur(idDonneur, compteur) {
  await pool.query('UPDATE passkey_donneur SET compteur = $1 WHERE id_donneur = $2', [compteur, idDonneur]);
}

async function supprimer(idDonneur) {
  await pool.query('DELETE FROM passkey_donneur WHERE id_donneur = $1', [idDonneur]);
}

module.exports = { trouverParDonneur, trouverParCredential, enregistrer, mettreAJourCompteur, supprimer };
