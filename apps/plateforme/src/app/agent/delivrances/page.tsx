"use client";
/**
 * P10 — Délivrances aux services de soins.
 *
 * Le geste le plus fréquent d'un centre : un agent de santé vient chercher une
 * poche, l'agent l'enregistre et remet un reçu. L'écran reste lisible : la
 * délivrance est DÉFINITIVE.
 *
 * L'historique est dans une fenêtre séparée (bouton « Historique ») pour ne
 * pas surcharger la page. Le reçu s'ouvre en plein écran, imprimable en A4 et
 * partageable par messagerie.
 */
import { useState } from "react";
import { History, Hospital, Mail, MessageCircle, PackageSearch, Printer, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
import Modal from "@/components/Modal";
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

/** Date et heure exactes : « mardi 10 novembre 2026, 23:04 ». */
function dateHeureComplete(valeur: string): string {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** Texte du reçu, prêt à partager par messagerie. */
function texteRecu(r: Recu): string {
  return [
    `Reçu de délivrance — ${r.siteNom}`,
    `Produit : ${TYPE_PRODUIT[r.typeProduit].mot} ${r.groupeSanguin}`,
    `Code : ${r.code}`,
    `Service destinataire : ${r.service}`,
    `Reçu par : ${r.nomAgent}`,
    `Le ${dateHeureComplete(r.creeLe)}`,
  ].join("\n");
}

export default function Delivrances() {
  const [code, setCode] = useState("");
  const [service, setService] = useState("");
  const [nomAgent, setNomAgent] = useState("");
  const [recu, setRecu] = useState<Recu | null>(null);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [filtre, setFiltre] = useState("");
  const [limite, setLimite] = useState(PAR_PAGE);
  const [tri, setTri] = useState<"date" | "groupe" | "service" | "agent">("date");

  const disponibles = useRessource<Produit[]>(() => api.produitsDisponibles());
  const historique = useRessource<Delivrance[]>(() => api.delivrances());

  const q = filtre.trim().toLowerCase();
  const filtres = (disponibles.donnees ?? [])
    .filter((p) => !q
      || p.code.toLowerCase().includes(q)
      || p.groupeSanguin.toLowerCase().includes(q)
      || TYPE_PRODUIT[p.typeProduit].mot.toLowerCase().includes(q))
    .sort((a, b) => (a.datePeremption ?? "9999").localeCompare(b.datePeremption ?? "9999"));
  const visibles = filtres.slice(0, limite);

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

  const manquants = [!code.trim() && "le code", !service && "le service", !nomAgent.trim() && "le nom de l'agent"].filter(Boolean);

  return (
    <>
      <EnTetePage
        titre="Délivrances"
        chapeau="Enregistrer les produits remis aux services de soins."
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => { void disponibles.recharger(); void historique.recharger(); }}>
              Actualiser
            </Bouton>
            <Bouton variante="secondaire" icone={<History size={18} aria-hidden="true" />} onClick={() => setHistoriqueOuvert(true)}>
              Historique
            </Bouton>
          </>
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

      {historiqueOuvert && (
        <Modal titre="Historique des délivrances" surFermer={() => setHistoriqueOuvert(false)}>
          <Historique tri={tri} setTri={setTri} triees={triees} historique={historique} surReçu={voirRecu} />
        </Modal>
      )}

      {recu && (
        <Modal surFermer={() => setRecu(null)}>
          <Reçu recu={recu} surFermer={() => setRecu(null)} />
        </Modal>
      )}
    </>
  );
}

/* =====================================================================
   Historique des délivrances
   ===================================================================== */

function Historique({ tri, setTri, triees, historique, surReçu }: {
  tri: "date" | "groupe" | "service" | "agent";
  setTri: (t: "date" | "groupe" | "service" | "agent") => void;
  triees: Delivrance[];
  historique: { chargement: boolean; erreur: string | null; donnees: Delivrance[] | null; recharger: () => void };
  surReçu: (d: Delivrance) => void;
}) {
  return (
    <div className="pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
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

      {historique.chargement && <SqueletteLignes lignes={4} />}
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
                <button type="button" className="lien-action" onClick={() => surReçu(d)}>
                  <Printer size={14} aria-hidden="true" /> Reçu
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

/* =====================================================================
   Reçu de délivrance
   ===================================================================== */

function Reçu({ recu, surFermer }: { recu: Recu; surFermer?: () => void }) {
  const qr = `DJIGUI ${recu.code} — ${dateHeureComplete(recu.creeLe)}`;
  const texte = texteRecu(recu);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(texte)}`;
  const mail = `mailto:?subject=${encodeURIComponent("Reçu de délivrance")}&body=${encodeURIComponent(texte)}`;

  async function partager() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Reçu de délivrance", text: texte }); } catch { /* annulé */ }
    }
  }

  return (
    <div className="recu">
      <header className="recu__entete">
        <span className="recu__marque"><Hospital size={22} aria-hidden="true" /> DJIGUI</span>
        <h2 className="recu__titre">Reçu de délivrance</h2>
        <span className="recu__site">{recu.siteNom || "Centre de transfusion"}</span>
      </header>

      <div className="recu__ref">
        <span>N° {recu.code}</span>
        <span>{dateHeureComplete(recu.creeLe)}</span>
      </div>

      <div className="recu__corps">
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

        <div className="recu__qr">
          <QRCodeSVG value={qr} size={120} />
          <span>Scannez pour vérifier</span>
        </div>

        <div className="recu__signature">
          <span>Signature de l&apos;agent de santé</span>
        </div>
      </div>

      <footer className="recu__pied">
        Ce reçu atteste la remise du produit sanguin au service indiqué.
      </footer>

      <div className="recu__actions">
        <div className="recu__partage">
          <a className="bouton--partage bouton--partage--whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
          </a>
          <a className="bouton--partage" href={mail}>
            <Mail size={16} aria-hidden="true" /> E-mail
          </a>
          <button type="button" className="bouton--partage" onClick={() => void partager()}>
            <Share2 size={16} aria-hidden="true" /> Partager
          </button>
        </div>
        <div className="rang" style={{ gap: "var(--e2)" }}>
          {surFermer && <Bouton variante="secondaire" compact onClick={surFermer}>Fermer</Bouton>}
          <Bouton variante="secondaire" icone={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
            Télécharger
          </Bouton>
        </div>
      </div>
    </div>
  );
}
