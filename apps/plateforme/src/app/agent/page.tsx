"use client";
/**
 * Tableau de bord de l'agent.
 *
 * Il répond à une seule question : « qu'est-ce que je dois faire
 * maintenant ? » Chaque chiffre est un bouton vers l'écran qui permet
 * d'agir ; aucun chiffre n'est là pour décorer.
 *
 * Les cartes sont filtrées par rôle : un technicien de laboratoire ne
 * voit pas les demandes de la distribution.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, Boxes, CalendarX2, CircleCheck, FlaskConical, PackageCheck, Truck,
} from "lucide-react";
import type { AgentConnecte, Demande, FileLabo, LigneStock, Produit, Role } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { EnTetePage } from "@/components/Coquille";
import { Section, VideLigne } from "@/components/Mise";
import { SqueletteLignes } from "@/components/Etats";
import { LIBELLE_ROLE } from "@/lib/navigation";
import { lireAgent } from "@/lib/session";

/** Une carte = un chiffre, un sens, un écran où agir. */
type Carte = {
  cle: string;
  libelle: string;
  valeur: number;
  detail: string;
  adresse: string;
  Icone: typeof Bell;
  /** urgent = rouge, agir = ocre, calme = gris (rien à faire). */
  ton: "urgent" | "agir" | "calme";
  roles: Role[];
};

