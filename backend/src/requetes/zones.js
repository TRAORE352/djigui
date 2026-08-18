// DJIGUI — table zone (T3). Référentiel de ciblage, tenu par
// l'administrateur en E29. C'est lui qui remplace tout fichier de
// remplissage automatique (contrainte C3).
const { pool } = require('../db');

async function listerZones() {
  const resultat = await pool.query(
    `SELECT z.id_zone, z.nom, z.ville,
            (SELECT COUNT(*) FROM donneur d WHERE d.id_zone = z.id_zone) AS nb_donneurs
       FROM zone z
      ORDER BY z.ville, z.nom`);
  return resultat.rows;
}

async function creerZone(nom, ville) {
  const resultat = await pool.query(
    'INSERT INTO zone (nom, ville) VALUES ($1, $2) RETURNING id_zone', [nom, ville]);
  return resultat.rows[0].id_zone;
}

async function modifierZone(idZone, nom, ville) {
  await pool.query('UPDATE zone SET nom = $1, ville = $2 WHERE id_zone = $3',
    [nom, ville, idZone]);
}

async function zoneExiste(idZone) {
  const resultat = await pool.query('SELECT id_zone FROM zone WHERE id_zone = $1', [idZone]);
  return resultat.rows.length > 0;
}

// Règle de dépendance annoncée en E29 : une zone habitée ne se retire pas.
async function compterDonneursDeZone(idZone) {
  const resultat = await pool.query(
    'SELECT COUNT(*) AS nb FROM donneur WHERE id_zone = $1', [idZone]);
  return Number(resultat.rows[0].nb);
}

async function supprimerZone(idZone) {
  await pool.query('DELETE FROM zone WHERE id_zone = $1', [idZone]);
}

module.exports = {
  listerZones, creerZone, modifierZone, zoneExiste,
  compterDonneursDeZone, supprimerZone
};
