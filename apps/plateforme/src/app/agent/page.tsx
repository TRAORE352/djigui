"use client";
/**
 * Poste de travail de l'agent : les seules portes qu'il peut ouvrir,
 * avec la phrase qui dit à quoi chacune sert. Un agent de laboratoire
 * ne voit pas la distribution, et inversement.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { AgentConnecte } from "@dds/contrat-api";
import { EnTetePage } from "@/components/Coquille";
import { LIBELLE_ROLE, SECTIONS_AGENT, sectionsVisibles } from "@/lib/navigation";
import { lireAgent } from "@/lib/session";

export default function PosteDeTravail() {
  const [agent, setAgent] = useState<AgentConnecte | null>(null);
  useEffect(() => { setAgent(lireAgent()); }, []);

  if (!agent) return <div className="squelette" style={{ height: 200 }} />;

  // Le poste de travail lui-même ne figure pas dans ses propres raccourcis.
  const sections = sectionsVisibles(SECTIONS_AGENT, agent.roles).filter((s) => s.adresse !== "/agent");
  const prenom = agent.nomComplet.split(" ")[0];

  return (
    <>
      <EnTetePage
        titre={`Bonjour ${prenom}`}
        chapeau={`Vous êtes connecté avec ${agent.roles.length > 1 ? "les rôles" : "le rôle"} ${agent.roles.map((r) => LIBELLE_ROLE[r] ?? r).join(", ").toLowerCase()}. Voici ce que vous pouvez faire aujourd'hui.`}
      />

      <div className="grille-indicateurs">
        {sections.map(({ adresse, mot, resume, Icone }) => (
          <Link key={adresse} href={adresse} className="raccourci">
            <span className="raccourci__icone"><Icone size={19} aria-hidden="true" /></span>
            <span className="raccourci__titre">{mot}</span>
            <span className="petit">{resume}</span>
            <span className="appui rang" style={{ gap: "var(--e1)", color: "var(--primaire)", marginTop: "var(--e2)" }}>
              Ouvrir <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
