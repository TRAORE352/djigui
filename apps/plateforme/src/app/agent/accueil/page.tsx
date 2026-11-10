"use client";
/**
 * P3 — Accueil et prélèvement.
 *
 * Le parcours de l'agent d'accueil, dans l'ordre réel du guichet :
 *   1. retrouver le donneur par son numéro (ou l'inscrire s'il vient pour
 *      la première fois sans l'application) ;
 *   2. enregistrer sa venue : apte, ou ajourné jusqu'à une date ;
 *   3. s'il est apte, créer la poche et lui remettre son code.
 *
 * L'écran garde la trace de ce qui vient d'être fait (passage, poche) pour
 * que l'agent voie, sans recharger, où il en est.
 */
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, KeyRound, Search, UserPlus, UserRound, X } from "lucide-react";
import type {
  Canal, DonneurAgent, GroupeSanguin, Passage, Poche, Sexe, Zone,
} from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import {
  LES_GROUPES, dateCourte, telephoneInternational, telephoneLisible,
} from "@/lib/metier";
import { EnTetePage } from "@/components/Coquille";
import Aide, { AvecAide } from "@/components/Aide";
import Explication from "@/components/Explication";
import Bouton from "@/components/Bouton";
import Pilule from "@/components/Pilule";
import BlocGroupe from "@/components/BlocGroupe";
import { EtatVide } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

