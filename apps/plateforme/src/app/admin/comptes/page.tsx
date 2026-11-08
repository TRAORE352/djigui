"use client";
/**
 * P1 — Comptes et rôles.
 *
 * Un compte = une personne, un site de rattachement, et un ou plusieurs
 * rôles qui décident de ce qu'elle voit dans l'espace agent. Les rôles sont
 * décrits en clair : « Laboratoire » dit mieux que `agent_labo` ce que la
 * personne pourra faire.
 */
import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import type { AgentCompte, Role, SiteAdmin } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_SITE, telephoneLisible } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import Tableau from "@/components/Tableau";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { MessageErreur, MessageReussite } from "@/components/Messages";

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
  const sites = useRessource<SiteAdmin[]>(() => api.sites());
  const [ouvert, setOuvert] = useState(false);
  const [reussite, setReussite] = useState("");

  // Les comptes désactivés en dernier : on travaille sur les actifs.
  const liste = useMemo(
    () => [...(agents.donnees ?? [])].sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom)),
    [agents.donnees],
  );

  return (
    <>
      <EnTetePage
        titre="Comptes et rôles"
        chapeau="Chaque agent se connecte avec son e-mail professionnel. Ses rôles décident de ce qu'il voit."
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
            setReussite(`Compte créé pour ${cree.prenom} ${cree.nom}. Donnez-lui son mot de passe provisoire : il le changera lui-même.`);
            void agents.recharger();
          }}
        />
      )}

      {agents.chargement && <SqueletteLignes lignes={4} />}
      {agents.erreur && <EtatErreur texte={agents.erreur} surReessai={() => void agents.recharger()} />}

      {agents.donnees?.length === 0 && (
        <EtatVide
          Icone={Users}
          titre="Aucun compte pour l'instant"
          texte="Créez les comptes des agents du réseau : un accueil, un laboratoire, un gestionnaire de stock pour commencer."
          action={<Bouton icone={<UserPlus size={18} aria-hidden="true" />} onClick={() => setOuvert(true)}>Créer un compte</Bouton>}
        />
      )}

      {liste.length > 0 && (
        <Tableau
          legende="Comptes de la plateforme et leurs rôles"
          lignes={liste}
          cle={(a) => a.id}
          colonnes={[
            {
              cle: "personne", entete: "Personne",
              rendu: (a) => (
                <span className="pile-s" style={{ gap: 0 }}>
                  <span className="fort">{a.prenom} {a.nom}</span>
                  <span className="petit">{a.email}</span>
                </span>
              ),
            },
            {
              cle: "telephone", entete: "Téléphone",
              rendu: (a) => <span className="chiffres petit">{telephoneLisible(a.telephone)}</span>,
            },
            { cle: "site", entete: "Site", rendu: (a) => a.siteNom },
            {
              cle: "roles", entete: "Rôles",
              rendu: (a) => (
                <span className="rang" style={{ flexWrap: "wrap", gap: "var(--e1)" }}>
                  {a.roles.map((r) => (
                    <Pilule key={r} ton={r === "admin" ? "sang" : "neutre"}>{LIBELLE[r] ?? r}</Pilule>
                  ))}
                </span>
              ),
            },
            {
              cle: "etat", entete: "État", actions: true,
              rendu: (a) => <Pilule ton={a.actif ? "seve" : "neutre"}>{a.actif ? "Actif" : "Désactivé"}</Pilule>,
            },
          ]}
        />
      )}
    </>
  );
}

function FormulaireAgent({ sites, surCreation }: {
  sites: SiteAdmin[];
  surCreation: (cree: AgentCompte) => void;
}) {
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

    // Garde-fous côté écran, pour éviter un aller-retour inutile au serveur.
    if (roles.length === 0) { setErreur("Choisissez au moins un rôle : sans rôle, le compte ne peut rien faire."); return; }
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
        <label className="champ">
          <span className="champ__etiquette">Prénom</span>
          <input className="champ__saisie" value={prenom} required autoComplete="off"
                 onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Nom</span>
          <input className="champ__saisie" value={nom} required autoComplete="off"
                 onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Adresse e-mail professionnelle</span>
          <input className="champ__saisie" type="email" value={email} required autoComplete="off"
                 placeholder="prenom.nom@cnts.bf"
                 onChange={(e) => setEmail(e.target.value)} />
          <span className="champ__aide">Sert d'identifiant de connexion.</span>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Téléphone</span>
          <input className="champ__saisie chiffres" inputMode="tel" value={telephone}
                 placeholder="+226 70 00 00 00" autoComplete="off"
                 onChange={(e) => setTelephone(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Mot de passe provisoire</span>
          <input className="champ__saisie" type="password" value={motDePasse} required
                 minLength={8} autoComplete="new-password"
                 onChange={(e) => setMotDePasse(e.target.value)} />
          <span className="champ__aide">8 caractères au moins. L'agent le changera lui-même.</span>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Site de rattachement</span>
          <select className="champ__saisie" value={siteId} required
                  onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Choisir…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nom} — {TYPE_SITE[s.type]} ({s.code})</option>
            ))}
          </select>
          <span className="champ__aide">Détermine le stock et les poches que l'agent verra.</span>
        </label>
      </div>

      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="champ__etiquette">Rôles</legend>
        <div className="grille-2" style={{ marginTop: "var(--e2)" }}>
          {ROLES.map((r) => (
            <label key={r.role} className="case" style={{ height: "auto", paddingTop: 8, paddingBottom: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={roles.includes(r.role)} onChange={() => basculerRole(r.role)}
                     style={{ marginTop: 3 }} />
              <span className="pile-s" style={{ gap: 0, alignItems: "flex-start" }}>
                <span>{r.libelle}</span>
                <span className="petit">{r.ceQueCaDonne}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton type="submit" enCours={enCours} motEnCours="Création…"
              icone={<UserPlus size={18} aria-hidden="true" />}>
        Créer le compte
      </Bouton>
    </form>
  );
}
