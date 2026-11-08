"use client";
/**
 * Chargement d'une ressource d'API : état de chargement, erreur, et
 * rechargement à la demande. Une seule implémentation pour les deux espaces.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { messageDe } from "@/lib/erreurs";

export type Ressource<T> = {
  donnees: T | null;
  erreur: string;
  chargement: boolean;
  recharger: () => Promise<void>;
  setDonnees: (maj: T | ((precedent: T | null) => T | null) | null) => void;
};

export function useRessource<T>(charger: () => Promise<T>, actif = true): Ressource<T> {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(actif);

  // La fonction de chargement est recréée à chaque rendu par l'appelant :
  // on la garde dans une référence pour ne pas relancer l'appel en boucle.
  const reference = useRef(charger);
  reference.current = charger;

  const recharger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      setDonnees(await reference.current());
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { if (actif) void recharger(); }, [recharger, actif]);

  return { donnees, erreur, chargement, recharger, setDonnees };
}
