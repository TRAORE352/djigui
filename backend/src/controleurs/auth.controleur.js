// =====================================================================
//  DJIGUI — authentification.
//  Écrans couverts : E2 à E4 (inscription), E11 (récupération),
//  E13 (connexion professionnelle), E14 et EC2 (mot de passe provisoire).
//  Chaque règle appliquée porte son code en commentaire.
// =====================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const utilisateurs = require('../requetes/utilisateurs');
const donneurs = require('../requetes/donneurs');
const tentatives = require('../requetes/tentatives');
const { zoneExiste } = require('../requetes/zones');
const { lireParametres } = require('../requetes/parametres');
const { journaliser } = require('../requetes/journal');
const { calculerAge } = require('../regles/eligibilite');
const { verifierMotDePassePro } = require('../regles/motdepasse');
const { signerJeton, signerJetonRecuperation } = require('../middlewares/auth');

const GROUPES_VALIDES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Numéro burkinabè : on garde les chiffres, on impose huit chiffres,
// on stocke sous la forme +226XXXXXXXX.
function normaliserNumero(saisie) {
  const chiffres = String(saisie || '').replace(/\D/g, '').replace(/^226/, '');
  return /^\d{8}$/.test(chiffres) ? `+226${chiffres}` : null;
}

// Réponse de sécurité : casse et espaces ignorés (règle RG28).
function normaliserReponse(texte) {
  return String(texte || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function espaceDuRole(role) {
  if (role === 'gestionnaire') return '/gestion';
  if (role === 'admin') return '/administration';
  return '/carte';
}

// ---------------------------------------------------------------------
// POST /api/auth/inscription — écrans E2 à E4.
// Crée le compte, le donneur, ses numéros et le consentement, dans une
// seule transaction : soit tout, soit rien.
// ---------------------------------------------------------------------
async function inscription(requete, reponse) {
  const corps = requete.body || {};
  const parametres = await lireParametres();

  // Étape 1 : identité.
  const nom = String(corps.nom || '').trim();
  const prenom = String(corps.prenom || '').trim();
  if (!nom) return reponse.status(400).json({ erreur: 'Écrivez votre nom.', champ: 'nom' });
  if (!prenom) return reponse.status(400).json({ erreur: 'Écrivez votre prénom.', champ: 'prenom' });
  if (corps.sexe !== 'M' && corps.sexe !== 'F') {
    return reponse.status(400).json({ erreur: 'Choisissez Femme ou Homme.', champ: 'sexe' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corps.date_naissance || '')) {
    return reponse.status(400).json({ erreur: 'La date de naissance est incomplète.', champ: 'date_naissance' });
  }
  if (calculerAge(corps.date_naissance) < parametres.age_min) {
    return reponse.status(400).json({
      erreur: `Il faut avoir ${parametres.age_min} ans révolus pour donner son sang. Vous pourrez créer votre compte à votre majorité.`,
      champ: 'date_naissance'
    });
  }

  // Étape 2 : numéro principal, saisi deux fois (règle RG25).
  const numero = normaliserNumero(corps.numero_principal);
  const confirmation = normaliserNumero(corps.numero_confirmation);
  if (!numero) {
    return reponse.status(400).json({ erreur: 'Le numéro doit compter 8 chiffres.', champ: 'numero_principal' });
  }
  if (numero !== confirmation) {
    return reponse.status(400).json({
      erreur: 'Les deux numéros ne sont pas les mêmes. Corrigez celui du bas ou celui du haut.',
      champ: 'numero_confirmation'
    });
  }

  // Numéros de secours (règle RG21).
  const secondaires = [];
  for (const brut of corps.numeros_secondaires || []) {
    if (!String(brut || '').trim()) continue;
    const secondaire = normaliserNumero(brut);
    if (!secondaire) {
      return reponse.status(400).json({ erreur: 'Un numéro de secours est incomplet : 8 chiffres attendus.' });
    }
    if (secondaire === numero || secondaires.includes(secondaire)) {
      return reponse.status(400).json({ erreur: 'Un même numéro ne peut pas être saisi deux fois.' });
    }
    secondaires.push(secondaire);
  }
  if (1 + secondaires.length > parametres.nb_telephones_max) {
    return reponse.status(400).json({ erreur: `Au plus ${parametres.nb_telephones_max} numéros par donneur.` });
  }

  const motDePasse = String(corps.mot_de_passe || '');
  if (motDePasse.length < parametres.mdp_donneur_longueur_min) {
    return reponse.status(400).json({
      erreur: `Le mot de passe doit compter ${parametres.mdp_donneur_longueur_min} caractères au moins.`,
      champ: 'mot_de_passe'
    });
  }

  // Étape 3 : profil de don. Le groupe peut rester inconnu (écran E4) :
  // le centre vérifiera sur place plutôt que de bloquer l'inscription.
  const groupe = corps.groupe_sanguin || null;
  if (groupe !== null && !GROUPES_VALIDES.includes(groupe)) {
    return reponse.status(400).json({ erreur: 'Groupe sanguin non reconnu.', champ: 'groupe_sanguin' });
  }
  const poids = Number(corps.poids_declare);
  if (!poids || poids <= 0 || poids > 300) {
    return reponse.status(400).json({ erreur: 'Écrivez votre poids en kilogrammes.', champ: 'poids_declare' });
  }
  const idZone = Number(corps.id_zone);
  if (!idZone || !(await zoneExiste(idZone))) {
    return reponse.status(400).json({ erreur: 'Choisissez votre zone dans la liste.', champ: 'id_zone' });
  }

  // Question de sécurité écrite par le donneur (règles RG26, RG27).
  const question = String(corps.question_securite || '').trim();
  const reponseSecurite = normaliserReponse(corps.reponse_securite);
  if (question.length < 5) {
    return reponse.status(400).json({ erreur: 'Écrivez votre question de sécurité.', champ: 'question_securite' });
  }
  if (reponseSecurite.length < 2) {
    return reponse.status(400).json({ erreur: 'Écrivez la réponse à votre question.', champ: 'reponse_securite' });
  }

  // Consentement explicite (règle RG13).
  if (corps.consentement !== true) {
    return reponse.status(400).json({ erreur: 'L\u2019accord est nécessaire pour créer le compte.', champ: 'consentement' });
  }

  const condensatMotDePasse = await bcrypt.hash(motDePasse, 10);
  const condensatReponse = await bcrypt.hash(reponseSecurite, 10);

  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();

    const [resUtilisateur] = await connexion.query(
      `INSERT INTO utilisateur (identifiant, mot_de_passe, role, nom, prenom)
       VALUES (?, ?, 'donneur', ?, ?)`,
      [numero, condensatMotDePasse, nom, prenom]);
    const idUtilisateur = resUtilisateur.insertId;

    const [resDonneur] = await connexion.query(
      `INSERT INTO donneur
         (id_utilisateur, nom, prenom, sexe, date_naissance, groupe_sanguin,
          poids_declare, id_zone, question_securite, reponse_securite,
          accepte_sms, accepte_messagerie, date_consentement)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [idUtilisateur, nom, prenom, corps.sexe, corps.date_naissance, groupe,
       poids, idZone, question, condensatReponse,
       corps.accepte_sms === false ? 0 : 1,
       corps.accepte_messagerie === true ? 1 : 0]);
    const idDonneur = resDonneur.insertId;

    // Le numéro principal existe à deux endroits, écrits ensemble
    // (principe 3 du chapitre 9.4). Il part confirmé : le donneur l'a
    // saisi deux fois, sans collage possible (règle RG25), et vient de
    // s'en servir pour se connecter. C'est déjà une vérification — le
    // traiter comme douteux n'a aucun sens. Les numéros secondaires,
    // eux, n'ont subi aucune double saisie : ils gardent le défaut
    // 'non_verifie' de la colonne.
    await connexion.query(
      `INSERT INTO telephone_donneur (id_donneur, numero, rang, statut_joignabilite, date_dernier_controle)
       VALUES (?, ?, 1, 'confirme', CURDATE())`,
      [idDonneur, numero]);
    for (let indice = 0; indice < secondaires.length; indice += 1) {
      await connexion.query(
        'INSERT INTO telephone_donneur (id_donneur, numero, rang) VALUES (?, ?, ?)',
        [idDonneur, secondaires[indice], indice + 2]);
    }

    await connexion.commit();

    journaliser(idUtilisateur, 'Inscription d\u2019un donneur', numero);
    const jeton = await signerJeton({
      id_utilisateur: idUtilisateur, role: 'donneur', mot_de_passe: condensatMotDePasse
    });
    return reponse.status(201).json({ jeton, role: 'donneur', espace: '/carte' });
  } catch (erreur) {
    await connexion.rollback();
    if (erreur && erreur.code === 'ER_DUP_ENTRY') {
      // Règle RG23 : un numéro n'appartient qu'à un seul donneur.
      return reponse.status(409).json({
        erreur: 'Ce numéro est déjà inscrit. Connectez-vous, ou utilisez « Retrouver mon compte ».',
        champ: 'numero_principal'
      });
    }
    throw erreur;
  } finally {
    connexion.release();
  }
}

// ---------------------------------------------------------------------
// POST /api/auth/connexion — E1 pour le donneur, E13 pour un agent.
// Le message d'échec ne dit jamais laquelle des deux valeurs est fausse,
// et annonce le nombre d'essais restants (E13, règle RG35).
// ---------------------------------------------------------------------
async function connexion(requete, reponse) {
  const saisie = String(requete.body?.identifiant || '').trim();
  const motDePasse = String(requete.body?.mot_de_passe || '');
  // Un donneur se connecte avec son numéro, un agent avec son identifiant.
  const identifiant = normaliserNumero(saisie) || saisie;
  const parametres = await lireParametres();

  const utilisateur = await utilisateurs.trouverParIdentifiant(identifiant);
  if (!utilisateur) {
    journaliser(null, 'Connexion', saisie, 'echouee');
    return reponse.status(401).json({
      erreur: 'Identifiant ou mot de passe incorrect. Vérifiez les deux champs et réessayez.'
    });
  }

  if (utilisateur.statut !== 'actif') {
    journaliser(utilisateur.id_utilisateur, 'Connexion sur un compte inactif', identifiant, 'refusee');
    return reponse.status(403).json({
      erreur: 'Ce compte n\u2019est plus actif. Adressez-vous à l\u2019administrateur du centre.'
    });
  }

  if (utilisateur.verrouille_jusqu_a && new Date(utilisateur.verrouille_jusqu_a) > new Date()) {
    const minutes = Math.max(1, Math.ceil(
      (new Date(utilisateur.verrouille_jusqu_a) - new Date()) / 60000));
    return reponse.status(423).json({
      erreur: `Compte bloqué après plusieurs essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
    });
  }

  const correspond = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe);
  if (!correspond) {
    await utilisateurs.enregistrerEchec(
      utilisateur.id_utilisateur, parametres.echecs_avant_verrou, parametres.duree_verrou_minutes);
    journaliser(utilisateur.id_utilisateur, 'Connexion', identifiant, 'echouee');
    const essaisRestants = Math.max(
      0, parametres.echecs_avant_verrou - (utilisateur.nb_echecs_connexion + 1));
    return reponse.status(401).json({
      erreur: essaisRestants > 0
        ? `Identifiant ou mot de passe incorrect. Vérifiez les deux champs et réessayez. Il reste ${essaisRestants} essai${essaisRestants > 1 ? 's' : ''} avant le blocage du compte.`
        : `Identifiant ou mot de passe incorrect. Le compte est bloqué pendant ${parametres.duree_verrou_minutes} minutes.`,
      essais_restants: essaisRestants
    });
  }

  // Mot de passe provisoire expiré (E27 bis, EC2).
  if (utilisateur.doit_changer_mot_de_passe && utilisateur.provisoire_expire_le
      && new Date(utilisateur.provisoire_expire_le) < new Date()) {
    journaliser(utilisateur.id_utilisateur, 'Connexion avec un provisoire expiré', identifiant, 'refusee');
    return reponse.status(403).json({
      erreur: 'Ce mot de passe provisoire a expiré. Demandez-en un nouveau à l\u2019administrateur du centre.',
      code: 'provisoire_expire'
    });
  }

  await utilisateurs.enregistrerReussite(utilisateur.id_utilisateur);
  journaliser(utilisateur.id_utilisateur, 'Connexion',
    utilisateur.structure_ville || utilisateur.role);

  return reponse.json({
    jeton: await signerJeton(utilisateur),
    role: utilisateur.role,
    espace: utilisateur.doit_changer_mot_de_passe
      ? '/mot-de-passe'                      // règle RG33 : passage obligé
      : espaceDuRole(utilisateur.role),
    doit_changer_mot_de_passe: Boolean(utilisateur.doit_changer_mot_de_passe),
    provisoire_expire_le: utilisateur.provisoire_expire_le
  });
}

