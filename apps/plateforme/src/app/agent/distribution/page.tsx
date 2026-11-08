"use client";
/**
 * P8 / P10 — Distribution.
 *
 * Trois gestes, selon le côté où l'on se trouve :
 *   · demander des produits à un autre site (dépôt → centre) ;
 *   · répondre à une demande reçue en expédiant des produits ;
 *   · délivrer un produit à un service de soins (fin de la chaîne).
 *
 * Une demande reçue et une demande envoyée ne se traitent pas pareil : la
 * liste les sépare explicitement plutôt que de tout mélanger.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Hospital, PackagePlus, Send, Truck } from "lucide-react";
import type { Demande, GroupeSanguin, LigneDemande, SitePartenaire } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, TYPE_PRODUIT, TYPE_SITE, URGENCE, dateCourte, statutDemande } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { lireAgent } from "@/lib/session";
import { EnTetePage } from "@/components/Coquille";
import Explication from "@/components/Explication";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { EtatErreur, SqueletteLignes } from "@/components/Etats";
import { Repli, Section, VideLigne } from "@/components/Mise";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

export default function Distribution() {
  const demandes = useRessource<Demande[]>(() => api.demandes());
  const [siteId, setSiteId] = useState("");

  useEffect(() => { setSiteId(lireAgent()?.siteId ?? ""); }, []);

  // Une demande où notre site est fournisseur attend une expédition de notre
  // part ; une demande où il est demandeur attend l'envoi de l'autre site.
  const { recues, envoyees } = useMemo(() => {
    const liste = demandes.donnees ?? [];
    return {
      recues: liste.filter((d) => d.siteFournisseurId === siteId),
      envoyees: liste.filter((d) => d.siteDemandeurId === siteId),
    };
  }, [demandes.donnees, siteId]);

  return (
    <>
      <EnTetePage
        titre="Distribution"
        chapeau="Envoyer du sang aux hôpitaux et aux dépôts qui en demandent."
        actions={<Bouton variante="secondaire" onClick={() => void demandes.recharger()}>Actualiser</Bouton>}
      />

      <Explication
        Icone={Truck}
        role="Les hôpitaux et les dépôts n'ont pas de stock à eux : quand ils ont besoin de sang, ils vous en demandent. Cet écran sert à voir ces demandes et à leur envoyer les poches."
        quand="Chaque fois qu'une demande arrive, et avant chaque départ de véhicule."
        ensuite="Le site qui reçoit confirme la réception. Chaque poche reste traçable jusqu'au patient."
      />

      {demandes.chargement && !demandes.donnees && <SqueletteLignes lignes={3} />}
      {demandes.erreur && <EtatErreur texte={demandes.erreur} surReessai={() => void demandes.recharger()} />}

      {demandes.donnees && (
        <>
          {/* L'essentiel du métier : ce que d'autres sites attendent de nous. */}
          <Section titre="Ils attendent du sang de notre part" compte={recues.length}>
            {recues.length === 0 ? (
              <VideLigne Icone={Truck}>
Personne n'attend de sang de votre part pour l'instant. Dès qu'un hôpital
                ou un dépôt en demandera, la demande s'affichera ici avec ce qu'il faut
                préparer.
              </VideLigne>
            ) : (
              recues.map((d) => (
                <CarteDemande key={d.id} demande={d} role="fournisseur" surAction={() => void demandes.recharger()} />
              ))
            )}
          </Section>

          <Section titre="Ce que nous avons demandé à d'autres sites" compte={envoyees.length}>
            {envoyees.length === 0 ? (
              <VideLigne Icone={ArrowDownToLine}>
                Vous n'avez rien demandé à un autre site. Utilisez « Demander des produits » plus bas si votre stock ne suffit pas.
              </VideLigne>
            ) : (
              envoyees.map((d) => (
                <CarteDemande key={d.id} demande={d} role="demandeur" surAction={() => void demandes.recharger()} />
              ))
            )}
          </Section>
        </>
      )}

      {/* Les deux formulaires sont repliés : ils ne servent pas à chaque passage. */}
      <Repli
        titre="Demander des produits à un autre site"
        resume="Adresser une commande à un centre ou à un dépôt."
      >
        <FormulaireDemande surCreation={() => void demandes.recharger()} />
      </Repli>

      <Repli
        titre="Délivrer un produit à un service"
        resume="Dernière étape de la chaîne : le produit part vers un service de soins."
      >
        <Delivrance />
      </Repli>
    </>
  );
}

/* =====================================================================
   Une demande, vue du bon côté
   ===================================================================== */

