// =====================================================================
//  DJIGUI — vérification de l'installation, avant de chercher ailleurs.
//  Lancer : npm run verifier
// =====================================================================
require('dotenv').config();
const { diagnostiquer, expliquerPanne } = require('../src/db');

const oui = '  [ok] ';
const non = '  [  ] ';

async function principal() {
  console.log('\n  DJIGUI — vérification de l\u2019installation\n');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
    console.log(`${non}JWT_SECRET absent ou trop court dans .env`);
  } else {
    console.log(`${oui}JWT_SECRET renseigné`);
  }

  let etat;
  try {
    etat = await diagnostiquer();
  } catch (erreur) {
    console.log(`${non}Base de données : ${expliquerPanne(erreur)}\n`);
    process.exit(1);
  }

  console.log(`${oui}Base connectée (${etat.nb_tables} tables)`);
  console.log(`${etat.nb_parametres > 0 ? oui : non}Réglages : ${etat.nb_parametres}`);
  console.log(`${etat.comptes_actifs.admin > 0 ? oui : non}Administrateurs : ${etat.comptes_actifs.admin}`);
  console.log(`${etat.nb_structures > 0 ? oui : non}Structures : ${etat.nb_structures}`);
  console.log(`${etat.nb_zones > 0 ? oui : non}Zones : ${etat.nb_zones}`);
  console.log(`  ..   Donneurs inscrits : ${etat.comptes_actifs.donneur}`);

  const aFaire = [];
  if (etat.nb_parametres === 0) aFaire.push('Importer sql/02-parametres.sql dans phpMyAdmin.');
  if (etat.comptes_actifs.admin === 0) aFaire.push('Lancer : npm run creer-admin');
  if (etat.nb_structures === 0) aFaire.push('Créer une structure depuis l\u2019espace d\u2019administration.');
  if (etat.nb_zones === 0) aFaire.push('Créer des zones depuis l\u2019espace d\u2019administration.');

  if (aFaire.length === 0) {
    console.log('\n  Tout est en place. Lancez : npm run dev\n');
  } else {
    console.log('\n  Il reste à faire :');
    for (const ligne of aFaire) console.log(`   - ${ligne}`);
    console.log('');
  }
  process.exit(0);
}

principal();
