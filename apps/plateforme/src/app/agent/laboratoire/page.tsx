"use client";
/**
 * P4 / P5 — Laboratoire.
 *
 * Deux files d'attente, dans l'ordre du parcours :
 *   · à qualifier   : poches prélevées → groupe sanguin + conforme/non conforme ;
 *   · à préparer    : poches conformes → produits (globules, plasma, plaquettes).
 *
 * Chaque poche porte son propre formulaire : deux techniciens travaillant
 * sur deux poches différentes ne se marchent pas dessus (le défaut de
 * l'ancien écran, où un seul groupe sanguin servait pour toute la liste).
 */
import { useState } from "react";
import { FlaskConical, PackageCheck, Droplets } from "lucide-react";
import type { GroupeSanguin, Poche, Produit } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { LES_GROUPES, TYPE_PRODUIT, dateCourte } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

type Etape = "qualifier" | "preparer";

export default function Laboratoire() {
  const [etape, setEtape] = useState<Etape>("qualifier");
  const aQualifier = useRessource<Poche[]>(() => api.pochesAanalyser());
  const aPreparer = useRessource<Poche[]>(() => api.pochesAPreparer());

  const liste = etape === "qualifier" ? aQualifier : aPreparer;

  // Qualifier une poche la fait passer dans l'autre file : les deux listes
  // se rechargent ensemble pour que les compteurs restent justes.
  async function rechargerTout() {
    await Promise.all([aQualifier.recharger(), aPreparer.recharger()]);
  }

  return (
    <>
      <EnTetePage
        titre="Laboratoire"
        chapeau="Qualifiez les poches prélevées, puis préparez les produits sanguins à partir des poches conformes."
        actions={<Bouton variante="secondaire" onClick={() => void rechargerTout()}>Actualiser</Bouton>}
      />

      <nav className="onglets" aria-label="Files d'attente du laboratoire">
        <button
          className={`onglet${etape === "qualifier" ? " onglet--actif" : ""}`}
          aria-current={etape === "qualifier" ? "page" : undefined}
          onClick={() => setEtape("qualifier")}
        >
          À qualifier{aQualifier.donnees ? ` (${aQualifier.donnees.length})` : ""}
        </button>
        <button
          className={`onglet${etape === "preparer" ? " onglet--actif" : ""}`}
          aria-current={etape === "preparer" ? "page" : undefined}
          onClick={() => setEtape("preparer")}
        >
          À préparer{aPreparer.donnees ? ` (${aPreparer.donnees.length})` : ""}
        </button>
      </nav>

      {liste.chargement && <SqueletteLignes lignes={3} />}
      {liste.erreur && <EtatErreur texte={liste.erreur} surReessai={() => void liste.recharger()} />}

      {liste.donnees?.length === 0 && (
        etape === "qualifier"
          ? <EtatVide
              Icone={FlaskConical}
              titre="Aucune poche à qualifier"
              texte="Les poches apparaissent ici dès que l'accueil les a créées après un prélèvement."
            />
          : <EtatVide
              Icone={PackageCheck}
              titre="Aucune poche à préparer"
              texte="Seules les poches déclarées conformes arrivent à cette étape."
            />
      )}

      <div className="pile">
        {liste.donnees?.map((poche) => (
          etape === "qualifier"
            ? <CarteQualification key={poche.id} poche={poche} surEnregistrement={() => void rechargerTout()} />
            : <CartePreparation key={poche.id} poche={poche} surPreparation={() => void rechargerTout()} />
        ))}
      </div>
    </>
  );
}

/* =====================================================================
   P4 — Qualification d'une poche
   ===================================================================== */

