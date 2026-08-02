// DJIGUI — mise en forme. Une seule source pour tout le produit :
// une date ne s'écrit jamais de deux façons différentes selon l'écran.

// Date longue, pour le donneur : 12 avril 2026.
export function dateLongue(valeur) {
  if (!valeur) return '';
  return new Intl.DateTimeFormat('fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(valeur));
}

// Date courte en chasse fixe, pour les registres : 12.04.2026.
export function dateCourte(valeur) {
  if (!valeur) return '';
  const date = new Date(valeur);
  const deuxChiffres = (nombre) => String(nombre).padStart(2, '0');
  return `${deuxChiffres(date.getDate())}.${deuxChiffres(date.getMonth() + 1)}.${date.getFullYear()}`;
}

// Date et heure : 30.07.2026 · 08h20.
export function dateHeure(valeur) {
  if (!valeur) return '';
  const date = new Date(valeur);
  const deuxChiffres = (nombre) => String(nombre).padStart(2, '0');
  return `${dateCourte(date)} \u00b7 ${deuxChiffres(date.getHours())}h${deuxChiffres(date.getMinutes())}`;
}

// Numéro groupé deux par deux, pour être composé ou dicté sans erreur.
export function numeroLisible(numero) {
  const chiffres = String(numero || '').replace(/\D/g, '').replace(/^226/, '');
  if (chiffres.length !== 8) return numero || '';
  return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

// Accord simple : 1 jour, 2 jours.
export function pluriel(nombre, singulier, plurielMot) {
  return `${nombre} ${nombre > 1 ? (plurielMot || `${singulier}s`) : singulier}`;
}

// Ancienneté en toutes lettres, pour l'en-tête des registres pro :
// « à l'instant », « il y a 12 minutes », « il y a 3 heures ».
export function ancienneteDepuis(valeur) {
  if (!valeur) return '';
  const minutes = Math.floor((Date.now() - new Date(valeur).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${pluriel(minutes, 'minute')}`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${pluriel(heures, 'heure')}`;
  const jours = Math.floor(heures / 24);
  return `il y a ${pluriel(jours, 'jour')}`;
}

export const ORDRE_GROUPES = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];
