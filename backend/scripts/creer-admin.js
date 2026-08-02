// =====================================================================
//  DJIGUI — création d'un compte administrateur, en ligne de commande.
//  La base ne contient aucun compte au départ (contrainte C3) : ce
//  script est la seule porte d'entrée du premier administrateur.
//  Le cahier des charges en prévoit deux (règle RG46) : lancez-le deux
//  fois, avec deux identifiants différents.
// =====================================================================
require('dotenv').config();
const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const { pool, expliquerPanne } = require('../src/db');
const { verifierMotDePassePro } = require('../src/regles/motdepasse');

async function principal() {
  const lecteur = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n  DJIGUI — création d\u2019un compte administrateur\n');

  const prenom = (await lecteur.question('  Prénom : ')).trim();
  const nom = (await lecteur.question('  Nom : ')).trim();
  const proposition = prenom && nom
    ? `${prenom[0].toLowerCase()}.${nom.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}`
    : '';
  const saisi = (await lecteur.question(
    `  Identifiant${proposition ? ` [${proposition}]` : ''} : `)).trim();
  const identifiant = (saisi || proposition).toLowerCase();
  const motDePasse = await lecteur.question('  Mot de passe (10 caractères, une majuscule, un chiffre) : ');
  lecteur.close();

  if (!prenom || !nom || !identifiant) {
    console.error('\n  Refusé : prénom, nom et identifiant sont nécessaires.\n');
    process.exit(1);
  }
  const manques = verifierMotDePassePro(motDePasse, 10, `${prenom}${nom}`, null);
  if (manques.length > 0) {
    console.error(`\n  Mot de passe refusé. Il manque : ${manques.join(' ')}\n`);
    process.exit(1);
  }

  try {
    const condensat = await bcrypt.hash(motDePasse, 10);
    const [resultat] = await pool.query(
      `INSERT INTO utilisateur (identifiant, mot_de_passe, role, nom, prenom,
                                fonction, doit_changer_mot_de_passe)
       VALUES (?, ?, 'admin', ?, ?, 'Administrateur du centre', 0)`,
      [identifiant, condensat, nom, prenom]);
    await pool.query(
      `INSERT INTO journal_activite (id_utilisateur, action, cible)
       VALUES (?, 'Création d\u2019un compte administrateur', ?)`,
      [resultat.insertId, identifiant]);

    const [total] = await pool.query(
      "SELECT COUNT(*) AS nb FROM utilisateur WHERE role = 'admin' AND statut = 'actif'");
    console.log(`\n  Compte créé. Identifiant : ${identifiant}`);
    if (total[0].nb < 2) {
      console.log('  Le cahier des charges en prévoit deux : relancez ce script pour le second.\n');
    } else {
      console.log('  Deux administrateurs sont en place, comme prévu.\n');
    }
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') {
      console.error('\n  Refusé : cet identifiant existe déjà.\n');
    } else {
      console.error(`\n  Échec : ${expliquerPanne(erreur)}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}

principal();
