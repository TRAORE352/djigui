// DJIGUI — routes de l'espace donneur. Le rôle est vérifié à chaque
// appel, côté serveur (règle C4).
const express = require('express');
const { verifierSession, exigerRole } = require('../middlewares/auth');
const controleur = require('../controleurs/donneurs.controleur');

const routeur = express.Router();
routeur.use(verifierSession, exigerRole('donneur'));

routeur.get('/moi', controleur.monProfil);
routeur.put('/moi', controleur.modifierProfil);
routeur.put('/moi/question', controleur.changerQuestion);
routeur.get('/moi/telephones', controleur.mesTelephones);
routeur.post('/moi/telephones', controleur.ajouterTelephone);
routeur.delete('/moi/telephones/:id', controleur.retirerTelephone);
routeur.put('/moi/numero-principal', controleur.remplacerPrincipal);
routeur.put('/moi/desactivation', controleur.desactiver);
routeur.post('/moi/abonnement-push', controleur.enregistrerAbonnementPush);
routeur.delete('/moi/abonnement-push', controleur.retirerAbonnementPush);
routeur.get('/moi/dons', controleur.mesDons);
routeur.get('/moi/rappel.ics', controleur.rappelAgenda);

// E6, E7, E8 — appels au don.
routeur.get('/moi/alertes', controleur.mesAlertes);
routeur.get('/moi/alertes/:id', controleur.detailAlerte);
routeur.post('/moi/alertes/:id/reponse', controleur.repondreAlerte);
routeur.post('/moi/alertes/:id/disponibilite', controleur.enregistrerDisponibiliteCtrl);

module.exports = routeur;
