import { Droplet } from "lucide-react";

/**
 * Marque visuelle de Djigui : la goutte dans sa pastille.
 *
 * Un seul endroit la dessine, pour que le portail, les deux portes de
 * connexion et les barres latérales ne divergent jamais.
 */
export default function Goutte({ taille = 24, clair = false }: {
  taille?: number;
  /** Variante pour fond sombre : pastille translucide, goutte blanche. */
  clair?: boolean;
}) {
  return (
    <span
      className={`goutte${clair ? " goutte--clair" : ""}`}
      style={{ width: taille * 1.6, height: taille * 1.6 }}
    >
      <Droplet size={taille} aria-hidden="true" />
    </span>
  );
}
