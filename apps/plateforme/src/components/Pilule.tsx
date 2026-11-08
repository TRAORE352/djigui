import type { ReactNode } from "react";
import type { Ton } from "@/lib/metier";

/** Badge d'état. Le ton porte le sens : vert = bon, rouge = à traiter. */
export default function Pilule({ ton = "neutre", children }: { ton?: Ton; children: ReactNode }) {
  return <span className={`pilule pilule--${ton}`}>{children}</span>;
}
