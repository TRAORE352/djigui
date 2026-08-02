// DJIGUI — remplace toute adresse morte du rail professionnel : l'écran
// existe déjà dans la navigation, il n'est simplement pas encore construit.
import { Construction } from 'lucide-react';

export default function EcranEnConstruction({ titre, suite }) {
  return (
    <div className="contenu-formulaire pile-l">
      <div className="entete-ecran">
        <h1 className="titre-grand">{titre}</h1>
      </div>
      <div className="etat-vide pile-s">
        <p className="lead" style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
          <Construction size={20} strokeWidth={1.75} aria-hidden="true" />
          Écran en construction
        </p>
        <p className="appui">
          {suite || 'Cet écran n’est pas encore construit. Il arrivera dans une prochaine étape du projet.'}
        </p>
      </div>
    </div>
  );
}
