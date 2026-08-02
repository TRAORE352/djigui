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
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export default function Ouverture() {
  const [visible, setVisible] = useState(false);
  const mouvementReduit = useReducedMotion();

  useEffect(() => {
    if (window.sessionStorage.getItem('djigui_ouverture_vue')) return;
    window.sessionStorage.setItem('djigui_ouverture_vue', '1');
    setVisible(true);
    const minuterie = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(minuterie);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          onClick={() => setVisible(false)}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.4, ease: 'easeOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'var(--fond)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 'var(--e4)'
          }}
        >
          <motion.span
            className="mot-ecrit"
            style={{ fontSize: 'var(--t-enorme)' }}
            initial={mouvementReduit ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            DJIGUI
          </motion.span>
          <motion.span
            className="appui"
            initial={mouvementReduit ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            L&rsquo;espoir arrive à temps
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
