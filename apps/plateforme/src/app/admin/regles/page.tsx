"use client";
/**
 * Annexe E — Règles de don réglables.
 *
 * Ces valeurs pilotent directement l'éligibilité au don et l'envoi des
 * alertes. Les modifier a un effet immédiat sur tout le réseau : l'écran
 * annonce l'unité attendue, borne les valeurs absurdes, et explique en
 * clair la conséquence de chaque réglage.
 */
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { Regle } from "@dds/contrat-api";
import { api } from "@/lib/api";
import { messageDe } from "@/lib/erreurs";
import { useRessource } from "@/lib/useRessource";
import { EnTetePage } from "@/components/Coquille";
import Bouton from "@/components/Bouton";
import { EtatErreur, EtatVide, SqueletteLignes } from "@/components/Etats";
import { Encadre, MessageErreur, MessageReussite } from "@/components/Messages";

/**
 * Ce que l'administrateur doit savoir avant de toucher une valeur.
 * Une clé absente d'ici reste modifiable : on affiche simplement la
 * description venue du serveur, sans unité ni borne.
 */
const AIDE: Record<string, { unite: string; min: number; max: number; effet: string }> = {
  delai_homme_mois: {
    unite: "mois", min: 1, max: 12,
    effet: "Un homme ne peut pas redonner avant ce délai. Le raccourcir augmente la collecte mais fatigue les donneurs.",
  },
  delai_femme_mois: {
    unite: "mois", min: 1, max: 12,
    effet: "Délai équivalent pour une femme. Il est volontairement plus long, en raison des réserves en fer.",
  },
  code_validite_minutes: {
    unite: "minutes", min: 2, max: 60,
    effet: "Durée de vie d'un code envoyé par WhatsApp. Trop court, le donneur n'a pas le temps de le saisir.",
  },
  code_essais_max: {
    unite: "essais", min: 3, max: 10,
    effet: "Nombre de saisies fausses avant d'annuler le code. Protège contre les tentatives de devinette.",
  },
  code_demandes_max_jour: {
    unite: "par jour", min: 1, max: 20,
    effet: "Codes qu'un même numéro peut demander par jour. Évite l'envoi de messages en rafale.",
  },
  delai_min_alerte_jours: {
    unite: "jours", min: 1, max: 60,
    effet: "Repos minimum entre deux alertes adressées au même donneur. C'est la règle anti-lassitude.",
  },
};

export default function Regles() {
  const { donnees: regles, erreur, chargement, recharger, setDonnees } = useRessource<Regle[]>(
    () => api.regles(),
  );

  return (
    <>
      <EnTetePage
        titre="Règles de don"
        chapeau="Les valeurs qui décident qui peut donner, quand, et à quelle fréquence on peut le solliciter."
      />

      <Encadre ton="ocre" icone={<ShieldAlert size={18} aria-hidden="true" />}>
        Une modification s'applique immédiatement, pour tout le réseau et pour tous
        les donneurs. Les délais entre deux dons relèvent du protocole médical du
        CNTS : ne les changez qu'après validation du responsable médical.
      </Encadre>

      {chargement && <SqueletteLignes lignes={5} />}
      {erreur && <EtatErreur texte={erreur} surReessai={() => void recharger()} />}

      {regles?.length === 0 && (
        <EtatVide
          titre="Aucune règle enregistrée"
          texte="Les règles de l'Annexe E sont créées au premier démarrage de la base. Vérifiez que les données initiales ont bien été chargées."
        />
      )}

      {!!regles?.length && (
        <div className="pile-s">
          {regles.map((r) => (
            <LigneRegle
              key={r.cle}
              regle={r}
              surChangement={(maj) => setDonnees(
                (liste) => (liste ?? []).map((x) => (x.cle === maj.cle ? maj : x)),
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}

function LigneRegle({ regle, surChangement }: { regle: Regle; surChangement: (r: Regle) => void }) {
  const [valeur, setValeur] = useState(regle.valeur);
  const [erreur, setErreur] = useState("");
  const [reussite, setReussite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const aide = AIDE[regle.cle];
  const modifie = valeur.trim() !== regle.valeur;

  async function enregistrer() {
    const propre = valeur.trim();
    setErreur(""); setReussite("");

    // Bornes de sécurité : une valeur aberrante casserait l'éligibilité de
    // tous les donneurs. Le backend revalide, mais l'erreur se lit mieux ici.
    if (aide) {
      const n = Number(propre);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        setErreur(`Entrez un nombre entier de ${aide.unite}.`); return;
      }
      if (n < aide.min || n > aide.max) {
        setErreur(`Valeur attendue entre ${aide.min} et ${aide.max} ${aide.unite}.`); return;
      }
    }

    setEnCours(true);
    try {
      const maj = await api.modifierRegle(regle.cle, { valeur: propre });
      surChangement(maj);
      setValeur(maj.valeur);
      setReussite("Enregistré. La règle est active sur tout le réseau.");
    } catch (p) {
      setErreur(messageDe(p));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="bloc pile-s">
      <div className="rang-espace" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="pile-s" style={{ gap: 2, flex: 1, minWidth: 240 }}>
          <span className="fort">{regle.description || regle.cle}</span>
          <span className="petit chiffres">{regle.cle}</span>
          {aide && <span className="petit">{aide.effet}</span>}
        </div>

        <div className="rang" style={{ alignItems: "flex-end" }}>
          <label className="champ">
            <span className="champ__etiquette sr-only">
              Valeur de {regle.description || regle.cle}
            </span>
            <span className="rang" style={{ gap: "var(--e2)" }}>
              <input
                className="champ__saisie chiffres"
                style={{ width: 96 }}
                inputMode={aide ? "numeric" : "text"}
                value={valeur}
                aria-label={`Valeur de ${regle.description || regle.cle}`}
                onChange={(e) => { setValeur(e.target.value); setReussite(""); setErreur(""); }}
              />
              {aide && <span className="appui">{aide.unite}</span>}
            </span>
          </label>
          <Bouton
            compact
            disabled={!modifie || !valeur.trim()}
            enCours={enCours}
            onClick={() => void enregistrer()}
          >
            Enregistrer
          </Bouton>
        </div>
      </div>

      <MessageErreur>{erreur}</MessageErreur>
      <MessageReussite>{reussite}</MessageReussite>
    </div>
  );
}
