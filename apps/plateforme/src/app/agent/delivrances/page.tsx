"use client";
/**
 * P10 — Délivrances aux services de soins.
 *
 * Le geste le plus fréquent d'un centre : un agent de santé vient chercher une
 * poche, l'agent l'enregistre et remet un reçu. L'écran reste lisible : la
 * délivrance est DÉFINITIVE.
 *
 * Trois blocs : le formulaire (ouvert d'emblée), l'historique des délivrances
 * (triable, avec téléchargement du reçu), et les produits disponibles pour
 * trouver un code sans quitter la page.
 */
import { useEffect, useRef, useState } from "react";
import { History, Hospital, PackageSearch, Printer } from "lucide-react";
import type { Delivrance, GroupeSanguin, Produit } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_PRODUIT, dateCourte } from "@/lib/metier";
import { dateHeure } from "@/lib/format";
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

/** Pagination des produits disponibles : 5 par 5. */
const PAR_PAGE = 5;

type Recu = {
  code: string;
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  service: string;
  nomAgent: string;
  siteNom: string;
  creeLe: string;
};

/** Date et heure exactes, en toutes lettres : « mardi 10 novembre 2026, 23:04 ». */
function dateHeureComplete(valeur: string): string {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default function Delivrances() {
  const [code, setCode] = useState("");
  const [service, setService] = useState("");
  const [nomAgent, setNomAgent] = useState("");
  const [recu, setRecu] = useState<Recu | null>(null);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [filtre, setFiltre] = useState("");
  const [limite, setLimite] = useState(PAR_PAGE);
  const [tri, setTri] = useState<"date" | "groupe" | "service" | "agent">("date");

  const recuRef = useRef<HTMLDivElement>(null);

  const disponibles = useRessource<Produit[]>(() => api.produitsDisponibles());
  const historique = useRessource<Delivrance[]>(() => api.delivrances());

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

  // Historique trié : date décroissante par défaut, puis groupe/service/agent.
  const triees = [...(historique.donnees ?? [])].sort((a, b) => {
    switch (tri) {
      case "groupe": return a.groupeSanguin.localeCompare(b.groupeSanguin) || (b.creeLe < a.creeLe ? -1 : 1);
      case "service": return a.service.localeCompare(b.service) || (b.creeLe < a.creeLe ? -1 : 1);
      case "agent": return a.nomAgent.localeCompare(b.nomAgent) || (b.creeLe < a.creeLe ? -1 : 1);
      default: return new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime();
    }
  });

  async function delivrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite(""); setEnCours(true);
    try {
      const r = await api.delivrer({ code: code.trim(), service, nomAgent: nomAgent.trim() });
      setRecu({
        code: r.code, typeProduit: r.typeProduit, groupeSanguin: r.groupeSanguin,
        service: r.service, nomAgent: r.nomAgent,
        siteNom: lireAgent()?.siteNom ?? "", creeLe: new Date().toISOString(),
      });
      setReussite(`Produit ${r.code} délivré au service « ${r.service} ».`);
      // Le code se vide, PAS le service ni le nom : un agent délivre souvent
      // plusieurs poches d'affilée au même service.
      setCode("");
      void disponibles.recharger();
      void historique.recharger();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  function voirRecu(d: Delivrance) {
    setRecu({
      code: d.code, typeProduit: d.typeProduit, groupeSanguin: d.groupeSanguin,
      service: d.service, nomAgent: d.nomAgent,
      siteNom: lireAgent()?.siteNom ?? "", creeLe: d.creeLe,
    });
  }

  // Quand un reçu s'affiche (délivrance ou historique), on l'amène à l'écran.
  useEffect(() => {
    if (recu) recuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recu]);

  const manquants = [!code.trim() && "le code", !service && "le service", !nomAgent.trim() && "le nom de l'agent"].filter(Boolean);

  return (
    <>
      <EnTetePage
        titre="Délivrances"
        chapeau="Enregistrer les produits remis aux services de soins."
        actions={
          <Bouton variante="secondaire" onClick={() => { void disponibles.recharger(); void historique.recharger(); }}>
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
          </div>

          <MessageErreur>{erreur}</MessageErreur>
          <MessageReussite>{reussite}</MessageReussite>

          <div className="envoi">
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

      {recu && (
        <div ref={recuRef}>
          <Reçu recu={recu} surFermer={() => setRecu(null)} />
        </div>
      )}

      <Section titre="Historique des délivrances" compte={historique.donnees?.length}>
        <div className="rang-espace" style={{ flexWrap: "wrap", marginBottom: "var(--e3)" }}>
          <span className="appui">La plus récente d&apos;abord.</span>
          <label className="champ champ--nu" style={{ minWidth: 220 }}>
            <select className="champ__saisie" value={tri} onChange={(e) => setTri(e.target.value as typeof tri)}>
              <option value="date">Trier par date</option>
              <option value="groupe">Trier par groupe sanguin</option>
              <option value="service">Trier par service</option>
              <option value="agent">Trier par agent de santé</option>
            </select>
          </label>
        </div>

        {historique.chargement && <SqueletteLignes lignes={3} />}
        {historique.erreur && <EtatErreur texte={historique.erreur} surReessai={() => void historique.recharger()} />}
        {historique.donnees?.length === 0 && (
          <EtatVide
            Icone={History}
            titre="Aucune délivrance pour l'instant"
            texte="Les produits délivrés apparaîtront ici, avec leur reçu."
            ton="doux"
          />
        )}
        {!!historique.donnees?.length && (
          <Tableau
            legende="Délivrances enregistrées"
            lignes={triees}
            cle={(d) => d.id}
            colonnes={[
              { cle: "date", entete: "Date", rendu: (d) => <span className="petit">{dateHeure(d.creeLe)}</span> },
              {
                cle: "produit", entete: "Produit",
                rendu: (d) => (
                  <span className="rang" style={{ gap: "var(--e2)" }}>
                    <BlocGroupe groupe={d.groupeSanguin} taille="s" />
                    <span className="petit">{TYPE_PRODUIT[d.typeProduit].mot}</span>
                  </span>
                ),
              },
              { cle: "code", entete: "Code", rendu: (d) => <span className="chiffres petit">{d.code}</span> },
              { cle: "service", entete: "Service", rendu: (d) => <span className="petit">{d.service}</span> },
              { cle: "agent", entete: "Agent de santé", rendu: (d) => <span className="petit">{d.nomAgent}</span> },
              {
                cle: "recu", entete: "", actions: true,
                rendu: (d) => (
                  <button type="button" className="lien-action" onClick={() => voirRecu(d)}>
                    <Printer size={14} aria-hidden="true" /> Reçu
                  </button>
                ),
              },
            ]}
          />
        )}
      </Section>

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

function Reçu({ recu, surFermer }: { recu: Recu; surFermer?: () => void }) {
  return (
    <Section titre="Reçu de délivrance">
      <div className="recu">
        <header className="recu__entete">
          <span className="recu__icone"><Hospital size={22} aria-hidden="true" /></span>
          <h2 className="recu__titre">Reçu de délivrance</h2>
          <span className="recu__site">{recu.siteNom || "Centre de transfusion"}</span>
        </header>

        <div className="recu__date">
          {dateHeureComplete(recu.creeLe)}
        </div>

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
        </dl>

        <div className="recu__signature">
          <span>Signature de l&apos;agent de santé</span>
        </div>

        <div className="recu__actions">
          {surFermer && (
            <Bouton variante="secondaire" compact onClick={surFermer}>Fermer</Bouton>
          )}
          <Bouton variante="secondaire" icone={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
            Télécharger le reçu
          </Bouton>
        </div>
      </div>
    </Section>
  );
}
