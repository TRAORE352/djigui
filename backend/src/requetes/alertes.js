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
const { construireFiltres, exprEligible, DEPUIS } = require('./registre-donneurs');
const { groupesCompatibles, sansSubstitut } = require('../regles/compatibilite');
const { envoyerPushCandidats } = require('../push');

// Construit la base commune à compterCibles et candidatsFinaux : le
// groupe (élargi ou non aux compatibles, annexe D) et les zones cochées.
// Ne construit plus le SQL ici (contrairement à l'original) : exprEligible
// et construireFiltres doivent être appelés dans l'ordre exact où leurs
// $n apparaîtront dans le texte final, qui diffère selon l'appelant —
// voir compterCibles et candidatsFinaux.
//
// Trois modes (correctif 3) : « groupe » cible un groupe précis (élargi
// ou non aux compatibles) — un donneur sans groupe renseigné n'y a
// jamais sa place, il n'a pas prouvé appartenir à CE groupe. « zone » et
// « tous » ne posent aucun filtre de groupe : `groupes` reste `null`, et
// construireFiltres n'ajoute alors aucune clause « groupe_sanguin IN »,
// ce qui inclut de lui-même les donneurs au groupe encore inconnu (une
// clause IN exclurait toujours NULL, quel que soit son contenu).
async function baseCiblage(ciblage) {
  const parametres = await lireParametres();
  const mode = ciblage.mode || 'groupe';
  const groupes = mode === 'groupe'
    ? (ciblage.elargir_compatibles ? groupesCompatibles(ciblage.groupe) : [ciblage.groupe])
    : null;
  const filtres = { zones: mode === 'tous' ? [] : (ciblage.zones || []) };
  if (groupes) filtres.groupes = groupes;
  return { parametres, groupes, mode, filtres };
}

