/**
 * Banc d'essai de l'écran « Campagnes de don ».
 *
 * Le formulaire est épuré : une ville en liste déroulante, les quartiers de
 * cette ville en cases, une date, un message. Plus de pastille « ! », plus de
 * titre d'étape, plus de ciblage par groupe (déterminé au laboratoire).
 *
 * Les réponses d'API sont simulées, mais toutes les interactions sont réelles.
 */
const { lancerNavigateur, contexteFr } = require('./navigateur-banc');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3001';
const DIR = process.argv[2] || '/root/campagne-shots';

const AGENT = {
  id: 'scene-1', nomComplet: 'Compaoré Awa', email: 'awa@exemple.test',
  roles: ['agent_stock', 'agent_accueil'],
  siteId: 'site-1', siteNom: 'Centre de transfusion de Ouagadougou',
};

const ZONES = [
  { id: 'oua-1', nom: 'Dassasgho', ville: 'Ouagadougou' },
  { id: 'oua-2', nom: 'Gounghin', ville: 'Ouagadougou' },
  { id: 'oua-3', nom: 'Kamsonghin', ville: 'Ouagadougou' },
  { id: 'bobo-1', nom: 'Accart-ville', ville: 'Bobo-Dioulasso' },
  { id: 'bobo-2', nom: 'Tounouma', ville: 'Bobo-Dioulasso' },
  { id: 'koud-1', nom: 'Secteur 1', ville: 'Koudougou' },
  { id: 'koud-2', nom: 'Secteur 2', ville: 'Koudougou' },
  { id: 'ouah-1', nom: 'Secteur 1', ville: 'Ouahigouya' },
  { id: 'ouah-2', nom: 'Secteur 2', ville: 'Ouahigouya' },
];

const parZone = 37;

async function nouveauContexte(b, vue) {
  const ctx = await contexteFr(b, { viewport: vue, deviceScaleFactor: 2 });
  await ctx.addInitScript(([a]) => {
    localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
    localStorage.setItem('dds:agent', JSON.stringify(a));
  }, [AGENT]);

  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
    if (u.pathname.includes('/zones')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: ZONES }) });
    }
    if (u.pathname.includes('/alertes/estimation')) {
      const corps = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: { donneursCibles: (corps.zoneIds || []).length * parZone } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: [] }) });
  });
  return ctx;
}

