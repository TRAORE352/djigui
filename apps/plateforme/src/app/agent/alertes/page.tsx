"use client";
/**
 * P7 — Alertes aux donneurs.
 *
 * Deux temps : composer l'appel (groupe, urgence, zones, échéance) puis
 * suivre les réponses en direct et clôturer quand l'objectif est atteint.
 *
 * Le backend n'expose pas de liste des alertes du site : on garde donc sur
 * le poste les identifiants des alertes lancées ici, pour pouvoir y revenir
 * après un rechargement. C'est un confort local, pas une source de vérité —
 * chaque suivi est toujours relu auprès du serveur.
 */
import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCheck, Megaphone, Users } from "lucide-react";
import type { GroupeSanguin, SuiviAlerte, Zone } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, URGENCE } from "@/lib/metier";
import { dateHeure } from "@/lib/format";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import { EtatVide, SqueletteLignes } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

const CLE_SUIVIES = "dds:alertes-lancees";

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

export default function Alertes() {
  const [suivies, setSuivies] = useState<string[]>([]);
  useEffect(() => { setSuivies(lireSuivies()); }, []);

  function surLancement(id: string) {
    memoriser(id);
    setSuivies(lireSuivies());
  }

  return (
    <>
      <EnTetePage
        titre="Alertes aux donneurs"
        chapeau="Un appel part vers les donneurs éligibles des zones choisies. Ils répondent depuis leur application ; leurs réponses arrivent ici."
      />

      <Composer surLancement={surLancement} />

      <section className="pile">
        <h2 className="section-titre">Suivi des alertes lancées depuis ce poste</h2>
        {suivies.length === 0 ? (
          <EtatVide
            Icone={BellRing}
            titre="Aucune alerte suivie"
            texte="Les alertes que vous lancez ici apparaissent en dessous, avec le détail des réponses des donneurs."
          />
        ) : (
          suivies.map((id) => <Suivi key={id} id={id} />)
        )}
      </section>
    </>
  );
}

/* =====================================================================
   Composer l'appel
   ===================================================================== */

