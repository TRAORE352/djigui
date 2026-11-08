/**
 * États d'un écran de travail : chargement, vide, erreur.
 * Un écran vide n'est jamais muet : il dit pourquoi il est vide et quoi faire.
 */
import type { ComponentType, ReactNode } from "react";
import { Inbox, TriangleAlert } from "lucide-react";
import Bouton from "./Bouton";

export function Squelette({ hauteur = 160 }: { hauteur?: number }) {
  return <div className="squelette" style={{ height: hauteur }} role="status" aria-label="Chargement" />;
}

/** Plusieurs lignes grises, à la forme du tableau qui va les remplacer. */
export function SqueletteLignes({ lignes = 4 }: { lignes?: number }) {
  return (
    <div className="pile-s" role="status" aria-label="Chargement">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="squelette" style={{ height: 56, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function EtatVide({
  titre, texte, Icone = Inbox, action,
}: {
  titre: string;
  texte?: string;
  Icone?: ComponentType<{ size?: number; "aria-hidden"?: "true" }>;
  action?: ReactNode;
}) {
  return (
    <div className="etat-vide">
      <span className="etat-vide__icone"><Icone size={22} aria-hidden="true" /></span>
      <span className="etat-vide__titre">{titre}</span>
      {texte && <span className="etat-vide__texte">{texte}</span>}
      {action}
    </div>
  );
}

/** Erreur de chargement : on dit ce qui a échoué et on propose de réessayer. */
export function EtatErreur({ texte, surReessai }: { texte: string; surReessai?: () => void }) {
  return (
    <div className="etat-vide">
      <span className="etat-vide__icone" style={{ background: "var(--sang-clair)", color: "var(--sang)" }}>
        <TriangleAlert size={22} aria-hidden="true" />
      </span>
      <span className="etat-vide__titre">Chargement impossible</span>
      <span className="etat-vide__texte" role="alert">{texte}</span>
      {surReessai && <Bouton variante="secondaire" onClick={surReessai}>Réessayer</Bouton>}
    </div>
  );
}
