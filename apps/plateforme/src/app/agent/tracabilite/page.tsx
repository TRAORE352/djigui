"use client";
/**
 * P9 — Traçabilité : écran mis en attente.
 *
 * ┌───────────────────────────────────────────────────────────────────┐
 * │ POUR RESTAURER L'ÉCRAN COMPLET                                    │
 * │                                                                   │
 * │   git show 2bfb6e1:apps/plateforme/src/app/agent/tracabilite/\    │
 * │     page.tsx > apps/plateforme/src/app/agent/tracabilite/page.tsx │
 * │                                                                   │
 * │ Rien n'a été perdu : la recherche par code, la frise              │
 * │ chronologique des événements (inscription, passage, prélèvement,  │
 * │ analyse, préparation, expédition, réception, délivrance,          │
 * │ destruction) et l'API qui la sert existent entièrement dans       │
 * │ l'historique. Seul l'affichage est suspendu.                      │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Pourquoi cette page est en attente : la traçabilité est l'écran qu'on
 * ouvre quand quelque chose doit être PROUVÉ. Or son histoire passe par
 * le laboratoire (analyse, préparation des produits), dont l'écran est
 * lui-même suspendu le temps de valider la chaîne de qualification avec
 * les biologistes. Une frise à trous sur un écran de preuve est pire
 * qu'un écran absent : elle ferait conclure à tort qu'une étape n'a pas
 * eu lieu.
 *
 * L'agent se concentre aujourd'hui sur l'accueil et le prélèvement, les
 * appels au don et la distribution. Rien n'est perdu pendant ce temps :
 * le backend continue d'écrire chaque événement, et la frise sera
 * complète et rétroactive à la réouverture.
 */
import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import { EnTetePage } from "@/components/Coquille";

export default function Tracabilite() {
  return (
    <>
      <EnTetePage
        titre="Traçabilité"
        chapeau="Du donneur au receveur : l'histoire complète d'un code."
      />

      <section className="travaux" aria-labelledby="travaux-titre">
        <span className="travaux__icone" aria-hidden="true">
          <ScanLine size={28} />
        </span>

        <h2 id="travaux-titre" className="travaux__titre">
          Écran en cours de préparation
        </h2>

        <p className="travaux__texte">
          L&apos;histoire d&apos;une poche passe par le laboratoire, dont la
          chaîne de qualification est encore en cours de validation avec les
          biologistes du centre. Tant qu&apos;elle n&apos;est pas figée, cet
          écran afficherait une histoire incomplète — ce qui n&apos;est pas
          acceptable sur un écran qui sert à prouver.
        </p>

        <p className="travaux__note">
          Aucun événement n&apos;est perdu. Les inscriptions, venues,
          prélèvements et distributions continuent d&apos;être enregistrés : la
          traçabilité sera complète, y compris pour les poches
          d&apos;aujourd&apos;hui, dès l&apos;ouverture de cet écran.
        </p>

        <Link href="/agent" className="bouton bouton--secondaire">
          <ArrowLeft size={18} aria-hidden="true" />
          Retour au tableau de bord
        </Link>
      </section>
    </>
  );
}
