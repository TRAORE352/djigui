// =====================================================================
//  DJIGUI — statistiques du centre, écran E26.
//  Toutes structure-scopées (RG41 : dons, appels et poches appartiennent
//  à une structure, contrairement aux donneurs). Aucune requête ici ne
//  renvoie de nom de donneur : que des nombres.
// =====================================================================
const { pool } = require('../db');
const { ORDRE_AFFICHAGE } = require('../regles/compatibilite');

// Une colonne DATETIME comparée à une borne de fin sans heure exclurait
// le reste de la journée : on complète à 23h59m59 (même convention que
// le journal d'activité, écran E31).
function finJournee(fin) {
  return `${fin} 23:59:59`;
}

// Dons, appels lancés, nouvelles inscriptions et poches périmées sur la
// période. Les inscriptions ne sont d'aucune structure (RG41 ne
// s'applique qu'aux dons et aux poches) : ce nombre est le même quel
// que soit le poste qui consulte.
async function totauxPeriode(idStructure, debut, fin) {
  const donsResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_structure = $1 AND date_don BETWEEN $2 AND $3`,
    [idStructure, debut, fin]);

  const appelsResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM alerte
      WHERE id_structure = $1 AND date_envoi >= $2 AND date_envoi <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const inscriptionsResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM donneur
      WHERE date_creation >= $1 AND date_creation <= $2`,
    [debut, finJournee(fin)]);

  const echeanceResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM poche
      WHERE id_structure = $1 AND date_peremption BETWEEN $2 AND $3`,
    [idStructure, debut, fin]);
  const perimeesResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM poche
      WHERE id_structure = $1 AND statut = 'perimee' AND date_peremption BETWEEN $2 AND $3`,
    [idStructure, debut, fin]);

  const dons = Number(donsResultat.rows[0].nb);
  const appels = Number(appelsResultat.rows[0].nb);
  const inscriptions = Number(inscriptionsResultat.rows[0].nb);
  const echeance = Number(echeanceResultat.rows[0].nb);
  const perimees = Number(perimeesResultat.rows[0].nb);

  return {
    dons_enregistres: dons,
    appels_lances: appels,
    nouveaux_donneurs: inscriptions,
    poches_perimees: perimees,
    poches_perimees_proportion: echeance > 0 ? Math.round((perimees / echeance) * 100) : 0,
    poches_echeance: echeance
  };
}

// Les huit groupes, toujours dans l'ordre d'affichage du tableau de
// bord (E16), même à zéro.
async function donsParGroupe(idStructure, debut, fin) {
  const resultat = await pool.query(
    `SELECT po.groupe_sanguin, COUNT(*) AS nb
       FROM don dn
       JOIN poche po ON po.id_don = dn.id_don
      WHERE dn.id_structure = $1 AND dn.date_don BETWEEN $2 AND $3
      GROUP BY po.groupe_sanguin`,
    [idStructure, debut, fin]);
  const parGroupe = new Map(resultat.rows.map((ligne) => [ligne.groupe_sanguin, Number(ligne.nb)]));
  return ORDRE_AFFICHAGE.map((groupe) => ({ groupe_sanguin: groupe, nb_dons: parGroupe.get(groupe) || 0 }));
}

// Entonnoir d'un appel : envoyés, ont répondu, sont venus, et les dons
// qui ne viennent d'aucun appel, pour comparaison.
// r.presente = 1 (littéral, colonne BOOLEAN) → r.presente = TRUE :
// PostgreSQL refuse boolean = integer.
async function rendementAppels(idStructure, debut, fin) {
  const envoyesResultat = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
      WHERE a.id_structure = $1 AND ad.statut_envoi = 'envoye'
        AND a.date_envoi >= $2 AND a.date_envoi <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const renponduResultat = await pool.query(
    `SELECT COUNT(DISTINCT r.id_donneur) AS nb
       FROM reponse_alerte r
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = $1 AND r.date_reponse >= $2 AND r.date_reponse <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const venusResultat = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM reponse_alerte r
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = $1 AND r.presente = TRUE
        AND r.date_reponse >= $2 AND r.date_reponse <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const horsAppelResultat = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_structure = $1 AND date_don BETWEEN $2 AND $3 AND id_alerte IS NULL`,
    [idStructure, debut, fin]);

  const envoyes = Number(envoyesResultat.rows[0].nb);
  const repondu = Number(renponduResultat.rows[0].nb);
  const venus = Number(venusResultat.rows[0].nb);
  const horsAppel = Number(horsAppelResultat.rows[0].nb);

  return {
    messages_envoyes: envoyes,
    donneurs_ayant_repondu: repondu,
    donneurs_venus: venus,
    dons_hors_appel: horsAppel,
    taux_venue: envoyes > 0 ? Math.round((venus / envoyes) * 100) : 0
  };
}

// Aide au transport : ce qui n'a pas pu être fait compte autant que le
// reste (fiche_disponibilite, remplie par le donneur après sa réponse).
// f.besoin_aide_transport = 1 / f.aide_satisfaite = 1 → = TRUE, même
// raison qu'au-dessus.
async function aideTransport(idStructure, debut, fin) {
  const demandesResultat = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM fiche_disponibilite f
       JOIN reponse_alerte r ON r.id_reponse = f.id_reponse
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = $1 AND f.besoin_aide_transport = TRUE
        AND r.date_reponse >= $2 AND r.date_reponse <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const vehiculesResultat = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM fiche_disponibilite f
       JOIN reponse_alerte r ON r.id_reponse = f.id_reponse
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = $1 AND f.besoin_aide_transport = TRUE AND f.aide_satisfaite = TRUE
        AND r.date_reponse >= $2 AND r.date_reponse <= $3`,
    [idStructure, debut, finJournee(fin)]);

  const demandes = Number(demandesResultat.rows[0].nb);
  const vehicules = Number(vehiculesResultat.rows[0].nb);

  return {
    demandes_recues: demandes,
    donneurs_vehicules: vehicules,
    non_satisfaites: demandes - vehicules
  };
}

module.exports = { totauxPeriode, donsParGroupe, rendementAppels, aideTransport };
