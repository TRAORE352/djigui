// DJIGUI — table utilisateur (T1). Tout le SQL est écrit à la main,
// avec des paramètres liés (règles C1, C2).
const { pool } = require('../db');

async function trouverParIdentifiant(identifiant) {
  const [lignes] = await pool.query(
    `SELECT u.*, s.nom AS structure_nom, s.ville AS structure_ville
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.identifiant = ?`, [identifiant]);
  return lignes[0] || null;
}

async function trouverParId(id) {
  const [lignes] = await pool.query(
    `SELECT u.*, s.nom AS structure_nom, s.ville AS structure_ville
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.id_utilisateur = ?`, [id]);
  return lignes[0] || null;
}

// Règle RG35 : cinq échecs consécutifs verrouillent le compte.
async function enregistrerEchec(id, echecsAvantVerrou, dureeVerrouMinutes) {
  await pool.query(
    `UPDATE utilisateur
        SET nb_echecs_connexion = nb_echecs_connexion + 1,
            verrouille_jusqu_a = IF(nb_echecs_connexion + 1 >= ?,
              DATE_ADD(NOW(), INTERVAL ? MINUTE), verrouille_jusqu_a)
      WHERE id_utilisateur = ?`,
    [echecsAvantVerrou, dureeVerrouMinutes, id]);
}

async function enregistrerReussite(id) {
  await pool.query(
    `UPDATE utilisateur
        SET nb_echecs_connexion = 0, verrouille_jusqu_a = NULL,
            derniere_connexion = NOW()
      WHERE id_utilisateur = ?`, [id]);
}

// Règle RG31 : le nouveau condensat invalide toutes les sessions,
// puisque le jeton porte un fragment de ce condensat.
async function changerMotDePasse(id, condensat) {
  await pool.query(
    `UPDATE utilisateur
        SET mot_de_passe = ?, doit_changer_mot_de_passe = 0,
            provisoire_expire_le = NULL, nb_echecs_connexion = 0,
            verrouille_jusqu_a = NULL
      WHERE id_utilisateur = ?`, [condensat, id]);
}

// Liste de l'écran E28, avec le nombre de jours sans connexion.
async function listerComptesProfessionnels() {
  const [lignes] = await pool.query(
    `SELECT u.id_utilisateur, u.identifiant, u.nom, u.prenom, u.fonction,
            u.role, u.statut, u.derniere_connexion, u.date_creation,
            u.doit_changer_mot_de_passe, u.provisoire_expire_le,
            s.nom AS structure_nom,
            DATEDIFF(NOW(), u.derniere_connexion) AS jours_sans_connexion
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.role IN ('gestionnaire','admin')
      ORDER BY FIELD(u.statut,'actif','suspendu','desactive'), u.nom, u.prenom`);
  return lignes;
}

// Requête C.6 : refus de désactivation du dernier administrateur (RG45).
async function compterAdministrateursActifsSauf(id) {
  const [lignes] = await pool.query(
    `SELECT COUNT(*) AS nb FROM utilisateur
      WHERE role = 'admin' AND statut = 'actif' AND id_utilisateur <> ?`, [id]);
  return lignes[0].nb;
}

async function changerStatut(id, statut) {
  await pool.query('UPDATE utilisateur SET statut = ? WHERE id_utilisateur = ?', [statut, id]);
}

// Pose un mot de passe provisoire, valable un nombre d'heures donné.
async function poserProvisoire(id, condensat, heuresValidite) {
  await pool.query(
    `UPDATE utilisateur
        SET mot_de_passe = ?, doit_changer_mot_de_passe = 1,
            provisoire_expire_le = DATE_ADD(NOW(), INTERVAL ? HOUR),
            provisoire_deja_affiche = 0, nb_echecs_connexion = 0,
            verrouille_jusqu_a = NULL
      WHERE id_utilisateur = ?`, [condensat, heuresValidite, id]);
}

async function marquerProvisoireAffiche(id) {
  await pool.query(
    'UPDATE utilisateur SET provisoire_deja_affiche = 1 WHERE id_utilisateur = ?', [id]);
}

module.exports = {
  trouverParIdentifiant, trouverParId, enregistrerEchec, enregistrerReussite,
  changerMotDePasse, listerComptesProfessionnels, compterAdministrateursActifsSauf,
  changerStatut, poserProvisoire, marquerProvisoireAffiche
};
