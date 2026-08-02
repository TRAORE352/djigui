'use client';
// DJIGUI — enregistre l'agent de service : c'est lui qui rend
// l'application installable sur l'écran d'accueil (écran E12).
import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {
        // L'installation restera possible plus tard : rien à signaler.
      });
    }
  }, []);
  return null;
}
