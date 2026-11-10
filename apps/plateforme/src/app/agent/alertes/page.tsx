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
import { BellRing, CheckCheck, LoaderCircle, Megaphone, TriangleAlert, Users } from "lucide-react";
import type { GroupeSanguin, SuiviAlerte, Zone } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, URGENCE } from "@/lib/metier";
import { dateHeure } from "@/lib/format";
import { EnTetePage } from "@/components/Coquille";
import { Etape } from "@/components/Explication";
import Aide, { AvecAide } from "@/components/Aide";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import { EtatVide, SqueletteLignes } from "@/components/Etats";
import { MessageErreur, MessageReussite } from "@/components/Messages";

const CLE_SUIVIES = "dds:alertes-lancees";

/** Les trois niveaux, dans l'ordre de gravité croissante. */
const NIVEAUX_URGENCE = [
  { cle: "normale", mot: "Normale" },
  { cle: "urgente", mot: "Urgente" },
  { cle: "critique", mot: "Critique" },
] as const satisfies readonly { cle: Urgence; mot: string }[];

type Urgence = "normale" | "urgente" | "critique";

/**
 * Modèles de message.
 *
 * Un agent au guichet n'a pas le temps de rédiger : ces formules couvrent
 * les cas réels d'un centre. Le texte reste modifiable après insertion —
 * c'est un point de départ, pas un carcan. Chaque modèle fixe aussi le
 * degré d'urgence qui lui correspond : les deux vont toujours ensemble.
 */
const MODELES = [
  {
    mot: "Urgence stock général",
    urgence: "critique",
    texte: () => "Le centre manque de sang aujourd'hui. Si vous pouvez venir donner, votre don sera utilisé dans la journée.",
  },
  {
    mot: "Besoin d'un groupe précis",
    urgence: "urgente",
    // Sans groupe choisi, on n'invente pas : le message reste général.
    texte: (g: GroupeSanguin | null) => g
      ? `Nous manquons de sang de groupe ${g}. Si vous êtes ${g}, ou si vous ne connaissez pas votre groupe, venez : nous le déterminons sur place.`
      : "Nous manquons de sang. Même si vous ne connaissez pas votre groupe, venez : nous le déterminons sur place.",
  },
  {
    mot: "Relance du week-end",
    urgence: "normale",
    texte: () => "Collecte ce week-end au centre de transfusion. Une heure de votre temps peut sauver trois vies.",
  },
  {
    mot: "Avant une opération",
    urgence: "urgente",
    texte: () => "Des opérations sont programmées cette semaine et nos réserves sont basses. Votre don est attendu.",
  },
] as const satisfies readonly { mot: string; urgence: Urgence; texte: (g: GroupeSanguin | null) => string }[];