function Composer({ surLancement }: { surLancement: (id: string) => void }) {
  const [groupe, setGroupe] = useState<GroupeSanguin>("O+");
  const [urgence, setUrgence] = useState<"normale" | "urgente" | "critique">("urgente");
  const [objectif, setObjectif] = useState(10);
  const [dateLimite, setDateLimite] = useState("");
  const [message, setMessage] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [estimation, setEstimation] = useState<number | null>(null);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState<"" | "estimation" | "lancement">("");

  useEffect(() => {
    api.zones().then((z) => setZones(z as Zone[])).catch(() => setZones([]));
  }, []);

  // L'estimation ne vaut que pour la sélection qui l'a produite.
  function basculerZone(id: string) {
    setZoneIds((liste) => liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
    setEstimation(null);
    setErreur("");
  }

  async function estimer() {
    if (zoneIds.length === 0) { setErreur("Choisissez au moins une zone."); return; }
    setErreur(""); setEnCours("estimation");
    try {
      setEstimation((await api.estimationAlerte(zoneIds)).donneursCibles);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite("");
    if (zoneIds.length === 0) { setErreur("Choisissez au moins une zone."); return; }
    setEnCours("lancement");
    try {
      const alerte = await api.lancerAlerte({
        groupeSanguin: groupe, urgence, objectifDonneurs: objectif,
        dateLimite: new Date(dateLimite).toISOString(),
        message: message.trim(), zoneIds,
      });
      surLancement(alerte.id);
      setReussite("Alerte lancée. Les donneurs éligibles des zones choisies sont prévenus.");
      setMessage(""); setZoneIds([]); setEstimation(null);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  // Au plus tôt dans une heure : laisser au donneur le temps de venir.
  const minLimite = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);

  return (
    <form className="bloc pile" onSubmit={lancer}>
      <h2 className="titre-s">Composer un appel au don</h2>

      <div className="grille-3">
        <label className="champ">
          <span className="champ__etiquette">Groupe recherché</span>
          <select className="champ__saisie" value={groupe}
                  onChange={(e) => setGroupe(e.target.value as GroupeSanguin)}>
            {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
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
          <span className="champ__aide">Détermine le ton du message reçu par le donneur.</span>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Objectif de donneurs</span>
          <input className="champ__saisie chiffres" type="number" min={1} max={500} value={objectif}
                 onChange={(e) => setObjectif(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Réponses attendues avant le</span>
          <input className="champ__saisie" type="datetime-local" required min={minLimite}
                 value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
        </label>
      </div>

      <label className="champ">
        <span className="champ__etiquette">Message au donneur</span>
        <input className="champ__saisie" value={message} required maxLength={200}
               placeholder="Le stock O+ est critique au CNTS de Ouagadougou. Votre don peut sauver une vie aujourd'hui."
               onChange={(e) => setMessage(e.target.value)} />
        <span className="champ__aide">
          Une phrase claire, sans jargon. {200 - message.length} caractères restants.
        </span>
      </label>

      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="champ__etiquette">Zones ciblées</legend>
        {zones.length === 0 ? (
          <p className="champ__aide">Chargement des zones…</p>
        ) : (
          <div className="rang" style={{ flexWrap: "wrap", marginTop: "var(--e2)" }}>
            {zones.map((z) => (
              <label key={z.id} className="case">
                <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => basculerZone(z.id)} />
                <span>{z.nom}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {estimation !== null && (
        <Encadre ton={estimation === 0 ? "ocre" : "seve"}>
          {estimation === 0
            ? "Aucun donneur éligible dans ces zones pour l'instant : élargissez la sélection avant de lancer l'appel."
            : `${estimation} donneur${estimation > 1 ? "s" : ""} seront prévenus. Les donneurs en pause ou non encore rééligibles ne sont pas comptés.`}
        </Encadre>
      )}

      <div className="rang" style={{ flexWrap: "wrap" }}>
        <Bouton variante="secondaire" icone={<Users size={18} aria-hidden="true" />}
                enCours={enCours === "estimation"} onClick={() => void estimer()}>
          Estimer la portée
        </Bouton>
        <Bouton type="submit" icone={<Megaphone size={18} aria-hidden="true" />}
                enCours={enCours === "lancement"} motEnCours="Envoi…"
                disabled={!dateLimite || !message.trim() || zoneIds.length === 0}>
          Lancer l'alerte
        </Bouton>
      </div>
    </form>
  );
}

/* =====================================================================
   Suivi d'une alerte
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
  // tant que l'alerte est ouverte, et on s'arrête dès qu'elle est clôturée.
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

  const venus = alerte.compteurs.jeViens;
  const part = alerte.objectifDonneurs > 0
    ? Math.min(100, Math.round((venus / alerte.objectifDonneurs) * 100))
    : 0;
  const tonJauge = part >= 100 ? "" : part >= 50 ? " jauge__part--ocre" : " jauge__part--sang";

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="rang">
          <BlocGroupe groupe={alerte.groupeSanguin} taille="m" />
          <div className="pile-s" style={{ gap: 0 }}>
            <span className="fort">{alerte.message}</span>
            <span className="petit">Réponses attendues avant le {dateHeure(alerte.dateLimite)}</span>
          </div>
        </div>
        <div className="rang" style={{ flexWrap: "wrap" }}>
          <Pilule ton={URGENCE[alerte.urgence].ton}>{URGENCE[alerte.urgence].mot}</Pilule>
          <Pilule ton={alerte.statut === "ouverte" ? "primaire" : "neutre"}>
            {alerte.statut === "ouverte" ? "Ouverte" : "Clôturée"}
          </Pilule>
        </div>
      </div>

      <div className="pile-s">
        <div className="rang-espace">
          <span className="appui">
            <span className="fort chiffres">{venus}</span> sur {alerte.objectifDonneurs} donneurs annoncés
          </span>
          <span className="petit chiffres">{part} %</span>
        </div>
        <div className="jauge" role="img" aria-label={`${venus} donneurs annoncés sur un objectif de ${alerte.objectifDonneurs}`}>
          <div className={`jauge__part${tonJauge}`} style={{ width: `${part}%` }} />
        </div>
      </div>

      <div className="grille-3">
        <Compteur libelle="Je viens" valeur={alerte.compteurs.jeViens} ton="seve" />
        <Compteur libelle="Pas disponible" valeur={alerte.compteurs.pasDisponible} ton="neutre" />
        <Compteur libelle="Besoin de transport" valeur={alerte.compteurs.besoinTransport} ton="ocre" />
      </div>

      {alerte.donneurs.length === 0 ? (
        <p className="appui">Aucune réponse pour l'instant. Les réponses apparaissent ici au fur et à mesure.</p>
      ) : (
        <Tableau
          legende="Réponses des donneurs à cette alerte"
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
            Clôturer l'alerte
          </Bouton>
          <span className="petit">Clôturer arrête les relances ; les donneurs déjà venus restent enregistrés.</span>
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
