'use client';
// Gabarit de l'espace de gestion : rail à gauche, contenu à droite.
// Groupe de routes « (espace) » : les écrans authentifiés seulement.
// /gestion/connexion et /gestion/mot-de-passe-oublie restent en dehors,
// ce sont des pages publiques.
// Le pied du rail rappelle le nombre de groupes au niveau critique,
// visible depuis n'importe quel écran de l'espace (règle RG16).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Search, SlidersHorizontal,
  Megaphone, PhoneCall, Users, HeartHandshake, ChartColumn
} from 'lucide-react';
import RailPro from '../../composants/RailPro';
import Etat from '../../composants/Etat';
import { monCompte, lireJeton, tableauDeBordGestion } from '@/lib/api';

const GROUPES = [
  {
    nom: 'Stock',
    entrees: [
      { adresse: '/gestion/tableau-de-bord', mot: 'Tableau de bord', Icone: LayoutDashboard },
      { adresse: '/gestion/poches', mot: 'Poches', Icone: Package },
      { adresse: '/gestion/rechercher-une-poche', mot: 'Rechercher une poche', Icone: Search },
      { adresse: '/gestion/seuils', mot: 'Seuils', Icone: SlidersHorizontal }
    ]
  },
  {
    nom: 'Appels',
    entrees: [
      { adresse: '/gestion/appels', mot: 'Appels au don', Icone: Megaphone },
      { adresse: '/gestion/appels/liste', mot: 'Liste d’appel', Icone: PhoneCall }
    ]
  },
  {
    nom: 'Registre',
    entrees: [
      { adresse: '/gestion/donneurs', mot: 'Donneurs', Icone: Users },
      { adresse: '/gestion/enregistrer-un-don', mot: 'Enregistrer un don', Icone: HeartHandshake },
      { adresse: '/gestion/statistiques', mot: 'Statistiques', Icone: ChartColumn }
    ]
  }
];

export default function GabaritGestion({ children }) {
  const routeur = useRouter();
  const [compte, setCompte] = useState(null);
  const [nbCritiques, setNbCritiques] = useState(null);

  useEffect(() => {
    if (!lireJeton()) { routeur.replace('/gestion/connexion'); return; }
    monCompte()
      .then((resultat) => {
        if (resultat.doit_changer_mot_de_passe) { routeur.replace('/mot-de-passe'); return; }
        if (resultat.role !== 'gestionnaire') { routeur.replace('/gestion/connexion'); return; }
        setCompte(resultat);
      })
      .catch(() => routeur.replace('/gestion/connexion'));
  }, [routeur]);

  useEffect(() => {
    if (!compte) return;
    tableauDeBordGestion()
      .then((resultat) => setNbCritiques(resultat.nb_critiques))
      .catch(() => setNbCritiques(null));
  }, [compte]);

  if (!compte) return null;

  const piedExtra = nbCritiques !== null && (
    <Etat ton={nbCritiques > 0 ? 'sang' : 'neutre'} taille={16}>
      {nbCritiques > 0
        ? `${nbCritiques} groupe${nbCritiques > 1 ? 's' : ''} au niveau critique`
        : 'Aucun groupe au niveau critique'}
    </Etat>
  );

  return (
    <div className="cadre-pro">
      <RailPro titre="Gestion" groupes={GROUPES} compte={compte} piedExtra={piedExtra} />
      <main>{children}</main>
    </div>
  );
}
