// =====================================================================
//  DJIGUI — espace de gestion.
//  E16 (tableau de bord), E17 (détail d'un groupe), E25 (seuils),
//  E21 (enregistrer un don), E22 (registre des poches),
//  E23 (rechercher une poche), E27 gestion (changer la situation).
//  Règle RG41 : un gestionnaire ne voit que sa propre structure. L'id
//  vient toujours de la session, jamais du corps ni de l'URL.
// =====================================================================
const poches = require('../requetes/poches');
const seuils = require('../requetes/seuils');
const dons = require('../requetes/dons');
const donneurs = require('../requetes/donneurs');
const registreDonneurs = require('../requetes/registre-donneurs');
const statistiques = require('../requetes/statistiques');
const alertes = require('../requetes/alertes');
const telephones = require('../requetes/telephones');
const zones = require('../requetes/zones');
const { lireParametres } = require('../requetes/parametres');
const { journaliser, journaliserConsultation } = require('../requetes/journal');
const { ORDRE_AFFICHAGE, GROUPES } = require('../regles/compatibilite');

// Trois façons de cibler un appel (correctif 3) : un groupe précis,
// une ou plusieurs zones sans distinction de groupe, ou tout le monde.
// Un donneur sans groupe renseigné ne peut recevoir que les deux
// derniers : voir le commentaire de baseCiblage (requetes/alertes.js).
const MODES_CIBLAGE = ['groupe', 'zone', 'tous'];
const { evaluerEligibilite } = require('../regles/eligibilite');

const ERREUR_SANS_STRUCTURE =
  'Votre compte n’est rattaché à aucune structure. Demandez à l’administrateur du centre de le corriger.';

function idStructureDe(requete) {
  return requete.utilisateur.id_structure || null;
}

function phraseSynthese(listePoches) {
  const disponibles = listePoches.filter((poche) => poche.statut === 'disponible');
  if (disponibles.length === 0) {
    return 'Aucune poche n’est réellement disponible pour ce groupe actuellement.';
  }
  if (disponibles.length === 1) {
    return 'Une seule poche est réellement disponible pour une demande urgente.';
  }
  return `${disponibles.length} poches sont réellement disponibles pour ce groupe.`;
}

// GET /api/gestion/tableau-de-bord — E16.
async function tableauDeBord(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAgent = requete.utilisateur.id_utilisateur;

  const valeurs = await lireParametres();
  const stock = await poches.stockParGroupe(idStructure, idAgent);
  const prochesPeremption = await poches.prochesPeremption(idStructure, valeurs.alerte_peremption_jours, idAgent);
  const nbCritiques = stock.filter((ligne) => ligne.niveau === 'critique').length;
  const dernierMouvement = stock.reduce((plusRecent, ligne) => {
    if (!ligne.dernier_mouvement) return plusRecent;
    if (!plusRecent || ligne.dernier_mouvement > plusRecent) return ligne.dernier_mouvement;
    return plusRecent;
  }, null);

  return reponse.json({
    stock,
    proches_peremption: prochesPeremption,
    nb_critiques: nbCritiques,
    dernier_mouvement: dernierMouvement,
    alerte_peremption_jours: valeurs.alerte_peremption_jours,
    duree_conservation_jours: valeurs.duree_conservation_jours,
    delai_homme_mois: valeurs.delai_homme_mois,
    delai_femme_mois: valeurs.delai_femme_mois
  });
}

// GET /api/gestion/groupes/:groupe — E17.
async function detailGroupe(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAgent = requete.utilisateur.id_utilisateur;

  const groupe = requete.params.groupe;
  if (!ORDRE_AFFICHAGE.includes(groupe)) {
    return reponse.status(404).json({ erreur: 'Ce groupe sanguin n’existe pas.' });
  }

  const stock = await poches.stockParGroupe(idStructure, idAgent);
  const ligneStock = stock.find((ligne) => ligne.groupe_sanguin === groupe);
  const pochesDuGroupe = await poches.detailGroupe(idStructure, groupe, idAgent);

  return reponse.json({
    stock: ligneStock,
    poches: pochesDuGroupe,
    phrase: phraseSynthese(pochesDuGroupe)
  });
}

