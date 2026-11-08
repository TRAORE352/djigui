"use client";
/**
 * P6 — Stock et péremption.
 *
 * Le stock n'est jamais saisi : il est calculé à partir des produits présents
 * sur le site. L'écran a donc deux rôles — montrer ce qui manque (niveaux)
 * et montrer ce qui va se perdre (péremption proche).
 */
import { useState } from "react";
import { Boxes, CalendarX2, Trash2 } from "lucide-react";
import type { LigneStock, Produit } from "@dds/contrat-api";
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
import { Section, VideLigne } from "@/components/Mise";
import { MessageErreur, MessageReussite } from "@/components/Messages";

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

      <Section titre="Produits disponibles" compte={stock.donnees?.length}>
        {stock.chargement && <SqueletteLignes lignes={4} />}
        {stock.erreur && <EtatErreur texte={stock.erreur} surReessai={() => void stock.recharger()} />}
        {stock.donnees?.length === 0 && (
          <EtatVide
            Icone={Boxes}
            titre="Aucun produit en stock"
            texte="Dès que le laboratoire prépare des produits à partir d'une poche conforme, ils apparaissent ici."
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
      </Section>

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
    <Section titre="Péremption dans les 14 jours" compte={ressource.donnees?.length}>
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
    </Section>
  );
}
