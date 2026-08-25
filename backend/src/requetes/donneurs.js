// DJIGUI — table donneur (T2) et ses liens.
const { pool } = require('../db');

const CHAMPS_PROFIL = `
  d.id_donneur, d.id_utilisateur, d.nom, d.prenom, d.sexe, d.date_naissance,
  d.groupe_sanguin, d.poids_declare, d.id_zone, d.repere_position,
  d.question_securite, d.accepte_sms, d.accepte_messagerie,
  d.date_dernier_don, d.date_prochaine_eligibilite, d.statut, d.date_creation,
  z.nom AS zone_nom, z.ville AS zone_ville`;

async function trouverParIdUtilisateur(idUtilisateur) {
  const resultat = await pool.query(
    `SELECT ${CHAMPS_PROFIL}
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_utilisateur = $1`, [idUtilisateur]);
  return resultat.rows[0] || null;
}

async function trouverParId(idDonneur) {
  const resultat = await pool.query(
    `SELECT ${CHAMPS_PROFIL}
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_donneur = $1`, [idDonneur]);
  return resultat.rows[0] || null;
}

// Récupération de compte : le double contrôle de la règle RG29.
async function trouverPourRecuperation(numero, dateNaissance) {
  const resultat = await pool.query(
    `SELECT d.id_donneur, d.id_utilisateur, d.question_securite, d.reponse_securite
       FROM donneur d
       JOIN utilisateur u ON u.id_utilisateur = d.id_utilisateur
      WHERE u.identifiant = $1 AND d.date_naissance = $2 AND u.role = 'donneur'`,
    [numero, dateNaissance]);
  return resultat.rows[0] || null;
}

// Règle RG4 : dons sur les douze derniers mois.
// DATE_SUB(CURDATE(), INTERVAL 1 YEAR) — intervalle fixe, pas de
// paramètre lié dedans → CURRENT_DATE - INTERVAL '1 year'.
async function compterDonsDouzeMois(idDonneur) {
  const resultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_donneur = $1 AND date_don > CURRENT_DATE - INTERVAL '1 year'`,
    [idDonneur]);
  return Number(resultat.rows[0].nb);
}

// Compteur et première date, pour l'en-tête de l'écran E9.
async function resumeDons(idDonneur) {
  const resultat = await pool.query(
    `SELECT COUNT(*) AS nb, MIN(date_don) AS premier_don FROM don WHERE id_donneur = $1`,
    [idDonneur]);
  const ligne = resultat.rows[0];
  return { nb: Number(ligne.nb), premier_don: ligne.premier_don };
}

// Historique complet, écran E9 : date, structure, référence.
async function listerDons(idDonneur) {
  const resultat = await pool.query(
    `SELECT dn.id_don, dn.date_don, s.nom AS structure_nom, p.code_poche
       FROM don dn
       JOIN structure_sang s ON s.id_structure = dn.id_structure
       LEFT JOIN poche p ON p.id_don = dn.id_don
      WHERE dn.id_donneur = $1
      ORDER BY dn.date_don DESC, dn.id_don DESC`, [idDonneur]);
  return resultat.rows;
}

async function mettreAJourProfil(idDonneur, donnees) {
  await pool.query(
    `UPDATE donneur
        SET poids_declare = $1, id_zone = $2, repere_position = $3,
            accepte_sms = $4, accepte_messagerie = $5, groupe_sanguin = $6
      WHERE id_donneur = $7`,
    [donnees.poids_declare, donnees.id_zone, donnees.repere_position || null,
     Boolean(donnees.accepte_sms), Boolean(donnees.accepte_messagerie),
     donnees.groupe_sanguin, idDonneur]);
}

async function changerQuestionSecurite(idDonneur, question, condensatReponse) {
  await pool.query(
    'UPDATE donneur SET question_securite = $1, reponse_securite = $2 WHERE id_donneur = $3',
    [question, condensatReponse, idDonneur]);
}

// Règle RG14 : la désactivation touche le donneur et son compte, en
// une seule transaction. Client dédié : toutes les requêtes de la
// transaction passent par lui, jamais par pool directement.
async function desactiverCompte(idDonneur, idUtilisateur) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "UPDATE donneur SET statut = 'desactive' WHERE id_donneur = $1", [idDonneur]);
    await client.query(
      "UPDATE utilisateur SET statut = 'desactive' WHERE id_utilisateur = $1", [idUtilisateur]);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = {
  trouverParIdUtilisateur, trouverParId, trouverPourRecuperation,
  compterDonsDouzeMois, resumeDons, listerDons,
  mettreAJourProfil, changerQuestionSecurite, desactiverCompte
};
