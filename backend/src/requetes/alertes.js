// =====================================================================
//  DJIGUI — appels au don (T9 à T12), écrans E18, E19, E20.
//  Le ciblage réutilise le moteur écrit pour E24 (registre-donneurs.js) :
//  même construction de filtres, pour que le compteur de E18 et la liste
//  qui reçoit vraiment l'appel soient calculés de la même façon.
//
//  RÈGLE ABSOLUE : la liste des destinataires est FIGÉE à l'envoi
//  (envoyerAlerte). Rien ne la recalcule ensuite : un donneur devenu
//  éligible le lendemain n'est pas ajouté, un donneur parti donner
//  ailleurs n'est pas retiré. Le suivi (E19) doit toujours porter sur
//  les mêmes personnes.
// =====================================================================
const { pool } = require('../db');
const { lireParametres } = require('./parametres');
const { construireFiltres, valeursEligible, EXPR_ELIGIBLE, DEPUIS } = require('./registre-donneurs');
const { groupesCompatibles, sansSubstitut } = require('../regles/compatibilite');

// Construit la base commune à compterCibles et candidatsFinaux : le
// groupe (élargi ou non aux compatibles, annexe D) et les zones cochées.
async function baseCiblage(ciblage) {
  const parametres = await lireParametres();
  const groupes = ciblage.elargir_compatibles
    ? groupesCompatibles(ciblage.groupe)
    : [ciblage.groupe];
  const { ou, valeurs } = construireFiltres({ groupes, zones: ciblage.zones || [] }, parametres);
  return { parametres, groupes, ou, valeurs };
}

// Un donneur est retenu s'il a AU MOINS UN numéro qui n'est pas signalé
// injoignable. La joignabilité ORDONNE la liste d'appel (E20) ; elle ne
// FILTRE jamais les destinataires. Un numéro « jamais vérifié » reste un
// numéro qu'on peut appeler.
const EXPR_A_UN_NUMERO_UTILISABLE = `EXISTS (
  SELECT 1 FROM telephone_donneur tx
   WHERE tx.id_donneur = d.id_donneur AND tx.statut_joignabilite <> 'injoignable'
)`;

// Le compteur permanent de E18 : quatre nombres emboîtés, du plus large
// au plus étroit :
//   - donneurs du groupe, dans les zones choisies
//   - dont numéros confirmés (information seule, ne filtre rien)
//   - dont pouvant donner aujourd'hui (RG5)
//   - recevront l'appel = éligibles ET ayant au moins un numéro non
//     injoignable — le seul nombre qui compte vraiment.
async function compterCibles(idStructure, ciblage) {
  const { parametres, groupes, ou, valeurs } = await baseCiblage(ciblage);

  const [lignes] = await pool.query(
    `SELECT
        COUNT(*) AS total,
        SUM(p.statut_joignabilite = 'confirme') AS confirmes,
        SUM(${EXPR_ELIGIBLE}) AS peuvent_donner_aujourdhui,
        SUM(${EXPR_ELIGIBLE} AND ${EXPR_A_UN_NUMERO_UTILISABLE}) AS recevront
       ${DEPUIS}
      WHERE ${ou}`,
    [...valeursEligible(parametres), ...valeursEligible(parametres), ...valeurs]);

  const ligne = lignes[0];
  const peuventDonner = Number(ligne.peuvent_donner_aujourdhui) || 0;
  const recevront = Number(ligne.recevront) || 0;
  return {
    groupes_cibles: groupes,
    sans_substitut: sansSubstitut(ciblage.groupe),
    donneurs_cible: Number(ligne.total) || 0,
    numeros_confirmes: Number(ligne.confirmes) || 0,
    peuvent_donner_aujourdhui: peuventDonner,
    recevront_appel: recevront,
    // Éligibles, mais écartés parce que tous leurs numéros sont signalés
    // injoignables : la seule vraie raison d'exclusion.
    ecartes_injoignables: peuventDonner - recevront
  };
}

