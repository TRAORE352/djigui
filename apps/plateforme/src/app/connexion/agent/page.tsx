import type { Metadata } from "next";
import Connexion from "@/components/Connexion";

export const metadata: Metadata = {
  title: "Espace agent",
  description: "Connexion du personnel du centre de transfusion sanguine.",
};

export default function ConnexionAgent() {
  return <Connexion espace="agent" />;
}
