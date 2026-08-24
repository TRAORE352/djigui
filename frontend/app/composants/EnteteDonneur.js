'use client';
// DJIGUI — en-tête léger des écrans donneur sans héro propre (Alertes,
// Mes dons) : le titre de l'écran à gauche, l'accès au compte à droite,
// toujours au même endroit. Ma carte l'obtient autrement, dans son
// bandeau dégradé — même icône (IconeProfil), même destination.
import IconeProfil from './IconeProfil';

export default function EnteteDonneur({ titre, elementTitre: Titre = 'h1' }) {
  return (
    <div className="rang-espace">
      <Titre className="titre">{titre}</Titre>
      <IconeProfil />
    </div>
  );
}
