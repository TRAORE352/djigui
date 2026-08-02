// DJIGUI — table zone (T3). Référentiel de ciblage, tenu par
// l'administrateur en E29. C'est lui qui remplace tout fichier de
// remplissage automatique (contrainte C3).
const { pool } = require('../db');

async function listerZones() {
  const [lignes] = await pool.query(
    `SELECT z.id_zone, z.nom, z.ville,
            (SELECT COUNT(*) FROM donneur d WHERE d.id_zone = z.id_zone) AS nb_donneurs
       FROM zone z
      ORDER BY z.ville, z.nom`);
  return lignes;
}

async function creerZone(nom, ville) {
  const [resultat] = await pool.query(
    'INSERT INTO zone (nom, ville) VALUES (?, ?)', [nom, ville]);
  return resultat.insertId;
}

async function modifierZone(idZone, nom, ville) {
  await pool.query('UPDATE zone SET nom = ?, ville = ? WHERE id_zone = ?',
    [nom, ville, idZone]);
}

async function zoneExiste(idZone) {
  const [lignes] = await pool.query('SELECT id_zone FROM zone WHERE id_zone = ?', [idZone]);
  return lignes.length > 0;
}

// Règle de dépendance annoncée en E29 : une zone habitée ne se retire pas.
async function compterDonneursDeZone(idZone) {
  const [lignes] = await pool.query(
    'SELECT COUNT(*) AS nb FROM donneur WHERE id_zone = ?', [idZone]);
  return lignes[0].nb;
}

async function supprimerZone(idZone) {
  await pool.query('DELETE FROM zone WHERE id_zone = ?', [idZone]);
}

module.exports = {
  listerZones, creerZone, modifierZone, zoneExiste,
  compterDonneursDeZone, supprimerZone
};