// GET /api/gestion/seuils — E25.
async function listerSeuils(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  return reponse.json({ seuils: await seuils.listerSeuils(idStructure, requete.utilisateur.id_utilisateur) });
}

// PUT /api/gestion/seuils — E25.
async function modifierSeuils(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const liste = requete.body?.seuils;
  if (!Array.isArray(liste) || liste.length === 0) {
    return reponse.status(400).json({ erreur: 'Aucun réglage à enregistrer.' });
  }

  try {
    await seuils.modifierSeuils(idStructure, liste, requete.utilisateur.id_utilisateur);
  } catch (erreur) {
    journaliser(requete.utilisateur.id_utilisateur, 'Modification des seuils de stock', null, 'refusee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(requete.utilisateur.id_utilisateur, 'Modification des seuils de stock', null, 'reussie');
  return reponse.json({
    seuils: await seuils.listerSeuils(idStructure, requete.utilisateur.id_utilisateur),
    message: 'Seuils enregistrés.'
  });
}

/* ==================== E21 : enregistrer un don ====================== */

// GET /api/gestion/donneurs/recherche?q= — un seul champ, nom ou numéro.
async function rechercherDonneur(requete, reponse) {
  const texte = String(requete.query.q || '').trim();
  if (texte.length < 2) return reponse.json({ resultats: [] });

  const resultats = await dons.rechercherDonneurPourDon(texte);
  const avecEligibilite = [];
  for (const donneur of resultats) {
    const nbDonsDouzeMois = await donneurs.compterDonsDouzeMois(donneur.id_donneur);
    const eligibilite = await evaluerEligibilite(donneur, nbDonsDouzeMois);
    avecEligibilite.push({ ...donneur, eligibilite });
  }

  journaliser(requete.utilisateur.id_utilisateur, 'Recherche d’un donneur pour un don', texte);
  return reponse.json({ resultats: avecEligibilite });
}

// POST /api/gestion/dons — E21.
// Règle RG6 : la décision de prélever appartient au personnel médical.
// La plateforme avertit et garde la trace, elle n'interdit pas : un
// donneur non éligible peut être enregistré si le médecin l'autorise,
// à condition d'écrire pourquoi.
async function enregistrerDon(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const corps = requete.body || {};
  const idDonneur = Number(corps.id_donneur);
  if (!idDonneur) {
    return reponse.status(400).json({ erreur: 'Choisissez le donneur avant d’enregistrer le don.' });
  }
  const dateDon = String(corps.date_don || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDon)) {
    return reponse.status(400).json({ erreur: 'La date du don est incomplète.', champ: 'date_don' });
  }
  const aujourdHui = new Date().toISOString().slice(0, 10);
  if (dateDon > aujourdHui) {
    return reponse.status(400).json({ erreur: 'La date du don ne peut pas être dans le futur.', champ: 'date_don' });
  }
  const heureDon = corps.heure_don ? String(corps.heure_don) : null;
  const poste = corps.poste ? String(corps.poste).trim() : null;

  const donneur = await donneurs.trouverParId(idDonneur);
  if (!donneur) {
    return reponse.status(404).json({ erreur: 'Ce donneur n’existe pas.' });
  }
  if (!donneur.groupe_sanguin) {
    return reponse.status(400).json({
      erreur: 'Le groupe sanguin de ce donneur n’est pas encore connu. Il doit être précisé au centre avant d’enregistrer un don.'
    });
  }

  const nbDonsDouzeMois = await donneurs.compterDonsDouzeMois(idDonneur);
  const eligibilite = await evaluerEligibilite(donneur, nbDonsDouzeMois);
  const autorisationMedicale = corps.autorisation_medicale === true;

  if (!eligibilite.eligible && !autorisationMedicale) {
    journaliser(requete.utilisateur.id_utilisateur,
      'Tentative d’enregistrement d’un don pour un donneur non éligible',
      `${donneur.prenom} ${donneur.nom}`, 'refusee');
    return reponse.status(400).json({
      erreur: 'Ce donneur n’est pas encore éligible. Un médecin du centre peut autoriser le don malgré tout, en écrivant le motif.',
      eligibilite
    });
  }

  let motifAutorisation = null;
  if (!eligibilite.eligible && autorisationMedicale) {
    motifAutorisation = String(corps.motif_autorisation || '').trim();
    if (motifAutorisation.length < 5) {
      return reponse.status(400).json({
        erreur: 'Écrivez le motif de l’autorisation médicale.', champ: 'motif_autorisation'
      });
    }
  }

  const stockAvant = await poches.stockParGroupe(idStructure, requete.utilisateur.id_utilisateur);
  const ligneAvant = stockAvant.find((ligne) => ligne.groupe_sanguin === donneur.groupe_sanguin);

  let resultat;
  try {
    resultat = await dons.enregistrerDon({
      idDonneur, idStructure,
      idAlerte: corps.id_alerte ? Number(corps.id_alerte) : null,
      dateDon, heureDon,
      idAgent: requete.utilisateur.id_utilisateur,
      poste
    });
  } catch (erreur) {
    journaliser(requete.utilisateur.id_utilisateur, 'Enregistrement d’un don',
      `${donneur.prenom} ${donneur.nom}`, 'echouee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(requete.utilisateur.id_utilisateur,
    motifAutorisation
      ? 'Don enregistré avec autorisation médicale (donneur non éligible)'
      : 'Enregistrement d’un don',
    motifAutorisation
      ? `${donneur.prenom} ${donneur.nom}, poche ${resultat.code_poche}, motif : ${motifAutorisation}`
      : `${donneur.prenom} ${donneur.nom}, poche ${resultat.code_poche}`,
    'reussie');

  const niveauAvant = ligneAvant.niveau;
  const stockApresProjection = ligneAvant.poches_disponibles + 1;
  const niveauApresProjection = poches.niveauDe(
    stockApresProjection, ligneAvant.seuil_bas, ligneAvant.seuil_critique);

  return reponse.status(201).json({
    ...resultat,
    donneur: { id_donneur: donneur.id_donneur, nom: donneur.nom, prenom: donneur.prenom },
    stock_avant: ligneAvant.poches_disponibles,
    stock_apres_projection: stockApresProjection,
    seuil_bas: ligneAvant.seuil_bas,
    seuil_critique: ligneAvant.seuil_critique,
    niveau_avant: niveauAvant,
    niveau_apres_projection: niveauApresProjection
  });
}

/* ==================== E22 : registre des poches ====================== */

// GET /api/gestion/poches?situation=&groupe=&limite=&depart=
async function listerPoches(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const resultat = await poches.listerPoches(idStructure, {
    situation: requete.query.situation || null,
    groupe: requete.query.groupe || null,
    limite: requete.query.limite,
    depart: requete.query.depart
  }, requete.utilisateur.id_utilisateur);
  return reponse.json(resultat);
}

/* ============ E23 / E27 gestion : une poche par son code ============= */

// GET /api/gestion/poches/:code
async function detailPoche(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const code = String(requete.params.code || '').trim().toUpperCase();
  const poche = await poches.trouverParCode(code, idStructure, requete.utilisateur.id_utilisateur);
  if (!poche) {
    return reponse.status(404).json({
      erreur: 'Ce code n’existe pas dans votre structure.',
      codes_proches: await poches.codesProches(code, idStructure)
    });
  }
  return reponse.json({ poche });
}

// PUT /api/gestion/poches/:code/situation — E27 gestion.
async function changerSituationPoche(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const code = String(requete.params.code || '').trim().toUpperCase();
  const idAgent = requete.utilisateur.id_utilisateur;
  const poche = await poches.trouverParCode(code, idStructure, idAgent);
  if (!poche) {
    return reponse.status(404).json({ erreur: 'Ce code n’existe pas dans votre structure.' });
  }

  const nouveauStatut = requete.body?.nouveau_statut;
  const precision = String(requete.body?.precision || '').trim();
  const poste = requete.body?.poste ? String(requete.body.poste).trim() : null;

  if (nouveauStatut === 'detruite' && precision.length < 3) {
    return reponse.status(400).json({ erreur: 'Écrivez la raison de la destruction.', champ: 'precision' });
  }

  try {
    await poches.changerSituation(poche.id_poche, nouveauStatut, precision || null, idAgent, poste);
  } catch (erreur) {
    journaliser(idAgent, 'Tentative de changement de situation d’une poche', code, 'refusee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(idAgent, 'Changement de situation d’une poche',
    `${code} : ${poche.statut} vers ${nouveauStatut}`, 'reussie');

  return reponse.json({
    message: 'Situation enregistrée.',
    poche: await poches.trouverParCode(code, idStructure, idAgent)
  });
}

/* ==================== E24 : registre des donneurs =================== */
//  RG41 ne s'applique pas ici : un donneur n'appartient à aucune
//  structure, un gestionnaire voit tout le bassin. `idStructure` reste
//  vérifié (le compte doit être rattaché) mais ne filtre pas la liste.

function filtresDonneursDepuisRequete(requete) {
  const q = requete.query || {};
  return {
    texte: q.texte || '',
    groupes: q.groupes ? String(q.groupes).split(',').filter(Boolean) : [],
    zones: q.zones ? String(q.zones).split(',').map(Number).filter(Boolean) : [],
    eligibilite: q.eligibilite === 'aujourd_hui' ? 'aujourd_hui' : 'tous',
    joignabilite: ['confirme', 'a_verifier'].includes(q.joignabilite) ? q.joignabilite : 'tous',
    sans_don_depuis_un_an: q.sans_don_depuis_un_an === '1' || q.sans_don_depuis_un_an === 'true',
    limite: q.limite, depart: q.depart
  };
}

const LIBELLE_GROUPE = {
  'O+': 'O positif', 'O-': 'O négatif', 'A+': 'A positif', 'A-': 'A négatif',
  'B+': 'B positif', 'B-': 'B négatif', 'AB+': 'AB positif', 'AB-': 'AB négatif'
};

// Cible journalisée pour une consultation du registre des donneurs :
// une phrase en français qui ne décrit QUE les filtres réellement
// posés (contrainte U3, aucun mot technique à l'écran). La pagination
// (limite, depart) n'est pas un filtre : elle ne s'y trouve jamais.
// Aucun filtre posé → chaîne vide, donc cible nulle au journal.
function phraseFiltresDonneurs(filtres, nomsZones) {
  const morceaux = [];
  if (filtres.texte) morceaux.push('recherche par nom');
  if (filtres.groupes.length === 1) {
    morceaux.push(`groupe ${LIBELLE_GROUPE[filtres.groupes[0]] || filtres.groupes[0]}`);
  } else if (filtres.groupes.length > 1) {
    morceaux.push(`groupes ${filtres.groupes.map((g) => LIBELLE_GROUPE[g] || g).join(' ou ')}`);
  }
  if (nomsZones.length === 1) {
    morceaux.push(`zone ${nomsZones[0]}`);
  } else if (nomsZones.length > 1) {
    morceaux.push(`zones ${nomsZones.join(', ')}`);
  }
  if (filtres.eligibilite === 'aujourd_hui') morceaux.push('peuvent donner aujourd’hui');
  if (filtres.joignabilite === 'confirme') morceaux.push('numéro confirmé');
  if (filtres.joignabilite === 'a_verifier') morceaux.push('numéro à vérifier');
  if (filtres.sans_don_depuis_un_an) morceaux.push('sans don depuis un an');
  return morceaux.join(', ');
}

// GET /api/gestion/donneurs — E24.
async function listerDonneurs(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const filtres = filtresDonneursDepuisRequete(requete);
  const resultat = await registreDonneurs.chercherDonneurs(idStructure, filtres);

  let nomsZones = [];
  if (filtres.zones.length > 0) {
    const toutesZones = await zones.listerZones();
    nomsZones = filtres.zones
      .map((id) => toutesZones.find((zone) => zone.id_zone === id)?.nom)
      .filter(Boolean);
  }

  // Une seule ligne par agent toutes les quinze minutes : ouvrir
  // l'écran puis affiner les filtres reste le même geste de
  // consultation. Le résumé (resumerDonneurs) n'est jamais journalisé
  // séparément : c'est la même consultation que la liste.
  journaliserConsultation(requete.utilisateur.id_utilisateur, 'Consultation du registre des donneurs',
    phraseFiltresDonneurs(filtres, nomsZones));

  return reponse.json(resultat);
}

// GET /api/gestion/donneurs/resume — E24. Mêmes filtres que la liste :
// c'est le vivier réel, pas le registre entier.
async function resumerDonneurs(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const filtres = filtresDonneursDepuisRequete(requete);
  return reponse.json(await registreDonneurs.resumerListe(idStructure, filtres));
}

// GET /api/gestion/donneurs/:id — fiche complète, lecture seule.
async function ficheDonneur(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const idDonneur = Number(requete.params.id);
  const fiche = await registreDonneurs.ficheDonneur(idDonneur, idStructure);
  if (!fiche) return reponse.status(404).json({ erreur: 'Ce donneur n’existe pas.' });

  const nbDonsDouzeMois = await donneurs.compterDonsDouzeMois(idDonneur);
  const eligibilite = await evaluerEligibilite(fiche, nbDonsDouzeMois);

  journaliser(requete.utilisateur.id_utilisateur, 'Consultation de la fiche d’un donneur',
    `${fiche.prenom} ${fiche.nom}`);

  return reponse.json({ ...fiche, eligibilite });
}

/* ======================= E26 : statistiques ========================== */
//  Aucun nom de donneur ne sort d'ici : que des nombres.

// GET /api/gestion/statistiques?depuis=&jusqu_a=
async function statistiquesCentre(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const debut = String(requete.query.depuis || '');
  const fin = String(requete.query.jusqu_a || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
    return reponse.status(400).json({ erreur: 'La période est incomplète.' });
  }
  if (debut > fin) {
    return reponse.status(400).json({ erreur: 'La date de début doit précéder la date de fin.' });
  }

  // Bascule les poches périmées avant de les compter : la péremption ne
  // dépend d'aucune tâche planifiée (RG16), et sert aussi à colorer la
  // barre du groupe au niveau critique.
  const stock = await poches.stockParGroupe(idStructure, requete.utilisateur.id_utilisateur);

  const [totaux, parGroupe, appels, transport] = await Promise.all([
    statistiques.totauxPeriode(idStructure, debut, fin),
    statistiques.donsParGroupe(idStructure, debut, fin),
    statistiques.rendementAppels(idStructure, debut, fin),
    statistiques.aideTransport(idStructure, debut, fin)
  ]);

  return reponse.json({
    totaux, dons_par_groupe: parGroupe, rendement_appels: appels, aide_transport: transport, stock
  });
}

/* ============ E18, E19, E20 : appels au don ============ */
//  Le ciblage réutilise le moteur écrit pour E24 (requetes/alertes.js
//  délègue à registre-donneurs.js). RG41 s'applique pleinement ici :
//  un appel appartient à une structure comme un don ou une poche.

// GET /api/gestion/alertes/cibles?groupe=&elargir=&zones= — compteur
// permanent de E18.
async function cibleAlerte(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });

  const mode = MODES_CIBLAGE.includes(requete.query.mode) ? requete.query.mode : 'groupe';
  const groupe = requete.query.groupe;
  if (mode === 'groupe' && !GROUPES.includes(groupe)) {
    return reponse.status(400).json({ erreur: 'Choisissez le groupe demandé.' });
  }
  const zones = mode === 'tous' ? [] : (requete.query.zones
    ? String(requete.query.zones).split(',').map(Number).filter(Boolean) : []);
  if (mode === 'zone' && zones.length === 0) {
    return reponse.status(400).json({ erreur: 'Cochez au moins une zone.' });
  }
  const elargir = requete.query.elargir === '1' || requete.query.elargir === 'true';

  const [cibles, dernierAppel] = await Promise.all([
    alertes.compterCibles(idStructure, { mode, groupe, elargir_compatibles: elargir, zones }),
    mode === 'groupe' ? alertes.dernierAppelDuGroupe(idStructure, groupe) : Promise.resolve(null)
  ]);

  return reponse.json({ ...cibles, dernier_appel_meme_groupe: dernierAppel });
}

// GET /api/gestion/alertes — index des appels de la structure.
async function listerAlertesCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  return reponse.json({ alertes: await alertes.listerAlertes(idStructure) });
}

