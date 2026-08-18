// DJIGUI — seuils de stock (T5), écran E25.
// Les seuils s'affichent toujours avec le stock du jour à côté : on
// règle un seuil en regardant la réalité, pas une liste isolée.
const { pool } = require('../db');
const { GROUPES } = require('../regles/compatibilite');
const { stockParGroupe } = require('./poches');

async function listerSeuils(idStructure, idAgent) {
  return stockParGroupe(idStructure, idAgent);
}

// Refuse l'ensemble si une seule ligne est invalide : soit tout, soit
// rien. Les deux règles de refus sont vérifiées avant toute écriture.
async function modifierSeuils(idStructure, liste, idAgent) {
  for (const ligne of liste) {
    if (!GROUPES.includes(ligne.groupe_sanguin)) {
      throw new Error(`Le groupe ${ligne.groupe_sanguin} n’existe pas.`);
    }
    const bas = Number(ligne.seuil_bas);
    const critique = Number(ligne.seuil_critique);
    if (!Number.isFinite(bas) || !Number.isFinite(critique) || bas === 0 || critique === 0) {
      throw new Error(`Le seuil du groupe ${ligne.groupe_sanguin} ne peut pas valoir zéro.`);
    }
    if (critique > bas) {
      throw new Error('Le seuil critique ne peut pas dépasser le seuil bas.');
    }
  }

  // Transaction : un client dédié, toutes les requêtes dessus.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const ligne of liste) {
      await client.query(
        `UPDATE seuil_stock
            SET seuil_bas = $1, seuil_critique = $2, modifie_par = $3, date_modification = NOW()
          WHERE id_structure = $4 AND groupe_sanguin = $5`,
        [Number(ligne.seuil_bas), Number(ligne.seuil_critique), idAgent, idStructure, ligne.groupe_sanguin]);
    }
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = { listerSeuils, modifierSeuils };
