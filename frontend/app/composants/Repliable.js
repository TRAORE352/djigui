'use client';
// DJIGUI — section qui se déplie. Le chevron tourne, la hauteur
// s'anime : on voit d'où vient le contenu.
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export default function Repliable({
  titre, apercu, children, ouvertParDefaut = false,
  ouvert: ouvertControle, surBascule
}) {
  const [ouvertInterne, setOuvertInterne] = useState(ouvertParDefaut);
  const mouvementReduit = useReducedMotion();
  // Contrôlable de l'extérieur (ex. se refermer après un envoi réussi) tout
  // en restant autonome par défaut pour les appelants qui ne s'en soucient pas.
  const ouvert = ouvertControle !== undefined ? ouvertControle : ouvertInterne;
  const basculer = () => {
    const suivant = !ouvert;
    if (surBascule) surBascule(suivant);
    if (ouvertControle === undefined) setOuvertInterne(suivant);
  };

  return (
    <div>
      <button
        type="button"
        className="rang-espace"
        onClick={basculer}
        aria-expanded={ouvert}
        style={{
          width: '100%', background: 'none', border: 'none', font: 'inherit',
          color: 'inherit', cursor: 'pointer', padding: 'var(--e3) 0', textAlign: 'left'
        }}
      >
        <span>
          <span style={{ fontWeight: 600, fontSize: 'var(--t-appui)' }}>{titre}</span>
          {apercu && <span className="petit" style={{ display: 'block' }}>{apercu}</span>}
        </span>
        <motion.span
          animate={{ rotate: ouvert ? 180 : 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.18 }}
          style={{ display: 'flex' }}
        >
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: mouvementReduit ? 0 : 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 'var(--e2)', paddingBottom: 'var(--e4)' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
