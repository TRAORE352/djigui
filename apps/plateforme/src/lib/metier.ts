/**
 * Vocabulaire métier affiché : statuts, niveaux, urgences, types de produits.
 *
 * Le backend parle en codes (`non_conforme`, `agent_depot`, `GR`). Les écrans
 * parlent français. Cette traduction vit ici, une seule fois, pour que les
 * deux espaces disent exactement la même chose de la même donnée.
 */
import type {
  EtapeLabo, LigneStock, MarqueurSerologie, MotifRefusEchantillon,
  ResultatSerologie, StatutPoche,
} from "@dds/contrat-api";

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
  acceptee: { mot: "Acceptée", ton: "primaire" },
  livree: { mot: "Livrée", ton: "seve" },
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

/* =====================================================================
   Laboratoire — vocabulaire de la qualification biologique
   ===================================================================== */

export const ETAPE_LABO: Record<EtapeLabo, { mot: string; verbe: string; aide: string }> = {
  reception: {
    mot: "Réception",
    verbe: "Contrôler l'échantillon",
    aide: "Vérifiez que les tubes sont présents, étiquetés et exploitables.",
  },
  groupage: {
    mot: "Groupage",
    verbe: "Grouper",
    aide: "Deux déterminations indépendantes doivent donner le même résultat.",
  },
  serologie: {
    mot: "Sérologie",
    verbe: "Saisir les résultats",
    aide: "VIH, hépatites B et C et syphilis sont obligatoires avant libération.",
  },
  liberation: {
    mot: "Libération",
    verbe: "Libérer",
    aide: "Le verdict est calculé par le dossier : vous le confirmez, vous ne le saisissez pas.",
  },
  terminee: { mot: "Terminée", verbe: "", aide: "" },
};

/** Les quatre étapes dans l'ordre, pour la frise de progression. */
export const ETAPES_ORDRE: EtapeLabo[] = ["reception", "groupage", "serologie", "liberation"];

export const MARQUEUR: Record<MarqueurSerologie, { mot: string; nomLong: string; obligatoire: boolean }> = {
  vih: { mot: "VIH", nomLong: "Virus de l'immunodéficience humaine", obligatoire: true },
  hepatite_b: { mot: "Hépatite B", nomLong: "Antigène HBs", obligatoire: true },
  hepatite_c: { mot: "Hépatite C", nomLong: "Anticorps anti-VHC", obligatoire: true },
  syphilis: { mot: "Syphilis", nomLong: "Tréponème pâle (TPHA)", obligatoire: true },
  htlv: { mot: "HTLV", nomLong: "Virus T-lymphotropique humain", obligatoire: false },
  paludisme: { mot: "Paludisme", nomLong: "Recherche de Plasmodium", obligatoire: false },
};

export const MARQUEURS_ORDRE: MarqueurSerologie[] =
  ["vih", "hepatite_b", "hepatite_c", "syphilis", "htlv", "paludisme"];

export const RESULTAT_SEROLOGIE: Record<ResultatSerologie, { mot: string; ton: Ton }> = {
  negatif: { mot: "Négatif", ton: "seve" },
  positif: { mot: "Positif", ton: "sang" },
  ininterpretable: { mot: "À refaire", ton: "ocre" },
};

export const MOTIF_REFUS: Record<MotifRefusEchantillon, string> = {
  tubes_absents: "Tubes absents",
  etiquetage_illisible: "Étiquetage illisible ou discordant",
  echantillon_hemolyse: "Échantillon hémolysé",
  volume_insuffisant: "Volume insuffisant",
  chaine_du_froid_rompue: "Chaîne du froid rompue",
  autre: "Autre motif",
};

export const MOTIFS_ORDRE: MotifRefusEchantillon[] = [
  "tubes_absents", "etiquetage_illisible", "echantillon_hemolyse",
  "volume_insuffisant", "chaine_du_froid_rompue", "autre",
];

/** +22670000000 → « 70 00 00 00 », plus lisible à l'écran. */
export function telephoneLisible(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const huit = valeur.replace(/\D/g, "").slice(-8);
  return huit.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
