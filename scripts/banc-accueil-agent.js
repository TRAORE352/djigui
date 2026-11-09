/**
 * Banc d'essai de l'écran « Accueil et prélèvement ».
 *
 * On éprouve les états réels de l'agent au guichet :
 *   1. repos — bannière ouverte, aucun donneur affiché ;
 *   2. instructions masquées — on CLIQUE sur « Masquer », on mesure la
 *      hauteur récupérée, et on vérifie que le choix survit au rechargement ;
 *   3. donneur trouvé — l'état vide doit avoir cédé la place à la fiche.
 *
 * Les réponses d'API sont simulées : c'est un banc DESIGN. Mais les
 * interactions (clic, saisie, soumission) sont réelles, et les mesures
 * sont lues dans le DOM, pas estimées.
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3101';
const DIR = process.argv[2] || '/root/accueil-apres';

const AGENT = {
  id: 'scene-1', nomComplet: 'Compaoré Awa', email: 'awa@exemple.test',
  roles: ['agent_accueil', 'agent_labo', 'agent_stock'],
  siteId: 'site-1', siteNom: 'Centre de transfusion de Ouagadougou',
};

const DONNEUR = {
  id: 'd1', numeroDonneur: 'DN-2026-00418', nom: 'OUÉDRAOGO', prenom: 'Salimata',
  sexe: 'F', dateNaissance: '1994-03-12', telephone: '+22670112233',
  groupeSanguin: 'O-', actif: true, enPause: false, origine: 'application',
  zone: { id: 'z1', nom: 'Gounghin', ville: 'Ouagadougou' },
};

async function nouveauContexte(b, vue, options = {}) {
  const ctx = await b.newContext({ viewport: vue, deviceScaleFactor: 2 });
  await ctx.addInitScript(([a, prefs]) => {
    localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
    localStorage.setItem('dds:agent', JSON.stringify(a));
    for (const [k, v] of Object.entries(prefs)) localStorage.setItem(k, v);
  }, [AGENT, options.prefs || {}]);

  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
    if (u.pathname.includes('/zones')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: [{ id: 'z1', nom: 'Gounghin', ville: 'Ouagadougou' }] }) });
    }
    if (u.pathname.includes('/donneurs')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: DONNEUR }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: [] }) });
  });
  return ctx;
}

/** Hauteur totale du document : ce que coûte réellement la page. */
const hauteur = (p) => p.evaluate(() =>
  Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));

/**
 * Hauteur occupée par le bandeau, marge comprise.
 * On ne mesure PAS `scrollHeight` du document : quand la page tient dans
 * la fenêtre, il plafonne à la hauteur du viewport et n'enregistre aucun
 * gain, même réel. C'est l'élément qu'il faut mesurer.
 */
const hauteurBanniere = (p) => p.evaluate(() => {
  const e = document.querySelector('.explication');
  if (!e) return 0;
  const r = e.getBoundingClientRect();
  const s = getComputedStyle(e);
  return Math.round(r.height + parseFloat(s.marginTop) + parseFloat(s.marginBottom));
});

