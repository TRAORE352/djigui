// =====================================================================
//  DJIGUI — registre des donneurs (T2), écran E24.
//  C'est aussi le moteur de ciblage que E18 réutilisera pour compter et
//  choisir les destinataires d'un appel : chercherDonneurs et
//  resumerListe partagent la même construction de filtres, pour que le
//  résumé porte toujours exactement sur la liste affichée.
//
//  Un donneur n'appartient à aucune structure (règle RG41 : la portée
//  par structure s'applique aux dons et aux poches, pas aux donneurs).
//  Un gestionnaire voit tout le bassin de donneurs, quelle que soit sa
//  structure ; `idStructure` est repris dans les signatures pour que
//  E18 puisse un jour l'utiliser sans les changer, mais ne filtre rien
//  ici.
// =====================================================================
const { pool } = require('../db');
const { lireParametres } = require('./parametres');

// Un donneur peut donner aujourd'hui si son compte est actif, son âge et
// son poids sont dans les bornes, son délai depuis le dernier don est
// passé, et il n'a pas atteint son quota annuel (RG5, RG9). Fragment
// unique, réutilisé partout où l'éligibilité est calculée en SQL, pour
// qu'elle reste identique dans la liste, le résumé et les filtres.
const EXPR_ELIGIBLE = `(
  d.statut = 'actif'
  AND TIMESTAMPDIFF(YEAR, d.date_naissance, CURDATE()) BETWEEN ? AND ?
  AND d.poids_declare >= ?
  AND (d.date_prochaine_eligibilite IS NULL OR d.date_prochaine_eligibilite <= CURDATE())
  AND (
    SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur
      AND don.date_don > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
  ) < IF(d.sexe = 'M', ?, ?)
)`;

function valeursEligible(parametres) {
  return [
    parametres.age_min, parametres.age_max, parametres.poids_min,
    parametres.max_dons_homme_an, parametres.max_dons_femme_an
  ];
}

// Construit les conditions cumulables communes à chercherDonneurs et
// resumerListe. Les tableaux `conditions` et `valeurs` avancent
// ensemble : l'ordre des paramètres liés suit exactement l'ordre du SQL
// produit.
function construireFiltres(filtres, parametres) {
  const conditions = ["d.statut = 'actif'"];
  const valeurs = [];

  const texte = String(filtres.texte || '').trim();
  if (texte) {
    const motif = `%${texte}%`;
    conditions.push(`(
      CONCAT(d.prenom, ' ', d.nom) LIKE ?
      OR CONCAT(d.nom, ' ', d.prenom) LIKE ?
      OR EXISTS (SELECT 1 FROM telephone_donneur t WHERE t.id_donneur = d.id_donneur AND t.numero LIKE ?)
    )`);
    valeurs.push(motif, motif, motif);
  }

  if (Array.isArray(filtres.groupes) && filtres.groupes.length > 0) {
    conditions.push(`d.groupe_sanguin IN (${filtres.groupes.map(() => '?').join(',')})`);
    valeurs.push(...filtres.groupes);
  }

  if (Array.isArray(filtres.zones) && filtres.zones.length > 0) {
    conditions.push(`d.id_zone IN (${filtres.zones.map(() => '?').join(',')})`);
    valeurs.push(...filtres.zones);
  }

  if (filtres.eligibilite === 'aujourd_hui') {
    conditions.push(EXPR_ELIGIBLE);
    valeurs.push(...valeursEligible(parametres));
  }

  if (filtres.joignabilite === 'confirme') {
    conditions.push("p.statut_joignabilite = 'confirme'");
  } else if (filtres.joignabilite === 'a_verifier') {
    conditions.push("(p.statut_joignabilite IS NULL OR p.statut_joignabilite IN ('non_verifie', 'injoignable'))");
  }

  if (filtres.sans_don_depuis_un_an) {
    conditions.push('(d.date_dernier_don IS NULL OR d.date_dernier_don <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR))');
  }

  return { ou: conditions.join(' AND '), valeurs };
}

const DEPUIS = `
  FROM donneur d
  JOIN zone z ON z.id_zone = d.id_zone
  LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1`;

