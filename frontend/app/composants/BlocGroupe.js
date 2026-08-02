// DJIGUI — bloc groupe sanguin, élément signature du produit.
// Il ne change jamais de couleur selon l'état : c'est la phrase qui
// porte la différence (maquette donneur, page 8).
// Un groupe encore inconnu porte un tiret, jamais un vide.
export default function BlocGroupe({ groupe, taille = 'm', titre }) {
  return (
    <span
      className={`bloc-groupe taille-${taille}`}
      title={titre || (groupe ? `Groupe ${groupe}` : 'Groupe à préciser au centre')}
      aria-label={groupe ? `Groupe ${groupe}` : 'Groupe sanguin à préciser'}
    >
      {groupe || '\u2014'}
    </span>
  );
}
