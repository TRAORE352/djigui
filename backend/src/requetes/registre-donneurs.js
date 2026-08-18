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

// Empile une valeur et renvoie son marqueur $n, dans l'ordre. Nécessaire
// partout ici : PostgreSQL numérote ses placeholders par position dans
// le texte final, contrairement au `?` MySQL qui ne dépend que de
// l'ordre d'apparition — un fragment réutilisable comme exprEligible()
// ne peut pas porter de $n figés en dur, il doit les calculer à chaque
// insertion.
function ajouter(valeurs, valeur) {
  valeurs.push(valeur);
  return `$${valeurs.length}`;
}

// Un donneur peut donner aujourd'hui si son compte est actif, son âge et
// son poids sont dans les bornes, son délai depuis le dernier don est
// passé, et il n'a pas atteint son quota annuel (RG5, RG9). Fragment
// unique, réutilisé partout où l'éligibilité est calculée en SQL, pour
// qu'elle reste identique dans la liste, le résumé et les filtres.
//
// TIMESTAMPDIFF(YEAR, naissance, CURDATE()) → EXTRACT(YEAR FROM
// AGE(CURRENT_DATE, naissance)) : même sémantique (années complètes
// révolues), validée chiffrée sur le jour d'anniversaire pile avant
// cette conversion (voir le rapport de test du lot 6).
// IF(cond, a, b) → CASE WHEN cond THEN a ELSE b END.
// DATE_SUB(CURDATE(), INTERVAL 1 YEAR) → CURRENT_DATE - INTERVAL '1 year'.
//
// Fonction plutôt que constante (voir ajouter ci-dessus) : empile ses
// cinq valeurs (age_min, age_max, poids_min, max_dons_homme_an,
// max_dons_femme_an) sur le tableau partagé au moment de l'appel, et
// renvoie le texte avec les $n corrects pour CET appel précis.
function exprEligible(valeurs, parametres) {
  const mAgeMin = ajouter(valeurs, parametres.age_min);
  const mAgeMax = ajouter(valeurs, parametres.age_max);
  const mPoidsMin = ajouter(valeurs, parametres.poids_min);
  const mMaxHomme = ajouter(valeurs, parametres.max_dons_homme_an);
  const mMaxFemme = ajouter(valeurs, parametres.max_dons_femme_an);
  return `(
    d.statut = 'actif'
    AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, d.date_naissance)) BETWEEN ${mAgeMin} AND ${mAgeMax}
    AND d.poids_declare >= ${mPoidsMin}
    AND (d.date_prochaine_eligibilite IS NULL OR d.date_prochaine_eligibilite <= CURRENT_DATE)
    AND (
      SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur
        AND don.date_don > CURRENT_DATE - INTERVAL '1 year'
    ) < CASE WHEN d.sexe = 'M' THEN ${mMaxHomme}::integer ELSE ${mMaxFemme}::integer END
  )`;
}

// Construit les conditions cumulables communes à chercherDonneurs et
// resumerListe. `valeurs` est fourni par l'appelant et empilé au fil des
// filtres réellement posés — c'est lui qui porte la numérotation $n
// cohérente pour LA requête en cours (une nouvelle requête = un nouveau
// tableau, jamais partagé entre deux appels pool.query distincts).
function construireFiltres(filtres, parametres, valeurs) {
  const conditions = ["d.statut = 'actif'"];

  const texte = String(filtres.texte || '').trim();
  if (texte) {
    const motif = `%${texte}%`;
    const m1 = ajouter(valeurs, motif);
    const m2 = ajouter(valeurs, motif);
    const m3 = ajouter(valeurs, motif);
    conditions.push(`(
      CONCAT(d.prenom, ' ', d.nom) LIKE ${m1}
      OR CONCAT(d.nom, ' ', d.prenom) LIKE ${m2}
      OR EXISTS (SELECT 1 FROM telephone_donneur t WHERE t.id_donneur = d.id_donneur AND t.numero LIKE ${m3})
    )`);
  }

  if (Array.isArray(filtres.groupes) && filtres.groupes.length > 0) {
    const marqueurs = filtres.groupes.map((groupe) => ajouter(valeurs, groupe));
    conditions.push(`d.groupe_sanguin IN (${marqueurs.join(',')})`);
  }

  if (Array.isArray(filtres.zones) && filtres.zones.length > 0) {
    const marqueurs = filtres.zones.map((zone) => ajouter(valeurs, zone));
    conditions.push(`d.id_zone IN (${marqueurs.join(',')})`);
  }

  if (filtres.eligibilite === 'aujourd_hui') {
    conditions.push(exprEligible(valeurs, parametres));
  }

  if (filtres.joignabilite === 'confirme') {
    conditions.push("p.statut_joignabilite = 'confirme'");
  } else if (filtres.joignabilite === 'a_verifier') {
    conditions.push("(p.statut_joignabilite IS NULL OR p.statut_joignabilite IN ('non_verifie', 'injoignable'))");
  }

  if (filtres.sans_don_depuis_un_an) {
    conditions.push("(d.date_dernier_don IS NULL OR d.date_dernier_don <= CURRENT_DATE - INTERVAL '1 year')");
  }

  return conditions.join(' AND ');
}

