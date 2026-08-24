'use client';
// =====================================================================
//  DJIGUI — panneau d'information de l'accueil (E1).
//  Feuille qui remonte du bas sur téléphone, fenêtre centrée à partir
//  de 640 px : même composant, seule la position change en CSS. Fermeture
//  par l'overlay, le bouton, ou Échap ; le défilement de la page est
//  bloqué tant qu'il est ouvert.
// =====================================================================
import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export default function PanneauInfo({ ouvert, onFermer, titre, children }) {
  const mouvementReduit = useReducedMotion();
  const idTitre = useId();
  const panneauRef = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    const debordementPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panneauRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = debordementPrecedent;
    };
  }, [ouvert, onFermer]);

  return (
    <AnimatePresence>
      {ouvert && (
        <motion.div
          className="panneau-voile"
          onClick={onFermer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.2, ease: 'easeOut' }}
        >
          <motion.div
            ref={panneauRef}
            className="panneau-feuille"
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitre}
            tabIndex={-1}
            onClick={(evenement) => evenement.stopPropagation()}
            initial={mouvementReduit ? { opacity: 0 } : { opacity: 0, y: 56 }}
            animate={{ opacity: 1, y: 0 }}
            exit={mouvementReduit ? { opacity: 0 } : { opacity: 0, y: 56 }}
            transition={{ duration: mouvementReduit ? 0.15 : 0.32, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <span className="panneau-poignee" aria-hidden="true" />
            <div className="panneau-entete">
              <h2 id={idTitre} className="panneau-titre">{titre}</h2>
              <button type="button" className="panneau-fermer" onClick={onFermer} aria-label="Fermer">
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="panneau-corps pile-xl">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
