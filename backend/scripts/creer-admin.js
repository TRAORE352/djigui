// =====================================================================
//  DJIGUI — création d'un compte administrateur, en ligne de commande.
//  La base ne contient aucun compte au départ (contrainte C3) : ce
//  script est la seule porte d'entrée du premier administrateur.
//  Le cahier des charges en prévoit deux (règle RG46) : lancez-le deux
//  fois, avec deux identifiants différents.
//
//  LOT 3 (migration Supabase) : converti au pilote pg. Pas de
//  transaction dans l'original (deux INSERT indépendants via pool.query,
//  jamais beginTransaction/commit) : aucune n'a été ajoutée ici, le
//  comportement reste identique — seuls ? → $n, insertId → RETURNING et
//  le code d'erreur de doublon changent.
//
//  DÉPLOIEMENT : creerAdmin() ci-dessous porte toute la logique métier
//  (validation, hachage, insertion, décompte des admins actifs) et est
//  exportée pour creer-admin-cli.js (non interactif, déploiement/CNTS) —
//  les requêtes ne s'écrivent qu'une fois, réutilisées par les deux
//  points d'entrée.
// =====================================================================
require('dotenv').config();
const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const { pool, expliquerPanne } = require('../src/db');
const { verifierMotDePassePro } = require('../src/regles/motdepasse');

// Erreur dédiée : la liste des exigences manquantes reste accessible en
// structure (erreur.manques), pour que chaque appelant l'affiche à sa
// façon plutôt que de parser un message.
class MotDePasseInvalide extends Error {
  constructor(manques) {
    super(`Mot de passe refusé. Il manque : ${manques.join(' ')}`);
    this.manques = manques;
  }
}

// Logique métier partagée. Lève MotDePasseInvalide si le mot de passe ne
// convient pas, une erreur pg (code 23505) si l'identifiant existe déjà.
async function creerAdmin({ identifiant, motDePasse, nom, prenom }) {
  const identifiantNormalise = String(identifiant || '').trim().toLowerCase();
  const nomNormalise = String(nom || '').trim();
  const prenomNormalise = String(prenom || '').trim();
  if (!nomNormalise || !prenomNormalise || !identifiantNormalise) {
    throw new Error('Prénom, nom et identifiant sont nécessaires.');
  }

  const manques = verifierMotDePassePro(
    motDePasse, 10, `${prenomNormalise}${nomNormalise}`, null);
  if (manques.length > 0) throw new MotDePasseInvalide(manques);

  const condensat = await bcrypt.hash(motDePasse, 10);
  const resultat = await pool.query(
    `INSERT INTO utilisateur (identifiant, mot_de_passe, role, nom, prenom,
                              fonction, doit_changer_mot_de_passe)
     VALUES ($1, $2, 'admin', $3, $4, 'Administrateur du centre', FALSE)
     RETURNING id_utilisateur`,
    [identifiantNormalise, condensat, nomNormalise, prenomNormalise]);
  const idUtilisateur = resultat.rows[0].id_utilisateur;

  await pool.query(
    `INSERT INTO journal_activite (id_utilisateur, action, cible)
     VALUES ($1, 'Création d’un compte administrateur', $2)`,
    [idUtilisateur, identifiantNormalise]);

  const total = await pool.query(
    "SELECT COUNT(*) AS nb FROM utilisateur WHERE role = 'admin' AND statut = 'actif'");

  return {
    idUtilisateur,
    identifiant: identifiantNormalise,
    totalAdminsActifs: Number(total.rows[0].nb)
  };
}

async function principal() {
  const lecteur = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n  DJIGUI — création d’un compte administrateur\n');

  const prenom = (await lecteur.question('  Prénom : ')).trim();
  const nom = (await lecteur.question('  Nom : ')).trim();
  const proposition = prenom && nom
    ? `${prenom[0].toLowerCase()}.${nom.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}`
    : '';
  const saisi = (await lecteur.question(
    `  Identifiant${proposition ? ` [${proposition}]` : ''} : `)).trim();
  const identifiant = saisi || proposition;
  const motDePasse = await lecteur.question('  Mot de passe (10 caractères, une majuscule, un chiffre) : ');
  lecteur.close();

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
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { creerAdmin, MotDePasseInvalide };

// N'exécute la démarche interactive que si ce fichier est lancé
// directement (node scripts/creer-admin.js) — pas quand il est require()
// par creer-admin-cli.js.
if (require.main === module) {
  principal();
}
