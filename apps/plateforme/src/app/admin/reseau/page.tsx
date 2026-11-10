"use client";
/**
 * P2 — Zones et sites.
 *
 * Deux objets différents, souvent confondus :
 *   · une zone = un quartier d'habitation, sert à cibler les alertes ;
 *   · un site  = un lieu de travail (centre de collecte, dépôt, hôpital).
 * L'écran les sépare pour cette raison, et le dit.
 */
import { useState } from "react";
import { Building2, MapPin, Plus } from "lucide-react";
import type { SiteAdmin, Zone } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { TYPE_SITE, telephoneLisible } from "@/lib/metier";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Aide, { AvecAide } from "@/components/Aide";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import Tableau from "@/components/Tableau";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

export default function Reseau() {
  const sites = useRessource<SiteAdmin[]>(() => api.sites());
  const zones = useRessource<Zone[]>(() => api.zones() as Promise<Zone[]>);
  const [formulaire, setFormulaire] = useState<"" | "zone" | "site">("");
  const [reussite, setReussite] = useState("");

  return (
    <>
      <EnTetePage
        titre="Zones et sites"
        chapeau="Les zones servent à cibler les alertes au plus près des donneurs. Les sites sont les lieux où l'on travaille."
        actions={
          <>
            <Bouton
              variante={formulaire === "zone" ? "principal" : "secondaire"}
              icone={<MapPin size={18} aria-hidden="true" />}
              onClick={() => { setFormulaire((v) => (v === "zone" ? "" : "zone")); setReussite(""); }}
            >
              Ajouter une zone
            </Bouton>
            <Bouton
              variante={formulaire === "site" ? "principal" : "secondaire"}
              icone={<Building2 size={18} aria-hidden="true" />}
              onClick={() => { setFormulaire((v) => (v === "site" ? "" : "site")); setReussite(""); }}
            >
              Ajouter un site
            </Bouton>
          </>
        }
      />

      <MessageReussite>{reussite}</MessageReussite>

      {formulaire === "zone" && (
        <FormulaireZone surCreation={(nom) => {
          setFormulaire("");
          setReussite(`Zone « ${nom} » ajoutée. Elle est désormais proposée à l'inscription et dans le ciblage des alertes.`);
          void zones.recharger();
        }} />
      )}

      {formulaire === "site" && (
        <FormulaireSite zones={zones.donnees ?? []} surCreation={(nom) => {
          setFormulaire("");
          setReussite(`Site « ${nom} » ajouté. Vous pouvez maintenant y rattacher des comptes d'agents.`);
          void sites.recharger();
        }} />
      )}

      <section className="pile">
        <h2 className="section-titre">Sites du réseau</h2>
        {sites.chargement && <SqueletteLignes lignes={3} />}
        {sites.erreur && <EtatErreur texte={sites.erreur} surReessai={() => void sites.recharger()} />}

        {sites.donnees?.length === 0 && (
          <EtatVide
            Icone={Building2}
            titre="Aucun site enregistré"
            texte="Commencez par le centre national, puis ajoutez les dépôts et les hôpitaux qui recevront des produits."
          />
        )}

        {!!sites.donnees?.length && (
          <Tableau
            legende="Sites du réseau : centres, dépôts et hôpitaux"
            lignes={sites.donnees}
            cle={(s) => s.id}
            colonnes={[
              {
                cle: "site", entete: "Site",
                rendu: (s) => (
                  <span className="pile-s" style={{ gap: 0 }}>
                    <span className="fort">{s.nom} <span className="chiffres petit">({s.code})</span></span>
                    <span className="petit">{TYPE_SITE[s.type]}{s.zoneNom ? ` · ${s.zoneNom}` : ""}{s.ville ? `, ${s.ville}` : ""}</span>
                  </span>
                ),
              },
              {
                cle: "coordonnees", entete: "Coordonnées",
                rendu: (s) => (
                  <span className="pile-s" style={{ gap: 0 }}>
                    <span className="petit">{s.adresse || "Adresse non renseignée"}</span>
                    <span className="petit chiffres">{telephoneLisible(s.telephone)}</span>
                  </span>
                ),
              },
              { cle: "horaires", entete: "Horaires", rendu: (s) => <span className="petit">{s.horaires || "—"}</span> },
              { cle: "agents", entete: "Agents", nombre: true, rendu: (s) => s.agents },
              {
                cle: "etat", entete: "État", actions: true,
                rendu: (s) => <Pilule ton={s.actif ? "seve" : "neutre"}>{s.actif ? "Actif" : "Fermé"}</Pilule>,
              },
            ]}
          />
        )}
      </section>

      <section className="pile">
        <h2 className="section-titre">Zones d'habitation</h2>
        {zones.chargement && <SqueletteLignes lignes={1} />}
        {zones.erreur && <EtatErreur texte={zones.erreur} surReessai={() => void zones.recharger()} />}

        {zones.donnees?.length === 0 && (
          <EtatVide
            Icone={MapPin}
            titre="Aucune zone définie"
            texte="Sans zone, les alertes partent à tout le monde. Découpez la ville en quartiers pour appeler les donneurs les plus proches."
          />
        )}

        {!!zones.donnees?.length && (
          <div className="bloc rang" style={{ flexWrap: "wrap", gap: "var(--e2)" }}>
            {zones.donnees.map((z) => (
              <Pilule key={z.id} ton="primaire">{z.nom} · {z.ville}</Pilule>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FormulaireZone({ surCreation }: { surCreation: (nom: string) => void }) {
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("Ouagadougou");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setEnCours(true);
    try {
      const z = await api.ajouterZone({ nom: nom.trim(), ville: ville.trim() });
      surCreation(z.nom);
      setNom("");
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="bloc pile" onSubmit={envoyer}>
      <h2 className="titre-s">Nouvelle zone</h2>
      <Encadre>
        Une zone est un quartier ou un secteur d'habitation. Elle n'a ni adresse ni
        horaires : c'est un site qu'il faut créer pour cela.
      </Encadre>
      <div className="grille-2">
        <label className="champ">
          <span className="champ__etiquette">Nom de la zone</span>
          <input className="champ__saisie" value={nom} required placeholder="Tanghin"
                 autoComplete="off" onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Ville</span>
          <input className="champ__saisie" value={ville} required autoComplete="off"
                 onChange={(e) => setVille(e.target.value)} />
        </label>
      </div>
      <MessageErreur>{erreur}</MessageErreur>
      <Bouton type="submit" enCours={enCours} motEnCours="Ajout…" icone={<Plus size={18} aria-hidden="true" />}>
        Ajouter la zone
      </Bouton>
    </form>
  );
}

function FormulaireSite({ zones, surCreation }: { zones: Zone[]; surCreation: (nom: string) => void }) {
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState<SiteAdmin["type"]>("centre");
  const [adresse, setAdresse] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [telephone, setTelephone] = useState("");
  const [horaires, setHoraires] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (!/^[A-Z]{3}$/.test(code)) { setErreur("Le code doit faire exactement 3 lettres majuscules (il entre dans le code des poches)."); return; }
    setEnCours(true);
    try {
      const s = await api.ajouterCentre({
        code, nom: nom.trim(), type, adresse: adresse.trim(),
        telephone: telephone.trim(), horaires: horaires.trim(),
        zoneId: zoneId || null,
      });
      surCreation(s.nom);
      setCode(""); setNom(""); setAdresse(""); setTelephone(""); setHoraires("");
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="bloc pile" onSubmit={envoyer}>
      <h2 className="titre-s">Nouveau site</h2>
      <Encadre>
        Le code sur 3 lettres entre dans le code de chaque poche prélevée sur ce
        site (par exemple <span className="chiffres fort">OUA</span> →{" "}
        <span className="chiffres">OUA-26-04812-K</span>). Il ne se change plus ensuite.
      </Encadre>

      <div className="grille-3">
        <label className="champ">
          <AvecAide etiquette="Code" aide="Trois lettres majuscules, uniques dans le réseau. Ce code préfixe tous les numéros de poche du site.">
            <span className="champ__etiquette">Code</span>
          </AvecAide>
          <input className="champ__saisie chiffres" value={code} required maxLength={3}
                 placeholder="BOB" style={{ textTransform: "uppercase" }} autoComplete="off"
                 onChange={(e) => { setCode(e.target.value.toUpperCase()); setErreur(""); }} />
        </label>
        <label className="champ">
          <AvecAide etiquette="Type de site" aide="Seuls les centres de collecte apparaissent aux donneurs dans l'application. Les dépôts et les hôpitaux reçoivent du sang sans en collecter.">
            <span className="champ__etiquette">Type de site</span>
          </AvecAide>
          <select className="champ__saisie" value={type}
                  onChange={(e) => setType(e.target.value as SiteAdmin["type"])}>
            <option value="centre">Centre de collecte</option>
            <option value="depot">Dépôt</option>
            <option value="hopital">Hôpital</option>
          </select>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Nom</span>
          <input className="champ__saisie" value={nom} required placeholder="CNTS Bobo-Dioulasso"
                 autoComplete="off" onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Zone</span>
          <select className="champ__saisie" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Aucune</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.nom} · {z.ville}</option>)}
          </select>
        </label>
        <label className="champ">
          <span className="champ__etiquette">Téléphone</span>
          <input className="champ__saisie chiffres" inputMode="tel" value={telephone}
                 placeholder="+226 20 00 00 00" autoComplete="off"
                 onChange={(e) => setTelephone(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Horaires</span>
          <input className="champ__saisie" value={horaires}
                 placeholder="Lundi au vendredi, 7h30 à 15h30" autoComplete="off"
                 onChange={(e) => setHoraires(e.target.value)} />
        </label>
      </div>

      <label className="champ">
        <span className="champ__etiquette">Adresse</span>
        <input className="champ__saisie" value={adresse} autoComplete="off"
               placeholder="Avenue Kwame N'Krumah, secteur 4"
               onChange={(e) => setAdresse(e.target.value)} />
      </label>

      <MessageErreur>{erreur}</MessageErreur>

      <div className="rang">
        <Bouton type="submit" enCours={enCours} motEnCours="Ajout…" icone={<Plus size={18} aria-hidden="true" />}>
          Ajouter le site
        </Bouton>
        <Aide etiquette="Ajouter le site">
          Le site devient immédiatement disponible pour rattacher des comptes et pour les échanges de produits entre sites.
        </Aide>
      </div>
    </form>
  );
}
