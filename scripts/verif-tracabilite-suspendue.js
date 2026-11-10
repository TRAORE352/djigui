/**
 * Vérifie l'écran de la traçabilité PENDANT sa suspension.
 *
 * Même raison que pour le laboratoire : l'écran est en attente, et ce
 * qui compte aujourd'hui n'est pas la frise chronologique mais le fait
 * que l'écran dise franchement son état, sans ressembler à une panne.
 *
 * Ce que l'on vérifie :
 *   - la page répond et affiche le message d'attente, sans erreur JS ;
 *   - elle explique la RAISON (dépendance au laboratoire) et rassure sur
 *     le sort des événements déjà enregistrés ;
 *   - plus aucun formulaire de recherche ne subsiste ;
 *   - le tableau de bord ne propose plus de raccourci « Rechercher un
 *     code » vers un écran fermé ;
 *   - rien ne déborde sur mobile.
 *
 * Usage : node scripts/verif-tracabilite-suspendue.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/traca-suspendue'] = process.argv.slice(2);
  fs.mkdirSync(dir, { recursive: true });

  const rep = await fetch(`${API}/auth/agent/connexion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'labo@cnts.bf', motDePasse: 'ChangeMoi2026!' }),
  });
  const { donnees } = await rep.json();

  const b = await chromium.launch({
    executablePath: CHROME,
    /*
     * `--single-process` : dans ce conteneur, le processus de rendu
     * séparé crashe au `newPage()` (« Target crashed ») alors que la
     * mémoire et /dev/shm sont sains. Tout faire dans un seul processus
     * contourne le problème sans rien changer au rendu mesuré.
     */
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
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

  // ── L'écran de la traçabilité ─────────────────────────────────────────
  await p.goto(`${BASE}/agent/tracabilite`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.travaux', { timeout: 30000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${dir}/traca-desktop.png`, fullPage: true });

  const vu = await p.evaluate(() => ({
    titre: document.querySelector('.travaux__titre')?.textContent?.trim() || '',
    texte: document.querySelector('.travaux__texte')?.textContent?.trim() || '',
    note: document.querySelector('.travaux__note')?.textContent?.trim() || '',
    issue: !!document.querySelector('.travaux a[href="/agent"]'),
    // Plus de recherche par code : ni formulaire, ni champ, ni frise.
    vestiges: document.querySelectorAll('form, input, .frise, .evenement').length,
    debordement: Math.max(0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth),
  }));

  verifier('Message d\'attente affiché', vu.titre.length > 10, vu.titre);
  verifier('La raison est expliquée (dépendance au laboratoire)',
    /laboratoire|qualification|biologiste/i.test(vu.texte));
  verifier('Le sort des événements est précisé',
    /perdu|enregistr|complète/i.test(vu.note));
  verifier('Une issue est proposée', vu.issue, 'retour au tableau de bord');
  verifier('Aucun vestige de la recherche', vu.vestiges === 0, `${vu.vestiges} éléments`);
  verifier('Aucune erreur JS', erreursJs.length === 0, erreursJs.join(' | '));
  verifier('Pas de débordement horizontal', vu.debordement === 0);

  // ── Le tableau de bord ne renvoie plus vers un écran fermé ────────────
  await p.goto(`${BASE}/agent`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.squelette', { state: 'detached', timeout: 30000 });
  await p.waitForTimeout(600);

  const bord = await p.evaluate(() => ({
    raccourciCode: !!Array.from(document.querySelectorAll('a'))
      .find((a) => /Rechercher un code/i.test(a.textContent || '')),
  }));
  verifier('Plus de raccourci « Rechercher un code »', !bord.raccourciCode);

  // Le lien de la barre latérale reste, lui : le poste existe toujours.
  const menu = await p.evaluate(() => !!document.querySelector('a[href="/agent/tracabilite"]'));
  verifier('Le lien reste dans le menu (le poste existe)', menu);

  // ── Mobile ────────────────────────────────────────────────────────────
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/tracabilite`, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.travaux', { timeout: 30000 });
  await mob.waitForTimeout(500);
  await mob.screenshot({ path: `${dir}/traca-mobile.png`, fullPage: true });
  const debMob = await mob.evaluate(() => Math.max(0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth));
  verifier('Mobile : pas de débordement', debMob === 0);

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
