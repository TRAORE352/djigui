/**
 * Vérifie que le tableau de bord de l'agent ne reste JAMAIS bloqué sur
 * un squelette de chargement quand le serveur ne répond pas.
 *
 * Le défaut corrigé : les appels du tableau de bord partaient dans un
 * `Promise.all` sans délai ni garde d'erreur. Un backend qui accepte la
 * connexion sans répondre (base de données saturée) laissait la promesse
 * pendante pour toujours : l'agent regardait des blocs gris sans fin,
 * sans message ni moyen de réessayer.
 *
 * Ce banc provoque la panne au lieu de la simuler : il détourne les
 * appels d'API vers un trou noir qui ne répond jamais, puis vérifie que
 * l'écran finit par dire ce qui se passe et propose « Réessayer ».
 *
 * Usage : node scripts/verif-bord-panne.js [dossier-de-sortie]
 */
const { chromium } = require('/root/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:4000';
const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

(async () => {
  const [dir = '/root/bord-panne'] = process.argv.slice(2);
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

  const echecs = [];
  const verifier = (nom, ok, detail = '') => {
    console.log(`${ok ? 'OK   ' : 'ECHEC'} ${nom}${detail ? ' — ' + detail : ''}`);
    if (!ok) echecs.push(nom);
  };

  const p = await ctx.newPage();

  // Le trou noir : la requête part, rien ne revient jamais. C'est
  // exactement ce que faisait le backend avec son pool épuisé.
  let interceptees = 0;
  await p.route(`${API}/**`, async (route) => {
    interceptees += 1;
    // On ne répond pas, et on ne coupe pas : la requête reste en vol.
    await new Promise(() => {});
  });

  await p.goto(`${BASE}/agent`, { waitUntil: 'domcontentloaded' });

  // L'en-tête vient du stockage local : il doit s'afficher tout de suite,
  // même serveur muet. L'agent sait au moins où il est.
  await p.waitForSelector('.bord-entete__titre', { timeout: 15000 });
  verifier('L\'en-tête s\'affiche sans attendre le serveur', true);

  /*
   * Le délai du client est à 15 s. On attend le TEXTE de l'erreur, pas
   * seulement `role="alert"` : attendre l'attribut seul laissait passer
   * l'instant où l'élément existe mais n'est pas encore rempli, et les
   * assertions suivantes lisaient une page encore vide.
   */
  const erreurVue = await p
    .waitForSelector('.etat-vide__texte[role="alert"]', { timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  // Le bouton « Réessayer » est rendu juste après le message.
  if (erreurVue) {
    await p.getByRole('button', { name: /Réessayer/ }).waitFor({ timeout: 10000 }).catch(() => {});
  }

  await p.screenshot({ path: `${dir}/bord-panne.png`, fullPage: true });

  verifier('Les appels ont bien été interceptés', interceptees > 0, `${interceptees} requête(s)`);
  verifier('L\'écran finit par signaler la panne (pas de squelette éternel)', erreurVue);

  if (erreurVue) {
    const etat = await p.evaluate(() => ({
      message: document.querySelector('[role="alert"]')?.textContent?.trim() || '',
      titre: document.querySelector('.etat-vide__titre')?.textContent?.trim() || '',
      reessai: Array.from(document.querySelectorAll('button'))
        .some((x) => /réessayer/i.test(x.textContent || '')),
      squelettes: document.querySelectorAll('.squelette').length,
    }));
    verifier('Le message dit la cause', /trop de temps|connexion|répond/i.test(etat.message), etat.message);
    verifier('Un bouton « Réessayer » est proposé', etat.reessai);
    verifier('Plus aucun squelette affiché', etat.squelettes === 0, `${etat.squelettes} restant(s)`);
  }

  console.log(echecs.length ? `\n${echecs.length} échec(s)` : '\nTout passe.');
  await b.close();
  process.exit(echecs.length ? 1 : 0);
})();
