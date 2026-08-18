// DJIGUI — table telephone_donneur (T15). Règles RG21 à RG25, RG37, RG38.
const { pool } = require('../db');

// Ordre d'appel du gestionnaire (règle RG24).
async function listerParDonneur(idDonneur) {
  const resultat = await pool.query(
    `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
       FROM telephone_donneur
      WHERE id_donneur = $1
      ORDER BY rang`, [idDonneur]);
  return resultat.rows;
}

// Premier rang libre entre 2 et le maximum autorisé.
async function premierRangLibre(idDonneur, rangMaximum) {
  const resultat = await pool.query(
    'SELECT rang FROM telephone_donneur WHERE id_donneur = $1 ORDER BY rang', [idDonneur]);
  const pris = new Set(resultat.rows.map((ligne) => ligne.rang));
  for (let rang = 2; rang <= rangMaximum; rang += 1) {
    if (!pris.has(rang)) return rang;
  }
  return null;
}

// insertId n'existe pas en pg : RETURNING + lecture de rows[0].
async function ajouterNumero(idDonneur, numero, rang) {
  const resultat = await pool.query(
    'INSERT INTO telephone_donneur (id_donneur, numero, rang) VALUES ($1, $2, $3) RETURNING id_telephone',
    [idDonneur, numero, rang]);
  return resultat.rows[0].id_telephone;
}

async function trouverNumero(idTelephone) {
  const resultat = await pool.query(
    'SELECT * FROM telephone_donneur WHERE id_telephone = $1', [idTelephone]);
  return resultat.rows[0] || null;
}

async function supprimerNumero(idTelephone) {
  await pool.query('DELETE FROM telephone_donneur WHERE id_telephone = $1', [idTelephone]);
}

// Règle RG37 : joignabilité constatée par un agent.
async function changerJoignabilite(idTelephone, statut) {
  await pool.query(
    `UPDATE telephone_donneur
        SET statut_joignabilite = $1, date_dernier_controle = CURRENT_DATE
      WHERE id_telephone = $2`, [statut, idTelephone]);
}

// Règle RG38 : le numéro principal est aussi l'identifiant de connexion.
// Les deux changent dans une seule transaction (principe 3, chapitre 9.4).
// Client dédié : toutes les requêtes (SELECT compris, pour voir ses
// propres écritures avant COMMIT) passent par lui, jamais par pool.
// Les erreurs de doublon (numero UNIQUE, uk_rang UNIQUE) remontent en
// 23505 : laissées volontairement non attrapées ici, c'est au contrôleur
// (donneurs.controleur.js) de les traduire en réponse 409 propre.
async function remplacerNumeroPrincipal(idDonneur, idUtilisateur, nouveauNumero, conserverAncien, rangMaximum) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const actuelsResultat = await client.query(
      'SELECT id_telephone, numero, rang FROM telephone_donneur WHERE id_donneur = $1 ORDER BY rang',
      [idDonneur]);
    const actuels = actuelsResultat.rows;
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
        await client.query(
          'UPDATE telephone_donneur SET rang = $1 WHERE id_telephone = $2',
          [rangLibre, principal.id_telephone]);
      } else {
        await client.query(
          'DELETE FROM telephone_donneur WHERE id_telephone = $1', [principal.id_telephone]);
      }
    } else if (principal) {
      await client.query(
        'DELETE FROM telephone_donneur WHERE id_telephone = $1', [principal.id_telephone]);
    }

    await client.query(
      'INSERT INTO telephone_donneur (id_donneur, numero, rang) VALUES ($1, $2, 1)',
      [idDonneur, nouveauNumero]);
    await client.query(
      'UPDATE utilisateur SET identifiant = $1 WHERE id_utilisateur = $2',
      [nouveauNumero, idUtilisateur]);

    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = {
  listerParDonneur, premierRangLibre, ajouterNumero, trouverNumero,
  supprimerNumero, changerJoignabilite, remplacerNumeroPrincipal
};
