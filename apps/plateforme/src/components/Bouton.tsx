import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secondaire" | "danger";
  large?: boolean;
  compact?: boolean;
  /** Pendant l'envoi : le bouton se désactive et affiche motEnCours. */
  enCours?: boolean;
  motEnCours?: string;
  icone?: ReactNode;
};

export default function Bouton({
  variante = "principal", large, compact, enCours, motEnCours, icone,
  className = "", children, disabled, type = "button", ...reste
}: Props) {
  const classes = [
    "bouton", `bouton--${variante}`, large && "bouton--large", compact && "bouton--compact", className,
  ].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} disabled={disabled || enCours} aria-busy={enCours} {...reste}>
      {enCours ? (
        <>
          <LoaderCircle size={18} className="tourne" aria-hidden="true" />
          {motEnCours ?? children}
        </>
      ) : (
        <>
          {icone}
          {children}
        </>
      )}
    </button>
  );
}
