"use client";
/**
 * P8 — Distribution.
 *
 * Deux sous-pages repliables :
 *   · « Recevoir » — je fais une demande de produits à un autre centre
 *     (ou un labo) et je réceptionne le colis à l'arrivée ;
 *   · « Donner » — je consulte les demandes qui me sont adressées, je les
 *     accepte (mon stock sort aussitôt) et je vois la livraison se clore.
 *
 * Parcours d'une demande : « en attente » → « acceptée » (le stock du
 * fournisseur sort) → « livrée » (le stock du demandeur entre).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, PackagePlus, Send, Truck } from "lucide-react";
import type { Demande, GroupeSanguin, SitePartenaire } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, TYPE_PRODUIT, TYPE_SITE, URGENCE, dateCourte, statutDemande } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { lireAgent } from "@/lib/session";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Repli, VideLigne } from "@/components/Mise";
import { MessageErreur, MessageReussite } from "@/components/Messages";

export default function Distribution() {
  const demandes = useRessource<Demande[]>(() => api.demandes());
  const [siteId, setSiteId] = useState("");

  useEffect(() => { setSiteId(lireAgent()?.siteId ?? ""); }, []);

  // « Donner » = demandes reçues (je suis fournisseur) ; « Recevoir » =
  // demandes envoyées (je suis demandeur).
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
        chapeau="Recevoir du sang d'un autre centre, ou répondre aux demandes qui vous sont adressées."
        actions={<Bouton variante="secondaire" onClick={() => void demandes.recharger()}>Actualiser</Bouton>}
      />

      {demandes.chargement && !demandes.donnees && <SqueletteLignes lignes={3} />}
      {demandes.erreur && <EtatErreur texte={demandes.erreur} surReessai={() => void demandes.recharger()} />}

      {demandes.donnees && (
        <>
          <Repli
            titre="Recevoir"
            resume={envoyees.length > 0 ? `${envoyees.length} demande${envoyees.length > 1 ? "s" : ""} en cours` : "Faire une demande à un centre ou un labo"}
          >
            <FormulaireDemande surCreation={() => void demandes.recharger()} />

            {envoyees.length === 0 ? (
              <VideLigne Icone={ArrowDownToLine}>Aucune demande en cours.</VideLigne>
            ) : (
              <div className="pile">
                {envoyees.map((d) => (
                  <CarteDemande key={d.id} demande={d} role="demandeur" surAction={() => void demandes.recharger()} />
                ))}
              </div>
            )}
          </Repli>

          <Repli
            titre="Donner"
            resume={recues.length > 0 ? `${recues.length} demande${recues.length > 1 ? "s" : ""} à traiter` : "Aucune demande à traiter"}
          >
            {recues.length === 0 ? (
              <VideLigne Icone={Truck}>Aucune demande reçue.</VideLigne>
            ) : (
              <div className="pile">
                {recues.map((d) => (
                  <CarteDemande key={d.id} demande={d} role="fournisseur" surAction={() => void demandes.recharger()} />
                ))}
              </div>
            )}
          </Repli>
        </>
      )}
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
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const statut = statutDemande(demande.statut);
  const unites = demande.lignes.reduce((t, l) => t + l.quantite, 0);

  // « Donner » : le fournisseur accepte, son stock sort aussitôt.
  async function accepter() {
    setErreur(""); setEnCours(true);
    try {
      await api.accepterDemande(demande.id);
      surAction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  // « Recevoir » : le demandeur réceptionne et vérifie, son stock entre.
  async function recevoir() {
    setErreur(""); setEnCours(true);
    try {
      await api.recevoirDemande(demande.id);
      surAction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  const attendAcceptation = role === "fournisseur" && demande.statut === "en_attente";
  const attendReception = role === "demandeur" && demande.statut === "acceptee";

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 2 }}>
          <span className="titre-s">
            {role === "fournisseur" ? demande.siteDemandeurNom : demande.siteFournisseurNom}
          </span>
          <span className="petit">
            {unites > 0 ? `${unites} unité${unites > 1 ? "s" : ""} · demandé le ${dateCourte(demande.date)}` : `Quantité à préciser · ${dateCourte(demande.date)}`}
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

      {attendAcceptation && (
        <div className="rang">
          <Bouton icone={<Send size={18} aria-hidden="true" />} enCours={enCours} onClick={() => void accepter()}>
            Demande acceptée
          </Bouton>
          <span className="petit">Votre stock sort dès que vous acceptez.</span>
        </div>
      )}

      {attendReception && (
        <div className="rang">
          <Bouton icone={<PackagePlus size={18} aria-hidden="true" />} enCours={enCours} onClick={() => void recevoir()}>
            Colis reçu et vérifié conforme
          </Bouton>
          <span className="petit">Votre stock est mis à jour à la réception.</span>
        </div>
      )}

      {role === "fournisseur" && demande.statut === "livree" && (
        <Pilule ton="seve">Colis livré avec succès</Pilule>
      )}

      <MessageErreur>{erreur}</MessageErreur>
    </div>
  );
}

function LigneProduit({ ligne }: { ligne: Demande["lignes"][number] }) {
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
   Nouvelle demande (Recevoir)
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
    api.sitesPartenaires().then((s) => setSites(s.filter((x) => x.type === "centre"))).catch((p) => setErreur(messageDe(p)));
  }, []);

  function modifier(index: number, maj: Partial<Brouillon>) {
    setLignes((liste) => liste.map((l, i) => (i === index ? { ...l, ...maj } : l)));
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (!siteFournisseurId) { setErreur("Choisissez le centre à qui vous adressez la demande."); return; }
    setEnCours(true);
    try {
      await api.creerDemande({ siteFournisseurId, urgence, lignes });
      setSite(""); setLignes([{ typeProduit: "GR", groupeSanguin: "O+", quantite: 2 }]);
      surCreation();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="bloc pile-m" onSubmit={envoyer}>
      <div className="grille-2">
        <label className="champ">
          <span className="champ__etiquette">Centre ou labo fournisseur</span>
          <select className="champ__saisie" value={siteFournisseurId} required onChange={(e) => setSite(e.target.value)}>
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
          <select className="champ__saisie" value={urgence} onChange={(e) => setUrgence(e.target.value as typeof urgence)}>
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
              <select className="champ__saisie" value={l.typeProduit} aria-label="Type de produit"
                      onChange={(e) => modifier(i, { typeProduit: e.target.value as Brouillon["typeProduit"] })}>
                {(["GR", "PL", "PQ"] as const).map((t) => <option key={t} value={t}>{TYPE_PRODUIT[t].mot}</option>)}
              </select>
            </label>
            <label className="champ" style={{ width: 110 }}>
              <select className="champ__saisie" value={l.groupeSanguin} aria-label="Groupe sanguin"
                      onChange={(e) => modifier(i, { groupeSanguin: e.target.value as GroupeSanguin })}>
                {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="champ" style={{ width: 110 }}>
              <input className="champ__saisie chiffres" type="number" min={1} max={200} value={l.quantite}
                     aria-label="Quantité"
                     onChange={(e) => modifier(i, { quantite: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            {lignes.length > 1 && (
              <Bouton variante="secondaire" compact onClick={() => setLignes((liste) => liste.filter((_, j) => j !== i))}>
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

      <div className="envoi">
        <Bouton type="submit" enCours={enCours} motEnCours="Envoi…" icone={<PackagePlus size={18} aria-hidden="true" />}>
          Envoyer la demande
        </Bouton>
      </div>
    </form>
  );
}