// Un donneur est retenu s'il a AU MOINS UN numéro qui n'est pas signalé
// injoignable. La joignabilité ORDONNE la liste d'appel (E20) ; elle ne
// FILTRE jamais les destinataires. Un numéro « jamais vérifié » reste un
// numéro qu'on peut appeler. Aucun placeholder ici : reste une constante.
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
// SUM(condition) → SUM(CASE WHEN condition THEN 1 ELSE 0 END). Ordre de
// construction de `valeurs` = ordre d'apparition dans le texte : les deux
// exprEligible() du SELECT d'abord, puis construireFiltres() du WHERE.
async function compterCibles(idStructure, ciblage) {
  const { parametres, groupes, mode, filtres } = await baseCiblage(ciblage);

  const valeurs = [];
  const exprPeuvent = exprEligible(valeurs, parametres);
  const exprRecevront = `${exprEligible(valeurs, parametres)} AND ${EXPR_A_UN_NUMERO_UTILISABLE}`;
  const ou = construireFiltres(filtres, parametres, valeurs);

  const resultat = await pool.query(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.statut_joignabilite = 'confirme' THEN 1 ELSE 0 END) AS confirmes,
        SUM(CASE WHEN ${exprPeuvent} THEN 1 ELSE 0 END) AS peuvent_donner_aujourdhui,
        SUM(CASE WHEN ${exprRecevront} THEN 1 ELSE 0 END) AS recevront
       ${DEPUIS}
      WHERE ${ou}`,
    valeurs);

  const ligne = resultat.rows[0];
  const peuventDonner = Number(ligne.peuvent_donner_aujourdhui) || 0;
  const recevront = Number(ligne.recevront) || 0;
  return {
    mode_ciblage: mode,
    groupes_cibles: groupes,
    sans_substitut: mode === 'groupe' ? sansSubstitut(ciblage.groupe) : true,
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
// Ordre de construction de `valeurs` : construireFiltres (WHERE) avant
// exprEligible (AND qui suit), comme dans le texte.
async function candidatsFinaux(ciblage) {
  const { parametres, filtres } = await baseCiblage(ciblage);
  const valeurs = [];
  const ou = construireFiltres(filtres, parametres, valeurs);
  const exprElig = exprEligible(valeurs, parametres);

  const resultat = await pool.query(
    `SELECT d.id_donneur, p.numero AS numero_principal, d.accepte_messagerie, d.accepte_sms
       ${DEPUIS}
      WHERE ${ou}
        AND ${exprElig}
        AND ${EXPR_A_UN_NUMERO_UTILISABLE}`,
    valeurs);
  return resultat.rows;
}

// Le dernier appel envoyé pour ce groupe, pour que l'agent règle son
// ciblage avec l'expérience passée (E18).
async function dernierAppelDuGroupe(idStructure, groupe) {
  const resultat = await pool.query(
    `SELECT a.id_alerte, a.date_envoi, a.nb_destinataires,
            (SELECT COUNT(*) FROM reponse_alerte r
              WHERE r.id_alerte = a.id_alerte AND r.presente = TRUE) AS donneurs_venus
       FROM alerte a
      WHERE a.id_structure = $1 AND a.groupe_cible = $2 AND a.statut IN ('envoyee', 'cloturee')
      ORDER BY a.date_envoi DESC
      LIMIT 1`,
    [idStructure, groupe]);
  const ligne = resultat.rows[0];
  if (!ligne) return null;
  return { ...ligne, donneurs_venus: Number(ligne.donneurs_venus) };
}

// E18 — création en brouillon, modifiable tant qu'elle n'est pas envoyée.
// Transaction sur un client dédié.
async function creerAlerte(donnees, idAgent) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await client.query(
      `INSERT INTO alerte (id_structure, cree_par, groupe_cible, mode_ciblage, elargi_compatibles,
                            message, canaux, date_limite, heure_limite, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'brouillon')
       RETURNING id_alerte`,
      [donnees.idStructure, idAgent, donnees.groupe || null, donnees.mode || 'groupe',
       Boolean(donnees.elargirCompatibles),
       donnees.message, donnees.canaux, donnees.dateLimite, donnees.heureLimite]);
    const idAlerte = resultat.rows[0].id_alerte;
    for (const idZone of donnees.zones) {
      await client.query('INSERT INTO alerte_zone (id_alerte, id_zone) VALUES ($1, $2)', [idAlerte, idZone]);
    }
    await client.query('COMMIT');
    return idAlerte;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

// Modification d'un brouillon : refusée si l'appel est déjà parti.
async function modifierAlerte(idAlerte, idStructure, donnees) {
  const lectureResultat = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = $1 AND id_structure = $2', [idAlerte, idStructure]);
  if (!lectureResultat.rows[0]) throw new Error('Cet appel n’existe pas.');
  if (lectureResultat.rows[0].statut !== 'brouillon') {
    throw new Error('Cet appel a déjà été envoyé, il ne peut plus être modifié.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE alerte
          SET groupe_cible = $1, mode_ciblage = $2, elargi_compatibles = $3, message = $4,
              canaux = $5, date_limite = $6, heure_limite = $7
        WHERE id_alerte = $8`,
      [donnees.groupe || null, donnees.mode || 'groupe', Boolean(donnees.elargirCompatibles),
       donnees.message, donnees.canaux, donnees.dateLimite, donnees.heureLimite, idAlerte]);
    await client.query('DELETE FROM alerte_zone WHERE id_alerte = $1', [idAlerte]);
    for (const idZone of donnees.zones) {
      await client.query('INSERT INTO alerte_zone (id_alerte, id_zone) VALUES ($1, $2)', [idAlerte, idZone]);
    }
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

// E18 — LE MOMENT CRITIQUE : la liste est figée ici, définitivement.
async function envoyerAlerte(idAlerte, idStructure, idAgent) {
  const lectureResultat = await pool.query(
    'SELECT * FROM alerte WHERE id_alerte = $1 AND id_structure = $2', [idAlerte, idStructure]);
  const alerte = lectureResultat.rows[0];
  if (!alerte) throw new Error('Cet appel n’existe pas.');
  if (alerte.statut !== 'brouillon') throw new Error('Cet appel a déjà été envoyé.');

  const zonesResultat = await pool.query('SELECT id_zone FROM alerte_zone WHERE id_alerte = $1', [idAlerte]);
  const zones = zonesResultat.rows.map((ligne) => ligne.id_zone);

  const candidats = await candidatsFinaux({
    mode: alerte.mode_ciblage, groupe: alerte.groupe_cible,
    elargir_compatibles: Boolean(alerte.elargi_compatibles), zones
  });
  if (candidats.length === 0) {
    throw new Error(
      'Aucun donneur ne correspond à ce ciblage aujourd’hui. Élargissez les zones ou les groupes compatibles avant d’envoyer.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const candidat of candidats) {
      await client.query(
        `INSERT INTO alerte_destinataire (id_alerte, id_donneur, canal_envoi, date_envoi, statut_envoi)
         VALUES ($1, $2, 'application', NOW(), 'envoye')`,
        [idAlerte, candidat.id_donneur]);
    }
    await client.query(
      `UPDATE alerte SET statut = 'envoyee', date_envoi = NOW(), nb_destinataires = $1 WHERE id_alerte = $2`,
      [candidats.length, idAlerte]);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }

  // Canal en plus, jamais une dépendance : l'alerte a déjà réussi au
  // COMMIT ci-dessus. Fire-and-forget, hors transaction (aucune requête
  // réseau ne doit retenir une connexion Postgres) — un échec total du
  // push (permission refusée, réseau, service en panne) ne doit rien
  // changer à ce que cette fonction retourne.
  envoyerPushCandidats(candidats, alerte).catch(() => {});

  return { id_alerte: idAlerte, nb_destinataires: candidats.length, message: alerte.message, destinataires: candidats };
}

