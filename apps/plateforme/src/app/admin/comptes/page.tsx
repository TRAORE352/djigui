"use client";
/**
 * P1 — Comptes et rôles.
 *
 * Le CNTS voit ici TOUTES les personnes du réseau : les agents, le laboratoire
 * et les donneurs. On filtre par type puis par ville, la liste se déploie, et
 * un clic sur un nom ouvre son historique d'activité.
 */
import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import type { AgentCompte, DonneurAdmin, Evenement, Role, SiteAdmin } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_SITE, libelleEvenement, telephoneLisible } from "@/lib/metier";
import { depuis } from "@/lib/format";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import Modal from "@/components/Modal";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { MessageErreur, MessageReussite } from "@/components/Messages";

type Categorie = "agent" | "labo" | "donneur";

type Personne = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  ville: string;
  zone: string;
  categorie: Categorie;
  detail: string;
  actif: boolean;
};

const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  agent: "Agent",
  labo: "Laboratoire",
  donneur: "Donneur",
};

const TON_CATEGORIE: Record<Categorie, "primaire" | "seve" | "neutre"> = {
  agent: "primaire",
  labo: "seve",
  donneur: "neutre",
};

/** Rôles attribuables à un compte de la plateforme (« donneur » n'en est pas un). */
const ROLES: { role: Role; libelle: string; ceQueCaDonne: string }[] = [
  { role: "agent_accueil", libelle: "Accueil", ceQueCaDonne: "Retrouver et inscrire les donneurs, enregistrer leur venue" },
  { role: "agent_prelevement", libelle: "Prélèvement", ceQueCaDonne: "Créer les poches après le prélèvement" },
  { role: "agent_labo", libelle: "Laboratoire", ceQueCaDonne: "Qualifier les poches et préparer les produits" },
  { role: "agent_stock", libelle: "Stock", ceQueCaDonne: "Suivre le stock, lancer les alertes, distribuer" },
  { role: "agent_depot", libelle: "Dépôt", ceQueCaDonne: "Demander et réceptionner des produits, délivrer aux services" },
  { role: "admin", libelle: "Administrateur", ceQueCaDonne: "Tout l'espace CNTS : comptes, réseau, règles" },
];

const LIBELLE = Object.fromEntries(ROLES.map((r) => [r.role, r.libelle])) as Record<Role, string>;