export default function AccueilPrelevement() {
  const [telephone, setTelephone] = useState("");
  const [donneur, setDonneur] = useState<DonneurAgent | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [erreur, setErreur] = useState("");
  /** Vrai quand la recherche a abouti à « aucun donneur » : on propose l'inscription. */
  const [inconnu, setInconnu] = useState(false);
  const [formulaire, setFormulaire] = useState(false);

  async function rechercher(e: React.FormEvent) {
    e.preventDefault();
    setRecherche(true); setErreur(""); setDonneur(null); setInconnu(false); setFormulaire(false);
    try {
      setDonneur(await api.retrouverDonneur(telephoneInternational(telephone)));
    } catch (p) {
      // « Introuvable » n'est pas une panne : c'est le cas normal d'un
      // nouveau donneur qui se présente au guichet.
      const estIntrouvable = p instanceof Error && "code" in p && p.code === "INTROUVABLE";
      if (estIntrouvable) setInconnu(true);
      else setErreur(messageDe(p));
    } finally {
      setRecherche(false);
    }
  }

  const huitChiffres = telephone.replace(/\D/g, "").length === 8;

  return (
    <>
      <EnTetePage
        titre="Accueil et prélèvement"
        chapeau="Retrouvez le donneur par son numéro, enregistrez sa venue, puis créez la poche s'il est apte."
        actions={
          <Bouton
            variante={formulaire ? "secondaire" : "principal"}
            className="entete-action"
            icone={<UserPlus size={18} aria-hidden="true" />}
            onClick={() => { setFormulaire((v) => !v); setDonneur(null); setInconnu(false); }}
          >
            {formulaire ? "Fermer l'inscription" : "Inscrire sur place"}
          </Bouton>
        }
      />

      <Explication
        Icone={UserRound}
        cle="accueil"
        resume="Retrouvez le donneur, vérifiez qu'il peut donner, enregistrez la poche."
        role="C'est ici que commence chaque don. Vous retrouvez le donneur qui se présente, vous vérifiez qu'il peut donner aujourd'hui, puis vous enregistrez la poche prélevée."
        quand="Au comptoir, dès qu'un donneur arrive — qu'il vienne suite à un appel ou de lui-même."
        ensuite="La poche part au laboratoire, qui déterminera son groupe sanguin et vérifiera qu'elle est transfusable."
      />

      {/* Zone de recherche : c'est le geste répété cent fois par jour, il
          porte donc le poids visuel le plus fort de l'écran. */}
      <form className="recherche-donneur" onSubmit={rechercher}>
        <label className="recherche-donneur__champ" htmlFor="numero-donneur">
          <span className="recherche-donneur__etiquette">Numéro du donneur</span>
          <span className="recherche-donneur__saisie">
            <Search size={20} aria-hidden="true" className="recherche-donneur__loupe" />
            <input
              id="numero-donneur"
              className="chiffres"
              inputMode="tel"
              autoComplete="off"
              autoFocus
              placeholder="70 00 00 00"
              aria-describedby="aide-numero"
              value={telephone}
              onChange={(e) => { setTelephone(e.target.value); setErreur(""); setInconnu(false); }}
            />
            {telephone && (
              <button
                type="button"
                className="recherche-donneur__vider"
                aria-label="Effacer le numéro"
                onClick={() => { setTelephone(""); setErreur(""); setInconnu(false); }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </span>
          <span className="recherche-donneur__aide" id="aide-numero">
            Les 8 chiffres du numéro, sans l'indicatif.
            {telephone && !huitChiffres && (
              <span className="recherche-donneur__compte chiffres">
                {telephone.replace(/\D/g, "").length}/8
              </span>
            )}
          </span>
        </label>
        <Bouton
          type="submit"
          className="recherche-donneur__bouton"
          icone={<Search size={18} aria-hidden="true" />}
          enCours={recherche}
          motEnCours="Recherche…"
          disabled={!huitChiffres}
        >
          Rechercher
        </Bouton>
      </form>

      <MessageErreur>{erreur}</MessageErreur>

      {inconnu && (
        <EtatVide
          Icone={UserPlus}
          titre="Aucun donneur avec ce numéro"
          texte="C'est sa première venue : inscrivez-le sur place. Il recevra son numéro de donneur immédiatement."
          action={
            <Bouton icone={<UserPlus size={18} aria-hidden="true" />} onClick={() => { setFormulaire(true); setInconnu(false); }}>
              Inscrire ce donneur
            </Bouton>
          }
        />
      )}

      {formulaire && (
        <InscriptionSurPlace
          telephoneInitial={telephone}
          surInscription={(d) => {
            setDonneur(d);
            setFormulaire(false);
            setTelephone(d.telephone.replace(/\D/g, "").slice(-8));
          }}
        />
      )}

      {donneur && <FicheDonneur donneur={donneur} />}

      {!donneur && !formulaire && !inconnu && !erreur && (
        <EtatVide
          Icone={Search}
          ton="doux"
          titre="Aucun donneur affiché"
          texte="Saisissez le numéro du donneur qui se présente. Sa fiche, son éligibilité et ses actions apparaîtront ici."
        />
      )}
    </>
  );
}

/* =====================================================================
   Fiche du donneur et actions du guichet
   ===================================================================== */

function FicheDonneur({ donneur }: { donneur: DonneurAgent }) {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [poche, setPoche] = useState<Poche | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<"" | "apte" | "ajourne" | "poche" | "mdp">("");

  async function enregistrerPassage(resultat: "apte" | "ajourne", ajourneJusquau?: string) {
    setErreur(""); setEnCours(resultat);
    try {
      setPassage(await api.enregistrerPassage({
        donneurId: donneur.id, resultat, ajourneJusquau: ajourneJusquau ?? null,
      }));
      setPoche(null);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  async function creerPoche() {
    if (!passage) return;
    setErreur(""); setEnCours("poche");
    try {
      setPoche(await api.creerPoche({ passageId: passage.id, volume: null }));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  async function reinitialiser() {
    setErreur(""); setEnCours("mdp");
    try {
      const r = await api.reinitialiser(donneur.id);
      setMotDePasse(r.motDePasseTemporaire);
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours("");
    }
  }

  return (
    <section className="pile">
      <div className="bloc pile">
        <div className="rang-espace" style={{ flexWrap: "wrap" }}>
          <div className="rang">
            {donneur.groupeSanguin
              ? <BlocGroupe groupe={donneur.groupeSanguin} taille="l" />
              : <span className="bloc-groupe bloc-groupe--l" style={{ background: "var(--trait)", color: "var(--encre-2)" }}>?</span>}
            <div className="pile-s" style={{ gap: 0 }}>
              <span className="titre-s">{donneur.prenom} {donneur.nom}</span>
              <span className="appui chiffres">{donneur.numeroDonneur}</span>
            </div>
          </div>
          <div className="rang" style={{ flexWrap: "wrap" }}>
            <Pilule ton={donneur.actif ? "seve" : "sang"}>{donneur.actif ? "Actif" : "Désactivé"}</Pilule>
            {donneur.enPause && <Pilule ton="ocre">En pause</Pilule>}
            <Pilule ton="neutre">{donneur.origine === "sur_place" ? "Inscrit sur place" : "Via l'application"}</Pilule>
          </div>
        </div>

        <div className="fiche">
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Téléphone</span>
            <span className="fiche__valeur chiffres">{telephoneLisible(donneur.telephone)}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Groupe sanguin</span>
            <span className="fiche__valeur">{donneur.groupeSanguin ?? "À déterminer au laboratoire"}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Zone</span>
            <span className="fiche__valeur">{donneur.zone ? `${donneur.zone.nom}, ${donneur.zone.ville}` : "Non renseignée"}</span>
          </div>
          <div className="pile-s" style={{ gap: 2 }}>
            <span className="fiche__cle">Né le</span>
            <span className="fiche__valeur">{dateCourte(donneur.dateNaissance)}</span>
          </div>
        </div>

        {donneur.enPause && (
          <Encadre ton="ocre">
            Ce donneur s'est mis en pause dans l'application : il ne reçoit plus d'alertes.
            Rien n'empêche de l'accueillir s'il se présente de lui-même.
          </Encadre>
        )}
      </div>

      <div className="bloc pile">
        <h2 className="section-titre">Enregistrer la venue</h2>
        <div className="rang" style={{ flexWrap: "wrap" }}>
          <Bouton
            icone={<CheckCircle2 size={18} aria-hidden="true" />}
            enCours={enCours === "apte"}
            disabled={!!enCours || !!passage}
            onClick={() => void enregistrerPassage("apte")}
          >
            Déclarer apte
          </Bouton>
          <BoutonAjournement
            desactive={!!enCours || !!passage}
            enCours={enCours === "ajourne"}
            surConfirmation={(date) => void enregistrerPassage("ajourne", date)}
          />
          <Bouton
            variante="secondaire"
            icone={<KeyRound size={18} aria-hidden="true" />}
            enCours={enCours === "mdp"}
            disabled={!!enCours}
            onClick={() => void reinitialiser()}
          >
            Réinitialiser son mot de passe
          </Bouton>
        </div>

        <MessageErreur>{erreur}</MessageErreur>

        {passage?.resultat === "apte" && !poche && (
          <>
            <MessageReussite>Venue enregistrée : donneur apte. Créez la poche après le prélèvement.</MessageReussite>
            <div className="rang">
              <Bouton enCours={enCours === "poche"} motEnCours="Création…" onClick={() => void creerPoche()}>
                Créer la poche
              </Bouton>
              <Aide etiquette="Créer la poche">
                Attribue un numéro unique à la poche prélevée et l&apos;envoie au laboratoire pour qualification. À faire après le prélèvement, pas avant.
              </Aide>
            </div>
          </>
        )}

        {passage?.resultat === "ajourne" && (
          <Encadre ton="ocre">
            Venue enregistrée : ajourné jusqu'au <span className="fort">{dateCourte(passage.ajourneJusquau)}</span>.
            Le motif reste au centre : il n'est jamais transmis à l'application du donneur.
          </Encadre>
        )}

        {poche && (
          <Encadre ton="seve">
            <span>Poche créée. Code à coller sur la poche :</span>
            <span className="titre chiffres" style={{ letterSpacing: "0.04em" }}>{poche.code}</span>
            <span className="petit">Prélevée le {dateCourte(poche.date)} — en attente d'analyse au laboratoire.</span>
          </Encadre>
        )}

        {motDePasse && (
          <Encadre ton="seve">
            <span>Mot de passe temporaire à remettre au donneur :</span>
            <span className="titre-s chiffres">{motDePasse}</span>
            <span className="petit">Il le changera lui-même à sa prochaine connexion.</span>
          </Encadre>
        )}
      </div>
    </section>
  );
}

/** Ajournement : la date de reprise est obligatoire, donc demandée sur place. */
function BoutonAjournement({ desactive, enCours, surConfirmation }: {
  desactive: boolean;
  enCours: boolean;
  surConfirmation: (date: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState("");
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  if (!ouvert) {
    return (
      <Bouton
        variante="secondaire"
        icone={<CalendarClock size={18} aria-hidden="true" />}
        disabled={desactive}
        onClick={() => setOuvert(true)}
      >
        Ajourner
      </Bouton>
    );
  }

  return (
    <span className="rang" style={{ flexWrap: "wrap" }}>
      <label className="champ">
        <span className="champ__etiquette sr-only">Ajourné jusqu'au</span>
        <input
          className="champ__saisie"
          type="date"
          min={demain}
          value={date}
          aria-label="Ajourné jusqu'au"
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <Bouton disabled={!date} enCours={enCours} onClick={() => surConfirmation(date)}>
        Valider l&apos;ajournement
      </Bouton>
      <Aide etiquette="Valider l'ajournement">
        Le donneur ne pourra pas donner avant cette date. Le motif médical n&apos;est jamais transmis à son application, c&apos;est un médecin qui le recontacte.
      </Aide>
      <Bouton variante="secondaire" onClick={() => setOuvert(false)}>Annuler</Bouton>
    </span>
  );
}

/* =====================================================================
   Inscription sur place — pour le donneur qui n'a pas l'application
   ===================================================================== */

const CANAUX: { canal: Canal; mot: string }[] = [
  { canal: "whatsapp", mot: "WhatsApp" },
  { canal: "sms", mot: "SMS" },
  { canal: "appel", mot: "Appel" },
];

function InscriptionSurPlace({ telephoneInitial, surInscription }: {
  telephoneInitial: string;
  surInscription: (d: DonneurAgent) => void;
}) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("F");
  const [dateNaissance, setDateNaissance] = useState("");
  const [telephone, setTelephone] = useState(telephoneInitial);
  const [groupe, setGroupe] = useState<"" | GroupeSanguin>("");
  const [zoneId, setZoneId] = useState("");
  const [canaux, setCanaux] = useState<Canal[]>(["whatsapp"]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.zones().then((z) => setZones(z as Zone[])).catch(() => setZones([]));
  }, []);

  // 18 ans révolus : on borne le calendrier plutôt que de laisser l'agent
  // découvrir le refus après avoir tout saisi.
  const majoriteLe = new Date();
  majoriteLe.setFullYear(majoriteLe.getFullYear() - 18);
  const dateMax = majoriteLe.toISOString().slice(0, 10);

  function basculerCanal(canal: Canal) {
    setCanaux((liste) => liste.includes(canal) ? liste.filter((c) => c !== canal) : [...liste, canal]);
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (telephone.replace(/\D/g, "").length !== 8) { setErreur("Le numéro doit faire 8 chiffres."); return; }
    if (canaux.length === 0) { setErreur("Choisissez au moins un moyen de le prévenir."); return; }
    setEnCours(true);
    try {
      surInscription(await api.inscrireSurPlace({
        nom, prenom, sexe, dateNaissance,
        telephone: telephoneInternational(telephone),
        zoneId: zoneId || null,
        groupeSanguin: groupe || null,
        canaux,
      }));
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="bloc pile" onSubmit={envoyer}>
      <div className="pile-s">
        <h2 className="titre-s">Inscrire un donneur sur place</h2>
        <p className="appui">
          Le donneur reçoit son numéro tout de suite. Son groupe sanguin peut rester
          vide : le laboratoire le renseignera après la première analyse.
        </p>
      </div>

      <div className="grille-3">
        <label className="champ">
          <span className="champ__etiquette">Prénom</span>
          <input className="champ__saisie" value={prenom} required autoComplete="off"
                 onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Nom</span>
          <input className="champ__saisie" value={nom} required autoComplete="off"
                 onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Téléphone</span>
          <input className="champ__saisie chiffres" inputMode="tel" value={telephone} required
                 placeholder="70 00 00 00" autoComplete="off"
                 onChange={(e) => setTelephone(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Sexe</span>
          <select className="champ__saisie" value={sexe} onChange={(e) => setSexe(e.target.value as Sexe)}>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
          </select>
        </label>
        <label className="champ">
          <AvecAide etiquette="Date de naissance" aide="Le donneur doit avoir dix-huit ans révolus le jour du don.">
            <span className="champ__etiquette">Date de naissance</span>
          </AvecAide>
          <input className="champ__saisie" type="date" value={dateNaissance} required max={dateMax}
                 onChange={(e) => setDateNaissance(e.target.value)} />
        </label>
        <label className="champ">
          <span className="champ__etiquette">Groupe sanguin</span>
          <select className="champ__saisie" value={groupe}
                  onChange={(e) => setGroupe(e.target.value as "" | GroupeSanguin)}>
            <option value="">Inconnu pour l'instant</option>
            {LES_GROUPES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="champ">
          <AvecAide etiquette="Zone d'habitation" aide="Sert à prévenir le donneur quand une campagne de don concerne son quartier. Facultatif.">
            <span className="champ__etiquette">Zone d'habitation</span>
          </AvecAide>
          <select className="champ__saisie" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Non renseignée</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.nom} · {z.ville}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="champ__etiquette">Comment le prévenir</legend>
        <div className="rang" style={{ flexWrap: "wrap", marginTop: "var(--e2)" }}>
          {CANAUX.map(({ canal, mot }) => (
            <label key={canal} className="case">
              <input type="checkbox" checked={canaux.includes(canal)} onChange={() => basculerCanal(canal)} />
              <span>{mot}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <MessageErreur>{erreur}</MessageErreur>

      <Bouton type="submit" enCours={enCours} motEnCours="Inscription…"
              icone={<UserPlus size={18} aria-hidden="true" />}>
        Inscrire le donneur
      </Bouton>
    </form>
  );
}
