// DJIGUI — routes d'authentification (liste 10.3 du cahier des charges).
const express = require('express');
const controleur = require('../controleurs/auth.controleur');
const { verifierSession } = require('../middlewares/auth');

const routeur = express.Router();
routeur.post('/inscription', controleur.inscription);
routeur.post('/connexion', controleur.connexion);
routeur.post('/deconnexion', verifierSession, controleur.deconnexion);
routeur.get('/moi', verifierSession, controleur.monCompte);
routeur.post('/recuperation/question', controleur.recuperationQuestion);
routeur.post('/recuperation/verifier', controleur.recuperationVerifier);
routeur.post('/mot-de-passe', controleur.nouveauMotDePasse);
module.exports = routeur;
