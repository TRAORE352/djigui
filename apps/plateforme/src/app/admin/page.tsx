"use client";
/**
 * Tableau de bord du CNTS — l'état du réseau en temps réel.
 *
 * Deux volets : les chiffres clés (un seul panneau) et le journal d'activité
 * des agents et du laboratoire, rafraîchi en continu.
 */
import { useEffect } from "react";
import Link from "next/link";
import type { Evenement, Statistiques } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { useRessource } from "@/lib/useRessource";
import { libelleEvenement } from "@/lib/metier";
import { depuis } from "@/lib/format";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import { EtatErreur, Squelette, SqueletteLignes } from "@/components/Etats";
import { VideLigne } from "@/components/Mise";

type Carte = {
  libelle: string;
  valeur: number;
  detail: string;
  ton?: "seve" | "ocre" | "sang";
  lien?: { adresse: string; mot: string };
};

export default function TableauDeBord() {
  const { donnees: stats, erreur, chargement, recharger } = useRessource<Statistiques>(() => api.statistiques());
  const activite = useRessource<Evenement[]>(() => api.activite());

  // Rafraîchi en continu : les chiffres chaque minute, l'activité toutes les 15 secondes.
  useEffect(() => {
    const minuteur = setInterval(() => { void recharger(); void activite.recharger(); }, 60_000);
    return () => clearInterval(minuteur);
  }, [recharger, activite.recharger]);
  useEffect(() => {
    const minuteur = setInterval(() => { void activite.recharger(); }, 15_000);
    return () => clearInterval(minuteur);
  }, [activite.recharger]);

  if (chargement && !stats) {
    return (<><BoutonHaut recharger={recharger} /><Squelette hauteur={240} /></>);
  }
  if (erreur && !stats) {
    return (<><BoutonHaut recharger={recharger} /><EtatErreur texte={erreur} surReessai={() => void recharger()} /></>);
  }
  if (!stats) return null;

  const cartes: Carte[] = [
    { libelle: "Alertes en cours", valeur: stats.alertesEnCours, detail: "appels aux donneurs encore ouverts", ton: "sang", lien: { adresse: "/agent/alertes", mot: "Voir les alertes" } },
    { libelle: "Demandes en attente", valeur: stats.demandesEnAttente, detail: "à accepter par la distribution", ton: "ocre", lien: { adresse: "/agent/distribution/donner", mot: "Voir les demandes" } },
    { libelle: "Dons aujourd'hui", valeur: stats.donsAujourdhui, detail: "donneurs déclarés aptes et prélevés" },
    { libelle: "Poches en analyse", valeur: stats.pochesEnAnalyse, detail: "au laboratoire, pas encore qualifiées", ton: "ocre" },
    { libelle: "Produits disponibles", valeur: stats.produitsDisponibles, detail: "en stock ou réservés sur le réseau", ton: "seve" },
    { libelle: "Donneurs inscrits", valeur: stats.donneurs.total, detail: `${stats.donneurs.actifs} actifs · ${stats.donneurs.enPause} en pause` },
  ];

  return (
    <>
      <header className="bord-entete">
        <div className="bord-entete__gauche">
          <h1 className="bord-entete__titre">Tableau de bord du CNTS</h1>
          <p className="bord-entete__date">L&apos;état du réseau, actualisé en continu.</p>
        </div>
        <div className="bord-entete__droite">
          <Bouton variante="secondaire" onClick={() => { void recharger(); void activite.recharger(); }}>Actualiser</Bouton>
        </div>
      </header>

      <section className="pile-s">
        <h2 className="section-titre">Le réseau en un coup d&apos;œil</h2>
        <div className="grille-indicateurs">
          {cartes.map((c) => {
            const ton = c.valeur === 0 && c.ton !== "seve" ? undefined : c.ton;
            return (
              <article key={c.libelle} className="bloc indicateur">
                <span className="appui">{c.libelle}</span>
                <strong className={`indicateur__valeur chiffres${ton ? ` indicateur__valeur--${ton}` : ""}`}>{c.valeur}</strong>
                <span className="petit">{c.detail}</span>
                {c.lien && c.valeur > 0 && (
                  <Link href={c.lien.adresse} className="petit" style={{ marginTop: "var(--e1)" }}>{c.lien.mot}</Link>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="pile-s">
        <h2 className="section-titre">Activité en temps réel</h2>
        {activite.chargement && !activite.donnees && <SqueletteLignes lignes={3} />}
        {activite.donnees?.length === 0 && (
          <VideLigne>Aucune activité pour l&apos;instant.</VideLigne>
        )}
        {!!activite.donnees?.length && (
          <div className="bloc pile-s">
            {activite.donnees.map((e) => (
              <div key={e.id} className="activite-ligne">
                <span className="activite-ligne__point" aria-hidden="true" />
                <span className="activite-ligne__texte">
                  <strong>{e.acteur || "Système"}</strong> {libelleEvenement(e.type)}
                  {e.cible && <span className="chiffres"> · {e.cible}</span>}
                </span>
                <span className="petit" style={{ flexShrink: 0 }}>{depuis(e.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pile-s">
        <h2 className="section-titre">Réseau</h2>
        <div className="bloc rang" style={{ flexWrap: "wrap", gap: "var(--e3)" }}>
          <Pilule ton="primaire">{stats.zones} zone{stats.zones > 1 ? "s" : ""}</Pilule>
          <Pilule ton="primaire">{stats.sites} site{stats.sites > 1 ? "s" : ""} actif{stats.sites > 1 ? "s" : ""}</Pilule>
          <Pilule ton="primaire">{stats.agents} compte{stats.agents > 1 ? "s" : ""} actif{stats.agents > 1 ? "s" : ""}</Pilule>
          <Link href="/admin/reseau" className="appui" style={{ marginLeft: "auto" }}>Gérer le réseau</Link>
        </div>
      </section>
    </>
  );
}

function BoutonHaut({ recharger }: { recharger: () => void }) {
  return (
    <header className="bord-entete">
      <div className="bord-entete__gauche">
        <h1 className="bord-entete__titre">Tableau de bord du CNTS</h1>
      </div>
      <div className="bord-entete__droite">
        <Bouton variante="secondaire" onClick={() => void recharger()}>Actualiser</Bouton>
      </div>
    </header>
  );
}
