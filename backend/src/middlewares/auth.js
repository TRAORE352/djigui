// =====================================================================
//  DJIGUI — sessions et contrôle des rôles.
//
//  Le jeton de session porte l'identifiant du compte et un fragment du
//  condensat du mot de passe. À chaque appel, on recharge le compte et
//  on compare ce fragment : si le mot de passe a changé, toutes les
//  sessions ouvertes tombent d'un coup, sans table de sessions (RG31).
//
//  Durée : plusieurs mois pour un donneur (verrou d'application côté
//  écran, voir /api/donneurs/moi/deverrouiller), trente minutes pour un
//  compte professionnel (RG39, poste partagé). Dans les deux cas, la
//  session se prolonge à chaque appel : le jeton rafraîchi part dans
//  l'en-tête X-Jeton-Rafraichi, que le frontend enregistre aussitôt.
//  Un donneur qui utilise l'application régulièrement ne voit donc
//  jamais son jeton expirer ; trente minutes d'inactivité ferment en
//  revanche la session professionnelle, ce qui est exactement la règle
//  du poste partagé.
//
//  Règle C4 : le contrôle des droits se fait ici, côté serveur, à
//  chaque appel. Masquer un bouton à l'écran n'est jamais un contrôle.
// =====================================================================

const jwt = require('jsonwebtoken');
const { trouverParId } = require('../requetes/utilisateurs');
const { lireParametres } = require('../requetes/parametres');
const { journaliser } = require('../requetes/journal');

// Fragment stable du condensat bcrypt (les caractères du sel).
function fragmentCondensat(condensat) {
  return String(condensat).slice(7, 19);
}

async function signerJeton(utilisateur) {
  const parametres = await lireParametres();
  const dureeMinutes = utilisateur.role === 'donneur'
    ? parametres.session_donneur_jours * 24 * 60
    : parametres.session_inactivite_minutes;
  return jwt.sign(
    {
      id: utilisateur.id_utilisateur,
      role: utilisateur.role,
      v: fragmentCondensat(utilisateur.mot_de_passe)
    },
    process.env.JWT_SECRET,
    { expiresIn: `${dureeMinutes}m` }
  );
}

// Jeton court délivré après une récupération réussie. Il n'ouvre pas de
// session : il autorise seulement le changement de mot de passe.
function signerJetonRecuperation(idUtilisateur) {
  return jwt.sign(
    { id: idUtilisateur, but: 'recuperation' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function lireJetonDeLaRequete(requete) {
  const entete = requete.headers.authorization || '';
  return entete.startsWith('Bearer ') ? entete.slice(7) : null;
}

async function verifierSession(requete, reponse, suite) {
  const jeton = lireJetonDeLaRequete(requete);
  if (!jeton) {
    return reponse.status(401).json({ erreur: 'Connectez-vous pour continuer.' });
  }

  let donnees;
  try {
    donnees = jwt.verify(jeton, process.env.JWT_SECRET);
  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      return reponse.status(401).json({
        erreur: 'Votre session s\u2019est fermée après un moment sans activité. Reconnectez-vous.',
        code: 'session_expiree'
      });
    }
    return reponse.status(401).json({ erreur: 'Connectez-vous pour continuer.' });
  }

  if (donnees.but === 'recuperation') {
    return reponse.status(401).json({ erreur: 'Connectez-vous pour continuer.' });
  }

  const utilisateur = await trouverParId(donnees.id);
  if (!utilisateur) {
    return reponse.status(401).json({ erreur: 'Connectez-vous pour continuer.' });
  }
  if (utilisateur.statut !== 'actif') {
    return reponse.status(403).json({
      erreur: 'Ce compte n\u2019est plus actif. Adressez-vous à votre centre.'
    });
  }
  if (fragmentCondensat(utilisateur.mot_de_passe) !== donnees.v) {
    return reponse.status(401).json({
      erreur: 'Votre session a été fermée après un changement de mot de passe. Reconnectez-vous.',
      code: 'session_fermee'
    });
  }

  requete.utilisateur = utilisateur;

  // Prolongation de la session à chaque appel, donneur comme
  // professionnel (RG39 pour ce dernier). Un donneur qui utilise
  // l'application régulièrement voit son jeton repoussé de plusieurs
  // mois à chaque requête : c'est ce glissement, pas la seule durée
  // initiale, qui rend la session persistante tant qu'il ne se
  // déconnecte pas lui-même.
  reponse.setHeader('X-Jeton-Rafraichi', await signerJeton(utilisateur));
  reponse.setHeader('Access-Control-Expose-Headers', 'X-Jeton-Rafraichi');

  suite();
}

// Tant que le mot de passe provisoire n'est pas remplacé, aucun écran
// de travail n'est accessible (règle RG33, écran E14).
function exigerMotDePasseDefinitif(requete, reponse, suite) {
  if (requete.utilisateur.doit_changer_mot_de_passe) {
    return reponse.status(403).json({
      erreur: 'Choisissez votre mot de passe avant d\u2019accéder au registre.',
      code: 'mot_de_passe_provisoire'
    });
  }
  suite();
}

// Restreint une route à un ou plusieurs rôles. Tout refus est neutre à
// l'écran et inscrit au journal (règle RG34).
function exigerRole(...roles) {
  return (requete, reponse, suite) => {
    if (roles.includes(requete.utilisateur.role)) return suite();
    journaliser(
      requete.utilisateur.id_utilisateur,
      'Tentative d\u2019accès à un espace non autorisé',
      `${requete.method} ${requete.originalUrl}`,
      'refusee');
    return reponse.status(403).json({
      erreur: 'Cette adresse n\u2019est pas accessible avec votre compte.'
    });
  };
}

module.exports = {
  signerJeton, signerJetonRecuperation, verifierSession,
  exigerRole, exigerMotDePasseDefinitif, fragmentCondensat, lireJetonDeLaRequete
};
