/**
 * Parcours réel dans la plateforme : on remplit, on clique, on vérifie.
 * Rien n'est simulé — l'application parle au vrai backend.
 *
 * Usage : node scripts/parcours-cnts.js <sortie-dir>
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CODE_POCHE = process.env.CODE_POCHE || 'OUA-26-00003-J';

(async () => {
  const [dir = '/root/cnts-parcours'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [donnees.jeton, JSON.stringify(donnees.utilisateur)]);

  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push('PAGEERROR ' + e.message.slice(0, 160)));

  const etape = async (nom, fn) => {
    await fn();
    await p.screenshot({ path: `${dir}/${nom}.png`, fullPage: true });
    console.log('✓', nom);
  };

  // 1. Traçabilité : consulter une vraie poche.
  await etape('1-tracabilite-fiche', async () => {
    await p.goto(`${BASE}/agent/tracabilite`, { waitUntil: 'networkidle' });
    await p.fill('input[placeholder="OUA-26-04812-K"]', CODE_POCHE);
    await p.click('button[type=submit]');
    await p.waitForSelector('.frise__etape', { timeout: 15000 });
  });

  // 2. Laboratoire : la file d'attente contient la poche prélevée.
  await etape('2-labo-file', async () => {
    await p.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
  });

  // 3. Accueil : rechercher un donneur inexistant → l'écran doit proposer
  //    l'inscription sur place, pas afficher une erreur brute.
  await etape('3-accueil-inconnu', async () => {
    await p.goto(`${BASE}/agent/accueil`, { waitUntil: 'networkidle' });
    await p.fill('input[placeholder="70 00 00 00"]', '79999999');
    await p.click('button[type=submit]');
    await p.waitForTimeout(2500);
  });

  // 4. Accueil : formulaire d'inscription sur place ouvert.
  await etape('4-accueil-inscription', async () => {
    await p.click('text=Inscrire ce donneur');
    await p.waitForSelector('text=Inscrire un donneur sur place', { timeout: 10000 });
    await p.waitForTimeout(1200);
  });

  // 5. Distribution : formulaire de demande avec sites réels chargés.
  await etape('5-distribution-demande', async () => {
    await p.goto(`${BASE}/agent/distribution`, { waitUntil: 'networkidle' });
    await p.click('text=Demander des produits');
    await p.waitForTimeout(1800);
  });

  // 6. Admin : validation bornée d'une règle (valeur absurde refusée).
  await etape('6-regles-validation', async () => {
    await p.goto(`${BASE}/admin/regles`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const champ = p.locator('input[aria-label^="Valeur de"]').first();
    await champ.fill('999');
    await p.locator('button:has-text("Enregistrer")').first().click();
    await p.waitForTimeout(1200);
  });

  // 7. Mobile : la barre latérale doit se replier en bandeau.
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await etape('7-mobile-stock', async () => {
    await mob.goto(`${BASE}/agent/stock`, { waitUntil: 'networkidle' });
    await mob.waitForTimeout(1800);
    await mob.screenshot({ path: `${dir}/7-mobile-stock.png`, fullPage: true });
  });

  console.log(erreurs.length ? '\nERREURS :\n' + erreurs.join('\n') : '\nAucune erreur JS.');
  await b.close();
})();