const DEPUIS = `
  FROM donneur d
  JOIN zone z ON z.id_zone = d.id_zone
  LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1`;

// La requête centrale de l'écran E24 : liste paginée, avec l'éligibilité
// calculée en base pour rester filtrable et triable.
async function chercherDonneurs(idStructure, filtres = {}) {
  const parametres = await lireParametres();
  const limite = Math.min(Number(filtres.limite) || 20, 100);
  const depart = Math.max(Number(filtres.depart) || 0, 0);

  const valeurs = [];
  const exprSelect = exprEligible(valeurs, parametres);
  const ou = construireFiltres(filtres, parametres, valeurs);
  const mLimite = ajouter(valeurs, limite);
  const mDepart = ajouter(valeurs, depart);

  const resultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.groupe_sanguin, d.sexe, d.date_naissance,
            d.repere_position, z.nom AS zone_nom, z.ville AS zone_ville,
            p.numero AS numero_principal, p.statut_joignabilite, p.date_dernier_controle,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            (SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur) AS nb_dons_total,
            ${exprSelect} AS eligible_aujourdhui
       ${DEPUIS}
      WHERE ${ou}
      ORDER BY d.nom, d.prenom
      LIMIT ${mLimite} OFFSET ${mDepart}`,
    valeurs);

  // Requête séparée = numérotation $n séparée : on refait construireFiltres
  // avec un tableau neuf, jamais celui de la requête ci-dessus.
  const valeursTotal = [];
  const ouTotal = construireFiltres(filtres, parametres, valeursTotal);
  const total = await pool.query(`SELECT COUNT(*) AS nb ${DEPUIS} WHERE ${ouTotal}`, valeursTotal);

  return {
    lignes: resultat.rows.map((ligne) => ({
      ...ligne,
      nb_dons_total: Number(ligne.nb_dons_total),
      eligible_aujourdhui: Boolean(ligne.eligible_aujourdhui)
    })),
    total: Number(total.rows[0].nb), limite, depart
  };
}

// Mêmes filtres que chercherDonneurs, mais quatre nombres au lieu d'une
// liste : le vivier réel de l'appel que l'agent prépare, jamais le
// registre entier.
// SUM(condition) (MySQL : une comparaison vaut 0/1, sommable) → en
// PostgreSQL une comparaison est un booléen, pas sommable directement →
// SUM(CASE WHEN condition THEN 1 ELSE 0 END).
async function resumerListe(idStructure, filtres = {}) {
  const parametres = await lireParametres();
  const valeurs = [];
  const exprSelect = exprEligible(valeurs, parametres);
  const ou = construireFiltres(filtres, parametres, valeurs);

  const resultat = await pool.query(
    `SELECT
        SUM(CASE WHEN ${exprSelect} THEN 1 ELSE 0 END) AS peuvent_donner_aujourdhui,
        SUM(CASE WHEN p.statut_joignabilite = 'confirme' THEN 1 ELSE 0 END) AS numeros_confirmes,
        SUM(CASE WHEN p.statut_joignabilite IS NULL
                   OR p.statut_joignabilite IN ('non_verifie', 'injoignable') THEN 1 ELSE 0 END) AS numeros_a_verifier,
        SUM(CASE WHEN d.date_dernier_don IS NULL
                   OR d.date_dernier_don <= CURRENT_DATE - INTERVAL '1 year' THEN 1 ELSE 0 END) AS sans_don_depuis_un_an
       ${DEPUIS}
      WHERE ${ou}`,
    valeurs);

  const ligne = resultat.rows[0];
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
  const resultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.sexe, d.date_naissance, d.groupe_sanguin,
            d.poids_declare, d.repere_position, d.statut,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            z.nom AS zone_nom, z.ville AS zone_ville
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
      WHERE d.id_donneur = $1`, [idDonneur]);
  const donneur = resultat.rows[0];
  if (!donneur) return null;

  const telephonesResultat = await pool.query(
    `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
       FROM telephone_donneur
      WHERE id_donneur = $1
      ORDER BY rang`, [idDonneur]);

  const donsResultat = await pool.query(
    `SELECT dn.id_don, dn.date_don, s.nom AS structure_nom, s.ville AS structure_ville, po.code_poche
       FROM don dn
       JOIN structure_sang s ON s.id_structure = dn.id_structure
       LEFT JOIN poche po ON po.id_don = dn.id_don
      WHERE dn.id_donneur = $1
      ORDER BY dn.date_don DESC, dn.id_don DESC`, [idDonneur]);

  return { ...donneur, telephones: telephonesResultat.rows, dons: donsResultat.rows };
}

module.exports = {
  chercherDonneurs, resumerListe, ficheDonneur,
  // Exportés pour E18 (requetes/alertes.js) : le moteur de ciblage est
  // le même, il ne se récrit pas. ajouter et exprEligible remplacent
  // valeursEligible/EXPR_ELIGIBLE (constantes, incompatibles avec la
  // numérotation $n de PostgreSQL — voir plus haut).
  construireFiltres, exprEligible, ajouter, DEPUIS
};
