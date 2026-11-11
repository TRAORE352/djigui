"use client";
/**
 * Tableau de bord de l'agent.
 *
 * Il répond à une seule question : « qu'est-ce que je dois faire
 * maintenant ? » Chaque chiffre est un bouton vers l'écran qui permet
 * d'agir ; aucun chiffre n'est là pour décorer.
 *
 * Hiérarchie visuelle (refonte) :
 *   · en-tête épuré — salutation, badge de contexte, horloge à droite ;
 *   · « À faire maintenant » — cartes accentuées, bordure latérale colorée,
 *     chiffre en gros, badge « Priorité haute » sur l'urgent ;
 *   · « Sous contrôle » — cartes atténuées, signal vert rassurant ;
 *   · « Autres écrans » — un seul bouton plein (accueillir un donneur),
 *     le reste en style secondaire.
 *
 * Les cartes sont filtrées par rôle : un technicien de laboratoire ne
 * voit pas les demandes de la distribution.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bell, Boxes, CalendarX2, CheckCircle2, Clock,
  Hospital, Truck, UserPlus,
} from "lucide-react";
import type { AgentConnecte, Demande, LigneStock, Produit, Role } from "@dds/contrat-api";
import { api, ErreurApi, messageDe } from "@/lib/api";
import { Section, VideLigne } from "@/components/Mise";
import { EtatErreur, SqueletteLignes } from "@/components/Etats";
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

/** Accès rapides vers les gestes les plus fréquents du poste. */
const RACCOURCIS = [
  { adresse: "/agent/accueil", mot: "Accueillir un donneur", Icone: UserPlus },
  { adresse: "/agent/delivrances", mot: "Délivrer", Icone: Hospital },
  { adresse: "/agent/stock", mot: "Stock", Icone: Boxes },
  { adresse: "/agent/alertes", mot: "Campagnes", Icone: Bell },
];

