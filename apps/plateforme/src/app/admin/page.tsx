"use client";
/**
 * Tableau de bord du CNTS — l'état du réseau en temps réel.
 *
 * Les chiffres sont groupés par question posée : « combien de donneurs ? »,
 * « que se passe-t-il aujourd'hui ? », « qu'est-ce qui attend une action ? ».
 */
import { useEffect } from "react";
import Link from "next/link";
import type { Statistiques } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
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
        <EnTetePage titre="Tableau de bord" />
        <Squelette hauteur={240} />
      </>
    );
  }

  if (erreur && !stats) {
    return (
      <>
        <EnTetePage titre="Tableau de bord" />
        <EtatErreur texte={erreur} surReessai={() => void recharger()} />
      </>
    );
  }

  if (!stats) return null;

  const activite: Carte[] = [
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
  ];

  const aTraiter: Carte[] = [
    {
      libelle: "Alertes en cours", valeur: stats.alertesEnCours,
      detail: "appels aux donneurs encore ouverts", ton: "sang",
      lien: { adresse: "/agent/alertes", mot: "Voir les alertes" },
    },
    {
      libelle: "Demandes en attente", valeur: stats.demandesEnAttente,
      detail: "à préparer par la distribution", ton: "ocre",
      lien: { adresse: "/agent/distribution", mot: "Voir les demandes" },
    },
  ];

  const donneurs: Carte[] = [
    {
      libelle: "Donneurs inscrits", valeur: stats.donneurs.total,
      detail: `${stats.donneurs.actifs} actifs · ${stats.donneurs.enPause} en pause`,
    },
  ];

  return (
    <>
      <EnTetePage
        titre="Tableau de bord"
        chapeau="L'état du réseau, actualisé chaque minute."
        actions={<Bouton variante="secondaire" onClick={() => void recharger()}>Actualiser</Bouton>}
      />

      <Groupe titre="Activité du jour" cartes={activite} />
      <Groupe titre="En attente d'une action" cartes={aTraiter} />
      <Groupe titre="Base des donneurs" cartes={donneurs} />

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

function Groupe({ titre, cartes }: { titre: string; cartes: Carte[] }) {
  return (
    <section className="pile-s">
      <h2 className="section-titre">{titre}</h2>
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
  );
}
