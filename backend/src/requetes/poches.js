// =====================================================================
//  DJIGUI — poches de sang (T7) et leur historique (T8).
//  Requête C.1 du cahier des charges : le stock est un COMPTAGE des
//  poches de statut 'disponible', jamais une colonne saisie (RG16).
// =====================================================================
const { pool } = require('../db');
const { ORDRE_AFFICHAGE } = require('../regles/compatibilite');

// Situation en langage courant, pour E17, E22, E23 et E27 gestion.
const SITUATIONS = {
  collectee: 'Collectée, en attente de qualification',
  qualifiee: 'Qualifiée, en attente de mise à disposition',
  disponible: 'Disponible',
  reservee: 'Réservée pour une demande',
  transfusee: 'Transfusée',
  detruite: 'Détruite',
  perimee: 'Périmée'
};

function situationLisible(statut) {
  return SITUATIONS[statut] || statut;
}

function niveauDe(disponibles, seuilBas, seuilCritique) {
  if (disponibles <= seuilCritique) return 'critique';
  if (disponibles <= seuilBas) return 'bas';
  return 'normal';
}

// Écran E27 gestion : ce que peut devenir une poche depuis sa situation
// actuelle. Toute autre transition est refusée (voir changerSituation).
const TRANSITIONS = {
  collectee: ['qualifiee', 'detruite'],
  qualifiee: ['disponible', 'detruite'],
  disponible: ['reservee', 'transfusee', 'detruite'],
  reservee: ['transfusee', 'disponible', 'detruite'],
  transfusee: [],
  detruite: [],
  perimee: ['detruite']
};

function transitionsPossibles(statut) {
  return TRANSITIONS[statut] || [];
}

// Statuts qu'une poche encore « en vie » peut porter avant sa péremption.
const STATUTS_EXPIRABLES = ['collectee', 'qualifiee', 'disponible', 'reservee'];

// La péremption ne dépend d'aucune tâche planifiée : elle se constate à
// la lecture (règle du cahier des charges). Bascule groupée, pour les
// écrans qui listent plusieurs poches (stock, registre).
async function basculerPochesPerimees(idStructure, idAgent) {
  const expirablesResultat = await pool.query(
    `SELECT id_poche, statut FROM poche
      WHERE id_structure = $1 AND date_peremption < CURRENT_DATE
        AND statut IN ('collectee','qualifiee','disponible','reservee')`,
    [idStructure]);
  for (const poche of expirablesResultat.rows) {
    await pool.query("UPDATE poche SET statut = 'perimee' WHERE id_poche = $1", [poche.id_poche]);
    await pool.query(
      `INSERT INTO poche_historique (id_poche, ancien_statut, nouveau_statut, precision_etape, modifie_par)
       VALUES ($1, $2, 'perimee', 'Date de péremption dépassée, constatée automatiquement.', $3)`,
      [poche.id_poche, poche.statut, idAgent]);
  }
}

// Même bascule, mais pour une poche déjà chargée en mémoire (E23, E27) :
// évite une seconde lecture pour un cas qui ne concerne qu'une ligne.
async function basculerSiPerimee(poche, idAgent) {
  if (!STATUTS_EXPIRABLES.includes(poche.statut)) return poche;
  const aujourdHui = new Date().toISOString().slice(0, 10);
  if (poche.date_peremption >= aujourdHui) return poche;
  await pool.query("UPDATE poche SET statut = 'perimee' WHERE id_poche = $1", [poche.id_poche]);
  await pool.query(
    `INSERT INTO poche_historique (id_poche, ancien_statut, nouveau_statut, precision_etape, modifie_par)
     VALUES ($1, $2, 'perimee', 'Date de péremption dépassée, constatée automatiquement.', $3)`,
    [poche.id_poche, poche.statut, idAgent]);
  poche.statut = 'perimee';
  return poche;
}

