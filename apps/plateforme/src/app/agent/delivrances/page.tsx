"use client";
/**
 * P10 — Délivrances aux services de soins.
 *
 * C'est le geste le plus fréquent d'un centre : un médecin ou un
 * infirmier vient chercher une poche, l'agent l'enregistre. Il méritait
 * son propre écran plutôt qu'un formulaire replié au bas de la
 * distribution — qui, elle, traite des échanges ENTRE sites.
 *
 * Deux choses à l'écran, et rien d'autre :
 *   · le formulaire de délivrance, ouvert d'emblée ;
 *   · ce qui est disponible, pour que l'agent trouve un code sans
 *     quitter la page (il n'a pas toujours l'étiquette sous les yeux).
 *
 * La délivrance est DÉFINITIVE : le produit ne revient pas au stock.
 * L'écran doit donc être lisible et sans ambiguïté, pas rapide à tout
 * prix.
 */
import { useState } from "react";
import { Hospital, PackageSearch } from "lucide-react";
import type { Produit } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_PRODUIT, dateCourte } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Explication from "@/components/Explication";
import Aide, { AvecAide } from "@/components/Aide";
import Bouton from "@/components/Bouton";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Section, VideLigne } from "@/components/Mise";
import { MessageErreur, MessageReussite } from "@/components/Messages";

/** Au-delà, la page devient un mur de codes : on pagine. */
const PAR_PAGE = 15;

export default function Delivrances() {
  const [code, setCode] = useState("");
  const [service, setService] = useState("");
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [filtre, setFiltre] = useState("");
  const [limite, setLimite] = useState(PAR_PAGE);

  // La liste sert aussi de preuve : après une délivrance, l'unité en
  // disparaît. L'agent voit l'effet de son geste sans rien recharger.
  const disponibles = useRessource<Produit[]>(() => api.produitsDisponibles());

  /*
   * Tri par péremption CROISSANTE : la première unité proposée est
   * celle qui se perdra en premier. C'est la règle du métier (premier
   * périmé, premier sorti) — l'écran doit la rendre naturelle plutôt
   * que de compter sur la vigilance de l'agent. Les unités sans date
   * passent en dernier.
   */
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
      const r = await api.delivrer({ code: code.trim(), service: service.trim() });
      setReussite(
        `Produit ${r.code} délivré au service « ${r.service} ». La traçabilité est bouclée.`,
      );
      // Le code se vide, PAS le service : un agent délivre souvent
      // plusieurs poches d'affilée au même service.
      setCode("");
      void disponibles.recharger();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

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

      <Explication
        Icone={Hospital}
        role="Enregistrer qu'une poche quitte votre stock pour un service de soins : urgences, maternité, bloc…"
        quand="Au moment où le médecin ou l'infirmier emporte la poche."
        ensuite="Le produit sort du stock et la traçabilité est close : le geste ne s'annule pas."
      />

      <Section titre="Délivrer un produit">
        <form className="bloc pile-m" onSubmit={delivrer}>
          <div className="grille-2">
            <label className="champ">
              <AvecAide
                etiquette="Code du produit"
                aide="Le code figure sur l'étiquette de la poche. Les minuscules et les tirets sont acceptés."
              >
                <span className="champ__etiquette">Code du produit</span>
              </AvecAide>
              <input
                className="champ__saisie chiffres" value={code} required
                placeholder="OUA-26-04812-K-GR" autoComplete="off"
                onChange={(e) => { setCode(e.target.value); setErreur(""); }}
              />
            </label>

            <label className="champ">
              <AvecAide
                etiquette="Service destinataire"
                aide="Le service de soins qui reçoit le produit. C'est le dernier maillon enregistré dans la traçabilité."
              >
                <span className="champ__etiquette">Service destinataire</span>
              </AvecAide>
              <input
                className="champ__saisie" value={service} required
                placeholder="Urgences, maternité, pédiatrie" autoComplete="off"
                onChange={(e) => { setService(e.target.value); setErreur(""); }}
              />
            </label>
          </div>

          <MessageErreur>{erreur}</MessageErreur>
          <MessageReussite>{reussite}</MessageReussite>

          <div className="rang">
            <Bouton
              type="submit" icone={<Hospital size={18} aria-hidden="true" />}
              enCours={enCours} motEnCours="Délivrance…"
              disabled={!code.trim() || !service.trim()}
            >
              Délivrer
            </Bouton>
            <Aide etiquette="Délivrer">
              Clôt la traçabilité du produit. Le geste est définitif : le produit ne revient pas au stock.
            </Aide>
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
            {/*
              * Un centre bien approvisionné détient des CENTAINES
              * d'unités : les lister toutes donnait une page de près de
              * 10 000 px, inutilisable. On filtre, et on n'affiche que
              * les premières — celles qui périment en premier, car ce
              * sont celles qu'il faut sortir d'abord.
              */}
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
                    // Cliquer remplit le formulaire : sur un poste de
                    // terrain, recopier un code à la main est la première
                    // source d'erreur.
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
