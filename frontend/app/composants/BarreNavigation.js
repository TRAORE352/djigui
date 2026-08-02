'use client';
// DJIGUI — barre de navigation de l'espace donneur (E5 à E10).
// Icône au-dessus du mot : le mot reste, l'icône aide à viser.
// La section active porte un filet de 2 px qui glisse d'un onglet
// à l'autre.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IdCard, Bell, HandHeart, UserRound } from 'lucide-react';

const SECTIONS = [
  { adresse: '/carte',   mot: 'Ma carte', Icone: IdCard },
  { adresse: '/alertes', mot: 'Alertes',  Icone: Bell },
  { adresse: '/dons',    mot: 'Mes dons', Icone: HandHeart },
  { adresse: '/compte',  mot: 'Compte',   Icone: UserRound }
];

export default function BarreNavigation() {
  const chemin = usePathname();
  return (
    <nav className="barre-nav" aria-label="Sections">
      {SECTIONS.map(({ adresse, mot, Icone }) => {
        const actif = chemin.startsWith(adresse);
        return (
          <Link key={adresse} href={adresse} className={actif ? 'actif' : ''}
                aria-current={actif ? 'page' : undefined}>
            <Icone size={24} strokeWidth={actif ? 2 : 1.6} aria-hidden="true" />
            <span>{mot}</span>
          </Link>
        );
      })}
    </nav>
  );
}
