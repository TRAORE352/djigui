// =====================================================================
//  DJIGUI — espace d'administration. Écrans E27 à E32.
//  L'administrateur gère les accès, jamais le sang : aucune route ici
//  ne touche aux donneurs, aux poches ni aux appels (règle RG43).
// =====================================================================
const bcrypt = require('bcryptjs');
const utilisateurs = require('../requetes/utilisateurs');
const zones = require('../requetes/zones');
const structures = require('../requetes/structures');
const parametres = require('../requetes/parametres');
const { journaliser, listerJournal } = require('../requetes/journal');
const { engendrerProvisoire } = require('../regles/motdepasse');
// Reprise du seul format d'affichage (aucun accès aux données du
// donneur) : E31 ne doit jamais montrer un numéro de téléphone comme
// auteur, seulement le code D-XXXX déjà utilisé sur sa carte (E5).
const { codeDonneur } = require('./donneurs.controleur');

/* ---------------- Accueil de l'administration ----------------------- */
//  GET /api/administration/etat — les quatre nombres et les points
//  d'attention de l'écran d'accueil. Aucune nouvelle requête SQL :
//  tout vient des lectures déjà écrites pour E28, E29 et E31.

function ilYASeptJours() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

async function etat(requete, reponse) {
  const [comptesListe, structuresListe, zonesListe, journalRecent] = await Promise.all([
    utilisateurs.listerComptesProfessionnels(),
    structures.listerStructures(),
    zones.listerZones(),
    listerJournal({ depuis: ilYASeptJours(), limite: 1 })
  ]);

  const comptesActifs = comptesListe.filter((c) => c.statut === 'actif');
  const administrateursActifs = comptesActifs.filter((c) => c.role === 'admin');
  const inutilises = comptesActifs.filter((c) => c.jours_sans_connexion > 60);
  const maintenant = new Date();
  const provisoiresExpires = comptesActifs.filter((c) => (
    c.doit_changer_mot_de_passe && c.provisoire_expire_le
    && new Date(c.provisoire_expire_le) < maintenant
  ));
  const nomComplet = (c) => `${c.prenom} ${c.nom}`;

  // Chaque point d'attention porte une clé stable : c'est elle que
  // l'écran utilise pour choisir le lien qui permet d'y remédier,
  // jamais une adresse écrite ici (ce service ignore les routes du
  // frontend).
  const attentions = [];
  if (administrateursActifs.length === 1) {
    attentions.push({
      cle: 'administrateur_unique',
      texte: 'Un seul compte administrateur est actif. Le cahier des charges en prévoit '
        + 'deux. Si l’accès à ce compte est perdu, plus personne ne peut ouvrir '
        + 'l’administration.'
    });
  }
  if (zonesListe.length === 0) {
    attentions.push({
      cle: 'aucune_zone',
      texte: 'Personne ne peut s’inscrire comme donneur tant qu’aucune zone n’existe.'
    });
  }
  if (structuresListe.length === 0) {
    attentions.push({
      cle: 'aucune_structure',
      texte: 'Aucun compte gestionnaire ne peut être créé sans structure de rattachement.'
    });
  }
  if (inutilises.length > 0) {
    attentions.push({
      cle: 'comptes_inutilises',
      texte: `Inutilisé${inutilises.length > 1 ? 's' : ''} depuis plus de soixante jours : `
        + `${inutilises.map(nomComplet).join(', ')}.`
    });
  }
  if (provisoiresExpires.length > 0) {
    attentions.push({
      cle: 'provisoires_expires',
      texte: `Mot de passe provisoire expiré : ${provisoiresExpires.map(nomComplet).join(', ')}.`
    });
  }

  return reponse.json({
    comptes_actifs: comptesActifs.length,
    structures: structuresListe.length,
    zones: zonesListe.length,
    journal_sept_jours: journalRecent.total,
    attentions
  });
}

/* ---------------- E27 et E28 : comptes professionnels -------------- */

