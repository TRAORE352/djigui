// =====================================================================
//  DJIGUI — compatibilité des groupes sanguins (annexe D).
//  Clé : groupe du receveur. Valeur : groupes de donneurs acceptés.
//  Sert au ciblage élargi d'un appel au don (règle RG8).
//  À valider par un responsable du centre avant mise en service.
// =====================================================================

const GROUPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

// Ordre d'affichage imposé par le tableau de bord E16, identique sur
// tous les écrans (positifs puis négatifs).
const ORDRE_AFFICHAGE = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];

const COMPATIBILITE = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

function groupesCompatibles(groupeReceveur) {
  return COMPATIBILITE[groupeReceveur] || [];
}

// Vrai si le groupe demandé n'a aucun substitut : E18 grise alors le
// choix « groupes compatibles » et écrit la raison.
function sansSubstitut(groupe) {
  return groupesCompatibles(groupe).length <= 1;
}

module.exports = { GROUPES, ORDRE_AFFICHAGE, COMPATIBILITE, groupesCompatibles, sansSubstitut };
