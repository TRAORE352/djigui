/**
 * Banc d'essai de l'écran « Campagnes de don » (ex-« Appels au don »).
 *
 * Le modèle a changé : l'agent lance une campagne de don de sang, qui cible
 * TOUS les donneurs éligibles de la zone. Il choisit la zone, la date de
 * collecte et le message — plus de groupe sanguin, d'urgence ni d'objectif.
 * Le groupe est déterminé au laboratoire, après le prélèvement.
 *
 * Les réponses d'API sont simulées, mais toutes les interactions sont
 * réelles : cocher, tout sélectionner, saisir la date et le message,
 * envoyer.
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
  { id: 'z1', nom: 'Dassasgho', ville: 'Ouagadougou' },
  { id: 'z2', nom: 'Gounghin', ville: 'Ouagadougou' },
  { id: 'z3', nom: 'Kamsonghin', ville: 'Ouagadougou' },
  { id: 'z4', nom: 'Koulouba', ville: 'Ouagadougou' },
  { id: 'z5', nom: 'Paspanga', ville: 'Ouagadougou' },
  { id: 'z6', nom: 'Tanghin', ville: 'Ouagadougou' },
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
  await p.waitForSelector('.zones', { timeout: 30000 });
  await p.waitForTimeout(700);

  // ---- 1. Deux étapes, pas trois -----------------------------------
  console.log('\n--- 1. Structure du formulaire');
  const etapes = await p.evaluate(() =>
    [...document.querySelectorAll('.etape')].map((e) => e.querySelector('.etape__titre')?.textContent?.trim()));
  console.log('  étapes :', etapes.join(' | '));
  ok(etapes.length === 2, `deux étapes (${etapes.length})`);

  // ---- 2. Plus rien du ciblage par groupe ---------------------------
  console.log('\n--- 2. Absence du ciblage par groupe');
  const vestiges = await p.evaluate(() => ({
    modeles: document.querySelectorAll('.modele').length,
    urgences: document.querySelectorAll('.urgence').length,
    selects: document.querySelectorAll('select').length,
    besoins: document.querySelectorAll('.besoin').length,
  }));
  console.log(JSON.stringify(vestiges));
  ok(vestiges.modeles === 0, 'plus de modèles par groupe');
  ok(vestiges.urgences === 0, 'plus de sélecteur d\'urgence');
  ok(vestiges.selects === 0, 'plus de liste « groupe à mentionner »');
  ok(vestiges.besoins === 0, 'plus de section « ce que le stock réclame »');

  // ---- 3. Sélection des quartiers + estimation ----------------------
  console.log('\n--- 3. Zones et estimation');
  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);
  const toutes = await p.evaluate(() => ({
    cochees: document.querySelectorAll('.case input:checked').length,
    estimation: document.querySelector('.estimation__chiffre')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(toutes));
  ok(toutes.cochees === ZONES.length, `tout sélectionner coche ${ZONES.length} quartiers (${toutes.cochees})`);
  ok(Number(toutes.estimation) === ZONES.length * parZone, `estimation à jour : ${toutes.estimation} (attendu ${ZONES.length * parZone})`);

  // ---- 4. Avertissement avant de tout remplir -----------------------
  console.log('\n--- 4. Avertissement');
  const avant = await p.evaluate(() => ({
    avertissement: document.querySelector('.avertissement')?.textContent?.trim(),
    boutonInactif: document.querySelector('.envoi__bouton')?.disabled,
  }));
  console.log(JSON.stringify(avant));
  ok(/date/.test(avant.avertissement || '') && /message/.test(avant.avertissement || ''),
    `l'avertissement nomme la date et le message (${avant.avertissement})`);
  ok(avant.boutonInactif === true, 'le bouton reste inactif tant que tout n\'est pas rempli');

  await capturer(p, `${DIR}/1-zones-choisies.png`, 1440);

  // ---- 5. Date + message --------------------------------------------
  console.log('\n--- 5. Date et message');
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
  ok(/donneurs/.test(pret.portee || ''), `la portée est rappelée (${pret.portee})`);
  ok(/Lancer la campagne/.test(pret.boutonTexte || ''), `le bouton dit « Lancer la campagne » (${pret.boutonTexte})`);

  await capturer(p, `${DIR}/2-pret-a-envoyer.png`, 1440);

  // ---- 6. Mobile -----------------------------------------------------
  await ctx.close();
  const ctxM = await nouveauContexte(b, { width: 390, height: 844 });
  const pm = await ctxM.newPage();
  await pm.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await pm.waitForSelector('.zones', { timeout: 30000 });
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
