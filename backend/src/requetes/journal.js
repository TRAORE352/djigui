// DJIGUI — journal d'activité (T14), règles RG20 et RG47.
// Le journal ne fait jamais échouer l'action principale : une panne
// d'écriture est signalée en console, pas remontée à l'écran.
// Registre inaltérable : ce module n'écrit et ne lit jamais que par
// INSERT et SELECT, aucune ligne n'est modifiée ni effacée.
const { pool } = require('../db');

async function journaliser(idUtilisateur, action, cible, resultat = 'reussie') {
  try {
    await pool.query(
      `INSERT INTO journal_activite (id_utilisateur, action, cible, resultat)
       VALUES ($1, $2, $3, $4)`,
      [idUtilisateur || null, action, cible || null, resultat]);
  } catch (erreur) {
    console.error('Journal indisponible :', erreur.message);
  }
}

// Consultation d'un registre : un même geste (ouvrir l'écran, changer
// un filtre, tourner une page) ne doit produire qu'une seule ligne par
// agent toutes les quinze minutes, sinon le journal se noie sous des
// répétitions qui ne disent rien. Ne s'applique qu'aux consultations :
// toute action qui modifie quelque chose continue de passer par
// `journaliser`, une fois par geste, sans exception.
//
// <=> (égalité NULL-safe MySQL) → IS NOT DISTINCT FROM, l'équivalent
// PostgreSQL exact : NULL <=> NULL valait 1 en MySQL, id_utilisateur
// IS NOT DISTINCT FROM NULL vaut TRUE en Postgres, même résultat pour
// une consultation faite sans agent connecté.
async function journaliserConsultation(idUtilisateur, action, cible) {
  try {
    const recentes = await pool.query(
      `SELECT 1 FROM journal_activite
        WHERE id_utilisateur IS NOT DISTINCT FROM $1 AND action = $2
          AND date_action >= (NOW() - INTERVAL '15 minutes')
        LIMIT 1`,
      [idUtilisateur || null, action]);
    if (recentes.rows.length > 0) return;
    await pool.query(
      `INSERT INTO journal_activite (id_utilisateur, action, cible, resultat)
       VALUES ($1, $2, $3, 'reussie')`,
      [idUtilisateur || null, action, cible || null]);
  } catch (erreur) {
    console.error('Journal indisponible :', erreur.message);
  }
}

// Filtre « type d'action » de E31. Chaque action journalisée est un
// texte fixe, jamais composé avec une variable : le classement se fait
// par correspondance exacte sur cette liste, une fois pour toutes.
const ACTIONS_PAR_CATEGORIE = {
  acces: [
    'Connexion', 'Connexion sur un compte inactif', 'Connexion avec un provisoire expiré',
    'Déconnexion', 'Récupération de compte', 'Changement de mot de passe',
    'Tentative d’accès à un espace non autorisé'
  ],
  comptes: [
    'Création d’un compte administrateur', 'Création d’un compte gestionnaire',
    'Remise du mot de passe provisoire', 'Réinitialisation d’un mot de passe',
    'Tentative de désactivation de son propre compte',
    'Tentative de désactivation du dernier administrateur',
    'Réactivation d’un compte', 'Désactivation d’un compte'
  ],
  referentiels: [
    'Création d’une structure', 'Modification d’une structure',
    'Tentative de retrait d’une structure rattachée', 'Retrait d’une structure',
    'Création d’une zone', 'Modification d’une zone',
    'Tentative de retrait d’une zone habitée', 'Retrait d’une zone',
    'Modification d’un paramètre'
  ],
  stock: [
    'Modification des seuils de stock',
    'Tentative d’enregistrement d’un don pour un donneur non éligible',
    'Enregistrement d’un don',
    'Don enregistré avec autorisation médicale (donneur non éligible)',
    'Tentative de changement de situation d’une poche',
    'Changement de situation d’une poche'
  ],
  appels: [
    'Création d’un appel au don (brouillon)', 'Modification d’un appel au don (brouillon)',
    'Tentative d’envoi d’un appel au don', 'Envoi d’un appel au don',
    'Tentative de suppression d’un appel au don', 'Suppression d’un appel au don (brouillon)',
    'Clôture d’un appel au don', 'Mise à jour de la joignabilité d’un numéro',
    'Réponse à un appel au don', 'Enregistrement d’une fiche de disponibilité'
  ],
  consultations: [
    'Consultation du registre des donneurs', 'Consultation de la fiche d’un donneur',
    'Recherche d’un donneur pour un don'
  ],
  profil_donneur: [
    'Inscription d’un donneur', 'Modification du profil donneur',
    'Changement de la question de sécurité', 'Ajout d’un numéro', 'Retrait d’un numéro',
    'Remplacement du numéro principal', 'Désactivation du compte par le donneur'
  ]
};

