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
  const [dons] = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_structure = ? AND date_don BETWEEN ? AND ?`,
    [idStructure, debut, fin]);

  const [appels] = await pool.query(
    `SELECT COUNT(*) AS nb FROM alerte
      WHERE id_structure = ? AND date_envoi >= ? AND date_envoi <= ?`,
    [idStructure, debut, finJournee(fin)]);

  const [inscriptions] = await pool.query(
    `SELECT COUNT(*) AS nb FROM donneur
      WHERE date_creation >= ? AND date_creation <= ?`,
    [debut, finJournee(fin)]);

  const [echeance] = await pool.query(
    `SELECT COUNT(*) AS nb FROM poche
      WHERE id_structure = ? AND date_peremption BETWEEN ? AND ?`,
    [idStructure, debut, fin]);
  const [perimees] = await pool.query(
    `SELECT COUNT(*) AS nb FROM poche
      WHERE id_structure = ? AND statut = 'perimee' AND date_peremption BETWEEN ? AND ?`,
    [idStructure, debut, fin]);

  return {
    dons_enregistres: dons[0].nb,
    appels_lances: appels[0].nb,
    nouveaux_donneurs: inscriptions[0].nb,
    poches_perimees: perimees[0].nb,
    poches_perimees_proportion: echeance[0].nb > 0
      ? Math.round((perimees[0].nb / echeance[0].nb) * 100) : 0,
    poches_echeance: echeance[0].nb
  };
}

// Les huit groupes, toujours dans l'ordre d'affichage du tableau de
// bord (E16), même à zéro.
async function donsParGroupe(idStructure, debut, fin) {
  const [lignes] = await pool.query(
    `SELECT po.groupe_sanguin, COUNT(*) AS nb
       FROM don dn
       JOIN poche po ON po.id_don = dn.id_don
      WHERE dn.id_structure = ? AND dn.date_don BETWEEN ? AND ?
      GROUP BY po.groupe_sanguin`,
    [idStructure, debut, fin]);
  const parGroupe = new Map(lignes.map((ligne) => [ligne.groupe_sanguin, Number(ligne.nb)]));
  return ORDRE_AFFICHAGE.map((groupe) => ({ groupe_sanguin: groupe, nb_dons: parGroupe.get(groupe) || 0 }));
}

// Entonnoir d'un appel : envoyés, ont répondu, sont venus, et les dons
// qui ne viennent d'aucun appel, pour comparaison.
async function rendementAppels(idStructure, debut, fin) {
  const [envoyes] = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
      WHERE a.id_structure = ? AND ad.statut_envoi = 'envoye'
        AND a.date_envoi >= ? AND a.date_envoi <= ?`,
    [idStructure, debut, finJournee(fin)]);

  const [repondu] = await pool.query(
    `SELECT COUNT(DISTINCT r.id_donneur) AS nb
       FROM reponse_alerte r
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = ? AND r.date_reponse >= ? AND r.date_reponse <= ?`,
    [idStructure, debut, finJournee(fin)]);

  const [venus] = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM reponse_alerte r
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = ? AND r.presente = 1
        AND r.date_reponse >= ? AND r.date_reponse <= ?`,
    [idStructure, debut, finJournee(fin)]);

  const [horsAppel] = await pool.query(
    `SELECT COUNT(*) AS nb FROM don
      WHERE id_structure = ? AND date_don BETWEEN ? AND ? AND id_alerte IS NULL`,
    [idStructure, debut, fin]);

  return {
    messages_envoyes: envoyes[0].nb,
    donneurs_ayant_repondu: repondu[0].nb,
    donneurs_venus: venus[0].nb,
    dons_hors_appel: horsAppel[0].nb,
    taux_venue: envoyes[0].nb > 0 ? Math.round((venus[0].nb / envoyes[0].nb) * 100) : 0
  };
}

// Aide au transport : ce qui n'a pas pu être fait compte autant que le
// reste (fiche_disponibilite, remplie par le donneur après sa réponse).
async function aideTransport(idStructure, debut, fin) {
  const [demandes] = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM fiche_disponibilite f
       JOIN reponse_alerte r ON r.id_reponse = f.id_reponse
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = ? AND f.besoin_aide_transport = 1
        AND r.date_reponse >= ? AND r.date_reponse <= ?`,
    [idStructure, debut, finJournee(fin)]);

  const [vehicules] = await pool.query(
    `SELECT COUNT(*) AS nb
       FROM fiche_disponibilite f
       JOIN reponse_alerte r ON r.id_reponse = f.id_reponse
       JOIN alerte a ON a.id_alerte = r.id_alerte
      WHERE a.id_structure = ? AND f.besoin_aide_transport = 1 AND f.aide_satisfaite = 1
        AND r.date_reponse >= ? AND r.date_reponse <= ?`,
    [idStructure, debut, finJournee(fin)]);

  return {
    demandes_recues: demandes[0].nb,
    donneurs_vehicules: vehicules[0].nb,
    non_satisfaites: demandes[0].nb - vehicules[0].nb
  };
}

module.exports = { totauxPeriode, donsParGroupe, rendementAppels, aideTransport };
