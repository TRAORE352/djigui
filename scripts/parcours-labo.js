/**
 * Parcours réel de la chaîne du laboratoire, dans le navigateur.
 * On clique vraiment : réception → groupage → sérologie → libération.
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';

(async () => {
  const [dir = '/root/labo-shots'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [donnees.jeton, JSON.stringify(donnees.utilisateur)]);

  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push('PAGEERROR ' + e.message.slice(0, 160)));

  const shot = async (n) => { await p.screenshot({ path: `${dir}/${n}.png`, fullPage: true }); console.log('✓', n); };

  // Tableau de bord
  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await shot('0-tableau-de-bord');

  // Laboratoire : file de réception
  await p.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await shot('1-file-reception');

  // Ouvrir la première poche
  await p.locator('.travail').first().click();
  await p.waitForTimeout(1200);
  await shot('2-dossier-reception');

  // Étape 1 : accepter l'échantillon
  await p.locator('button:has-text("Accepter l\'échantillon")').click();
  await p.waitForTimeout(2000);
  await shot('3-apres-reception');

  // Étape 2 : groupage discordant -> l'écran doit prévenir AVANT envoi
  const selects = p.locator('select');
  await selects.nth(0).selectOption('O+');
  await selects.nth(1).selectOption('A+');
  await p.waitForTimeout(900);
  await shot('4-groupage-discordant');
  const boutonBloque = await p.locator('button:has-text("Valider le groupage")').isDisabled();
  console.log('   bouton bloqué sur discordance :', boutonBloque);

  // Groupage concordant
  await selects.nth(1).selectOption('O+');
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Valider le groupage")').click();
  await p.waitForTimeout(2000);
  await shot('5-serologie');

  // Étape 3 : saisir les 4 marqueurs obligatoires en négatif
  for (const m of ['VIH', 'Hépatite B', 'Hépatite C', 'Syphilis']) {
    await p.locator(`input[aria-label="${m} : Résultat négatif"]`).check();
  }
  await p.waitForTimeout(600);
  await shot('6-marqueurs-saisis');
  await p.locator('button:has-text("Enregistrer")').first().click();
  await p.waitForTimeout(2200);
  await shot('7-liberation');

  // Étape 4 : libérer
  await p.locator('button:has-text("Libérer la poche")').click();
  await p.waitForTimeout(2200);
  await shot('8-libere');

  // Onglet préparation
  await p.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'networkidle' });
  await p.locator('button:has-text("Préparation")').click();
  await p.waitForTimeout(1800);
  await shot('9-preparation');

  // Distribution allégée
  await p.goto(`${BASE}/agent/distribution`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await shot('10-distribution');

  // Mobile
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(2200);
  await m.screenshot({ path: `${dir}/11-mobile-bord.png`, fullPage: true });
  console.log('✓ 11-mobile-bord');

  console.log(erreurs.length ? '\nERREURS :\n' + erreurs.join('\n') : '\nAucune erreur JS.');
  await b.close();
})();