// POST /api/gestion/alertes — E18, dépose le brouillon.
async function creerAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const corps = requete.body || {};

  const mode = MODES_CIBLAGE.includes(corps.mode_ciblage) ? corps.mode_ciblage : 'groupe';
  if (mode === 'groupe' && !GROUPES.includes(corps.groupe)) {
    return reponse.status(400).json({ erreur: 'Choisissez le groupe demandé.', champ: 'groupe' });
  }
  const zones = mode === 'tous' ? []
    : (Array.isArray(corps.zones) ? corps.zones.map(Number).filter(Boolean) : []);
  if (mode !== 'tous' && zones.length === 0) {
    return reponse.status(400).json({ erreur: 'Cochez au moins une zone.', champ: 'zones' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corps.date_limite || '')) {
    return reponse.status(400).json({ erreur: 'La date limite est incomplète.', champ: 'date_limite' });
  }
  const message = String(corps.message || '').trim();
  if (message.length < 10) {
    return reponse.status(400).json({ erreur: 'Écrivez le message envoyé aux donneurs.', champ: 'message' });
  }

  const idAlerte = await alertes.creerAlerte({
    idStructure, mode, groupe: mode === 'groupe' ? corps.groupe : null,
    elargirCompatibles: mode === 'groupe' && corps.elargir_compatibles === true,
    zones, message,
    canaux: Array.isArray(corps.canaux) && corps.canaux.length > 0 ? corps.canaux.join(',') : 'application',
    dateLimite: corps.date_limite, heureLimite: corps.heure_limite || null
  }, requete.utilisateur.id_utilisateur);

  journaliser(requete.utilisateur.id_utilisateur, 'Création d’un appel au don (brouillon)',
    mode === 'groupe' ? `Groupe ${corps.groupe}` : mode === 'zone' ? 'Par zone, tous groupes' : 'Tous les donneurs');

  return reponse.status(201).json({ id_alerte: idAlerte });
}

