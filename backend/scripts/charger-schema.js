// =====================================================================
//  DJIGUI — chargement du schéma PostgreSQL dans Supabase (lot 2,
//  plomberie de migration). Ne recopie aucun SQL en dur : lit chaque
//  fichier de backend/sql/ et l'exécute tel quel, en une seule requête
//  (pas de découpage sur « ; » — pool.query() de pg accepte un script
//  à plusieurs instructions en un seul appel).
//
//  Ordre de chargement : le schéma, puis les paramètres, puis les
//  correctifs. Aucun seed de zones : le projet n'en a pas (contrainte
//  C3, cahier des charges — les zones se créent par l'écran E29,
//  jamais par un fichier de remplissage).
//
//  Lancer : node scripts/charger-schema.js
// =====================================================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool, expliquerPanne } = require('../src/db');

const DOSSIER_SQL = path.join(__dirname, '..', 'sql');

const FICHIERS = [
  '01-creation.postgresql.sql',
  '02-parametres.postgresql.sql',
  '03-correctifs.postgresql.sql'
];

async function principal() {
  console.log('\n  DJIGUI — chargement du schéma PostgreSQL dans Supabase\n');

  if (!process.env.DATABASE_URL) {
    console.error('  DATABASE_URL est absent du fichier .env.\n');
    process.exit(1);
  }

  let echec = false;
  for (const nomFichier of FICHIERS) {
    const chemin = path.join(DOSSIER_SQL, nomFichier);
    const contenu = fs.readFileSync(chemin, 'utf8');
    try {
      await pool.query(contenu);
      console.log(`  [ok] ${nomFichier}`);
    } catch (erreur) {
      echec = true;
      console.error(`  [échec] ${nomFichier} — ${expliquerPanne(erreur)}`);
      console.error(`          détail : ${erreur.message}`);
      break; // un fichier en échec laisse la base dans un état partiel : inutile de continuer aveuglément.
    }
  }

  await pool.end();
  process.exit(echec ? 1 : 0);
}

principal();
