"use client";
/**
 * Laboratoire — qualification biologique du don.
 *
 * L'écran suit la chaîne réelle, dans l'ordre où le travail se fait :
 *
 *   1. Réception   les tubes sont-ils exploitables ?
 *   2. Groupage    ABO/RhD en DOUBLE détermination, + recherche d'agglutinines
 *   3. Sérologie   VIH, hépatites B et C, syphilis (+ HTLV, paludisme)
 *   4. Libération  verdict calculé, que le technicien confirme
 *
 * Principe de l'écran : une file à la fois, une poche ouverte à la fois.
 * Le technicien travaille sur un dossier, pas sur une liste de formulaires
 * tous déployés en même temps.
 */
import { useState } from "react";
import {
  CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleSlash,
  FlaskConical, PackageCheck, TestTubes, XCircle,
} from "lucide-react";
import type {
  DossierLabo, EtapeLabo, FileLabo, GroupeSanguin, MarqueurSerologie,
  MotifRefusEchantillon, Poche, Produit, ResultatSerologie,
} from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import {
  ETAPES_ORDRE, ETAPE_LABO, LES_GROUPES, MARQUEUR, MARQUEURS_ORDRE,
  MOTIFS_ORDRE, MOTIF_REFUS, RESULTAT_SEROLOGIE, TYPE_PRODUIT, dateCourte,
} from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Aide, { AvecAide } from "@/components/Aide";
import Explication from "@/components/Explication";
import { Section, VideLigne } from "@/components/Mise";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { EtatErreur, SqueletteLignes } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

/** Les quatre files, plus la préparation des produits (étape suivante). */
type Onglet = "aRecevoir" | "aGrouper" | "aTester" | "aLiberer" | "preparation";

const ONGLETS: { cle: Onglet; mot: string }[] = [
  { cle: "aRecevoir", mot: "Réception" },
  { cle: "aGrouper", mot: "Groupage" },
  { cle: "aTester", mot: "Sérologie" },
  { cle: "aLiberer", mot: "Libération" },
  { cle: "preparation", mot: "Préparation" },
];

export default function Laboratoire() {
  const file = useRessource<FileLabo>(() => api.fileLabo());
  const aPreparer = useRessource<Poche[]>(() => api.pochesAPreparer());
  const [onglet, setOnglet] = useState<Onglet>("aRecevoir");
  /** Code de la poche ouverte ; null = on voit la liste. */
  const [ouverte, setOuverte] = useState<string | null>(null);

  async function toutRecharger() {
    setOuverte(null);
    await Promise.all([file.recharger(), aPreparer.recharger()]);
  }

  const compte = (cle: Onglet): number =>
    cle === "preparation"
      ? aPreparer.donnees?.length ?? 0
      : file.donnees?.[cle].length ?? 0;

  /*
   * Un dossier ouvert est un plan de travail, pas une page de navigation.
   * Tant qu'il est ouvert on retire ce qui invite à partir ailleurs — les
   * onglets des autres files et le bandeau d'aide général — pour ne laisser
   * que le dossier et l'action du moment. Le retour à la liste reste la
   * seule sortie, visible en haut.
   */
  const dossierOuvert = ouverte !== null && onglet !== "preparation";

  return (
    <>
      <EnTetePage
        titre="Laboratoire"
        chapeau="Qualification biologique des poches prélevées."
        actions={dossierOuvert ? undefined
          : <Bouton variante="secondaire" onClick={() => void toutRecharger()}>Actualiser</Bouton>}
      />

      {!dossierOuvert && (
        <Explication
          Icone={FlaskConical}
          cle="laboratoire"
          resume="Analysez chaque poche avant qu'elle rejoigne le stock."
          role="Une poche prélevée n'est pas encore utilisable. Ici vous l'analysez : vous déterminez son groupe sanguin et vous vérifiez qu'elle ne transmet aucune maladie."
          quand="Après chaque prélèvement. Une poche attend ici tant qu'elle n'est pas analysée."
          ensuite="Si tout est conforme, la poche est libérée et rejoint le stock. Sinon elle est écartée et détruite."
        />
      )}

      {!dossierOuvert && (
        <nav className="onglets" aria-label="Étapes du laboratoire">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              className={`onglet${onglet === o.cle ? " onglet--actif" : ""}`}
              aria-current={onglet === o.cle ? "page" : undefined}
              onClick={() => { setOnglet(o.cle); setOuverte(null); }}
            >
              {o.mot}
              <span className={`section__compte${compte(o.cle) === 0 ? " section__compte--vide" : ""}`}
                    style={{ marginLeft: "var(--e2)" }}>
                {compte(o.cle)}
              </span>
            </button>
          ))}
        </nav>
      )}

      {file.chargement && !file.donnees && <SqueletteLignes lignes={3} />}
      {file.erreur && <EtatErreur texte={file.erreur} surReessai={() => void file.recharger()} />}

      {onglet === "preparation" ? (
        <Preparation ressource={aPreparer} surPreparation={() => void toutRecharger()} />
      ) : (
        file.donnees && (
          <FileEtape
            dossiers={file.donnees[onglet]}
            etape={onglet}
            ouverte={ouverte}
            surOuvrir={setOuverte}
            surAction={() => void toutRecharger()}
          />
        )
      )}
    </>
  );
}

