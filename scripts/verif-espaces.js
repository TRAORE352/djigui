/**
 * Vérifie la séparation des trois espaces et l'absence d'empilement de
 * pages au scroll (le bug : router.replace() appelé pendant le rendu).
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';

async function jeton(email, mdp) {
  const r = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, motDePasse: mdp }),
  });
  const j = await r.json();
  return j.donnees;
}

(async () => {
  const [dir = '/root/sep-shots'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const erreurs = [];
  const echecs = [];
  const ok = (cond, mot) => { console.log((cond ? '  OK  ' : ' ECHEC') + '  ' + mot); if (!cond) echecs.push(mot); };

  /**
   * Attend que l'URL contienne `fragment`, sans jamais mesurer l'horloge.
   *
   * Un `waitForTimeout` fixe est un faux négatif garanti : en mode dev, la
   * PREMIERE visite d'une route déclenche sa compilation, le JS n'est pas
   * encore hydraté, le garde de session n'a pas tourné — et le test lit
   * l'ancienne URL en concluant que la redirection n'existe pas.
   * On attend donc la condition elle-même, et l'absence de redirection
   * devient un dépassement de délai explicite, pas une lecture trop tôt.
   */
  const attendUrl = async (page, fragment, ms = 20000) => {
    try {
      await page.waitForURL((u) => u.toString().includes(fragment), { timeout: ms });
      return true;
    } catch {
      return false;
    }
  };

  /** Attend qu'une page soit réellement hydratée (le garde a pu statuer). */
  const attendHydratation = async (page, ms = 20000) => {
    try {
      await page.waitForFunction(
        () => document.querySelector('main,.coquille') !== null,
        null, { timeout: ms },
      );
      return true;
    } catch {
      return false;
    }
  };

  // ---- 1. Portail : trois portes, sans session -----------------------
  let ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  let p = await ctx.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector(".porte", { timeout: 20000 });
  await p.screenshot({ path: `${dir}/1-portail.png`, fullPage: true });
  const portes = await p.locator('.porte').count();
  ok(portes === 3, `portail affiche 3 portes (vu ${portes})`);
  const lienDonneur = await p.locator('.porte[href*="donneur"]').count();
  ok(lienDonneur === 1, 'une porte pointe vers l\'app donneur');
  await ctx.close();

  // ---- 2. Un AGENT ne peut pas entrer dans l'espace CNTS -------------
  const agent = await jeton('labo@cnts.bf', 'ChangeMoi2026!');
  ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [agent.jeton, JSON.stringify(agent.utilisateur)]);
  p = await ctx.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  const refuseCnts = await attendUrl(p, '/connexion/cnts');
  ok(refuseCnts, `agent sur /admin -> renvoyé à la connexion CNTS (url: ${p.url().replace(BASE, '')})`);
  await p.screenshot({ path: `${dir}/2-agent-refuse-cnts.png`, fullPage: true });

  // Son espace à lui fonctionne
  await ctx.addInitScript(() => {}, []);
  await p.evaluate(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [agent.jeton, JSON.stringify(agent.utilisateur)]);
  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await attendHydratation(p);
  await p.waitForSelector('.lateral', { timeout: 20000 });
  ok(p.url().endsWith('/agent'), 'agent accède bien à son espace');
  const lienCnts = await p.locator('.lateral a:has-text("Espace CNTS")').count();
  ok(lienCnts === 0, 'aucun lien "Espace CNTS" dans la barre de l\'agent');
  await p.screenshot({ path: `${dir}/3-espace-agent.png`, fullPage: true });
  await ctx.close();

  // ---- 3. L'ADMIN n'entre pas dans l'espace agent ---------------------
  const admin = await jeton('admin@cnts.bf', 'ChangeMoi2026!');
  ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [admin.jeton, JSON.stringify(admin.utilisateur)]);
  p = await ctx.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));

  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  const refuseAgent = await attendUrl(p, '/connexion/agent');
  ok(refuseAgent, `admin sur /agent -> renvoyé à la connexion agent (url: ${p.url().replace(BASE, '')})`);
  await p.screenshot({ path: `${dir}/2b-admin-refuse-agent.png`, fullPage: true });

  // Re-injecter : la Coquille a fermé la session en refusant l'accès
  await p.evaluate(([j, a]) => {
    localStorage.setItem('dds:jeton-agent', j);
    localStorage.setItem('dds:agent', a);
  }, [admin.jeton, JSON.stringify(admin.utilisateur)]);
  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await attendHydratation(p);
  await p.waitForSelector('.lateral', { timeout: 20000 });
  ok(p.url().endsWith('/admin'), 'admin accède bien à l\'espace CNTS');
  await p.screenshot({ path: `${dir}/4-espace-cnts.png`, fullPage: true });

  // ---- 4. LE BUG DU SCROLL : une seule page montée à la fois ---------
  // Avant correction, router.replace() pendant le rendu laissait la page
  // de connexion montée au-dessus de la page d'arrivée.
  const mains = await p.locator('main').count();
  ok(mains === 1, `une seule balise <main> montée (vu ${mains})`);
  const formsConnexion = await p.locator('form input[type="email"]').count();
  ok(formsConnexion === 0, 'aucun formulaire de connexion résiduel dans l\'espace');
  const hauteur = await p.evaluate(() => document.documentElement.scrollHeight);
  const fenetre = await p.evaluate(() => window.innerHeight);
  ok(hauteur < fenetre * 2.2, `page de hauteur normale (${hauteur}px pour une fenêtre de ${fenetre}px)`);

  // Scroll tout en haut : on ne doit RIEN trouver d'autre
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${dir}/5-scroll-haut.png`, fullPage: false });

  await ctx.close();

  // ---- 5. Mauvais compte sur la mauvaise porte ------------------------
  ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  p = await ctx.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
  await p.goto(`${BASE}/connexion/cnts`, { waitUntil: 'networkidle' });
  await p.waitForSelector('input[type=email]', { timeout: 20000 });
  await p.fill('input[type=email]', 'labo@cnts.bf');
  await p.fill('input[type=password]', 'ChangeMoi2026!');
  await p.click('button[type=submit]');
  // On attend le CONTENU du refus : un délai fixe lirait la page avant la
  // réponse du backend et donnerait un faux échec.
  let refuse = true;
  try {
    await p.waitForFunction(
      () => document.body.innerText.includes("n'est pas administrateur"),
      null, { timeout: 20000 },
    );
  } catch { refuse = false; }
  ok(refuse, 'agent refusé sur la porte CNTS avec un message clair');
  ok(p.url().includes('/connexion/cnts'), 'il reste sur la page de connexion CNTS');
  // Le refus doit aussi avoir fermé la session : aucun jeton ne survit.
  const jetonApresRefus = await p.evaluate(() => localStorage.getItem('dds:jeton-agent'));
  ok(!jetonApresRefus, 'aucun jeton conservé après un refus de porte');
  await p.screenshot({ path: `${dir}/6-refus-mauvaise-porte.png`, fullPage: true });

  // ---- 6. Mobile ------------------------------------------------------
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE, { waitUntil: 'networkidle' });
  await m.waitForSelector(".porte", { timeout: 20000 });
  await m.screenshot({ path: `${dir}/7-portail-mobile.png`, fullPage: true });

  console.log('\n' + (erreurs.length ? 'ERREURS JS :\n' + [...new Set(erreurs)].join('\n') : 'Aucune erreur JS.'));
  console.log(echecs.length ? `\n${echecs.length} VERIFICATION(S) EN ECHEC` : '\nToutes les vérifications passent.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
