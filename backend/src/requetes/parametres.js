// DJIGUI — table parametre (T13). Cache d'une minute : ces valeurs sont
// lues à chaque calcul d'éligibilité, il serait absurde de les relire.
const { pool } = require('../db');

// Valeurs de secours si une clé manque en base. La base reste la référence.
const DEFAUTS = {
  age_min: 18, age_max: 60, poids_min: 50,
  delai_homme_mois: 3, delai_femme_mois: 4,
  max_dons_homme_an: 4, max_dons_femme_an: 3,
  duree_conservation_jours: 35, alerte_peremption_jours: 7,
  nb_telephones_max: 4, recup_tentatives_heure: 3,
  mdp_longueur_min: 10, mdp_donneur_longueur_min: 8,
  echecs_avant_verrou: 5, duree_verrou_minutes: 15,
  session_inactivite_minutes: 30, validite_provisoire_heures: 48
};

let cache = null;
let dateCache = 0;

async function lireParametres() {
  if (cache && Date.now() - dateCache < 60000) return cache;
  const resultat = await pool.query('SELECT cle, valeur FROM parametre');
  const valeurs = { ...DEFAUTS };
  for (const ligne of resultat.rows) valeurs[ligne.cle] = Number(ligne.valeur);
  cache = valeurs;
  dateCache = Date.now();
  return valeurs;
}

// Liste complète pour l'écran E30, avec libellés et conséquences.
// FIELD(colonne,'a','b','c') n'existe pas en PostgreSQL → CASE WHEN.
async function listerParametresDetailles() {
  const resultat = await pool.query(
    `SELECT p.cle, p.valeur, p.libelle, p.consequence, p.unite, p.categorie,
            p.date_modification, u.identifiant AS modifie_par
       FROM parametre p
       LEFT JOIN utilisateur u ON u.id_utilisateur = p.modifie_par
      ORDER BY CASE p.categorie
                 WHEN 'medical' THEN 1 WHEN 'conservation' THEN 2 WHEN 'securite' THEN 3 ELSE 4
               END, p.cle`);
  return resultat.rows;
}

async function modifierParametre(cle, valeur, idUtilisateur) {
  await pool.query(
    `UPDATE parametre SET valeur = $1, modifie_par = $2, date_modification = NOW()
      WHERE cle = $3`, [String(valeur), idUtilisateur, cle]);
  cache = null;
}

module.exports = { lireParametres, listerParametresDetailles, modifierParametre };