export default function TableauDeBordAgent() {
  const [agent, setAgent] = useState<AgentConnecte | null>(null);
  const [cartes, setCartes] = useState<Carte[] | null>(null);
  /*
   * Le chargement peut échouer (serveur ou base indisponible). Sans cet
   * état, `cartes` restait `null` indéfiniment et l'écran affichait un
   * squelette gris sans fin : l'agent ne savait ni ce qui se passait ni
   * quoi faire. On garde la cause pour l'afficher, avec un réessai.
   */
  const [echec, setEchec] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);
  const [heure, setHeure] = useState("");

  useEffect(() => { setAgent(lireAgent()); }, []);

  useEffect(() => {
    if (!agent) return;
    let vivant = true;

    async function charger(a: AgentConnecte) {
      const peut = (...r: Role[]) => r.some((x) => a.roles.includes(x));

      /*
       * Un refus de DROITS ne doit pas vider tout le tableau de bord :
       * on masque seulement la carte concernée. Mais une PANNE (réseau,
       * délai dépassé, base injoignable) doit remonter, sinon l'écran
       * affiche sereinement des compteurs à zéro alors qu'il ne sait
       * rien — pire qu'une erreur : un mensonge rassurant.
       */
      const sansErreur = <T,>(p: Promise<T>, defaut: T) =>
        p.catch((probleme: unknown) => {
          const code = probleme instanceof ErreurApi ? probleme.code : null;
          if (code === "RESEAU" || code === "DELAI_DEPASSE" || code === "SERVICE_INDISPONIBLE") {
            throw probleme;
          }
          return defaut;
        });

      let stock: LigneStock[] | null = null;
      let peremption: Produit[] | null = null;
      let demandes: Demande[] | null = null;

      try {
        [stock, peremption, demandes] = await Promise.all([
          peut("agent_stock", "agent_depot") ? sansErreur(api.stock(), [] as LigneStock[]) : Promise.resolve(null),
          peut("agent_stock", "agent_depot") ? sansErreur(api.produitsPeremption(), [] as Produit[]) : Promise.resolve(null),
          peut("agent_stock", "agent_depot") ? sansErreur(api.demandes(), [] as Demande[]) : Promise.resolve(null),
        ]);
      } catch (probleme) {
        // `sansErreur` neutralise les refus de droits ; ce qui remonte
        // ici est une panne globale (réseau, délai, base injoignable).
        if (vivant) { setEchec(messageDe(probleme)); setCartes(null); }
        return;
      }

      if (!vivant) return;
      setEchec(null);

      const liste: Carte[] = [];

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
          roles: ["agent_stock", "agent_depot"],
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
          roles: ["agent_stock", "agent_depot"],
        });
      }

      if (demandes) {
        const aPreparer = demandes.filter(
          (d) => d.siteFournisseurId === a.siteId && d.statut === "en_attente",
        );
        liste.push({
          cle: "demandes",
          libelle: "Demandes à accepter",
          valeur: aPreparer.length,
          detail: aPreparer.length === 0 ? "aucune demande reçue" : "d'autres sites attendent ces produits",
          adresse: "/agent/distribution/donner",
          Icone: Truck,
          ton: aPreparer.length === 0 ? "calme" : "agir",
          roles: ["agent_stock", "agent_depot"],
        });
      }

      setCartes(liste);
    }

    void charger(agent);
    const minuteur = setInterval(() => { void charger(agent); }, 60_000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [agent, essai]);

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
  const metier = agent.roles.map((r) => LIBELLE_ROLE[r] ?? r).join(", ");
  // Résumé dynamique : ce qui attend l'agent, en une phrase.
  const resume = cartes === null
    ? ""
    : aFaire.length > 0
      ? `${aFaire.length} chose${aFaire.length > 1 ? "s" : ""} à faire`
      : "Tout est à jour";

  return (
    <>
      {/* En-tête épuré : plus de fil d'Ariane textuel sous le titre. Le
          contexte tient dans un badge, l'heure part à droite. */}
      <header className="bord-entete">
        <div className="bord-entete__gauche">
          <h1 className="bord-entete__titre">{salutation()} {prenom}</h1>
          <p className="bord-entete__date">
            {dateAujourdhui()}
            {resume && <span className="bord-entete__resume"> · {resume}</span>}
          </p>
          <p className="bord-entete__contexte">
            <span className="bord-jeton">{metier}</span>
            {agent.siteNom && (
              <>
                <span className="bord-entete__sep" aria-hidden="true" />
                <span className="bord-jeton bord-jeton--sobre">{agent.siteNom}</span>
              </>
            )}
          </p>
        </div>

        <div className="bord-entete__droite">
          <span className="bord-statut">
            <span className="bord-statut__point" aria-hidden="true" />
            En ligne
          </span>
          {heure && (
            <span className="bord-horloge" title="Heure du poste">
              <Clock size={15} aria-hidden="true" />
              <span className="chiffres">{heure}</span>
            </span>
          )}
        </div>
      </header>

      {/* Une panne de chargement se dit, avec une issue : sinon l'écran
          reste gris et l'agent attend quelque chose qui ne viendra pas. */}
      {echec && (
        <EtatErreur texte={echec} surReessai={() => { setEchec(null); setEssai((n) => n + 1); }} />
      )}

      {!cartes && !echec && <SqueletteLignes lignes={2} />}

      {cartes && (
        <>
          <Section titre="À faire maintenant" compte={aFaire.length}>
            {aFaire.length === 0 ? (
              <VideLigne Icone={CheckCircle2}>
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

      <Section titre="Accès rapide">
        <div className="bord-raccourcis">
          {RACCOURCIS.map((r) => (
            <Link key={r.adresse} href={r.adresse} className="bord-raccourci">
              <r.Icone size={18} aria-hidden="true" />
              <span>{r.mot}</span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

function CarteBord({ carte }: { carte: Carte }) {
  const { Icone } = carte;
  const calme = carte.ton === "calme";
  return (
    <Link href={carte.adresse} className={`bord-carte bord-carte--${carte.ton}`}>
      <span className="bord-carte__haut">
        <span className="bord-carte__icone">
          <Icone size={17} aria-hidden="true" />
        </span>
        <span className="bord-carte__libelle">{carte.libelle}</span>
      </span>

      <span className="bord-carte__corps">
        {calme ? (
          /*
           * Une carte « calme » signale « rien à faire maintenant », son
           * compteur est donc normalement nul et on peut dire « Tout est
           * à jour ». Mais si une carte est un jour marquée calme alors
           * que son compteur n'est pas nul (un écran fermé, par exemple),
           * elle ne doit PAS mentir : on affiche le chiffre avec un badge
           * neutre « En attente » plutôt que « Tout est à jour ».
           */
          carte.valeur > 0 ? (
            <>
              <strong className="bord-carte__valeur chiffres">{carte.valeur}</strong>
              <span className="bord-badge bord-badge--calme">En attente</span>
            </>
          ) : (
            <span className="bord-carte__rassurant">
              <CheckCircle2 size={18} aria-hidden="true" />
              Tout est à jour
            </span>
          )
        ) : (
          <>
            <strong className="bord-carte__valeur chiffres">{carte.valeur}</strong>
            {carte.ton === "urgent"
              ? <span className="bord-badge bord-badge--urgent">Priorité haute</span>
              : <span className="bord-badge bord-badge--agir">À traiter</span>}
          </>
        )}
      </span>

      <span className="bord-carte__detail">{carte.detail}</span>
      <span className="bord-carte__aller">
        Ouvrir l'écran
        <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Bonjour avant 18 h, bonsoir après : le centre travaille aussi le soir. */
function salutation(): string {
  const h = new Date().getHours();
  return h < 18 ? "Bonjour" : "Bonsoir";
}

/** Date du jour, en toutes lettres : « mardi 10 novembre ». */
function dateAujourdhui(): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
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
