import type { GroupeSanguin } from "@dds/contrat-api";

/**
 * Bloc de groupe sanguin, élément signature repris de DJIGUI.
 * Il ne change jamais de couleur selon l'état : c'est le texte autour
 * qui porte la différence (niveau du stock, par exemple).
 */
export default function BlocGroupe({ groupe, taille = "m" }: { groupe: GroupeSanguin; taille?: "s" | "m" | "l" }) {
  return (
    <span className={`bloc-groupe bloc-groupe--${taille}`} aria-label={`Groupe ${groupe}`}>
      {groupe}
    </span>
  );
}
