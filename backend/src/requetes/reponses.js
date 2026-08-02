// =====================================================================
//  DJIGUI — réponses des donneurs à un appel au don (T11, T12).
//  Écrans E6 (mes alertes), E7 (répondre), E8 (disponibilité).
// =====================================================================
const { pool } = require('../db');
const { basculerSiCloturee } = require('./alertes');

// Refuse si le donneur n'est pas destinataire, refuse si le délai est
// passé. Une réponse peut être changée tant que l'appel est ouvert :
// UNIQUE(id_alerte, id_donneur) rend l'upsert naturel.
async function repondre(idAlerte, idDonneur, reponse, motifRefus) {
  const [lignes] = await pool.query('SELECT * FROM alerte WHERE id_alerte = ?', [idAlerte]);
  const alerte = lignes[0];
  if (!alerte) throw new Error('Cet appel n’existe pas.');

  const [destinataires] = await pool.query(
    'SELECT 1 FROM alerte_destinataire WHERE id_alerte = ? AND id_donneur = ?', [idAlerte, idDonneur]);
  if (!destinataires[0]) throw new Error('Vous n’êtes pas destinataire de cet appel.');

  await basculerSiCloturee(alerte);
  if (alerte.statut === 'cloturee') {
    throw new Error('Cet appel est clos, votre réponse ne peut plus être enregistrée.');
  }

  await pool.query(
    `INSERT INTO reponse_alerte (id_alerte, id_donneur, reponse, motif_refus, date_reponse)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE reponse = VALUES(reponse), motif_refus = VALUES(motif_refus), date_reponse = NOW()`,
    [idAlerte, idDonneur, reponse, reponse === 'je_ne_peux_pas' ? motifRefus : null]);

  const [reponseLignes] = await pool.query(
    'SELECT id_reponse FROM reponse_alerte WHERE id_alerte = ? AND id_donneur = ?', [idAlerte, idDonneur]);
  return reponseLignes[0].id_reponse;
}

// La fiche de E8. id_reponse est UNIQUE : un nouvel enregistrement
// remplace le précédent plutôt que d'en empiler un second.
async function enregistrerDisponibilite(idReponse, donnees) {
  await pool.query(
    `INSERT INTO fiche_disponibilite
       (id_reponse, repere_position, moyen_deplacement, besoin_aide_transport, creneau_prefere, commentaire)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       repere_position = VALUES(repere_position), moyen_deplacement = VALUES(moyen_deplacement),
       besoin_aide_transport = VALUES(besoin_aide_transport),
       creneau_prefere = VALUES(creneau_prefere), commentaire = VALUES(commentaire)`,
    [idReponse, donnees.repere_position, donnees.moyen_deplacement,
     donnees.besoin_aide_transport ? 1 : 0, donnees.creneau_prefere || null, donnees.commentaire || null]);
}

async function trouverFicheDisponibilite(idReponse) {
  const [lignes] = await pool.query('SELECT * FROM fiche_disponibilite WHERE id_reponse = ?', [idReponse]);
  return lignes[0] || null;
}

// E6 — les appels reçus par ce donneur, du plus récent au plus ancien.
async function mesAlertes(idDonneur) {
  const [lignes] = await pool.query(
    `SELECT a.id_alerte, a.groupe_cible, a.message, a.date_envoi, a.date_limite, a.heure_limite, a.statut,
            s.nom AS structure_nom, s.ville AS structure_ville,
            r.reponse, r.motif_refus, r.date_reponse,
            f.creneau_prefere
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
       JOIN structure_sang s ON s.id_structure = a.id_structure
       LEFT JOIN reponse_alerte r ON r.id_alerte = a.id_alerte AND r.id_donneur = ad.id_donneur
       LEFT JOIN fiche_disponibilite f ON f.id_reponse = r.id_reponse
      WHERE ad.id_donneur = ?
      ORDER BY a.date_envoi DESC`,
    [idDonneur]);
  for (const ligne of lignes) await basculerSiCloturee(ligne);
  return lignes;
}

// E7 — tout ce qu'il faut pour décider : structure, adresse, horaires,
// message du centre, date limite, et la réponse déjà donnée s'il y en a une.
async function detailAlerte(idAlerte, idDonneur) {
  const [lignes] = await pool.query(
    `SELECT a.id_alerte, a.groupe_cible, a.message, a.date_creation, a.date_envoi,
            a.date_limite, a.heure_limite, a.statut,
            s.nom AS structure_nom, s.ville AS structure_ville, s.adresse AS structure_adresse,
            s.horaires AS structure_horaires, s.telephone AS structure_telephone,
            r.id_reponse, r.reponse, r.motif_refus, r.date_reponse
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
       JOIN structure_sang s ON s.id_structure = a.id_structure
       LEFT JOIN reponse_alerte r ON r.id_alerte = a.id_alerte AND r.id_donneur = ad.id_donneur
      WHERE ad.id_alerte = ? AND ad.id_donneur = ?`,
    [idAlerte, idDonneur]);
  const alerte = lignes[0];
  if (!alerte) return null;
  await basculerSiCloturee(alerte);
  return alerte;
}

module.exports = { repondre, enregistrerDisponibilite, trouverFicheDisponibilite, mesAlertes, detailAlerte };
