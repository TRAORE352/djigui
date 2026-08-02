// DJIGUI — table donneur (T2) et ses liens.
const { pool } = require('../db');

const CHAMPS_PROFIL = `
  d.id_donneur, d.id_utilisateur, d.nom, d.prenom, d.sexe, d.date_naissance,
  d.groupe_sanguin, d.poids_declare, d.id_zone, d.repere_position,
  d.question_securite, d.accepte_sms, d.accepte_messagerie,
  d.date_dernier_don, d.date_prochaine_eligibilite, d.statut, d.date_creation,
  z.nom AS zone_nom, z.ville AS zone_ville`;

async function trouverParIdUtilisateur(idUtilisateur) {
  const [lignes] = await pool.query(
    `SELECT ${CHAMPS_PROFIL}
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_utilisateur = ?`, [idUtilisateur]);
  return lignes[0] || null;
}

async function trouverParId(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT ${CHAMPS_PROFIL}
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_donneur = ?`, [idDonneur]);
  return lignes[0] || null;
}

// Récupération de compte : le double contrôle de la règle RG29.
async function trouverPourRecuperation(numero, dateNaissance) {
  const [lignes] = await pool.query(
    `SELECT d.id_donneur, d.id_utilisateur, d.question_securite, d.reponse_securite
       FROM donneur d
       JOIN utilisateur u ON u.id_utilisateur = d.id_utilisateur
      WHERE u.identifiant = ? AND d.date_naissance = ? AND u.role = 'donneur'`,
    [numero, dateNaissance]);
  return lignes[0] || null;
}

// Règle RG4 : dons sur les douze derniers mois.
async function compterDonsDouzeMois(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_donneur = ? AND date_don > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`,
    [idDonneur]);
  return lignes[0].nb;
}

// Compteur et première date, pour l'en-tête de l'écran E9.
async function resumeDons(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT COUNT(*) AS nb, MIN(date_don) AS premier_don FROM don WHERE id_donneur = ?`,
    [idDonneur]);
  return lignes[0];
}

// Historique complet, écran E9 : date, structure, référence.
async function listerDons(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT dn.id_don, dn.date_don, s.nom AS structure_nom, p.code_poche
       FROM don dn
       JOIN structure_sang s ON s.id_structure = dn.id_structure
       LEFT JOIN poche p ON p.id_don = dn.id_don
      WHERE dn.id_donneur = ?
      ORDER BY dn.date_don DESC, dn.id_don DESC`, [idDonneur]);
  return lignes;
}

async function mettreAJourProfil(idDonneur, donnees) {
  await pool.query(
    `UPDATE donneur
        SET poids_declare = ?, id_zone = ?, repere_position = ?,
            accepte_sms = ?, accepte_messagerie = ?
      WHERE id_donneur = ?`,
    [donnees.poids_declare, donnees.id_zone, donnees.repere_position || null,
     donnees.accepte_sms ? 1 : 0, donnees.accepte_messagerie ? 1 : 0, idDonneur]);
}

async function changerQuestionSecurite(idDonneur, question, condensatReponse) {
  await pool.query(
    'UPDATE donneur SET question_securite = ?, reponse_securite = ? WHERE id_donneur = ?',
    [question, condensatReponse, idDonneur]);
}

// Règle RG14 : la désactivation touche le donneur et son compte, en
// une seule transaction.
async function desactiverCompte(idDonneur, idUtilisateur) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    await connexion.query(
      "UPDATE donneur SET statut = 'desactive' WHERE id_donneur = ?", [idDonneur]);
    await connexion.query(
      "UPDATE utilisateur SET statut = 'desactive' WHERE id_utilisateur = ?", [idUtilisateur]);
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = {
  trouverParIdUtilisateur, trouverParId, trouverPourRecuperation,
  compterDonsDouzeMois, resumeDons, listerDons,
  mettreAJourProfil, changerQuestionSecurite, desactiverCompte
};
