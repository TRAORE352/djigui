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

  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    for (const ligne of liste) {
      await connexion.query(
        `UPDATE seuil_stock
            SET seuil_bas = ?, seuil_critique = ?, modifie_par = ?, date_modification = NOW()
          WHERE id_structure = ? AND groupe_sanguin = ?`,
        [Number(ligne.seuil_bas), Number(ligne.seuil_critique), idAgent, idStructure, ligne.groupe_sanguin]);
    }
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = { listerSeuils, modifierSeuils };
