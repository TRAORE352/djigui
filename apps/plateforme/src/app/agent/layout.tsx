import Coquille from "@/components/Coquille";

/** Gabarit de l'espace agent : navigation latérale et garde de session. */
export default function GabaritAgent({ children }: { children: React.ReactNode }) {
  return <Coquille espace="agent">{children}</Coquille>;
}
