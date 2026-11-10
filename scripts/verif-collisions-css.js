/**
 * Détecte les classes CSS définies dans DEUX blocs distincts.
 *
 * Pourquoi ce garde-fou : ce défaut est invisible à la lecture et casse
 * un écran à distance. Quand `.etape` servait à la fois aux étapes
 * numérotées d'un formulaire et aux pastilles du laboratoire, le bloc le
 * plus bas dans le fichier l'emportait — les trois étapes de l'écran des
 * appels au don se repliaient au centre, sans que rien ne le signale. Le
 * même piège a ensuite empilé les pastilles du laboratoire parce que
 * `.frise` existait déjà pour la chronologie de la traçabilité.
 *
 * On ne signale que les collisions de STRUCTURE : deux blocs qui posent
 * tous deux `display`, `flex-direction`, `grid-template-columns` ou
 * `position` sur le même sélecteur simple. Les variations d'état
 * (`:hover`, `--modificateur`, media queries) sont légitimes et
 * volontairement ignorées.
 *
 * Usage : node scripts/verif-collisions-css.js
 */
const fs = require('fs');
const path = require('path');

const FICHIERS = [
  'apps/plateforme/src/app/globals.css',
  'apps/donneur/src/app/globals.css',
];

/** Propriétés qui définissent la mise en page — celles qui font mal. */
const STRUCTURANTES = ['display', 'flex-direction', 'grid-template-columns', 'position'];

/** Retire les blocs @media : une redéfinition responsive est normale. */
function sansMediaQueries(css) {
  let sortie = '';
  let i = 0;
  while (i < css.length) {
    const debut = css.indexOf('@media', i);
    if (debut === -1) { sortie += css.slice(i); break; }
    sortie += css.slice(i, debut);
    // Avancer jusqu'à l'accolade ouvrante, puis équilibrer.
    let j = css.indexOf('{', debut);
    if (j === -1) break;
    let profondeur = 1;
    j++;
    while (j < css.length && profondeur > 0) {
      if (css[j] === '{') profondeur++;
      else if (css[j] === '}') profondeur--;
      j++;
    }
    i = j;
  }
  return sortie;
}

function analyser(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8');
  // Retirer commentaires puis media queries.
  const css = sansMediaQueries(brut.replace(/\/\*[\s\S]*?\*\//g, ''));

  /** sélecteur simple -> [{ ligne, props }] */
  const vus = new Map();
  const regleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = regleRe.exec(css)) !== null) {
    const selecteurs = m[1].trim();
    const corps = m[2];
    const props = STRUCTURANTES.filter((p) => new RegExp(`(^|;|\\s)${p}\\s*:`).test(corps));
    if (props.length === 0) continue;

    for (const sel of selecteurs.split(',').map((s) => s.trim())) {
      // Sélecteur simple d'une seule classe : `.nom` et rien d'autre.
      if (!/^\.[A-Za-z0-9_-]+$/.test(sel)) continue;
      const ligne = css.slice(0, m.index).split('\n').length;
      if (!vus.has(sel)) vus.set(sel, []);
      vus.get(sel).push({ ligne, props });
    }
  }

  const collisions = [];
  for (const [sel, occurrences] of vus) {
    if (occurrences.length < 2) continue;
    // Collision réelle : deux blocs posent la MÊME propriété structurante.
    const parProp = new Map();
    for (const o of occurrences) {
      for (const p of o.props) {
        if (!parProp.has(p)) parProp.set(p, []);
        parProp.get(p).push(o.ligne);
      }
    }
    const enConflit = [...parProp.entries()].filter(([, lignes]) => lignes.length > 1);
    if (enConflit.length > 0) {
      collisions.push({ sel, details: enConflit.map(([p, l]) => `${p} (lignes ${l.join(' et ')})`) });
    }
  }
  return collisions;
}

let total = 0;
for (const f of FICHIERS) {
  const chemin = path.resolve(__dirname, '..', f);
  if (!fs.existsSync(chemin)) continue;
  const collisions = analyser(chemin);
  console.log(`\n${f}`);
  if (collisions.length === 0) {
    console.log('  Aucune collision de classe.');
  } else {
    for (const c of collisions) {
      console.log(`  COLLISION  ${c.sel} — ${c.details.join(', ')}`);
    }
    total += collisions.length;
  }
}

console.log(total
  ? `\n${total} classe(s) définie(s) deux fois : renommer l'une des deux.`
  : '\nAucune classe redéfinie.');
process.exit(total ? 1 : 0);