// Les destinataires réels, au moment de l'envoi : éligibles aujourd'hui
// et ayant au moins un numéro non injoignable — exactement le dernier
// nombre de compterCibles. Jamais de LIMIT : un appel ne se tronque pas.
async function candidatsFinaux(ciblage) {
  const { parametres, ou, valeurs } = await baseCiblage(ciblage);
  const [lignes] = await pool.query(
    `SELECT d.id_donneur, p.numero AS numero_principal, d.accepte_messagerie, d.accepte_sms
       ${DEPUIS}
      WHERE ${ou}
        AND ${EXPR_ELIGIBLE}
        AND ${EXPR_A_UN_NUMERO_UTILISABLE}`,
    [...valeurs, ...valeursEligible(parametres)]);
  return lignes;
}

// Le dernier appel envoyé pour ce groupe, pour que l'agent règle son
// ciblage avec l'expérience passée (E18).
async function dernierAppelDuGroupe(idStructure, groupe) {
  const [lignes] = await pool.query(
    `SELECT a.id_alerte, a.date_envoi, a.nb_destinataires,
            (SELECT COUNT(*) FROM reponse_alerte r
              WHERE r.id_alerte = a.id_alerte AND r.presente = 1) AS donneurs_venus
       FROM alerte a
      WHERE a.id_structure = ? AND a.groupe_cible = ? AND a.statut IN ('envoyee', 'cloturee')
      ORDER BY a.date_envoi DESC
      LIMIT 1`,
    [idStructure, groupe]);
  return lignes[0] || null;
}

// E18 — création en brouillon, modifiable tant qu'elle n'est pas envoyée.
async function creerAlerte(donnees, idAgent) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    const [resultat] = await connexion.query(
      `INSERT INTO alerte (id_structure, cree_par, groupe_cible, elargi_compatibles, message,
                            canaux, date_limite, heure_limite, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'brouillon')`,
      [donnees.idStructure, idAgent, donnees.groupe, donnees.elargirCompatibles ? 1 : 0,
       donnees.message, donnees.canaux, donnees.dateLimite, donnees.heureLimite]);
    const idAlerte = resultat.insertId;
    for (const idZone of donnees.zones) {
      await connexion.query('INSERT INTO alerte_zone (id_alerte, id_zone) VALUES (?, ?)', [idAlerte, idZone]);
    }
    await connexion.commit();
    return idAlerte;
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

// Modification d'un brouillon : refusée si l'appel est déjà parti.
async function modifierAlerte(idAlerte, idStructure, donnees) {
  const [lignes] = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = ? AND id_structure = ?', [idAlerte, idStructure]);
  if (!lignes[0]) throw new Error('Cet appel n’existe pas.');
  if (lignes[0].statut !== 'brouillon') throw new Error('Cet appel a déjà été envoyé, il ne peut plus être modifié.');

  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    await connexion.query(
      `UPDATE alerte
          SET groupe_cible = ?, elargi_compatibles = ?, message = ?, canaux = ?,
              date_limite = ?, heure_limite = ?
        WHERE id_alerte = ?`,
      [donnees.groupe, donnees.elargirCompatibles ? 1 : 0, donnees.message, donnees.canaux,
       donnees.dateLimite, donnees.heureLimite, idAlerte]);
    await connexion.query('DELETE FROM alerte_zone WHERE id_alerte = ?', [idAlerte]);
    for (const idZone of donnees.zones) {
      await connexion.query('INSERT INTO alerte_zone (id_alerte, id_zone) VALUES (?, ?)', [idAlerte, idZone]);
    }
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

// E18 — LE MOMENT CRITIQUE : la liste est figée ici, définitivement.
async function envoyerAlerte(idAlerte, idStructure, idAgent) {
  const [lignes] = await pool.query(
    'SELECT * FROM alerte WHERE id_alerte = ? AND id_structure = ?', [idAlerte, idStructure]);
  const alerte = lignes[0];
  if (!alerte) throw new Error('Cet appel n’existe pas.');
  if (alerte.statut !== 'brouillon') throw new Error('Cet appel a déjà été envoyé.');

  const [zonesLignes] = await pool.query('SELECT id_zone FROM alerte_zone WHERE id_alerte = ?', [idAlerte]);
  const zones = zonesLignes.map((ligne) => ligne.id_zone);

  const candidats = await candidatsFinaux({
    groupe: alerte.groupe_cible, elargir_compatibles: Boolean(alerte.elargi_compatibles), zones
  });
  if (candidats.length === 0) {
    throw new Error(
      'Aucun donneur ne correspond à ce ciblage aujourd’hui. Élargissez les zones ou les groupes compatibles avant d’envoyer.');
  }

  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    for (const candidat of candidats) {
      await connexion.query(
        `INSERT INTO alerte_destinataire (id_alerte, id_donneur, canal_envoi, date_envoi, statut_envoi)
         VALUES (?, ?, 'application', NOW(), 'envoye')`,
        [idAlerte, candidat.id_donneur]);
    }
    await connexion.query(
      `UPDATE alerte SET statut = 'envoyee', date_envoi = NOW(), nb_destinataires = ? WHERE id_alerte = ?`,
      [candidats.length, idAlerte]);
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }

  return { id_alerte: idAlerte, nb_destinataires: candidats.length, message: alerte.message, destinataires: candidats };
}

