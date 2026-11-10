/**
 * Banc d'essai du dossier de laboratoire, écran par écran.
 *
 * Objet : juger l'écran COMPLET après la remise à plat de la liste de
 * travail (worklist) et de la frise. On capture la file, puis le dossier
 * ouvert à chacune des quatre étapes, en desktop et en mobile.
 *
 * On mesure aussi, car une capture ne dit pas tout : hauteur de la frise
 * (doit tenir sur UNE ligne), nombre de lignes de la worklist, et
 * présence d'un débordement horizontal.
 *
 * Usage : node scripts/banc-labo-dossier.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/labo-dossier'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'labo@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
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
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push('CONSOLE ' + m.text().slice(0, 160)); });

  const shot = async (n, page = p) => {
    await page.screenshot({ path: `${dir}/${n}.png`, fullPage: true });
    console.log('✓', n);
  };

  /** Mesures de mise en page : ce que l'œil ne chiffre pas. */
  const mesurer = async (etiquette, page = p) => {
    const m = await page.evaluate(() => {
      const r = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { h: Math.round(b.height), w: Math.round(b.width), lignes: e.children.length };
      };
      return {
        frise: r('.frise'),
        worklist: document.querySelectorAll('.worklist__ligne').length,
        debordement: document.documentElement.scrollWidth > document.documentElement.clientWidth
          ? document.documentElement.scrollWidth - document.documentElement.clientWidth : 0,
        hauteurDocument: document.documentElement.scrollHeight,
      };
    });
    console.log('  mesure', etiquette, JSON.stringify(m));
    return m;
  };

  // ── 1. File de réception + liste de travail ───────────────────────────
  // `networkidle` ne se stabilise jamais en dev : le websocket HMR de
  // Next maintient une connexion ouverte en permanence. On attend donc
  // un sélecteur de fin de chargement, qui est le vrai signal.
  await p.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.worklist__ligne, .vide-ligne', { timeout: 30000 });
  await p.waitForTimeout(600);
  await shot('1-file-travail');
  await mesurer('file');

  // ── 2. Dossier ouvert : réception ─────────────────────────────────────
  await p.locator('.worklist__ligne').first().click();
  await p.waitForTimeout(1200);
  await shot('2-dossier-reception');
  await mesurer('dossier-reception');

  // ── 3. Groupage ───────────────────────────────────────────────────────
  await p.locator('button:has-text("Accepter l\'échantillon")').click();
  await p.waitForTimeout(2000);
  await shot('3-dossier-groupage');
  await mesurer('dossier-groupage');

  // Discordance : l'écran doit prévenir avant l'envoi.
  const selects = p.locator('select');
  await selects.nth(0).selectOption('O+');
  await selects.nth(1).selectOption('A+');
  await p.waitForTimeout(800);
  await shot('4-discordance');
  console.log('  bouton bloqué sur discordance :',
    await p.locator('button:has-text("Valider le groupage")').isDisabled());

  // ── 4. Sérologie ──────────────────────────────────────────────────────
  await selects.nth(1).selectOption('O+');
  await p.waitForTimeout(500);
  await p.locator('button:has-text("Valider le groupage")').click();
  await p.waitForTimeout(2200);
  await shot('5-dossier-serologie');
  await mesurer('dossier-serologie');

  // ── 5. Libération ─────────────────────────────────────────────────────
  /*
   * Les radios sont MASQUÉES sous des boutons stylés. `.check()` échoue
   * en timeout (l'input n'est pas visible) et `.check({ force: true })`
   * coche l'input sans que React voie l'événement : le bouton d'envoi
   * reste grisé et le banc échoue plus loin, loin de la vraie cause.
   * On clique le LABEL qui enveloppe l'input, comme un technicien.
   */
  // Le bouton visible est le <label> parent du radio masqué. On passe par
  // l'aria-label du radio, seul identifiant stable : un filtre sur le
  // texte « Hépatite C » attrape aussi d'autres cartes au re-rendu.
  const marqueurs = await p.locator('input[aria-label$=": Résultat négatif"]').all();
  for (const input of marqueurs) {
    const nom = await input.getAttribute('aria-label');
    if (!/^(VIH|Hépatite B|Hépatite C|Syphilis) :/.test(nom)) continue;
    await input.evaluate((e) => e.closest('label').click());
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(600);
  const pret = await p.locator('button:has-text("Enregistrer")').first().isEnabled();
  console.log('  4 marqueurs négatifs saisis, envoi possible :', pret);
  /*
   * Le libellé du bouton est DYNAMIQUE : « Enregistrer les résultats »
   * tant que rien n'est saisi, puis « Enregistrer 4 résultats ». Un
   * `has-text` sur le libellé complet ne matche donc plus au moment où
   * l'on veut cliquer. On vise le rôle avec une expression régulière.
   *
   * `noWaitAfter` : le bouton passe en « Enregistrement… » puis la carte
   * entière est remplacée, donc le locator se détache en plein clic. On
   * attend le RÉSULTAT (l'étape suivante), pas la stabilité du bouton.
   */
  await p.getByRole('button', { name: /^Enregistrer/ }).click({ noWaitAfter: true });
  await p.waitForSelector('button:has-text("Libérer la poche")', { timeout: 25000 });
  await p.waitForTimeout(800);
  await shot('6-dossier-liberation');
  await mesurer('dossier-liberation');

  // ── 6. Mobile : file et dossier ───────────────────────────────────────
  const mob = await ctx.newPage();
  mob.on('pageerror', (e) => erreurs.push('MOBILE ' + e.message.slice(0, 160)));
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'domcontentloaded' });
  // Attendre la FIN du chargement : sinon la capture fige les squelettes
  // et l'on juge un écran de chargement au lieu de la liste réelle.
  await mob.waitForSelector('.worklist__ligne, .vide-ligne', { timeout: 20000 });
  await mob.waitForTimeout(600);
  await shot('7-mobile-file', mob);
  await mesurer('mobile-file', mob);
  const ligne = mob.locator('.worklist__ligne').first();
  if (await ligne.count()) {
    await ligne.click();
    await mob.waitForTimeout(1200);
    await shot('8-mobile-dossier', mob);
    await mesurer('mobile-dossier', mob);
  }

  console.log(erreurs.length ? '\nERREURS :\n' + erreurs.join('\n') : '\nAucune erreur JS.');
  await b.close();
})();
