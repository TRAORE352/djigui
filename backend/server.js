// =====================================================================
//  DJIGUI — point d'entrée de la couche de service (port 4000).
//  Frontend et backend sont deux projets distincts qui ne communiquent
//  que par cette interface, en JSON (contrainte K2).
// =====================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { diagnostiquer, expliquerPanne } = require('./src/db');
const { pageAccueil } = require('./src/controleurs/public.controleur');
const { configure: pushConfigure } = require('./src/push');

const application = express();

// --- Confiance au proxy (Render place l'application derrière un seul
// reverse proxy) -------------------------------------------------------
// Sans ce réglage, Express garde trust proxy = false par défaut : il
// ignore l'en-tête X-Forwarded-For et req.ip renvoie l'adresse du
// proxy Render, pas celle du client. express-rate-limit (RG35, limite
// sur /api/auth) détecte cette incohérence — un en-tête XFF présent
// alors que trust proxy ne l'autorise pas — et lève une ValidationError
// (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) à chaque requête passant par le
// limiteur, ce qui a fait tomber le service (piège Express 4 documenté
// plus bas dans ce fichier : une erreur non interceptée dans un
// contrôleur/middleware asynchrone n'est pas rattrapée par Express).
//
// `1` plutôt que `true` : `true` ferait confiance à TOUT en-tête
// X-Forwarded-For, quel que soit le nombre de sauts — un client pourrait
// alors fabriquer son propre en-tête et usurper n'importe quelle
// adresse IP, rendant le limiteur de débit inutile. `1` dit à Express de
// ne faire confiance qu'à UN SEUL proxy en amont (celui de Render) :
// req.ip devient l'adresse que CE proxy a lui-même constatée, jamais une
// valeur que le client aurait pu injecter avant lui. Exactement un
// niveau de proxy, ni plus ni moins, correspond à l'infrastructure
// réelle de Render.
application.set('trust proxy', 1);

// --- Contrôle des réglages avant tout démarrage ----------------------
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.error(
    '\n  Arrêt : JWT_SECRET est absent ou trop court dans le fichier .env.' +
    '\n  Mettez-y une longue suite de caractères au hasard, sans espace.\n');
  process.exit(1);
}

// --- CORS : seules les origines déclarées sont admises ---------------
const origines = (process.env.ORIGINES_AUTORISEES || 'http://localhost:3000')
  .split(',').map((origine) => origine.trim()).filter(Boolean);
application.use(cors({
  origin(origine, retour) {
    // Les outils sans origine (Thunder Client, curl) sont acceptés.
    if (!origine || origines.includes(origine)) return retour(null, true);
    return retour(new Error(
      `Origine ${origine} non autorisée. Ajoutez-la dans ORIGINES_AUTORISEES du fichier .env.`));
  },
  exposedHeaders: ['X-Jeton-Rafraichi']
}));

application.use(express.json({ limit: '256kb' }));

// --- Limitation de débit sur l'authentification (complète RG35) ------
application.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erreur: 'Trop de demandes. Réessayez dans quelques minutes.' }
}));

// --- Routes ----------------------------------------------------------
application.get('/', pageAccueil);
application.use('/api/auth', require('./src/routes/auth.routes'));
application.use('/api/donneurs', require('./src/routes/donneurs.routes'));
application.use('/api/administration', require('./src/routes/admin.routes'));
application.use('/api/gestion', require('./src/routes/gestion.routes'));
application.use('/api', require('./src/routes/public.routes'));

application.use((requete, reponse) => {
  reponse.status(404).json({ erreur: 'Cette adresse n\u2019existe pas dans le service.' });
});

// Erreur imprévue : message neutre à l'écran, détail complet en console.
// Codes MySQL (ER_...) remplacés par les SQLSTATE PostgreSQL (5
// caractères). Une violation d'unicité ou de clé étrangère qui remonte
// jusqu'ici (pas interceptée localement par un contrôleur) reste une
// erreur du client, pas du service : 409, jamais 500.
const CODES_RESEAU = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT']);
const estCodePostgres = (code) => typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code);

application.use((erreur, requete, reponse, suite) => {
  console.error(`\n  Erreur sur ${requete.method} ${requete.originalUrl}`);
  console.error(erreur);

  const code = erreur && erreur.code;
  if (code === '23505') {
    return reponse.status(409).json({ erreur: 'Cette valeur existe déjà : un doublon a été refusé.' });
  }
  if (code === '23503') {
    return reponse.status(409).json({
      erreur: 'Cette action fait référence à une donnée qui n’existe pas ou plus.'
    });
  }

  const message = code && (CODES_RESEAU.has(code) || estCodePostgres(code))
    ? expliquerPanne(erreur)
    : 'Le service a rencontré un problème. Réessayez.';
  reponse.status(500).json({ erreur: message });
});

// --- Démarrage, avec vérification de la base -------------------------
const port = Number(process.env.PORT || 4000);

async function demarrer() {
  try {
    const etat = await diagnostiquer();
    application.listen(port, () => {
      console.log(`\n  DJIGUI — couche de service prête sur http://localhost:${port}`);
      console.log(`  Base connectée : ${etat.nb_tables} tables, ${etat.nb_zones} zones, ` +
        `${etat.nb_structures} structures, ${etat.comptes_actifs.admin} administrateur(s).`);
      if (etat.comptes_actifs.admin === 0) {
        console.log('\n  Aucun administrateur. Lancez : npm run creer-admin');
      }
      if (etat.nb_zones === 0) {
        console.log('  Aucune zone : personne ne pourra s\u2019inscrire tant qu\u2019il n\u2019y en a pas.');
      }
      console.log(pushConfigure
        ? '  Notifications push : cl\u00e9s VAPID charg\u00e9es (setVapidDetails effectu\u00e9 sans erreur).'
        : '  Notifications push : d\u00e9sactiv\u00e9es (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents du .env).');
      console.log(`  Diagnostic complet : http://localhost:${port}\n`);
    });
  } catch (erreur) {
    console.error(`\n  Le service ne peut pas démarrer.\n  ${expliquerPanne(erreur)}\n`);
    process.exit(1);
  }
}

// Filet de sécurité : une erreur imprévue ne doit pas faire tomber le
// service sans explication. On la signale en console et on reste debout.
process.on('unhandledRejection', (raison) => {
  console.error('Rejet non traité :', raison);
});
process.on('uncaughtException', (erreur) => {
  console.error('Erreur non attrapée :', erreur);
});

demarrer();
