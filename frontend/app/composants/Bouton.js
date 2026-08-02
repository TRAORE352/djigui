'use client';
// DJIGUI — bouton.
// Pendant l'attente, il garde sa place, sa taille et son libellé au
// présent : l'écran ne se vide pas, aucun voile gris n'apparaît
// (maquette gestion, état G).
import { motion, useReducedMotion } from 'motion/react';
import { Loader2 } from 'lucide-react';

export default function Bouton({
  variante = 'principal', large = false, compact = false,
  enCours = false, motEnCours, enfantIcone: Icone, children, ...reste
}) {
  const mouvementReduit = useReducedMotion();
  const classes = [
    'bouton', `bouton-${variante}`,
    large ? 'bouton-large' : '', compact ? 'bouton-compact' : ''
  ].filter(Boolean).join(' ');

  return (
    <motion.button
      type="button"
      className={classes}
      whileTap={mouvementReduit || reste.disabled ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.1 }}
      disabled={reste.disabled || enCours}
      {...reste}
    >
      {enCours ? (
        <>
          <Loader2 size={18} strokeWidth={2} className="tourne" aria-hidden="true" />
          {motEnCours || 'En cours'}
        </>
      ) : (
        <>
          {Icone && <Icone size={18} strokeWidth={1.75} aria-hidden="true" />}
          {children}
        </>
      )}
      <style jsx>{`
        :global(.tourne) { animation: tourner 900ms linear infinite; }
        @keyframes tourner { to { transform: rotate(360deg); } }
      `}</style>
    </motion.button>
  );
}
