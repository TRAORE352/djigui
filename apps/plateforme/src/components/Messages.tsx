import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

/** Une erreur dit ce qui s'est passé et quoi faire. Elle ne s'excuse pas. */
export function MessageErreur({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="message message--erreur" role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function MessageReussite({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="message message--reussite" role="status">
      <CircleCheck size={18} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const ICONES = { sang: CircleAlert, seve: CircleCheck, ocre: Info, neutre: Info };

export function Encadre({ ton = "neutre", icone, children }: {
  ton?: keyof typeof ICONES;
  icone?: ReactNode;
  children: ReactNode;
}) {
  const Icone = ICONES[ton];
  return (
    <div className={`encadre encadre--${ton}`}>
      {icone ?? <Icone size={18} aria-hidden="true" />}
      <div className="pile-s" style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
