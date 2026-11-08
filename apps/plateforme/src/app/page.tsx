"use client";
/**
 * Portail d'entrée — le choix de l'espace.
 *
 * Trois publics, trois ADRESSES distinctes :
 *   · les donneurs → mydjigui.vercel.app   (application mobile, projet séparé)
 *   · les agents   → djigui-agent.vercel.app
 *   · le CNTS      → djigui-cnts.vercel.app
 *
 * Ce portail n'est servi que par le déploiement « complet » (démonstration
 * et développement). Sur une adresse dédiée, le middleware mène directement
 * à la porte de l'espace concerné : il n'y a rien à choisir quand l'adresse
 * a déjà choisi.
 *
 * Chaque porte est une URL ABSOLUE vers son produit, et non un chemin
 * interne : c'est ce qui rend les trois espaces réellement distincts plutôt
 * qu'onglets d'une même application.
 */
import { ArrowRight, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";
import { MARQUE } from "@/lib/espace";
import Goutte from "@/components/Goutte";

/**
 * Adresses des trois produits. Surchargeables par variable d'environnement
 * pour que les aperçus et le développement local pointent au bon endroit.
 */
const URL_DONNEUR = process.env.NEXT_PUBLIC_URL_DONNEUR ?? "https://mydjigui.vercel.app";
const URL_AGENT = process.env.NEXT_PUBLIC_URL_AGENT ?? "/connexion/agent";
const URL_CNTS = process.env.NEXT_PUBLIC_URL_CNTS ?? "/connexion/cnts";

const PORTES = [
  {
    cle: "donneur",
    titre: "Application du donneur",
    pour: "Pour les donneurs de sang",
    texte: "Carte de donneur, alertes du centre, historique des dons et centres de collecte.",
    adresse: URL_DONNEUR,
    Icone: Smartphone,
  },
  {
    cle: "agent",
    titre: "Espace agent",
    pour: "Pour le personnel du centre",
    texte: "Accueil et prélèvement, laboratoire, stock, alertes, distribution et traçabilité.",
    adresse: URL_AGENT,
    Icone: Stethoscope,
  },
  {
    cle: "cnts",
    titre: "Espace CNTS",
    pour: "Pour l'administration",
    texte: "Comptes et rôles, zones et sites du réseau, règles de don et tableau de bord national.",
    adresse: URL_CNTS,
    Icone: ShieldCheck,
  },
];

export default function Portail() {
  return (
    <main className="portail">
      <header className="portail__entete">
        <Goutte taille={30} />
        <h1 className="portail__titre">{MARQUE}</h1>
        <p className="portail__chapeau">
          Plateforme nationale de don de sang et de traçabilité des poches.
          Choisissez votre espace.
        </p>
      </header>

      <div className="portail__portes">
        {PORTES.map(({ cle, titre, pour, texte, adresse, Icone }) => (
          <a key={cle} className="porte" href={adresse}>
            <span className="porte__icone"><Icone size={24} aria-hidden="true" /></span>
            <span className="porte__pour">{pour}</span>
            <span className="porte__titre">{titre}</span>
            <span className="porte__texte">{texte}</span>
            <span className="porte__aller">
              Entrer <ArrowRight size={16} aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>

      <footer className="portail__pied">
        <span className="petit">
          Centre national de transfusion sanguine · Burkina Faso
        </span>
      </footer>
    </main>
  );
}
