import Coquille from "@/components/Coquille";

/** Gabarit de l'espace CNTS : navigation latérale, réservé aux administrateurs. */
export default function GabaritAdmin({ children }: { children: React.ReactNode }) {
  return <Coquille espace="admin">{children}</Coquille>;
}