// Une alerte dont la date et l'heure limites sont passées est close à la
// lecture, sans tâche planifiée — même principe que la péremption des
// poches (basculerPochesPerimees). Pure JS, aucun changement.
function limiteDepassee(alerte) {
  if (!alerte.date_limite) return false;
  const limite = alerte.heure_limite
    ? new Date(`${alerte.date_limite} ${alerte.heure_limite}`)
    : new Date(`${alerte.date_limite} 23:59:59`);
  return limite <= new Date();
}

async function basculerSiCloturee(alerte) {
  if (alerte.statut !== 'envoyee' || !limiteDepassee(alerte)) return alerte;
  await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = $1", [alerte.id_alerte]);
  alerte.statut = 'cloturee';
  return alerte;
}

async function basculerAlertesCloturees(idStructure) {
  const resultat = await pool.query(
    `SELECT id_alerte, date_limite, heure_limite FROM alerte
      WHERE id_structure = $1 AND statut = 'envoyee' AND date_limite IS NOT NULL`, [idStructure]);
  for (const alerte of resultat.rows) {
    if (limiteDepassee(alerte)) {
      await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = $1", [alerte.id_alerte]);
    }
  }
}

// E19 — quatre compteurs, le détail des donneurs qui viennent avec leur
// fiche de disponibilité, et les refus comptés par motif.
// GROUP_CONCAT(DISTINCT ... ORDER BY ... SEPARATOR ', ') → STRING_AGG,
// DISTINCT à l'intérieur, ORDER BY après le séparateur. Le second
// GROUP_CONCAT (sans SEPARATOR explicite en MySQL = ',' par défaut)
// agrège un entier : cast ::text requis, string_agg n'accepte pas int.
async function suiviAlerte(idAlerte, idStructure) {
  const resultat = await pool.query(
    `SELECT a.*,
            STRING_AGG(DISTINCT z.nom, ', ' ORDER BY z.nom) AS zones_noms,
            STRING_AGG(DISTINCT az.id_zone::text, ',') AS id_zones
       FROM alerte a
       LEFT JOIN alerte_zone az ON az.id_alerte = a.id_alerte
       LEFT JOIN zone z ON z.id_zone = az.id_zone
      WHERE a.id_alerte = $1 AND a.id_structure = $2
      GROUP BY a.id_alerte`,
    [idAlerte, idStructure]);
  const alerte = resultat.rows[0];
  if (!alerte) return null;
  await basculerSiCloturee(alerte);

  const compteursResultat = await pool.query(
    `SELECT
        COUNT(*) AS destinataires,
        SUM(CASE WHEN r.reponse = 'je_viens' THEN 1 ELSE 0 END) AS viennent,
        SUM(CASE WHEN r.reponse = 'je_ne_peux_pas' THEN 1 ELSE 0 END) AS ne_peuvent_pas,
        SUM(CASE WHEN r.id_reponse IS NULL THEN 1 ELSE 0 END) AS sans_reponse
       FROM alerte_destinataire ad
       LEFT JOIN reponse_alerte r ON r.id_alerte = ad.id_alerte AND r.id_donneur = ad.id_donneur
      WHERE ad.id_alerte = $1`,
    [idAlerte]);

  const viennentResultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, r.date_reponse,
            f.repere_position, f.moyen_deplacement, f.besoin_aide_transport, f.aide_satisfaite,
            f.creneau_prefere, f.commentaire,
            p.numero AS numero_principal, p.statut_joignabilite
       FROM reponse_alerte r
       JOIN donneur d ON d.id_donneur = r.id_donneur
       LEFT JOIN fiche_disponibilite f ON f.id_reponse = r.id_reponse
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE r.id_alerte = $1 AND r.reponse = 'je_viens'
      ORDER BY r.date_reponse ASC`,
    [idAlerte]);

  const refusResultat = await pool.query(
    `SELECT motif_refus, COUNT(*) AS nb
       FROM reponse_alerte
      WHERE id_alerte = $1 AND reponse = 'je_ne_peux_pas'
      GROUP BY motif_refus`,
    [idAlerte]);

  const destinatairesResultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.accepte_messagerie, p.numero AS numero_principal
       FROM alerte_destinataire ad
       JOIN donneur d ON d.id_donneur = ad.id_donneur
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE ad.id_alerte = $1`,
    [idAlerte]);

  const compteurs = compteursResultat.rows[0];
  return {
    alerte,
    compteurs: {
      destinataires: Number(compteurs.destinataires),
      viennent: Number(compteurs.viennent) || 0,
      ne_peuvent_pas: Number(compteurs.ne_peuvent_pas) || 0,
      sans_reponse: Number(compteurs.sans_reponse) || 0
    },
    viennent: viennentResultat.rows,
    refus_par_motif: refusResultat.rows.map((ligne) => ({ ...ligne, nb: Number(ligne.nb) })),
    destinataires: destinatairesResultat.rows
  };
}

