"use client";
/**
 * Page d'authentification des espaces professionnels (agent et CNTS).
 *
 * Mise en page en deux volets : à gauche l'identité du produit et ce que
 * l'espace permet de faire, à droite le formulaire. Sur mobile le volet
 * gauche devient un bandeau compact — il informe, il ne doit jamais
 * repousser le formulaire sous la ligne de flottaison.
 *
 * Le formulaire connaît l'espace qu'il garde : après authentification, un
 * compte qui n'a pas les droits de CET espace est refusé ici, avec une
 * phrase qui dit où aller. On ne le redirige pas en douce vers l'autre
 * espace — c'est ce mélange qui rendait les deux espaces confus.
 *
 * La redirection se fait dans un `useEffect`, JAMAIS pendant le rendu :
 * appeler `router.replace()` dans le corps du composant laisse React
 * afficher l'ancienne page sous la nouvelle le temps de la transition.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Boxes, Building2, FlaskConical, LogIn, type LucideIcon,
  ScanLine, ShieldCheck, SlidersHorizontal, UserRound, Users,
} from "lucide-react";
import type { Role } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { fermerSession, lireAgent, lireJeton, ouvrirSession } from "@/lib/session";
import { EST_DEDIE, MARQUE, type Espace } from "@/lib/espace";
import Bouton from "@/components/Bouton";
import { ChampTexte, ChampMotDePasse } from "@/components/Champs";
import { MessageErreur } from "@/components/Messages";
import Goutte from "@/components/Goutte";

export type { Espace };

type Config = {
  titre: string;
  chapeau: string;
  accueil: string;
  /** Rôle(s) acceptés par cet espace. */
  autorise: (roles: Role[]) => boolean;
  refus: string;
  autre: { mot: string; adresse: string };
  /** Ce que l'on fait dans cet espace : 4 repères, pas une brochure. */
  reperes: { Icone: LucideIcon; mot: string }[];
};

const CONFIG: Record<Espace, Config> = {
  agent: {
    titre: "Espace agent",
    chapeau: "Connectez-vous avec votre e-mail professionnel.",
    accueil: "/agent",
    // L'administrateur travaille dans l'espace CNTS : il n'entre pas ici.
    autorise: (roles) => roles.some((r) => r.startsWith("agent_")),
    refus: "Ce compte n'a pas de rôle d'agent. Utilisez l'espace CNTS.",
    autre: { mot: "Accéder à l'espace CNTS", adresse: "/connexion/cnts" },
    reperes: [
      { Icone: UserRound, mot: "Accueil et prélèvement" },
      { Icone: FlaskConical, mot: "Qualification au laboratoire" },
      { Icone: Boxes, mot: "Stock et distribution" },
      { Icone: ScanLine, mot: "Traçabilité des poches" },
    ],
  },
  cnts: {
    titre: "Espace CNTS",
    chapeau: "Réservé à l'administration du centre national.",
    accueil: "/admin",
    autorise: (roles) => roles.includes("admin"),
    refus: "Ce compte n'est pas administrateur. Utilisez l'espace agent.",
    autre: { mot: "Accéder à l'espace agent", adresse: "/connexion/agent" },
    reperes: [
      { Icone: Users, mot: "Comptes et rôles" },
      { Icone: Building2, mot: "Zones, centres et dépôts" },
      { Icone: SlidersHorizontal, mot: "Règles de don" },
      { Icone: ShieldCheck, mot: "Tableau de bord national" },
    ],
  },
};

export default function Connexion({ espace }: { espace: Espace }) {
  const routeur = useRouter();
  const conf = CONFIG[espace];
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [verifie, setVerifie] = useState(false);

  // Session déjà ouverte ET valable pour cet espace : on entre directement.
  useEffect(() => {
    const agent = lireAgent();
    if (lireJeton() && agent && conf.autorise(agent.roles)) {
      routeur.replace(conf.accueil);
      return;
    }
    setVerifie(true);
  }, [routeur, conf]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const session = await api.connexion(email, motDePasse);
      if (!conf.autorise(session.utilisateur.roles)) {
        // Identifiants bons, mais mauvaise porte : on ne garde pas la
        // session ouverte dans un espace où le compte n'a rien à faire.
        fermerSession();
        setErreur(conf.refus);
        setEnCours(false);
        return;
      }
      ouvrirSession(session.jeton, session.utilisateur);
      routeur.replace(conf.accueil);
    } catch (p) {
      setErreur(messageDe(p));
      setEnCours(false);
    }
  }

  // Tant que la session n'est pas vérifiée, on n'affiche rien : afficher
  // le formulaire puis le remplacer provoque un clignotement.
  if (!verifie) return <main className="acces" aria-busy="true" />;

  return (
    <main className="acces">
      {/* Volet d'identité : qui nous sommes, ce que cet espace permet. */}
      <section className="acces__volet" aria-hidden="true">
        <div className="acces__volet-haut">
          <span className="acces__marque">
            <Goutte taille={30} />
            <span className="acces__marque-nom">{MARQUE}</span>
          </span>
          <p className="acces__accroche">
            Chaque poche de sang suivie, du donneur au receveur.
          </p>
          <p className="acces__sous">
            Centre national de transfusion sanguine · Burkina&nbsp;Faso
          </p>
        </div>

        <ul className="acces__reperes">
          {conf.reperes.map(({ Icone, mot }) => (
            <li key={mot} className="acces__repere">
              <Icone size={17} aria-hidden="true" />
              <span>{mot}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Volet de saisie. */}
      <section className="acces__volet-form">
        <div className="acces__carte">
          {/* Sur une adresse dédiée, il n'y a pas d'autre espace à rejoindre :
              proposer « changer d'espace » mènerait à une page qui n'existe
              pas ici. On n'annonce donc que ce que ce déploiement sait faire. */}
          {!EST_DEDIE && (
            <Link href="/" className="acces__retour">
              <ArrowLeft size={16} aria-hidden="true" />
              Changer d&apos;espace
            </Link>
          )}

          <div className="acces__mobile-marque">
            <Goutte taille={26} />
            <span className="acces__marque-nom">{MARQUE}</span>
          </div>

          <div className="pile-s">
            <h1 className="acces__titre">{conf.titre}</h1>
            <p className="acces__chapeau">{conf.chapeau}</p>
          </div>

          <form className="acces__form" onSubmit={envoyer}>
            <ChampTexte
              etiquette="E-mail"
              type="email"
              autoComplete="username"
              placeholder="prenom.nom@cnts.bf"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErreur(""); }}
              required
            />
            <ChampMotDePasse
              etiquette="Mot de passe"
              valeur={motDePasse}
              required
              surChange={(v) => { setMotDePasse(v); setErreur(""); }}
            />
            <MessageErreur>{erreur}</MessageErreur>
            <Bouton
              type="submit"
              large
              enCours={enCours}
              motEnCours="Connexion…"
              icone={<LogIn size={18} aria-hidden="true" />}
            >
              Se connecter
            </Bouton>
          </form>

          <p className="acces__oubli">
            Mot de passe oublié ? Demandez une réinitialisation à
            l&apos;administrateur du CNTS.
          </p>

          {!EST_DEDIE && (
            <Link href={conf.autre.adresse} className="acces__autre">
              {conf.autre.mot}
            </Link>
          )}
        </div>

        <p className="acces__pied">
          {MARQUE} · Centre national de transfusion sanguine
        </p>
      </section>
    </main>
  );
}
