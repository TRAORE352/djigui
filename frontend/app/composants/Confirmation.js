'use client';
// DJIGUI — fenêtre de confirmation.
// Elle nomme la personne ou la chose concernée et chiffre la
// conséquence avant que l'action ne soit faite (maquette E28 bis).
// Le retour porte le mot de ce qu'il fait, jamais « Annuler » seul.
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Bouton from './Bouton';

export default function Confirmation({
  ouverte, titre, children, motAction, motRetour = 'Revenir en arrière',
  varianteAction = 'principal', enCours = false, surConfirmer, surAnnuler
}) {
  const mouvementReduit = useReducedMotion();
  return (
    <AnimatePresence>
      {ouverte && (
        <motion.div
          className="voile"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: mouvementReduit ? 0 : 0.15 }}
          onClick={(evenement) => { if (evenement.target === evenement.currentTarget) surAnnuler(); }}
          role="dialog" aria-modal="true"
        >
          <motion.div
            className="fenetre pile-l"
            initial={mouvementReduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={mouvementReduit ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <h2 className="titre">{titre}</h2>
            <div className="pile">{children}</div>
            <div className="rang" style={{ gap: 'var(--e3)' }}>
              <Bouton variante={varianteAction} onClick={surConfirmer}
                      enCours={enCours} motEnCours="En cours">
                {motAction}
              </Bouton>
              <Bouton variante="discret" onClick={surAnnuler} disabled={enCours}>
                {motRetour}
              </Bouton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
