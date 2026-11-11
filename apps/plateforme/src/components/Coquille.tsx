"use client";
/**
 * Coquille des deux espaces de la plateforme : barre latérale de navigation,
 * identité du compte connecté, et en-tête de page.
 *
 * Elle garde aussi la session : sans jeton, retour à la connexion ; sans le
 * rôle attendu, renvoi vers l'espace du compte. Le backend revérifie tout.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import type { AgentConnecte } from "@dds/contrat-api";
import {
  LIBELLE_ROLE, sectionAutorisee, sectionCourante, sectionsVisibles,
  SECTIONS_ADMIN, SECTIONS_AGENT, type Section,
} from "@/lib/navigation";
import { fermerSession, lireAgent, lireJeton } from "@/lib/session";
import { MARQUE } from "@/lib/espace";
import Goutte from "@/components/Goutte";

type Espace = "agent" | "admin";

/** Chaque espace a sa propre porte d'entrée : on ne les mélange pas. */
const CONNEXION: Record<Espace, string> = {
  agent: "/connexion/agent",
  admin: "/connexion/cnts",
};

export default function Coquille({ espace, children }: { espace: Espace; children: React.ReactNode }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [agent, setAgent] = useState<AgentConnecte | null>(null);

  useEffect(() => {
    const a = lireAgent();
    if (!a || !lireJeton()) {
      routeur.replace(CONNEXION[espace]);
      return;
    }
    /*
     * Un compte ne peut être que dans SON espace. Un agent qui ouvre une
     * adresse de l'espace CNTS est renvoyé à la connexion CNTS, pas
     * glissé en douce dans l'autre espace.
     *
     * `agent_labo` est volontairement EXCLU : les écrans du laboratoire
     * ont été retirés de l'espace agent (la chaîne de qualification
     * reste côté serveur, prête pour sa réouverture). Un compte qui n'a
     * que ce rôle n'a aujourd'hui aucun écran — le laisser entrer
     * l'enfermerait dans une coquille vide, sans menu ni explication.
     * Mieux vaut un refus net à la connexion.
     */
    const ROLES_SANS_ECRAN: readonly string[] = ["agent_labo"];
    const autorise = espace === "admin"
      ? a.roles.includes("admin")
      : a.roles.some((r) => r.startsWith("agent_") && !ROLES_SANS_ECRAN.includes(r));
    if (!autorise) {
      fermerSession();
      routeur.replace(CONNEXION[espace]);
      return;
    }
    setAgent(a);
  }, [routeur, espace]);

  if (!agent) {
    return (
      <main className="page" aria-busy="true">
        <div className="squelette" style={{ height: 220 }} />
      </main>
    );
  }

  const sections = espace === "admin" ? SECTIONS_ADMIN : SECTIONS_AGENT;
  const visibles = sectionsVisibles(sections, agent.roles);
  const courante = sectionCourante(sections, chemin);

  // Une adresse accessible par URL mais interdite au compte : on le dit, sans
  // page blanche ni redirection muette.
  const interdite = courante && !sectionAutorisee(courante, agent.roles);

  return (
    <div className="coquille">
      <aside className="lateral">
        <div className="lateral__marque">
          <Goutte taille={18} />
          <span className="pile-s" style={{ gap: 0 }}>
            <span className="lateral__nom">{MARQUE}</span>
            <span className="lateral__espace">{espace === "admin" ? "Espace CNTS" : "Espace agent"}</span>
          </span>
        </div>

        <nav className="lateral__menu" aria-label="Navigation principale">
          {visibles.map((section) => {
            if (section.children?.length) {
              return <GroupeLateral key={section.mot} section={section} chemin={chemin} />;
            }
            const actif = chemin === section.adresse || chemin.startsWith(`${section.adresse}/`);
            return (
              <Link
                key={section.adresse}
                href={section.adresse}
                className={`lateral__lien${actif ? " lateral__lien--actif" : ""}`}
                aria-current={actif ? "page" : undefined}
              >
                <section.Icone size={19} aria-hidden="true" />
                <span>{section.mot}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profil : avatar, nom, rôle. Les rôles multiples ne sont plus
            concaténés en une ligne tronquée (« Laborat… ») : on affiche le
            rôle principal, le détail reste dans l'info-bulle. */}
        <div className="lateral__pied">
          <div className="lateral__profil">
            <span className="lateral__avatar" aria-hidden="true">{initiales(agent.nomComplet)}</span>
            <span className="lateral__identite">
              <span className="lateral__profil-nom">{agent.nomComplet}</span>
              <span className="lateral__profil-role" title={rolesLisibles(agent.roles)}>
                {rolePrincipal(agent.roles, espace)}
              </span>
            </span>
          </div>
          <button
            className="lateral__deconnexion"
            onClick={() => { fermerSession(); routeur.replace(CONNEXION[espace]); }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      <main className="contenu">
        {interdite ? <AccesRefuse section={courante} /> : children}
      </main>
    </div>
  );
}

/** Groupe dépliable de la barre latérale (ex. « Échanges » → Recevoir, Donner). */
function GroupeLateral({ section, chemin }: { section: Section; chemin: string }) {
  const dansLeGroupe = (section.children ?? []).some((c) => chemin === c.adresse || chemin.startsWith(`${c.adresse}/`));
  const [ouvert, setOuvert] = useState(!!dansLeGroupe);

  // En naviguant vers un enfant, on ouvre le groupe pour le montrer.
  useEffect(() => {
    if (dansLeGroupe) setOuvert(true);
  }, [dansLeGroupe]);

  return (
    <div className="lateral__groupe">
      <button type="button" className="lateral__groupe-titre" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
        <section.Icone size={19} aria-hidden="true" />
        <span>{section.mot}</span>
        <ChevronDown size={16} className={`lateral__groupe-fleche${ouvert ? " lateral__groupe-fleche--ouverte" : ""}`} aria-hidden="true" />
      </button>
      {ouvert && section.children?.map((enfant) => {
        const actif = chemin === enfant.adresse || chemin.startsWith(`${enfant.adresse}/`);
        return (
          <Link
            key={enfant.adresse}
            href={enfant.adresse}
            className={`lateral__lien lateral__lien--enfant${actif ? " lateral__lien--actif" : ""}`}
            aria-current={actif ? "page" : undefined}
          >
            <enfant.Icone size={19} aria-hidden="true" />
            <span>{enfant.mot}</span>
          </Link>
        );
      })}
    </div>
  );
}

function AccesRefuse({ section }: { section: Section }) {
  return (
    <>
      <EnTetePage titre="Accès réservé" />
      <div className="bloc pile-s">
        <p className="appui">
          « {section.mot} » demande un rôle que votre compte n'a pas.
          Demandez-le à l'administrateur du CNTS.
        </p>
      </div>
    </>
  );
}

/** Initiales de l'avatar : deux lettres maximum, jamais vides. */
function initiales(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

/**
 * Rôle affiché sous le nom. Un agent cumule souvent plusieurs rôles ; les
 * concaténer tronque la ligne. On nomme donc le métier d'ensemble, et le
 * détail reste accessible en info-bulle.
 */
function rolePrincipal(roles: AgentConnecte["roles"], espace: Espace): string {
  if (espace === "admin") return "Administrateur CNTS";
  const agents = roles.filter((r) => r.startsWith("agent_"));
  if (agents.length === 0) return "Agent";
  if (agents.length === 1) return `Agent · ${LIBELLE_ROLE[agents[0]] ?? agents[0]}`;
  return `Agent · ${agents.length} postes`;
}

/** Liste complète des rôles, pour l'attribut title. */
function rolesLisibles(roles: AgentConnecte["roles"]): string {
  return roles.map((r) => LIBELLE_ROLE[r] ?? r).join(" · ");
}

/** En-tête d'un écran de travail : titre, phrase d'explication, actions. */
export function EnTetePage({ titre, chapeau, actions }: {
  titre: string;
  chapeau?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="contenu__entete">
      <div>
        <h1 className="contenu__titre">{titre}</h1>
        {chapeau && <p className="contenu__chapeau">{chapeau}</p>}
      </div>
      {actions && <div className="rang" style={{ flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}
