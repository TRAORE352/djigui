/**
 * Identité du déploiement : quel espace cette adresse sert-elle ?
 *
 * Le même code est livré sur trois adresses distinctes. Ce n'est PAS le
 * chemin d'URL qui décide de l'espace, mais une variable figée à la
 * construction : `NEXT_PUBLIC_ESPACE`. Elle est donc inlinée dans le bundle,
 * ce qui permet de vérifier l'identité d'un déploiement avec un simple
 * `curl` sur le HTML servi, sans ouvrir de navigateur.
 *
 *   djigui-agent.vercel.app  -> ESPACE=agent  -> espace agent seul
 *   djigui-cnts.vercel.app   -> ESPACE=cnts   -> espace CNTS seul
 *   (sans variable)          -> ESPACE=complet -> portail des trois portes
 *
 * Ce fichier ne dépend ni de React ni d'un module client : le middleware,
 * qui tourne côté serveur, doit pouvoir le lire.
 *
 * Une valeur inconnue retombe sur `complet` — comportement sûr et explicite.
 * Ne jamais faire retomber une identité illisible sur un espace privilégié.
 */

export type Espace = "agent" | "cnts";
export type Deploiement = Espace | "complet";

const BRUT = process.env.NEXT_PUBLIC_ESPACE;

export const DEPLOIEMENT: Deploiement =
  BRUT === "agent" ? "agent" : BRUT === "cnts" ? "cnts" : "complet";

/** Un déploiement dédié n'expose qu'un seul espace. */
export const EST_DEDIE = DEPLOIEMENT !== "complet";

/** Nom du produit, partout : titre, en-têtes, métadonnées. */
export const MARQUE = "Djigui";

/** Ce que chaque espace annonce de lui-même. */
export const IDENTITE: Record<Deploiement, {
  titre: string;
  /** Sous-titre de la page de connexion. */
  phrase: string;
  /** Adresse d'arrivée après authentification. */
  accueil: string;
  /** Préfixe des chemins qui appartiennent à cet espace. */
  prefixe: string;
  /** Adresse de la porte de connexion. */
  porte: string;
}> = {
  agent: {
    titre: "Espace agent",
    phrase: "Accueil et prélèvement, laboratoire, stock, distribution et traçabilité.",
    accueil: "/agent",
    prefixe: "/agent",
    porte: "/connexion/agent",
  },
  cnts: {
    titre: "Espace CNTS",
    phrase: "Comptes et rôles, réseau des sites, règles de don et tableau de bord national.",
    accueil: "/admin",
    prefixe: "/admin",
    porte: "/connexion/cnts",
  },
  complet: {
    titre: MARQUE,
    phrase: "Plateforme nationale de don de sang et de traçabilité des poches.",
    accueil: "/",
    prefixe: "/",
    porte: "/",
  },
};

/** Ce déploiement sert-il ce chemin ? Un chemin étranger est refusé. */
export function cheminServi(chemin: string): boolean {
  if (!EST_DEDIE) return true;
  const { prefixe, porte } = IDENTITE[DEPLOIEMENT];
  return chemin === prefixe
    || chemin.startsWith(`${prefixe}/`)
    || chemin === porte;
}