// PUT /api/gestion/alertes/:id — modification tant que brouillon.
async function modifierAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAlerte = Number(requete.params.id);
  const corps = requete.body || {};

  const mode = MODES_CIBLAGE.includes(corps.mode_ciblage) ? corps.mode_ciblage : 'groupe';
  try {
    await alertes.modifierAlerte(idAlerte, idStructure, {
      mode, groupe: mode === 'groupe' ? corps.groupe : null,
      elargirCompatibles: mode === 'groupe' && corps.elargir_compatibles === true,
      zones: mode === 'tous' ? [] : (Array.isArray(corps.zones) ? corps.zones.map(Number).filter(Boolean) : []),
      message: String(corps.message || '').trim(),
      canaux: Array.isArray(corps.canaux) && corps.canaux.length > 0 ? corps.canaux.join(',') : 'application',
      dateLimite: corps.date_limite, heureLimite: corps.heure_limite || null
    });
  } catch (erreur) {
    return reponse.status(400).json({ erreur: erreur.message });
  }
  journaliser(requete.utilisateur.id_utilisateur, 'Modification d’un appel au don (brouillon)',
    `Alerte ${idAlerte}`);
  return reponse.json({ message: 'Enregistré.' });
}

// POST /api/gestion/alertes/:id/envoi — LE MOMENT CRITIQUE.
async function envoyerAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAlerte = Number(requete.params.id);
  const idAgent = requete.utilisateur.id_utilisateur;

  let resultat;
  try {
    resultat = await alertes.envoyerAlerte(idAlerte, idStructure, idAgent);
  } catch (erreur) {
    journaliser(idAgent, 'Tentative d’envoi d’un appel au don', `Alerte ${idAlerte}`, 'refusee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(idAgent, 'Envoi d’un appel au don',
    `Alerte ${idAlerte}, ${resultat.nb_destinataires} destinataire(s)`, 'reussie');

  return reponse.json(resultat);
}

