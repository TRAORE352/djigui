'use client';
// =====================================================================
//  DJIGUI — goutte de groupe sanguin, élément héros de Ma carte (E5).
//  BlocGroupe reste l'élément signature du produit (carré, immobile,
//  utilisé partout ailleurs) : cette goutte est spécifique à cet écran,
//  posée directement sur le fond, en pulsation continue et douce — un
//  battement, jamais une alerte.
// =====================================================================
import { motion, useReducedMotion } from 'motion/react';

export default function GoutteGroupe({ groupe }) {
  const mouvementReduit = useReducedMotion();
  const connu = Boolean(groupe);

  return (
    <motion.div
      className="goutte-groupe"
      role="img"
      aria-label={connu ? `Groupe sanguin ${groupe}` : 'Groupe sanguin à préciser au centre'}
      animate={mouvementReduit ? {} : { scale: [1, 1.035, 1] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 120 140" width="176" height="205" aria-hidden="true">
        <path
          d="M60 6 C 30 46 14 74 14 96 A 46 46 0 0 0 106 96 C 106 74 90 46 60 6 Z"
          fill="var(--sang)"
        />
      </svg>
      <span className="goutte-groupe-texte">{connu ? groupe : '?'}</span>
    </motion.div>
  );
}
