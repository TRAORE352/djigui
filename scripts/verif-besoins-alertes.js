/**
 * Vérifie le lien entre le stock et les appels au don.
 *
 * Le manque que ce banc protège : l'écran « Appels au don » ignorait
 * complètement l'état du stock. L'agent devait aller lire le tableau,
 * repérer les lignes rouges, revenir, puis décider de tête d'un
 * objectif de donneurs et d'une urgence.
 *
 * Ce qu'on vérifie, et qui doit rester vrai :
 *   - les groupes sous leur seuil sont annoncés, le plus grave d'abord ;
 *   - « Préparer l'appel » REMPLIT le formulaire (groupe, urgence,
 *     objectif, message) au lieu de lancer quoi que ce soit ;
 *   - rien ne part sans un clic explicite de l'agent — c'est la règle
 *     de sécurité : un seuil mal réglé ne doit jamais écrire à de vrais
 *     donneurs tout seul ;
 *   - les suggestions restent modifiables à la main.
 *
 * Usage : node scripts/verif-besoins-alertes.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/besoins-alertes'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'stock@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  // Ce que le serveur calcule : le banc compare l'écran à cette vérité.
  const besoins = await fetch(`${API}/stock/besoins`, {
    headers: { Authorization: `Bearer ${donnees.jeton}` },
  }).then((r) => r.json()).then((r) => r.donnees);

  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  });
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

  // Toute tentative d'envoi d'alerte est interceptée : si l'écran lance
  // un appel sans clic explicite, on le saura.
  let alertesEnvoyees = 0;
  await p.route(`${API}/alertes`, async (route) => {
    if (route.request().method() === 'POST') alertesEnvoyees += 1;
    await route.continue();
  });

  await p.goto(`${BASE}/agent/alertes`, { waitUntil: 'domcontentloaded' });
  /*
   * Attendre `.besoin` STRICTEMENT : le sélecteur alternatif
   * `.section-titre` existe avant même le chargement des besoins, donc
   * l'attente se terminait trop tôt et le comptage renvoyait 0 cartes
   * alors que l'écran était correct.
   */
  await p.waitForSelector('.besoin', { timeout: 30000 });
  await p.screenshot({ path: `${dir}/1-besoins.png`, fullPage: true });

  console.log(`     le serveur annonce ${besoins.length} besoin(s)`);

  const cartes = await p.locator('.besoin').count();
  verifier('Chaque besoin du serveur a sa carte', cartes === besoins.length,
    `${cartes} carte(s) pour ${besoins.length} besoin(s)`);

  // Le plus grave en premier : l'agent lit de haut en bas.
  const premier = await p.locator('.besoin').first().getAttribute('class');
  const attendu = besoins[0]?.niveau;
  verifier('Le besoin le plus grave est affiché en premier',
    premier.includes(`besoin--${attendu}`), `premier = ${attendu}`);

  // ── Préparer l'appel : ça REMPLIT, ça n'envoie pas ───────────────────
  await p.locator('.besoin').first().getByRole('button', { name: /Préparer/ }).click();
  await p.waitForTimeout(600);

  const rempli = await p.evaluate(() => {
    const select = document.querySelector('select');
    const objectif = document.querySelector('input[type="number"]');
    /*
     * Le message au donneur est un <input maxLength=200>, PAS un
     * <textarea> : chercher un textarea renvoyait null et faisait
     * échouer le test sur du code correct. On le retrouve par son
     * attribut maxlength, qui n'appartient qu'à lui sur cet écran.
     */
    const message = document.querySelector('input[maxlength="200"]');
    const coche = document.querySelector('input[type="radio"]:checked');
    return {
      groupe: select ? select.value : '',
      objectif: objectif ? objectif.value : '',
      message: message ? message.value : '',
      urgence: coche ? coche.value : '',
    };
  });

  verifier('Le groupe est pré-rempli', rempli.groupe === besoins[0].groupeSanguin,
    `${rempli.groupe} (attendu ${besoins[0].groupeSanguin})`);
  verifier('L\'objectif de donneurs est pré-rempli',
    rempli.objectif === String(besoins[0].donneursSuggeres),
    `${rempli.objectif} (attendu ${besoins[0].donneursSuggeres})`);
  verifier('Le message mentionne le groupe manquant',
    rempli.message.includes(besoins[0].groupeSanguin),
    rempli.message.slice(0, 60));

  await p.screenshot({ path: `${dir}/2-prerempli.png`, fullPage: true });

  // LA règle de sécurité : rien n'est parti.
  verifier('AUCUN appel n\'est lancé automatiquement', alertesEnvoyees === 0,
    `${alertesEnvoyees} envoi(s) détecté(s)`);

  // ── Les suggestions restent modifiables ──────────────────────────────
  await p.locator('input[type="number"]').first().fill('7');
  const apresEdition = await p.inputValue('input[type="number"]');
  verifier('L\'agent peut corriger la suggestion', apresEdition === '7', apresEdition);

  verifier('Aucune erreur JS', erreursJs.length === 0, erreursJs.join(' | '));

  // ── Mobile ───────────────────────────────────────────────────────────
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/alertes`, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.besoin', { timeout: 30000 });
  await mob.waitForTimeout(500);
  await mob.screenshot({ path: `${dir}/3-mobile.png`, fullPage: true });
  const debMob = await mob.evaluate(() => Math.max(0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth));
  verifier('Mobile : pas de débordement', debMob === 0, `${debMob}px`);

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
