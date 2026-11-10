/**
 * Captures des écrans « Appels au don » et « Distribution ».
 *
 * Compte utilisé : stock@cnts.bf (rôles agent_stock + agent_depot), les
 * seuls qui ouvrent ces deux pages depuis la séparation des espaces.
 *
 * Usage : node scripts/banc-appels-distribution.js [dossier]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/appels-shots'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'stock@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [donnees.jeton, JSON.stringify(donnees.utilisateur)]);

  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push('PAGEERROR ' + e.message.slice(0, 200)));

  /** Hauteur du document : la mesure brute de « ça respire ou pas ». */
  const mesurer = async (page, nom) => {
    const m = await page.evaluate(() => ({
      hauteur: document.documentElement.scrollHeight,
      debordement: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      // Le volume de texte : nombre de mots dans la zone de contenu.
      mots: (document.querySelector('.contenu, main')?.innerText || '')
        .split(/\s+/).filter(Boolean).length,
    }));
    console.log(`  ${nom} → hauteur ${m.hauteur}px · ${m.mots} mots · débordement ${m.debordement}`);
    return m;
  };

  for (const [nom, chemin] of [['alertes', '/agent/alertes'], ['distribution', '/agent/distribution']]) {
    await p.goto(BASE + chemin, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${dir}/${nom}-desktop.png`, fullPage: true });
    await mesurer(p, `${nom} desktop`);

    const mob = await ctx.newPage();
    await mob.setViewportSize({ width: 390, height: 844 });
    await mob.goto(BASE + chemin, { waitUntil: 'domcontentloaded' });
    await mob.waitForTimeout(2500);
    await mob.screenshot({ path: `${dir}/${nom}-mobile.png`, fullPage: true });
    await mesurer(mob, `${nom} mobile`);
    await mob.close();
  }

  console.log(erreurs.length ? '\nERREURS :\n' + erreurs.join('\n') : '\nAucune erreur JS.');
  await b.close();
})();
