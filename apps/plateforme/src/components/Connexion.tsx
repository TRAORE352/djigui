"use client";
/**
 * Formulaire de connexion, partagé par les deux espaces professionnels.
 *
 * Il connaît l'espace qu'il garde : après authentification, un compte qui
 * n'a pas les droits de CET espace est refusé ici, avec une phrase qui dit
 * où aller. On ne le redirige pas en douce vers l'autre espace — c'est ce
 * mélange qui rendait les deux espaces confus.
 *
 * La redirection se fait dans un `useEffect`, JAMAIS pendant le rendu :
 * appeler `router.replace()` dans le corps du composant laisse React
 * afficher l'ancienne page sous la nouvelle le temps de la transition.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn } from "lucide-react";
import type { Role } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { fermerSession, lireAgent, lireJeton, ouvrirSession } from "@/lib/session";
import Bouton from "@/components/Bouton";
import { ChampTexte, ChampMotDePasse } from "@/components/Champs";
import { MessageErreur } from "@/components/Messages";

export type Espace = "agent" | "cnts";

const CONFIG: Record<Espace, {
  titre: string;
  chapeau: string;
  accueil: string;
  /** Rôle(s) acceptés par cet espace. */
  autorise: (roles: Role[]) => boolean;
  refus: string;
  autre: { mot: string; adresse: string };
}> = {
  agent: {
    titre: "Espace agent",
    chapeau: "Connectez-vous avec votre e-mail professionnel.",
    accueil: "/agent",
    // L'administrateur travaille dans l'espace CNTS : il n'entre pas ici.
    autorise: (roles) => roles.some((r) => r.startsWith("agent_")),
    refus: "Ce compte n'a pas de rôle d'agent. Utilisez l'espace CNTS.",
    autre: { mot: "Accéder à l'espace CNTS", adresse: "/connexion/cnts" },
  },
  cnts: {
    titre: "Espace CNTS",
    chapeau: "Réservé à l'administration du centre national.",
    accueil: "/admin",
    autorise: (roles) => roles.includes("admin"),
    refus: "Ce compte n'est pas administrateur. Utilisez l'espace agent.",
    autre: { mot: "Accéder à l'espace agent", adresse: "/connexion/agent" },
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
      <div className="acces__carte bloc pile">
        <Link href="/" className="lien rang" style={{ gap: "var(--e2)", fontSize: "var(--t-appui)" }}>
          <ArrowLeft size={16} aria-hidden="true" />
          Changer d&apos;espace
        </Link>

        <div className="pile-s">
          <h1 className="titre">{conf.titre}</h1>
          <p className="appui">{conf.chapeau}</p>
        </div>

        <form className="pile" onSubmit={envoyer}>
          <ChampTexte
            etiquette="E-mail"
            type="email"
            autoComplete="username"
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

        <Link href={conf.autre.adresse} className="appui" style={{ textAlign: "center" }}>
          {conf.autre.mot}
        </Link>
      </div>
    </main>
  );
}
