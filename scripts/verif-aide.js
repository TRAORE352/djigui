/**
 * Vérifie l'aide ponctuelle : la pastille « ! » ouvre bien un panneau,
 * le texte est justifié, sans tiret cadratin ni emoji, et il se ferme.
 *
 * Usage : node scripts/verif-aide.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/aide-shots'] = process.argv.slice(2);
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
  const echecs = [];
  const verifier = (nom, ok, detail = '') => {
    console.log(`${ok ? 'OK   ' : 'ECHEC'} ${nom}${detail ? ' — ' + detail : ''}`);
    if (!ok) echecs.push(nom);
  };

  await p.goto(`${BASE}/agent/distribution`, { waitUntil: 'domcontentloaded' });
  // `domcontentloaded` rend la main avant que React ait monté la page :
  // compter les pastilles tout de suite renvoie zéro. On attend qu'une
  // pastille existe, ce qui est le vrai signal de fin de rendu.
  await p.waitForSelector('.aide__pastille', { timeout: 30000 });
  await p.waitForTimeout(500);

  const pastilles = await p.locator('.aide__pastille').count();
  verifier('Des pastilles d\'aide sont posées', pastilles > 0, `${pastilles} pastilles`);

  // Ouvrir la première et inspecter le panneau.
  await p.locator('.aide__pastille').first().click();
  await p.waitForSelector('.aide__panneau', { timeout: 5000 });
  await p.screenshot({ path: `${dir}/aide-ouverte.png`, fullPage: false });

  const panneau = await p.evaluate(() => {
    const e = document.querySelector('.aide__texte');
    if (!e) return null;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      texte: e.textContent || '',
      align: s.textAlign,
      cesure: s.hyphens || s.webkitHyphens,
      graisse: s.fontWeight,
      casse: s.textTransform,
      dansFenetre: r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
    };
  });

  verifier('Texte justifié', panneau.align === 'justify', panneau.align);
  verifier('Césure activée', panneau.cesure === 'auto', String(panneau.cesure));
  // La pastille vit souvent dans un titre : le texte ne doit pas en
  // hériter le gras ni les majuscules.
  verifier('Texte en graisse normale', Number(panneau.graisse) <= 400, panneau.graisse);
  verifier('Pas de mise en majuscules', panneau.casse === 'none', panneau.casse);
  verifier('Panneau entièrement dans la fenêtre', panneau.dansFenetre);
  verifier('Aucun tiret cadratin', !/[—–]/.test(panneau.texte));
  verifier('Aucun emoji',
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(panneau.texte));
  verifier('Texte non vide', panneau.texte.trim().length > 20,
    `${panneau.texte.trim().length} caractères`);

  // Échap referme.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  verifier('Échap referme le panneau', await p.locator('.aide__panneau').count() === 0);

  // Une seule aide ouverte à la fois. Le panneau ouvert recouvre la
  // pastille suivante (c'est voulu : il se pose juste en dessous), donc
  // on clique en forçant plutôt que d'attendre une cible dégagée.
  await p.locator('.aide__pastille').nth(0).click();
  await p.waitForTimeout(200);
  await p.locator('.aide__pastille').nth(1).click({ force: true });
  await p.waitForTimeout(300);
  verifier('Une seule aide ouverte à la fois',
    await p.locator('.aide__panneau').count() <= 1);

  // Mobile : le panneau doit rester dans les marges.
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/distribution`, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.aide__pastille', { timeout: 30000 });
  await mob.waitForTimeout(500);
  await mob.locator('.aide__pastille').first().click();
  await mob.waitForSelector('.aide__panneau', { timeout: 5000 });
  await mob.screenshot({ path: `${dir}/aide-mobile.png`, fullPage: false });
  const okMob = await mob.evaluate(() => {
    const r = document.querySelector('.aide__panneau').getBoundingClientRect();
    return r.left >= 4 && r.right <= window.innerWidth - 4;
  });
  verifier('Mobile : panneau dans les marges', okMob);

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
