"use client";
/**
 * P6 — Stock et péremption.
 *
 * Le stock n'est jamais saisi : il est calculé à partir des produits présents
 * sur le site. L'écran a donc deux rôles — montrer ce qui manque (niveaux)
 * et montrer ce qui va se perdre (péremption proche).
 */
import { useState } from "react";
import { Boxes, CalendarX2, PackagePlus, Plus, Trash2, X } from "lucide-react";
import type { GroupeSanguin, LigneLotRequete, LigneStock, Produit } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { NIVEAU_STOCK, TYPE_PRODUIT, dateCourte, joursRestants } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import Tableau from "@/components/Tableau";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Repli, Section, VideLigne } from "@/components/Mise";
import { MessageErreur, MessageReussite } from "@/components/Messages";
import { ChampTexte } from "@/components/Champs";

export default function Stock() {
  const stock = useRessource<LigneStock[]>(() => api.stock());
  const peremption = useRessource<Produit[]>(() => api.produitsPeremption());

  return (
    <>
      <EnTetePage
        titre="Stock du site"
        chapeau="Quantités calculées à partir des produits réellement présents. Un niveau bas ou critique est le signal pour lancer une alerte aux donneurs."
        actions={
          <Bouton variante="secondaire" onClick={() => { void stock.recharger(); void peremption.recharger(); }}>
            Actualiser
          </Bouton>
        }
      />

      <ResumeNiveaux lignes={stock.donnees} />

      <ReceptionLot surEntree={() => { void stock.recharger(); void peremption.recharger(); }} />

      <Repli
        titre="Produits disponibles"
        resume={stock.donnees ? `${stock.donnees.length} ligne${stock.donnees.length > 1 ? "s" : ""} de stock` : undefined}
      >
        {stock.chargement && <SqueletteLignes lignes={4} />}
        {stock.erreur && <EtatErreur texte={stock.erreur} surReessai={() => void stock.recharger()} />}
        {stock.donnees?.length === 0 && (
          <EtatVide
            Icone={Boxes}
            titre="Aucun produit en stock"
            texte="Enregistrez un lot reçu avec « Recevoir un lot », ou attendez que le laboratoire prépare des produits."
          />
        )}
        {!!stock.donnees?.length && (
          <Tableau
            legende="Stock par type de produit et groupe sanguin"
            lignes={[...stock.donnees].sort((a, b) => ordreNiveau(a) - ordreNiveau(b))}
            cle={(l) => `${l.typeProduit}-${l.groupeSanguin}`}
            colonnes={[
              {
                cle: "groupe", entete: "Groupe",
                rendu: (l) => <BlocGroupe groupe={l.groupeSanguin} taille="s" />,
              },
              {
                cle: "type", entete: "Produit",
                rendu: (l) => (
                  <span className="pile-s" style={{ gap: 0 }}>
                    <span className="fort">{TYPE_PRODUIT[l.typeProduit].mot}</span>
                    <span className="petit">{TYPE_PRODUIT[l.typeProduit].detail}</span>
                  </span>
                ),
              },
              { cle: "quantite", entete: "Unités", nombre: true, rendu: (l) => <span className="fort">{l.quantite}</span> },
              {
                cle: "niveau", entete: "Niveau", actions: true,
                rendu: (l) => <Pilule ton={NIVEAU_STOCK[l.niveau].ton}>{NIVEAU_STOCK[l.niveau].mot}</Pilule>,
              },
            ]}
          />
        )}
      </Repli>

      <Peremption ressource={peremption} surDestruction={() => { void stock.recharger(); void peremption.recharger(); }} />
    </>
  );
}

/** Critique d'abord : c'est ce qui demande une décision tout de suite. */
function ordreNiveau(l: LigneStock): number {
  return l.niveau === "critique" ? 0 : l.niveau === "bas" ? 1 : 2;
}

function ResumeNiveaux({ lignes }: { lignes: LigneStock[] | null }) {
  if (!lignes?.length) return null;
  const critiques = lignes.filter((l) => l.niveau === "critique");
  const bas = lignes.filter((l) => l.niveau === "bas");
  const unites = lignes.reduce((total, l) => total + l.quantite, 0);

  return (
    <div className="grille-indicateurs">
      <article className="bloc indicateur">
        <span className="appui">Unités en stock</span>
        <strong className="indicateur__valeur chiffres">{unites}</strong>
        <span className="petit">tous produits et groupes confondus</span>
      </article>
      <article className="bloc indicateur">
        <span className="appui">Groupes au niveau bas</span>
        <strong className={`indicateur__valeur chiffres${bas.length ? " indicateur__valeur--ocre" : ""}`}>{bas.length}</strong>
        <span className="petit">{bas.length ? bas.map((l) => `${l.typeProduit} ${l.groupeSanguin}`).join(", ") : "aucun"}</span>
      </article>
      <article className="bloc indicateur">
        <span className="appui">Groupes critiques</span>
        <strong className={`indicateur__valeur chiffres${critiques.length ? " indicateur__valeur--sang" : ""}`}>{critiques.length}</strong>
        <span className="petit">
          {critiques.length ? "lancez une alerte aux donneurs de la zone" : "aucun groupe en rupture"}
        </span>
      </article>
    </div>
  );
}

