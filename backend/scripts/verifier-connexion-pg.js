// =====================================================================
//  DJIGUI — test de connexion isolé au pool PostgreSQL (lot 2, migration
//  Supabase). N'exécute qu'un SELECT NOW() : aucune table métier, aucun
//  démarrage du serveur Express.
//  Lancer : node scripts/verifier-connexion-pg.js
// =====================================================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool, verifierConnexion } = require('../src/db');

async function principal() {
  console.log('\n  DJIGUI — test de connexion PostgreSQL (Supabase)\n');
  if (!process.env.DATABASE_URL) {
    console.error('  DATABASE_URL est absent du fichier .env. Copiez .env.example vers .env et remplissez-la.\n');
    process.exit(1);
  }
  const resultat = await verifierConnexion();
  await pool.end();
  process.exit(resultat.ok ? 0 : 1);
}

principal();