export default function Comptes() {
  const agents = useRessource<AgentCompte[]>(() => api.agents());
  const donneurs = useRessource<DonneurAdmin[]>(() => api.donneurs());
  const sites = useRessource<SiteAdmin[]>(() => api.sites());
  const [type, setType] = useState<"tous" | Categorie>("tous");
  const [ville, setVille] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [reussite, setReussite] = useState("");
  const [personne, setPersonne] = useState<{ id: string; nom: string } | null>(null);

  // Une seule liste : agents + laboratoire + donneurs, triée par ville puis nom.
  const personnes = useMemo<Personne[]>(() => {
    const liste: Personne[] = [];
    for (const a of agents.donnees ?? []) {
      const categorie: Categorie = a.roles.includes("agent_labo") ? "labo" : "agent";
      liste.push({
        id: a.id, nom: a.nom, prenom: a.prenom, telephone: a.telephone,
        ville: a.ville, zone: "", categorie, detail: a.siteNom, actif: a.actif,
      });
    }
    for (const d of donneurs.donnees ?? []) {
      liste.push({
        id: d.id, nom: d.nom, prenom: d.prenom, telephone: d.telephone,
        ville: d.ville, zone: d.zone, categorie: "donneur",
        detail: d.groupeSanguin ?? "groupe inconnu", actif: d.actif,
      });
    }
    return liste.sort((a, b) => a.ville.localeCompare(b.ville) || a.nom.localeCompare(b.nom));
  }, [agents.donnees, donneurs.donnees]);

  const filtree = personnes.filter((p) => {
    if (type !== "tous" && p.categorie !== type) return false;
    if (ville && p.ville !== ville) return false;
    return true;
  });

  const villes = useMemo(
    () => [...new Set(personnes.map((p) => p.ville).filter(Boolean))].sort(),
    [personnes],
  );

  return (
    <>
      <EnTetePage
        titre="Comptes et rôles"
        chapeau="Toutes les personnes du réseau : agents, laboratoire et donneurs."
        actions={
          <Bouton
            variante={ouvert ? "secondaire" : "principal"}
            icone={<UserPlus size={18} aria-hidden="true" />}
            onClick={() => { setOuvert((v) => !v); setReussite(""); }}
          >
            {ouvert ? "Fermer" : "Créer un compte"}
          </Bouton>
        }
      />

      <MessageReussite>{reussite}</MessageReussite>

      {ouvert && (
        <FormulaireAgent
          sites={sites.donnees ?? []}
          surCreation={(cree) => {
            setOuvert(false);
            setReussite(`Compte créé pour ${cree.prenom} ${cree.nom}.`);
            void agents.recharger();
          }}
        />
      )}

      <div className="rang" style={{ flexWrap: "wrap", gap: "var(--e3)", margin: "var(--e3) 0" }}>
        <label className="champ" style={{ minWidth: 200 }}>
          <span className="champ__etiquette">Type</span>
          <select className="champ__saisie" value={type} onChange={(e) => { setType(e.target.value as typeof type); setVille(""); }}>
            <option value="tous">Tous</option>
            <option value="agent">Agents</option>
            <option value="labo">Laboratoire</option>
            <option value="donneur">Donneurs</option>
          </select>
        </label>
        <label className="champ" style={{ minWidth: 200 }}>
          <span className="champ__etiquette">Ville</span>
          <select className="champ__saisie" value={ville} onChange={(e) => setVille(e.target.value)}>
            <option value="">Toutes les villes</option>
            {villes.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      {(agents.chargement || donneurs.chargement) && !filtree.length && <SqueletteLignes lignes={4} />}
      {(agents.erreur || donneurs.erreur) && (
        <EtatErreur texte={agents.erreur ?? donneurs.erreur ?? ""} surReessai={() => { void agents.recharger(); void donneurs.recharger(); }} />
      )}

      {filtree.length === 0 && !agents.chargement && !donneurs.chargement && (
        <EtatVide Icone={Users} titre="Aucune personne" texte="Aucun compte ne correspond à ces filtres." />
      )}

      {filtree.length > 0 && (
        <Tableau
          legende="Personnes du réseau"
          lignes={filtree}
          cle={(p) => `${p.categorie}-${p.id}`}
          colonnes={[
            {
              cle: "personne", entete: "Personne",
              rendu: (p) => (
                <span className="pile-s" style={{ gap: 0 }}>
                  <button type="button" className="lien-action" style={{ textAlign: "left" }} onClick={() => setPersonne({ id: p.id, nom: `${p.prenom} ${p.nom}` })}>
                    {p.prenom} {p.nom}
                  </button>
                  <span className="petit">{telephoneLisible(p.telephone)}</span>
                </span>
              ),
            },
            { cle: "categorie", entete: "Type", rendu: (p) => <Pilule ton={TON_CATEGORIE[p.categorie]}>{LIBELLE_CATEGORIE[p.categorie]}</Pilule> },
            {
              cle: "localisation", entete: "Localisation",
              rendu: (p) => (
                <span className="pile-s" style={{ gap: 0 }}>
                  <span className="petit">{p.ville || "—"}{p.zone ? ` · ${p.zone}` : ""}</span>
                  <span className="petit">{p.categorie === "donneur" ? p.detail : p.detail}</span>
                </span>
              ),
            },
            { cle: "etat", entete: "État", actions: true, rendu: (p) => <Pilule ton={p.actif ? "seve" : "neutre"}>{p.actif ? "Actif" : "Inactif"}</Pilule> },
          ]}
        />
      )}

      {personne && (
        <Modal titre={personne.nom} surFermer={() => setPersonne(null)}>
          <ActivitePersonne id={personne.id} />
        </Modal>
      )}
    </>
  );
}

function ActivitePersonne({ id }: { id: string }) {
  const activite = useRessource<Evenement[]>(() => api.activitePersonne(id));
  if (activite.chargement && !activite.donnees) return <SqueletteLignes lignes={4} />;
  if (activite.erreur) return <EtatErreur texte={activite.erreur} surReessai={() => void activite.recharger()} />;
  if (activite.donnees?.length === 0) return <p className="appui">Aucune activité enregistrée.</p>;
  return (
    <div className="bloc pile-s">
      {(activite.donnees ?? []).map((e) => (
        <div key={e.id} className="activite-ligne">
          <span className="activite-ligne__point" aria-hidden="true" />
          <span className="activite-ligne__texte">
            {libelleEvenement(e.type)}
            {e.cible && <span className="chiffres"> · {e.cible}</span>}
            {e.siteNom && <span className="petit"> · {e.siteNom}</span>}
          </span>
          <span className="petit" style={{ flexShrink: 0 }}>{depuis(e.date)}</span>
        </div>
      ))}
    </div>
  );
}

function FormulaireAgent({ sites, surCreation }: { sites: SiteAdmin[]; surCreation: (cree: AgentCompte) => void }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [siteId, setSiteId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function basculerRole(role: Role) {
    setRoles((liste) => liste.includes(role) ? liste.filter((r) => r !== role) : [...liste, role]);
    setErreur("");
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (roles.length === 0) { setErreur("Choisissez au moins un rôle."); return; }
    if (!siteId) { setErreur("Choisissez un site de rattachement."); return; }
    if (motDePasse.length < 8) { setErreur("Le mot de passe provisoire doit faire 8 caractères au moins."); return; }
    setEnCours(true);
    try {
      surCreation(await api.creerAgent({ nom, prenom, email, telephone, motDePasse, siteId, roles }));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="bloc pile" onSubmit={envoyer}>
      <h2 className="titre-s">Nouveau compte</h2>
      <div className="grille-3">
        <label className="champ"><span className="champ__etiquette">Prénom</span><input className="champ__saisie" value={prenom} required autoComplete="off" onChange={(e) => setPrenom(e.target.value)} /></label>
        <label className="champ"><span className="champ__etiquette">Nom</span><input className="champ__saisie" value={nom} required autoComplete="off" onChange={(e) => setNom(e.target.value)} /></label>
        <label className="champ"><span className="champ__etiquette">Adresse e-mail professionnelle</span><input className="champ__saisie" type="email" value={email} required autoComplete="off" placeholder="prenom.nom@cnts.bf" onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="champ"><span className="champ__etiquette">Téléphone</span><input className="champ__saisie chiffres" inputMode="tel" value={telephone} placeholder="+226 70 00 00 00" autoComplete="off" onChange={(e) => setTelephone(e.target.value)} /></label>
        <label className="champ"><span className="champ__etiquette">Mot de passe provisoire</span><input className="champ__saisie" type="password" value={motDePasse} required minLength={8} autoComplete="new-password" onChange={(e) => setMotDePasse(e.target.value)} /></label>
        <label className="champ">
          <span className="champ__etiquette">Site de rattachement</span>
          <select className="champ__saisie" value={siteId} required onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Choisir…</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom} — {TYPE_SITE[s.type]}{s.ville ? `, ${s.ville}` : ""}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="champ__etiquette">Rôles</legend>
        <div className="grille-2" style={{ marginTop: "var(--e2)" }}>
          {ROLES.map((r) => (
            <label key={r.role} className="case" style={{ height: "auto", paddingTop: 8, paddingBottom: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={roles.includes(r.role)} onChange={() => basculerRole(r.role)} style={{ marginTop: 3 }} />
              <span className="pile-s" style={{ gap: 0, alignItems: "flex-start" }}>
                <span>{r.libelle}</span>
                <span className="petit">{r.ceQueCaDonne}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <MessageErreur>{erreur}</MessageErreur>
      <div className="rang">
        <Bouton type="submit" enCours={enCours} motEnCours="Création…" icone={<UserPlus size={18} aria-hidden="true" />}>Créer le compte</Bouton>
      </div>
    </form>
  );
}
