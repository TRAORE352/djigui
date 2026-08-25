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
    // Demande au navigateur de ne pas évincer le stockage de
    // l'application sous pression mémoire (le jeton de session vit en
    // localStorage). Purement best-effort : Chrome/Android l'accorde le
    // plus souvent une fois l'app installée et utilisée ; Safari/iOS
    // n'offre aucune garantie équivalente côté web, quoi que fasse le
    // code — une limite de la plateforme, pas de l'application.
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);
  return null;
}