/* =====================================================================
   Une file : la liste, ou le dossier ouvert
   ===================================================================== */

const VIDE: Record<Exclude<Onglet, "preparation">, string> = {
  aRecevoir: "Aucun échantillon à réceptionner.",
  aGrouper: "Aucune poche à grouper.",
  aTester: "Aucune sérologie en attente.",
  aLiberer: "Aucun dossier prêt à libérer.",
};

function FileEtape({ dossiers, etape, ouverte, surOuvrir, surAction }: {
  dossiers: DossierLabo[];
  etape: Exclude<Onglet, "preparation">;
  ouverte: string | null;
  surOuvrir: (code: string | null) => void;
  surAction: () => void;
}) {
  const dossier = dossiers.find((d) => d.code === ouverte);

  // Un dossier ouvert occupe tout l'écran : pas de liste derrière à relire.
  if (dossier) {
    return (
      <>
        <button className="bouton bouton--secondaire" style={{ alignSelf: "flex-start" }}
                onClick={() => surOuvrir(null)}>
          <ChevronLeft size={18} aria-hidden="true" />
          Retour à la liste
        </button>
        <Dossier dossier={dossier} surAction={surAction} />
      </>
    );
  }

  if (dossiers.length === 0) {
    return <VideLigne Icone={FlaskConical}>{VIDE[etape]}</VideLigne>;
  }

  return (
    <Section titre={`${dossiers.length} poche${dossiers.length > 1 ? "s" : ""} à traiter`}>
      {/* Liste de travail : une ligne par poche, lue en rafale. La frise
          des quatre étapes a disparu d'ici — elle répétait sur chaque
          ligne ce que les onglets disent déjà une fois en haut. */}
      <div className="worklist">
        {/* En-têtes de colonnes : sans eux, « — » et « 450 ml » sont des
            valeurs sans nom. Masqués sous 900 px, où la ligne se replie. */}
        <div className="worklist__entetes" aria-hidden="true">
          <span>Poche</span>
          <span className="worklist__groupe">Groupe</span>
          <span>Donneur</span>
          <span>Prélevée le</span>
          <span>Volume</span>
          <span />
        </div>
        <ul className="worklist__lignes">
          {dossiers.map((d) => (
            <li key={d.code}>
              <button className="worklist__ligne" onClick={() => surOuvrir(d.code)}>
                <span className="worklist__code chiffres">{d.code}</span>
                <span className="worklist__groupe">
                  {d.groupage
                    ? <BlocGroupe groupe={d.groupage.determination1} taille="s" />
                    : <span className="worklist__attente" title="Groupe déterminé à l'étape Groupage">à définir</span>}
                </span>
                <span className="worklist__donneur chiffres">{d.numeroDonneur ?? "—"}</span>
                <span className="worklist__date">{dateCourte(d.datePrelevement)}</span>
                <span className="worklist__volume chiffres">{d.volume ? `${d.volume} ml` : "—"}</span>
                <span className="worklist__action">
                  <span className="worklist__verbe">{ETAPE_LABO[d.etape].verbe}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** Frise des quatre étapes : où en est cette poche. */
function Frise({ etape }: { etape: EtapeLabo }) {
  const position = ETAPES_ORDRE.indexOf(etape);
  return (
    <ol className="frise" aria-label="Avancement de la qualification">
      {ETAPES_ORDRE.map((e, i) => {
        const faite = etape === "terminee" || (position >= 0 && i < position);
        const active = e === etape;
        return (
          <li key={e} className={`frise__etape${faite ? " frise__etape--faite" : active ? " frise__etape--active" : ""}`}
              aria-current={active ? "step" : undefined}>
            <span className="frise__num">{faite ? "✓" : i + 1}</span>
            {ETAPE_LABO[e].mot}
          </li>
        );
      })}
    </ol>
  );
}

/* =====================================================================
   Le dossier d'une poche : son histoire, puis l'action du moment
   ===================================================================== */

function Dossier({ dossier, surAction }: { dossier: DossierLabo; surAction: () => void }) {
  const [etat, setEtat] = useState<DossierLabo>(dossier);
  const [reussite, setReussite] = useState("");

  function avancer(maj: DossierLabo, message: string) {
    setEtat(maj);
    setReussite(message);
  }

  return (
    <div className="pile">
      <div className="travail">
        <div className="travail__entete">
          <span className="travail__code">{etat.code}</span>
          {etat.groupage && <BlocGroupe groupe={etat.groupage.determination1} taille="m" />}
          <span className="travail__meta">
            <span className="petit">Donneur {etat.numeroDonneur ?? "—"}</span>
            <span className="petit">Prélevée le {dateCourte(etat.datePrelevement)}</span>
            {etat.volume && <span className="petit">{etat.volume} ml</span>}
          </span>
        </div>
        <Frise etape={etat.etape} />
      </div>

      <MessageReussite>{reussite}</MessageReussite>

      {/* Ce qui est déjà fait, en lecture seule et compact. */}
      {etat.reception && <ResumeReception dossier={etat} />}
      {etat.groupage && <ResumeGroupage dossier={etat} />}
      {etat.serologies.length > 0 && <ResumeSerologies dossier={etat} />}

      {/* L'action du moment, une seule. */}
      {etat.etape === "reception" && (
        <FormulaireReception code={etat.code} surFait={(d) => avancer(d, "Échantillon enregistré.")} />
      )}
      {etat.etape === "groupage" && (
        <FormulaireGroupage code={etat.code} surFait={(d) => avancer(d, "Groupage validé.")} />
      )}
      {etat.etape === "serologie" && (
        <FormulaireSerologie dossier={etat} surFait={(d) => avancer(d, "Résultats enregistrés.")} />
      )}
      {etat.etape === "liberation" && (
        <Liberation dossier={etat} surFait={(d) => { avancer(d, "Dossier libéré."); surAction(); }} />
      )}
      {etat.etape === "terminee" && (
        <Encadre ton={etat.statut === "conforme" ? "seve" : "sang"}>
          Dossier clos : poche {etat.statut === "conforme" ? "conforme, disponible pour la préparation" : "non conforme, écartée"}.
        </Encadre>
      )}
    </div>
  );
}

/* --- Résumés en lecture seule ---------------------------------------- */

function ResumeReception({ dossier }: { dossier: DossierLabo }) {
  const r = dossier.reception!;
  return (
    <div className="travail">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <span className="fort">1. Réception de l'échantillon</span>
        <Pilule ton={r.conforme ? "seve" : "sang"}>{r.conforme ? "Conforme" : "Refusé"}</Pilule>
      </div>
      <span className="petit">
        {r.conforme
          ? `Tubes contrôlés par ${r.technicien}.`
          : `${MOTIF_REFUS[r.motif as MotifRefusEchantillon] ?? r.motif} — ${r.technicien}.`}
        {r.precisions ? ` ${r.precisions}` : ""}
      </span>
    </div>
  );
}

function ResumeGroupage({ dossier }: { dossier: DossierLabo }) {
  const g = dossier.groupage!;
  return (
    <div className="travail">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <span className="fort">2. Groupage ABO / RhD</span>
        <div className="rang">
          <BlocGroupe groupe={g.determination1} taille="s" />
          {g.raiPositive && <Pilule ton="ocre">RAI positive</Pilule>}
        </div>
      </div>
      <span className="petit">
        Deux déterminations concordantes ({g.determination1} et {g.determination2}), par {g.technicien}.
        {g.phenotype ? ` Phénotype : ${g.phenotype}.` : ""}
      </span>
      {g.raiPositive && (
        <Encadre ton="ocre">
          Agglutinines irrégulières détectées : ce sang demande un contrôle de
          compatibilité renforcé avant toute transfusion.
        </Encadre>
      )}
    </div>
  );
}

function ResumeSerologies({ dossier }: { dossier: DossierLabo }) {
  return (
    <div className="travail">
      <span className="fort">3. Sérologie</span>
      <div className="rang" style={{ flexWrap: "wrap", gap: "var(--e2)" }}>
        {dossier.serologies.map((s) => (
          <Pilule key={s.marqueur} ton={RESULTAT_SEROLOGIE[s.resultat].ton}>
            {MARQUEUR[s.marqueur].mot} · {RESULTAT_SEROLOGIE[s.resultat].mot}
          </Pilule>
        ))}
        {dossier.marqueursManquants.map((m) => (
          <Pilule key={m} ton="neutre">{MARQUEUR[m].mot} · à faire</Pilule>
        ))}
      </div>
    </div>
  );
}

/* --- 1. Réception ----------------------------------------------------- */

function FormulaireReception({ code, surFait }: { code: string; surFait: (d: DossierLabo) => void }) {
  const [conforme, setConforme] = useState(true);
  const [motif, setMotif] = useState<MotifRefusEchantillon>("tubes_absents");
  const [precisions, setPrecisions] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setEnCours(true);
    try {
      surFait(await api.receptionLabo(code, {
        conforme,
        motif: conforme ? null : motif,
        precisions: precisions.trim(),
      }));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="travail" onSubmit={envoyer}>
      <div className="pile-s">
        <span className="titre-s">1. Contrôler l'échantillon</span>
        <span className="appui">{ETAPE_LABO.reception.aide}</span>
      </div>

      <div className="rang" style={{ flexWrap: "wrap" }}>
        <label className="case">
          <input type="radio" name="conformite" checked={conforme} onChange={() => setConforme(true)} />
          <span>Tubes conformes</span>
        </label>
        <label className="case">
          <input type="radio" name="conformite" checked={!conforme} onChange={() => setConforme(false)} />
          <span>Échantillon à refuser</span>
        </label>
      </div>

      {!conforme && (
        <>
          <label className="champ">
            <span className="champ__etiquette">Motif du refus</span>
            <select className="champ__saisie" value={motif}
                    onChange={(e) => setMotif(e.target.value as MotifRefusEchantillon)}>
              {MOTIFS_ORDRE.map((m) => <option key={m} value={m}>{MOTIF_REFUS[m]}</option>)}
            </select>
          </label>
          <Encadre ton="sang">
            Un échantillon refusé arrête la qualification : la poche sera écartée
            à la libération, sans être transfusée.
          </Encadre>
        </>
      )}

      <label className="champ">
        <span className="champ__etiquette">Précisions (facultatif)</span>
        <input className="champ__saisie" value={precisions} maxLength={200}
               onChange={(e) => setPrecisions(e.target.value)} />
      </label>

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton type="submit" variante={conforme ? "principal" : "danger"}
              enCours={enCours} motEnCours="Enregistrement…">
        {conforme ? "Accepter l'échantillon" : "Refuser l'échantillon"}
      </Bouton>
    </form>
  );
}

/* --- 2. Groupage ------------------------------------------------------ */

function FormulaireGroupage({ code, surFait }: { code: string; surFait: (d: DossierLabo) => void }) {
  const [d1, setD1] = useState<"" | GroupeSanguin>("");
  const [d2, setD2] = useState<"" | GroupeSanguin>("");
  const [rai, setRai] = useState(false);
  const [phenotype, setPhenotype] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  // La discordance se voit AVANT d'envoyer : le technicien refait la lecture
  // au lieu de recevoir un refus du serveur.
  const discordant = d1 !== "" && d2 !== "" && d1 !== d2;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!d1 || !d2) { setErreur("Saisissez les deux déterminations."); return; }
    setErreur(""); setEnCours(true);
    try {
      surFait(await api.groupage(code, {
        determination1: d1, determination2: d2,
        raiPositive: rai, phenotype: phenotype.trim(),
      }));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="travail" onSubmit={envoyer}>
      <div className="pile-s">
        <span className="titre-s">2. Groupage ABO / RhD</span>
        <span className="appui">{ETAPE_LABO.groupage.aide}</span>
      </div>

      <div className="grille-2">
        <label className="champ">
          <AvecAide etiquette="Première détermination"
                    aide="Épreuve globulaire, dite Beth-Vincent. Elle recherche les antigènes portés par les globules rouges du donneur.">
            <span className="champ__etiquette">1<sup>re</sup> détermination</span>
          </AvecAide>
          <select className="champ__saisie" value={d1}
                  onChange={(e) => { setD1(e.target.value as GroupeSanguin); setErreur(""); }}>
            <option value="">Choisir…</option>
            {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="champ">
          <AvecAide etiquette="Deuxième détermination"
                    aide="Épreuve plasmatique, dite Simonin. C'est une lecture indépendante de la première, obligatoire avant toute transfusion.">
            <span className="champ__etiquette">2<sup>e</sup> détermination</span>
          </AvecAide>
          <select className="champ__saisie" value={d2}
                  onChange={(e) => { setD2(e.target.value as GroupeSanguin); setErreur(""); }}>
            <option value="">Choisir…</option>
            {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>

      {discordant && (
        <Encadre ton="sang" icone={<CircleAlert size={18} aria-hidden="true" />}>
          Les deux déterminations ne concordent pas ({d1} et {d2}). Refaites la
          lecture : un groupe ne peut pas être validé sur une discordance.
        </Encadre>
      )}

      <label className="case" style={{ alignSelf: "flex-start" }}>
        <input type="checkbox" checked={rai} onChange={(e) => setRai(e.target.checked)} />
        <span>Recherche d'agglutinines irrégulières positive</span>
      </label>

      <label className="champ">
        <span className="champ__etiquette">Phénotype érythrocytaire (facultatif)</span>
        <input className="champ__saisie chiffres" value={phenotype} maxLength={100}
               placeholder="RH:1,2,-3,4,5 K:-1"
               onChange={(e) => setPhenotype(e.target.value)} />
      </label>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="rang">
        <Bouton type="submit" enCours={enCours} motEnCours="Enregistrement…"
                disabled={!d1 || !d2 || discordant}>
          Valider le groupage
        </Bouton>
        <Aide etiquette="Valider le groupage">
          Les deux déterminations doivent concorder. En cas de discordance, refaites la lecture au laboratoire, l&apos;enregistrement reste bloqué.
        </Aide>
      </div>
    </form>
  );
}

/* --- 3. Sérologie ----------------------------------------------------- */

const CHOIX: { valeur: ResultatSerologie; mot: string; titre: string; ton: string }[] = [
  { valeur: "negatif", mot: "Négatif", titre: "Résultat négatif", ton: "seve" },
  { valeur: "positif", mot: "Positif", titre: "Résultat positif", ton: "sang" },
  // « Ininterprétable » est trop long pour un bouton : le sens utile pour
  // le technicien est l'action qui en découle, refaire le test.
  { valeur: "ininterpretable", mot: "Refaire", titre: "Ininterprétable, test à refaire", ton: "ocre" },
];

function FormulaireSerologie({ dossier, surFait }: {
  dossier: DossierLabo;
  surFait: (d: DossierLabo) => void;
}) {
  const [saisis, setSaisis] = useState<Partial<Record<MarqueurSerologie, ResultatSerologie>>>({});
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const dejaFaits = new Set(dossier.serologies.map((s) => s.marqueur));
  const aSaisir = MARQUEURS_ORDRE.filter((m) => !dejaFaits.has(m) || saisis[m]);
  const nbSaisis = Object.keys(saisis).length;
  const unPositif = Object.values(saisis).includes("positif");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (nbSaisis === 0) { setErreur("Saisissez au moins un résultat."); return; }
    setErreur(""); setEnCours(true);
    try {
      surFait(await api.serologie(dossier.code, {
        resultats: Object.entries(saisis).map(([marqueur, resultat]) => ({
          marqueur: marqueur as MarqueurSerologie,
          resultat: resultat as ResultatSerologie,
        })),
      }));
      setSaisis({});
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="travail" onSubmit={envoyer}>
      <div className="pile-s">
        <span className="titre-s">3. Qualification biologique</span>
        <span className="appui">{ETAPE_LABO.serologie.aide}</span>
      </div>

      <div className="marqueurs">
        {aSaisir.map((m) => (
          <div key={m} className="marqueur">
            <span className="marqueur__nom">
              <span className="fort">
                {MARQUEUR[m].mot}
                {MARQUEUR[m].obligatoire && <span className="petit" style={{ color: "var(--sang)" }}> *</span>}
              </span>
              <span className="petit">{MARQUEUR[m].nomLong}</span>
            </span>
            <span className="marqueur__choix">
              {CHOIX.map((c) => (
                <label key={c.valeur} className={`choix choix--${c.ton}`} title={c.titre}>
                  <input
                    type="radio"
                    name={`marqueur-${m}`}
                    checked={saisis[m] === c.valeur}
                    onChange={() => { setSaisis((s) => ({ ...s, [m]: c.valeur })); setErreur(""); }}
                    aria-label={`${MARQUEUR[m].mot} : ${c.titre}`}
                  />
                  {c.mot}
                </label>
              ))}
            </span>
          </div>
        ))}
      </div>

      <span className="petit">* Marqueur obligatoire avant toute libération.</span>

      {unPositif && (
        <Encadre ton="sang" icone={<CircleAlert size={18} aria-hidden="true" />}>
          Un résultat positif rend la poche non conforme et déclenche un suivi
          médical du donneur. Le résultat ne lui est jamais transmis par
          l'application : c'est un médecin qui le recontacte.
        </Encadre>
      )}

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton type="submit" enCours={enCours} motEnCours="Enregistrement…" disabled={nbSaisis === 0}
              icone={<TestTubes size={18} aria-hidden="true" />}>
        Enregistrer {nbSaisis > 0 ? `${nbSaisis} résultat${nbSaisis > 1 ? "s" : ""}` : "les résultats"}
      </Bouton>
    </form>
  );
}

/* --- 4. Libération ---------------------------------------------------- */

function Liberation({ dossier, surFait }: { dossier: DossierLabo; surFait: (d: DossierLabo) => void }) {
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const conforme = dossier.verdictPossible === "conforme";
  const positifs = dossier.serologies.filter((s) => s.resultat === "positif");
  const refuse = dossier.reception && !dossier.reception.conforme;

  async function liberer() {
    setErreur(""); setEnCours(true);
    try {
      surFait(await api.libererPoche(dossier.code));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="pile">
      <div className={`verdict verdict--${dossier.verdictPossible}`}>
        <span className="verdict__icone">
          {conforme
            ? <CircleCheck size={28} aria-hidden="true" />
            : dossier.verdictPossible === "non_conforme"
              ? <XCircle size={28} aria-hidden="true" />
              : <CircleSlash size={28} aria-hidden="true" />}
        </span>
        <div className="pile-s">
          <span className="verdict__titre">
            {conforme ? "Poche conforme" : dossier.verdictPossible === "non_conforme" ? "Poche non conforme" : "Dossier incomplet"}
          </span>
          <span className="appui">
            {conforme && "Tous les examens obligatoires sont négatifs et le groupage est validé. La poche pourra être transformée en produits."}
            {refuse && "L'échantillon a été refusé à la réception : la qualification ne peut pas aboutir."}
            {!refuse && positifs.length > 0 && (
              <>Résultat positif : {positifs.map((p) => MARQUEUR[p.marqueur].mot).join(", ")}. La poche sera écartée et le donneur suivi par un médecin.</>
            )}
            {dossier.verdictPossible === "incomplet" && `Il manque : ${dossier.marqueursManquants.map((m) => MARQUEUR[m].mot).join(", ")}.`}
          </span>
        </div>
      </div>

      <MessageErreur>{erreur}</MessageErreur>

      {dossier.verdictPossible !== "incomplet" && (
        <div className="travail">
          <span className="appui">
            Le verdict est calculé à partir des examens enregistrés : vous le
            confirmez, vous ne le saisissez pas. Cette action est définitive.
          </span>
          <Bouton
            variante={conforme ? "principal" : "danger"}
            enCours={enCours}
            motEnCours="Libération…"
            icone={<CheckCircle2 size={18} aria-hidden="true" />}
            onClick={() => void liberer()}
          >
            {conforme ? "Libérer la poche" : "Écarter la poche"}
          </Bouton>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   P5 — Préparation des produits (après libération)
   ===================================================================== */

const TYPES = ["GR", "PL", "PQ"] as const;

function Preparation({ ressource, surPreparation }: {
  ressource: ReturnType<typeof useRessource<Poche[]>>;
  surPreparation: () => void;
}) {
  if (ressource.chargement && !ressource.donnees) return <SqueletteLignes lignes={2} />;
  if (ressource.erreur) return <EtatErreur texte={ressource.erreur} surReessai={() => void ressource.recharger()} />;
  if (!ressource.donnees?.length) {
    return (
      <VideLigne Icone={PackageCheck}>
        Aucune poche à préparer. Seules les poches libérées conformes arrivent ici.
      </VideLigne>
    );
  }

  return (
    <Section titre={`${ressource.donnees.length} poche${ressource.donnees.length > 1 ? "s" : ""} conforme${ressource.donnees.length > 1 ? "s" : ""}`}>
      <div className="pile-s">
        {ressource.donnees.map((p) => (
          <CartePreparation key={p.id} poche={p} surPreparation={surPreparation} />
        ))}
      </div>
    </Section>
  );
}

function CartePreparation({ poche, surPreparation }: { poche: Poche; surPreparation: () => void }) {
  const [choisis, setChoisis] = useState<("GR" | "PL" | "PQ")[]>(["GR", "PL"]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [produits, setProduits] = useState<Produit[] | null>(null);

  async function preparer() {
    if (choisis.length === 0) { setErreur("Choisissez au moins un produit."); return; }
    setErreur(""); setEnCours(true);
    try {
      setProduits(await api.preparer(poche.code, { produits: TYPES.filter((t) => choisis.includes(t)) }));
      surPreparation();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  if (produits) {
    return (
      <div className="travail">
        <MessageReussite>
          {produits.length} produit{produits.length > 1 ? "s" : ""} créé{produits.length > 1 ? "s" : ""} :{" "}
          {produits.map((p) => p.code).join(", ")}.
        </MessageReussite>
      </div>
    );
  }

  return (
    <div className="travail">
      <div className="travail__entete">
        <span className="travail__code">{poche.code}</span>
        <span className="travail__meta">
          <span className="petit">Prélevée le {dateCourte(poche.date)}</span>
          <Pilule ton="seve">Conforme</Pilule>
        </span>
      </div>

      <div className="rang" style={{ flexWrap: "wrap" }}>
        {TYPES.map((t) => (
          <label key={t} className="case" style={{ height: "auto", paddingTop: 6, paddingBottom: 6 }}>
            <input
              type="checkbox"
              checked={choisis.includes(t)}
              onChange={() => setChoisis((l) => l.includes(t) ? l.filter((x) => x !== t) : [...l, t])}
            />
            <span className="pile-s" style={{ gap: 0, alignItems: "flex-start" }}>
              <span>{TYPE_PRODUIT[t].mot}</span>
              <span className="petit">{TYPE_PRODUIT[t].detail}</span>
            </span>
          </label>
        ))}
      </div>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="rang">
        <Bouton enCours={enCours} motEnCours="Préparation…" onClick={() => void preparer()}
                icone={<PackageCheck size={18} aria-hidden="true" />}>
          Créer les produits
        </Bouton>
        <Aide etiquette="Créer les produits">
          Sépare la poche en produits transfusables, chacun avec son propre code et sa propre date de péremption. La poche d&apos;origine reste traçable.
        </Aide>
      </div>
    </div>
  );
}
