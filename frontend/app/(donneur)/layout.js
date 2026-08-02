'use client';
// Gabarit de l'espace donneur. La garde de session évite d'afficher un
// écran vide à un visiteur non connecté ; le vrai contrôle des droits
// reste côté serveur, à chaque appel (règle C4).
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import BarreNavigation from '../composants/BarreNavigation';
import { lireJeton } from '@/lib/api';

export default function GabaritDonneur({ children }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!lireJeton()) routeur.replace('/connexion');
    else setPret(true);
  }, [routeur]);

  if (!pret) return null;
  // E7 et E8 sont une pile au-dessus de E6 (la liste des alertes) : pas
  // de barre du bas, seules les quatre sections principales l'ont.
  const masquerBarre = chemin.startsWith('/alertes/') && chemin !== '/alertes';
  return (
    <>
      {children}
      {!masquerBarre && <BarreNavigation />}
    </>
  );
}
