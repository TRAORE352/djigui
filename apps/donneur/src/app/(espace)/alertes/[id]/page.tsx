"use client";
/**
 * D10 · Réponse à une alerte.
 * Le message du centre dans une bulle (c'est un vrai message reçu), où et
 * quand venir, puis la réponse. Après « Je viens », le donneur peut indiquer
 * son créneau et son moyen de déplacement (fiche de disponibilité de DJIGUI).
 */
import { useParams } from "next/navigation";
import { Clock, MapPin, Phone } from "lucide-react";
import BlocGroupe from "@/components/BlocGroupe";
import { useDonneur } from "@/components/ContexteDonneur";
import { Retour } from "@/components/EnTete";
import Etat from "@/components/Etat";
import { Chargement, ErreurChargement } from "@/components/Etats";
import { Encadre } from "@/components/Messages";
import ReponseAlerte, { alerteOuverte } from "@/components/ReponseAlerte";
import { api } from "@/lib/api";
import { dateHeure, dateLongue, numeroLisible } from "@/lib/format";
import { useChargement } from "@/lib/useChargement";

export default function DetailAlerte() {
  const { id } = useParams<{ id: string }>();
  const { actualiser } = useDonneur();
  const { donnees: alerte, setDonnees, erreur, enCours, recharger } = useChargement(() => api.alerte(id), [id]);

  if (enCours && !alerte) return <main className="page page--sans-barre"><Chargement lignes={3} /></main>;
  if (erreur || !alerte) {
    return (
      <main className="page page--sans-barre pile-l">
        <Retour vers="/alertes" mot="Toutes les alertes" />
        <ErreurChargement message={erreur} reessayer={recharger} />
      </main>
    );
  }

  const ouverte = alerteOuverte(alerte);
  const heuresRestantes = (new Date(alerte.dateLimite).getTime() - Date.now()) / 3600_000;

  return (
    <main className="page page--sans-barre pile-l">
      <Retour vers="/alertes" mot="Toutes les alertes" />

      <div className="rang" style={{ gap: "var(--e4)" }}>
        <BlocGroupe groupe={alerte.groupeSanguin} taille="l" />
        <h1 className="titre-s">
          {alerte.groupeSanguin
            ? `Le centre recherche des donneurs ${alerte.groupeSanguin}`
            : "Le centre vous invite à donner"}
        </h1>
      </div>

      <div className="bulle">
        <span className="bulle__auteur">{alerte.centre.nom}</span>
        <p>{alerte.message}</p>
        <span className="bulle__heure">{dateHeure(alerte.creeLe)}</span>
      </div>

      <div className="pile-s">
        <div className="rang" style={{ alignItems: "flex-start" }}>
          <MapPin size={20} aria-hidden="true" style={{ color: "var(--encre-2)", flexShrink: 0 }} />
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fort">{alerte.centre.nom}</span>
            <span className="appui">{alerte.centre.adresse}</span>
            <span className="appui">{alerte.centre.horaires}</span>
          </div>
        </div>
        <a href={`tel:${alerte.centre.telephone}`} className="lien" style={{ marginLeft: 32 }}>
          <Phone size={16} aria-hidden="true" />Appeler le centre · <span className="chiffres">{numeroLisible(alerte.centre.telephone)}</span>
        </a>
      </div>

      {ouverte ? (
        <Encadre ton={heuresRestantes < 24 ? "sang" : "ocre"} icone={<Clock size={18} aria-hidden="true" />}>
          <span>Répondez avant le <span className="fort">{dateLongue(alerte.dateLimite)}</span>. Après, le centre n’attend plus de réponse.</span>
        </Encadre>
      ) : !alerte.maReponse ? (
        <Etat>Le délai de réponse est passé.</Etat>
      ) : null}

      <ReponseAlerte alerte={alerte} complet surReponse={(maj) => { setDonnees(maj); actualiser(); }} />
    </main>
  );
}
