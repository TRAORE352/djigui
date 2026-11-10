"use client";
/**
 * D9 · Alertes.
 * Les alertes qui attendent une réponse d'abord. On répond directement
 * depuis la carte de l'alerte ; le détail (D10) donne le message complet,
 * l'adresse et le créneau de passage.
 */
import Link from "next/link";
import { BellOff, ChevronRight, CirclePause } from "lucide-react";
import type { Alerte } from "@dds/contrat-api";
import BlocGroupe from "@/components/BlocGroupe";
import { useDonneur } from "@/components/ContexteDonneur";
import EnTete from "@/components/EnTete";
import { Chargement, ErreurChargement, EtatVide } from "@/components/Etats";
import ReponseAlerte, { alerteOuverte } from "@/components/ReponseAlerte";
import { api } from "@/lib/api";
import { dateLongue, depuis } from "@/lib/format";
import { useChargement } from "@/lib/useChargement";

export default function Alertes() {
  const { actualiser } = useDonneur();
  const { donnees, setDonnees, erreur, enCours, recharger } = useChargement(
    () => Promise.all([api.alertes(), api.carte()]),
  );

  if (enCours && !donnees) return <main className="page"><Chargement /></main>;
  if (erreur || !donnees) return <main className="page"><ErreurChargement message={erreur} reessayer={recharger} /></main>;

  const [alertes, carte] = donnees;
  const remplacer = (maj: Alerte) => {
    setDonnees([alertes.map((a) => (a.id === maj.id ? maj : a)), carte]);
    actualiser();
  };

  const aRepondre = alertes.filter((a) => alerteOuverte(a) && !a.maReponse);
  const repondues = alertes.filter((a) => alerteOuverte(a) && a.maReponse);
  const terminees = alertes.filter((a) => !alerteOuverte(a));

  return (
    <main className="page pile-l">
      <EnTete titre="Alertes" />

      {carte.enPause && (
        <div className="encadre encadre--ocre">
          <CirclePause size={18} aria-hidden="true" />
          <div className="pile-s">
            <span>Vos alertes sont en pause : les centres ne vous préviennent pas.</span>
            <Link href="/profil" className="lien">Reprendre les alertes</Link>
          </div>
        </div>
      )}

      {alertes.length === 0 ? (
        <EtatVide icone={<BellOff size={28} aria-hidden="true" />} titre="Aucun appel au don pour l’instant">
          <p className="appui">
            {!carte.groupeSanguin
              ? "Votre groupe sanguin n’est pas encore connu. Le centre le précisera à votre premier don ; vous recevrez ensuite les appels qui vous concernent."
              : !carte.eligible
                ? "Les centres ne préviennent que les donneurs qui peuvent donner. Vous recevrez à nouveau des appels après votre temps de repos."
                : `Vous serez prévenu dès qu’un centre proche manquera de sang ${carte.groupeSanguin}.`}
          </p>
          <Link href="/centres" className="bouton bouton--secondaire">Voir les centres</Link>
        </EtatVide>
      ) : (
        <>
          <Section titre={aRepondre.length > 1 ? `${aRepondre.length} alertes attendent votre réponse` : "Attend votre réponse"}
                   alertes={aRepondre} surReponse={remplacer} />
          <Section titre="Vous avez répondu" alertes={repondues} surReponse={remplacer} />
          <Section titre="Terminées" alertes={terminees} surReponse={remplacer} attenuee />
        </>
      )}
    </main>
  );
}

function Section({ titre, alertes, surReponse, attenuee }:
  { titre: string; alertes: Alerte[]; surReponse: (a: Alerte) => void; attenuee?: boolean }) {
  if (alertes.length === 0) return null;
  return (
    <section className="pile">
      <h2 className="section-titre">{titre}</h2>
      {alertes.map((a) => <CarteAlerte key={a.id} alerte={a} surReponse={surReponse} attenuee={attenuee} />)}
    </section>
  );
}

function CarteAlerte({ alerte, surReponse, attenuee }: { alerte: Alerte; surReponse: (a: Alerte) => void; attenuee?: boolean }) {
  const attend = alerteOuverte(alerte) && !alerte.maReponse;
  return (
    <article className={`bloc pile${attend ? " bloc--a-repondre" : ""}${attenuee ? " bloc--attenue" : ""}`}>
      <Link href={`/alertes/${alerte.id}`} className="rang" style={{ textDecoration: "none", alignItems: "flex-start" }}>
        <BlocGroupe groupe={alerte.groupeSanguin} />
        <div className="ligne__corps">
          <span className="fort">{alerte.centre.nom}</span>
          <span className="petit">Reçue {depuis(alerte.creeLe)}</span>
          {attend && <span className="petit" style={{ color: "var(--sang)" }}>Répondre avant le {dateLongue(alerte.dateLimite)}</span>}
        </div>
        <ChevronRight size={20} aria-label="Voir le détail" style={{ color: "var(--encre-2)", marginTop: 12 }} />
      </Link>
      <ReponseAlerte alerte={alerte} surReponse={surReponse} />
    </article>
  );
}
