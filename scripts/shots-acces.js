/**
 * Captures des pages d'authentification, à pleine hauteur et dans les deux
 * largeurs qui comptent (poste de travail et téléphone).
 *
 * Deux garde-fous repris de l'expérience : on mesure le document avant de
 * capturer (un cadre fixe masque les défauts du bas de page), et on REFUSE
 * d'écrire une capture dont l'écran n'a pas les éléments structurels
 * attendus — une page de chargement et une page d'erreur sont, elles aussi,
 * « une capture ».
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const DIR = process.argv[2] || '/root/djigui-shots';

const ECRANS = [
  { nom: 'agent-desktop', url: '/connexion/agent', largeur: 1440 },
  { nom: 'cnts-desktop', url: '/connexion/cnts', largeur: 1440 },
  { nom: 'agent-mobile', url: '/connexion/agent', largeur: 390 },
  { nom: 'portail-desktop', url: '/', largeur: 1440 },
];

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const produits = [];
  const refus = [];

  for (const { nom, url, largeur } of ECRANS) {
    const ctx = await b.newContext({
      viewport: { width: largeur, height: 900 },
      deviceScaleFactor: 2,
      isMobile: largeur < 700,
    });
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 120000 });
      // On attend la structure, jamais l'horloge.
      await p.waitForSelector('main', { state: 'attached', timeout: 30000 });
      if (url.startsWith('/connexion')) {
        await p.waitForSelector('input[type=email]', { timeout: 30000 });
      } else {
        await p.waitForSelector('.porte', { timeout: 30000 });
      }

      // On a bien atterri là où on visait ? Une redirection répond 200
      // depuis un AUTRE écran.
      const chemin = new URL(p.url()).pathname;
      if (chemin !== url) { refus.push(`${nom} : arrivé sur ${chemin} au lieu de ${url}`); continue; }

      // Garde structurel (compter des éléments, jamais du volume de texte :
      // un formulaire de connexion est légitimement sobre).
      const n = await p.evaluate(() =>
        document.querySelectorAll('input,button,form,a,.porte').length);
      if (n < 3) { refus.push(`${nom} : écran trop pauvre (${n} éléments)`); continue; }

      const h = await p.evaluate(() => Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight));
      await p.setViewportSize({ width: largeur, height: Math.min(h + 20, 4000) });
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${DIR}/${nom}.png` });
      produits.push(`${nom} (${largeur}px, doc ${h}px, ${n} éléments)`);
    } catch (e) {
      refus.push(`${nom} : ${String(e.message).slice(0, 110)}`);
    } finally {
      await ctx.close();
    }
  }

  console.log('PRODUITES :\n  ' + (produits.join('\n  ') || 'aucune'));
  console.log('REFUSÉES :\n  ' + (refus.join('\n  ') || 'aucune'));
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();
