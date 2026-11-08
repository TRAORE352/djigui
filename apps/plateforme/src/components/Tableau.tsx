"use client";
/**
 * Tableau de travail. Les agents lisent ces écrans en rafale : en-têtes
 * courts, chiffres alignés à droite, une seule action par ligne.
 *
 * Sous 900 px le tableau défile horizontalement plutôt que de se tasser :
 * un code de poche tronqué ne sert à rien.
 */
import type { ReactNode } from "react";

export type Colonne<T> = {
  cle: string;
  entete: string;
  /** Contenu de la cellule. */
  rendu: (ligne: T) => ReactNode;
  /** Chiffres : alignés à droite en police tabulaire. */
  nombre?: boolean;
  /** Actions : alignées à droite, sans retour à la ligne. */
  actions?: boolean;
};

export default function Tableau<T>({ colonnes, lignes, cle, legende }: {
  colonnes: Colonne<T>[];
  lignes: T[];
  cle: (ligne: T, index: number) => string;
  /** Résumé lu par les lecteurs d'écran. */
  legende: string;
}) {
  return (
    <div className="tableau-cadre">
      <div className="tableau-defile">
        <table className="tableau">
          <caption className="sr-only">{legende}</caption>
          <thead>
            <tr>
              {colonnes.map((c) => (
                <th key={c.cle} scope="col" style={c.nombre || c.actions ? { textAlign: "right" } : undefined}>
                  {c.entete}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, i) => (
              <tr key={cle(ligne, i)}>
                {colonnes.map((c) => (
                  <td
                    key={c.cle}
                    className={c.nombre ? "tableau__nombre" : undefined}
                  >
                    {c.actions ? <div className="tableau__actions">{c.rendu(ligne)}</div> : c.rendu(ligne)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
