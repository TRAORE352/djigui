"use client";
import { useEffect, useState } from "react";
import { ChevronDown, Info, type LucideIcon } from "lucide-react";

/**
 * Bandeau d'explication en tête de page : à quoi sert cet écran, et quand
 * s'en sert-on.
 *
 * Il répond à trois questions dans cet ordre, parce que c'est l'ordre dans
 * lequel quelqu'un qui découvre l'écran se les pose :
 *   1. Qu'est-ce que je fais ici ?        -> `role`
 *   2. Quand est-ce que je viens ici ?    -> `quand`
 *   3. Qu'est-ce qui se passe après ?     -> `ensuite`
 *
 * Un titre de page ne suffit pas : « Distribution » ne dit ni ce qu'on y
 * fait, ni à quel moment de la chaîne on s'y trouve. Un écran métier que
 * l'on doit deviner est un écran que l'on utilise mal.
 *
 * Mais ce qui est indispensable le premier jour encombre le centième :
 * avec une `cle`, le bandeau devient repliable et retient le choix de
 * l'agent sur ce poste. Replié, il tient en une ligne et rend sa hauteur
 * à la zone de travail.
 */
export default function Explication({ Icone, role, quand, ensuite, cle, resume }: {
  Icone: LucideIcon;
  /** Une phrase : ce que cet écran permet de faire. */
  role: string;
  /** Le moment du travail où l'on ouvre cet écran. */
  quand?: string;
  /** Ce que devient le travail après cet écran. */
  ensuite?: string;
  /**
   * Identifiant de l'écran. Fourni, le bandeau devient repliable et son
   * état est retenu dans le navigateur du poste.
   */
  cle?: string;
  /** Phrase courte affichée quand le bandeau est replié. */
  resume?: string;
}) {
  const rangement = cle ? `dds:explication:${cle}` : "";
  /*
   * Replié par défaut dès qu'une `cle` est fournie.
   *
   * Ces consignes servent les premiers jours ; ensuite elles coûtent de
   * la hauteur à chaque passage, sur un écran dont l'agent se sert cent
   * fois. L'aide reste à un clic, et le choix contraire est retenu par
   * poste. Un écran de travail doit respirer avant d'expliquer.
   */
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!rangement) return;
    try {
      if (localStorage.getItem(rangement) === "ouvert") setOuvert(true);
    } catch { /* stockage refusé : le bandeau reste replié */ }
  }, [rangement]);

  function basculer() {
    setOuvert((v) => {
      const suivant = !v;
      try {
        if (rangement) localStorage.setItem(rangement, suivant ? "ouvert" : "replie");
      } catch { /* sans incidence sur l'affichage */ }
      return suivant;
    });
  }

  // Sans clé, comportement d'origine : un bandeau fixe, non repliable.
  if (!cle) {
    return (
      <aside className="explication">
        <span className="explication__icone"><Icone size={20} aria-hidden="true" /></span>
        <div className="explication__texte">
          <Corps role={role} quand={quand} ensuite={ensuite} />
        </div>
      </aside>
    );
  }

  const idCorps = `explication-${cle}`;

  // `monte` n'est plus requis ici : replié est l'état par défaut des deux
  // côtés (serveur et premier rendu client), donc aucun écart d'hydratation.
  if (!ouvert) {
    return (
      <aside className="explication explication--replie">
        <span className="explication__puce" aria-hidden="true"><Info size={16} /></span>
        <p className="explication__resume">{resume ?? role}</p>
        <button
          type="button"
          className="explication__bascule"
          aria-expanded={false}
          aria-controls={idCorps}
          onClick={basculer}
        >
          Afficher les instructions
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="explication">
      <span className="explication__icone"><Icone size={20} aria-hidden="true" /></span>
      <div className="explication__texte" id={idCorps}>
        <Corps role={role} quand={quand} ensuite={ensuite} />
      </div>
      <button
        type="button"
        className="explication__bascule explication__bascule--haut"
        aria-expanded
        aria-controls={idCorps}
        onClick={basculer}
      >
        Masquer
        <ChevronDown size={16} aria-hidden="true" className="explication__fleche" />
      </button>
    </aside>
  );
}

function Corps({ role, quand, ensuite }: { role: string; quand?: string; ensuite?: string }) {
  return (
    <>
      <p className="explication__role">{role}</p>
      {(quand || ensuite) && (
        <dl className="explication__details">
          {quand && (
            <div>
              <dt>Quand</dt>
              <dd>{quand}</dd>
            </div>
          )}
          {ensuite && (
            <div>
              <dt>Ensuite</dt>
              <dd>{ensuite}</dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

/**
 * Étapes numérotées d'un écran qui en comporte plusieurs.
 *
 * Quand une page enchaîne des gestes (réceptionner, puis grouper, puis
 * libérer), les numéroter montre l'ordre et évite de chercher par où
 * commencer.
 */
export function Etape({ numero, titre, resume, children }: {
  numero: number;
  titre: string;
  resume?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="etape">
      <header className="etape__entete">
        <span className="etape__numero" aria-hidden="true">{numero}</span>
        <div>
          <h2 className="etape__titre">{titre}</h2>
          {resume && <p className="etape__resume">{resume}</p>}
        </div>
      </header>
      <div className="etape__corps">{children}</div>
    </section>
  );
}
