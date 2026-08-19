// =====================================================================
//  DJIGUI — création d'un compte administrateur, NON interactive.
//  Pour le déploiement et la passation (CNTS) : identifiants pris en
//  arguments de ligne de commande ou en variables d'environnement,
//  jamais lus au clavier. readline (creer-admin.js) échoue avec une
//  entrée non-TTY (bug d'environnement rencontré pendant la migration,
//  sans rapport avec la base — voir le rapport du lot 3) ; ce script
//  contourne le problème sans y toucher.
//
//  Réutilise creerAdmin() de creer-admin.js : mêmes requêtes, écrites
//  une seule fois, jamais dupliquées ici.
//
//  Usage (arguments) :
//    node scripts/creer-admin-cli.js --identifiant=a.traore --nom=Traore \
//      --prenom=Awa --mot-de-passe=UnMotDePasse10
//
//  Usage (variables d'environnement — pratique pour un secret manager,
//  aucun mot de passe dans l'historique du shell) :
//    ADMIN_IDENTIFIANT=a.traore ADMIN_NOM=Traore ADMIN_PRENOM=Awa \
//    ADMIN_MOT_DE_PASSE=UnMotDePasse10 node scripts/creer-admin-cli.js
//
//  Le mot de passe n'est jamais journalisé ni réaffiché : seuls
//  l'identifiant et le résultat (créé / refusé) sortent en console.
// =====================================================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool, expliquerPanne } = require('../src/db');
const { creerAdmin, MotDePasseInvalide } = require('./creer-admin');

function argument(nom) {
  const prefixe = `--${nom}=`;
  const trouve = process.argv.find((valeur) => valeur.startsWith(prefixe));
  return trouve ? trouve.slice(prefixe.length) : undefined;
}

async function principal() {
  const identifiant = argument('identifiant') || process.env.ADMIN_IDENTIFIANT;
  const motDePasse = argument('mot-de-passe') || process.env.ADMIN_MOT_DE_PASSE;
  const nom = argument('nom') || process.env.ADMIN_NOM;
  const prenom = argument('prenom') || process.env.ADMIN_PRENOM;

  if (!identifiant || !motDePasse || !nom || !prenom) {
    console.error(
      '\n  Usage :' +
      '\n    node scripts/creer-admin-cli.js --identifiant=... --nom=... --prenom=... --mot-de-passe=...' +
      '\n  ou via les variables ADMIN_IDENTIFIANT, ADMIN_NOM, ADMIN_PRENOM, ADMIN_MOT_DE_PASSE.\n');
    process.exitCode = 1;
    return;
  }

  try {
    const resultat = await creerAdmin({ identifiant, motDePasse, nom, prenom });
    console.log(`\n  Compte créé. Identifiant : ${resultat.identifiant}`);
    console.log(resultat.totalAdminsActifs < 2
      ? '  Le cahier des charges en prévoit deux : relancez ce script pour le second.\n'
      : '  Deux administrateurs sont en place, comme prévu.\n');
  } catch (erreur) {
    if (erreur instanceof MotDePasseInvalide) {
      console.error(`\n  ${erreur.message}\n`);
    } else if (erreur.code === '23505') {
      console.error('\n  Refusé : cet identifiant existe déjà.\n');
    } else if (erreur.message === 'Prénom, nom et identifiant sont nécessaires.') {
      console.error(`\n  Refusé : ${erreur.message}\n`);
    } else {
      console.error(`\n  Échec : ${expliquerPanne(erreur)}\n`);
    }
    process.exitCode = 1;
  }
}

principal().finally(() => pool.end());
