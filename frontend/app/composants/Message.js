'use client';
// DJIGUI — message d'erreur ou de réussite.
// Une erreur dit ce qui s'est passé et quoi faire. Elle ne s'excuse
// pas, elle ne nomme jamais le système.
import { motion, AnimatePresence } from 'motion/react';
import { TriangleAlert, Check } from 'lucide-react';

export function MessageErreur({ children }) {
  return (
    <AnimatePresence>
      {children && (
        <motion.p
          className="message-erreur"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
          <span>{children}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function MessageReussite({ children }) {
  return (
    <AnimatePresence>
      {children && (
        <motion.p
          className="etat etat-seve"
          role="status"
          style={{ fontSize: 'var(--t-appui)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Check size={18} strokeWidth={2} aria-hidden="true" />
          <span>{children}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
