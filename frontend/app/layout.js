// DJIGUI — gabarit racine. Trois caractères, trois rôles :
// Archivo 700 pour le mot-écrit, les blocs de groupe et les grands
// compteurs ; IBM Plex Sans pour l'interface ; IBM Plex Mono pour tout
// ce qui se lit chiffre par chiffre (numéros, dates, codes de poche).
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import ServiceWorker from './composants/ServiceWorker';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'], weight: ['700'], display: 'swap', variable: '--police-archivo'
});
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--police-sans'
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--police-mono'
});

export const metadata = {
  title: { default: 'DJIGUI', template: '%s · DJIGUI' },
  description:
    'Quand un centre de transfusion manque de sang de votre groupe, il vous prévient.',
  manifest: '/manifest.json',
  applicationName: 'DJIGUI',
  appleWebApp: { capable: true, title: 'DJIGUI', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icones/icone-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/icones/icone-180.png'
  },
  // Next.js n'émet que la balise standard "mobile-web-app-capable" à partir
  // de appleWebApp.capable — pas la variante "apple-" que Safari iOS lit
  // pour lancer l'app en mode standalone. On la force explicitement ;
  // "other" ajoute une balise sans retirer celle déjà émise plus haut.
  other: { 'apple-mobile-web-app-capable': 'yes' }
};

export const viewport = {
  themeColor: '#8C1C2C',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function GabaritRacine({ children }) {
  return (
    <html lang="fr">
      <body className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
