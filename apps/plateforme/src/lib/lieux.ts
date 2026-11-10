/**
 * Lieux de collecte : les centres de santé publics connus de chaque ville.
 *
 * L'agent choisit le lieu où se tiendra la collecte. La liste couvre les
 * quatre villes de la démo ; pour un lieu hors centre de santé (école,
 * marché…), il le saisit librement sur la carte (voir RechercheLieu).
 *
 * Données de référence provisoires, alignées sur le seed des zones.
 */
export const LIEUX_COLLECTE: Record<string, string[]> = {
  "Ouagadougou": [
    "CHU Yalgado Ouédraogo",
    "CHU de Bogodogo",
    "CHU de Tengandogo",
    "Hôpital Saint Camille",
    "CMA de Pissy",
    "CSPS de Dassasgho",
    "CSPS de Gounghin",
  ],
  "Bobo-Dioulasso": [
    "CHU Sourô Sanou",
    "CMA de Dafra",
    "CSPS de Bolomakoté",
    "CSPS de Tounouma",
  ],
  "Koudougou": [
    "CHR de Koudougou",
    "CMA de Koudougou",
    "CSPS de Dapoya",
  ],
  "Ouahigouya": [
    "CHR de Ouahigouya",
    "CMA de Ouahigouya",
  ],
};

/** Les centres de santé de la ville, ou une liste vide si la ville est inconnue. */
export function lieuxDeLaVille(ville: string): string[] {
  return LIEUX_COLLECTE[ville] ?? [];
}
