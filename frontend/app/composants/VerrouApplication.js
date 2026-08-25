'use client';
// =====================================================================
//  DJIGUI — verrou d'application de l'espace donneur.
//  Le jeton est persistant (il survit à la fermeture de l'application),
//  mais dès que l'application quitte le premier plan, l'écran se
//  reverrouille : au retour, un mot de passe seul (jamais le numéro)
//  suffit à le lever. Détection par visibilitychange/pagehide, posée
//  ici une seule fois pour tout l'espace donneur.
// =====================================================================
import { useEffect, useState } from 'react';
import { estDeverrouillePourCetteSession, armerVerrou } from '@/lib/api';
import EcranVerrouillage from './EcranVerrouillage';

export default function VerrouApplication({ children }) {
  const [verrouille, setVerrouille] = useState(() => !estDeverrouillePourCetteSession());

  useEffect(() => {
    function surChangement() {
      if (document.visibilityState === 'hidden') {
        // Armé immédiatement : on ne suppose jamais qu'un simple passage
        // en arrière-plan est anodin.
        armerVerrou();
        setVerrouille(true);
      } else if (!estDeverrouillePourCetteSession()) {
        setVerrouille(true);
      }
    }
    function surFermeture() {
      armerVerrou();
    }
    document.addEventListener('visibilitychange', surChangement);
    window.addEventListener('pagehide', surFermeture);
    return () => {
      document.removeEventListener('visibilitychange', surChangement);
      window.removeEventListener('pagehide', surFermeture);
    };
  }, []);

  if (verrouille) {
    return <EcranVerrouillage onDeverrouille={() => setVerrouille(false)} />;
  }
  return children;
}
