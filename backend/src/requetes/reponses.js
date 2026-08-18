// =====================================================================
//  DJIGUI — réponses des donneurs à un appel au don (T11, T12).
//  Écrans E6 (mes alertes), E7 (répondre), E8 (disponibilité).
// =====================================================================
const { pool } = require('../db');
const { basculerSiCloturee } = require('./alertes');

// Refuse si le donneur n'est pas destinataire, refuse si le délai est
// passé. Une réponse peut être changée tant que l'appel est ouvert :
// UNIQUE(id_alerte, id_donneur) (contrainte uk_reponse, lot 1) rend
// l'upsert naturel.
// INSERT ... ON DUPLICATE KEY UPDATE ... VALUES(x) (MySQL) →
// INSERT ... ON CONFLICT (colonnes de la contrainte) DO UPDATE SET
// x = EXCLUDED.x (PostgreSQL).
async function repondre(idAlerte, idDonneur, reponse, motifRefus) {
  const alerteResultat = await pool.query('SELECT * FROM alerte WHERE id_alerte = $1', [idAlerte]);
  const alerte = alerteResultat.rows[0];
  if (!alerte) throw new Error('Cet appel n’existe pas.');

  const destinatairesResultat = await pool.query(
    'SELECT 1 FROM alerte_destinataire WHERE id_alerte = $1 AND id_donneur = $2', [idAlerte, idDonneur]);
  if (!destinatairesResultat.rows[0]) throw new Error('Vous n’êtes pas destinataire de cet appel.');

  await basculerSiCloturee(alerte);
  if (alerte.statut === 'cloturee') {
    throw new Error('Cet appel est clos, votre réponse ne peut plus être enregistrée.');
  }

  await pool.query(
    `INSERT INTO reponse_alerte (id_alerte, id_donneur, reponse, motif_refus, date_reponse)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id_alerte, id_donneur) DO UPDATE SET
       reponse = EXCLUDED.reponse, motif_refus = EXCLUDED.motif_refus, date_reponse = NOW()`,
    [idAlerte, idDonneur, reponse, reponse === 'je_ne_peux_pas' ? motifRefus : null]);

  const reponseResultat = await pool.query(
    'SELECT id_reponse FROM reponse_alerte WHERE id_alerte = $1 AND id_donneur = $2', [idAlerte, idDonneur]);
  return reponseResultat.rows[0].id_reponse;
}

// La fiche de E8. id_reponse est UNIQUE (contrainte sans nom, colonne
// unique inline du lot 1) : un nouvel enregistrement remplace le
// précédent plutôt que d'en empiler un second. ON CONFLICT (id_reponse)
// cible directement cette contrainte, pas besoin de connaître son nom
// généré.
async function enregistrerDisponibilite(idReponse, donnees) {
  await pool.query(
    `INSERT INTO fiche_disponibilite
       (id_reponse, repere_position, moyen_deplacement, besoin_aide_transport, creneau_prefere, commentaire)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id_reponse) DO UPDATE SET
       repere_position = EXCLUDED.repere_position, moyen_deplacement = EXCLUDED.moyen_deplacement,
       besoin_aide_transport = EXCLUDED.besoin_aide_transport,
       creneau_prefere = EXCLUDED.creneau_prefere, commentaire = EXCLUDED.commentaire`,
    [idReponse, donnees.repere_position, donnees.moyen_deplacement,
     Boolean(donnees.besoin_aide_transport), donnees.creneau_prefere || null, donnees.commentaire || null]);
}

async function trouverFicheDisponibilite(idReponse) {
  const resultat = await pool.query('SELECT * FROM fiche_disponibilite WHERE id_reponse = $1', [idReponse]);
  return resultat.rows[0] || null;
}

// E6 — les appels reçus par ce donneur, du plus récent au plus ancien.
async function mesAlertes(idDonneur) {
  const resultat = await pool.query(
    `SELECT a.id_alerte, a.groupe_cible, a.message, a.date_envoi, a.date_limite, a.heure_limite, a.statut,
            s.nom AS structure_nom, s.ville AS structure_ville,
            r.reponse, r.motif_refus, r.date_reponse,
            f.creneau_prefere
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
       JOIN structure_sang s ON s.id_structure = a.id_structure
       LEFT JOIN reponse_alerte r ON r.id_alerte = a.id_alerte AND r.id_donneur = ad.id_donneur
       LEFT JOIN fiche_disponibilite f ON f.id_reponse = r.id_reponse
      WHERE ad.id_donneur = $1
      ORDER BY a.date_envoi DESC`,
    [idDonneur]);
  for (const ligne of resultat.rows) await basculerSiCloturee(ligne);
  return resultat.rows;
}

// E7 — tout ce qu'il faut pour décider : structure, adresse, horaires,
// message du centre, date limite, et la réponse déjà donnée s'il y en a une.
async function detailAlerte(idAlerte, idDonneur) {
  const resultat = await pool.query(
    `SELECT a.id_alerte, a.groupe_cible, a.message, a.date_creation, a.date_envoi,
            a.date_limite, a.heure_limite, a.statut,
            s.nom AS structure_nom, s.ville AS structure_ville, s.adresse AS structure_adresse,
            s.horaires AS structure_horaires, s.telephone AS structure_telephone,
            r.id_reponse, r.reponse, r.motif_refus, r.date_reponse
       FROM alerte_destinataire ad
       JOIN alerte a ON a.id_alerte = ad.id_alerte
       JOIN structure_sang s ON s.id_structure = a.id_structure
       LEFT JOIN reponse_alerte r ON r.id_alerte = a.id_alerte AND r.id_donneur = ad.id_donneur
      WHERE ad.id_alerte = $1 AND ad.id_donneur = $2`,
    [idAlerte, idDonneur]);
  const alerte = resultat.rows[0];
  if (!alerte) return null;
  await basculerSiCloturee(alerte);
  return alerte;
}

module.exports = { repondre, enregistrerDisponibilite, trouverFicheDisponibilite, mesAlertes, detailAlerte };
