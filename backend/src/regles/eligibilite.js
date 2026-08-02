// =====================================================================
//  DJIGUI — règles d'éligibilité (chapitre 8.1 du cahier des charges).
//  Le calcul est indicatif : la décision de prélever appartient au
//  personnel médical du centre (règle RG6), et l'écran doit le dire.
//  Aucune valeur chiffrée n'est écrite ici : tout vient de la table
//  parametre, pour être corrigé par l'administrateur sans toucher au code.
// =====================================================================
const { lireParametres } = require('../requetes/parametres');

// Âge en années révolues.
function calculerAge(dateNaissance) {
  const naissance = new Date(dateNaissance);
  const aujourdHui = new Date();
  let age = aujourdHui.getFullYear() - naissance.getFullYear();
  const anniversairePasse =
    aujourdHui.getMonth() > naissance.getMonth() ||
    (aujourdHui.getMonth() === naissance.getMonth() &&
     aujourdHui.getDate() >= naissance.getDate());
  if (!anniversairePasse) age -= 1;
  return age;
}

// Nombre de jours d'ici à une date. Zéro si la date est passée.
function joursAvant(dateTexte) {
  if (!dateTexte) return 0;
  const cible = new Date(dateTexte);
  const aujourdHui = new Date();
  cible.setHours(0, 0, 0, 0);
  aujourdHui.setHours(0, 0, 0, 0);
  const jours = Math.ceil((cible - aujourdHui) / 86400000);
  return jours > 0 ? jours : 0;
}

// Règle RG5. Renvoie l'état complet, avec la raison écrite en clair
// pour que l'écran n'ait rien à interpréter.
async function evaluerEligibilite(donneur, nbDonsDouzeMois) {
  const parametres = await lireParametres();
  const raisons = [];
  const age = calculerAge(donneur.date_naissance);

  if (donneur.statut !== 'actif') {
    raisons.push({ code: 'compte_inactif', phrase: 'Ce compte n\u2019est plus actif.' });
  }
  if (age < parametres.age_min) {
    raisons.push({ code: 'age', phrase: `Il faut avoir ${parametres.age_min} ans révolus.` });
  }
  if (age > parametres.age_max) {
    raisons.push({ code: 'age', phrase: `Au-delà de ${parametres.age_max} ans, le centre décide sur place.` });
  }
  if (Number(donneur.poids_declare) < parametres.poids_min) {
    raisons.push({ code: 'poids', phrase: `Sous ${parametres.poids_min} kg, le centre décide sur place.` });
  }

  const jours = joursAvant(donneur.date_prochaine_eligibilite);
  if (jours > 0) {
    raisons.push({ code: 'delai', phrase: `Il reste ${jours} jour${jours > 1 ? 's' : ''} à attendre.` });
  }

  const maximumAnnuel = donneur.sexe === 'M'
    ? parametres.max_dons_homme_an
    : parametres.max_dons_femme_an;
  if (nbDonsDouzeMois >= maximumAnnuel) {
    raisons.push({
      code: 'quota_annuel',
      phrase: `Vous avez atteint ${maximumAnnuel} dons sur douze mois.`
    });
  }

  return {
    eligible: raisons.length === 0,
    raisons,
    jours_restants: jours,
    age
  };
}

// Règle RG9 : délai en mois à ajouter à la date d'un don, selon le sexe.
async function delaiApresDonEnMois(sexe) {
  const parametres = await lireParametres();
  return sexe === 'M' ? parametres.delai_homme_mois : parametres.delai_femme_mois;
}

module.exports = { calculerAge, joursAvant, evaluerEligibilite, delaiApresDonEnMois };
