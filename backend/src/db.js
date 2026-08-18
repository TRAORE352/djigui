// =====================================================================
//  DJIGUI — connexion unique à la base.
//  Un seul pool partagé par toute l'application. Les identifiants
//  viennent des variables d'environnement (règle C7).
//
//  Ce fichier traduit aussi les pannes de base en français clair :
//  la dernière fois, un « service injoignable » sans explication a
//  coûté une heure de recherche.
//
//  LOT 2 (migration Supabase) : pilote mysql2 → pg. Le pool ci-dessous
//  parle PostgreSQL. L'interface exportée ({ pool, diagnostiquer,
//  expliquerPanne }) ne change pas, pour ne pas casser les fichiers qui
//  l'importent par déstructuration.
//  LOT 3 : diagnostiquer() converti au pilote pg (aucune transaction ici,
//  de simples lectures : pool.query() suffit, pas besoin de sortir un
//  client dédié).
// =====================================================================
const { Pool, types } = require('pg');

// Contrat de l'API préservé : la migration ne doit rien changer aux
// réponses JSON. Par défaut, le pilote pg convertit DATE/TIMESTAMP/
// TIMESTAMPTZ en objets Date JS (Express les sérialise alors en ISO
// 8601), alors que l'ancien pool mysql2 était configuré dateStrings:true
// et renvoyait des chaînes. On force ces trois types à rester des
// chaînes brutes, telles que Postgres les renvoie sur le fil — le plus
// proche du comportement d'avant.
types.setTypeParser(1114, (v) => v); // timestamp sans fuseau
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1184, (v) => v); // timestamptz

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // requis par Supabase
});

// Traduit une panne de base en phrase compréhensible et en remède.
// Deux familles de codes, jamais mélangées :
//  - réseau (Node) : chaîne libre comme 'ECONNREFUSED', posée par la
//    couche TCP avant même que Postgres réponde. Toujours valables avec
//    Supabase : la base est distante, ces pannes sont même plus
//    probables qu'avec MariaDB en local sous XAMPP.
//  - PostgreSQL (SQLSTATE) : code à cinq caractères, propre au serveur
//    Postgres. Remplace les anciens codes MySQL (ER_...).
function expliquerPanne(erreur) {
  const code = erreur && erreur.code;

  const reseau = {
    ECONNREFUSED:
      'Supabase ne répond pas à cette adresse. Vérifiez DATABASE_URL dans le fichier .env, et que le projet Supabase est actif.',
    ENOTFOUND:
      'Adresse de base introuvable. Vérifiez l’hôte dans DATABASE_URL, dans le fichier .env.',
    ETIMEDOUT:
      'La base ne répond pas dans le temps imparti. Vérifiez votre connexion réseau et l’adresse DATABASE_URL.'
  };
  if (code && reseau[code]) return reseau[code];

  const postgres = {
    '28P01':
      'Identifiants de base refusés. Vérifiez le mot de passe dans DATABASE_URL, dans le fichier .env.',
    '28000':
      'Accès à la base refusé. Vérifiez l’utilisateur et le mot de passe dans DATABASE_URL.',
    '3D000':
      'Cette base n’existe pas sur le projet Supabase visé. Vérifiez le nom de la base dans DATABASE_URL.',
    '08006':
      'La connexion à Supabase a été coupée en cours de route. Réessayez ; si ça persiste, vérifiez l’état du projet Supabase.',
    '08001':
      'Impossible d’établir la connexion à Supabase. Vérifiez DATABASE_URL et votre connexion réseau.',
    '23505':
      'Cette valeur existe déjà : une contrainte d’unicité a refusé un doublon.'
  };
  if (code && postgres[code]) return postgres[code];

  return `Erreur de base : ${erreur && erreur.message}`;
}

// Vérifie la connexion et l'état des tables. Sert au démarrage et à
// la route /api/sante.
// PostgreSQL n'a pas de notion de « base courante » comme table_schema :
// nos tables vivent dans le schéma public de la base pointée par
// DATABASE_URL. DB_NOM (variable MySQL, retirée au lot 2) est remplacé
// par le nom de schéma fixe 'public'. COUNT(*) revient en bigint côté
// Postgres, donc en chaîne côté pg — Number(...) partout pour garder des
// entiers JS, comme le reste du projet.
async function diagnostiquer() {
  const tables = await pool.query(
    `SELECT COUNT(*) AS nb FROM information_schema.tables
      WHERE table_schema = 'public'`);
  const zones = await pool.query('SELECT COUNT(*) AS nb FROM zone');
  const structures = await pool.query('SELECT COUNT(*) AS nb FROM structure_sang');
  const comptes = await pool.query(
    `SELECT role, COUNT(*) AS nb FROM utilisateur
      WHERE statut = 'actif' GROUP BY role`);
  const parametres = await pool.query('SELECT COUNT(*) AS nb FROM parametre');
  const repartition = { donneur: 0, gestionnaire: 0, admin: 0 };
  for (const ligne of comptes.rows) repartition[ligne.role] = Number(ligne.nb);
  return {
    base_connectee: true,
    nb_tables: Number(tables.rows[0].nb),
    nb_parametres: Number(parametres.rows[0].nb),
    nb_zones: Number(zones.rows[0].nb),
    nb_structures: Number(structures.rows[0].nb),
    comptes_actifs: repartition
  };
}

// Test de connexion isolé pour ce lot : une seule requête, sans toucher
// à une table métier. Sert à valider DATABASE_URL avant de convertir
// quoi que ce soit d'autre.
async function verifierConnexion() {
  try {
    const resultat = await pool.query('SELECT NOW()');
    console.log(`[db] Connexion Supabase OK — heure du serveur : ${resultat.rows[0].now}`);
    return { ok: true, heure_serveur: resultat.rows[0].now };
  } catch (erreur) {
    console.error(`[db] Connexion Supabase en échec — ${expliquerPanne(erreur)}`);
    return { ok: false, erreur: expliquerPanne(erreur) };
  }
}

module.exports = { pool, diagnostiquer, expliquerPanne, verifierConnexion };
