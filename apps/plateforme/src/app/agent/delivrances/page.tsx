"use client";
/**
 * P10 — Délivrances aux services de soins.
 *
 * C'est le geste le plus fréquent d'un centre : un agent de santé vient
 * chercher une poche, l'agent l'enregistre et remet un reçu. L'écran reste
 * lisible et sans ambiguïté : la délivrance est DÉFINITIVE.
 *
 * Deux choses à l'écran : le formulaire de délivrance (ouvert d'emblée) et
 * ce qui est disponible, pour trouver un code sans quitter la page.
 */
import { useState } from "react";
import { Hospital, PackageSearch, Printer } from "lucide-react";
import type { DelivranceReponse, Produit } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_PRODUIT, dateCourte } from "@/lib/metier";
import { SERVICES_SANTE } from "@/lib/services";
import { useRessource } from "@/lib/useRessource";
import { lireAgent } from "@/lib/session";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Section, VideLigne } from "@/components/Mise";
import { MessageErreur, MessageReussite } from "@/components/Messages";

/** Au-delà, la page devient un mur de codes : on pagine. */
const PAR_PAGE = 15;

type Recu = DelivranceReponse & { date: string; siteNom: string };

export default function Delivrances() {
  const [code, setCode] = useState("");
  const [service, setService] = useState("");
  const [nomAgent, setNomAgent] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recu, setRecu] = useState<Recu | null>(null);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [filtre, setFiltre] = useState("");
  const [limite, setLimite] = useState(PAR_PAGE);

  const disponibles = useRessource<Produit[]>(() => api.produitsDisponibles());

  // Tri par péremption CROISSANTE : la première unité proposée est celle qui
  // se perdra en premier (premier périmé, premier sorti).
  const q = filtre.trim().toLowerCase();
  const filtres = (disponibles.donnees ?? [])
    .filter((p) => !q
      || p.code.toLowerCase().includes(q)
      || p.groupeSanguin.toLowerCase().includes(q)
      || TYPE_PRODUIT[p.typeProduit].mot.toLowerCase().includes(q))
    .sort((a, b) => (a.datePeremption ?? "9999").localeCompare(b.datePeremption ?? "9999"));
  const visibles = filtres.slice(0, limite);

  async function delivrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite(""); setEnCours(true);
    try {
      const r = await api.delivrer({ code: code.trim(), service, nomAgent: nomAgent.trim() });
      setRecu({ ...r, date, siteNom: lireAgent()?.siteNom ?? "" });
      setReussite(`Produit ${r.code} délivré au service « ${r.service} ».`);
      // Le code se vide, PAS le service ni le nom : un agent délivre souvent
      // plusieurs poches d'affilée au même service.
      setCode("");
      void disponibles.recharger();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  const manquants = [!code.trim() && "le code", !service && "le service", !nomAgent.trim() && "le nom de l'agent"].filter(Boolean);

  return (
    <>
      <EnTetePage
        titre="Délivrances"
        chapeau="Enregistrer les produits remis aux services de soins."
        actions={
          <Bouton variante="secondaire" onClick={() => void disponibles.recharger()}>
            Actualiser
          </Bouton>
        }
      />

      <Section titre="Délivrer un produit">
        <form className="bloc pile-m" onSubmit={delivrer}>
          <div className="grille-2">
            <label className="champ">
              <span className="champ__etiquette">Code du produit</span>
              <input
                className="champ__saisie chiffres" value={code} required
                placeholder="OUA-26-04812-K-GR" autoComplete="off"
                onChange={(e) => { setCode(e.target.value); setErreur(""); }}
              />
            </label>

            <label className="champ">
              <span className="champ__etiquette">Service destinataire</span>
              <select
                className="champ__saisie" value={service} required
                onChange={(e) => { setService(e.target.value); setErreur(""); }}
              >
                <option value="">Choisir un service</option>
                {SERVICES_SANTE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="champ">
              <span className="champ__etiquette">Agent de santé qui prend la poche</span>
              <input
                className="champ__saisie" value={nomAgent} required
                placeholder="Nom de l'agent de santé" autoComplete="off"
                onChange={(e) => { setNomAgent(e.target.value); setErreur(""); }}
              />
            </label>

            <label className="champ">
              <span className="champ__etiquette">Date</span>
              <input
                className="champ__saisie" type="date" value={date} required
                onChange={(e) => { setDate(e.target.value); setErreur(""); }}
              />
            </label>
          </div>

          <MessageErreur>{erreur}</MessageErreur>
          <MessageReussite>{reussite}</MessageReussite>

          <div className="rang">
            <Bouton
              type="submit" icone={<Hospital size={18} aria-hidden="true" />}
              enCours={enCours} motEnCours="Délivrance…"
              disabled={manquants.length > 0}
            >
              Délivrer
            </Bouton>
          </div>
        </form>
      </Section>

      {recu && <Reçu recu={recu} />}

      <Section titre="Produits disponibles" compte={disponibles.donnees?.length}>
        {disponibles.chargement && <SqueletteLignes lignes={3} />}
        {disponibles.erreur && (
          <EtatErreur texte={disponibles.erreur} surReessai={() => void disponibles.recharger()} />
        )}
        {disponibles.donnees?.length === 0 && (
          <EtatVide
            Icone={PackageSearch}
            titre="Aucun produit disponible"
            texte="Enregistrez un lot reçu depuis l'écran « Stock » pour pouvoir délivrer."
            ton="doux"
          />
        )}
        {!!disponibles.donnees?.length && (
          <>
            <div className="filtre-rang">
              <label className="champ filtre-rang__champ">
                <span className="champ__etiquette">Filtrer</span>
                <input
                  className="champ__saisie"
                  value={filtre}
                  placeholder="Code, groupe ou produit"
                  autoComplete="off"
                  onChange={(e) => setFiltre(e.target.value)}
                />
              </label>
              <span className="petit">
                {visibles.length === filtres.length
                  ? `${filtres.length} unité${filtres.length > 1 ? "s" : ""}`
                  : `${visibles.length} sur ${filtres.length} affichée${visibles.length > 1 ? "s" : ""}`}
              </span>
            </div>

            {filtres.length === 0 ? (
              <VideLigne Icone={PackageSearch}>
                Aucun produit ne correspond à « {filtre} ».
              </VideLigne>
            ) : (
              <Tableau
                legende="Produits que vous pouvez délivrer"
                lignes={visibles}
                cle={(p) => p.id}
                colonnes={[
                  {
                    cle: "code", entete: "Code",
                    rendu: (p) => (
                      <button
                        type="button"
                        className="lien-code chiffres"
                        onClick={() => { setCode(p.code); setErreur(""); }}
                        title="Utiliser ce code"
                      >
                        {p.code}
                      </button>
                    ),
                  },
                  { cle: "groupe", entete: "Groupe", rendu: (p) => <BlocGroupe groupe={p.groupeSanguin} taille="s" /> },
                  { cle: "type", entete: "Produit", rendu: (p) => TYPE_PRODUIT[p.typeProduit].mot },
                  {
                    cle: "date", entete: "Périme le", actions: true,
                    rendu: (p) => (
                      <span className="petit">
                        {p.datePeremption ? dateCourte(p.datePeremption) : "sans date"}
                      </span>
                    ),
                  },
                ]}
              />
            )}

            {visibles.length < filtres.length && (
              <div className="bord-actions">
                <Bouton variante="secondaire" onClick={() => setLimite((n) => n + PAR_PAGE)}>
                  Afficher {Math.min(PAR_PAGE, filtres.length - visibles.length)} de plus
                </Bouton>
                <span className="petit">
                  Les unités qui périment le plus tôt sont listées en premier.
                </span>
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
}

/* =====================================================================
   Reçu de délivrance
   ===================================================================== */

function Reçu({ recu }: { recu: Recu }) {
  return (
    <Section titre="Reçu de délivrance">
      <div className="recu">
        <header className="recu__entete">
          <span className="recu__site">{recu.siteNom || "Centre de transfusion"}</span>
          <h2 className="recu__titre">Reçu de délivrance</h2>
        </header>

        <dl className="recu__lignes">
          <div className="recu__ligne">
            <dt>Produit</dt>
            <dd><strong>{TYPE_PRODUIT[recu.typeProduit].mot} {recu.groupeSanguin}</strong></dd>
          </div>
          <div className="recu__ligne">
            <dt>Code</dt>
            <dd className="chiffres">{recu.code}</dd>
          </div>
          <div className="recu__ligne">
            <dt>Service destinataire</dt>
            <dd>{recu.service}</dd>
          </div>
          <div className="recu__ligne">
            <dt>Reçu par</dt>
            <dd>{recu.nomAgent}</dd>
          </div>
          <div className="recu__ligne">
            <dt>Date</dt>
            <dd>{dateCourte(recu.date)}</dd>
          </div>
        </dl>

        <div className="recu__signature">
          <span>Signature de l&apos;agent de santé</span>
        </div>

        <div className="recu__actions">
          <Bouton variante="secondaire" icone={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
            Imprimer le reçu
          </Bouton>
        </div>
      </div>
    </Section>
  );
}