// La requête centrale de l'écran E24 : liste paginée, avec l'éligibilité
// calculée en base pour rester filtrable et triable.
async function chercherDonneurs(idStructure, filtres = {}) {
  const parametres = await lireParametres();
  const { ou, valeurs } = construireFiltres(filtres, parametres);
  const limite = Math.min(Number(filtres.limite) || 20, 100);
  const depart = Math.max(Number(filtres.depart) || 0, 0);

  const [lignes] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.groupe_sanguin, d.sexe, d.date_naissance,
            d.repere_position, z.nom AS zone_nom, z.ville AS zone_ville,
            p.numero AS numero_principal, p.statut_joignabilite, p.date_dernier_controle,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            (SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur) AS nb_dons_total,
            ${EXPR_ELIGIBLE} AS eligible_aujourdhui
       ${DEPUIS}
      WHERE ${ou}
      ORDER BY d.nom, d.prenom
      LIMIT ? OFFSET ?`,
    [...valeursEligible(parametres), ...valeurs, limite, depart]);

  const [total] = await pool.query(
    `SELECT COUNT(*) AS nb ${DEPUIS} WHERE ${ou}`, valeurs);

  return {
    lignes: lignes.map((ligne) => ({ ...ligne, eligible_aujourdhui: Boolean(ligne.eligible_aujourdhui) })),
    total: total[0].nb, limite, depart
  };
}

// Mêmes filtres que chercherDonneurs, mais quatre nombres au lieu d'une
// liste : le vivier réel de l'appel que l'agent prépare, jamais le
// registre entier.
async function resumerListe(idStructure, filtres = {}) {
  const parametres = await lireParametres();
  const { ou, valeurs } = construireFiltres(filtres, parametres);

  const [lignes] = await pool.query(
    `SELECT
        SUM(${EXPR_ELIGIBLE}) AS peuvent_donner_aujourdhui,
        SUM(p.statut_joignabilite = 'confirme') AS numeros_confirmes,
        SUM(p.statut_joignabilite IS NULL OR p.statut_joignabilite IN ('non_verifie', 'injoignable')) AS numeros_a_verifier,
        SUM(d.date_dernier_don IS NULL OR d.date_dernier_don <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)) AS sans_don_depuis_un_an
       ${DEPUIS}
      WHERE ${ou}`,
    [...valeursEligible(parametres), ...valeurs]);

  const ligne = lignes[0];
  return {
    peuvent_donner_aujourdhui: Number(ligne.peuvent_donner_aujourdhui) || 0,
    numeros_confirmes: Number(ligne.numeros_confirmes) || 0,
    numeros_a_verifier: Number(ligne.numeros_a_verifier) || 0,
    sans_don_depuis_un_an: Number(ligne.sans_don_depuis_un_an) || 0
  };
}

// Fiche complète d'un donneur : profil, numéros dans l'ordre d'appel, et
// l'historique de ses dons avec la structure de chacun (RG41 : c'est le
// don qui porte la structure, pas le donneur).
async function ficheDonneur(idDonneur, idStructure) {
  const [lignes] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.sexe, d.date_naissance, d.groupe_sanguin,
            d.poids_declare, d.repere_position, d.statut,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            z.nom AS zone_nom, z.ville AS zone_ville
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_donneur = ?`, [idDonneur]);
  const donneur = lignes[0];
  if (!donneur) return null;

  const [telephones] = await pool.query(
    `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
       FROM telephone_donneur
      WHERE id_donneur = ?
      ORDER BY rang`, [idDonneur]);

  const [dons] = await pool.query(
    `SELECT dn.id_don, dn.date_don, s.nom AS structure_nom, s.ville AS structure_ville, po.code_poche
       FROM don dn
       JOIN structure_sang s ON s.id_structure = dn.id_structure
       LEFT JOIN poche po ON po.id_don = dn.id_don
      WHERE dn.id_donneur = ?
      ORDER BY dn.date_don DESC, dn.id_don DESC`, [idDonneur]);

  return { ...donneur, telephones, dons };
}

module.exports = {
  chercherDonneurs, resumerListe, ficheDonneur,
  // Exportés pour E18 (requetes/alertes.js) : le moteur de ciblage est
  // le même, il ne se récrit pas.
  construireFiltres, valeursEligible, EXPR_ELIGIBLE, DEPUIS
};