// C.1 — stock des huit groupes, seuils, niveau et dernier mouvement.
// Toujours les huit lignes, dans l'ordre d'affichage imposé par E16,
// même pour un groupe qui n'a encore aucune poche.
//
// Un centre qui n'a AUCUNE poche au registre (toutes structures neuves)
// n'est pas « en crise » : huit critiques à l'ouverture serait juste
// mathématiquement, mais absurde en pratique. Tant qu'aucun don n'a été
// enregistré, chaque groupe porte le niveau 'en_attente' plutôt qu'un
// niveau calculé sur des seuils qui n'ont encore rien à mesurer.
async function stockParGroupe(idStructure, idAgent) {
  await basculerPochesPerimees(idStructure, idAgent);

  const totalPochesResultat = await pool.query(
    'SELECT COUNT(*) AS nb FROM poche WHERE id_structure = $1', [idStructure]);
  const centreSansPoche = Number(totalPochesResultat.rows[0].nb) === 0;

  const resultat = await pool.query(
    `SELECT s.groupe_sanguin, s.seuil_bas, s.seuil_critique,
            COALESCE(disp.nb, 0) AS poches_disponibles,
            mouv.dernier_mouvement
       FROM seuil_stock s
       LEFT JOIN (
         SELECT groupe_sanguin, COUNT(*) AS nb
           FROM poche
          WHERE id_structure = $1 AND statut = 'disponible'
          GROUP BY groupe_sanguin
       ) disp ON disp.groupe_sanguin = s.groupe_sanguin
       LEFT JOIN (
         SELECT p.groupe_sanguin, MAX(h.date_changement) AS dernier_mouvement
           FROM poche_historique h
           JOIN poche p ON p.id_poche = h.id_poche
          WHERE p.id_structure = $1
          GROUP BY p.groupe_sanguin
       ) mouv ON mouv.groupe_sanguin = s.groupe_sanguin
      WHERE s.id_structure = $1`,
    [idStructure]);

  const parGroupe = new Map(resultat.rows.map((ligne) => [ligne.groupe_sanguin, ligne]));
  return ORDRE_AFFICHAGE.map((groupe) => {
    const ligne = parGroupe.get(groupe);
    if (!ligne) {
      return {
        groupe_sanguin: groupe, poches_disponibles: 0,
        seuil_bas: null, seuil_critique: null,
        niveau: centreSansPoche ? 'en_attente' : null, dernier_mouvement: null
      };
    }
    const disponibles = Number(ligne.poches_disponibles);
    return {
      groupe_sanguin: ligne.groupe_sanguin,
      poches_disponibles: disponibles,
      seuil_bas: ligne.seuil_bas,
      seuil_critique: ligne.seuil_critique,
      niveau: centreSansPoche ? 'en_attente' : niveauDe(disponibles, ligne.seuil_bas, ligne.seuil_critique),
      dernier_mouvement: ligne.dernier_mouvement
    };
  });
}

// Regroupements du filtre de situation, écrits comme on parle (E22).
// « toutes » ou une valeur absente ne filtre rien.
const FILTRES_SITUATION = {
  disponible: ['disponible'],
  en_controle: ['collectee', 'qualifiee'],
  reservee: ['reservee'],
  remise_au_service: ['transfusee'],
  perimee: ['perimee']
};

// Registre des poches, écran E22 : filtres situation et groupe, pagination.
// Nombre de conditions variable (situation → IN (...) de taille variable,
// groupe optionnel) : les valeurs sont empilées au fur et à mesure, le
// marqueur $n suit toujours la position réelle dans le tableau.
async function listerPoches(idStructure, filtres = {}, idAgent) {
  await basculerPochesPerimees(idStructure, idAgent);

  const valeurs = [idStructure];
  const conditions = ['id_structure = $1'];
  const statutsFiltre = FILTRES_SITUATION[filtres.situation];
  if (statutsFiltre) {
    const marqueurs = statutsFiltre.map((statut) => {
      valeurs.push(statut);
      return `$${valeurs.length}`;
    });
    conditions.push(`statut IN (${marqueurs.join(',')})`);
  }
  if (filtres.groupe) {
    valeurs.push(filtres.groupe);
    conditions.push(`groupe_sanguin = $${valeurs.length}`);
  }
  const ou = conditions.join(' AND ');
  const limite = Math.min(Number(filtres.limite) || 50, 200);
  const depart = Math.max(Number(filtres.depart) || 0, 0);

  const resultat = await pool.query(
    `SELECT id_poche, code_poche, groupe_sanguin, date_prelevement, date_peremption,
            statut, destination,
            (date_peremption - CURRENT_DATE) AS jours_restants
       FROM poche
      WHERE ${ou}
      ORDER BY date_peremption ASC
      LIMIT $${valeurs.length + 1} OFFSET $${valeurs.length + 2}`,
    [...valeurs, limite, depart]);

  const total = await pool.query(`SELECT COUNT(*) AS nb FROM poche WHERE ${ou}`, valeurs);

  return {
    lignes: resultat.rows.map((ligne) => ({ ...ligne, situation_lisible: situationLisible(ligne.statut) })),
    total: Number(total.rows[0].nb),
    limite, depart
  };
}

