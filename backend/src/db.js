// =====================================================================
//  DJIGUI — connexion unique à la base.
//  Un seul pool partagé par toute l'application. Les identifiants
//  viennent des variables d'environnement (règle C7).
//
//  Ce fichier traduit aussi les pannes de base en français clair :
//  la dernière fois, un « service injoignable » sans explication a
//  coûté une heure de recherche.
// =====================================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOTE || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_UTILISATEUR,
  password: process.env.DB_MOT_DE_PASSE || '',
  database: process.env.DB_NOM || 'djigui',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true // dates en texte, aucune surprise de fuseau horaire
});

// Traduit une panne de base en phrase compréhensible et en remède.
function expliquerPanne(erreur) {
  const codes = {
    ECONNREFUSED:
      'MariaDB ne répond pas. Ouvrez XAMPP et démarrez MySQL, puis relancez.',
    ER_ACCESS_DENIED_ERROR:
      'Identifiants de base refusés. Vérifiez DB_UTILISATEUR et DB_MOT_DE_PASSE dans le fichier .env.',
    ER_BAD_DB_ERROR:
      'La base djigui n\u2019existe pas. Importez sql/01-creation.sql dans phpMyAdmin.',
    ENOTFOUND:
      'Adresse de base introuvable. Vérifiez DB_HOTE dans le fichier .env.',
    ETIMEDOUT:
      'La base ne répond pas dans le temps imparti. Vérifiez que MySQL tourne dans XAMPP.'
  };
  return codes[erreur && erreur.code] || `Erreur de base : ${erreur.message}`;
}

// Vérifie la connexion et l'état des tables. Sert au démarrage et à
// la route /api/sante.
async function diagnostiquer() {
  const connexion = await pool.getConnection();
  try {
    const [tables] = await connexion.query(
      `SELECT COUNT(*) AS nb FROM information_schema.tables
        WHERE table_schema = ?`, [process.env.DB_NOM || 'djigui']);
    const [zones] = await connexion.query('SELECT COUNT(*) AS nb FROM zone');
    const [structures] = await connexion.query('SELECT COUNT(*) AS nb FROM structure_sang');
    const [comptes] = await connexion.query(
      `SELECT role, COUNT(*) AS nb FROM utilisateur
        WHERE statut = 'actif' GROUP BY role`);
    const [parametres] = await connexion.query('SELECT COUNT(*) AS nb FROM parametre');
    const repartition = { donneur: 0, gestionnaire: 0, admin: 0 };
    for (const ligne of comptes) repartition[ligne.role] = ligne.nb;
    return {
      base_connectee: true,
      nb_tables: tables[0].nb,
      nb_parametres: parametres[0].nb,
      nb_zones: zones[0].nb,
      nb_structures: structures[0].nb,
      comptes_actifs: repartition
    };
  } finally {
    connexion.release();
  }
}

module.exports = { pool, diagnostiquer, expliquerPanne };