// GET /api/gestion/alertes/:id/suivi — E19.
async function suiviAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const suivi = await alertes.suiviAlerte(Number(requete.params.id), idStructure);
  if (!suivi) return reponse.status(404).json({ erreur: 'Cet appel n’existe pas dans votre structure.' });
  return reponse.json(suivi);
}

// GET /api/gestion/alertes/:id/liste-appel — E20.
async function listeAppelCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAlerte = Number(requete.params.id);
  if (!(await alertes.appartientAStructure(idAlerte, idStructure))) {
    return reponse.status(404).json({ erreur: 'Cet appel n’existe pas dans votre structure.' });
  }
  return reponse.json({ donneurs: await alertes.listeAppel(idAlerte) });
}

// DELETE /api/gestion/alertes/:id — un brouillon seulement. Un appel
// envoyé ne se supprime pas, il se clôture (voir cloturerAlerteCtrl).
async function supprimerAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAlerte = Number(requete.params.id);
  const idAgent = requete.utilisateur.id_utilisateur;

  try {
    await alertes.supprimerAlerte(idAlerte, idStructure);
  } catch (erreur) {
    journaliser(idAgent, 'Tentative de suppression d’un appel au don', `Alerte ${idAlerte}`, 'refusee');
    return reponse.status(400).json({ erreur: erreur.message });
  }

  journaliser(idAgent, 'Suppression d’un appel au don (brouillon)', `Alerte ${idAlerte}`, 'reussie');
  return reponse.json({ message: 'Brouillon supprimé.' });
}