export default function TableauDeBordAgent() {
  const [agent, setAgent] = useState<AgentConnecte | null>(null);
  const [cartes, setCartes] = useState<Carte[] | null>(null);
  const [heure, setHeure] = useState("");

  useEffect(() => { setAgent(lireAgent()); }, []);

  useEffect(() => {
    if (!agent) return;
    let vivant = true;

    async function charger(a: AgentConnecte) {
      const peut = (...r: Role[]) => r.some((x) => a.roles.includes(x));

      // Chaque appel est protégé : un refus de droits ne doit pas vider
      // tout le tableau de bord, juste masquer la carte concernée.
      const sansErreur = <T,>(p: Promise<T>, defaut: T) => p.catch(() => defaut);

      const [labo, stock, peremption, demandes] = await Promise.all([
        peut("agent_labo", "admin")
          ? sansErreur(api.fileLabo(), { aRecevoir: [], aGrouper: [], aTester: [], aLiberer: [] } as FileLabo)
          : Promise.resolve(null),
        peut("agent_stock", "agent_depot", "admin") ? sansErreur(api.stock(), [] as LigneStock[]) : Promise.resolve(null),
        peut("agent_stock", "agent_depot", "admin") ? sansErreur(api.produitsPeremption(), [] as Produit[]) : Promise.resolve(null),
        peut("agent_stock", "agent_depot", "admin") ? sansErreur(api.demandes(), [] as Demande[]) : Promise.resolve(null),
      ]);

      if (!vivant) return;

      const liste: Carte[] = [];

      if (labo) {
        const aFaire = labo.aRecevoir.length + labo.aGrouper.length + labo.aTester.length;
        liste.push({
          cle: "labo-encours",
          libelle: "Poches à qualifier",
          valeur: aFaire,
          detail: aFaire === 0
            ? "aucune poche en attente au laboratoire"
            : `${labo.aRecevoir.length} à réceptionner · ${labo.aGrouper.length} à grouper · ${labo.aTester.length} en sérologie`,
          adresse: "/agent/laboratoire",
          Icone: FlaskConical,
          ton: aFaire === 0 ? "calme" : "agir",
          roles: ["agent_labo", "admin"],
        });
        liste.push({
          cle: "labo-liberer",
          libelle: "Dossiers à libérer",
          valeur: labo.aLiberer.length,
          detail: labo.aLiberer.length === 0
            ? "aucun dossier complet en attente"
            : "examens terminés, verdict à confirmer",
          adresse: "/agent/laboratoire",
          Icone: CircleCheck,
          ton: labo.aLiberer.length === 0 ? "calme" : "urgent",
          roles: ["agent_labo", "admin"],
        });
      }

      if (stock) {
        const critiques = stock.filter((l) => l.niveau === "critique");
        const bas = stock.filter((l) => l.niveau === "bas");
        liste.push({
          cle: "stock-critique",
          libelle: "Groupes en rupture",
          valeur: critiques.length,
          detail: critiques.length === 0
            ? `${bas.length} groupe${bas.length > 1 ? "s" : ""} au niveau bas`
            : critiques.map((l) => `${l.typeProduit} ${l.groupeSanguin}`).join(", "),
          adresse: critiques.length > 0 ? "/agent/alertes" : "/agent/stock",
          Icone: critiques.length > 0 ? Bell : Boxes,
          ton: critiques.length > 0 ? "urgent" : bas.length > 0 ? "agir" : "calme",
          roles: ["agent_stock", "agent_depot", "admin"],
        });
      }

      if (peremption) {
        liste.push({
          cle: "peremption",
          libelle: "Produits qui périment",
          valeur: peremption.length,
          detail: peremption.length === 0 ? "rien dans les 14 jours" : "à utiliser en priorité",
          adresse: "/agent/stock",
          Icone: CalendarX2,
          ton: peremption.length === 0 ? "calme" : "agir",
          roles: ["agent_stock", "agent_depot", "admin"],
        });
      }

      if (demandes) {
        const aPreparer = demandes.filter(
          (d) => d.siteFournisseurId === a.siteId && d.statut === "en_attente",
        );
        liste.push({
          cle: "demandes",
          libelle: "Demandes à préparer",
          valeur: aPreparer.length,
          detail: aPreparer.length === 0 ? "aucune demande reçue" : "d'autres sites attendent ces produits",
          adresse: "/agent/distribution",
          Icone: Truck,
          ton: aPreparer.length === 0 ? "calme" : "agir",
          roles: ["agent_stock", "agent_depot", "admin"],
        });
      }

      setCartes(liste);
    }

    void charger(agent);
    const minuteur = setInterval(() => { void charger(agent); }, 60_000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [agent]);

  useEffect(() => {
    const maj = () => setHeure(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    maj();
    const t = setInterval(maj, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!agent) return <SqueletteLignes lignes={3} />;

  // Le nom complet est stocké « NOM Prénom » pour certains comptes et
  // « Prénom NOM » pour d'autres : on prend le mot qui n'est pas en
  // capitales, et on se rabat sur le premier si les deux le sont.
  const prenom = prenomDe(agent.nomComplet);
  const aFaire = cartes?.filter((c) => c.ton !== "calme") ?? [];
  const calmes = cartes?.filter((c) => c.ton === "calme") ?? [];

  return (
    <>
      <EnTetePage
        titre={`${salutation()} ${prenom}`}
        chapeau={`${agent.roles.map((r) => LIBELLE_ROLE[r] ?? r).join(" · ")}${heure ? ` — il est ${heure}` : ""}`}
      />

      {!cartes && <SqueletteLignes lignes={2} />}

      {cartes && (
        <>
          <Section titre="À faire maintenant" compte={aFaire.length}>
            {aFaire.length === 0 ? (
              <VideLigne Icone={CircleCheck}>
                Rien n'attend d'action de votre part. Les écrans restent accessibles
                dans le menu de gauche.
              </VideLigne>
            ) : (
              <div className="bord-grille">
                {aFaire.map((c) => <CarteBord key={c.cle} carte={c} />)}
              </div>
            )}
          </Section>

          {calmes.length > 0 && (
            <Section titre="Sous contrôle">
              <div className="bord-grille">
                {calmes.map((c) => <CarteBord key={c.cle} carte={c} />)}
              </div>
            </Section>
          )}
        </>
      )}

      <Section titre="Autres écrans">
        <div className="rang" style={{ flexWrap: "wrap" }}>
          <Raccourci adresse="/agent/accueil" mot="Accueillir un donneur" />
          <Raccourci adresse="/agent/tracabilite" mot="Rechercher un code" />
          {agent.roles.some((r) => ["agent_labo", "admin"].includes(r)) && (
            <Raccourci adresse="/agent/laboratoire" mot="Laboratoire" />
          )}
          {agent.roles.includes("admin") && <Raccourci adresse="/admin" mot="Espace CNTS" />}
        </div>
      </Section>
    </>
  );
}

function CarteBord({ carte }: { carte: Carte }) {
  const { Icone } = carte;
  return (
    <Link href={carte.adresse} className={`bord-carte bord-carte--${carte.ton}`}>
      <span className="bord-carte__haut">
        <span className="bord-carte__icone"><Icone size={17} aria-hidden="true" /></span>
        <span className="appui">{carte.libelle}</span>
      </span>
      <strong className="bord-carte__valeur chiffres">{carte.valeur}</strong>
      <span className="petit">{carte.detail}</span>
    </Link>
  );
}

function Raccourci({ adresse, mot }: { adresse: string; mot: string }) {
  return <Link href={adresse} className="bouton bouton--secondaire">{mot}</Link>;
}

/** Bonjour avant 18 h, bonsoir après : le centre travaille aussi le soir. */
function salutation(): string {
  const h = new Date().getHours();
  return h < 18 ? "Bonjour" : "Bonsoir";
}

/**
 * Prénom affichable à partir du nom complet.
 * Les comptes sont saisis tantôt « Prénom NOM », tantôt « NOM Prénom »
 * (le seed écrit « CNTS Admin »). On retient le premier mot qui n'est pas
 * entièrement en capitales ; à défaut, le dernier mot.
 */
function prenomDe(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "";
  if (mots.length === 1) return mots[0];
  return mots.find((m) => m !== m.toUpperCase()) ?? mots[mots.length - 1];
}