// Poches disponibles ou réservées dont la péremption approche, pour E16.
// DATEDIFF(a, b) entre deux DATE → soustraction directe (a - b), qui rend
// un entier en PostgreSQL, sans fonction ni cast.
async function prochesPeremption(idStructure, jours, idAgent) {
  await basculerPochesPerimees(idStructure, idAgent);
  const resultat = await pool.query(
    `SELECT id_poche, code_poche, groupe_sanguin, date_peremption,
            (date_peremption - CURRENT_DATE) AS jours_restants
       FROM poche
      WHERE id_structure = $1
        AND statut IN ('disponible', 'reservee')
        AND (date_peremption - CURRENT_DATE) BETWEEN 0 AND $2
      ORDER BY date_peremption ASC`,
    [idStructure, jours]);
  return resultat.rows;
}

// Détail d'un groupe pour E17 : les plus utiles en premier (disponibles,
// puis réservées...), et à péremption la plus proche en premier.
// FIELD(colonne,'a','b','c') n'existe pas en PostgreSQL → CASE WHEN.
async function detailGroupe(idStructure, groupe, idAgent) {
  await basculerPochesPerimees(idStructure, idAgent);
  const resultat = await pool.query(
    `SELECT id_poche, code_poche, date_prelevement, date_peremption, statut,
            (date_peremption - CURRENT_DATE) AS jours_restants
       FROM poche
      WHERE id_structure = $1 AND groupe_sanguin = $2
      ORDER BY CASE statut
                 WHEN 'disponible' THEN 1 WHEN 'reservee' THEN 2 WHEN 'qualifiee' THEN 3
                 WHEN 'collectee' THEN 4 WHEN 'perimee' THEN 5 WHEN 'transfusee' THEN 6
                 WHEN 'detruite' THEN 7 ELSE 8
               END,
               date_peremption ASC`,
    [idStructure, groupe]);
  return resultat.rows.map((ligne) => ({ ...ligne, situation_lisible: situationLisible(ligne.statut) }));
}

// Identité complète d'une poche et son parcours, pour E23 et E27 gestion.
async function trouverParCode(code, idStructure, idAgent) {
  const resultat = await pool.query(
    `SELECT p.id_poche, p.code_poche, p.groupe_sanguin, p.date_prelevement, p.date_peremption,
            p.statut, p.destination, p.motif_destruction, p.id_structure,
            (p.date_peremption - CURRENT_DATE) AS jours_restants,
            dr.id_donneur, dr.nom AS donneur_nom, dr.prenom AS donneur_prenom,
            dr.date_prochaine_eligibilite
       FROM poche p
       JOIN don d ON d.id_don = p.id_don
       JOIN donneur dr ON dr.id_donneur = d.id_donneur
      WHERE p.code_poche = $1 AND p.id_structure = $2`,
    [code, idStructure]);
  const poche = resultat.rows[0];
  if (!poche) return null;

  await basculerSiPerimee(poche, idAgent);

  const historiqueResultat = await pool.query(
    `SELECT h.ancien_statut, h.nouveau_statut, h.precision_etape, h.poste, h.date_changement,
            u.nom AS agent_nom, u.prenom AS agent_prenom, u.identifiant AS agent_identifiant
       FROM poche_historique h
       JOIN utilisateur u ON u.id_utilisateur = h.modifie_par
      WHERE h.id_poche = $1
      ORDER BY h.date_changement ASC, h.id_historique ASC`,
    [poche.id_poche]);

  return {
    ...poche,
    situation_lisible: situationLisible(poche.statut),
    prochaines_situations: transitionsPossibles(poche.statut),
    historique: historiqueResultat.rows
  };
}

