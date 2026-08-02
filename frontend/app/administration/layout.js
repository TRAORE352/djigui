'use client';
// Gabarit de l'espace d'administration : rail à gauche, contenu à
// droite. Le rail nomme la personne connectée : sur un poste partagé,
// on doit savoir sous quel nom on travaille.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound, Building2, SlidersHorizontal, ScrollText, KeyRound } from 'lucide-react';
import RailPro from '../composants/RailPro';
import { monCompte, lireJeton } from '@/lib/api';

const GROUPES = [
  {
    nom: 'Accès',
    entrees: [
      { adresse: '/administration/comptes', mot: 'Comptes', Icone: UsersRound },
      { adresse: '/administration/structures-et-zones', mot: 'Structures et zones', Icone: Building2 }
    ]
  },
  {
    nom: 'Système',
    entrees: [
      { adresse: '/administration/parametres', mot: 'Paramètres', Icone: SlidersHorizontal },
      { adresse: '/administration/journal', mot: 'Journal d\u2019activité', Icone: ScrollText },
      { adresse: '/administration/mon-mot-de-passe', mot: 'Mon mot de passe', Icone: KeyRound }
    ]
  }
];

export default function GabaritAdministration({ children }) {
  const routeur = useRouter();
  const [compte, setCompte] = useState(null);

  useEffect(() => {
    if (!lireJeton()) { routeur.replace('/gestion/connexion'); return; }
    monCompte()
      .then((resultat) => {
        if (resultat.doit_changer_mot_de_passe) { routeur.replace('/mot-de-passe'); return; }
        if (resultat.role !== 'admin') { routeur.replace('/gestion/connexion'); return; }
        setCompte(resultat);
      })
      .catch(() => routeur.replace('/gestion/connexion'));
  }, [routeur]);

  if (!compte) return null;

  return (
    <div className="cadre-pro">
      <RailPro titre="Administration" groupes={GROUPES} compte={compte} />
      <main>{children}</main>
    </div>
  );
}
