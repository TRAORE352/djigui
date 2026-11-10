/**
 * Banc d'essai de l'écran « Campagnes de don ».
 *
 * Le formulaire : ville en liste déroulante → quartiers → lieu (centre de
 * santé ou saisie libre sur carte) → date → message auto-généré. Plus de
 * pastille « ! », plus de titre d'étape, plus de ciblage par groupe.
 *
 * Les réponses d'API sont simulées (zones, estimation, géocodage), mais
 * toutes les interactions sont réelles.
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
    // Géocodage OpenStreetMap : on simule une réponse pour un nom donné.
    if (u.host === 'nominatim.openstreetmap.org') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { lat: '12.36', lon: '-1.53', display_name: 'École primaire de Gounghin, Ouagadougou' },
        ]) });
    }
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

  const ctx = await nouveauContexte(b, { width: 1440, height: 1000 });
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
  ok(vestiges.etapes === 0, 'plus de titre d\'étape');
  ok(vestiges.pastilles === 0, 'plus aucune pastille « ! »');
  ok(vestiges.modeles === 0 && vestiges.urgences === 0 && vestiges.besoins === 0, 'plus de modèles/urgence/stock');

  // ---- 2. Villes + quartiers ----------------------------------------
  console.log('\n--- 2. Ville -> quartiers');
  await p.selectOption('select', 'Ouagadougou');
  await p.waitForTimeout(400);
  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);

  // ---- 3. Lieu : centres de santé + « Autre lieu » ------------------
  console.log('\n--- 3. Lieu de la collecte');
  const lieux = await p.evaluate(() => {
    const selects = [...document.querySelectorAll('select')];
    const s = selects[selects.length - 1]; // le second select (lieu)
    return [...s.options].map((o) => o.textContent?.trim());
  });
  console.log('  options :', lieux.join(' | '));
  ok(lieux.includes('CHU Yalgado Ouédraogo') && lieux.includes('CSPS de Gounghin'),
    'les centres de santé de la ville sont proposés');
  ok(lieux.includes('Autre lieu…'), 'l\'option « Autre lieu… » existe');
  ok(!lieux.includes('CHU Sourô Sanou'), 'pas de centre d\'une autre ville (Bobo)');

  // ---- 4. Message auto à partir du lieu et de la date ---------------
  console.log('\n--- 4. Message auto');
  const selLieu = await p.evaluate(() => document.querySelectorAll('select').length);
  const lieuSelect = p.locator('select').nth(1);
  await lieuSelect.selectOption('CHU Yalgado Ouédraogo');
  const dansTroisJours = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await p.fill('input[type="date"]', dansTroisJours);
  await p.waitForTimeout(400);
  const auto = await p.evaluate(() => document.querySelector('input[maxlength="200"]')?.value);
  console.log('  message auto :', auto);
  ok(/Collecte de sang le .+ à CHU Yalgado Ouédraogo/.test(auto || ''),
    'le message s\'écrit tout seul avec le lieu et la date');

  // Modifiable : l'agent peut le retoucher.
  await p.fill('input[maxlength="200"]', 'Message corrigé à la main.');
  const corrige = await p.evaluate(() => document.querySelector('input[maxlength="200"]')?.value);
  ok(corrige === 'Message corrigé à la main.', 'le message reste modifiable');

  await capturer(p, `${DIR}/1-formulaire.png`, 1440);

  // ---- 5. « Autre lieu » : carte + recherche -------------------------
  console.log('\n--- 5. Autre lieu (carte)');
  await lieuSelect.selectOption('__libre__');
  await p.waitForTimeout(500);
  const carteVisible = await p.evaluate(() => ({
    conteneur: !!document.querySelector('.carte-lieu'),
    recherche: !!document.querySelector('input[placeholder*="Tapez le nom"]'),
  }));
  console.log(JSON.stringify(carteVisible));
  ok(carteVisible.conteneur && carteVisible.recherche, 'la carte et le champ de recherche apparaissent');

  await p.fill('input[placeholder*="Tapez le nom"]', 'Ecole Gounghin');
  await p.click('button:has-text("Chercher")');
  await p.waitForTimeout(800);
  const resultat = await p.evaluate(() =>
    [...document.querySelectorAll('.lien-action')].map((e) => e.textContent?.trim()).find((t) => t?.includes('École')));
  ok(!!resultat, `le géocodage renvoie un résultat (${resultat})`);

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
  await capturer(pm, `${DIR}/2-mobile.png`, 390);
  await ctxM.close();

  if (erreurs.length) refus.push('Erreur JS : ' + erreurs[0]);
  console.log(refus.length ? `\n${refus.length} PROBLÈME(S) :\n  ` + refus.join('\n  ') : '\nToutes les vérifications passent.');
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();
