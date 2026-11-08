import type { LucideIcon } from "lucide-react";

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
 */
export default function Explication({ Icone, role, quand, ensuite }: {
  Icone: LucideIcon;
  /** Une phrase : ce que cet écran permet de faire. */
  role: string;
  /** Le moment du travail où l'on ouvre cet écran. */
  quand?: string;
  /** Ce que devient le travail après cet écran. */
  ensuite?: string;
}) {
  return (
    <aside className="explication">
      <span className="explication__icone">
        <Icone size={20} aria-hidden="true" />
      </span>
      <div className="explication__texte">
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
      </div>
    </aside>
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
