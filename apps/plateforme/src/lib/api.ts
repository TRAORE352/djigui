/**
 * Client d'API de la plateforme (espace agent). C'est le SEUL endroit qui
 * parle au backend. Les types viennent de @dds/contrat-api.
 */
import type {
  AgentCompte, AgentConnexionReponse, Analyse, CreerAgentRequete, CreerCentreRequete,
  CreerPocheRequete, CreerZoneRequete, DelivranceRequete, Demande,
  DemandeRequete, DonneurAgent, EnregistrerAnalyseRequete, EnregistrerPassageRequete,
  EstimationAlerteReponse, Expedition, ExpeditionRequete, FicheTracabilite,
  InscriptionSurPlaceRequete, LancerAlerteRequete, LigneStock, ModifierRegleRequete,
  Passage, Poche, PreparerPocheRequete, Produit, Regle, ReinitialisationMotDePasseReponse,
  Reponse, ReponseErreur, SiteAdmin, SitePartenaire, Statistiques, SuiviAlerte,
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
      headers: {
        "Content-Type": "application/json",
        ...(entete ? { Authorization: entete } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
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

  pochesAanalyser: () =>
    appel<Poche[]>("GET", "/poches?statut=a_analyser"),

  /** Poches qualifiées conformes, en attente de préparation des produits (P5). */
  pochesAPreparer: () =>
    appel<Poche[]>("GET", "/poches?statut=conforme"),

  analyser: (code: string, corps: EnregistrerAnalyseRequete) =>
    appel<Analyse>("POST", `/poches/${encodeURIComponent(code)}/analyse`, corps),

  preparer: (code: string, corps: PreparerPocheRequete) =>
    appel<Produit[]>("POST", `/poches/${encodeURIComponent(code)}/preparation`, corps),

  fiche: (code: string) =>
    appel<FicheTracabilite>("GET", `/codes/${encodeURIComponent(code)}`),

  reinitialiser: (id: string) =>
    appel<ReinitialisationMotDePasseReponse>("POST", `/donneurs/${encodeURIComponent(id)}/reinitialisation`),

  // P6 Stock
  stock: () => appel<LigneStock[]>("GET", "/stock"),
  zones: () => appel<{ id: string; nom: string; ville: string }[]>("GET", "/zones"),
  produitsPeremption: () => appel<Produit[]>("GET", "/produits?peremption=proche"),
  detruireProduit: (code: string) => appel<null>("POST", `/produits/${encodeURIComponent(code)}/destruction`, {}),

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
  creerExpedition: (corps: ExpeditionRequete) => appel<Expedition>("POST", "/expeditions", corps),
  recevoirExpedition: (id: string) => appel<Expedition>("POST", `/expeditions/${encodeURIComponent(id)}/reception`),
  delivrer: (corps: DelivranceRequete) => appel<{ code: string; service: string; statut: string }>("POST", "/delivrances", corps),

  // Espace CNTS (administration)
  agents: () => appel<AgentCompte[]>("GET", "/agents"),
  creerAgent: (corps: CreerAgentRequete) => appel<AgentCompte>("POST", "/agents", corps),
  sites: () => appel<SiteAdmin[]>("GET", "/sites"),
  ajouterZone: (corps: CreerZoneRequete) => appel<{ id: string; nom: string; ville: string }>("POST", "/zones", corps),
  ajouterCentre: (corps: CreerCentreRequete) => appel<{ id: string; code: string; nom: string; type: string }>("POST", "/centres", corps),
  regles: () => appel<Regle[]>("GET", "/regles"),
  modifierRegle: (cle: string, corps: ModifierRegleRequete) => appel<Regle>("PUT", `/regles/${encodeURIComponent(cle)}`, corps),
  statistiques: () => appel<Statistiques>("GET", "/statistiques"),
};
