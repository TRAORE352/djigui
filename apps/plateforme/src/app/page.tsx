"use client";
/**
 * Portail d'entrée — le choix de l'espace.
 *
 * Trois publics, trois portes distinctes :
 *   · les donneurs        → application mobile, projet séparé
 *   · les agents          → prélèvement, laboratoire, stock, distribution
 *   · le CNTS             → comptes, réseau, règles
 *
 * Chaque espace a sa propre connexion. On ne passe plus de l'un à l'autre
 * par un raccourci : un compte ouvre la porte de son espace, et seulement
 * celle-là.
 */
import Link from "next/link";
import { ArrowRight, Droplet, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";

/** L'application des donneurs est déployée séparément. */
const URL_DONNEUR =
  process.env.NEXT_PUBLIC_URL_DONNEUR ?? "https://don-de-sang-donneur.vercel.app";

const PORTES = [
  {
    cle: "donneur",
    titre: "Application du donneur",
    pour: "Pour les donneurs de sang",
    texte: "Carte de donneur, alertes du centre, historique des dons et centres de collecte.",
    adresse: URL_DONNEUR,
    externe: true,
    Icone: Smartphone,
  },
  {
    cle: "agent",
    titre: "Espace agent",
    pour: "Pour le personnel du centre",
    texte: "Accueil et prélèvement, laboratoire, stock, alertes, distribution et traçabilité.",
    adresse: "/connexion/agent",
    externe: false,
    Icone: Stethoscope,
  },
  {
    cle: "cnts",
    titre: "Espace CNTS",
    pour: "Pour l'administration",
    texte: "Comptes et rôles, zones et sites du réseau, règles de don et tableau de bord national.",
    adresse: "/connexion/cnts",
    externe: false,
    Icone: ShieldCheck,
  },
];

export default function Portail() {
  return (
    <main className="portail">
      <header className="portail__entete">
        <span className="portail__logo"><Droplet size={30} aria-hidden="true" /></span>
        <h1 className="portail__titre">Don de sang</h1>
        <p className="portail__chapeau">
          Plateforme nationale de don de sang et de traçabilité des poches.
          Choisissez votre espace.
        </p>
      </header>

      <div className="portail__portes">
        {PORTES.map(({ cle, titre, pour, texte, adresse, externe, Icone }) => {
          const contenu = (
            <>
              <span className="porte__icone"><Icone size={24} aria-hidden="true" /></span>
              <span className="porte__pour">{pour}</span>
              <span className="porte__titre">{titre}</span>
              <span className="porte__texte">{texte}</span>
              <span className="porte__aller">
                Entrer <ArrowRight size={16} aria-hidden="true" />
              </span>
            </>
          );

          return externe ? (
            <a key={cle} className="porte" href={adresse} rel="noreferrer">{contenu}</a>
          ) : (
            <Link key={cle} className="porte" href={adresse}>{contenu}</Link>
          );
        })}
      </div>

      <footer className="portail__pied">
        <span className="petit">
          Centre national de transfusion sanguine · Burkina Faso
        </span>
      </footer>
    </main>
  );
}