// Une alerte dont la date et l'heure limites sont passées est close à la
// lecture, sans tâche planifiée — même principe que la péremption des
// poches (basculerPochesPerimees).
function limiteDepassee(alerte) {
  if (!alerte.date_limite) return false;
  const limite = alerte.heure_limite
    ? new Date(`${alerte.date_limite} ${alerte.heure_limite}`)
    : new Date(`${alerte.date_limite} 23:59:59`);
  return limite <= new Date();
}

async function basculerSiCloturee(alerte) {
  if (alerte.statut !== 'envoyee' || !limiteDepassee(alerte)) return alerte;
  await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = ?", [alerte.id_alerte]);
  alerte.statut = 'cloturee';
  return alerte;
}

async function basculerAlertesCloturees(idStructure) {
  const [candidates] = await pool.query(
    `SELECT id_alerte, date_limite, heure_limite FROM alerte
      WHERE id_structure = ? AND statut = 'envoyee' AND date_limite IS NOT NULL`, [idStructure]);
  for (const alerte of candidates) {
    if (limiteDepassee(alerte)) {
      await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = ?", [alerte.id_alerte]);
    }
  }
}

// E19 — quatre compteurs, le détail des donneurs qui viennent avec leur
// fiche de disponibilité, et les refus comptés par motif.
async function suiviAlerte(idAlerte, idStructure) {
  const [lignes] = await pool.query(
    `SELECT a.*,
            GROUP_CONCAT(DISTINCT z.nom ORDER BY z.nom SEPARATOR ', ') AS zones_noms,
            GROUP_CONCAT(DISTINCT az.id_zone) AS id_zones
       FROM alerte a
       LEFT JOIN alerte_zone az ON az.id_alerte = a.id_alerte
       LEFT JOIN zone z ON z.id_zone = az.id_zone
      WHERE a.id_alerte = ? AND a.id_structure = ?
      GROUP BY a.id_alerte`,
    [idAlerte, idStructure]);
  const alerte = lignes[0];
  if (!alerte) return null;
  await basculerSiCloturee(alerte);

  const [compteurs] = await pool.query(
    `SELECT
        COUNT(*) AS destinataires,
        SUM(r.reponse = 'je_viens') AS viennent,
        SUM(r.reponse = 'je_ne_peux_pas') AS ne_peuvent_pas,
        SUM(r.id_reponse IS NULL) AS sans_reponse
       FROM alerte_destinataire ad
       LEFT JOIN reponse_alerte r ON r.id_alerte = ad.id_alerte AND r.id_donneur = ad.id_donneur
      WHERE ad.id_alerte = ?`,
    [idAlerte]);

  const [viennent] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, r.date_reponse,
            f.repere_position, f.moyen_deplacement, f.besoin_aide_transport, f.aide_satisfaite,
            f.creneau_prefere, f.commentaire,
            p.numero AS numero_principal, p.statut_joignabilite
       FROM reponse_alerte r
       JOIN donneur d ON d.id_donneur = r.id_donneur
       LEFT JOIN fiche_disponibilite f ON f.id_reponse = r.id_reponse
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE r.id_alerte = ? AND r.reponse = 'je_viens'
      ORDER BY r.date_reponse ASC`,
    [idAlerte]);

  const [refus] = await pool.query(
    `SELECT motif_refus, COUNT(*) AS nb
       FROM reponse_alerte
      WHERE id_alerte = ? AND reponse = 'je_ne_peux_pas'
      GROUP BY motif_refus`,
    [idAlerte]);

  const [destinataires] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.accepte_messagerie, p.numero AS numero_principal
       FROM alerte_destinataire ad
       JOIN donneur d ON d.id_donneur = ad.id_donneur
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE ad.id_alerte = ?`,
    [idAlerte]);

  return {
    alerte,
    compteurs: {
      destinataires: compteurs[0].destinataires,
      viennent: Number(compteurs[0].viennent) || 0,
      ne_peuvent_pas: Number(compteurs[0].ne_peuvent_pas) || 0,
      sans_reponse: Number(compteurs[0].sans_reponse) || 0
    },
    viennent,
    refus_par_motif: refus,
    destinataires
  };
}

