"use client";
/**
 * Carte d'une demande de produits, vue du côté « demandeur » ou « fournisseur ».
 * Partagée entre les écrans Recevoir et Donner.
 */
import { useState } from "react";
import { PackagePlus, Send } from "lucide-react";
import type { Demande } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_PRODUIT, URGENCE, dateCourte, statutDemande } from "@/lib/metier";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { MessageErreur } from "@/components/Messages";

export function CarteDemande({ demande, role, surAction }: {
  demande: Demande;
  role: "fournisseur" | "demandeur";
  surAction: () => void;
}) {
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const statut = statutDemande(demande.statut);
  const unites = demande.lignes.reduce((t, l) => t + l.quantite, 0);

  async function accepter() {
    setErreur(""); setEnCours(true);
    try {
      await api.accepterDemande(demande.id);
      surAction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  async function recevoir() {
    setErreur(""); setEnCours(true);
    try {
      await api.recevoirDemande(demande.id);
      surAction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  const attendAcceptation = role === "fournisseur" && demande.statut === "en_attente";
  const attendReception = role === "demandeur" && demande.statut === "acceptee";

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 2 }}>
          <span className="titre-s">
            {role === "fournisseur" ? demande.siteDemandeurNom : demande.siteFournisseurNom}
          </span>
          <span className="petit">
            {unites > 0 ? `${unites} unité${unites > 1 ? "s" : ""} · demandé le ${dateCourte(demande.date)}` : `Quantité à préciser · ${dateCourte(demande.date)}`}
          </span>
        </div>
        <div className="rang" style={{ flexWrap: "wrap" }}>
          <Pilule ton={URGENCE[demande.urgence as keyof typeof URGENCE]?.ton ?? "neutre"}>
            {URGENCE[demande.urgence as keyof typeof URGENCE]?.mot ?? demande.urgence}
          </Pilule>
          <Pilule ton={statut.ton}>{statut.mot}</Pilule>
        </div>
      </div>

      <div className="pile-s">
        {demande.lignes.map((l, i) => <LigneProduit key={i} ligne={l} />)}
      </div>

      {attendAcceptation && (
        <div className="rang">
          <Bouton icone={<Send size={18} aria-hidden="true" />} enCours={enCours} onClick={() => void accepter()}>
            Demande acceptée
          </Bouton>
          <span className="petit">Votre stock sort dès que vous acceptez.</span>
        </div>
      )}

      {attendReception && (
        <div className="rang">
          <Bouton icone={<PackagePlus size={18} aria-hidden="true" />} enCours={enCours} onClick={() => void recevoir()}>
            Colis reçu et vérifié conforme
          </Bouton>
          <span className="petit">Votre stock est mis à jour à la réception.</span>
        </div>
      )}

      {role === "fournisseur" && demande.statut === "livree" && (
        <Pilule ton="seve">Colis livré avec succès</Pilule>
      )}

      <MessageErreur>{erreur}</MessageErreur>
    </div>
  );
}

export function LigneProduit({ ligne }: { ligne: Demande["lignes"][number] }) {
  return (
    <div className="ligne">
      <BlocGroupe groupe={ligne.groupeSanguin} taille="s" />
      <div className="ligne__corps">
        <span className="fort">{TYPE_PRODUIT[ligne.typeProduit].mot}</span>
        <span className="petit">{TYPE_PRODUIT[ligne.typeProduit].detail}</span>
      </div>
      <span className="fort chiffres">×{ligne.quantite}</span>
    </div>
  );
}