/* =====================================================================
   Péremption proche — ce qui va se perdre dans les 14 jours
   ===================================================================== */

function Peremption({ ressource, surDestruction }: {
  ressource: ReturnType<typeof useRessource<Produit[]>>;
  surDestruction: () => void;
}) {
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState("");

  async function detruire(produit: Produit) {
    setErreur(""); setReussite(""); setEnCours(produit.code);
    try {
      await api.detruireProduit(produit.code);
      setReussite(`Produit ${produit.code} sorti du stock et enregistré comme détruit.`);
      surDestruction();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  return (
    <Repli
      titre="Péremption dans les 14 jours"
      resume={ressource.donnees ? `${ressource.donnees.length} produit${ressource.donnees.length > 1 ? "s" : ""}` : undefined}
    >
      {ressource.chargement && <SqueletteLignes lignes={2} />}
      {ressource.erreur && <EtatErreur texte={ressource.erreur} surReessai={() => void ressource.recharger()} />}

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>

      {ressource.donnees?.length === 0 && (
        <VideLigne Icone={CalendarX2}>
          Rien ne périme dans les deux semaines.
        </VideLigne>
      )}

      {!!ressource.donnees?.length && (
        <Tableau
          legende="Produits proches de la péremption"
          lignes={ressource.donnees}
          cle={(p) => p.id}
          colonnes={[
            { cle: "code", entete: "Code", rendu: (p) => <span className="fort chiffres">{p.code}</span> },
            { cle: "groupe", entete: "Groupe", rendu: (p) => <BlocGroupe groupe={p.groupeSanguin} taille="s" /> },
            { cle: "type", entete: "Produit", rendu: (p) => TYPE_PRODUIT[p.typeProduit].mot },
            {
              cle: "date", entete: "À utiliser avant le",
              rendu: (p) => {
                const jours = joursRestants(p.datePeremption);
                const perime = jours !== null && jours < 0;
                return (
                  <span className="pile-s" style={{ gap: 0 }}>
                    <span className="fort">{dateCourte(p.datePeremption)}</span>
                    <span className="petit" style={{ color: perime ? "var(--sang)" : undefined }}>
                      {jours === null ? "sans date"
                        : perime ? `périmé depuis ${-jours} jour${-jours > 1 ? "s" : ""}`
                        : jours === 0 ? "dernier jour"
                        : `dans ${jours} jour${jours > 1 ? "s" : ""}`}
                    </span>
                  </span>
                );
              },
            },
            {
              cle: "actions", entete: "Action", actions: true,
              rendu: (p) => (
                <Bouton
                  variante="danger"
                  compact
                  icone={<Trash2 size={16} aria-hidden="true" />}
                  enCours={enCours === p.code}
                  onClick={() => void detruire(p)}
                >
                  Sortir du stock
                </Bouton>
              ),
            },
          ]}
        />
      )}
    </Repli>
  );
}

/* =====================================================================
   Réception d'un lot reçu de l'extérieur

   Un centre reçoit des poches déjà qualifiées, livrées par un
   laboratoire ou une banque. La saisie est GROUPÉE : un agent qui
   reçoit 100 poches ne remplit pas 100 formulaires. Il décrit des
   lignes (« 40 × GR O+, périme le 15/12 ») et le système crée autant
   d'unités, chacune avec son code — c'est ce qui permet ensuite de
   délivrer ou tracer une unité précise.

   Le formulaire est replié par défaut : recevoir un lot est une action
   ponctuelle, elle ne doit pas occuper l'écran de consultation
   quotidien.
   ===================================================================== */

const GROUPES: GroupeSanguin[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const TYPES: LigneLotRequete["typeProduit"][] = ["GR", "PL", "PQ"];

/** Une ligne en cours de saisie : la quantité reste du texte tant que
 *  l'agent tape (un champ nombre contrôlé refuse l'effacement). */
type LigneSaisie = {
  typeProduit: LigneLotRequete["typeProduit"];
  groupeSanguin: GroupeSanguin;
  quantite: string;
  datePeremption: string;
};

const ligneVide = (): LigneSaisie => ({
  typeProduit: "GR", groupeSanguin: "O+", quantite: "", datePeremption: "",
});

function ReceptionLot({ surEntree }: { surEntree: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [reference, setReference] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()]);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const majLigne = (i: number, champ: Partial<LigneSaisie>) =>
    setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...champ } : x)));

  // Le total guide l'agent : il doit retrouver le compte de son bordereau
  // AVANT d'enregistrer, pas après.
  const total = lignes.reduce((n, l) => n + (parseInt(l.quantite, 10) || 0), 0);
  const complet = reference.trim() !== "" && fournisseur.trim() !== "" && total > 0;

  function reinitialiser() {
    setReference(""); setFournisseur(""); setLignes([ligneVide()]);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setReussite(""); setEnCours(true);
    try {
      const resultat = await api.enregistrerEntree({
        reference: reference.trim(),
        fournisseurLibre: fournisseur.trim(),
        lignes: lignes
          .filter((l) => (parseInt(l.quantite, 10) || 0) > 0)
          .map((l) => ({
            typeProduit: l.typeProduit,
            groupeSanguin: l.groupeSanguin,
            quantite: parseInt(l.quantite, 10),
            datePeremption: l.datePeremption || null,
          })),
      });
      setReussite(
        `${resultat.unitesCreees} unité${resultat.unitesCreees > 1 ? "s" : ""} ajoutée${
          resultat.unitesCreees > 1 ? "s" : ""
        } au stock (lot ${resultat.reference}). Premier code : ${resultat.codes[0]}.`,
      );
      reinitialiser();
      setOuvert(false);
      surEntree();
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Section titre="Entrée de stock">
      {/* La réussite reste visible après la fermeture du formulaire :
          c'est la preuve de l'enregistrement, avec le code à reporter. */}
      <MessageReussite>{reussite}</MessageReussite>

      {!ouvert ? (
        <div className="bord-actions">
          <Bouton
            variante="principal"
            icone={<PackagePlus size={18} aria-hidden="true" />}
            onClick={() => { setOuvert(true); setReussite(""); }}
          >
            Recevoir un lot
          </Bouton>
          <span className="petit">
            Poches livrées par un laboratoire ou une banque de sang.
          </span>
        </div>
      ) : (
        <form className="bloc pile-m" onSubmit={enregistrer}>
          <MessageErreur>{erreur}</MessageErreur>

          <div className="grille-2">
            <ChampTexte
              etiquette="Référence du bordereau"
              aide="Le numéro inscrit sur le document de livraison."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
            <ChampTexte
              etiquette="Livré par"
              aide="Nom du laboratoire, de la banque ou du centre."
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              required
            />
          </div>

          <div className="pile-s">
            <span className="champ__etiquette">Contenu du lot</span>
            {lignes.map((l, i) => (
              <div key={i} className="lot-ligne">
                <label className="lot-ligne__champ">
                  <span className="petit">Produit</span>
                  <select
                    className="champ__saisie"
                    value={l.typeProduit}
                    onChange={(e) => majLigne(i, {
                      typeProduit: e.target.value as LigneSaisie["typeProduit"],
                    })}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_PRODUIT[t].mot}</option>
                    ))}
                  </select>
                </label>

                <label className="lot-ligne__champ">
                  <span className="petit">Groupe</span>
                  <select
                    className="champ__saisie"
                    value={l.groupeSanguin}
                    onChange={(e) => majLigne(i, { groupeSanguin: e.target.value as GroupeSanguin })}
                  >
                    {GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>

                <label className="lot-ligne__champ lot-ligne__champ--court">
                  <span className="petit">Unités</span>
                  <input
                    className="champ__saisie"
                    type="number" min={1} max={500} inputMode="numeric"
                    value={l.quantite}
                    onChange={(e) => majLigne(i, { quantite: e.target.value })}
                  />
                </label>

                <label className="lot-ligne__champ">
                  <span className="petit">Périme le</span>
                  <input
                    className="champ__saisie"
                    type="date"
                    value={l.datePeremption}
                    onChange={(e) => majLigne(i, { datePeremption: e.target.value })}
                  />
                </label>

                {/* Une seule ligne ne se supprime pas : le formulaire
                    doit toujours offrir au moins une saisie. */}
                {lignes.length > 1 && (
                  <button
                    type="button"
                    className="lot-ligne__retirer"
                    onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}
                    aria-label={`Retirer la ligne ${i + 1}`}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}

            <div className="bord-actions">
              <Bouton
                variante="secondaire" compact
                icone={<Plus size={16} aria-hidden="true" />}
                onClick={() => setLignes((l) => [...l, ligneVide()])}
              >
                Ajouter une ligne
              </Bouton>
              <span className="petit">
                Total : <strong className="chiffres">{total}</strong> unité{total > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="bord-actions">
            <Bouton type="submit" variante="principal" enCours={enCours} disabled={!complet}>
              Ajouter au stock
            </Bouton>
            <Bouton
              variante="secondaire"
              onClick={() => { setOuvert(false); setErreur(""); reinitialiser(); }}
            >
              Annuler
            </Bouton>
          </div>
        </form>
      )}
    </Section>
  );
}