// E20 — les donneurs sans réponse, classés par ordre d'appel : numéros
// confirmés d'abord, jamais vérifiés ensuite, signalés injoignables en
// dernier. Avec tous leurs numéros, dans leur ordre de rang.
async function listeAppel(idAlerte) {
  const [donneurs] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, p.statut_joignabilite AS statut_principal
       FROM alerte_destinataire ad
       JOIN donneur d ON d.id_donneur = ad.id_donneur
       LEFT JOIN reponse_alerte r ON r.id_alerte = ad.id_alerte AND r.id_donneur = ad.id_donneur
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE ad.id_alerte = ? AND r.id_reponse IS NULL
      ORDER BY FIELD(p.statut_joignabilite, 'confirme', 'non_verifie', 'injoignable'), d.nom, d.prenom`,
    [idAlerte]);

  for (const donneur of donneurs) {
    const [telephones] = await pool.query(
      `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
         FROM telephone_donneur
        WHERE id_donneur = ?
        ORDER BY rang`,
      [donneur.id_donneur]);
    donneur.telephones = telephones;
  }
  return donneurs;
}

// Suppression d'un brouillon uniquement. Un appel envoyé a pu recevoir
// des réponses de vrais donneurs : l'effacer effacerait ces réponses et
// fausserait les statistiques. Seule la clôture reste possible alors.
async function supprimerAlerte(idAlerte, idStructure) {
  const [lignes] = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = ? AND id_structure = ?', [idAlerte, idStructure]);
  if (!lignes[0]) throw new Error('Cet appel n’existe pas.');
  if (lignes[0].statut !== 'brouillon') {
    throw new Error(
      'Cet appel a déjà été envoyé. Il ne peut pas être supprimé, seulement clôturé : les réponses des donneurs doivent rester au registre.');
  }

  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    await connexion.query('DELETE FROM alerte_zone WHERE id_alerte = ?', [idAlerte]);
    await connexion.query('DELETE FROM alerte WHERE id_alerte = ?', [idAlerte]);
    await connexion.commit();
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

async function cloturerAlerte(idAlerte, idStructure) {
  const [lignes] = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = ? AND id_structure = ?', [idAlerte, idStructure]);
  if (!lignes[0]) throw new Error('Cet appel n’existe pas.');
  if (lignes[0].statut !== 'envoyee') throw new Error('Seul un appel envoyé peut être clôturé.');
  await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = ?", [idAlerte]);
}

async function appartientAStructure(idAlerte, idStructure) {
  const [lignes] = await pool.query(
    'SELECT 1 FROM alerte WHERE id_alerte = ? AND id_structure = ?', [idAlerte, idStructure]);
  return Boolean(lignes[0]);
}

async function listerAlertes(idStructure) {
  await basculerAlertesCloturees(idStructure);
  const [lignes] = await pool.query(
    `SELECT id_alerte, groupe_cible, elargi_compatibles, statut, date_creation, date_envoi,
            date_limite, heure_limite, nb_destinataires
       FROM alerte
      WHERE id_structure = ?
      ORDER BY date_creation DESC`,
    [idStructure]);
  return lignes;
}

async function alertesEnCours(idStructure) {
  const toutes = await listerAlertes(idStructure);
  return toutes.filter((alerte) => alerte.statut === 'envoyee');
}

module.exports = {
  compterCibles, dernierAppelDuGroupe, creerAlerte, modifierAlerte, envoyerAlerte,
  basculerSiCloturee, suiviAlerte, listeAppel, cloturerAlerte, supprimerAlerte, appartientAStructure,
  listerAlertes, alertesEnCours
};
