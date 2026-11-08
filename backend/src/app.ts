import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { routeSante } from "./routes/sante.js";
import { routeAuth } from "./routes/auth.js";
import { routeAdmin } from "./routes/admin.js";
import { routeReferentiels } from "./routes/referentiels.js";
import { routeDonneurs } from "./routes/donneurs.js";
import { routeAlertes } from "./routes/alertes.js";
import { routeGestion } from "./routes/gestion.js";
import { routePassages } from "./routes/passages.js";
import { routePoches } from "./routes/poches.js";
import { routeLabo } from "./routes/laboratoire.js";
import { routeCodes } from "./routes/codes.js";
import { routeStock, routeProduits } from "./routes/stock.js";
import { routeAlertesGestion } from "./routes/alertes-gestion.js";
import { routeDistribution } from "./routes/distribution.js";
import { authentifier } from "./middlewares/authentification.js";
import { exigerDonneur } from "./middlewares/donneur.js";
import { exigerRole } from "./middlewares/roles.js";
import { gestionErreurs } from "./middlewares/erreurs.js";

/**
 * L'application Express, séparée de l'écoute réseau :
 *   - `src/index.ts` fait `app.listen()` pour le développement local ;
 *   - `api/index.ts` exporte `app` pour un déploiement serverless (Vercel).
 */
export const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigines }));
app.use(express.json());

// Les routes sont montées sous un préfixe (vide en local, "/api" sur Vercel).
const base = config.apiBasePath;

// Racine : petit point d'entrée lisible pour les humains. L'API elle-même vit
// sous /api (ou à la racine en local) ; ici on rappelle simplement où elle est.
app.get("/", (_req, res) => {
  res.json({
    donnees: {
      nom: "API Don de sang (CNTS)",
      statut: "/sante",
      zones: "/zones",
      prefixe: base || "(aucun)",
    },
  });
});

app.use(`${base}/sante`, routeSante);
app.use(`${base}/auth`, routeAuth);

// Référentiels publics (zones, centres).
app.use(`${base}/`, routeReferentiels);

// Application des donneurs (D8 à D14) — accès donneur connecté uniquement.
app.use(`${base}/donneurs/moi`, authentifier, exigerDonneur, routeDonneurs);

// Alertes côté gestionnaire (P7) — monté AVANT le donneur pour ne pas bloquer
// la réponse du donneur (POST /alertes/:id/reponse).
app.use(`${base}/alertes`, authentifier, routeAlertesGestion);
// Alertes côté donneur (réponse à une alerte).
app.use(`${base}/alertes`, authentifier, exigerDonneur, routeAlertes);

// Plateforme — agent d'accueil (P3).
app.use(`${base}/donneurs`, authentifier, exigerRole("agent_accueil", "admin"), routeGestion);

// Plateforme — collecte (P3), laboratoire (P4/P5) et traçabilité (P9).
app.use(`${base}/passages`, authentifier, exigerRole("agent_accueil", "agent_prelevement", "admin"), routePassages);
// La chaîne du laboratoire est montée AVANT routePoches : ses chemins
// (/poches/file-labo, /poches/:code/groupage…) sont plus spécifiques.
app.use(`${base}/poches`, authentifier, routeLabo);
app.use(`${base}/poches`, authentifier, routePoches);
app.use(`${base}/codes`, authentifier, exigerRole("agent_accueil", "agent_prelevement", "agent_labo", "agent_stock", "agent_depot", "admin"), routeCodes);

// Plateforme — stock (P6), produits (P6) et distribution (P8/P10).
app.use(`${base}/stock`, authentifier, exigerRole("agent_stock", "agent_depot", "admin"), routeStock);
app.use(`${base}/produits`, authentifier, exigerRole("agent_stock", "agent_depot", "admin"), routeProduits);
app.use(`${base}`, routeDistribution);

// Espace CNTS (administration) — comptes/rôles, zones, centres, règles, stats.
app.use(`${base}`, routeAdmin);

// À venir : (rien — toutes les routes du prototype sont montées)

app.use(gestionErreurs);
