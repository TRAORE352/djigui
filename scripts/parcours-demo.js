/**
 * Parcours de DÉMONSTRATION sur les adresses de PRODUCTION.
 *
 * Ce que ce script prouve, et qu'aucun appel d'API ne prouve : qu'un
 * humain qui tape l'adresse, saisit les identifiants et clique « Se
 * connecter » arrive bien dans son espace. Un `curl` réussi sur
 * /auth/agent/connexion ne dit rien du navigateur (CORS, hydratation,
 * stockage de session, redirection).
 *
 * On écrit dans les champs par le setter natif : assigner `.value`
 * directement laisse l'état React inchangé et le formulaire posterait des
 * champs vides.
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const MDP = process.env.MDP_DEMO;
if (!MDP) { console.error('MDP_DEMO manquant'); process.exit(1); }

const DIR = process.argv[2] || '/root/djigui-demo';

const CAS = [
  {
    nom: 'agent', base: 'https://djigui-agent.vercel.app',
    porte: '/connexion/agent', email: 'demo.agent@djigui.bf',
    arrivee: '/agent', attendu: 'Awa',
  },
  {
    nom: 'cnts', base: 'https://djigui-cnts.vercel.app',
    porte: '/connexion/cnts', email: 'demo.cnts@djigui.bf',
    arrivee: '/admin', attendu: 'Issa',
  },
];

const echecs = [];
const ok = (c, m) => { console.log((c ? '  OK  ' : ' ECHEC') + '  ' + m); if (!c) echecs.push(m); };

/** Écrit dans un input contrôlé par React. */
async function saisir(page, selecteur, valeur) {
  await page.waitForSelector(selecteur, { timeout: 30000 });
  await page.evaluate(([s, v]) => {
    const el = document.querySelector(s);
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [selecteur, valeur]);
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  for (const c of CAS) {
    console.log(`\n--- ${c.nom} (${c.base})`);
    const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const erreursJs = [];
    p.on('pageerror', (e) => erreursJs.push(e.message.slice(0, 120)));

    await p.goto(c.base + c.porte, { waitUntil: 'networkidle', timeout: 120000 });
    await saisir(p, 'input[type=email]', c.email);
    await saisir(p, 'input[type=password]', MDP);
    await p.screenshot({ path: `${DIR}/${c.nom}-1-connexion.png` });

    await p.click('button[type=submit]');

    // On attend l'ARRIVÉE, jamais un délai : la première navigation vers
    // une route peut être lente, et lire l'URL trop tôt est un faux échec.
    let arrive = true;
    try {
      await p.waitForURL((u) => new URL(u).pathname.startsWith(c.arrivee), { timeout: 45000 });
    } catch { arrive = false; }
    ok(arrive, `connexion -> ${c.arrivee} (url : ${new URL(p.url()).pathname})`);

    if (arrive) {
      await p.waitForSelector('.lateral', { timeout: 45000 });
      // Le nom du compte connecté prouve que la session est bien montée,
      // et pas seulement que l'URL a changé.
      const texte = await p.locator('.lateral').innerText();
      ok(texte.includes(c.attendu), `le compte « ${c.attendu} » est affiché dans la barre`);
      ok(texte.includes('Djigui'), 'la barre porte la marque Djigui');
      const mains = await p.locator('main').count();
      ok(mains === 1, `une seule page montée (vu ${mains})`);
      await p.waitForTimeout(2500); // laisser les données arriver
      const h = await p.evaluate(() => Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight));
      await p.setViewportSize({ width: 1440, height: Math.min(h + 20, 4000) });
      await p.screenshot({ path: `${DIR}/${c.nom}-2-espace.png` });
    }

    ok(erreursJs.length === 0, `aucune erreur JS (${erreursJs.join(' | ') || 'aucune'})`);
    await ctx.close();
  }

  console.log(echecs.length ? `\n${echecs.length} ECHEC(S)` : '\nParcours de démonstration complet.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
