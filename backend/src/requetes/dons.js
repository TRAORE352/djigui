// =====================================================================
//  DJIGUI — enregistrement d'un don (T6) et création de la poche (T7).
//  Cœur du registre de gestion : une seule transaction fait tout, du
//  don à la première ligne d'historique (écran E21).
// =====================================================================
const { pool } = require('../db');
const { lireParametres } = require('./parametres');

// Un champ unique accepte le nom OU le numéro : l'agent tape ce qu'il a
// sous les yeux, sans choisir un mode.
function chiffresRecherche(texte) {
  return String(texte || '').replace(/\D/g, '').replace(/^226/, '');
}

// Recherche pour E21 : les homonymes existent, on renvoie toujours une
// liste, jamais un tri automatique qui risquerait de se tromper de personne.
async function rechercherDonneurPourDon(recherche) {
  const texte = String(recherche || '').trim();
  if (texte.length < 2) return [];
  const motif = `%${texte}%`;
  const chiffres = chiffresRecherche(texte);
  const motifNumero = chiffres.length > 0 ? `%${chiffres}%` : null;

  const resultat = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.sexe, d.date_naissance, d.groupe_sanguin,
            d.poids_declare, d.statut, d.repere_position,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            z.nom AS zone_nom, z.ville AS zone_ville,
            tp.numero AS numero_principal, tp.statut_joignabilite,
            (CURRENT_DATE - d.date_dernier_don) AS jours_depuis_dernier_don,
            (SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur) AS nb_dons_total
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
       LEFT JOIN telephone_donneur tp ON tp.id_donneur = d.id_donneur AND tp.rang = 1
      WHERE d.statut = 'actif'
        AND (
          CONCAT(d.prenom, ' ', d.nom) LIKE $1
          OR CONCAT(d.nom, ' ', d.prenom) LIKE $2
          OR EXISTS (
            SELECT 1 FROM telephone_donneur t2
             WHERE t2.id_donneur = d.id_donneur AND t2.numero LIKE $3
          )
        )
      ORDER BY d.nom, d.prenom
      LIMIT 20`,
    [motif, motif, motifNumero]);
  // nb_dons_total vient d'un COUNT(*) en sous-requête : bigint Postgres,
  // donc chaîne côté pg par défaut. Recasté pour garder un nombre dans
  // la réponse JSON, comme avant (mysql2 le rendait déjà en nombre).
  return resultat.rows.map((ligne) => ({ ...ligne, nb_dons_total: Number(ligne.nb_dons_total) }));
}

// Code de poche PO-AAAA-NNNN, numéroté par année (global, pas par
// structure : le préfixe ne filtre que sur l'année).
//
// CRITIQUE : `client` reçu en paramètre DOIT être le même client pg que
// celui de la transaction appelante (enregistrerDon ci-dessous), jamais
// `pool` directement — sinon ce verrou prendrait sa propre connexion,
// indépendante de celle qui fait l'INSERT juste après, et ne
// protégerait plus rien.
//
// pg_advisory_xact_lock, PAS SEULEMENT FOR UPDATE : un SELECT ... FOR
// UPDATE en PostgreSQL ne verrouille que les lignes réellement renvoyées.
// Sur le tout premier code de l'année (aucune ligne pour ce préfixe),
// il ne verrouille RIEN — deux transactions concurrentes lisent alors
// toutes les deux « aucun code existant » et calculent le même prochain
// numéro (23505 confirmé par un test de concurrence réel). MySQL/InnoDB
// évitait ce cas précis par son gap locking, sans équivalent en
// PostgreSQL. Le verrou consultatif, posé sur l'année avant la lecture,
// ferme la fenêtre même quand la table est encore vide ; il est propre à
// la transaction (auto-libéré au COMMIT/ROLLBACK, jamais à déverrouiller
// à la main). Le FOR UPDATE reste en plus, en défense en profondeur sur
// la ligne elle-même quand elle existe déjà.
async function engendrerCodePoche(client, annee) {
  const prefixe = `PO-${annee}-`;
  // NE PAS RETIRER, PAS REDONDANT AVEC FOR UPDATE : en PostgreSQL, FOR
  // UPDATE ne verrouille aucune ligne quand le SELECT n'en renvoie aucune
  // (premier code de l'année, table encore vide) — deux transactions
  // concurrentes calculeraient alors le même code. MySQL/InnoDB évitait
  // ce cas via son gap locking, absent de PostgreSQL ; ce verrou
  // consultatif comble exactement cette absence.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`poche-annee-${annee}`]);
  const resultat = await client.query(
    `SELECT code_poche FROM poche
      WHERE code_poche LIKE $1
      ORDER BY code_poche DESC
      LIMIT 1
      FOR UPDATE`,
    [`${prefixe}%`]);
  const dernier = resultat.rows[0]?.code_poche;
  const prochain = dernier ? Number(dernier.slice(prefixe.length)) + 1 : 1;
  return `${prefixe}${String(prochain).padStart(4, '0')}`;
}

// Une seule transaction : don, poche, première ligne d'historique,
// mise à jour du donneur (RG9) et, s'il y a lieu, la réponse à l'appel.
// Rien n'est calculé côté JavaScript pour les dates : le calcul reste
// dans la base (make_interval), la valeur exacte est relue avant de
// valider (pas de divergence possible entre deux moteurs de calcul de
// date).
//
// Transaction pg : un seul client sorti du pool, BEGIN/COMMIT/ROLLBACK
// et TOUTES les requêtes ci-dessous — y compris engendrerCodePoche — sur
// CE client. C'est ce qui fait tenir le verrou FOR UPDATE.
async function enregistrerDon(donnees) {
  const { idDonneur, idStructure, idAlerte, dateDon, heureDon, idAgent, poste } = donnees;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const donneurResultat = await client.query(
      'SELECT groupe_sanguin, sexe FROM donneur WHERE id_donneur = $1', [idDonneur]);
    const donneur = donneurResultat.rows[0];
    if (!donneur) throw new Error('Ce donneur n’existe pas.');
    if (!donneur.groupe_sanguin) {
      throw new Error(
        'Le groupe sanguin de ce donneur n’est pas encore connu. Il doit être précisé au centre avant d’enregistrer un don.');
    }

    const parametres = await lireParametres();
    const annee = String(dateDon).slice(0, 4);
    const codePoche = await engendrerCodePoche(client, annee);
    const delaiMois = donneur.sexe === 'M' ? parametres.delai_homme_mois : parametres.delai_femme_mois;

    const resDon = await client.query(
      `INSERT INTO don (id_donneur, id_structure, id_alerte, date_don, heure_don, enregistre_par, poste)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_don`,
      [idDonneur, idStructure, idAlerte || null, dateDon, heureDon || null, idAgent, poste || null]);
    const idDon = resDon.rows[0].id_don;

    // DATE_ADD(?, INTERVAL ? DAY) : paramètre lié dans l'INTERVAL, invalide
    // en PostgreSQL → make_interval(days => ...). $6::date pour que
    // PostgreSQL sache avec quel type additionner l'intervalle (sinon il
    // ne peut pas déduire le type du paramètre depuis le seul contexte).
    const resPoche = await client.query(
      `INSERT INTO poche (code_poche, id_don, id_structure, groupe_sanguin,
                           date_prelevement, date_peremption, statut)
       VALUES ($1, $2, $3, $4, $5, $6::date + make_interval(days => $7), 'collectee')
       RETURNING id_poche`,
      [codePoche, idDon, idStructure, donneur.groupe_sanguin,
       dateDon, dateDon, parametres.duree_conservation_jours]);
    const idPoche = resPoche.rows[0].id_poche;

    await client.query(
      `INSERT INTO poche_historique (id_poche, ancien_statut, nouveau_statut, precision_etape, modifie_par, poste)
       VALUES ($1, NULL, 'collectee', 'Don enregistré, poche collectée.', $2, $3)`,
      [idPoche, idAgent, poste || null]);

    await client.query(
      `UPDATE donneur
          SET date_dernier_don = $1, date_prochaine_eligibilite = $2::date + make_interval(months => $3)
        WHERE id_donneur = $4`,
      [dateDon, dateDon, delaiMois, idDonneur]);

    if (idAlerte) {
      await client.query(
        'UPDATE reponse_alerte SET presente = TRUE WHERE id_alerte = $1 AND id_donneur = $2',
        [idAlerte, idDonneur]);
    }

    const relecture = await client.query(
      `SELECT p.date_prelevement, p.date_peremption, dr.date_prochaine_eligibilite
         FROM poche p
         JOIN donneur dr ON dr.id_donneur = $1
        WHERE p.id_poche = $2`,
      [idDonneur, idPoche]);

    await client.query('COMMIT');
    return {
      id_don: idDon,
      id_poche: idPoche,
      code_poche: codePoche,
      groupe_sanguin: donneur.groupe_sanguin,
      date_prelevement: relecture.rows[0].date_prelevement,
      date_peremption: relecture.rows[0].date_peremption,
      date_prochaine_eligibilite: relecture.rows[0].date_prochaine_eligibilite
    };
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = { rechercherDonneurPourDon, enregistrerDon };
