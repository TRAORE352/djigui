/**
 * Navigation des deux espaces de la plateforme, et droits d'accès.
 *
 * Une seule source de vérité : la barre latérale, le poste de travail et le
 * garde-fou de chaque page lisent cette liste. Le contrôle réel des droits
 * reste fait par le backend à chaque appel ; ici on évite seulement de
 * montrer une porte qui se refermerait.
 */
import type { Role } from "@dds/contrat-api";
import {
  Activity, BadgeCheck, Bell, Boxes, Building2, FlaskConical, LayoutDashboard,
  ScanLine, SlidersHorizontal, Truck, UserRound, Users,
} from "lucide-react";
import type { ComponentType } from "react";

export type Section = {
  adresse: string;
  mot: string;
  /** Phrase affichée sous le titre de la page et sur le raccourci. */
  resume: string;
  Icone: ComponentType<{ size?: number | string; "aria-hidden"?: boolean | "true" }>;
  /** Rôles autorisés ; vide = tout compte de la plateforme. */
  roles: Role[];
};

/** Espace agent (P3 à P10). */
export const SECTIONS_AGENT: Section[] = [
  {
    adresse: "/agent",
    mot: "Tableau de bord",
    resume: "Ce qui attend une action de votre part, maintenant.",
    Icone: LayoutDashboard,
    roles: [],
  },
  {
    adresse: "/agent/accueil",
    mot: "Accueil et prélèvement",
    resume: "Retrouver un donneur, l'inscrire sur place, enregistrer sa venue et créer la poche.",
    Icone: UserRound,
    roles: ["agent_accueil", "agent_prelevement", "admin"],
  },
  {
    adresse: "/agent/laboratoire",
    mot: "Laboratoire",
    resume: "Qualifier le don : réception, groupage, sérologie, puis libération.",
    Icone: FlaskConical,
    roles: ["agent_labo", "admin"],
  },
  {
    adresse: "/agent/stock",
    mot: "Stock",
    resume: "Stock calculé par type et par groupe, et produits proches de la péremption.",
    Icone: Boxes,
    roles: ["agent_stock", "agent_depot", "admin"],
  },
  {
    adresse: "/agent/alertes",
    mot: "Alertes aux donneurs",
    resume: "Appeler les donneurs d'une zone et suivre leurs réponses en direct.",
    Icone: Bell,
    roles: ["agent_stock", "agent_depot", "admin"],
  },
  {
    adresse: "/agent/distribution",
    mot: "Distribution",
    resume: "Demandes des dépôts, expéditions, réceptions et délivrances aux services.",
    Icone: Truck,
    roles: ["agent_stock", "agent_depot", "admin"],
  },
  {
    adresse: "/agent/tracabilite",
    mot: "Traçabilité",
    resume: "Du donneur au receveur : l'histoire complète d'un code.",
    Icone: ScanLine,
    roles: [],
  },
];

/** Espace CNTS (P1, P2, règles, tableau de bord). */
export const SECTIONS_ADMIN: Section[] = [
  {
    adresse: "/admin",
    mot: "Tableau de bord",
    resume: "L'état du réseau en temps réel.",
    Icone: Activity,
    roles: ["admin"],
  },
  {
    adresse: "/admin/comptes",
    mot: "Comptes et rôles",
    resume: "Créer les comptes des agents et leur donner leurs rôles.",
    Icone: Users,
    roles: ["admin"],
  },
  {
    adresse: "/admin/reseau",
    mot: "Zones et sites",
    resume: "Les zones des donneurs, les centres, dépôts et hôpitaux du réseau.",
    Icone: Building2,
    roles: ["admin"],
  },
  {
    adresse: "/admin/regles",
    mot: "Règles de don",
    resume: "Les valeurs qui pilotent l'éligibilité et les alertes (Annexe E).",
    Icone: SlidersHorizontal,
    roles: ["admin"],
  },
];

export const LIBELLE_ROLE: Record<Role, string> = {
  donneur: "Donneur",
  agent_accueil: "Accueil",
  agent_prelevement: "Prélèvement",
  agent_labo: "Laboratoire",
  agent_stock: "Stock",
  agent_depot: "Dépôt",
  admin: "Administrateur",
};

export const ICONE_ROLE = BadgeCheck;

/** Un compte a-t-il accès à cette section ? */
export function sectionAutorisee(section: Section, roles: Role[]): boolean {
  return section.roles.length === 0 || section.roles.some((r) => roles.includes(r));
}

/** Sections visibles par ce compte, dans l'ordre. */
export function sectionsVisibles(sections: Section[], roles: Role[]): Section[] {
  return sections.filter((s) => sectionAutorisee(s, roles));
}

/** Retrouve la section qui décrit l'adresse courante (la plus précise). */
export function sectionCourante(sections: Section[], chemin: string): Section | undefined {
  return [...sections]
    .sort((a, b) => b.adresse.length - a.adresse.length)
    .find((s) => chemin === s.adresse || chemin.startsWith(`${s.adresse}/`));
}
