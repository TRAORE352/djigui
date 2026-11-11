/**
 * Client d'API de la plateforme (espace agent). C'est le SEUL endroit qui
 * parle au backend. Les types viennent de @dds/contrat-api.
 */
import type {
  AgentCompte, AgentConnexionReponse, BesoinStock, CreerAgentRequete, CreerCentreRequete,
  CreerPocheRequete, CreerZoneRequete, Delivrance, DelivranceReponse, DelivranceRequete, Demande,
  DemandeRequete, DonneurAgent, EnregistrerPassageRequete,
  EntreeStock, EntreeStockRequete,
  EstimationAlerteReponse, Expedition, ExpeditionRequete,
  InscriptionSurPlaceRequete, LancerAlerteRequete, LigneStock, ModifierRegleRequete,
  Passage, Poche, Produit, Regle,
  ReinitialisationMotDePasseReponse, Reponse, ReponseErreur,
  SiteAdmin, SitePartenaire, Statistiques, SuiviAlerte, DonneurAdmin, Evenement,
} from "@dds/contrat-api";
import { lireJeton } from "./session";
// `ErreurApi` et `messageDe` vivent dans ./erreurs : une seule définition
// partagée par le client d'API et par les écrans.
export { ErreurApi, messageDe } from "./erreurs";
import { ErreurApi } from "./erreurs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function appel<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
  const jeton = lireJeton();
  const entete = jeton ? "Bearer " + jeton : null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${chemin}`, {
      method: methode,
      /*
       * Sans ce délai, un serveur qui accepte la connexion mais ne
       * répond jamais (base de données bloquée, par exemple) laisse la
       * promesse pendante POUR TOUJOURS : l'écran reste sur son
       * squelette de chargement, sans erreur ni issue. 15 s dépassées,
       * on préfère une erreur franche que l'écran sait afficher.
       */
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        ...(entete ? { Authorization: entete } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ErreurApi("Le serveur met trop de temps à répondre.", "DELAI_DEPASSE");
    }
    throw new ErreurApi("Pas de connexion au serveur.", "RESEAU");
  }
  const contenu = (await res.json().catch(() => null)) as Reponse<unknown> | ReponseErreur | null;
  if (!res.ok) {
    const erreur = (contenu as ReponseErreur | null)?.erreur;
    throw new ErreurApi(erreur?.message ?? "Erreur serveur.", erreur?.code ?? "ERREUR_SERVEUR", erreur?.champ);
  }
  return (contenu as Reponse<T>).donnees;
}

export const api = {
  connexion: (email: string, motDePasse: string) =>
    appel<AgentConnexionReponse>("POST", "/auth/agent/connexion", { email, motDePasse }),

  retrouverDonneur: (telephone: string) =>
    appel<DonneurAgent>("GET", `/donneurs?telephone=${encodeURIComponent(telephone)}`),

  inscrireSurPlace: (corps: InscriptionSurPlaceRequete) =>
    appel<DonneurAgent>("POST", "/donneurs", corps),

  enregistrerPassage: (corps: EnregistrerPassageRequete) =>
    appel<Passage>("POST", "/passages", corps),

  creerPoche: (corps: CreerPocheRequete) =>
    appel<Poche>("POST", "/poches", corps),

  /*
   * La chaîne de qualification biologique (file-labo → libération,
   * analyse, préparation) et la fiche de traçabilité n'ont plus
   * d'appelant dans l'espace agent : les écrans Laboratoire et
   * Traçabilité sont suspendus en attendant la validation des
   * biologistes. Les routes backend existent toujours — le serveur
   * continue d'écrire l'historique, qui sera rétroactif à la réouverture
   * — seul le client frontend a perdu ses appels. Voir
   * navigation.ts (SECTIONS_AGENT) pour réouvrir.
   */

  reinitialiser: (id: string) =>
    appel<ReinitialisationMotDePasseReponse>("POST", `/donneurs/${encodeURIComponent(id)}/reinitialisation`),

  // P6 Stock
  stock: () => appel<LigneStock[]>("GET", "/stock"),
  /** Ce que le stock réclame : groupes sous leur seuil, avec suggestion. */
  besoinsStock: () => appel<BesoinStock[]>("GET", "/stock/besoins"),
  zones: () => appel<{ id: string; nom: string; ville: string }[]>("GET", "/zones"),
  produitsPeremption: () => appel<Produit[]>("GET", "/produits?peremption=proche"),
  /** Tous les produits délivrables du site (statut disponible/réservé). */
  produitsDisponibles: () => appel<Produit[]>("GET", "/produits"),
  detruireProduit: (code: string) => appel<null>("POST", `/produits/${encodeURIComponent(code)}/destruction`, {}),

  /** Enregistrer un lot reçu de l'extérieur (laboratoire, banque de sang). */
  enregistrerEntree: (corps: EntreeStockRequete) =>
    appel<EntreeStock>("POST", "/stock/entrees", corps),

  // P7 Alertes (gestionnaire)
  estimationAlerte: (zoneIds: string[]) =>
    appel<EstimationAlerteReponse>("POST", "/alertes/estimation", { zoneIds }),
  lancerAlerte: (corps: LancerAlerteRequete) => appel<SuiviAlerte>("POST", "/alertes", corps),
  suiviAlerte: (id: string) => appel<SuiviAlerte>("GET", `/alertes/${encodeURIComponent(id)}`),
  cloturerAlerte: (id: string) => appel<SuiviAlerte>("POST", `/alertes/${encodeURIComponent(id)}/cloture`),

  // P8/P10 Distribution
  demandes: () => appel<Demande[]>("GET", "/demandes"),
  sitesPartenaires: () => appel<SitePartenaire[]>("GET", "/sites-partenaires"),
  creerDemande: (corps: DemandeRequete) => appel<Demande>("POST", "/demandes", corps),
  accepterDemande: (id: string) => appel<Demande>("POST", `/demandes/${encodeURIComponent(id)}/accepter`),
  recevoirDemande: (id: string) => appel<Demande>("POST", `/demandes/${encodeURIComponent(id)}/recevoir`),
  creerExpedition: (corps: ExpeditionRequete) => appel<Expedition>("POST", "/expeditions", corps),
  recevoirExpedition: (id: string) => appel<Expedition>("POST", `/expeditions/${encodeURIComponent(id)}/reception`),
  delivrer: (corps: DelivranceRequete) => appel<DelivranceReponse>("POST", "/delivrances", corps),
  /** Historique des délivrances du site, la plus récente d'abord. */
  delivrances: () => appel<Delivrance[]>("GET", "/delivrances"),

  // Espace CNTS (administration)
  agents: () => appel<AgentCompte[]>("GET", "/agents"),
  creerAgent: (corps: CreerAgentRequete) => appel<AgentCompte>("POST", "/agents", corps),
  sites: () => appel<SiteAdmin[]>("GET", "/sites"),
  ajouterZone: (corps: CreerZoneRequete) => appel<{ id: string; nom: string; ville: string }>("POST", "/zones", corps),
  ajouterCentre: (corps: CreerCentreRequete) => appel<{ id: string; code: string; nom: string; type: string }>("POST", "/centres", corps),
  regles: () => appel<Regle[]>("GET", "/regles"),
  modifierRegle: (cle: string, corps: ModifierRegleRequete) => appel<Regle>("PUT", `/regles/${encodeURIComponent(cle)}`, corps),
  statistiques: () => appel<Statistiques>("GET", "/statistiques"),
  /** Les donneurs, vus par le CNTS. */
  donneurs: () => appel<DonneurAdmin[]>("GET", "/donneurs"),
  /** Journal des dernières actions (agents et labo). */
  activite: () => appel<Evenement[]>("GET", "/activite"),
  /** Historique d'activité d'une personne (agent ou donneur). */
  activitePersonne: (id: string) => appel<Evenement[]>("GET", `/activite/${encodeURIComponent(id)}`),
};
