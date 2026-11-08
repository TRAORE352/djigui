import type { Metadata } from "next";
import Connexion from "@/components/Connexion";

export const metadata: Metadata = {
  title: "Espace CNTS",
  description: "Connexion de l'administration du centre national de transfusion sanguine.",
};

export default function ConnexionCnts() {
  return <Connexion espace="cnts" />;
}
