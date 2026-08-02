// DJIGUI — table telephone_donneur (T15). Règles RG21 à RG25, RG37, RG38.
const { pool } = require('../db');

// Ordre d'appel du gestionnaire (règle RG24).
async function listerParDonneur(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
       FROM telephone_donneur
      WHERE id_donneur = ?
      ORDER BY rang`, [idDonneur]);
  return lignes;
}

// Premier rang libre entre 2 et le maximum autorisé.
async function premierRangLibre(idDonneur, rangMaximum) {
  const [lignes] = await pool.query(
    'SELECT rang FROM telephone_donneur WHERE id_donneur = ? ORDER BY rang', [idDonneur]);
  const pris = new Set(lignes.map((ligne) => ligne.rang));
  for (let rang = 2; rang <= rangMaximum; rang += 1) {
    if (!pris.has(rang)) return rang;
  }
  return null;
}

async function ajouterNumero(idDonneur, numero, rang) {
  const [resultat] = await pool.query(
    'INSERT INTO telephone_donneur (id_donneur, numero, rang) VALUES (?, ?, ?)',
    [idDonneur, numero, rang]);
  return resultat.insertId;
}

async function trouverNumero(idTelephone) {
  const [lignes] = await pool.query(
    'SELECT * FROM telephone_donneur WHERE id_telephone = ?', [idTelephone]);
  return lignes[0] || null;
}

async function supprimerNumero(idTelephone) {
  await pool.query('DELETE FROM telephone_donneur WHERE id_telephone = ?', [idTelephone]);
}

// Règle RG37 : joignabilité constatée par un agent.
async function changerJoignabilite(idTelephone, statut) {
  await pool.query(
    `UPDATE telephone_donneur
        SET statut_joignabilite = ?, date_dernier_controle = CURDATE()
      WHERE id_telephone = ?`, [statut, idTelephone]);
}

// Règle RG38 : le numéro principal est aussi l'identifiant de connexion.
// Les deux changent dans une seule transaction (principe 3, chapitre 9.4).
async function remplacerNumeroPrincipal(idDonneur, idUtilisateur, nouveauNumero, conserverAncien, rangMaximum) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    const [actuels] = await connexion.query(
      'SELECT id_telephone, numero, rang FROM telephone_donneur WHERE id_donneur = ? ORDER BY rang',
      [idDonneur]);
    const principal = actuels.find((ligne) => ligne.rang === 1);
    const ancienNumero = principal ? principal.numero : null;

    if (conserverAncien && ancienNumero) {
      const pris = new Set(actuels.map((ligne) => ligne.rang));
      let rangLibre = null;
      for (let rang = 2; rang <= rangMaximum; rang += 1) {
        if (!pris.has(rang)) { rangLibre = rang; break; }
      }
      if (rangLibre) {
        // Le rang 1 doit d'abord être libéré : on déplace l'ancien numéro.
        await connexion.query(
          'UPDATE telephone_donneur SET rang = ? WHERE id_telephone = ?',
          [rangLibre, principal.id_telephone]);
      } else {
        await connexion.query(
          'DELETE FROM telephone_donneur WHERE id_telephone = ?', [principal.id_telephone]);
      }
    } else if (principal) {
      await connexion.query(
        'DELETE FROM telephone_donneur WHERE id_telephone = ?', [principal.id_telephone]);
    }

    await connexion.query(
      'INSERT INTO telephone_donneur (id_donneur, numero, rang) VALUES (?, ?, 1)',
      [idDonneur, nouveauNumero]);
    await connexion.query(
      'UPDATE utilisateur SET identifiant = ? WHERE id_utilisateur = ?',
      [nouveauNumero, idUtilisateur]);

    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = {
  listerParDonneur, premierRangLibre, ajouterNumero, trouverNumero,
  supprimerNumero, changerJoignabilite, remplacerNumeroPrincipal
};
