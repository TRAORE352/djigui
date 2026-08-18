// DJIGUI — table structure_sang (T4) et seuils (T5).
const { pool } = require('../db');
const { GROUPES } = require('../regles/compatibilite');

const TYPES_LISIBLES = {
  crts: 'Centre régional de transfusion sanguine',
  depot: 'Dépôt de sang',
  banque_hopital: 'Banque de sang hospitalière'
};

async function listerStructures() {
  const resultat = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM utilisateur u
              WHERE u.id_structure = s.id_structure AND u.statut = 'actif') AS nb_comptes
       FROM structure_sang s
      ORDER BY s.ville, s.nom`);
  // nb_comptes vient d'un COUNT(*) : bigint Postgres, chaîne côté pg par
  // défaut. Recasté pour garder un nombre en JSON, comme avant.
  return resultat.rows.map((ligne) => (
    { ...ligne, nb_comptes: Number(ligne.nb_comptes), type_lisible: TYPES_LISIBLES[ligne.type] }));
}

async function trouverStructure(idStructure) {
  const resultat = await pool.query(
    'SELECT * FROM structure_sang WHERE id_structure = $1', [idStructure]);
  return resultat.rows[0] || null;
}

// Création d'une structure ET de ses huit seuils, en une transaction
// (relation R12, règle RG18) : soit tout, soit rien. Client dédié.
async function creerStructureAvecSeuils(donnees) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await client.query(
      `INSERT INTO structure_sang (nom, type, ville, adresse, telephone, horaires)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_structure`,
      [donnees.nom, donnees.type, donnees.ville,
       donnees.adresse || null, donnees.telephone || null, donnees.horaires || null]);
    const idStructure = resultat.rows[0].id_structure;
    for (const groupe of GROUPES) {
      await client.query(
        'INSERT INTO seuil_stock (id_structure, groupe_sanguin) VALUES ($1, $2)',
        [idStructure, groupe]);
    }
    await client.query('COMMIT');
    return idStructure;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

async function modifierStructure(idStructure, donnees) {
  await pool.query(
    `UPDATE structure_sang
        SET nom = $1, type = $2, ville = $3, adresse = $4, telephone = $5, horaires = $6
      WHERE id_structure = $7`,
    [donnees.nom, donnees.type, donnees.ville, donnees.adresse || null,
     donnees.telephone || null, donnees.horaires || null, idStructure]);
}

async function compterComptesDeStructure(idStructure) {
  const resultat = await pool.query(
    'SELECT COUNT(*) AS nb FROM utilisateur WHERE id_structure = $1', [idStructure]);
  return Number(resultat.rows[0].nb);
}

async function supprimerStructure(idStructure) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM seuil_stock WHERE id_structure = $1', [idStructure]);
    await client.query('DELETE FROM structure_sang WHERE id_structure = $1', [idStructure]);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = {
  TYPES_LISIBLES, listerStructures, trouverStructure, creerStructureAvecSeuils,
  modifierStructure, compterComptesDeStructure, supprimerStructure
};
