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

  const [lignes] = await pool.query(
    `SELECT d.id_donneur, d.nom, d.prenom, d.sexe, d.date_naissance, d.groupe_sanguin,
            d.poids_declare, d.statut, d.repere_position,
            d.date_dernier_don, d.date_prochaine_eligibilite,
            z.nom AS zone_nom, z.ville AS zone_ville,
            tp.numero AS numero_principal, tp.statut_joignabilite,
            DATEDIFF(CURDATE(), d.date_dernier_don) AS jours_depuis_dernier_don,
            (SELECT COUNT(*) FROM don WHERE don.id_donneur = d.id_donneur) AS nb_dons_total
       FROM donneur d
       JOIN zone z ON z.id_zone = d.id_zone
       LEFT JOIN telephone_donneur tp ON tp.id_donneur = d.id_donneur AND tp.rang = 1
      WHERE d.statut = 'actif'
        AND (
          CONCAT(d.prenom, ' ', d.nom) LIKE ?
          OR CONCAT(d.nom, ' ', d.prenom) LIKE ?
          OR EXISTS (
            SELECT 1 FROM telephone_donneur t2
             WHERE t2.id_donneur = d.id_donneur AND t2.numero LIKE ?
          )
        )
      ORDER BY d.nom, d.prenom
      LIMIT 20`,
    [motif, motif, motifNumero]);
  return lignes;
}

// Code de poche PO-AAAA-NNNN, numéroté par année. Le SELECT ... FOR
// UPDATE verrouille l'intervalle du dernier code de l'année : un
// second agent qui enregistre au même instant attend que le premier
// valide avant de lire le prochain numéro, ils ne reçoivent jamais le
// même code.
async function engendrerCodePoche(connexion, annee) {
  const prefixe = `PO-${annee}-`;
  const [lignes] = await connexion.query(
    `SELECT code_poche FROM poche
      WHERE code_poche LIKE ?
      ORDER BY code_poche DESC
      LIMIT 1
      FOR UPDATE`,
    [`${prefixe}%`]);
  const dernier = lignes[0]?.code_poche;
  const prochain = dernier ? Number(dernier.slice(prefixe.length)) + 1 : 1;
  return `${prefixe}${String(prochain).padStart(4, '0')}`;
}

// Une seule transaction : don, poche, première ligne d'historique,
// mise à jour du donneur (RG9) et, s'il y a lieu, la réponse à l'appel.
// Rien n'est calculé côté JavaScript pour les dates : DATE_ADD reste
// dans la base, la valeur exacte est relue avant de valider (pas de
// divergence possible entre deux moteurs de calcul de date).
async function enregistrerDon(donnees) {
  const { idDonneur, idStructure, idAlerte, dateDon, heureDon, idAgent, poste } = donnees;
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();

    const [donneurLignes] = await connexion.query(
      'SELECT groupe_sanguin, sexe FROM donneur WHERE id_donneur = ?', [idDonneur]);
    const donneur = donneurLignes[0];
    if (!donneur) throw new Error('Ce donneur n’existe pas.');
    if (!donneur.groupe_sanguin) {
      throw new Error(
        'Le groupe sanguin de ce donneur n’est pas encore connu. Il doit être précisé au centre avant d’enregistrer un don.');
    }

    const parametres = await lireParametres();
    const annee = String(dateDon).slice(0, 4);
    const codePoche = await engendrerCodePoche(connexion, annee);
    const delaiMois = donneur.sexe === 'M' ? parametres.delai_homme_mois : parametres.delai_femme_mois;

    const [resDon] = await connexion.query(
      `INSERT INTO don (id_donneur, id_structure, id_alerte, date_don, heure_don, enregistre_par, poste)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idDonneur, idStructure, idAlerte || null, dateDon, heureDon || null, idAgent, poste || null]);
    const idDon = resDon.insertId;

    const [resPoche] = await connexion.query(
      `INSERT INTO poche (code_poche, id_don, id_structure, groupe_sanguin,
                           date_prelevement, date_peremption, statut)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL ? DAY), 'collectee')`,
      [codePoche, idDon, idStructure, donneur.groupe_sanguin,
       dateDon, dateDon, parametres.duree_conservation_jours]);
    const idPoche = resPoche.insertId;

    await connexion.query(
      `INSERT INTO poche_historique (id_poche, ancien_statut, nouveau_statut, precision_etape, modifie_par, poste)
       VALUES (?, NULL, 'collectee', 'Don enregistré, poche collectée.', ?, ?)`,
      [idPoche, idAgent, poste || null]);

    await connexion.query(
      `UPDATE donneur
          SET date_dernier_don = ?, date_prochaine_eligibilite = DATE_ADD(?, INTERVAL ? MONTH)
        WHERE id_donneur = ?`,
      [dateDon, dateDon, delaiMois, idDonneur]);

    if (idAlerte) {
      await connexion.query(
        'UPDATE reponse_alerte SET presente = 1 WHERE id_alerte = ? AND id_donneur = ?',
        [idAlerte, idDonneur]);
    }

    const [relecture] = await connexion.query(
      `SELECT p.date_prelevement, p.date_peremption, dr.date_prochaine_eligibilite
         FROM poche p
         JOIN donneur dr ON dr.id_donneur = ?
        WHERE p.id_poche = ?`,
      [idDonneur, idPoche]);

    await connexion.commit();
    return {
      id_don: idDon,
      id_poche: idPoche,
      code_poche: codePoche,
      groupe_sanguin: donneur.groupe_sanguin,
      date_prelevement: relecture[0].date_prelevement,
      date_peremption: relecture[0].date_peremption,
      date_prochaine_eligibilite: relecture[0].date_prochaine_eligibilite
    };
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = { rechercherDonneurPourDon, enregistrerDon };
