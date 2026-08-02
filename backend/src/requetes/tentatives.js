// DJIGUI — table tentative_recuperation (T16). Règle RG30 : trois
// tentatives par heure et par compte. Requête clé C.5 du cahier des charges.
const { pool } = require('../db');

async function compterDerniereHeure(identifiant) {
  const [lignes] = await pool.query(
    `SELECT COUNT(*) AS nb FROM tentative_recuperation
      WHERE identifiant = ?
        AND date_tentative >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`, [identifiant]);
  return lignes[0].nb;
}

async function enregistrerTentative(identifiant, succes) {
  await pool.query(
    'INSERT INTO tentative_recuperation (identifiant, succes) VALUES (?, ?)',
    [identifiant, succes ? 1 : 0]);
}

module.exports = { compterDerniereHeure, enregistrerTentative };
