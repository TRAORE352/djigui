"use client";
/**
 * P7 — Campagnes de don.
 *
 * L'agent lance une campagne de don de sang : il choisit une ville, les
 * quartiers de cette ville, le lieu de la collecte, la date et le message.
 * La campagne cible TOUS les donneurs éligibles des quartiers retenus — on ne
 * trie jamais par groupe sanguin, déterminé au laboratoire après le prélèvement.
 *
 * Le message s'écrit tout seul à partir du lieu et de la date, et reste
 * modifiable.
 */
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCheck, LoaderCircle, Megaphone, TriangleAlert, Users } from "lucide-react";
import type { SuiviAlerte, Zone } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { dateCourte } from "@/lib/metier";
import { lieuxDeLaVille } from "@/lib/lieux";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import Tableau from "@/components/Tableau";
import RechercheLieu from "@/components/RechercheLieu";
import { EtatVide, SqueletteLignes } from "@/components/Etats";
import { MessageErreur, MessageReussite } from "@/components/Messages";

const CLE_SUIVIES = "dds:campagnes-lancees";

/** Message auto-généré à partir du lieu et de la date de collecte. */
function composerMessage(lieu: string, date: string): string {
  const d = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
  return `Collecte de sang le ${d} à ${lieu}. Votre don peut sauver des vies.`;
}