function CarteQualification({ poche, surEnregistrement }: { poche: Poche; surEnregistrement: () => void }) {
  const [groupe, setGroupe] = useState<"" | GroupeSanguin>("");
  const [resultat, setResultat] = useState<"conforme" | "non_conforme">("conforme");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState("");

  async function enregistrer() {
    if (!groupe) { setErreur("Choisissez le groupe sanguin lu sur la plaque."); return; }
    setErreur(""); setEnCours(true);
    try {
      const a = await api.analyser(poche.code, { groupeSanguin: groupe, resultat });
      setFait(
        a.resultat === "conforme"
          ? `Poche ${a.code} conforme, groupe ${a.groupeSanguin}. Elle passe en préparation.`
          : `Poche ${a.code} déclarée non conforme : elle ne sera pas transfusée.`,
      );
      surEnregistrement();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  if (fait) {
    return (
      <div className="bloc">
        <MessageReussite>{fait}</MessageReussite>
      </div>
    );
  }

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 2 }}>
          <span className="titre-s chiffres">{poche.code}</span>
          <span className="petit">Prélevée le {dateCourte(poche.date)}{poche.volume ? ` · ${poche.volume} ml` : ""}</span>
        </div>
        <Pilule ton="primaire">Prélevée</Pilule>
      </div>

      <div className="rang" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="champ" style={{ minWidth: 150 }}>
          <span className="champ__etiquette">Groupe sanguin</span>
          <select className="champ__saisie" value={groupe}
                  onChange={(e) => { setGroupe(e.target.value as GroupeSanguin); setErreur(""); }}>
            <option value="">Choisir…</option>
            {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="champ" style={{ minWidth: 190 }}>
          <span className="champ__etiquette">Résultat du dépistage</span>
          <select className="champ__saisie" value={resultat}
                  onChange={(e) => setResultat(e.target.value as "conforme" | "non_conforme")}>
            <option value="conforme">Conforme — transfusable</option>
            <option value="non_conforme">Non conforme — à écarter</option>
          </select>
        </label>
        <Bouton
          variante={resultat === "conforme" ? "principal" : "danger"}
          enCours={enCours}
          motEnCours="Enregistrement…"
          onClick={() => void enregistrer()}
        >
          Enregistrer l'analyse
        </Bouton>
      </div>

      {resultat === "non_conforme" && (
        <Encadre ton="sang">
          Une poche non conforme est définitivement écartée. Le donneur n'est pas informé
          par l'application : c'est au centre de le recontacter.
        </Encadre>
      )}

      <MessageErreur>{erreur}</MessageErreur>
    </div>
  );
}

/* =====================================================================
   P5 — Préparation des produits
   ===================================================================== */

const TYPES = ["GR", "PL", "PQ"] as const;

function CartePreparation({ poche, surPreparation }: { poche: Poche; surPreparation: () => void }) {
  const [choisis, setChoisis] = useState<("GR" | "PL" | "PQ")[]>(["GR", "PL"]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [produits, setProduits] = useState<Produit[] | null>(null);

  function basculer(type: "GR" | "PL" | "PQ") {
    setChoisis((liste) => liste.includes(type) ? liste.filter((t) => t !== type) : [...liste, type]);
    setErreur("");
  }

  async function preparer() {
    if (choisis.length === 0) { setErreur("Choisissez au moins un produit à créer."); return; }
    setErreur(""); setEnCours(true);
    try {
      // L'ordre GR, PL, PQ est celui du plan de travail du laboratoire.
      const ordonnes = TYPES.filter((t) => choisis.includes(t));
      setProduits(await api.preparer(poche.code, { produits: [...ordonnes] }));
      surPreparation();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  if (produits) {
    return (
      <div className="bloc pile-s">
        <MessageReussite>
          {produits.length} produit{produits.length > 1 ? "s" : ""} créé{produits.length > 1 ? "s" : ""} depuis la poche {poche.code}.
        </MessageReussite>
        <div className="pile-s">
          {produits.map((p) => (
            <div key={p.id} className="ligne">
              <Droplets size={18} aria-hidden="true" style={{ color: "var(--sang)" }} />
              <div className="ligne__corps">
                <span className="fort chiffres">{p.code}</span>
                <span className="petit">
                  {TYPE_PRODUIT[p.typeProduit].mot} · groupe {p.groupeSanguin}
                  {p.datePeremption ? ` · à utiliser avant le ${dateCourte(p.datePeremption)}` : ""}
                </span>
              </div>
              <Pilule ton="seve">Disponible</Pilule>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bloc pile">
      <div className="rang-espace" style={{ flexWrap: "wrap" }}>
        <div className="pile-s" style={{ gap: 2 }}>
          <span className="titre-s chiffres">{poche.code}</span>
          <span className="petit">Prélevée le {dateCourte(poche.date)}</span>
        </div>
        <Pilule ton="seve">Conforme</Pilule>
      </div>

      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="champ__etiquette">Produits à préparer</legend>
        <div className="rang" style={{ flexWrap: "wrap", marginTop: "var(--e2)" }}>
          {TYPES.map((type) => (
            <label key={type} className="case" style={{ height: "auto", paddingTop: 6, paddingBottom: 6 }}>
              <input type="checkbox" checked={choisis.includes(type)} onChange={() => basculer(type)} />
              <span className="pile-s" style={{ gap: 0, alignItems: "flex-start" }}>
                <span>{TYPE_PRODUIT[type].mot}</span>
                <span className="petit">{TYPE_PRODUIT[type].detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton
        icone={<PackageCheck size={18} aria-hidden="true" />}
        enCours={enCours}
        motEnCours="Préparation…"
        onClick={() => void preparer()}
      >
        Créer les produits
      </Bouton>
    </div>
  );
}