// POST /api/gestion/alertes/:id/cloture
async function cloturerAlerteCtrl(requete, reponse) {
  const idStructure = idStructureDe(requete);
  if (!idStructure) return reponse.status(400).json({ erreur: ERREUR_SANS_STRUCTURE });
  const idAlerte = Number(requete.params.id);
  try {
    await alertes.cloturerAlerte(idAlerte, idStructure);
  } catch (erreur) {
    return reponse.status(400).json({ erreur: erreur.message });
  }
  journaliser(requete.utilisateur.id_utilisateur, 'Clôture d’un appel au don', `Alerte ${idAlerte}`);
  return reponse.json({ message: 'Appel clos.' });
}

// PUT /api/gestion/telephones/:id/joignabilite — E20, règle RG37.
const JOIGNABILITE_DEPUIS_RESULTAT = {
  joint: 'confirme', ne_repond_pas: 'non_verifie', invalide: 'injoignable'
};
async function changerJoignabiliteCtrl(requete, reponse) {
  const statut = JOIGNABILITE_DEPUIS_RESULTAT[requete.body?.resultat];
  if (!statut) return reponse.status(400).json({ erreur: 'Choisissez un résultat d’appel valable.' });

  const idTelephone = Number(requete.params.id);
  const telephone = await telephones.trouverNumero(idTelephone);
  if (!telephone) return reponse.status(404).json({ erreur: 'Ce numéro n’existe pas.' });

  await telephones.changerJoignabilite(idTelephone, statut);
  journaliser(requete.utilisateur.id_utilisateur, 'Mise à jour de la joignabilité d’un numéro',
    `${telephone.numero} : ${requete.body.resultat}`);
  return reponse.json({ message: 'Enregistré.', statut_joignabilite: statut });
}

module.exports = {
  tableauDeBord, detailGroupe, listerSeuils, modifierSeuils,
  rechercherDonneur, enregistrerDon,
  listerPoches, detailPoche, changerSituationPoche,
  listerDonneurs, resumerDonneurs, ficheDonneur, statistiquesCentre,
  cibleAlerte, listerAlertesCtrl, creerAlerteCtrl, modifierAlerteCtrl, envoyerAlerteCtrl,
  suiviAlerteCtrl, listeAppelCtrl, cloturerAlerteCtrl, supprimerAlerteCtrl, changerJoignabiliteCtrl
};
