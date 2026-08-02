// DJIGUI — routes de l'espace d'administration (écrans E27 à E32).
const express = require('express');
const { verifierSession, exigerRole, exigerMotDePasseDefinitif } = require('../middlewares/auth');
const controleur = require('../controleurs/admin.controleur');

const routeur = express.Router();
routeur.use(verifierSession, exigerRole('admin'), exigerMotDePasseDefinitif);

// Accueil (nombres et points d'attention de l'écran /administration)
routeur.get('/etat', controleur.etat);

// Comptes professionnels
routeur.get('/comptes', controleur.comptes);
routeur.get('/comptes/identifiant-propose', controleur.identifiantPropose);
routeur.post('/comptes', controleur.creerCompte);
routeur.post('/comptes/:id/provisoire-remis', controleur.accuserRemise);
routeur.post('/comptes/:id/reinitialiser', controleur.reinitialiser);
routeur.put('/comptes/:id/statut', controleur.changerStatutCompte);

// Référentiels
routeur.get('/referentiels', controleur.listerReferentiels);
routeur.post('/structures', controleur.creerStructure);
routeur.put('/structures/:id', controleur.modifierStructure);
routeur.delete('/structures/:id', controleur.supprimerStructure);
routeur.post('/zones', controleur.creerZone);
routeur.put('/zones/:id', controleur.modifierZone);
routeur.delete('/zones/:id', controleur.supprimerZone);

// Réglages et journal
routeur.get('/parametres', controleur.listerParametres);
routeur.put('/parametres', controleur.modifierParametres);
routeur.get('/journal', controleur.journal);
module.exports = routeur;
