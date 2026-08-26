'use client';
// Gabarit de l'espace donneur. La garde de session évite d'afficher un
// écran vide à un visiteur non connecté ; le vrai contrôle des droits
// reste côté serveur, à chaque appel (règle C4).
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import BarreNavigation from '../composants/BarreNavigation';
import VerrouApplication from '../composants/VerrouApplication';
import InvitesInstallation from '../composants/InvitesInstallation';
import { lireJeton, tracerDemarrage } from '@/lib/api';

export default function GabaritDonneur({ children }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    // Mouchard temporaire (diagnostic du bug de déconnexion inattendue) :
    // dit si le jeton était déjà absent à ce réveil de l'application,
    // avant même de savoir s'il faut rediriger vers la connexion.
    tracerDemarrage();
    if (!lireJeton()) routeur.replace('/connexion');
    else setPret(true);
  }, [routeur]);

  if (!pret) return null;
  // E7 et E8 sont une pile au-dessus de E6 (la liste des alertes) : pas
  // de barre du bas, seules les quatre sections principales l'ont.
  const masquerBarre = chemin.startsWith('/alertes/') && chemin !== '/alertes';
  return (
    <VerrouApplication>
      {children}
      {!masquerBarre && <BarreNavigation />}
      <InvitesInstallation />
    </VerrouApplication>
  );
}
