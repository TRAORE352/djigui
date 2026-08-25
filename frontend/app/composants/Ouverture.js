'use client';
// =====================================================================
//  DJIGUI — écran d'ouverture.
//  Il ne retarde jamais l'accès : le contenu est déjà en place derrière,
//  et le voile s'efface au bout d'un instant court ou dès que l'on
//  touche l'écran. Sur connexion lente (contrainte K7), un écran qui
//  fait attendre est une faute.
//  Vu une fois par session : on ne fait pas patienter deux fois.
// =====================================================================
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Droplet } from 'lucide-react';

// Un battement, pas un métronome : deux pulsations rapprochées puis un
// creux, comme un vrai pouls plutôt qu'un aller-retour régulier.
const RYTHME_BATTEMENT = { duration: 0.9, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.35 };

export default function Ouverture() {
  const [visible, setVisible] = useState(false);
  const mouvementReduit = useReducedMotion();

  // Le marqueur « déjà vu » ne s'écrit qu'à la fermeture, jamais à
  // l'ouverture : un remontage précoce du composant (React réconciliant
  // l'hydratation) ne doit jamais faire croire à tort que l'écran a déjà
  // été montré alors qu'il n'a fait qu'apparaître puis disparaître sans
  // avoir été vu.
  useEffect(() => {
    if (window.sessionStorage.getItem('djigui_ouverture_vue')) return;
    setVisible(true);
    const minuterie = setTimeout(masquer, mouvementReduit ? 900 : 3000);
    return () => clearTimeout(minuterie);
  }, [mouvementReduit]);

  function masquer() {
    window.sessionStorage.setItem('djigui_ouverture_vue', '1');
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          onClick={masquer}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'var(--fond)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)'
          }}
        >
          <motion.div
            animate={mouvementReduit ? {} : { scale: [1, 1.1, 1, 1.06, 1] }}
            transition={RYTHME_BATTEMENT}
            style={{
              width: 132, height: 132, borderRadius: '50%',
              background: 'var(--sang)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 28px rgba(140,28,44,.28)'
            }}
          >
            <Image src="/logo/Logo_favicon_app.png" alt="DJIGUI" width={82} height={82} priority
                   style={{ objectFit: 'contain' }} />
          </motion.div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
            <svg width="164" height="44" viewBox="0 0 164 44" fill="none" aria-hidden="true">
              <motion.path
                d="M0,22 L52,22 L64,6 L76,38 L86,14 L96,22 L164,22"
                stroke="var(--sang)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                initial={mouvementReduit ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={mouvementReduit ? { duration: 0 }
                  : { duration: 1.1, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', repeatDelay: 0.25 }}
              />
            </svg>
            <motion.span
              animate={mouvementReduit ? {} : { scale: [1, 1.18, 1, 1.1, 1] }}
              transition={RYTHME_BATTEMENT}
              style={{ display: 'flex' }}
            >
              <Droplet size={22} strokeWidth={1.75} color="var(--sang)" fill="var(--sang)" aria-hidden="true" />
            </motion.span>
          </div>

          <motion.p
            className="lead"
            style={{ textAlign: 'center', maxWidth: 280, color: 'var(--encre)' }}
            initial={mouvementReduit ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mouvementReduit ? 0 : 0.3, duration: 0.4, ease: 'easeOut' }}
          >
            Donner mon sang, pour sauver une vie.
          </motion.p>

          <motion.span
            className="petit"
            initial={mouvementReduit ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: mouvementReduit ? 0.3 : 1.6, duration: 0.4 }}
            style={{ position: 'absolute', bottom: 'var(--e6)' }}
          >
            Toucher l&rsquo;écran pour passer
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