function lireSuivies(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_SUIVIES);
    return brut ? (JSON.parse(brut) as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function memoriser(id: string) {
  const liste = [id, ...lireSuivies().filter((x) => x !== id)].slice(0, 8);
  window.localStorage.setItem(CLE_SUIVIES, JSON.stringify(liste));
}

export default function Campagnes() {
  const [suivies, setSuivies] = useState<string[]>([]);
  useEffect(() => { setSuivies(lireSuivies()); }, []);

  function surLancement(id: string) {
    memoriser(id);
    setSuivies(lireSuivies());
  }

  return (
    <>
      <EnTetePage
        titre="Campagnes de don"
        chapeau="Choisissez une ville, un lieu, une date : le message s'écrit tout seul."
      />

      <Composer surLancement={surLancement} />

      <section className="pile">
        <h2 className="section-titre">Campagnes lancées</h2>
        {suivies.length === 0 ? (
          <EtatVide
            Icone={BellRing}
            ton="doux"
            titre="Aucune campagne pour l'instant"
            texte="Vos campagnes et leurs réponses s'afficheront ici."
          />
        ) : (
          suivies.map((id) => <Suivi key={id} id={id} />)
        )}
      </section>
    </>
  );
}

/* =====================================================================
   Composer la campagne
   ===================================================================== */

function Composer({ surLancement }: { surLancement: (id: string) => void }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [ville, setVille] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [lieu, setLieu] = useState("");
  const [libre, setLibre] = useState(false);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [touche, setTouche] = useState(false);
  const [estimation, setEstimation] = useState<number | null>(null);
  const [estimationEnCours, setEstimationEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.zones().then((z) => setZones(z as Zone[])).catch(() => setZones([]));
  }, []);

  const villes = [...new Set(zones.map((z) => z.ville))];
  const quartiers = zones.filter((z) => z.ville === ville);
  const quartiersChoisis = quartiers.filter((z) => zoneIds.includes(z.id)).length;
  const toutesChoisies = quartiers.length > 0 && quartiersChoisis === quartiers.length;

  /**
   * Estimation automatique à chaque changement de sélection. On attend 400 ms
   * (le temps de cocher plusieurs quartiers) et on ignore toute réponse
   * dépassée par une sélection plus récente.
   */
  useEffect(() => {
    if (zoneIds.length === 0) { setEstimation(null); setEstimationEnCours(false); return; }
    let vivant = true;
    setEstimationEnCours(true);
    const minuteur = setTimeout(async () => {
      try {
        const r = await api.estimationAlerte(zoneIds);
        if (vivant) setEstimation(r.donneursCibles);
      } catch {
        if (vivant) setEstimation(null);
      } finally {
        if (vivant) setEstimationEnCours(false);
      }
    }, 400);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [zoneIds]);

  // Le message s'écrit tout seul dès que le lieu et la date sont connus,
  // tant que l'agent ne l'a pas retouché à la main.
  useEffect(() => {
    if (touche) return;
    if (!lieu || !date) return;
    setMessage(composerMessage(lieu, date));
  }, [lieu, date, touche]);

  function changerVille(v: string) {
    setVille(v);
    setLieu(""); setLibre(false);
    setErreur("");
  }

  function basculerZone(id: string) {
    setZoneIds((liste) => liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
    setErreur("");
  }

  function toutSelectionner() {
    setZoneIds((liste) => [...new Set([...liste, ...quartiers.map((z) => z.id)])]);
    setErreur("");
  }

  function toutDeselectionner() {
    setZoneIds((liste) => liste.filter((id) => !quartiers.some((z) => z.id === id)));
    setErreur("");
  }

  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite("");
    if (zoneIds.length === 0) { setErreur("Choisissez au moins un quartier."); return; }
    if (!lieu) { setErreur("Choisissez le lieu de la collecte."); return; }
    if (!date) { setErreur("Choisissez la date de la collecte."); return; }
    if (!message.trim()) { setErreur("Écrivez le message à envoyer."); return; }
    setEnCours(true);
    try {
      const campagne = await api.lancerAlerte({
        // Une campagne ne mentionne jamais de groupe : elle s'adresse à tous
        // les donneurs éligibles. Le groupe est déterminé au laboratoire.
        groupeSanguin: null,
        urgence: "normale",
        objectifDonneurs: Math.max(1, estimation ?? 1),
        dateLimite: new Date(`${date}T23:59:59`).toISOString(),
        message: message.trim(),
        zoneIds,
      });
      surLancement(campagne.id);
      setReussite("Campagne lancée. Les donneurs des quartiers choisis vont recevoir le message.");
      setMessage(""); setZoneIds([]); setVille(""); setLieu(""); setLibre(false);
      setDate(""); setTouche(false); setEstimation(null);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  const minDate = new Date().toISOString().slice(0, 10);

  const manquants = [
    zoneIds.length === 0 && "choisir un quartier",
    !lieu && "choisir un lieu",
    !date && "choisir la date",
    !message.trim() && "écrire le message",
  ].filter(Boolean) as string[];

  return (
    <form className="pile-g" onSubmit={lancer}>
      <div className="bloc pile">
        <label className="champ">
          <span className="champ__etiquette">Ville</span>
          <select className="champ__saisie" value={ville} onChange={(e) => changerVille(e.target.value)}>
            <option value="">Choisir une ville</option>
            {villes.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        {ville && (
          <>
            <div className="zones__barre">
              <span className="zones__compte">
                {quartiersChoisis > 0
                  ? `${quartiersChoisis} sur ${quartiers.length} · ${zoneIds.length} au total`
                  : `${quartiers.length} quartiers`}
              </span>
              <div className="zones__actions">
                <button type="button" className="lien-action" disabled={toutesChoisies} onClick={toutSelectionner}>
                  Tout sélectionner
                </button>
                <button type="button" className="lien-action" disabled={quartiersChoisis === 0} onClick={toutDeselectionner}>
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="zones">
              {quartiers.map((z) => (
                <label key={z.id} className="case">
                  <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => basculerZone(z.id)} />
                  <span>{z.nom}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <EstimationZones nbZones={zoneIds.length} estimation={estimation} enCours={estimationEnCours} />
      </div>

      <div className="bloc pile">
        <label className="champ">
          <span className="champ__etiquette">Lieu de la collecte</span>
          <select
            className="champ__saisie"
            value={libre ? "__libre__" : lieu}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__libre__") { setLibre(true); setLieu(""); }
              else { setLibre(false); setLieu(v); }
              setErreur("");
            }}
          >
            <option value="">Choisir un centre de santé</option>
            {lieuxDeLaVille(ville).map((l) => <option key={l} value={l}>{l}</option>)}
            <option value="__libre__">Autre lieu…</option>
          </select>
        </label>

        {libre && (
          <RechercheLieu onChoisir={(nom) => { setLieu(nom); setErreur(""); }} />
        )}
      </div>

      <div className="bloc pile">
        <label className="champ">
          <span className="champ__etiquette">Date de la collecte</span>
          <input
            className="champ__saisie"
            type="date"
            required
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="champ">
          <span className="champ__etiquette">Message</span>
          <input
            className="champ__saisie"
            value={message}
            required
            maxLength={200}
            placeholder="Le message s'écrit tout seul une fois le lieu et la date choisis."
            onChange={(e) => { setMessage(e.target.value); setTouche(true); }}
          />
          <span className="champ__aide chiffres">{200 - message.length} caractères restants</span>
        </label>

        <MessageErreur>{erreur}</MessageErreur>
        <MessageReussite>{reussite}</MessageReussite>

        {manquants.length > 0 && (
          <p className="avertissement" role="status">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>Pour lancer la campagne : {manquants.join(", ")}.</span>
          </p>
        )}

        <div className="envoi">
          <Bouton
            type="submit"
            className="envoi__bouton"
            icone={<Megaphone size={18} aria-hidden="true" />}
            enCours={enCours}
            motEnCours="Envoi en cours…"
            disabled={manquants.length > 0}
          >
            Lancer la campagne
          </Bouton>
          {estimation !== null && estimation > 0 && manquants.length === 0 && (
            <span className="envoi__portee">
              <Users size={16} aria-hidden="true" />
              {estimation} donneur{estimation > 1 ? "s" : ""} vont recevoir ce message
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * Carte d'estimation : combien de donneurs seront réellement joints.
 * Zéro n'est pas une erreur — c'est un cas métier fréquent, et il s'explique.
 */
function EstimationZones({ nbZones, estimation, enCours }: {
  nbZones: number;
  estimation: number | null;
  enCours: boolean;
}) {
  if (nbZones === 0) {
    return (
      <p className="estimation estimation--vide">
        <Users size={18} aria-hidden="true" />
        <span>Choisissez un quartier pour voir combien de donneurs sont joignables.</span>
      </p>
    );
  }

  if (enCours || estimation === null) {
    return (
      <p className="estimation estimation--attente" aria-live="polite">
        <LoaderCircle size={18} aria-hidden="true" className="tourne" />
        <span>Calcul du nombre de donneurs joignables…</span>
      </p>
    );
  }

  const vide = estimation === 0;
  return (
    <div className={`estimation estimation--${vide ? "zero" : "pleine"}`} aria-live="polite">
      <span className="estimation__icone">
        {vide ? <TriangleAlert size={20} aria-hidden="true" /> : <Users size={20} aria-hidden="true" />}
      </span>
      <span className="estimation__corps">
        <span className="estimation__chiffre chiffres">{estimation}</span>
        <span className="estimation__mot">
          {vide
            ? "donneur joignable dans ces quartiers"
            : `donneur${estimation > 1 ? "s" : ""} joignable${estimation > 1 ? "s" : ""}`}
        </span>
      </span>
    </div>
  );
}

/* =====================================================================
   Suivi d'une campagne
   ===================================================================== */

function Suivi({ id }: { id: string }) {
  const [alerte, setAlerte] = useState<SuiviAlerte | null>(null);
  const [erreur, setErreur] = useState("");
  const [cloture, setCloture] = useState(false);

  const charger = useCallback(async () => {
    try {
      setAlerte(await api.suiviAlerte(id));
      setErreur("");
    } catch (p) {
      setErreur(messageDe(p));
    }
  }, [id]);

  useEffect(() => {
    void charger();
    const minuteur = setInterval(() => { void charger(); }, 30_000);
    return () => clearInterval(minuteur);
  }, [charger]);

  useEffect(() => {
    if (alerte?.statut === "cloturee") setCloture(false);
  }, [alerte?.statut]);

  async function clore() {
    setCloture(true);
    try {
      setAlerte(await api.cloturerAlerte(id));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setCloture(false);
    }
  }

  if (erreur) return <div className="bloc"><MessageErreur>{erreur}</MessageErreur></div>;
  if (!alerte) return <SqueletteLignes lignes={1} />;

  const expire = new Date(alerte.dateLimite).getTime() < Date.now();
  const statut = alerte.statut !== "ouverte"
    ? { mot: "Clôturée", ton: "neutre" as const }
    : expire
      ? { mot: "Terminée", ton: "ocre" as const }
      : { mot: "En cours", ton: "primaire" as const };

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 0 }}>
          <span className="fort">{alerte.message}</span>
          <span className="petit">Collecte le {dateCourte(alerte.dateLimite)}</span>
        </div>
        <Pilule ton={statut.ton}>{statut.mot}</Pilule>
      </div>

      <div className="grille-3">
        <Compteur libelle="Je viens" valeur={alerte.compteurs.jeViens} ton="seve" />
        <Compteur libelle="Pas disponible" valeur={alerte.compteurs.pasDisponible} ton="neutre" />
        <Compteur libelle="Besoin de transport" valeur={alerte.compteurs.besoinTransport} ton="ocre" />
      </div>

      {alerte.donneurs.length === 0 ? (
        <p className="appui">Aucune réponse pour l&apos;instant.</p>
      ) : (
        <Tableau
          legende="Réponses des donneurs à cette campagne"
          lignes={alerte.donneurs}
          cle={(d) => d.numeroDonneur}
          colonnes={[
            { cle: "nom", entete: "Donneur", rendu: (d) => <span className="fort">{d.nom}</span> },
            { cle: "numero", entete: "Numéro", rendu: (d) => <span className="chiffres petit">{d.numeroDonneur}</span> },
            {
              cle: "reponse", entete: "Réponse",
              rendu: (d) => d.reponse === "je_viens"
                ? <Pilule ton="seve">Je viens</Pilule>
                : <Pilule ton="neutre">Pas disponible</Pilule>,
            },
            { cle: "moment", entete: "Créneau annoncé", rendu: (d) => d.momentPassage ?? "—" },
            {
              cle: "transport", entete: "Transport", actions: true,
              rendu: (d) => d.besoinTransport ? <Pilule ton="ocre">À organiser</Pilule> : <span className="petit">—</span>,
            },
          ]}
        />
      )}

      {alerte.statut === "ouverte" && (
        <div className="rang">
          <Bouton variante="secondaire" icone={<CheckCheck size={18} aria-hidden="true" />}
                  enCours={cloture} onClick={() => void clore()}>
            Clôturer la campagne
          </Bouton>
        </div>
      )}
    </div>
  );
}

function Compteur({ libelle, valeur, ton }: { libelle: string; valeur: number; ton: "seve" | "ocre" | "neutre" }) {
  const couleur = valeur === 0 ? "" : ton === "seve" ? " indicateur__valeur--seve" : ton === "ocre" ? " indicateur__valeur--ocre" : "";
  return (
    <div className="pile-s" style={{ gap: 0 }}>
      <span className="appui">{libelle}</span>
      <strong className={`indicateur__valeur chiffres${couleur}`}>{valeur}</strong>
    </div>
  );
}
