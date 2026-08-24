'use client';
// =====================================================================
//  DJIGUI — mark seul, sans bandeau. Pour les écrans épurés
//  (/connexion, /inscription) où le grand héro dégradé de E1 écraserait
//  la page : juste le logo, animé en boucle continue.
// =====================================================================
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';

export default function LogoPulsant({ taille = 72 }) {
  const mouvementReduit = useReducedMotion();

  return (
    <motion.div
      style={{ display: 'flex', justifyContent: 'center' }}
      animate={mouvementReduit ? {} : { scale: [1, 1.06, 1, 1.03, 1], y: [0, -4, -1, -3, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
    >
      <Image src="/logo/logo_djigui.png" alt="DJIGUI" width={taille} height={taille} priority />
    </motion.div>
  );
}