// Identifiant proposé : première lettre du prénom, point, nom.
function proposerIdentifiant(prenom, nom) {
  const nettoyer = (texte) => String(texte || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
  const p = nettoyer(prenom);
  const n = nettoyer(nom);
  return p && n ? `${p[0]}.${n}` : '';
}

async function comptes(requete, reponse) {
  return reponse.json({ comptes: await utilisateurs.listerComptesProfessionnels() });
}

async function identifiantPropose(requete, reponse) {
  const base = proposerIdentifiant(requete.query.prenom, requete.query.nom);
  if (!base) return reponse.json({ identifiant: '' });
  let candidat = base;
  let suffixe = 1;
  // On ne propose jamais un identifiant déjà pris.
  while (await utilisateurs.trouverParIdentifiant(candidat)) {
    suffixe += 1;
    candidat = `${base}${suffixe}`;
  }
  return reponse.json({ identifiant: candidat });
}

// POST /api/administration/comptes — écran E27.
// Le mot de passe provisoire n'est renvoyé qu'ici, une seule fois.
async function creerCompte(requete, reponse) {
  const corps = requete.body || {};
  const nom = String(corps.nom || '').trim();
  const prenom = String(corps.prenom || '').trim();
  const identifiant = String(corps.identifiant || '').trim().toLowerCase();
  const role = corps.role === 'admin' ? 'admin' : 'gestionnaire';

  if (!nom || !prenom) {
    return reponse.status(400).json({ erreur: 'Écrivez le nom et le prénom de l\u2019agent.' });
  }
  if (!/^[a-z0-9._-]{3,}$/.test(identifiant)) {
    return reponse.status(400).json({
      erreur: 'L\u2019identifiant s\u2019écrit en minuscules, sans espace, trois caractères au moins.',
      champ: 'identifiant'
    });
  }

  // Un gestionnaire est rattaché à une seule structure (règle RG41).
  let idStructure = null;
  if (role === 'gestionnaire') {
    idStructure = Number(corps.id_structure);
    if (!idStructure || !(await structures.trouverStructure(idStructure))) {
      return reponse.status(400).json({
        erreur: 'Choisissez la structure de rattachement. Si elle n\u2019existe pas encore, créez-la dans Structures et zones.',
        champ: 'id_structure'
      });
    }
  } else if (corps.id_structure) {
    idStructure = Number(corps.id_structure) || null;
  }

  const valeurs = await parametres.lireParametres();
  const provisoire = engendrerProvisoire();
  const condensat = await bcrypt.hash(provisoire, 10);

  try {
    const { pool } = require('../db');
    const [resultat] = await pool.query(
      `INSERT INTO utilisateur
         (identifiant, mot_de_passe, role, nom, prenom, fonction, id_structure,
          doit_changer_mot_de_passe, provisoire_expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
      [identifiant, condensat, role, nom, prenom,
       String(corps.fonction || '').trim() || null, idStructure,
       valeurs.validite_provisoire_heures]);

    journaliser(requete.utilisateur.id_utilisateur,
      role === 'admin' ? 'Création d\u2019un compte administrateur' : 'Création d\u2019un compte gestionnaire',
      identifiant);

    const structure = idStructure ? await structures.trouverStructure(idStructure) : null;
    return reponse.status(201).json({
      id_utilisateur: resultat.insertId,
      identifiant,
      nom, prenom, role,
      structure_nom: structure ? structure.nom : null,
      mot_de_passe_provisoire: provisoire,     // visible une seule fois
      validite_heures: valeurs.validite_provisoire_heures
    });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') {
      return reponse.status(409).json({
        erreur: 'Cet identifiant est déjà utilisé. Choisissez-en un autre.', champ: 'identifiant'
      });
    }
    throw erreur;
  }
}

// POST /api/administration/comptes/:id/provisoire-remis — E27 bis.
async function accuserRemise(requete, reponse) {
  const id = Number(requete.params.id);
  const compte = await utilisateurs.trouverParId(id);
  if (!compte) return reponse.status(404).json({ erreur: 'Ce compte n\u2019existe pas.' });
  await utilisateurs.marquerProvisoireAffiche(id);
  journaliser(requete.utilisateur.id_utilisateur,
    'Remise du mot de passe provisoire', compte.identifiant, 'reussie');
  return reponse.json({ message: 'Remise enregistrée.' });
}

// POST /api/administration/comptes/:id/reinitialiser — E28.
async function reinitialiser(requete, reponse) {
  const id = Number(requete.params.id);
  const compte = await utilisateurs.trouverParId(id);
  if (!compte || compte.role === 'donneur') {
    return reponse.status(404).json({ erreur: 'Ce compte n\u2019existe pas.' });
  }
  const valeurs = await parametres.lireParametres();
  const provisoire = engendrerProvisoire();
  await utilisateurs.poserProvisoire(
    id, await bcrypt.hash(provisoire, 10), valeurs.validite_provisoire_heures);
  journaliser(requete.utilisateur.id_utilisateur,
    'Réinitialisation d\u2019un mot de passe', compte.identifiant);
  return reponse.json({
    identifiant: compte.identifiant,
    nom: compte.nom, prenom: compte.prenom,
    mot_de_passe_provisoire: provisoire,
    validite_heures: valeurs.validite_provisoire_heures
  });
}

// PUT /api/administration/comptes/:id/statut — E28 bis.
// Deux garde-fous : on ne se désactive pas soi-même (RG44), et on ne
// désactive pas le dernier administrateur actif (RG45).
async function changerStatutCompte(requete, reponse) {
  const id = Number(requete.params.id);
  const statut = requete.body?.statut === 'actif' ? 'actif' : 'desactive';
  const compte = await utilisateurs.trouverParId(id);
  if (!compte || compte.role === 'donneur') {
    return reponse.status(404).json({ erreur: 'Ce compte n\u2019existe pas.' });
  }

  if (statut === 'desactive') {
    if (id === requete.utilisateur.id_utilisateur) {
      journaliser(requete.utilisateur.id_utilisateur,
        'Tentative de désactivation de son propre compte', compte.identifiant, 'refusee');
      return reponse.status(400).json({
        erreur: 'Vous ne pouvez pas désactiver votre propre compte. Demandez à l\u2019autre administrateur de le faire à votre place.',
        code: 'propre_compte'
      });
    }
    if (compte.role === 'admin') {
      const restants = await utilisateurs.compterAdministrateursActifsSauf(id);
      if (restants === 0) {
        journaliser(requete.utilisateur.id_utilisateur,
          'Tentative de désactivation du dernier administrateur', compte.identifiant, 'refusee');
        return reponse.status(400).json({
          erreur: `${compte.prenom} ${compte.nom} est le dernier compte administrateur actif. Le désactiver fermerait l\u2019accès à l\u2019administration pour tout le monde. Créez d\u2019abord un autre compte administrateur, connectez-vous une fois avec lui, puis reprenez cette désactivation.`,
          code: 'dernier_administrateur'
        });
      }
    }
  }

  await utilisateurs.changerStatut(id, statut);
  journaliser(requete.utilisateur.id_utilisateur,
    statut === 'actif' ? 'Réactivation d\u2019un compte' : 'Désactivation d\u2019un compte',
    compte.identifiant);
  return reponse.json({
    message: statut === 'actif'
      ? `Le compte de ${compte.prenom} ${compte.nom} est réactivé.`
      : `Le compte de ${compte.prenom} ${compte.nom} est désactivé.`
  });
}

/* ---------------- E29 : structures et zones ------------------------ */

async function listerReferentiels(requete, reponse) {
  return reponse.json({
    structures: await structures.listerStructures(),
    zones: await zones.listerZones(),
    types: structures.TYPES_LISIBLES
  });
}

async function creerStructure(requete, reponse) {
  const corps = requete.body || {};
  const types = ['crts', 'depot', 'banque_hopital'];
  if (!String(corps.nom || '').trim()) {
    return reponse.status(400).json({ erreur: 'Écrivez le nom de la structure.', champ: 'nom' });
  }
  if (!String(corps.ville || '').trim()) {
    return reponse.status(400).json({ erreur: 'Écrivez la ville.', champ: 'ville' });
  }
  if (!types.includes(corps.type)) {
    return reponse.status(400).json({ erreur: 'Choisissez le type de structure.', champ: 'type' });
  }
  const idStructure = await structures.creerStructureAvecSeuils({
    nom: String(corps.nom).trim(), type: corps.type, ville: String(corps.ville).trim(),
    adresse: corps.adresse, telephone: corps.telephone, horaires: corps.horaires
  });
  journaliser(requete.utilisateur.id_utilisateur, 'Création d\u2019une structure', corps.nom);
  return reponse.status(201).json({ id_structure: idStructure });
}

async function modifierStructure(requete, reponse) {
  const id = Number(requete.params.id);
  if (!(await structures.trouverStructure(id))) {
    return reponse.status(404).json({ erreur: 'Cette structure n\u2019existe pas.' });
  }
  const corps = requete.body || {};
  await structures.modifierStructure(id, corps);
  journaliser(requete.utilisateur.id_utilisateur, 'Modification d\u2019une structure', corps.nom);
  return reponse.json({ message: 'Enregistré.' });
}

// Règle de dépendance annoncée avant l'erreur (écran E29).
async function supprimerStructure(requete, reponse) {
  const id = Number(requete.params.id);
  const structure = await structures.trouverStructure(id);
  if (!structure) return reponse.status(404).json({ erreur: 'Cette structure n\u2019existe pas.' });
  const rattaches = await structures.compterComptesDeStructure(id);
  if (rattaches > 0) {
    journaliser(requete.utilisateur.id_utilisateur,
      'Tentative de retrait d\u2019une structure rattachée', structure.nom, 'refusee');
    return reponse.status(400).json({
      erreur: `${structure.nom} ne peut pas être retirée : ${rattaches} compte${rattaches > 1 ? 's y sont rattachés' : ' y est rattaché'}. Désactivez-les d\u2019abord.`
    });
  }
  await structures.supprimerStructure(id);
  journaliser(requete.utilisateur.id_utilisateur, 'Retrait d\u2019une structure', structure.nom);
  return reponse.json({ message: 'Structure retirée.' });
}

async function creerZone(requete, reponse) {
  const nom = String(requete.body?.nom || '').trim();
  const ville = String(requete.body?.ville || '').trim();
  if (!nom) return reponse.status(400).json({ erreur: 'Écrivez le nom de la zone.', champ: 'nom' });
  if (!ville) return reponse.status(400).json({ erreur: 'Écrivez la ville.', champ: 'ville' });
  try {
    const idZone = await zones.creerZone(nom, ville);
    journaliser(requete.utilisateur.id_utilisateur, 'Création d\u2019une zone', `${nom} (${ville})`);
    return reponse.status(201).json({ id_zone: idZone });
  } catch (erreur) {
    if (erreur.code === 'ER_DUP_ENTRY') {
      return reponse.status(409).json({ erreur: 'Cette zone existe déjà dans cette ville.', champ: 'nom' });
    }
    throw erreur;
  }
}

async function modifierZone(requete, reponse) {
  const id = Number(requete.params.id);
  const nom = String(requete.body?.nom || '').trim();
  const ville = String(requete.body?.ville || '').trim();
  if (!nom || !ville) {
    return reponse.status(400).json({ erreur: 'Écrivez le nom de la zone et sa ville.' });
  }
  await zones.modifierZone(id, nom, ville);
  journaliser(requete.utilisateur.id_utilisateur, 'Modification d\u2019une zone', `${nom} (${ville})`);
  return reponse.json({ message: 'Enregistré.' });
}

async function supprimerZone(requete, reponse) {
  const id = Number(requete.params.id);
  const habitants = await zones.compterDonneursDeZone(id);
  if (habitants > 0) {
    journaliser(requete.utilisateur.id_utilisateur,
      'Tentative de retrait d\u2019une zone habitée', String(id), 'refusee');
    return reponse.status(400).json({
      erreur: `Cette zone ne peut pas être retirée : ${habitants} donneur${habitants > 1 ? 's y habitent' : ' y habite'}.`
    });
  }
  await zones.supprimerZone(id);
  journaliser(requete.utilisateur.id_utilisateur, 'Retrait d\u2019une zone', String(id));
  return reponse.json({ message: 'Zone retirée.' });
}

/* ---------------- E30 : paramètres --------------------------------- */

async function listerParametres(requete, reponse) {
  return reponse.json({ parametres: await parametres.listerParametresDetailles() });
}

// Bornes de sécurité : un paramètre hors bornes est refusé avec sa raison.
const BORNES = {
  age_min: [16, 30], age_max: [50, 80], poids_min: [40, 70],
  delai_homme_mois: [1, 12], delai_femme_mois: [1, 12],
  max_dons_homme_an: [1, 8], max_dons_femme_an: [1, 8],
  duree_conservation_jours: [7, 400], alerte_peremption_jours: [1, 30],
  nb_telephones_max: [1, 6], recup_tentatives_heure: [1, 10],
  mdp_longueur_min: [8, 32], mdp_donneur_longueur_min: [6, 32],
  echecs_avant_verrou: [3, 10], duree_verrou_minutes: [5, 120],
  session_inactivite_minutes: [5, 240], validite_provisoire_heures: [1, 168]
};

async function modifierParametres(requete, reponse) {
  const modifications = requete.body?.modifications || [];
  if (!Array.isArray(modifications) || modifications.length === 0) {
    return reponse.status(400).json({ erreur: 'Aucune valeur à enregistrer.' });
  }
  const actuels = await parametres.listerParametresDetailles();
  const parCle = new Map(actuels.map((ligne) => [ligne.cle, ligne]));
  const appliquees = [];

  for (const modification of modifications) {
    const ligne = parCle.get(modification.cle);
    if (!ligne) {
      return reponse.status(400).json({ erreur: `Le réglage ${modification.cle} n\u2019existe pas.` });
    }
    const valeur = Number(modification.valeur);
    const bornes = BORNES[modification.cle];
    if (!Number.isFinite(valeur) || (bornes && (valeur < bornes[0] || valeur > bornes[1]))) {
      journaliser(requete.utilisateur.id_utilisateur,
        'Modification d\u2019un paramètre', ligne.libelle, 'refusee');
      return reponse.status(400).json({
        erreur: bornes
          ? `${ligne.libelle} : la valeur doit être comprise entre ${bornes[0]} et ${bornes[1]} ${ligne.unite}.`
          : `${ligne.libelle} : valeur non valable.`,
        cle: modification.cle
      });
    }
    if (String(valeur) !== String(ligne.valeur)) {
      appliquees.push({ cle: ligne.cle, libelle: ligne.libelle,
        ancienne: ligne.valeur, nouvelle: String(valeur), unite: ligne.unite });
    }
  }

  // Cohérence entre le délai de conservation et l'alerte de péremption.
  const valeursFinales = new Map(actuels.map((l) => [l.cle, Number(l.valeur)]));
  for (const appliquee of appliquees) valeursFinales.set(appliquee.cle, Number(appliquee.nouvelle));
  if (valeursFinales.get('alerte_peremption_jours') >= valeursFinales.get('duree_conservation_jours')) {
    return reponse.status(400).json({
      erreur: 'L\u2019alerte avant péremption doit être plus courte que la durée de conservation.',
      cle: 'alerte_peremption_jours'
    });
  }

  for (const appliquee of appliquees) {
    await parametres.modifierParametre(appliquee.cle, appliquee.nouvelle, requete.utilisateur.id_utilisateur);
    journaliser(requete.utilisateur.id_utilisateur, 'Modification d\u2019un paramètre',
      `${appliquee.libelle} : ${appliquee.ancienne} vers ${appliquee.nouvelle} ${appliquee.unite}`);
  }
  return reponse.json({ modifications: appliquees, message: 'Réglages enregistrés.' });
}

/* ---------------- E31 : journal ------------------------------------ */

async function journal(requete, reponse) {
  const resultat = await listerJournal({
    id_utilisateur: requete.query.utilisateur ? Number(requete.query.utilisateur) : null,
    resultat: requete.query.resultat || null,
    type_action: requete.query.type_action || null,
    depuis: requete.query.depuis || null,
    jusqu_a: requete.query.jusqu_a || null,
    limite: requete.query.limite,
    depart: requete.query.depart
  });

  // L'auteur d'un donneur ne sort jamais en clair (son identifiant est
  // un numéro de téléphone) : seul son code D-XXXX est montré, comme
  // sur sa propre carte (E5). L'administrateur n'a par ailleurs aucun
  // accès au registre des donneurs pour retrouver qui se cache derrière.
  const lignes = resultat.lignes.map((ligne) => {
    const auteur = ligne.auteur_role === 'donneur'
      ? `un donneur ${codeDonneur(ligne.auteur_id_donneur, ligne.auteur_ville)}`
      : (ligne.auteur_identifiant || null);
    return {
      id_journal: ligne.id_journal, date_action: ligne.date_action,
      action: ligne.action, cible: ligne.cible, resultat: ligne.resultat, auteur
    };
  });

  return reponse.json({ ...resultat, lignes });
}

module.exports = {
  etat,
  comptes, identifiantPropose, creerCompte, accuserRemise, reinitialiser, changerStatutCompte,
  listerReferentiels, creerStructure, modifierStructure, supprimerStructure,
  creerZone, modifierZone, supprimerZone,
  listerParametres, modifierParametres, journal
};
