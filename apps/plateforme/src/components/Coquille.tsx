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
import { LogOut } from "lucide-react";
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
    // Un compte ne peut être que dans SON espace. Un agent qui ouvre une
    // adresse de l'espace CNTS est renvoyé à la connexion CNTS, pas
    // glissé en douce dans l'autre espace.
    const autorise = espace === "admin"
      ? a.roles.includes("admin")
      : a.roles.some((r) => r.startsWith("agent_"));
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
          {visibles.map(({ adresse, mot, Icone }) => {
            const actif = chemin === adresse || chemin.startsWith(`${adresse}/`);
            return (
              <Link
                key={adresse}
                href={adresse}
                className={`lateral__lien${actif ? " lateral__lien--actif" : ""}`}
                aria-current={actif ? "page" : undefined}
              >
                <Icone size={19} aria-hidden="true" />
                <span>{mot}</span>
              </Link>
            );
          })}
        </nav>

        <div className="lateral__pied">
          <span className="lateral__agent">
            <span className="fort petit">{agent.nomComplet}</span>
            <span className="petit">{agent.roles.map((r) => LIBELLE_ROLE[r] ?? r).join(" · ")}</span>
          </span>
          <button
            className="lateral__lien"
            onClick={() => { fermerSession(); routeur.replace(CONNEXION[espace]); }}
          >
            <LogOut size={19} aria-hidden="true" />
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
