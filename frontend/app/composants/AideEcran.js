'use client';
// =====================================================================
//  DJIGUI — « À quoi sert cet écran ? »
//  Un petit bouton à côté du titre, replié par défaut, qui déplie
//  trois à cinq phrases sur le rôle de l'écran et le geste attendu.
//  L'état ouvert/replié se retient pour la session, écran par écran.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CircleHelp } from 'lucide-react';

export function useAide(cle) {
  const cleSession = `djigui-aide-${cle}`;
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    try {
      setOuvert(window.sessionStorage.getItem(cleSession) === '1');
    } catch { /* stockage indisponible : l'aide reste repliée */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleSession]);

  const basculer = useCallback(() => {
    setOuvert((valeur) => {
      const suivant = !valeur;
      try { window.sessionStorage.setItem(cleSession, suivant ? '1' : '0'); } catch { /* ignoré */ }
      return suivant;
    });
  }, [cleSession]);

  return [ouvert, basculer];
}

export function BoutonAide({ ouvert, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={ouvert}
            className="lien" style={{ fontSize: 'var(--t-petit)', color: 'var(--encre-secondaire)', textDecoration: 'none' }}>
      <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
      À quoi sert cet écran ?
    </button>
  );
}

export function PanneauAide({ ouvert, children }) {
  const mouvementReduit = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {ouvert && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.2, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div className="encadre" style={{ marginBottom: 'var(--e5)' }}>
            <CircleHelp size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{children}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
