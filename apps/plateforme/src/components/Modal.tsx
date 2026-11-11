"use client";
/**
 * Fenêtre plein écran : remplit l'écran du poste, avec un en-tête (titre
 * optionnel + bouton fermer) et un corps défilant. Utilisée pour l'historique
 * des délivrances et pour le reçu.
 */
import { X } from "lucide-react";

export default function Modal({ titre, surFermer, children }: {
  titre?: string;
  surFermer: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={titre ?? "Fenêtre"}>
      <div className="modal__fond" onClick={surFermer} />
      <div className="modal__panneau">
        <div className="modal__entete">
          {titre ? <h2 className="modal__titre">{titre}</h2> : <span />}
          <button type="button" className="modal__fermer" onClick={surFermer} aria-label="Fermer">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="modal__corps">{children}</div>
      </div>
    </div>
  );
}
