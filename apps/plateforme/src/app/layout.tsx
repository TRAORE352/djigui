import type { Metadata, Viewport } from "next";
import { DEPLOIEMENT, IDENTITE, MARQUE } from "@/lib/espace";
import "./globals.css";

/**
 * Les métadonnées suivent l'identité du déploiement : chaque adresse
 * s'annonce pour ce qu'elle est. C'est aussi ce qui permet de vérifier
 * qu'un déploiement sert bien le bon espace avec un simple `curl` sur le
 * HTML, sans ouvrir de navigateur.
 */
const { titre, phrase } = IDENTITE[DEPLOIEMENT];
const NOM = DEPLOIEMENT === "complet" ? MARQUE : `${titre} · ${MARQUE}`;

export const metadata: Metadata = {
  title: { default: NOM, template: `%s · ${MARQUE}` },
  description: phrase,
  applicationName: MARQUE,
  openGraph: { title: NOM, description: phrase, siteName: MARQUE, locale: "fr_BF" },
};

export const viewport: Viewport = {
  themeColor: "#101B2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
