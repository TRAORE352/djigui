/**
 * Diagnostic ciblé : pourquoi un compte admin n'est-il pas renvoyé hors de
 * /agent ? On observe la suite des URL et l'état du localStorage, au lieu de
 * lire une seule fois l'URL après un délai fixe.
 */
const { chromium } = require('/root/node_modules/playwright-core');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';

(async () => {
  const r = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const admin = (await r.json()).donnees;
  console.log('roles admin :', JSON.stringify(admin.utilisateur.roles));

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [admin.jeton, JSON.stringify(admin.utilisateur)]);

  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERREUR JS :', e.message.slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE :', m.text().slice(0, 200)); });
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('  nav ->', f.url().replace(BASE, '')); });

  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });

  // On observe toutes les 500 ms pendant 12 s : URL + ce que voit le garde.
  for (let i = 0; i < 24; i++) {
    const etat = await p.evaluate(() => JSON.stringify({
      url: location.pathname,
      jeton: !!localStorage.getItem('dds:jeton-agent'),
      agent: localStorage.getItem('dds:agent'),
      mains: document.querySelectorAll('main').length,
      emails: document.querySelectorAll('input[type=email]').length,
      texte: document.body.innerText.slice(0, 90).replace(/\n/g, ' | '),
    }));
    const e = JSON.parse(etat);
    console.log(`t=${(i * 0.5).toFixed(1)}s ${e.url} jeton=${e.jeton} main=${e.mains} email=${e.emails} | ${e.texte}`);
    if (e.url.startsWith('/connexion')) { console.log('=> redirection observee'); break; }
    await p.waitForTimeout(500);
  }

  await b.close();
})();
