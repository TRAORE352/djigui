/**
 * Sonde du mutant : visite /agent avec une session ADMIN et rapporte
 * deux faits bruts, sans verdict —
 *   marqueur= : le mutant est-il réellement servi par le bundle ?
 *   chemin=   : où l'application a-t-elle finalement mené ?
 *
 * Le marqueur est indispensable : sans lui, un bundle périmé fait passer
 * « mutant non posé » pour « mutant survivant ».
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
  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle', timeout: 120000 });
  // On laisse le garde statuer : on attend soit la redirection, soit la
  // coquille montée, sans jamais trancher sur un simple délai.
  try {
    await Promise.race([
      p.waitForURL((u) => u.toString().includes('/connexion'), { timeout: 25000 }),
      p.waitForSelector('.lateral', { timeout: 25000 }),
    ]);
  } catch { /* on rapporte l'état atteint, quel qu'il soit */ }

  console.log('marqueur=' + await p.evaluate(() => document.documentElement.dataset.mutant ?? 'ABSENT'));
  console.log('chemin=' + new URL(p.url()).pathname);
  await b.close();
})();