/** Texte d'un modèle, le groupe mentionné étant pris en compte. */
function texteModele(m: (typeof MODELES)[number], groupe: GroupeSanguin | null): string {
  return m.texte(groupe);
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
        titre="Appels au don"
        chapeau="Prévenir les donneurs d'une zone qu'on a besoin d'eux, et suivre qui répond."
      />

      <Composer surLancement={surLancement} />

      <section className="pile">
        <h2 className="section-titre">
          <AvecAide
            etiquette="Suivi des appels"
            aide="Seuls les appels lancés depuis ce poste sont listés. Le suivi est relu auprès du serveur toutes les trente secondes."
          >
            <span>Suivi des appels</span>
          </AvecAide>
        </h2>
        {suivies.length === 0 ? (
          <EtatVide
            Icone={BellRing}
            ton="doux"
            titre="Aucun appel lancé pour l'instant"
            texte="Vos appels et leurs réponses s'afficheront ici."
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
  // `null` = appel ouvert à tous, et c'est le cas NORMAL : le ciblage se
  // fait par zone, jamais par groupe. Le groupe ne sert qu'à rédiger le
  // message quand on sait de quoi on manque.
  const [groupe, setGroupe] = useState<GroupeSanguin | null>(null);
  const [urgence, setUrgence] = useState<"normale" | "urgente" | "critique">("urgente");
  const [objectif, setObjectif] = useState(10);
  const [dateLimite, setDateLimite] = useState("");
  const [message, setMessage] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [estimation, setEstimation] = useState<number | null>(null);
  const [estimationEnCours, setEstimationEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState<"" | "lancement">("");

  useEffect(() => {
    api.zones().then((z) => setZones(z as Zone[])).catch(() => setZones([]));
  }, []);

  /**
   * Estimation automatique à chaque changement de sélection.
   *
   * L'agent ne doit pas cliquer pour savoir combien de monde il appelle :
   * le chiffre fait partie de la décision, pas d'une vérification après
   * coup. On attend 400 ms (le temps de cocher plusieurs quartiers d'un
   * trait) et on ignore toute réponse dépassée par une sélection plus
   * récente — sinon un appel lent écraserait un résultat plus juste.
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
    setEnCours("lancement");
    try {
      const alerte = await api.lancerAlerte({
        groupeSanguin: groupe, urgence, objectifDonneurs: objectif,
        dateLimite: new Date(dateLimite).toISOString(),
        message: message.trim(), zoneIds,
      });
      surLancement(alerte.id);
      setReussite("Appel envoyé. Les donneurs des zones choisies viennent de recevoir le message.");
      setMessage(""); setZoneIds([]); setEstimation(null);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  // Au plus tôt dans une heure : laisser au donneur le temps de venir.
  const minLimite = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);

  // Ce qui manque encore, nommé à l'étape où le corriger.
  const manquants = [
    zoneIds.length === 0 && "choisir au moins un quartier (étape 1)",
    !message.trim() && "écrire le message (étape 2)",
    !dateLimite && "fixer la date limite (étape 3)",
  ].filter(Boolean) as string[];

  return (
    <form className="pile-g" onSubmit={lancer}>
      <Etape
        numero={1}
        titre="Qui voulez-vous appeler ?"
        aide="Choisissez les quartiers. Tous les donneurs qui y habitent et qui peuvent donner aujourd'hui recevront le message. Le tri ne se fait jamais par groupe sanguin."
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

          {/* Estimation : une carte qui se met à jour toute seule, pas un
              bouton à penser à cliquer. */}
          <EstimationZones
            nbZones={zoneIds.length}
            estimation={estimation}
            enCours={estimationEnCours}
          />
        </div>
      </Etape>

      <Etape
        numero={2}
        titre="Que doivent-ils lire ?"
        aide="Ce texte s'affiche tel quel sur le téléphone du donneur. Une phrase simple, dans un langage de tous les jours."
      >
        <div className="bloc pile">
          <label className="champ">
            <AvecAide
              etiquette="Message au donneur"
              aide="Le donneur reçoit ce texte sur son téléphone, sans rien autour. Écrivez une phrase courte et concrète, comme vous la diriez au guichet."
            >
              <span className="champ__etiquette">Message au donneur</span>
            </AvecAide>
            <input className="champ__saisie" value={message} required maxLength={200}
                   placeholder="Le centre de Ouagadougou manque de sang. Votre don peut sauver une vie aujourd'hui."
                   onChange={(e) => setMessage(e.target.value)} />
            {/* Compteur discret : un nombre nu ne dit pas de quoi il parle,
                mais « caractères restants » en toutes lettres sous chaque
                champ alourdit. On garde l'unité, abrégée. */}
            <span className="champ__aide chiffres">{200 - message.length} caractères restants</span>
          </label>

          {/* Modèles : l'agent au guichet n'a pas le temps de rédiger. Un
              clic remplit le message ET aligne l'urgence sur le cas. */}
          <div className="modeles">
            <span className="modeles__titre">Modèles rapides</span>
            <div className="modeles__liste">
              {MODELES.map((m) => (
                <button
                  key={m.mot}
                  type="button"
                  className={`modele${message === texteModele(m, groupe) ? " modele--actif" : ""}`}
                  onClick={() => { setMessage(texteModele(m, groupe)); setUrgence(m.urgence); }}
                >
                  {m.mot}
                </button>
              ))}
            </div>
          </div>

          <div className="grille-auto">
            <fieldset className="champ champ--nu">
              <legend className="champ__etiquette">
                <AvecAide
                  etiquette="Degré d'urgence"
                  aide="Change le ton du message et la couleur de la notification. Les destinataires restent exactement les mêmes."
                >
                  <span>Degré d&apos;urgence</span>
                </AvecAide>
              </legend>
              <div className="urgences">
                {NIVEAUX_URGENCE.map((n) => (
                  <label key={n.cle} className={`urgence urgence--${n.cle}${urgence === n.cle ? " urgence--choisie" : ""}`}>
                    <input
                      type="radio"
                      name="urgence"
                      value={n.cle}
                      checked={urgence === n.cle}
                      onChange={() => setUrgence(n.cle)}
                    />
                    <span className="urgence__point" aria-hidden="true" />
                    <span>{n.mot}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Le groupe est FACULTATIF et ne filtre personne : il sert
                uniquement à préciser le message. La plupart des donneurs
                ignorent leur groupe — c'est le laboratoire qui le
                déterminera après le prélèvement. */}
            <label className="champ">
              <AvecAide
                etiquette="Groupe à mentionner"
                aide="Ce choix n'exclut personne. Tous les donneurs des zones cochées sont appelés, y compris ceux qui ignorent leur groupe, car le laboratoire le détermine après le prélèvement."
              >
                <span className="champ__etiquette">Groupe à mentionner</span>
              </AvecAide>
              <select className="champ__saisie" value={groupe ?? ""}
                      onChange={(e) => setGroupe((e.target.value || null) as GroupeSanguin | null)}>
                <option value="">Ne pas préciser, appeler tout le monde</option>
                {LES_GROUPES.map((g) => <option key={g} value={g}>Nous manquons de {g}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Etape>

      <Etape
        numero={3}
        titre="Jusqu'à quand, et combien ?"
        aide="L'appel se referme de lui-même une fois la date limite passée. Le nombre souhaité sert uniquement à savoir quand l'objectif est atteint."
      >
        <div className="bloc pile">
          <div className="grille-auto">
            <label className="champ">
              <AvecAide
                etiquette="Nombre de donneurs souhaité"
                aide="Sert de repère pour la jauge de suivi. L'appel n'est pas bloqué si le nombre est dépassé."
              >
                <span className="champ__etiquette">Nombre de donneurs souhaité</span>
              </AvecAide>
              <input className="champ__saisie chiffres" type="number" min={1} max={500} value={objectif}
                     onChange={(e) => setObjectif(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="champ">
              <AvecAide
                etiquette="Réponses attendues avant le"
                aide="Date et heure de fermeture de l'appel. Au plus tôt dans une heure, pour laisser au donneur le temps de se déplacer."
              >
                <span className="champ__etiquette">Réponses attendues avant le</span>
              </AvecAide>
              <input className="champ__saisie" type="datetime-local" required min={minLimite}
                     value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
            </label>
          </div>

          <MessageErreur>{erreur}</MessageErreur>
          <MessageReussite>{reussite}</MessageReussite>

          {/* Ce qui manque est dit AVANT le bouton, pas après : on ne
              laisse pas l'agent cliquer sur un bouton mort en cherchant
              pourquoi. */}
          {manquants.length > 0 && (
            <p className="avertissement" role="status">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>
                Pour envoyer : {manquants.join(", ")}.
              </span>
            </p>
          )}

          <div className="envoi">
            <Bouton type="submit" className="envoi__bouton"
                    icone={<Megaphone size={18} aria-hidden="true" />}
                    enCours={enCours === "lancement"} motEnCours="Envoi en cours…"
                    disabled={manquants.length > 0}>
              Envoyer l&apos;appel aux donneurs
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
 * Le chiffre est une décision, pas une statistique : il dit à l'agent si
 * sa sélection de quartiers suffit à remplir son objectif. Zéro n'est pas
 * une erreur — c'est un cas métier fréquent (tous les donneurs du secteur
 * ont donné récemment), et il doit s'expliquer.
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
          ? "Les donneurs de ces quartiers ont tous donné trop récemment, ou sont en pause. Cochez d'autres zones pour élargir l'appel."
          : "Les donneurs en pause, et ceux qui ont donné trop récemment, sont déjà retirés de ce total."}
      </Aide>
    </div>
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

  // Trois situations distinctes, et « clôturée » ne les résume pas :
  // un appel peut être fermé parce qu'il a réussi, ou parce que l'heure
  // est passée sans que l'objectif soit atteint. L'agent doit voir
  // laquelle d'un coup d'œil.
  const expire = new Date(alerte.dateLimite).getTime() < Date.now();
  const statut = part >= 100
    ? { mot: "Objectif atteint", ton: "seve" as const }
    : alerte.statut !== "ouverte"
      ? { mot: "Clôturé", ton: "neutre" as const }
      : expire
        ? { mot: "Expiré", ton: "ocre" as const }
        : { mot: "En cours", ton: "primaire" as const };

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
          <Pilule ton={statut.ton}>{statut.mot}</Pilule>
        </div>
      </div>

      <div className="pile-s">
        <div className="rang-espace">
          <span className="appui">
            <span className="fort chiffres">{venus}</span> / {alerte.objectifDonneurs} donneurs annoncés
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
        <p className="appui">Aucune réponse pour l&apos;instant.</p>
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
            Clôturer l&apos;appel
          </Bouton>
          <Aide etiquette="Clôturer l'appel">
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
