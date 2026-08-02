// DJIGUI — table structure_sang (T4) et seuils (T5).
const { pool } = require('../db');
const { GROUPES } = require('../regles/compatibilite');

const TYPES_LISIBLES = {
  crts: 'Centre régional de transfusion sanguine',
  depot: 'Dépôt de sang',
  banque_hopital: 'Banque de sang hospitalière'
};

async function listerStructures() {
  const [lignes] = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM utilisateur u
              WHERE u.id_structure = s.id_structure AND u.statut = 'actif') AS nb_comptes
       FROM structure_sang s
      ORDER BY s.ville, s.nom`);
  return lignes.map((ligne) => ({ ...ligne, type_lisible: TYPES_LISIBLES[ligne.type] }));
}

async function trouverStructure(idStructure) {
  const [lignes] = await pool.query(
    'SELECT * FROM structure_sang WHERE id_structure = ?', [idStructure]);
  return lignes[0] || null;
}

// Création d'une structure ET de ses huit seuils, en une transaction
// (relation R12, règle RG18) : soit tout, soit rien.
async function creerStructureAvecSeuils(donnees) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    const [resultat] = await connexion.query(
      `INSERT INTO structure_sang (nom, type, ville, adresse, telephone, horaires)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [donnees.nom, donnees.type, donnees.ville,
       donnees.adresse || null, donnees.telephone || null, donnees.horaires || null]);
    const idStructure = resultat.insertId;
    for (const groupe of GROUPES) {
      await connexion.query(
        'INSERT INTO seuil_stock (id_structure, groupe_sanguin) VALUES (?, ?)',
        [idStructure, groupe]);
    }
    await connexion.commit();
    return idStructure;
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

async function modifierStructure(idStructure, donnees) {
  await pool.query(
    `UPDATE structure_sang
        SET nom = ?, type = ?, ville = ?, adresse = ?, telephone = ?, horaires = ?
      WHERE id_structure = ?`,
    [donnees.nom, donnees.type, donnees.ville, donnees.adresse || null,
     donnees.telephone || null, donnees.horaires || null, idStructure]);
}

async function compterComptesDeStructure(idStructure) {
  const [lignes] = await pool.query(
    'SELECT COUNT(*) AS nb FROM utilisateur WHERE id_structure = ?', [idStructure]);
  return lignes[0].nb;
}

async function supprimerStructure(idStructure) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    await connexion.query('DELETE FROM seuil_stock WHERE id_structure = ?', [idStructure]);
    await connexion.query('DELETE FROM structure_sang WHERE id_structure = ?', [idStructure]);
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = {
  TYPES_LISIBLES, listerStructures, trouverStructure, creerStructureAvecSeuils,
  modifierStructure, compterComptesDeStructure, supprimerStructure
};
