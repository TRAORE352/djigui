/**
 * Vocabulaire métier affiché : statuts, niveaux, urgences, types de produits.
 *
 * Le backend parle en codes (`non_conforme`, `agent_depot`, `GR`). Les écrans
 * parlent français. Cette traduction vit ici, une seule fois, pour que les
 * deux espaces disent exactement la même chose de la même donnée.
 */
import type { LigneStock, StatutPoche } from "@dds/contrat-api";

export type Ton = "primaire" | "seve" | "ocre" | "sang" | "neutre";

/** Statut d'une poche : libellé + ton de la pilule. */
export const STATUT_POCHE: Record<StatutPoche, { mot: string; ton: Ton }> = {
  prelevee: { mot: "Prélevée", ton: "primaire" },
  en_analyse: { mot: "Au laboratoire", ton: "ocre" },
  conforme: { mot: "Conforme", ton: "seve" },
  non_conforme: { mot: "Non conforme", ton: "sang" },
  preparee: { mot: "Préparée", ton: "seve" },
  detruite: { mot: "Détruite", ton: "neutre" },
};

export const NIVEAU_STOCK: Record<LigneStock["niveau"], { mot: string; ton: Ton }> = {
  suffisant: { mot: "Suffisant", ton: "seve" },
  bas: { mot: "Bas", ton: "ocre" },
  critique: { mot: "Critique", ton: "sang" },
};

export const URGENCE: Record<"normale" | "urgente" | "critique", { mot: string; ton: Ton }> = {
  normale: { mot: "Normale", ton: "neutre" },
  urgente: { mot: "Urgente", ton: "ocre" },
  critique: { mot: "Critique", ton: "sang" },
};

export const TYPE_PRODUIT: Record<"GR" | "PL" | "PQ", { mot: string; detail: string }> = {
  GR: { mot: "Globules rouges", detail: "Conservation 42 jours" },
  PL: { mot: "Plasma", detail: "Conservation 1 an congelé" },
  PQ: { mot: "Plaquettes", detail: "Conservation 5 jours" },
};

export const TYPE_SITE: Record<"centre" | "depot" | "hopital", string> = {
  centre: "Centre de collecte",
  depot: "Dépôt",
  hopital: "Hôpital",
};

/** Statut d'une demande de produits, tel qu'écrit par le backend. */
export const STATUT_DEMANDE: Record<string, { mot: string; ton: Ton }> = {
  en_attente: { mot: "En attente", ton: "ocre" },
  preparee: { mot: "Préparée", ton: "primaire" },
  expediee: { mot: "Expédiée", ton: "primaire" },
  recue: { mot: "Reçue", ton: "seve" },
  refusee: { mot: "Refusée", ton: "sang" },
};

/** Libellé d'un statut inconnu : on montre le code plutôt que rien. */
export function statutDemande(code: string) {
  return STATUT_DEMANDE[code] ?? { mot: code.replace(/_/g, " "), ton: "neutre" as Ton };
}

export const LES_GROUPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

/** AAAA-MM-JJ → « 12 novembre 2026 ». */
export function dateCourte(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const d = new Date(valeur.length <= 10 ? `${valeur}T00:00:00` : valeur);
  if (Number.isNaN(d.getTime())) return valeur;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Nombre de jours d'ici à cette date (négatif si déjà passée). */
export function joursRestants(date: string | null): number | null {
  if (!date) return null;
  const cible = new Date(`${date.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(cible)) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible - aujourdhui.getTime()) / 86_400_000);
}

/** Téléphone saisi par l'agent → +226XXXXXXXX attendu par l'API. */
export function telephoneInternational(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, "");
  return `+226${chiffres.slice(-8)}`;
}

/** +22670000000 → « 70 00 00 00 », plus lisible à l'écran. */
export function telephoneLisible(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const huit = valeur.replace(/\D/g, "").slice(-8);
  return huit.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
