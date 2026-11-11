"use client";
/**
 * Tableau de bord du CNTS — l'état du réseau en temps réel.
 *
 * Toutes les cartes tiennent dans un seul panneau : ce qui attend une action
 * d'abord (alerte, demande), puis l'activité du jour et la base des donneurs.
 */
import { useEffect } from "react";
import Link from "next/link";
import type { Statistiques } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { useRessource } from "@/lib/useRessource";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import { EtatErreur, Squelette } from "@/components/Etats";

type Carte = {
  libelle: string;
  valeur: number;
  detail: string;
  /** Teinte d'alerte, appliquée seulement si le compteur est non nul. */
  ton?: "seve" | "ocre" | "sang";
  lien?: { adresse: string; mot: string };
};

export default function TableauDeBord() {
  const { donnees: stats, erreur, chargement, recharger } = useRessource<Statistiques>(
    () => api.statistiques(),
  );

  // Un tableau de bord qui ne bouge pas n'est pas un tableau de bord :
  // il se rafraîchit tout seul chaque minute.
  useEffect(() => {
    const minuteur = setInterval(() => { void recharger(); }, 60_000);
    return () => clearInterval(minuteur);
  }, [recharger]);

  if (chargement && !stats) {
    return (
      <>
        <BoutonHaut recharger={recharger} />
        <Squelette hauteur={240} />
      </>
    );
  }

  if (erreur && !stats) {
    return (
      <>
        <BoutonHaut recharger={recharger} />
        <EtatErreur texte={erreur} surReessai={() => void recharger()} />
      </>
    );
  }

  if (!stats) return null;

  const cartes: Carte[] = [
    {
      libelle: "Alertes en cours", valeur: stats.alertesEnCours,
      detail: "appels aux donneurs encore ouverts", ton: "sang",
      lien: { adresse: "/agent/alertes", mot: "Voir les alertes" },
    },
    {
      libelle: "Demandes en attente", valeur: stats.demandesEnAttente,
      detail: "à accepter par la distribution", ton: "ocre",
      lien: { adresse: "/agent/distribution/donner", mot: "Voir les demandes" },
    },
    {
      libelle: "Dons aujourd'hui", valeur: stats.donsAujourdhui,
      detail: "donneurs déclarés aptes et prélevés",
    },
    {
      libelle: "Poches en analyse", valeur: stats.pochesEnAnalyse,
      detail: "au laboratoire, pas encore qualifiées", ton: "ocre",
    },
    {
      libelle: "Produits disponibles", valeur: stats.produitsDisponibles,
      detail: "en stock ou réservés sur le réseau", ton: "seve",
    },
    {
      libelle: "Donneurs inscrits", valeur: stats.donneurs.total,
      detail: `${stats.donneurs.actifs} actifs · ${stats.donneurs.enPause} en pause`,
    },
  ];

  return (
    <>
      <header className="bord-entete">
        <div className="bord-entete__gauche">
          <h1 className="bord-entete__titre">Tableau de bord du CNTS</h1>
          <p className="bord-entete__date">L&apos;état du réseau, actualisé chaque minute.</p>
        </div>
        <div className="bord-entete__droite">
          <Bouton variante="secondaire" onClick={() => void recharger()}>Actualiser</Bouton>
        </div>
      </header>

      <section className="pile-s">
        <h2 className="section-titre">Le réseau en un coup d&apos;œil</h2>
        <div className="grille-indicateurs">
          {cartes.map((c) => {
            // Un « 0 » en rouge se lit comme un problème, alors que c'est la
            // bonne nouvelle : la teinte d'alerte ne s'applique qu'au-delà de 0.
            const ton = c.valeur === 0 && c.ton !== "seve" ? undefined : c.ton;
            return (
              <article key={c.libelle} className="bloc indicateur">
                <span className="appui">{c.libelle}</span>
                <strong className={`indicateur__valeur chiffres${ton ? ` indicateur__valeur--${ton}` : ""}`}>
                  {c.valeur}
                </strong>
                <span className="petit">{c.detail}</span>
                {c.lien && c.valeur > 0 && (
                  <Link href={c.lien.adresse} className="petit" style={{ marginTop: "var(--e1)" }}>
                    {c.lien.mot}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
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

/** En-tête commun aux états de chargement et d'erreur. */
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
