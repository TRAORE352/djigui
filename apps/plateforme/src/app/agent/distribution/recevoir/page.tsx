"use client";
/**
 * Distribution — Recevoir : je demande des produits à un autre centre (ou un
 * labo), puis je réceptionne le colis à l'arrivée.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, PackagePlus } from "lucide-react";
import type { Demande, GroupeSanguin, SitePartenaire } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, TYPE_PRODUIT, TYPE_SITE } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { lireAgent } from "@/lib/session";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import { EtatErreur, SqueletteLignes } from "@/components/Etats";
import { Section, VideLigne } from "@/components/Mise";
import { MessageErreur } from "@/components/Messages";
import { CarteDemande } from "@/components/CarteDemande";

export default function Recevoir() {
  const demandes = useRessource<Demande[]>(() => api.demandes());
  const [siteId, setSiteId] = useState("");
  useEffect(() => { setSiteId(lireAgent()?.siteId ?? ""); }, []);

  const envoyees = useMemo(
    () => (demandes.donnees ?? []).filter((d) => d.siteDemandeurId === siteId),
    [demandes.donnees, siteId],
  );

  return (
    <>
      <EnTetePage
        titre="Recevoir"
        chapeau="Demander du sang à un autre centre, puis réceptionner le colis à l'arrivée."
        actions={<Bouton variante="secondaire" onClick={() => void demandes.recharger()}>Actualiser</Bouton>}
      />

      <FormulaireDemande surCreation={() => void demandes.recharger()} />

      <Section titre="Mes demandes" compte={envoyees.length}>
        {demandes.chargement && !demandes.donnees && <SqueletteLignes lignes={3} />}
        {demandes.erreur && <EtatErreur texte={demandes.erreur} surReessai={() => void demandes.recharger()} />}
        {demandes.donnees && envoyees.length === 0 && (
          <VideLigne Icone={ArrowDownToLine}>Aucune demande en cours.</VideLigne>
        )}
        {envoyees.map((d) => (
          <CarteDemande key={d.id} demande={d} role="demandeur" surAction={() => void demandes.recharger()} />
        ))}
      </Section>
    </>
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
    <Section titre="Nouvelle demande">
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
    </Section>
  );
}
