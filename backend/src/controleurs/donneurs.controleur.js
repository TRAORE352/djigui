// =====================================================================
//  DJIGUI — espace donneur. Écrans E5 (carte), E9 (mes dons),
//  E10 (mon compte), E12 (installation).
// =====================================================================
const bcrypt = require('bcryptjs');
const donneurs = require('../requetes/donneurs');
const telephones = require('../requetes/telephones');
const reponses = require('../requetes/reponses');
const abonnementsPush = require('../requetes/abonnements-push');
const utilisateurs = require('../requetes/utilisateurs');
const { zoneExiste } = require('../requetes/zones');
const { lireParametres } = require('../requetes/parametres');
const { journaliser } = require('../requetes/journal');
const { evaluerEligibilite } = require('../regles/eligibilite');
const { normaliserNumero, normaliserReponse } = require('./auth.controleur');
const { signerJeton } = require('../middlewares/auth');
const { GROUPES } = require('../regles/compatibilite');

const MOTIFS_REFUS = ['don_trop_recent', 'absent_de_la_ville', 'raison_de_sante', 'autre'];
const MOYENS_DEPLACEMENT = ['a_pied', 'deux_roues', 'transport_commun'];

// Numéro de donneur affiché sur la carte E5, du type D-2451-OUA.
function codeDonneur(idDonneur, ville) {
  const lettres = String(ville || 'BFA')
    .normalize('NFD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'BFA';
  return `D-${String(idDonneur).padStart(4, '0')}-${lettres}`;
}

async function chargerMonDonneur(requete, reponse) {
  const donneur = await donneurs.trouverParIdUtilisateur(requete.utilisateur.id_utilisateur);
  if (!donneur) {
    reponse.status(404).json({ erreur: 'Profil introuvable.' });
    return null;
  }
  return donneur;
}

// GET /api/donneurs/moi — carte de donneur (E5).
async function monProfil(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;

  const nbDonsDouzeMois = await donneurs.compterDonsDouzeMois(donneur.id_donneur);
  const resume = await donneurs.resumeDons(donneur.id_donneur);
  const eligibilite = await evaluerEligibilite(donneur, nbDonsDouzeMois);

  return reponse.json({
    code_donneur: codeDonneur(donneur.id_donneur, donneur.zone_ville),
    nom: donneur.nom,
    prenom: donneur.prenom,
    sexe: donneur.sexe,
    date_naissance: donneur.date_naissance,
    groupe_sanguin: donneur.groupe_sanguin,
    poids_declare: Number(donneur.poids_declare),
    zone: donneur.zone_nom,
    ville: donneur.zone_ville,
    id_zone: donneur.id_zone,
    repere_position: donneur.repere_position,
    question_securite: donneur.question_securite,
    accepte_sms: Boolean(donneur.accepte_sms),
    accepte_messagerie: Boolean(donneur.accepte_messagerie),
    date_dernier_don: donneur.date_dernier_don,
    date_prochaine_eligibilite: donneur.date_prochaine_eligibilite,
    nb_dons: resume.nb,
    premier_don: resume.premier_don,
    eligibilite
  });
}

// GET /api/donneurs/moi/telephones — section « mes numéros » de E10.
async function mesTelephones(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const parametres = await lireParametres();
  return reponse.json({
    telephones: await telephones.listerParDonneur(donneur.id_donneur),
    maximum: parametres.nb_telephones_max
  });
}

// GET /api/donneurs/moi/dons — registre E9.
async function mesDons(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const resume = await donneurs.resumeDons(donneur.id_donneur);
  return reponse.json({
    dons: await donneurs.listerDons(donneur.id_donneur),
    nb_dons: resume.nb,
    premier_don: resume.premier_don,
    date_creation: donneur.date_creation
  });
}

// PUT /api/donneurs/moi — poids, zone, repère, canaux, et groupe sanguin
// une seule fois (E10). Le nom et le prénom restent en lecture seule :
// ils se corrigent au centre, avec une pièce d'identité, pour ne pas
// ouvrir de porte à une usurpation par simple modification du profil.
async function modifierProfil(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const corps = requete.body || {};

  // Le poids reste facultatif (règle du lot 1) : vide ou absent efface
  // la valeur plutôt que d'imposer un chiffre inventé.
  let poids = donneur.poids_declare === null ? null : Number(donneur.poids_declare);
  if (corps.poids_declare !== undefined) {
    if (corps.poids_declare === null || corps.poids_declare === '') {
      poids = null;
    } else {
      poids = Number(corps.poids_declare);
      if (!poids || poids <= 0 || poids > 300) {
        return reponse.status(400).json({ erreur: 'Ce poids ne semble pas exact.', champ: 'poids_declare' });
      }
    }
  }

  const idZone = corps.id_zone === undefined ? donneur.id_zone : Number(corps.id_zone);
  if (!idZone || !(await zoneExiste(idZone))) {
    return reponse.status(400).json({ erreur: 'Choisissez votre zone dans la liste.', champ: 'id_zone' });
  }

  // Le groupe ne se règle qu'une fois par le donneur : une fois connu,
  // seul le centre peut le corriger (RG, cohérent avec E4 à
  // l'inscription — « Je ne sais pas » reste réparable ici, une seule
  // fois, mais pas un groupe déjà déclaré).
  let groupe = donneur.groupe_sanguin;
  if (corps.groupe_sanguin !== undefined && donneur.groupe_sanguin === null) {
    const propose = corps.groupe_sanguin || null;
    if (propose !== null && !GROUPES.includes(propose)) {
      return reponse.status(400).json({ erreur: 'Groupe sanguin non reconnu.', champ: 'groupe_sanguin' });
    }
    groupe = propose;
  } else if (corps.groupe_sanguin !== undefined && donneur.groupe_sanguin !== null
             && corps.groupe_sanguin !== donneur.groupe_sanguin) {
    return reponse.status(403).json({
      erreur: 'Votre groupe sanguin est déjà enregistré. Seul le centre peut le corriger.',
      champ: 'groupe_sanguin'
    });
  }

  await donneurs.mettreAJourProfil(donneur.id_donneur, {
    poids_declare: poids,
    id_zone: idZone,
    groupe_sanguin: groupe,
    repere_position: corps.repere_position !== undefined
      ? String(corps.repere_position || '').trim() : donneur.repere_position,
    accepte_sms: corps.accepte_sms !== undefined ? corps.accepte_sms : Boolean(donneur.accepte_sms),
    accepte_messagerie: corps.accepte_messagerie !== undefined
      ? corps.accepte_messagerie : Boolean(donneur.accepte_messagerie)
  });
  journaliser(requete.utilisateur.id_utilisateur, 'Modification du profil donneur', null);
  return reponse.json({ message: 'Enregistré.' });
}

// PUT /api/donneurs/moi/question — question de sécurité (E10, RG26).
async function changerQuestion(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const question = String(requete.body?.question_securite || '').trim();
  const reponseClaire = normaliserReponse(requete.body?.reponse_securite);
  if (question.length < 5) {
    return reponse.status(400).json({ erreur: 'Écrivez votre question.', champ: 'question_securite' });
  }
  if (reponseClaire.length < 2) {
    return reponse.status(400).json({ erreur: 'Écrivez la réponse à votre question.', champ: 'reponse_securite' });
  }
  await donneurs.changerQuestionSecurite(
    donneur.id_donneur, question, await bcrypt.hash(reponseClaire, 10));
  journaliser(requete.utilisateur.id_utilisateur, 'Changement de la question de sécurité', null);
  return reponse.json({ message: 'Enregistré.' });
}

// POST /api/donneurs/moi/telephones — ajout d'un numéro de secours.
async function ajouterTelephone(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const parametres = await lireParametres();
  const numero = normaliserNumero(requete.body?.numero);
  if (!numero) {
    return reponse.status(400).json({ erreur: 'Le numéro doit compter 8 chiffres.', champ: 'numero' });
  }
  const rang = await telephones.premierRangLibre(donneur.id_donneur, parametres.nb_telephones_max);
  if (!rang) {
    return reponse.status(400).json({
      erreur: `Vous avez déjà ${parametres.nb_telephones_max} numéros. Retirez-en un avant d\u2019en ajouter.`
    });
  }
  try {
    const idTelephone = await telephones.ajouterNumero(donneur.id_donneur, numero, rang);
    journaliser(requete.utilisateur.id_utilisateur, 'Ajout d\u2019un numéro', numero);
    return reponse.status(201).json({ id_telephone: idTelephone, rang });
  } catch (erreur) {
    if (erreur.code === '23505') {
      return reponse.status(409).json({ erreur: 'Ce numéro est déjà enregistré.', champ: 'numero' });
    }
    throw erreur;
  }
}

// DELETE /api/donneurs/moi/telephones/:id — le rang 1 ne se retire pas.
async function retirerTelephone(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const telephone = await telephones.trouverNumero(Number(requete.params.id));
  if (!telephone || telephone.id_donneur !== donneur.id_donneur) {
    return reponse.status(404).json({ erreur: 'Ce numéro n\u2019existe pas.' });
  }
  if (telephone.rang === 1) {
    return reponse.status(400).json({
      erreur: 'Le numéro principal ne peut pas être retiré. Vous pouvez le remplacer.'
    });
  }
  await telephones.supprimerNumero(telephone.id_telephone);
  journaliser(requete.utilisateur.id_utilisateur, 'Retrait d\u2019un numéro', telephone.numero);
  return reponse.json({ message: 'Numéro retiré.' });
}

// PUT /api/donneurs/moi/numero-principal — règle RG38.
async function remplacerPrincipal(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const parametres = await lireParametres();
  const nouveau = normaliserNumero(requete.body?.nouveau_numero);
  const confirmation = normaliserNumero(requete.body?.confirmation);
  if (!nouveau) {
    return reponse.status(400).json({ erreur: 'Le numéro doit compter 8 chiffres.', champ: 'nouveau_numero' });
  }
  if (nouveau !== confirmation) {
    return reponse.status(400).json({
      erreur: 'Les deux numéros ne sont pas les mêmes. Corrigez celui du bas ou celui du haut.',
      champ: 'confirmation'
    });
  }
  try {
    await telephones.remplacerNumeroPrincipal(
      donneur.id_donneur, donneur.id_utilisateur, nouveau,
      requete.body?.conserver_ancien === true, parametres.nb_telephones_max);
    journaliser(requete.utilisateur.id_utilisateur, 'Remplacement du numéro principal', nouveau);
    return reponse.json({
      message: 'Numéro principal remplacé. C\u2019est maintenant votre identifiant de connexion.'
    });
  } catch (erreur) {
    if (erreur.code === '23505') {
      return reponse.status(409).json({
        erreur: 'Ce numéro appartient déjà à un autre compte.', champ: 'nouveau_numero'
      });
    }
    throw erreur;
  }
}

// PUT /api/donneurs/moi/desactivation — règle RG14.
async function desactiver(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  await donneurs.desactiverCompte(donneur.id_donneur, donneur.id_utilisateur);
  journaliser(requete.utilisateur.id_utilisateur, 'Désactivation du compte par le donneur', null);
  return reponse.json({
    message: 'Votre compte est désactivé. Vous ne recevrez plus d\u2019appel au don.'
  });
}

// POST /api/donneurs/moi/deverrouiller — verrou d'application (E5 et
// suivants). Le donneur est déjà authentifié : son jeton reste celui
// qu'il avait avant l'appel, cette route ne fait que revalider son mot
// de passe pour lever le voile posé par l'écran de verrouillage. Elle
// n'ouvre jamais de nouvelle session et ne renvoie jamais le mot de
// passe ni aucune trace de celui-ci.
// Réutilise le verrouillage RG35 déjà en place sur le compte (mêmes
// colonnes que la connexion classique) : cinq échecs bloquent le
// compte quinze minutes, à la fois ici et pour une connexion complète.
// Un mot de passe refusé répond 403, jamais 401 : le jeton, lui, reste
// parfaitement valide (401 déclencherait côté frontend l'effacement
// automatique du jeton, prévu pour une session réellement invalide,
// pas pour un simple mot de passe mal saisi au verrou).
async function deverrouiller(requete, reponse) {
  const utilisateur = requete.utilisateur;
  const motDePasse = String(requete.body?.mot_de_passe || '');
  const parametres = await lireParametres();

  if (utilisateur.verrouille_jusqu_a && new Date(utilisateur.verrouille_jusqu_a) > new Date()) {
    const minutes = Math.max(1, Math.ceil(
      (new Date(utilisateur.verrouille_jusqu_a) - new Date()) / 60000));
    return reponse.status(423).json({
      erreur: `Compte bloqué après plusieurs essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      code: 'compte_bloque'
    });
  }

  const correspond = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe);
  if (!correspond) {
    await utilisateurs.enregistrerEchec(
      utilisateur.id_utilisateur, parametres.echecs_avant_verrou, parametres.duree_verrou_minutes);
    journaliser(utilisateur.id_utilisateur, 'Déverrouillage de l’application', null, 'echouee');
    const essaisRestants = Math.max(
      0, parametres.echecs_avant_verrou - (utilisateur.nb_echecs_connexion + 1));
    return reponse.status(403).json({
      erreur: essaisRestants > 0
        ? `Mot de passe incorrect. Il reste ${essaisRestants} essai${essaisRestants > 1 ? 's' : ''} avant le blocage du compte.`
        : `Mot de passe incorrect. Le compte est bloqué pendant ${parametres.duree_verrou_minutes} minutes.`,
      essais_restants: essaisRestants
    });
  }

  await utilisateurs.enregistrerReussite(utilisateur.id_utilisateur);
  journaliser(utilisateur.id_utilisateur, 'Déverrouillage de l’application', null);
  return reponse.json({ jeton: await signerJeton(utilisateur) });
}

// POST /api/donneurs/moi/abonnement-push — E10, section Notifications,
// et l'invite de E6. { endpoint, keys: { p256dh, auth } }, format natif
// de PushSubscription.toJSON() côté navigateur.
async function enregistrerAbonnementPush(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const corps = requete.body || {};
  const endpoint = String(corps.endpoint || '').trim();
  const p256dh = corps.keys?.p256dh;
  const auth = corps.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return reponse.status(400).json({ erreur: 'Abonnement incomplet.' });
  }
  await abonnementsPush.enregistrerAbonnement(donneur.id_donneur, endpoint, p256dh, auth);
  journaliser(requete.utilisateur.id_utilisateur, 'Activation des notifications sur un appareil', null);
  return reponse.status(201).json({ message: 'Notifications activées sur cet appareil.' });
}

// DELETE /api/donneurs/moi/abonnement-push — ne retire que l'appareil
// courant (identifié par son endpoint), jamais tous les abonnements du
// donneur.
async function retirerAbonnementPush(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const endpoint = String(requete.body?.endpoint || '').trim();
  if (!endpoint) return reponse.status(400).json({ erreur: 'Abonnement introuvable.' });
  await abonnementsPush.supprimerAbonnement(donneur.id_donneur, endpoint);
  journaliser(requete.utilisateur.id_utilisateur, 'Désactivation des notifications sur un appareil', null);
  return reponse.json({ message: 'Notifications désactivées sur cet appareil.' });
}

// GET /api/donneurs/moi/rappel.ics — bouton de l'écran E5.
async function rappelAgenda(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  if (!donneur.date_prochaine_eligibilite) {
    return reponse.status(404).json({ erreur: 'Aucune date de prochain don à rappeler pour l\u2019instant.' });
  }
  const date = String(donneur.date_prochaine_eligibilite).replace(/-/g, '');
  const horodatage = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const contenu = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DJIGUI//Rappel de don//FR',
    'BEGIN:VEVENT',
    `UID:djigui-${donneur.id_donneur}-${date}`,
    `DTSTAMP:${horodatage}`,
    `DTSTART;VALUE=DATE:${date}`,
    'SUMMARY:Vous pouvez donner votre sang à nouveau',
    'DESCRIPTION:Rappel DJIGUI. La décision de prélever appartient au personnel médical du centre.',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  reponse.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  reponse.setHeader('Content-Disposition', 'attachment; filename="rappel-djigui.ics"');
  return reponse.send(contenu);
}

/* ==================== E6, E7, E8 : appels au don ===================== */

// GET /api/donneurs/moi/alertes — E6.
async function mesAlertes(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  return reponse.json({ alertes: await reponses.mesAlertes(donneur.id_donneur) });
}

// GET /api/donneurs/moi/alertes/:id — E7.
async function detailAlerte(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const idAlerte = Number(requete.params.id);
  const alerte = await reponses.detailAlerte(idAlerte, donneur.id_donneur);
  if (!alerte) return reponse.status(404).json({ erreur: 'Cet appel ne vous concerne pas.' });

  const fiche = alerte.id_reponse ? await reponses.trouverFicheDisponibilite(alerte.id_reponse) : null;
  return reponse.json({ ...alerte, fiche_disponibilite: fiche });
}

// POST /api/donneurs/moi/alertes/:id/reponse — E7.
async function repondreAlerte(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const idAlerte = Number(requete.params.id);
  const rep = requete.body?.reponse;
  if (!['je_viens', 'je_ne_peux_pas'].includes(rep)) {
    return reponse.status(400).json({ erreur: 'Choisissez une réponse.' });
  }
  let motif = null;
  if (rep === 'je_ne_peux_pas') {
    motif = requete.body?.motif_refus;
    if (!MOTIFS_REFUS.includes(motif)) {
      return reponse.status(400).json({ erreur: 'Choisissez le motif.', champ: 'motif_refus' });
    }
  }

  let idReponse;
  try {
    idReponse = await reponses.repondre(idAlerte, donneur.id_donneur, rep, motif);
  } catch (erreur) {
    journaliser(requete.utilisateur.id_utilisateur, 'Réponse à un appel au don', `Alerte ${idAlerte}`, 'refusee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(requete.utilisateur.id_utilisateur, 'Réponse à un appel au don', `Alerte ${idAlerte} : ${rep}`);
  return reponse.json({
    id_reponse: idReponse,
    message: rep === 'je_viens' ? 'Réponse enregistrée : je viens.' : 'Réponse enregistrée.'
  });
}

// POST /api/donneurs/moi/alertes/:id/disponibilite — E8. Aucune position,
// aucun GPS : le repère est un texte libre écrit par le donneur.
async function enregistrerDisponibiliteCtrl(requete, reponse) {
  const donneur = await chargerMonDonneur(requete, reponse);
  if (!donneur) return;
  const idAlerte = Number(requete.params.id);

  const alerte = await reponses.detailAlerte(idAlerte, donneur.id_donneur);
  if (!alerte || alerte.reponse !== 'je_viens') {
    return reponse.status(400).json({
      erreur: 'Répondez d’abord « Je viens » avant d’indiquer votre disponibilité.'
    });
  }

  const corps = requete.body || {};
  const repere = String(corps.repere_position || '').trim();
  if (repere.length < 3) {
    return reponse.status(400).json({
      erreur: 'Écrivez un repère pour qu’on puisse vous situer.', champ: 'repere_position'
    });
  }
  if (!MOYENS_DEPLACEMENT.includes(corps.moyen_deplacement)) {
    return reponse.status(400).json({ erreur: 'Choisissez votre moyen de déplacement.', champ: 'moyen_deplacement' });
  }

  await reponses.enregistrerDisponibilite(alerte.id_reponse, {
    repere_position: repere,
    moyen_deplacement: corps.moyen_deplacement,
    besoin_aide_transport: corps.besoin_aide_transport === true,
    creneau_prefere: corps.creneau_prefere ? String(corps.creneau_prefere).trim() : null,
    commentaire: corps.commentaire ? String(corps.commentaire).trim() : null
  });

  journaliser(requete.utilisateur.id_utilisateur, 'Enregistrement d’une fiche de disponibilité', `Alerte ${idAlerte}`);
  return reponse.json({ message: 'Disponibilité enregistrée.' });
}

module.exports = {
  monProfil, mesTelephones, mesDons, modifierProfil, changerQuestion,
  ajouterTelephone, retirerTelephone, remplacerPrincipal, desactiver, rappelAgenda,
  deverrouiller, enregistrerAbonnementPush, retirerAbonnementPush,
  mesAlertes, detailAlerte, repondreAlerte, enregistrerDisponibiliteCtrl, codeDonneur
};
