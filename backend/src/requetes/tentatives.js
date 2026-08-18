// DJIGUI — table tentative_recuperation (T16). Règle RG30 : trois
// tentatives par heure et par compte. Requête clé C.5 du cahier des charges.
const { pool } = require('../db');

async function compterDerniereHeure(identifiant) {
  const resultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM tentative_recuperation
      WHERE identifiant = $1
        AND date_tentative >= NOW() - INTERVAL '1 hour'`, [identifiant]);
  return Number(resultat.rows[0].nb);
}

async function enregistrerTentative(identifiant, succes) {
  await pool.query(
    'INSERT INTO tentative_recuperation (identifiant, succes) VALUES ($1, $2)',
    [identifiant, succes]);
}

module.exports = { compterDerniereHeure, enregistrerTentative };