async function capturer(p, chemin, largeur) {
  const h = await hauteur(p);
  await p.setViewportSize({ width: largeur, height: Math.min(h + 20, 4000) });
  await p.waitForTimeout(400);
  await p.screenshot({ path: chemin });
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const refus = [];
  const ok = (c, m) => { console.log((c ? '  OK  ' : ' ECHEC') + '  ' + m); if (!c) refus.push(m); };

  // ---- 1. Repos, bannière ouverte ----------------------------------
  let ctx = await nouveauContexte(b, { width: 1440, height: 950 });
  let p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (x) => erreurs.push(x.message.slice(0, 120)));
  await p.goto(`${BASE}/agent/accueil`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.recherche-donneur', { timeout: 30000 });
  await p.waitForTimeout(600);

  console.log('\n--- 1. Repos (bannière ouverte)');
  const hOuvert = await hauteurBanniere(p);
  const etat1 = await p.evaluate(() => ({
    titre: document.querySelector('.contenu__titre')?.textContent?.trim(),
    chapeau: !!document.querySelector('.contenu__chapeau'),
    actionEntete: document.querySelector('.contenu__entete .bouton')?.textContent?.trim(),
    actionPleine: document.querySelector('.contenu__entete .bouton')?.classList.contains('bouton--principal'),
    hauteurSaisie: Math.round(document.querySelector('.recherche-donneur__saisie').getBoundingClientRect().height),
    boutonRechercher: document.querySelector('.recherche-donneur__bouton')?.textContent?.trim(),
    rechercherPlein: document.querySelector('.recherche-donneur__bouton')?.classList.contains('bouton--principal'),
    rechercherInactif: document.querySelector('.recherche-donneur__bouton')?.disabled,
    banniere: !!document.querySelector('.explication__role'),
    masquer: !!document.querySelector('.explication__bascule'),
    videPointille: getComputedStyle(document.querySelector('.etat-vide')).borderStyle,
    videRayon: getComputedStyle(document.querySelector('.etat-vide')).borderRadius,
    focusAuto: document.activeElement?.id,
  }));
  console.log(JSON.stringify(etat1, null, 2));
  ok(etat1.titre === 'Accueil et prélèvement', 'le titre est conservé');
  ok(etat1.chapeau, 'la description sous le titre est conservée');
  ok(etat1.actionEntete === 'Inscrire sur place' && etat1.actionPleine, 'action d\'en-tête en bouton plein');
  ok(etat1.hauteurSaisie >= 54, `champ de saisie confortable (${etat1.hauteurSaisie}px)`);
  ok(etat1.rechercherPlein, 'bouton Rechercher en style principal plein');
  ok(etat1.rechercherInactif === true, 'Rechercher inactif tant que les 8 chiffres manquent');
  ok(etat1.masquer, 'les instructions sont masquables');
  ok(etat1.videRayon === '12px', `état vide arrondi à 12px (vu ${etat1.videRayon})`);
  ok(etat1.videPointille === 'solid', `état vide sans pointillé austère (vu ${etat1.videPointille})`);
  ok(etat1.focusAuto === 'numero-donneur', 'le curseur est déjà dans le champ');

  // Alignement du bouton sur le champ : un écart de quelques pixels se
  // voit, et une mesure l'attrape mieux que l'œil.
  const alignement = await p.evaluate(() => {
    const s = document.querySelector('.recherche-donneur__saisie').getBoundingClientRect();
    const b = document.querySelector('.recherche-donneur__bouton').getBoundingClientRect();
    return { haut: Math.round(b.top - s.top), bas: Math.round(b.bottom - s.bottom) };
  });
  ok(Math.abs(alignement.haut) <= 2 && Math.abs(alignement.bas) <= 2,
    `bouton aligné sur le champ (écart haut ${alignement.haut}px, bas ${alignement.bas}px)`);
  await capturer(p, `${DIR}/1-repos.png`, 1440);

  // ---- 2. Focus visible --------------------------------------------
  await p.setViewportSize({ width: 1440, height: 950 });
  await p.click('#numero-donneur');
  await p.waitForTimeout(250);
  const focus = await p.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.recherche-donneur__saisie'));
    return { ombre: s.boxShadow, bordure: s.borderColor };
  });
  console.log('\n--- 2. Focus', JSON.stringify(focus));
  ok(focus.ombre !== 'none', 'anneau de focus net sur le champ');

  // ---- 3. Masquer les instructions ---------------------------------
  console.log('\n--- 3. Masquer les instructions');
  await p.click('.explication__bascule');
  await p.waitForTimeout(400);
  const hReplie = await hauteurBanniere(p);
  const etat3 = await p.evaluate(() => ({
    replie: !!document.querySelector('.explication--replie'),
    resume: document.querySelector('.explication__resume')?.textContent?.trim(),
    rouvrir: document.querySelector('.explication__bascule')?.textContent?.trim(),
    memoire: localStorage.getItem('dds:explication:accueil'),
  }));
  console.log(JSON.stringify(etat3, null, 2));
  ok(etat3.replie, 'la bannière passe en mode replié');
  ok(etat3.memoire === 'replie', 'le choix est mémorisé sur le poste');
  ok(hReplie < hOuvert, `hauteur du bandeau : ${hOuvert}px -> ${hReplie}px (${hOuvert - hReplie}px rendus à la zone de travail)`);
  await capturer(p, `${DIR}/2-instructions-masquees.png`, 1440);
  await ctx.close();

  // ---- 4. La préférence survit au rechargement ---------------------
  console.log('\n--- 4. Après rechargement');
  ctx = await nouveauContexte(b, { width: 1440, height: 950 }, { prefs: { 'dds:explication:accueil': 'replie' } });
  p = await ctx.newPage();
  await p.goto(`${BASE}/agent/accueil`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.recherche-donneur', { timeout: 30000 });
  await p.waitForTimeout(600);
  ok(await p.locator('.explication--replie').count() === 1, 'la bannière reste repliée au retour sur l\'écran');

  // ---- 5. Donneur trouvé : l'état vide cède la place ---------------
  console.log('\n--- 5. Recherche d\'un donneur');
  await p.fill('#numero-donneur', '70112233');
  const actifApres = await p.evaluate(() => !document.querySelector('.recherche-donneur__bouton').disabled);
  ok(actifApres, 'Rechercher devient actif à 8 chiffres');
  await p.click('.recherche-donneur__bouton');
  await p.waitForSelector('.bloc-groupe', { timeout: 20000 });
  await p.waitForTimeout(500);
  const etat5 = await p.evaluate(() => ({
    etatVideEncore: document.querySelectorAll('.etat-vide').length,
    nom: document.querySelector('.titre-s')?.textContent?.trim(),
    groupe: document.querySelector('.bloc-groupe')?.textContent?.trim(),
    actions: [...document.querySelectorAll('.bouton')].map((e) => e.textContent.trim()).slice(0, 6),
  }));
  console.log(JSON.stringify(etat5, null, 2));
  ok(etat5.etatVideEncore === 0, 'l\'état vide a cédé la place à la fiche');
  ok(/Salimata/.test(etat5.nom || ''), 'la fiche du donneur est affichée');
  await capturer(p, `${DIR}/3-donneur-trouve.png`, 1440);
  await ctx.close();

  // ---- 6. Mobile ---------------------------------------------------
  console.log('\n--- 6. Mobile');
  ctx = await nouveauContexte(b, { width: 390, height: 844 });
  p = await ctx.newPage();
  await p.goto(`${BASE}/agent/accueil`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.recherche-donneur', { timeout: 30000 });
  await p.waitForTimeout(600);

  // Un texte comprimé en colonne d'un mot est illisible. On le détecte
  // par sa largeur occupée, pas à l'œil : sous ~55 % de la largeur du
  // bandeau, le paragraphe est écrasé.
  const mobile = await p.evaluate(() => {
    const ban = document.querySelector('.explication').getBoundingClientRect();
    const txt = document.querySelector('.explication__role').getBoundingClientRect();
    const saisie = document.querySelector('.recherche-donneur__saisie').getBoundingClientRect();
    return {
      partTexte: Math.round((txt.width / ban.width) * 100),
      hauteurRole: Math.round(txt.height),
      saisiePleineLargeur: Math.round(saisie.width),
      largeurBandeau: Math.round(ban.width),
    };
  });
  console.log(JSON.stringify(mobile, null, 2));
  ok(mobile.partTexte >= 70,
    `le texte du bandeau occupe ${mobile.partTexte}% de la largeur (pas comprimé en colonne)`);
  ok(mobile.saisiePleineLargeur > 250, `champ de saisie large en mobile (${mobile.saisiePleineLargeur}px)`);
  await capturer(p, `${DIR}/4-mobile.png`, 390);
  await ctx.close();

  if (erreurs.length) refus.push('Erreur JS : ' + erreurs[0]);
  console.log(refus.length ? `\n${refus.length} PROBLÈME(S) :\n  ` + refus.join('\n  ') : '\nToutes les vérifications passent.');
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();