// E20 — les donneurs sans réponse, classés par ordre d'appel : numéros
// confirmés d'abord, jamais vérifiés ensuite, signalés injoignables en
// dernier. Avec tous leurs numéros, dans leur ordre de rang.
// FIELD(colonne,'a','b','c') → CASE WHEN.
async function listeAppel(idAlerte) {
  const resultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, p.statut_joignabilite AS statut_principal
       FROM alerte_destinataire ad
       JOIN donneur d ON d.id_donneur = ad.id_donneur
       LEFT JOIN reponse_alerte r ON r.id_alerte = ad.id_alerte AND r.id_donneur = ad.id_donneur
       LEFT JOIN telephone_donneur p ON p.id_donneur = d.id_donneur AND p.rang = 1
      WHERE ad.id_alerte = $1 AND r.id_reponse IS NULL
      ORDER BY CASE p.statut_joignabilite
                 WHEN 'confirme' THEN 1 WHEN 'non_verifie' THEN 2 WHEN 'injoignable' THEN 3 ELSE 4
               END, d.nom, d.prenom`,
    [idAlerte]);

  const donneurs = resultat.rows;
  for (const donneur of donneurs) {
    const telephonesResultat = await pool.query(
      `SELECT id_telephone, numero, rang, statut_joignabilite, date_dernier_controle
         FROM telephone_donneur
        WHERE id_donneur = $1
        ORDER BY rang`,
      [donneur.id_donneur]);
    donneur.telephones = telephonesResultat.rows;
  }
  return donneurs;
}

// Suppression d'un brouillon uniquement. Un appel envoyé a pu recevoir
// des réponses de vrais donneurs : l'effacer effacerait ces réponses et
// fausserait les statistiques. Seule la clôture reste possible alors.
async function supprimerAlerte(idAlerte, idStructure) {
  const lectureResultat = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = $1 AND id_structure = $2', [idAlerte, idStructure]);
  if (!lectureResultat.rows[0]) throw new Error('Cet appel n’existe pas.');
  if (lectureResultat.rows[0].statut !== 'brouillon') {
    throw new Error(
      'Cet appel a déjà été envoyé. Il ne peut pas être supprimé, seulement clôturé : les réponses des donneurs doivent rester au registre.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM alerte_zone WHERE id_alerte = $1', [idAlerte]);
    await client.query('DELETE FROM alerte WHERE id_alerte = $1', [idAlerte]);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

async function cloturerAlerte(idAlerte, idStructure) {
  const resultat = await pool.query(
    'SELECT statut FROM alerte WHERE id_alerte = $1 AND id_structure = $2', [idAlerte, idStructure]);
  if (!resultat.rows[0]) throw new Error('Cet appel n’existe pas.');
  if (resultat.rows[0].statut !== 'envoyee') throw new Error('Seul un appel envoyé peut être clôturé.');
  await pool.query("UPDATE alerte SET statut = 'cloturee' WHERE id_alerte = $1", [idAlerte]);
}

async function appartientAStructure(idAlerte, idStructure) {
  const resultat = await pool.query(
    'SELECT 1 FROM alerte WHERE id_alerte = $1 AND id_structure = $2', [idAlerte, idStructure]);
  return Boolean(resultat.rows[0]);
}

async function listerAlertes(idStructure) {
  await basculerAlertesCloturees(idStructure);
  const resultat = await pool.query(
    `SELECT id_alerte, groupe_cible, elargi_compatibles, statut, date_creation, date_envoi,
            date_limite, heure_limite, nb_destinataires
       FROM alerte
      WHERE id_structure = $1
      ORDER BY date_creation DESC`,
    [idStructure]);
  return resultat.rows;
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
