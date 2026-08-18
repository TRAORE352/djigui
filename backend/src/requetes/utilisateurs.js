// DJIGUI — table utilisateur (T1). Tout le SQL est écrit à la main,
// avec des paramètres liés (règles C1, C2).
const { pool } = require('../db');

async function trouverParIdentifiant(identifiant) {
  const resultat = await pool.query(
    `SELECT u.*, s.nom AS structure_nom, s.ville AS structure_ville
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.identifiant = $1`, [identifiant]);
  return resultat.rows[0] || null;
}

async function trouverParId(id) {
  const resultat = await pool.query(
    `SELECT u.*, s.nom AS structure_nom, s.ville AS structure_ville
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.id_utilisateur = $1`, [id]);
  return resultat.rows[0] || null;
}

// Règle RG35 : cinq échecs consécutifs verrouillent le compte.
// IF(cond, a, b) → CASE WHEN cond THEN a ELSE b END.
// DATE_ADD(NOW(), INTERVAL ? MINUTE) avec un paramètre lié dans
// l'INTERVAL n'a pas d'équivalent direct en PostgreSQL → make_interval().
async function enregistrerEchec(id, echecsAvantVerrou, dureeVerrouMinutes) {
  await pool.query(
    `UPDATE utilisateur
        SET nb_echecs_connexion = nb_echecs_connexion + 1,
            verrouille_jusqu_a = CASE WHEN nb_echecs_connexion + 1 >= $1
              THEN NOW() + make_interval(mins => $2)
              ELSE verrouille_jusqu_a END
      WHERE id_utilisateur = $3`,
    [echecsAvantVerrou, dureeVerrouMinutes, id]);
}

async function enregistrerReussite(id) {
  await pool.query(
    `UPDATE utilisateur
        SET nb_echecs_connexion = 0, verrouille_jusqu_a = NULL,
            derniere_connexion = NOW()
      WHERE id_utilisateur = $1`, [id]);
}

// Règle RG31 : le nouveau condensat invalide toutes les sessions,
// puisque le jeton porte un fragment de ce condensat.
async function changerMotDePasse(id, condensat) {
  await pool.query(
    `UPDATE utilisateur
        SET mot_de_passe = $1, doit_changer_mot_de_passe = FALSE,
            provisoire_expire_le = NULL, nb_echecs_connexion = 0,
            verrouille_jusqu_a = NULL
      WHERE id_utilisateur = $2`, [condensat, id]);
}

// Liste de l'écran E28, avec le nombre de jours sans connexion.
// DATEDIFF(NOW(), x) (MySQL, ne compte que la partie date) →
// CURRENT_DATE - x::date (PostgreSQL : une soustraction de deux DATE
// rend directement un entier de jours, même résultat, NULL si x est NULL).
// FIELD(colonne, 'a','b','c') → CASE colonne WHEN 'a' THEN 1 ... END.
async function listerComptesProfessionnels() {
  const resultat = await pool.query(
    `SELECT u.id_utilisateur, u.identifiant, u.nom, u.prenom, u.fonction,
            u.role, u.statut, u.derniere_connexion, u.date_creation,
            u.doit_changer_mot_de_passe, u.provisoire_expire_le,
            s.nom AS structure_nom,
            (CURRENT_DATE - u.derniere_connexion::date) AS jours_sans_connexion
       FROM utilisateur u
       LEFT JOIN structure_sang s ON s.id_structure = u.id_structure
      WHERE u.role IN ('gestionnaire','admin')
      ORDER BY CASE u.statut
                 WHEN 'actif' THEN 1 WHEN 'suspendu' THEN 2 WHEN 'desactive' THEN 3 ELSE 4
               END, u.nom, u.prenom`);
  return resultat.rows;
}

// Requête C.6 : refus de désactivation du dernier administrateur (RG45).
async function compterAdministrateursActifsSauf(id) {
  const resultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM utilisateur
      WHERE role = 'admin' AND statut = 'actif' AND id_utilisateur <> $1`, [id]);
  return Number(resultat.rows[0].nb);
}

async function changerStatut(id, statut) {
  await pool.query('UPDATE utilisateur SET statut = $1 WHERE id_utilisateur = $2', [statut, id]);
}

// Pose un mot de passe provisoire, valable un nombre d'heures donné.
async function poserProvisoire(id, condensat, heuresValidite) {
  await pool.query(
    `UPDATE utilisateur
        SET mot_de_passe = $1, doit_changer_mot_de_passe = TRUE,
            provisoire_expire_le = NOW() + make_interval(hours => $2),
            provisoire_deja_affiche = FALSE, nb_echecs_connexion = 0,
            verrouille_jusqu_a = NULL
      WHERE id_utilisateur = $3`, [condensat, heuresValidite, id]);
}

async function marquerProvisoireAffiche(id) {
  await pool.query(
    'UPDATE utilisateur SET provisoire_deja_affiche = TRUE WHERE id_utilisateur = $1', [id]);
}

module.exports = {
  trouverParIdentifiant, trouverParId, enregistrerEchec, enregistrerReussite,
  changerMotDePasse, listerComptesProfessionnels, compterAdministrateursActifsSauf,
  changerStatut, poserProvisoire, marquerProvisoireAffiche
};
