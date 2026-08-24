'use client';
// DJIGUI — barre de navigation de l'espace donneur (E5 à E10).
// Icône au-dessus du mot : le mot reste, l'icône aide à viser.
// L'onglet actif porte le rouge Djigui ; le filet du haut glisse d'un
// onglet à l'autre au lieu d'apparaître d'un coup.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { IdCard, Bell, HandHeart, UserRound } from 'lucide-react';

const SECTIONS = [
  { adresse: '/carte',   mot: 'Ma carte', Icone: IdCard },
  { adresse: '/alertes', mot: 'Alertes',  Icone: Bell },
  { adresse: '/dons',    mot: 'Mes dons', Icone: HandHeart },
  { adresse: '/compte',  mot: 'Compte',   Icone: UserRound }
];

export default function BarreNavigation() {
  const chemin = usePathname();
  const mouvementReduit = useReducedMotion();

  return (
    <nav className="barre-nav" aria-label="Sections">
      {SECTIONS.map(({ adresse, mot, Icone }) => {
        const actif = chemin.startsWith(adresse);
        return (
          <Link key={adresse} href={adresse} className={actif ? 'actif' : ''}
                aria-current={actif ? 'page' : undefined}>
            {actif && (
              <motion.span
                className="barre-nav-indicateur"
                layoutId="barre-nav-indicateur"
                transition={mouvementReduit ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icone size={24} strokeWidth={actif ? 2 : 1.6} aria-hidden="true" />
            <span>{mot}</span>
          </Link>
        );
      })}
    </nav>
  );
}
