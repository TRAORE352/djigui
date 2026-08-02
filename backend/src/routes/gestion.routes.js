// DJIGUI — routes de l'espace de gestion. E16, E17, E25, le cœur du
// registre (E21, E22, E23, E27 gestion), les deux écrans de registre
// E24 (donneurs) et E26 (statistiques), et l'appel au don (E18, E19, E20).
const express = require('express');
const { verifierSession, exigerRole, exigerMotDePasseDefinitif } = require('../middlewares/auth');
const controleur = require('../controleurs/gestion.controleur');

const routeur = express.Router();
routeur.use(verifierSession, exigerRole('gestionnaire'), exigerMotDePasseDefinitif);

routeur.get('/tableau-de-bord', controleur.tableauDeBord);
routeur.get('/groupes/:groupe', controleur.detailGroupe);
routeur.get('/seuils', controleur.listerSeuils);
routeur.put('/seuils', controleur.modifierSeuils);

routeur.get('/donneurs/recherche', controleur.rechercherDonneur);
routeur.post('/dons', controleur.enregistrerDon);

routeur.get('/poches', controleur.listerPoches);
routeur.get('/poches/:code', controleur.detailPoche);
routeur.put('/poches/:code/situation', controleur.changerSituationPoche);

// E24 — registre des donneurs. Les routes fixes (« resume ») doivent
// être déclarées avant « /donneurs/:id », sans quoi Express lirait
// « resume » comme un identifiant.
routeur.get('/donneurs/resume', controleur.resumerDonneurs);
routeur.get('/donneurs/:id', controleur.ficheDonneur);
routeur.get('/donneurs', controleur.listerDonneurs);

// E26 — statistiques.
routeur.get('/statistiques', controleur.statistiquesCentre);

// E18, E19, E20 — appel au don. « cibles » avant « :id » : sans quoi
// Express lirait « cibles » comme un identifiant d'alerte.
routeur.get('/alertes/cibles', controleur.cibleAlerte);
routeur.get('/alertes', controleur.listerAlertesCtrl);
routeur.post('/alertes', controleur.creerAlerteCtrl);
routeur.put('/alertes/:id', controleur.modifierAlerteCtrl);
routeur.post('/alertes/:id/envoi', controleur.envoyerAlerteCtrl);
routeur.get('/alertes/:id/suivi', controleur.suiviAlerteCtrl);
routeur.get('/alertes/:id/liste-appel', controleur.listeAppelCtrl);
routeur.post('/alertes/:id/cloture', controleur.cloturerAlerteCtrl);
routeur.delete('/alertes/:id', controleur.supprimerAlerteCtrl);

// E20 — résultat d'un appel téléphonique (règle RG37).
routeur.put('/telephones/:id/joignabilite', controleur.changerJoignabiliteCtrl);

module.exports = routeur;
