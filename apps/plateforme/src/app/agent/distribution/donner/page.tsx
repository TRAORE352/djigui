"use client";
/**
 * Distribution — Donner : je consulte les demandes qui me sont adressées, je
 * les accepte (mon stock sort aussitôt) et je vois la livraison se clore.
 */
import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import type { Demande } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { useRessource } from "@/lib/useRessource";
import { lireAgent } from "@/lib/session";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Section } from "@/components/Mise";
import { CarteDemande } from "@/components/CarteDemande";

export default function Donner() {
  const demandes = useRessource<Demande[]>(() => api.demandes());
  const [siteId, setSiteId] = useState("");
  useEffect(() => { setSiteId(lireAgent()?.siteId ?? ""); }, []);

  const recues = useMemo(
    () => (demandes.donnees ?? []).filter((d) => d.siteFournisseurId === siteId),
    [demandes.donnees, siteId],
  );

  return (
    <>
      <EnTetePage
        titre="Donner"
        chapeau="Répondre aux demandes de sang qui vous sont adressées."
        actions={<Bouton variante="secondaire" onClick={() => void demandes.recharger()}>Actualiser</Bouton>}
      />

      <Section titre="Demandes reçues" compte={recues.length}>
        {demandes.chargement && !demandes.donnees && <SqueletteLignes lignes={3} />}
        {demandes.erreur && <EtatErreur texte={demandes.erreur} surReessai={() => void demandes.recharger()} />}
        {demandes.donnees && recues.length === 0 && (
          <EtatVide Icone={Truck} titre="Aucune demande reçue" texte="Les demandes des hôpitaux et dépôts apparaîtront ici." ton="doux" />
        )}
        {recues.map((d) => (
          <CarteDemande key={d.id} demande={d} role="fournisseur" surAction={() => void demandes.recharger()} />
        ))}
      </Section>
    </>
  );
}
