/**
 * Vérifie l'écran du laboratoire PENDANT sa suspension.
 *
 * Le banc complet de la chaîne de qualification
 * (`banc-labo-dossier.js`) ne s'applique plus tant que l'écran est en
 * attente de validation avec les biologistes : il est conservé tel quel
 * pour le jour de la réouverture.
 *
 * Ce que l'on vérifie ici, et qui compte vraiment aujourd'hui :
 *   - la page répond et affiche le message d'attente, sans erreur JS ;
 *   - elle ne ressemble pas à une panne (titre, explication, issue) ;
 *   - le tableau de bord n'annonce plus de travail actionnable au labo ;
 *   - rien ne déborde sur mobile.
 *
 * Usage : node scripts/verif-labo-suspendu.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/labo-suspendu'] = process.argv.slice(2);
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

  // ── L'écran du laboratoire ────────────────────────────────────────────
  await p.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.travaux', { timeout: 30000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${dir}/labo-desktop.png`, fullPage: true });

  const vu = await p.evaluate(() => ({
    titre: document.querySelector('.travaux__titre')?.textContent?.trim() || '',
    texte: document.querySelector('.travaux__texte')?.textContent?.trim() || '',
    note: document.querySelector('.travaux__note')?.textContent?.trim() || '',
    issue: !!document.querySelector('.travaux a[href="/agent"]'),
    // Plus aucun vestige de la chaîne : ni file d'attente, ni formulaire.
    vestiges: document.querySelectorAll('.worklist, .frise, .marqueurs, form').length,
    hauteur: document.documentElement.scrollHeight,
    debordement: Math.max(0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth),
  }));

  verifier('Message d\'attente affiché', vu.titre.length > 10, vu.titre);
  verifier('La raison est expliquée', /biologiste|préparation|validé/i.test(vu.texte));
  verifier('Le sort des poches est précisé', /conservé|prélèvement|traité/i.test(vu.note));
  verifier('Une issue est proposée', vu.issue, 'retour au tableau de bord');
  verifier('Aucun vestige de l\'ancienne chaîne', vu.vestiges === 0, `${vu.vestiges} éléments`);
  verifier('Aucune erreur JS', erreursJs.length === 0, erreursJs.join(' | '));
  verifier('Pas de débordement horizontal', vu.debordement === 0);
  console.log(`     hauteur de page : ${vu.hauteur}px`);

  // ── Le tableau de bord ne promet plus de travail au labo ──────────────
  await p.goto(`${BASE}/agent`, { waitUntil: 'domcontentloaded' });
  // `.section` existe déjà pendant le chargement (les squelettes vivent
  // dedans) : attendre la DISPARITION du squelette, sinon on capture les
  // blocs gris et le test juge un écran de chargement.
  await p.waitForSelector('.squelette', { state: 'detached', timeout: 30000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${dir}/bord-desktop.png`, fullPage: true });

  const bord = await p.evaluate(() => {
    const txt = document.body.innerText;
    return {
      // Les anciennes cartes détaillaient les étapes : elles ne doivent
      // plus apparaître, sinon l'agent croit pouvoir agir.
      detailEtapes: /à réceptionner|à grouper|en sérologie/i.test(txt),
      aLiberer: /Dossiers à libérer/i.test(txt),
      mentionAttente: /en cours de préparation/i.test(txt),
    };
  });
  verifier('Plus de détail par étape sur le tableau de bord', !bord.detailEtapes);
  verifier('Plus de carte « Dossiers à libérer »', !bord.aLiberer);
  verifier('Le tableau de bord annonce l\'attente', bord.mentionAttente);

  // ── Mobile ────────────────────────────────────────────────────────────
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(`${BASE}/agent/laboratoire`, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.travaux', { timeout: 30000 });
  await mob.waitForTimeout(500);
  await mob.screenshot({ path: `${dir}/labo-mobile.png`, fullPage: true });
  const debMob = await mob.evaluate(() => Math.max(0,
    document.documentElement.scrollWidth - document.documentElement.clientWidth));
  verifier('Mobile : pas de débordement', debMob === 0);

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