function CarteDemande({ demande, role, surAction }: {
  demande: Demande;
  role: "fournisseur" | "demandeur";
  surAction: () => void;
}) {
  const [codes, setCodes] = useState("");
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);
  const statut = statutDemande(demande.statut);
  const unites = demande.lignes.reduce((t, l) => t + l.quantite, 0);

  // L'expédition attend des identifiants de produits. Tant que le lecteur de
  // code-barres n'est pas branché, l'agent colle les identifiants un par ligne.
  async function expedier() {
    const produitIds = codes.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
    if (produitIds.length === 0) { setErreur("Scannez ou collez au moins un identifiant de produit."); return; }
    setErreur(""); setReussite(""); setEnCours(true);
    try {
      const e = await api.creerExpedition({ demandeId: demande.id, produitIds });
      setReussite(`Expédition créée : ${e.produits.length} produit${e.produits.length > 1 ? "s" : ""} en route.`);
      setCodes("");
      surAction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 2 }}>
          {/* Dire QUI demande, et quoi. Un nombre seul (« 0 unité
              demandée ») ne permet pas de décider quoi faire. */}
          <span className="titre-s">
            {role === "fournisseur" ? demande.siteDemandeurNom : demande.siteFournisseurNom}
          </span>
          <span className="petit">
            {unites > 0
              ? `${unites} unité${unites > 1 ? "s" : ""} · demandé le ${dateCourte(demande.date)}`
              : `Quantité à préciser · demandé le ${dateCourte(demande.date)}`}
          </span>
        </div>
        <div className="rang" style={{ flexWrap: "wrap" }}>
          <Pilule ton={URGENCE[demande.urgence as keyof typeof URGENCE]?.ton ?? "neutre"}>
            {URGENCE[demande.urgence as keyof typeof URGENCE]?.mot ?? demande.urgence}
          </Pilule>
          <Pilule ton={statut.ton}>{statut.mot}</Pilule>
        </div>
      </div>

      <div className="pile-s">
        {demande.lignes.map((l, i) => <LigneProduit key={i} ligne={l} />)}
      </div>

      {role === "fournisseur" && demande.statut === "en_attente" && (
        <div className="pile-s">
          <label className="champ">
            <span className="champ__etiquette">Produits à expédier</span>
            <input
              className="champ__saisie chiffres"
              value={codes}
              placeholder="Scannez les produits, ou collez leurs identifiants séparés par un espace"
              onChange={(e) => { setCodes(e.target.value); setErreur(""); }}
            />
            <span className="champ__aide">
              Les produits scannés sortent du stock de ce site dès l'expédition.
            </span>
          </label>
          <div className="rang">
            <Bouton icone={<Send size={18} aria-hidden="true" />} enCours={enCours}
                    motEnCours="Expédition…" onClick={() => void expedier()}>
              Expédier
            </Bouton>
          </div>
        </div>
      )}

      {role === "demandeur" && demande.statut === "preparee" && (
        <Encadre ton="ocre">
          Les produits ont été expédiés. À leur arrivée, réceptionnez l'expédition
          depuis le bordereau de transport pour les faire entrer dans votre stock.
        </Encadre>
      )}

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>
    </div>
  );
}

function LigneProduit({ ligne }: { ligne: LigneDemande }) {
  return (
    <div className="ligne">
      <BlocGroupe groupe={ligne.groupeSanguin} taille="s" />
      <div className="ligne__corps">
        <span className="fort">{TYPE_PRODUIT[ligne.typeProduit].mot}</span>
        <span className="petit">{TYPE_PRODUIT[ligne.typeProduit].detail}</span>
      </div>
      <span className="fort chiffres">×{ligne.quantite}</span>
    </div>
  );
}

/* =====================================================================
   Nouvelle demande
   ===================================================================== */

type Brouillon = { typeProduit: "GR" | "PL" | "PQ"; groupeSanguin: GroupeSanguin; quantite: number };

