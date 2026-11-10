import type { CodeErreur } from "@dds/contrat-api";

/** Erreur renvoyée par l'API (ou par le simulateur), prête à être affichée. */
export class ErreurApi extends Error {
  constructor(
    message: string,
    /**
     * `RESEAU` = le poste n'a pas pu joindre le service.
     * `DELAI_DEPASSE` = le service a accepté la connexion mais n'a pas
     * répondu à temps. Les deux sont locaux au client : ils ne viennent
     * pas du contrat d'API.
     */
    public code: CodeErreur | "RESEAU" | "DELAI_DEPASSE",
    /** Champ de la requête en cause, pour afficher l'erreur au bon endroit. */
    public champ?: string,
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

export function messageDe(probleme: unknown): string {
  if (probleme instanceof ErreurApi) return probleme.message;
  return "Quelque chose n’a pas fonctionné. Réessayez dans un instant.";
}
