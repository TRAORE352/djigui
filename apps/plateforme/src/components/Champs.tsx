"use client";
/**
 * Champs de formulaire de l'espace agent. Chaque champ a une étiquette
 * visible et une erreur affichée juste en dessous. (Repris, réduit, de
 * apps/donneur/src/components/Champs.tsx.)
 */
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type Commun = { etiquette: string; aide?: ReactNode; erreur?: string };

function Cadre({ id, etiquette, aide, erreur, children }: Commun & { id: string; children: ReactNode }) {
  return (
    <div className={`champ${erreur ? " champ--erreur" : ""}`}>
      <label className="champ__etiquette" htmlFor={id}>{etiquette}</label>
      {children}
      {erreur ? (
        <span className="champ__aide-erreur" id={`${id}-erreur`}>{erreur}</span>
      ) : aide ? (
        <span className="champ__aide" id={`${id}-aide`}>{aide}</span>
      ) : null}
    </div>
  );
}

const decrit = (id: string, erreur?: string, aide?: ReactNode) =>
  erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;

export function ChampTexte({ etiquette, aide, erreur, ...entree }:
  Commun & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Cadre id={id} etiquette={etiquette} aide={aide} erreur={erreur}>
      <span className="champ__groupe">
        <input id={id} className="champ__saisie" aria-invalid={!!erreur}
               aria-describedby={decrit(id, erreur, aide)} {...entree} />
      </span>
    </Cadre>
  );
}

export function ChampMotDePasse({ etiquette, aide, erreur, valeur, surChange }:
  Commun & { valeur: string; surChange: (v: string) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Cadre id={id} etiquette={etiquette} aide={aide} erreur={erreur}>
      <span className="champ__groupe">
        <input
          id={id} className="champ__saisie" type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={valeur} onChange={(e) => surChange(e.target.value)}
          aria-invalid={!!erreur} aria-describedby={decrit(id, erreur, aide)}
        />
        <button type="button" className="champ__interne" onClick={() => setVisible(!visible)}
                aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          {visible ? "Masquer" : "Afficher"}
        </button>
      </span>
    </Cadre>
  );
}