function FormulaireDemande({ surCreation }: { surCreation: () => void }) {
  const [sites, setSites] = useState<SitePartenaire[]>([]);
  const [siteFournisseurId, setSite] = useState("");
  const [urgence, setUrgence] = useState<"normale" | "urgente" | "critique">("normale");
  const [lignes, setLignes] = useState<Brouillon[]>([{ typeProduit: "GR", groupeSanguin: "O+", quantite: 2 }]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.sitesPartenaires().then(setSites).catch((p) => setErreur(messageDe(p)));
  }, []);

  function modifier(index: number, maj: Partial<Brouillon>) {
    setLignes((liste) => liste.map((l, i) => (i === index ? { ...l, ...maj } : l)));
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (!siteFournisseurId) { setErreur("Choisissez le site à qui vous adressez la demande."); return; }
    setEnCours(true);
    try {
      await api.creerDemande({ siteFournisseurId, urgence, lignes });
      surCreation();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="pile" onSubmit={envoyer}>
      <div className="grille-2">
        <label className="champ">
          <span className="champ__etiquette">Site fournisseur</span>
          <select className="champ__saisie" value={siteFournisseurId} required
                  onChange={(e) => setSite(e.target.value)}>
            <option value="">Choisir…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom} — {TYPE_SITE[s.type]}{s.ville ? `, ${s.ville}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Urgence</span>
          <select className="champ__saisie" value={urgence}
                  onChange={(e) => setUrgence(e.target.value as typeof urgence)}>
            <option value="normale">Normale</option>
            <option value="urgente">Urgente</option>
            <option value="critique">Critique</option>
          </select>
        </label>
      </div>

      <div className="pile-s">
        <span className="champ__etiquette">Produits demandés</span>
        {lignes.map((l, i) => (
          <div key={i} className="rang" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="champ" style={{ minWidth: 170 }}>
              <span className="champ__etiquette sr-only">Type de produit</span>
              <select className="champ__saisie" value={l.typeProduit} aria-label="Type de produit"
                      onChange={(e) => modifier(i, { typeProduit: e.target.value as Brouillon["typeProduit"] })}>
                {(["GR", "PL", "PQ"] as const).map((t) => (
                  <option key={t} value={t}>{TYPE_PRODUIT[t].mot}</option>
                ))}
              </select>
            </label>
            <label className="champ" style={{ width: 110 }}>
              <span className="champ__etiquette sr-only">Groupe sanguin</span>
              <select className="champ__saisie" value={l.groupeSanguin} aria-label="Groupe sanguin"
                      onChange={(e) => modifier(i, { groupeSanguin: e.target.value as GroupeSanguin })}>
                {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="champ" style={{ width: 110 }}>
              <span className="champ__etiquette sr-only">Quantité</span>
              <input className="champ__saisie chiffres" type="number" min={1} max={200} value={l.quantite}
                     aria-label="Quantité"
                     onChange={(e) => modifier(i, { quantite: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            {lignes.length > 1 && (
              <Bouton variante="secondaire" compact
                      onClick={() => setLignes((liste) => liste.filter((_, j) => j !== i))}>
                Retirer
              </Bouton>
            )}
          </div>
        ))}
        <div className="rang">
          <Bouton variante="secondaire" compact
                  onClick={() => setLignes((liste) => [...liste, { typeProduit: "GR", groupeSanguin: "O+", quantite: 1 }])}>
            Ajouter une ligne
          </Bouton>
        </div>
      </div>

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton type="submit" enCours={enCours} motEnCours="Envoi…"
              icone={<PackagePlus size={18} aria-hidden="true" />}>
        Envoyer la demande
      </Bouton>
    </form>
  );
}

/* =====================================================================
   P10 — Délivrance à un service de soins
   ===================================================================== */

function Delivrance() {
  const [code, setCode] = useState("");
  const [service, setService] = useState("");
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function delivrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite(""); setEnCours(true);
    try {
      const r = await api.delivrer({ code: code.trim(), service: service.trim() });
      setReussite(`Produit ${r.code} délivré au service « ${r.service} ». La traçabilité est bouclée.`);
      setCode("");
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="pile" onSubmit={delivrer}>
      <div className="grille-2">
        <label className="champ">
          <span className="champ__etiquette">Code du produit</span>
          <input className="champ__saisie chiffres" value={code} required
                 placeholder="OUA-26-04812-K-GR" autoComplete="off"
                 onChange={(e) => { setCode(e.target.value); setErreur(""); }} />
          <span className="champ__aide">Tirets et minuscules acceptés : le code est normalisé.</span>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Service destinataire</span>
          <input className="champ__saisie" value={service} required
                 placeholder="Urgences, maternité, pédiatrie…" autoComplete="off"
                 onChange={(e) => { setService(e.target.value); setErreur(""); }} />
        </label>
      </div>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      <Bouton type="submit" icone={<Hospital size={18} aria-hidden="true" />}
              enCours={enCours} motEnCours="Délivrance…"
              disabled={!code.trim() || !service.trim()}>
        Délivrer
      </Bouton>
    </form>
  );
}