// Empile une valeur et renvoie son marqueur $n, dans l'ordre — nécessaire
// ici car le nombre de conditions (et donc de placeholders) varie selon
// les filtres réellement posés, y compris un IN (...) de taille variable
// pour type_action.
function ajouter(valeurs, valeur) {
  valeurs.push(valeur);
  return `$${valeurs.length}`;
}

// Lecture pour l'écran E31, filtrable, en lecture seule. L'auteur d'un
// compte donneur n'est jamais renvoyé en clair (numéro de téléphone) :
// le rôle et les colonnes nécessaires à un code donneur (D-XXXX) sont
// renvoyés à part, la mise en forme finale revient au contrôleur (seul
// admin.controleur.js sait reconstruire ce code, via donneurs.controleur.js).
async function listerJournal(filtres = {}) {
  const conditions = [];
  const valeurs = [];
  if (filtres.id_utilisateur) {
    conditions.push(`j.id_utilisateur = ${ajouter(valeurs, filtres.id_utilisateur)}`);
  }
  if (filtres.resultat) {
    conditions.push(`j.resultat = ${ajouter(valeurs, filtres.resultat)}`);
  }
  if (filtres.type_action && ACTIONS_PAR_CATEGORIE[filtres.type_action]) {
    const liste = ACTIONS_PAR_CATEGORIE[filtres.type_action];
    const marqueurs = liste.map((action) => ajouter(valeurs, action));
    conditions.push(`j.action IN (${marqueurs.join(',')})`);
  }
  if (filtres.depuis) {
    conditions.push(`j.date_action >= ${ajouter(valeurs, filtres.depuis)}`);
  }
  if (filtres.jusqu_a) {
    conditions.push(`j.date_action <= ${ajouter(valeurs, `${filtres.jusqu_a} 23:59:59`)}`);
  }
  const ou = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limite = Math.min(Number(filtres.limite) || 50, 200);
  const depart = Math.max(Number(filtres.depart) || 0, 0);

  const resultat = await pool.query(
    `SELECT j.id_journal, j.date_action, j.action, j.cible, j.resultat,
            u.identifiant AS auteur_identifiant, u.role AS auteur_role,
            dn.id_donneur AS auteur_id_donneur, z.ville AS auteur_ville
       FROM journal_activite j
       LEFT JOIN utilisateur u ON u.id_utilisateur = j.id_utilisateur
       LEFT JOIN donneur dn ON dn.id_utilisateur = u.id_utilisateur
       LEFT JOIN zone z ON z.id_zone = dn.id_zone
       ${ou}
      ORDER BY j.date_action DESC
      LIMIT $${valeurs.length + 1} OFFSET $${valeurs.length + 2}`,
    [...valeurs, limite, depart]);

  const total = await pool.query(
    `SELECT COUNT(*) AS nb FROM journal_activite j ${ou}`, valeurs);

  return { lignes: resultat.rows, total: Number(total.rows[0].nb), limite, depart };
}

module.exports = { journaliser, journaliserConsultation, listerJournal, ACTIONS_PAR_CATEGORIE };
