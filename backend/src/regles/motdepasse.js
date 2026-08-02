// =====================================================================
//  DJIGUI — exigences et force des mots de passe.
//  Les exigences professionnelles viennent de l'écran E14, qui les
//  affiche AVANT la saisie : huit points, jamais découverts après un refus.
//  La longueur minimale vient de la table parametre (règle RG33).
// =====================================================================

// Contrôle d'un mot de passe professionnel. Renvoie la liste des
// exigences non tenues, écrites comme à l'écran.
function verifierMotDePassePro(motDePasse, longueurMin, nomAgent, nomCentre) {
  const manques = [];
  const valeur = String(motDePasse || '');
  if (valeur.length < longueurMin) {
    manques.push(`${longueurMin} caractères au minimum.`);
  }
  if (!/[a-zà-ÿ]/.test(valeur) || !/[A-ZÀ-Ý]/.test(valeur)) {
    manques.push('Une majuscule et une minuscule.');
  }
  if (!/\d/.test(valeur)) {
    manques.push('Un chiffre.');
  }
  const enMinuscules = valeur.toLowerCase();
  const contientNom = (texte) =>
    texte && String(texte).length >= 4 && enMinuscules.includes(String(texte).toLowerCase());
  if (contientNom(nomAgent) || contientNom(nomCentre)) {
    manques.push('Ni le nom de l\u2019agent, ni le nom du centre.');
  }
  return manques;
}

// Force sur quatre niveaux, doublée d'un mot (E14, EC2, E32) : la
// couleur n'est jamais seule porteuse du sens.
function evaluerForce(motDePasse) {
  const valeur = String(motDePasse || '');
  let points = 0;
  if (valeur.length >= 8) points += 1;
  if (valeur.length >= 12) points += 1;
  if (/[a-zà-ÿ]/.test(valeur) && /[A-ZÀ-Ý]/.test(valeur)) points += 1;
  if (/\d/.test(valeur)) points += 1;
  if (/[^\w\s]/.test(valeur)) points += 1;
  const niveau = Math.min(points, 4);
  const mots = ['trop faible', 'faible', 'moyenne', 'solide', 'suffisante'];
  return { niveau, mot: mots[niveau] };
}

// Mot de passe provisoire lisible à voix haute (E27 bis) : trois blocs
// de quatre caractères, sans lettre ni chiffre confondables (0/O, 1/l/I).
function engendrerProvisoire() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const crypto = require('node:crypto');
  const bloc = () => {
    let sortie = '';
    for (let indice = 0; indice < 4; indice += 1) {
      sortie += alphabet[crypto.randomInt(alphabet.length)];
    }
    return sortie;
  };
  return `${bloc()}-${bloc()}-${bloc()}`;
}

module.exports = { verifierMotDePassePro, evaluerForce, engendrerProvisoire };
