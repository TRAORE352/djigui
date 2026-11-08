/**
 * Mise en forme : une date s'écrit toujours de la même façon, quel que
 * soit l'écran. (Repris de apps/donneur/src/lib/format.ts.)
 */

/** 12 novembre à 18h00 */
export function dateHeure(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const d = new Date(valeur);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(d);
  return `${jour} à ${h}h${m}`;
}

/** « il y a 3 heures », « hier », « le 12 novembre » */
export function depuis(valeur: string): string {
  const minutes = Math.floor((Date.now() - new Date(valeur).getTime()) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${pluriel(minutes, "minute")}`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${pluriel(heures, "heure")}`;
  if (heures < 48) return "hier";
  return `le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(valeur))}`;
}

/** 1 jour, 2 jours */
export function pluriel(nombre: number, singulier: string, plurielMot?: string): string {
  return `${nombre} ${nombre > 1 ? (plurielMot ?? `${singulier}s`) : singulier}`;
}
