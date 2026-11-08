/**
 * Capture tous les écrans de l'espace agent, connecté, à pleine hauteur.
 *
 * On REFUSE d'écrire une capture dont l'écran n'a pas ses éléments
 * structurels : une page de chargement et une page d'erreur sont, elles
 * aussi, « une capture », et une image fausse est pire qu'une image
 * manquante parce qu'elle ne se voit pas.
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = process.env.BASE || 'https://djigui-agent.vercel.app';
const API = process.env.API || 'https://djigui-api.vercel.app/api';
const MDP = process.env.MDP_DEMO;
const DIR = process.argv[2] || '/root/agent-audit';

const ECRANS = [
  { nom: '1-tableau', url: '/agent' },
  { nom: '2-accueil', url: '/agent/accueil' },
  { nom: '3-laboratoire', url: '/agent/laboratoire' },
  { nom: '4-stock', url: '/agent/stock' },
  { nom: '5-alertes', url: '/agent/alertes' },
  { nom: '6-distribution', url: '/agent/distribution' },
  { nom: '7-tracabilite', url: '/agent/tracabilite' },
];

(async () => {
  if (!MDP) { console.error('MDP_DEMO manquant'); process.exit(1); }
  fs.mkdirSync(DIR, { recursive: true });

  const r = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo.agent@djigui.bf', motDePasse: MDP }),
  });
  const s = (await r.json()).donnees;
  if (!s) { console.error('connexion refusée'); process.exit(1); }

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [s.jeton, JSON.stringify(s.utilisateur)]);

  const refus = [];
  for (const e of ECRANS) {
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (x) => erreurs.push(x.message.slice(0, 100)));
    try {
      await p.goto(BASE + e.url, { waitUntil: 'networkidle', timeout: 120000 });
      await p.waitForSelector('.lateral', { timeout: 45000 });
      const chemin = new URL(p.url()).pathname;
      if (chemin !== e.url) { refus.push(`${e.nom}: arrivé sur ${chemin}`); await p.close(); continue; }
      // Attendre que le contenu réel remplace les squelettes de chargement.
      await p.waitForFunction(
        () => document.querySelectorAll('.squelette').length === 0,
        null, { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1200);

      const n = await p.evaluate(() =>
        document.querySelectorAll('.contenu input,.contenu button,.contenu table,.contenu .bloc,.contenu section').length);
      if (n < 1) { refus.push(`${e.nom}: écran sans structure (${n})`); await p.close(); continue; }

      const h = await p.evaluate(() => Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight));
      await p.setViewportSize({ width: 1440, height: Math.min(h + 20, 5000) });
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${DIR}/${e.nom}.png` });

      // Mesure utile au diagnostic : largeur réellement occupée par le contenu.
      const m = await p.evaluate(() => {
        const c = document.querySelector('.contenu');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { largeurZone: Math.round(r.width), gauche: Math.round(r.left) };
      });
      console.log(`  ${e.nom.padEnd(16)} doc=${h}px zone=${m ? m.largeurZone : '?'}px ${erreurs.length ? 'JS:' + erreurs[0] : ''}`);
    } catch (x) {
      refus.push(`${e.nom}: ${String(x.message).slice(0, 90)}`);
    }
    await p.close();
  }

  console.log(refus.length ? '\nREFUSÉES :\n  ' + refus.join('\n  ') : '\nToutes capturées.');
  await b.close();
})();
