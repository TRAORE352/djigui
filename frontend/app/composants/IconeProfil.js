'use client';
// DJIGUI — accès au compte, depuis n'importe quel écran donneur.
// Même icône que portait l'ancien onglet « Compte » de la barre basse,
// pour que le repère visuel ne change pas de sens.
import Link from 'next/link';
import { UserRound } from 'lucide-react';

export default function IconeProfil({ clair = false, className = '' }) {
  return (
    <Link
      href="/compte"
      aria-label="Mon compte"
      className={`icone-profil ${clair ? 'icone-profil-clair' : ''} ${className}`.trim()}
    >
      <UserRound size={22} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
