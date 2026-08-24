// DJIGUI — routes publiques : liste des zones et diagnostic.
const express = require('express');
const controleur = require('../controleurs/public.controleur');

const routeur = express.Router();
routeur.get('/config', controleur.configPublique);
routeur.get('/zones', controleur.zonesPubliques);
routeur.get('/sante', controleur.sante);
module.exports = routeur;