// ---------------------------------------------------------------------
// POST /api/auth/deconnexion
// ---------------------------------------------------------------------
async function deconnexion(requete, reponse) {
  journaliser(requete.utilisateur.id_utilisateur, 'Déconnexion', null);
  return reponse.json({ message: 'Session fermée.' });
}

// ---------------------------------------------------------------------
// GET /api/auth/moi — qui suis-je, pour l'affichage du rail et du pied.
// ---------------------------------------------------------------------
async function monCompte(requete, reponse) {
  const utilisateur = requete.utilisateur;
  return reponse.json({
    id_utilisateur: utilisateur.id_utilisateur,
    identifiant: utilisateur.identifiant,
    nom: utilisateur.nom,
    prenom: utilisateur.prenom,
    fonction: utilisateur.fonction,
    role: utilisateur.role,
    structure: utilisateur.id_structure
      ? { id_structure: utilisateur.id_structure, nom: utilisateur.structure_nom, ville: utilisateur.structure_ville }
      : null,
    doit_changer_mot_de_passe: Boolean(utilisateur.doit_changer_mot_de_passe)
  });
}

// ---------------------------------------------------------------------
// POST /api/auth/recuperation/question — temps 1 de l'écran E11.
// Règle RG29 : la question ne sort qu'après numéro ET date de naissance.
// Règle RG32 : le message ne révèle jamais si le numéro existe.
// ---------------------------------------------------------------------
async function recuperationQuestion(requete, reponse) {
  const numero = normaliserNumero(requete.body?.numero);
  const dateNaissance = requete.body?.date_naissance;
  const messageNeutre = {
    erreur: 'Ces informations ne correspondent à aucun compte. Vérifiez le numéro et la date de naissance.'
  };
  if (!numero || !/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance || '')) {
    return reponse.status(400).json(messageNeutre);
  }

  const parametres = await lireParametres();
  const dejaFaites = await tentatives.compterDerniereHeure(numero);
  if (dejaFaites >= parametres.recup_tentatives_heure) {
    return reponse.status(429).json({
      erreur: 'Trop de tentatives. Réessayez dans une heure, ou présentez-vous au centre avec une pièce d\u2019identité.',
      tentatives_restantes: 0
    });
  }
  await tentatives.enregistrerTentative(numero, false);

  const donneur = await donneurs.trouverPourRecuperation(numero, dateNaissance);
  if (!donneur) return reponse.status(400).json(messageNeutre);

  return reponse.json({
    question: donneur.question_securite,
    tentatives_restantes: parametres.recup_tentatives_heure - dejaFaites - 1
  });
}

