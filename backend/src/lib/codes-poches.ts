/**
 * Codes des poches et des produits (cahier des charges, Partie II).
 *
 * Format d'une poche : OUA-26-04812-K
 *   OUA   code du site (3 lettres)
 *   26    année du prélèvement (2 chiffres)
 *   04812 numéro séquentiel dans le site pour l'année (5 chiffres)
 *   K     lettre de contrôle, calculée à partir du reste
 *
 * Format d'un produit : OUA-26-04812-K-GR (suffixe du type).
 *
 * La lettre de contrôle détecte les fautes de frappe. La saisie est souple :
 * les majuscules, minuscules et tirets ne comptent pas (« oua2604812k » est
 * accepté).
 */

// Alphabet sans les caractères faciles à confondre (0/O, 1/I/l) — même règle
// que pour les codes de centre et la lettre de contrôle.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Lettre de contrôle d'un code, par somme pondérée des positions. */
export function calculerLettreControle(partie: string): string {
  let somme = 0;
  for (let i = 0; i < partie.length; i++) {
    somme += partie.charCodeAt(i) * (i + 1);
  }
  return ALPHABET[somme % ALPHABET.length];
}

/** Normalise un code saisi : majuscules, tirets et espaces retirés. */
export function normaliserCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Construit un code de poche : OUA-26-04812-K. */
export function genererCodePoche(siteCode: string, annee: number, numero: number): string {
  const annee2 = String(annee).slice(-2);
  const numero5 = String(numero).padStart(5, "0");
  const partie = `${siteCode}${annee2}${numero5}`;
  return `${siteCode}-${annee2}-${numero5}-${calculerLettreControle(partie)}`;
}

/** Construit le code d'un produit à partir de celui de sa poche. */
export function genererCodeProduit(codePoche: string, typeProduit: string): string {
  return `${codePoche}-${typeProduit}`;
}

/** Vérifie qu'un code de poche est bien formé (y compris sa lettre de contrôle). */
export function codePocheValide(code: string): boolean {
  const n = normaliserCode(code);
  const m = n.match(/^([A-Z]{3})(\d{2})(\d{5})([A-Z])$/);
  if (!m) return false;
  return calculerLettreControle(`${m[1]}${m[2]}${m[3]}`) === m[4];
}

/**
 * Code d'une unité reçue de l'extérieur : OUA-E26-00014-GR-K.
 *
 * Le « E » (Externe) juste après le site distingue d'un coup d'œil une
 * unité LIVRÉE d'une unité prélevée et qualifiée sur place. C'est une
 * information de traçabilité : en cas de rappel, on doit pouvoir dire
 * immédiatement si l'unité vient de notre chaîne ou d'un fournisseur.
 *
 * Le numéro est celui du rang de l'unité dans le lot ; la lettre de
 * contrôle protège la saisie manuelle, comme pour les poches.
 */
export function genererCodeExterne(
  siteCode: string,
  annee: number,
  numero: number,
  typeProduit: string,
): string {
  const annee2 = String(annee).slice(-2);
  const numero5 = String(numero).padStart(5, "0");
  const partie = `${siteCode}E${annee2}${numero5}${typeProduit}`;
  return `${siteCode}-E${annee2}-${numero5}-${typeProduit}-${calculerLettreControle(partie)}`;
}
