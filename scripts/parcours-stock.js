/**
 * Parcours complet du stock : recevoir un lot, puis délivrer une unité.
 *
 * Ce banc suit le geste réel d'un agent de centre de santé :
 *   1. il reçoit 100 poches livrées par un laboratoire et les saisit
 *      PAR LOT (c'est le point : il ne remplit pas 100 formulaires) ;
 *   2. le stock augmente d'autant, tout de suite ;
 *   3. il délivre une unité à un service de soins ;
 *   4. le stock diminue d'une unité et l'unité sort de la liste.
 *
 * Chaque étape est vérifiée sur un CHIFFRE lu à l'écran, pas sur la
 * seule présence d'un message : c'est le stock qui doit bouger.
 *
 * Usage : node scripts/parcours-stock.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/parcours-stock'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'stock@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  });
  /*
   * `locale: 'fr-FR'` : un `<input type="date">` affiche son format
   * selon la locale du NAVIGATEUR, pas selon le `lang` du document. Le
   * Chromium de test tourne en en-US et montrait « mm/dd/yyyy », ce qui
   * fait croire à tort à un bug de l'application. On teste dans la
   * locale des agents pour juger ce qu'ils verront vraiment.
   */
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Ouagadougou',
  });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [donnees.jeton, JSON.stringify(donnees.utilisateur)]);

  const echecs = [];
  const verifier = (nom, ok, detail = '') => {
    console.log(`${ok ? 'OK   ' : 'ECHEC'} ${nom}${detail ? ' — ' + detail : ''}`);
    if (!ok) echecs.push(nom);
  };

  const p = await ctx.newPage();
  const erreursJs = [];
  p.on('pageerror', (e) => erreursJs.push(e.message.slice(0, 160)));

  // Le total d'unités affiché par l'écran Stock (premier indicateur).
  const lireTotal = async () => {
    await p.waitForSelector('.indicateur__valeur', { timeout: 30000 });
    return parseInt(
      await p.$eval('.indicateur__valeur', (e) => e.textContent.trim()), 10);
  };

  // ── 1. État de départ ─────────────────────────────────────────────────
  await p.goto(`${BASE}/agent/stock`, { waitUntil: 'domcontentloaded' });
  const avant = await lireTotal();
  console.log(`     stock de départ : ${avant} unités`);

  // ── 2. Recevoir un lot ────────────────────────────────────────────────
  await p.getByRole('button', { name: /Recevoir un lot/ }).click();
  await p.waitForSelector('.lot-ligne', { timeout: 10000 });
  await p.screenshot({ path: `${dir}/1-formulaire.png`, fullPage: true });

  const ref = `BL-BANC-${Date.now().toString().slice(-6)}`;
  await p.getByLabel('Référence du bordereau').fill(ref);
  await p.getByLabel('Livré par').fill('Laboratoire central');

  // Ligne 1 : 60 × GR O+
  const l1 = p.locator('.lot-ligne').first();
  await l1.locator('select').first().selectOption('GR');
  await l1.locator('select').nth(1).selectOption('O+');
  await l1.locator('input[type="number"]').fill('60');
  await l1.locator('input[type="date"]').fill('2027-01-15');

  // Ligne 2 : 40 × PL A+ — prouve que plusieurs lignes partent ensemble.
  await p.getByRole('button', { name: /Ajouter une ligne/ }).click();
  const l2 = p.locator('.lot-ligne').nth(1);
  await l2.locator('select').first().selectOption('PL');
  await l2.locator('select').nth(1).selectOption('A+');
  await l2.locator('input[type="number"]').fill('40');

  const totalAffiche = await p.locator('.bord-actions .chiffres').first().textContent();
  verifier('Le total des unités se calcule pendant la saisie', totalAffiche.trim() === '100',
    `affiché : ${totalAffiche.trim()}`);

  await p.screenshot({ path: `${dir}/2-rempli.png`, fullPage: true });
  await p.getByRole('button', { name: /^Ajouter au stock/ }).click();

  // ── 3. Le stock a augmenté de 100 ─────────────────────────────────────
  await p.waitForSelector('.message--reussite, [role="status"]', { timeout: 60000 }).catch(() => {});
  // Le rechargement du stock suit l'enregistrement : on attend que le
  // chiffre ait réellement changé, pas un délai arbitraire.
  await p.waitForFunction(
    (n) => {
      const e = document.querySelector('.indicateur__valeur');
      return e && parseInt(e.textContent.trim(), 10) === n;
    },
    avant + 100,
    { timeout: 60000 },
  ).catch(() => {});

  const apres = await lireTotal();
  verifier('Le stock augmente de 100 unités', apres === avant + 100,
    `${avant} -> ${apres}`);
  await p.screenshot({ path: `${dir}/3-stock-apres.png`, fullPage: true });

  // ── 4. Délivrer une unité ─────────────────────────────────────────────
  await p.goto(`${BASE}/agent/delivrances`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.lien-code', { timeout: 30000 });

  /*
   * La page ne doit pas devenir un mur de codes. Un centre bien
   * approvisionné détient des centaines d'unités ; sans pagination la
   * page atteignait ~9800 px et l'agent défilait des écrans entiers
   * pour revenir au formulaire. On mesure la hauteur réelle.
   */
  const hauteur = await p.evaluate(() => document.documentElement.scrollHeight);
  verifier('La liste reste parcourable (pas un mur de codes)', hauteur < 4000,
    `${hauteur}px de haut`);

  const codeChoisi = await p.$eval('.lien-code', (e) => e.textContent.trim());
  await p.locator('.lien-code').first().click();
  const codeRempli = await p.inputValue('.champ__saisie.chiffres');
  verifier('Cliquer un code le reporte dans le formulaire', codeRempli === codeChoisi,
    codeRempli);

  await p.getByPlaceholder('Urgences, maternité, pédiatrie').fill('Maternité');
  await p.screenshot({ path: `${dir}/4-delivrance.png`, fullPage: true });
  await p.getByRole('button', { name: /^Délivrer/ }).click();

  const confirme = await p
    .waitForSelector('.message--reussite', { timeout: 60000 })
    .then((e) => e.textContent())
    .catch(() => '');
  verifier('La délivrance est confirmée', /délivré/i.test(confirme), confirme.trim().slice(0, 80));
  await p.screenshot({ path: `${dir}/5-delivre.png`, fullPage: true });

  // ── 5. Le stock a diminué d'une unité ─────────────────────────────────
  await p.goto(`${BASE}/agent/stock`, { waitUntil: 'domcontentloaded' });
  const final = await lireTotal();
  verifier('Le stock diminue d\'une unité après la délivrance', final === apres - 1,
    `${apres} -> ${final}`);

  verifier('Aucune erreur JS sur tout le parcours', erreursJs.length === 0,
    erreursJs.join(' | '));

  // ── 6. Mobile ─────────────────────────────────────────────────────────
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/stock`, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.indicateur__valeur', { timeout: 30000 });
  await mob.getByRole('button', { name: /Recevoir un lot/ }).click();
  await mob.waitForSelector('.lot-ligne', { timeout: 10000 });
  await mob.screenshot({ path: `${dir}/6-mobile.png`, fullPage: true });
  const debMob = await mob.evaluate(() => Math.max(0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth));
  verifier('Mobile : pas de débordement sur le formulaire', debMob === 0, `${debMob}px`);

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