// ---------------------------------------------------------------------
// POST /api/auth/recuperation/verifier — temps 2 de l'écran E11.
// Règle RG28 : casse et espaces ignorés à la comparaison.
// ---------------------------------------------------------------------
async function recuperationVerifier(requete, reponse) {
  const numero = normaliserNumero(requete.body?.numero);
  const dateNaissance = requete.body?.date_naissance;
  const reponseSaisie = normaliserReponse(requete.body?.reponse);
  if (!numero || !dateNaissance || !reponseSaisie) {
    return reponse.status(400).json({ erreur: 'Écrivez votre réponse.' });
  }

  const parametres = await lireParametres();
  const dejaFaites = await tentatives.compterDerniereHeure(numero);
  if (dejaFaites >= parametres.recup_tentatives_heure) {
    return reponse.status(429).json({
      erreur: 'Trop de tentatives. Réessayez dans une heure, ou présentez-vous au centre avec une pièce d\u2019identité.',
      tentatives_restantes: 0
    });
  }

  const donneur = await donneurs.trouverPourRecuperation(numero, dateNaissance);
  const correspond = donneur
    ? await bcrypt.compare(reponseSaisie, donneur.reponse_securite)
    : false;
  await tentatives.enregistrerTentative(numero, correspond);

  if (!correspond) {
    return reponse.status(400).json({
      erreur: 'Cette réponse ne correspond pas. Écrivez-la exactement comme le jour de l\u2019inscription, sans ajouter de mot.',
      tentatives_restantes: Math.max(0, parametres.recup_tentatives_heure - dejaFaites - 1)
    });
  }

  journaliser(donneur.id_utilisateur, 'Récupération de compte', numero);
  return reponse.json({ jeton_recuperation: signerJetonRecuperation(donneur.id_utilisateur) });
}

