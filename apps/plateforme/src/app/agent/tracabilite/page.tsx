"use client";
/**
 * P9 — Traçabilité.
 *
 * Un code, toute l'histoire : du donneur au service qui a reçu le produit.
 * C'est l'écran qu'on ouvre quand quelque chose doit être prouvé — donc il
 * montre tout, dans l'ordre chronologique, sans rien résumer.
 */
import { useState } from "react";
import { ScanLine, Search } from "lucide-react";
import type { FicheTracabilite } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { STATUT_POCHE, dateCourte } from "@/lib/metier";
import { dateHeure } from "@/lib/format";
import { EnTetePage } from "@/components/Coquille";
import Explication from "@/components/Explication";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { EtatVide } from "@/components/Etats";
import { MessageErreur } from "@/components/Messages";

/** Les types d'événements écrits par le backend, en français. */
const EVENEMENT: Record<string, string> = {
  inscription: "Inscription du donneur",
  passage: "Venue au centre",
  prelevement: "Prélèvement",
  analyse: "Analyse au laboratoire",
  preparation: "Préparation des produits",
  expedition: "Expédition vers un autre site",
  reception: "Réception sur le site",
  delivrance: "Délivrance à un service",
  destruction: "Sortie du stock",
};

export default function Tracabilite() {
  const [code, setCode] = useState("");
  const [fiche, setFiche] = useState<FicheTracabilite | null>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function rechercher(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setFiche(null); setEnCours(true);
    try {
      setFiche(await api.fiche(code.trim()));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <EnTetePage
        titre="Traçabilité"
        chapeau="Saisissez ou scannez le code d'une poche ou d'un produit pour voir son histoire complète."
      />

      <Explication
        Icone={ScanLine}
        role="Retrouver toute l'histoire d'une poche à partir de son code : quel donneur, quel jour, quelles analyses, et vers quel hôpital elle est partie."
        quand="En cas de problème sur un patient, lors d'un contrôle, ou pour répondre à une question d'un hôpital."
        ensuite="C'est une consultation : rien n'est modifié depuis cet écran."
      />

      <form className="bloc rang" style={{ flexWrap: "wrap" }} onSubmit={rechercher}>
        <label className="champ" style={{ flex: 1, minWidth: 240 }}>
          <span className="champ__etiquette">Code de la poche ou du produit</span>
          <input
            className="champ__saisie chiffres"
            value={code}
            autoComplete="off"
            placeholder="OUA-26-04812-K"
            onChange={(e) => { setCode(e.target.value); setErreur(""); }}
          />
          <span className="champ__aide">Les tirets et la casse sont ignorés : « oua2604812k » fonctionne aussi.</span>
        </label>
        <Bouton type="submit" icone={<Search size={18} aria-hidden="true" />}
                enCours={enCours} motEnCours="Recherche…" disabled={!code.trim()}>
          Consulter
        </Bouton>
      </form>

      <MessageErreur>{erreur}</MessageErreur>

      {!fiche && !erreur && (
        <EtatVide
          Icone={ScanLine}
          titre="Aucun code consulté"
          texte="Chaque poche porte un code unique généré au prélèvement ; chaque produit en dérive. Les deux sont acceptés ici."
        />
      )}

      {fiche && <Fiche fiche={fiche} />}
    </>
  );
}

function Fiche({ fiche }: { fiche: FicheTracabilite }) {
  const statut = STATUT_POCHE[fiche.statut as keyof typeof STATUT_POCHE];

  return (
    <section className="pile">
      <div className="bloc pile">
        <div className="rang-espace" style={{ flexWrap: "wrap" }}>
          <div className="rang">
            {fiche.groupeSanguin
              ? <BlocGroupe groupe={fiche.groupeSanguin} taille="l" />
              : <span className="bloc-groupe bloc-groupe--l" style={{ background: "var(--trait)", color: "var(--encre-2)" }}>?</span>}
            <div className="pile-s" style={{ gap: 0 }}>
              <span className="titre chiffres" style={{ letterSpacing: "0.03em" }}>{fiche.code}</span>
              <span className="appui">{fiche.type === "poche" ? "Poche de sang total" : "Produit sanguin"}</span>
            </div>
          </div>
          <Pilule ton={statut?.ton ?? "neutre"}>{statut?.mot ?? fiche.statut.replace(/_/g, " ")}</Pilule>
        </div>

        <div className="fiche">
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Groupe sanguin</span>
            <span className="fiche__valeur">{fiche.groupeSanguin ?? "Non encore déterminé"}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Donneur</span>
            <span className="fiche__valeur chiffres">{fiche.donneur?.numeroDonneur ?? "—"}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Site d'origine</span>
            <span className="fiche__valeur">{fiche.site}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Date de prélèvement</span>
            <span className="fiche__valeur">{dateCourte(fiche.date)}</span>
          </div>
        </div>
      </div>

      <div className="bloc pile">
        <h2 className="section-titre">Histoire du produit</h2>
        {fiche.evenements.length === 0 ? (
          <p className="appui">Aucun événement enregistré pour ce code.</p>
        ) : (
          <ol className="frise" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {fiche.evenements.map((e, i) => (
              <li key={i} className="frise__etape">
                <span className="frise__puce" aria-hidden="true" />
                <div className="frise__corps">
                  <span className="fort">{EVENEMENT[e.type] ?? e.type.replace(/_/g, " ")}</span>
                  <span className="appui">{dateHeure(e.date)}</span>
                  <span className="petit">
                    {[e.agent, e.site].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
