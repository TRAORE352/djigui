"use client";
/** Connexion d'un agent ou d'un administrateur (e-mail + mot de passe). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { api, messageDe } from "@/lib/api";
import { lireAgent, lireJeton, ouvrirSession } from "@/lib/session";
import Bouton from "@/components/Bouton";
import { ChampTexte, ChampMotDePasse } from "@/components/Champs";
import { MessageErreur } from "@/components/Messages";

export default function Connexion() {
  const routeur = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  if (typeof window !== "undefined" && lireJeton()) {
    routeur.replace(lireAgent()?.roles.includes("admin") ? "/admin" : "/agent");
    return null;
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const session = await api.connexion(email, motDePasse);
      ouvrirSession(session.jeton, session.utilisateur);
      routeur.replace(session.utilisateur.roles.includes("admin") ? "/admin" : "/agent");
    } catch (p) {
      setErreur(messageDe(p));
      setEnCours(false);
    }
  }

  return (
    <main className="acces">
      <div className="acces__carte bloc pile">
        <div className="pile-s">
          <h1 className="titre">Plateforme CNTS</h1>
          <p className="appui">Connectez-vous avec votre e-mail professionnel.</p>
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
      </div>
    </main>
  );
}