async function capturer(p, chemin, largeur) {
  const h = await p.evaluate(() =>
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  await p.setViewportSize({ width: largeur, height: Math.min(h + 20, 5000) });
  await p.waitForTimeout(400);
  await p.screenshot({ path: chemin });
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await lancerNavigateur();
  const refus = [];
  const ok = (c, m) => { console.log((c ? '  OK  ' : ' ECHEC') + '  ' + m); if (!c) refus.push(m); };

  const ctx = await nouveauContexte(b, { width: 1440, height: 950 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (x) => erreurs.push(x.message.slice(0, 140)));
  await p.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.champ__saisie', { timeout: 30000 });
  await p.waitForTimeout(700);

  // ---- 1. Épuré : ni étape, ni pastille « ! », ni ciblage par groupe ----
  console.log('\n--- 1. Formulaire épuré');
  const vestiges = await p.evaluate(() => ({
    etapes: document.querySelectorAll('.etape').length,
    pastilles: document.querySelectorAll('.aide__pastille').length,
    modeles: document.querySelectorAll('.modele').length,
    urgences: document.querySelectorAll('.urgence').length,
    besoins: document.querySelectorAll('.besoin').length,
  }));
  console.log(JSON.stringify(vestiges));
  ok(vestiges.etapes === 0, 'plus de titre d\'étape (« Où ? », « Quand… »)');
  ok(vestiges.pastilles === 0, 'plus aucune pastille « ! »');
  ok(vestiges.modeles === 0 && vestiges.urgences === 0 && vestiges.besoins === 0,
    'plus de modèles, d\'urgence ni de section « stock réclame »');

  // ---- 2. Liste déroulante des villes -------------------------------
  console.log('\n--- 2. Villes en liste déroulante');
  const villes = await p.evaluate(() =>
    [...document.querySelectorAll('select option')].map((o) => o.textContent?.trim()));
  console.log('  options :', villes.join(' | '));
  ok(villes[0] === 'Choisir une ville', 'la liste part sur « Choisir une ville »');
  ok(villes.includes('Ouagadougou') && villes.includes('Bobo-Dioulasso')
    && villes.includes('Koudougou') && villes.includes('Ouahigouya'),
    'les quatre villes sont proposées');

  // ---- 3. Choisir une ville affiche ses quartiers --------------------
  console.log('\n--- 3. Ville -> quartiers');
  await p.selectOption('select', 'Ouagadougou');
  await p.waitForTimeout(400);
  const quartiersOuaga = await p.evaluate(() =>
    [...document.querySelectorAll('.zones .case span')].map((e) => e.textContent?.trim()));
  console.log('  quartiers Ouaga :', quartiersOuaga.join(', '));
  ok(quartiersOuaga.length === 3, `Ouagadougou affiche ses 3 quartiers (${quartiersOuaga.length})`);

  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);
  const apres = await p.evaluate(() => ({
    cochees: document.querySelectorAll('.case input:checked').length,
    estimation: document.querySelector('.estimation__chiffre')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(apres));
  ok(apres.cochees === 3, `tout sélectionner coche les 3 quartiers d'Ouaga (${apres.cochees})`);
  ok(Number(apres.estimation) === 3 * parZone, `estimation à jour : ${apres.estimation} (attendu ${3 * parZone})`);

  await capturer(p, `${DIR}/1-ville-quartiers.png`, 1440);

  // ---- 4. La sélection s'accumule d'une ville à l'autre --------------
  console.log('\n--- 4. Sélection multi-villes');
  await p.selectOption('select', 'Bobo-Dioulasso');
  await p.waitForTimeout(400);
  await p.click('.case:has-text("Tounouma") input');
  await p.waitForTimeout(900);
  const multi = await p.evaluate(() => ({
    total: document.querySelector('.zones__compte')?.textContent?.trim(),
    estimation: document.querySelector('.estimation__chiffre')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(multi));
  ok(/4 au total/.test(multi.total || ''), `le total cumule les villes (${multi.total})`);
  ok(Number(multi.estimation) === 4 * parZone, `estimation cumule : ${multi.estimation} (attendu ${4 * parZone})`);

  // ---- 5. Date + message + envoi ------------------------------------
  console.log('\n--- 5. Date, message, envoi');
  const dansTroisJours = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await p.fill('input[type="date"]', dansTroisJours);
  await p.fill('input[maxlength="200"]', 'Collecte de sang ce samedi au centre. Votre don peut sauver des vies.');
  await p.waitForTimeout(400);
  const pret = await p.evaluate(() => ({
    avertissement: document.querySelectorAll('.avertissement').length,
    boutonInactif: document.querySelector('.envoi__bouton')?.disabled,
    portee: document.querySelector('.envoi__portee')?.textContent?.trim(),
    boutonTexte: document.querySelector('.envoi__bouton')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(pret));
  ok(pret.avertissement === 0, 'l\'avertissement disparaît une fois tout rempli');
  ok(pret.boutonInactif === false, 'le bouton devient actif');
  ok(/148 donneurs/.test(pret.portee || ''), `la portée est rappelée (${pret.portee})`);
  ok(/Lancer la campagne/.test(pret.boutonTexte || ''), 'le bouton dit « Lancer la campagne »');

  await capturer(p, `${DIR}/2-pret-a-envoyer.png`, 1440);

  // ---- 6. Mobile -----------------------------------------------------
  await ctx.close();
  const ctxM = await nouveauContexte(b, { width: 390, height: 844 });
  const pm = await ctxM.newPage();
  await pm.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await pm.waitForSelector('.champ__saisie', { timeout: 30000 });
  await pm.waitForTimeout(700);
  const mob = await pm.evaluate(() => ({
    debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  console.log('\n--- 6. Mobile', JSON.stringify(mob));
  ok(!mob.debordement, 'aucun débordement horizontal en mobile');
  await capturer(pm, `${DIR}/3-mobile.png`, 390);
  await ctxM.close();

  if (erreurs.length) refus.push('Erreur JS : ' + erreurs[0]);
  console.log(refus.length ? `\n${refus.length} PROBLÈME(S) :\n  ` + refus.join('\n  ') : '\nToutes les vérifications passent.');
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();
