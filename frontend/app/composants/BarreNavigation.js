'use client';
// DJIGUI — barre de navigation de l'espace donneur (E5, E6, E9).
// Trois sections seulement : le compte se rejoint depuis l'icône de
// profil, présente en haut de chaque écran (IconeProfil/EnteteDonneur).
// Icône au-dessus du mot : le mot reste, l'icône aide à viser.
// L'onglet actif porte le rouge Djigui, son icône fait un petit rebond
// à l'arrivée, et le filet du haut glisse d'un onglet à l'autre.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { IdCard, Bell, HandHeart } from 'lucide-react';

const SECTIONS = [
  { adresse: '/carte',   mot: 'Ma carte', Icone: IdCard },
  { adresse: '/alertes', mot: 'Alertes',  Icone: Bell },
  { adresse: '/dons',    mot: 'Mes dons', Icone: HandHeart }
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
            <span className="barre-nav-icone-zone">
              {actif && (
                <motion.span
                  className="barre-nav-halo"
                  layoutId="barre-nav-halo"
                  transition={mouvementReduit ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <motion.span
                style={{ display: 'flex', position: 'relative' }}
                animate={actif && !mouvementReduit ? { scale: [1, 1.22, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <Icone size={24} strokeWidth={actif ? 2 : 1.6} aria-hidden="true" />
              </motion.span>
            </span>
            <span>{mot}</span>
          </Link>
        );
      })}
    </nav>
  );
}
