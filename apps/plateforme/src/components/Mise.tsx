"use client";
/**
 * Briques de mise en page des écrans de travail.
 *
 * Le défaut qu'elles corrigent : des sections empilées au même niveau,
 * sans hiérarchie, où un bloc vide prend autant de place qu'un bloc plein.
 * Ici une section annonce son nombre d'éléments, et ce qui est vide tient
 * en une ligne.
 */
import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import Aide from "@/components/Aide";

/**
 * Une section de l'écran : titre, compteur, et action à droite.
 *
 * `aide` pose une pastille contre le titre : ce qu'il fallait autrefois
 * écrire en toutes lettres sous le titre (ou dans un état vide bavard)
 * se lit maintenant au clic, et la section tient sur une ligne.
 */
export function Section({ titre, compte, aide, action, children }: {
  titre: string;
  /** Nombre d'éléments ; la pastille grise quand c'est zéro. */
  compte?: number;
  /** Explication accessible au clic, à côté du titre. */
  aide?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section__entete">
        <h2 className="section__titre">
          {titre}
          {compte !== undefined && (
            <span className={`section__compte${compte === 0 ? " section__compte--vide" : ""}`}
                  style={{ marginLeft: "var(--e3)" }}>
              {compte}
            </span>
          )}
          {aide && <Aide etiquette={titre}>{aide}</Aide>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Rien à afficher : une ligne qui l'explique, pas un panneau.
 * Réservé aux sections secondaires ; l'écran entièrement vide garde
 * l'état illustré (EtatVide).
 */
export function VideLigne({ children, Icone = Inbox }: {
  children: ReactNode;
  Icone?: ComponentType<{ size?: number; "aria-hidden"?: "true" }>;
}) {
  return (
    <p className="vide-ligne">
      <Icone size={18} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Section repliable. Ce qui ne sert pas à chaque passage (délivrer un
 * produit, créer une demande) reste fermé et n'encombre pas l'écran.
 */
export function Repli({ titre, resume, ouvertParDefaut = false, children }: {
  titre: string;
  resume?: string;
  ouvertParDefaut?: boolean;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  return (
    <div className="repli">
      <button
        type="button"
        className="repli__bouton"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        <span className="pile-s" style={{ gap: 0, alignItems: "flex-start" }}>
          <span>{titre}</span>
          {resume && <span className="petit">{resume}</span>}
        </span>
        <ChevronRight size={20} className="repli__fleche" aria-hidden="true" />
      </button>
      {ouvert && <div className="repli__corps">{children}</div>}
    </div>
  );
}