// Code inconnu (E23) : propose les codes voisins avec leur date de
// création, pour rattraper une faute de frappe ou un chiffre mal lu.
// SUBSTRING_INDEX(code_poche, '-', -1) (dernier segment après '-') n'a
// pas d'équivalent direct → split_part(code_poche, '-', 3) : le code a
// toujours exactement trois segments ici (format validé par la regex
// PO-AAAA-NNNN juste avant). CAST(... AS SIGNED) → ::integer.
async function codesProches(code, idStructure) {
  const texte = String(code || '').trim().toUpperCase();
  const correspond = /^PO-(\d{4})-(\d+)$/.exec(texte);

  if (correspond) {
    const [, annee, numero] = correspond;
    const resultat = await pool.query(
      `SELECT code_poche, date_prelevement AS date_creation
         FROM poche
        WHERE id_structure = $1 AND code_poche LIKE $2
        ORDER BY ABS(split_part(code_poche, '-', 3)::integer - $3) ASC
        LIMIT 6`,
      [idStructure, `PO-${annee}-%`, Number(numero)]);
    return resultat.rows;
  }

  const resultat = await pool.query(
    `SELECT code_poche, date_prelevement AS date_creation
       FROM poche
      WHERE id_structure = $1 AND code_poche LIKE $2
      ORDER BY date_prelevement DESC
      LIMIT 6`,
    [idStructure, `%${texte}%`]);
  return resultat.rows;
}

// Écran E27 gestion : une transition écrit la poche ET une ligne
// d'historique, dans une transaction. Une étape n'est jamais effacée
// ni modifiée : une correction s'écrit comme une nouvelle étape.
async function changerSituation(idPoche, nouveauStatut, precision, idAgent, poste) {
  const lectureResultat = await pool.query('SELECT * FROM poche WHERE id_poche = $1', [idPoche]);
  const poche = lectureResultat.rows[0];
  if (!poche) throw new Error('Cette poche n’existe pas.');

  await basculerSiPerimee(poche, idAgent);

  const possibles = transitionsPossibles(poche.statut);
  if (!possibles.includes(nouveauStatut)) {
    throw new Error(
      `Une poche ${situationLisible(poche.statut).toLowerCase()} ne peut pas passer à « ${situationLisible(nouveauStatut)} ».`);
  }

  // Transaction : un client dédié, toutes les requêtes dessus.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (nouveauStatut === 'transfusee') {
      await client.query(
        'UPDATE poche SET statut = $1, destination = $2 WHERE id_poche = $3',
        [nouveauStatut, precision || null, poche.id_poche]);
    } else if (nouveauStatut === 'detruite') {
      await client.query(
        'UPDATE poche SET statut = $1, motif_destruction = $2 WHERE id_poche = $3',
        [nouveauStatut, precision || null, poche.id_poche]);
    } else {
      await client.query(
        'UPDATE poche SET statut = $1 WHERE id_poche = $2', [nouveauStatut, poche.id_poche]);
    }
    await client.query(
      `INSERT INTO poche_historique (id_poche, ancien_statut, nouveau_statut, precision_etape, modifie_par, poste)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [poche.id_poche, poche.statut, nouveauStatut, precision || null, idAgent, poste || null]);
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
  return { ancien_statut: poche.statut, nouveau_statut: nouveauStatut };
}

module.exports = {
  SITUATIONS, situationLisible, niveauDe, transitionsPossibles,
  stockParGroupe, listerPoches, prochesPeremption, detailGroupe,
  trouverParCode, codesProches, changerSituation
};
