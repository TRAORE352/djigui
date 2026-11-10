"use client";
/**
 * P4 — Laboratoire : écran mis en attente.
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │ POUR RESTAURER L'ÉCRAN COMPLET                                    │
 * │                                                                   │
 * │   git show dcf53d1:apps/plateforme/src/app/agent/laboratoire/\    │
 * │     page.tsx > apps/plateforme/src/app/agent/laboratoire/page.tsx │
 * │                                                                   │
 * │ Rien n'a été perdu : la chaîne de qualification (réception,       │
 * │ groupage en double détermination, sérologie, libération,          │
 * │ préparation des produits) existe entièrement dans l'historique,   │
 * │ ainsi que l'API et les tables qui la servent. Seul l'affichage    │
 * │ est suspendu.                                                     │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Pourquoi cette page est en attente : la chaîne de qualification
 * biologique doit être validée avec les biologistes du CNTS avant d'être
 * figée dans une interface. Un écran de laboratoire faux est pire qu'un
 * écran absent, parce qu'il donne l'illusion d'une procédure conforme.
 *
 * Ce que l'écran doit faire en attendant : le dire franchement, sans
 * fausse promesse de date, et sans laisser l'agent croire à une panne.
 * Le reste de la chaîne continue de fonctionner : les poches prélevées
 * s'accumulent normalement et seront traitées dès l'ouverture.
 */
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { EnTetePage } from "@/components/Coquille";

export default function Laboratoire() {
  return (
    <>
      <EnTetePage
        titre="Laboratoire"
        chapeau="Qualification biologique des poches prélevées."
      />

      <section className="travaux" aria-labelledby="travaux-titre">
        <span className="travaux__icone" aria-hidden="true">
          <FlaskConical size={28} />
        </span>

        <h2 id="travaux-titre" className="travaux__titre">
          Écran en cours de préparation
        </h2>

        <p className="travaux__texte">
          La chaîne de qualification biologique est en cours de mise au point
          avec les biologistes du centre. Cet écran ouvrira une fois la
          procédure validée avec eux.
        </p>

        <p className="travaux__note">
          Les prélèvements continuent normalement. Les poches enregistrées
          depuis « Accueil et prélèvement » sont conservées et seront
          traitées dès l&apos;ouverture de cet écran.
        </p>

        <Link href="/agent" className="bouton bouton--secondaire">
          <ArrowLeft size={18} aria-hidden="true" />
          Retour au tableau de bord
        </Link>
      </section>
    </>
  );
}
