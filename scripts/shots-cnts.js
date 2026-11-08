/**
 * Captures d'écran réelles de la plateforme CNTS, connecté comme agent.
 * Usage : node shots-cnts.js <sortie-dir> [largeur] [hauteur]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';

const ECRANS = [
  ['/agent', 'agent-poste'],
  ['/agent/accueil', 'agent-accueil'],
  ['/agent/laboratoire', 'agent-labo'],
  ['/agent/stock', 'agent-stock'],
  ['/agent/alertes', 'agent-alertes'],
  ['/agent/distribution', 'agent-distribution'],
  ['/agent/tracabilite', 'agent-tracabilite'],
  ['/admin', 'admin-bord'],
  ['/admin/comptes', 'admin-comptes'],
  ['/admin/reseau', 'admin-reseau'],
  ['/admin/regles', 'admin-regles'],
];

(async () => {
  const [dir, w = '1440', h = '900'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  // On récupère un vrai jeton auprès du backend.
  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();
  if (!donnees?.jeton) throw new Error('Connexion impossible : ' + JSON.stringify(donnees));

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: +w < 600 ? 2 : 1,
  });

  // La session vit dans localStorage : on l'injecte avant tout chargement.
  await ctx.addInitScript(([jeton, agent]) => {
    localStorage.setItem('dds:jeton-agent', jeton);
    localStorage.setItem('dds:agent', agent);
  }, [donnees.jeton, JSON.stringify(donnees.utilisateur)]);

  const p = await ctx.newPage();
  const erreurs = [];
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => erreurs.push('PAGEERROR ' + e.message.slice(0, 200)));

  for (const [route, nom] of ECRANS) {
    await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1800);
    const chemin = `${dir}/${nom}.png`;
    await p.screenshot({ path: chemin, fullPage: true });
    const titre = await p.evaluate(() => document.querySelector('.contenu__titre')?.textContent ?? '(aucun titre)');
    console.log(`${nom.padEnd(20)} ${route.padEnd(22)} titre="${titre}"`);
  }

  if (erreurs.length) {
    console.log('\n--- ERREURS CONSOLE ---');
    [...new Set(erreurs)].forEach((e) => console.log(' ', e));
  } else {
    console.log('\nAucune erreur console.');
  }

  await b.close();
})();