// ---------------------------------------------------------------------
// POST /api/auth/mot-de-passe — temps 3 de E11, écrans E14, EC2, E32.
// Règle RG31 : toutes les sessions ouvertes tombent après le changement.
// Règle RG33 : dix caractères et quatre exigences pour un compte pro.
// ---------------------------------------------------------------------
async function nouveauMotDePasse(requete, reponse) {
  const entete = requete.headers.authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  if (!jeton) return reponse.status(401).json({ erreur: 'Connectez-vous pour continuer.' });

  let donnees;
  try {
    donnees = jwt.verify(jeton, process.env.JWT_SECRET);
  } catch {
    return reponse.status(401).json({ erreur: 'Le délai est passé. Recommencez la démarche.' });
  }

  const utilisateur = await utilisateurs.trouverParId(donnees.id);
  if (!utilisateur || utilisateur.statut !== 'actif') {
    return reponse.status(401).json({ erreur: 'Ce compte n\u2019est plus actif.' });
  }

  const parametres = await lireParametres();
  const nouveau = String(requete.body?.mot_de_passe || '');
  const parRecuperation = donnees.but === 'recuperation';

  // L'ancien mot de passe est exigé hors récupération et hors provisoire.
  if (!parRecuperation && !utilisateur.doit_changer_mot_de_passe) {
    const ancien = String(requete.body?.ancien_mot_de_passe || '');
    const correspond = await bcrypt.compare(ancien, utilisateur.mot_de_passe);
    if (!correspond) {
      return reponse.status(400).json({
        erreur: 'Le mot de passe actuel ne correspond pas.', champ: 'ancien_mot_de_passe'
      });
    }
  }

  if (utilisateur.role === 'donneur') {
    if (nouveau.length < parametres.mdp_donneur_longueur_min) {
      return reponse.status(400).json({
        erreur: `Le mot de passe doit compter ${parametres.mdp_donneur_longueur_min} caractères au moins.`,
        champ: 'mot_de_passe'
      });
    }
  } else {
    const manques = verifierMotDePassePro(
      nouveau, parametres.mdp_longueur_min,
      `${utilisateur.nom || ''}${utilisateur.prenom || ''}`,
      utilisateur.structure_nom);
    if (manques.length > 0) {
      return reponse.status(400).json({
        erreur: `Ce mot de passe ne convient pas encore : ${manques.join(' ')}`,
        manques, champ: 'mot_de_passe'
      });
    }
    // La confirmation n'est demandée qu'aux comptes professionnels (E14).
    if (String(requete.body?.confirmation || '') !== nouveau) {
      return reponse.status(400).json({
        erreur: 'Les deux mots de passe ne sont pas identiques. Ressaisissez la confirmation.',
        champ: 'confirmation'
      });
    }
  }

  const condensat = await bcrypt.hash(nouveau, 10);
  await utilisateurs.changerMotDePasse(utilisateur.id_utilisateur, condensat);
  journaliser(utilisateur.id_utilisateur, 'Changement de mot de passe', utilisateur.identifiant);

  const rafraichi = { ...utilisateur, mot_de_passe: condensat, doit_changer_mot_de_passe: 0 };
  return reponse.json({
    jeton: await signerJeton(rafraichi),
    espace: espaceDuRole(utilisateur.role)
  });
}

module.exports = {
  inscription, connexion, deconnexion, monCompte,
  recuperationQuestion, recuperationVerifier, nouveauMotDePasse,
  normaliserNumero, normaliserReponse, espaceDuRole
};
