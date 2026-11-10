"use client";
/**
 * P7 — Campagnes de don.
 *
 * L'agent lance une campagne de don de sang : il choisit la zone, la date de
 * collecte et le message. La campagne cible TOUS les donneurs éligibles de la
 * zone — on ne trie jamais par groupe sanguin, qui n'est connu qu'après le
 * prélèvement, au laboratoire.
 *
 * Le backend n'expose pas de liste des campagnes du site : on garde donc sur
 * le poste les identifiants des campagnes lancées ici, pour y revenir après
 * un rechargement. C'est un confort local, pas une source de vérité — chaque
 * suivi est toujours relu auprès du serveur.
 */
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCheck, LoaderCircle, Megaphone, TriangleAlert, Users } from "lucide-react";
import type { SuiviAlerte, Zone } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { dateCourte } from "@/lib/metier";
import { EnTetePage } from "@/components/Coquille";
import Aide, { AvecAide } from "@/components/Aide";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import Tableau from "@/components/Tableau";
import { EtatVide, SqueletteLignes } from "@/components/Etats";
import { MessageErreur, MessageReussite } from "@/components/Messages";
import { Etape } from "@/components/Explication";

const CLE_SUIVIES = "dds:campagnes-lancees";

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
        chapeau="Choisissez une zone, une date et un message : les donneurs éligibles sont prévenus."
      />

      <Composer surLancement={surLancement} />

      <section className="pile">
        <h2 className="section-titre">
          <AvecAide
            etiquette="Campagnes lancées"
            aide="Les campagnes lancées depuis ce poste. Les réponses sont relues auprès du serveur toutes les trente secondes."
          >
            <span>Campagnes lancées</span>
          </AvecAide>
        </h2>
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
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [estimation, setEstimation] = useState<number | null>(null);
  const [estimationEnCours, setEstimationEnCours] = useState(false);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.zones().then((z) => setZones(z as Zone[])).catch(() => setZones([]));
  }, []);

  /**
   * Estimation automatique à chaque changement de sélection.
   *
   * L'agent ne doit pas cliquer pour savoir combien de monde il joint : le
   * chiffre fait partie de la décision. On attend 400 ms (le temps de cocher
   * plusieurs quartiers d'un trait) et on ignore toute réponse dépassée par
   * une sélection plus récente.
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

  function basculerZone(id: string) {
    setZoneIds((liste) => liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
    setErreur("");
  }

  const toutesChoisies = zones.length > 0 && zoneIds.length === zones.length;

  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite("");
    if (zoneIds.length === 0) { setErreur("Choisissez au moins une zone."); return; }
    if (!date) { setErreur("Choisissez la date de la collecte."); return; }
    if (!message.trim()) { setErreur("Écrivez le message à envoyer."); return; }
    setEnCours(true);
    try {
      const campagne = await api.lancerAlerte({
        // Une campagne ne mentionne jamais de groupe : elle s'adresse à tous
        // les donneurs éligibles. Le groupe est déterminé au laboratoire,
        // après le prélèvement.
        groupeSanguin: null,
        urgence: "normale",
        objectifDonneurs: Math.max(1, estimation ?? 1),
        dateLimite: new Date(`${date}T23:59:59`).toISOString(),
        message: message.trim(),
        zoneIds,
      });
      surLancement(campagne.id);
      setReussite("Campagne lancée. Les donneurs des zones choisies vont recevoir le message.");
      setMessage(""); setZoneIds([]); setDate(""); setEstimation(null);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  // La collecte ne se planifie pas dans le passé.
  const minDate = new Date().toISOString().slice(0, 10);

  // Ce qui manque encore, nommé à l'endroit où le corriger.
  const manquants = [
    zoneIds.length === 0 && "choisir une zone",
    !date && "choisir la date",
    !message.trim() && "écrire le message",
  ].filter(Boolean) as string[];

  return (
    <form className="pile-g" onSubmit={lancer}>
      <Etape
        numero={1}
        titre="Où ?"
        aide="La campagne part vers tous les donneurs éligibles de ces quartiers. Le tri ne se fait jamais par groupe sanguin : il est déterminé au laboratoire, après le prélèvement."
      >
        <div className="bloc pile">
          {zones.length === 0 ? (
            <p className="champ__aide">Chargement des zones…</p>
          ) : (
            <>
              {/* Sélection rapide : un centre qui appelle toute la ville ne
                  doit pas cocher six cases une par une. */}
              <div className="zones__barre">
                <span className="zones__compte">
                  {zoneIds.length === 0
                    ? `${zones.length} quartiers disponibles`
                    : `${zoneIds.length} sur ${zones.length} choisis`}
                </span>
                <div className="zones__actions">
                  <button
                    type="button"
                    className="lien-action"
                    disabled={toutesChoisies}
                    onClick={() => { setZoneIds(zones.map((z) => z.id)); setErreur(""); }}
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    className="lien-action"
                    disabled={zoneIds.length === 0}
                    onClick={() => { setZoneIds([]); setErreur(""); }}
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>

              <div className="zones">
                {zones.map((z) => (
                  <label key={z.id} className="case">
                    <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => basculerZone(z.id)} />
                    <span>{z.nom}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <EstimationZones
            nbZones={zoneIds.length}
            estimation={estimation}
            enCours={estimationEnCours}
          />
        </div>
      </Etape>

      <Etape
        numero={2}
        titre="Quand, et quoi dire ?"
        aide="Le jour de la collecte, puis le message que chaque donneur lira sur son téléphone."
      >
        <div className="bloc pile">
          <label className="champ">
            <AvecAide
              etiquette="Date de la collecte"
              aide="Le jour où les donneurs sont attendus au centre. Ils peuvent répondre jusqu'à la fin de cette journée."
            >
              <span className="champ__etiquette">Date de la collecte</span>
            </AvecAide>
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
            <AvecAide
              etiquette="Message aux donneurs"
              aide="Le texte que chaque donneur recevra. Une phrase simple, comme vous la diriez au guichet."
            >
              <span className="champ__etiquette">Message aux donneurs</span>
            </AvecAide>
            <input
              className="champ__saisie"
              value={message}
              required
              maxLength={200}
              placeholder="Collecte de sang au centre ce samedi. Votre don peut sauver des vies."
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="champ__aide chiffres">{200 - message.length} caractères restants</span>
          </label>

          <MessageErreur>{erreur}</MessageErreur>
          <MessageReussite>{reussite}</MessageReussite>

          {/* Ce qui manque est dit AVANT le bouton, pas après : on ne laisse
              pas l'agent cliquer sur un bouton mort en cherchant pourquoi. */}
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
      </Etape>
    </form>
  );
}

/**
 * Carte d'estimation : combien de donneurs seront réellement joints.
 *
 * Le chiffre est une décision, pas une statistique : il dit à l'agent si sa
 * sélection de quartiers suffit. Zéro n'est pas une erreur — c'est un cas
 * métier fréquent (tous les donneurs du secteur ont donné récemment), et il
 * doit s'expliquer.
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
        <span>Cochez un quartier pour voir combien de donneurs sont joignables.</span>
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
      <Aide etiquette="Donneurs joignables">
        {vide
          ? "Les donneurs de ces quartiers ont tous donné trop récemment, ou sont en pause. Cochez d'autres zones pour élargir la campagne."
          : "Les donneurs en pause, et ceux qui ont donné trop récemment, sont déjà retirés de ce total."}
      </Aide>
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

  // Les réponses arrivent au fil de l'eau : on relit toutes les 30 secondes
  // tant que la campagne est ouverte, et on s'arrête dès qu'elle est clôturée.
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

  // Trois états distincts : clôturée à la main, terminée parce que la date
  // est passée, ou en cours.
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
          <Aide etiquette="Clôturer la campagne">
            Arrête les relances auprès des donneurs. Ceux qui sont déjà venus restent enregistrés, et le suivi reste consultable.
          </Aide>
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
