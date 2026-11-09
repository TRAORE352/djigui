/**
 * Mesure des contrastes WCAG de l'écran « Accueil et prélèvement ».
 *
 * Même méthode que pour le tableau de bord : on lit les couleurs
 * CALCULÉES, on remonte le fond effectif (un fond transparent n'est pas
 * blanc), et on applique la formule WCAG 2.1.
 *
 * Seuils : 4,5:1 texte courant, 3:1 gros texte (≥ 24 px, ou ≥ 18,66 px
 * en gras). Le texte d'un bouton désactivé est hors périmètre WCAG.
 */
const { chromium } = require('/root/node_modules/playwright-core');

const BASE = process.env.BASE || 'http://localhost:3101';

const AGENT = {
  id: 'scene-1', nomComplet: 'Compaoré Awa', email: 'awa@exemple.test',
  roles: ['agent_accueil', 'agent_labo', 'agent_stock'],
  siteId: 'site-1', siteNom: 'Centre de transfusion de Ouagadougou',
};

const DONNEUR = {
  id: 'd1', numeroDonneur: 'DN-2026-00418', nom: 'OUÉDRAOGO', prenom: 'Salimata',
  sexe: 'F', dateNaissance: '1994-03-12', telephone: '+22670112233',
  groupeSanguin: 'O-', actif: true, enPause: false, origine: 'application',
  zone: { id: 'z1', nom: 'Gounghin', ville: 'Ouagadougou' },
};

(async () => {
  const b = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript((a) => {
    localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
    localStorage.setItem('dds:agent', JSON.stringify(a));
  }, AGENT);
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
    if (u.pathname.includes('/donneurs')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: DONNEUR }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: [] }) });
  });

  const p = await ctx.newPage();
  await p.goto(`${BASE}/agent/accueil`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.recherche-donneur', { timeout: 30000 });
  await p.waitForTimeout(600);

  const outils = () => {
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const fond = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const a = c.includes('rgba') ? Number(c.split(',')[3]) : 1;
        if (c && c !== 'transparent' && a > 0.9) return rgb(c);
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    return { rgb, fond, ratio };
  };

  async function mesurer(cibles) {
    return p.evaluate(({ cibles, src }) => {
      const { rgb, fond, ratio } = new Function(`return (${src})()`)();
      return cibles.map(([nom, sel]) => {
        const el = document.querySelector(sel);
        if (!el) return { nom, absent: true };
        const s = getComputedStyle(el);
        const taille = parseFloat(s.fontSize);
        const gras = Number(s.fontWeight) >= 700;
        const gros = taille >= 24 || (gras && taille >= 18.66);
        return {
          nom, taille: Math.round(taille),
          ratio: Math.round(ratio(rgb(s.color), fond(el)) * 100) / 100,
          seuil: gros ? 3 : 4.5,
        };
      });
    }, { cibles, src: outils.toString() });
  }

  const avant = await mesurer([
    ['titre de page', '.contenu__titre'],
    ['description', '.contenu__chapeau'],
    ['action en-tête', '.contenu__entete .bouton'],
    ['bandeau rôle', '.explication__role'],
    ['bandeau Quand', '.explication__details dt'],
    ['bandeau texte', '.explication__details dd'],
    ['bascule masquer', '.explication__bascule'],
    ['étiquette champ', '.recherche-donneur__etiquette'],
    ['texte d\'aide', '.recherche-donneur__aide'],
    ['état vide titre', '.etat-vide__titre'],
    ['état vide texte', '.etat-vide__texte'],
  ]);

  // Bandeau replié, puis fiche du donneur : des éléments qui n'existent
  // pas dans l'état de repos.
  await p.click('.explication__bascule');
  await p.waitForTimeout(300);
  const replie = await mesurer([['résumé replié', '.explication__resume']]);

  await p.fill('#numero-donneur', '70112233');
  await p.waitForTimeout(200);
  const saisi = await mesurer([['numéro saisi', '.recherche-donneur__saisie input']]);
  await p.click('.recherche-donneur__bouton');
  await p.waitForSelector('.bloc-groupe', { timeout: 20000 });
  await p.waitForTimeout(400);
  const fiche = await mesurer([
    ['nom du donneur', '.titre-s'],
    ['clé de fiche', '.fiche__cle'],
    ['valeur de fiche', '.fiche__valeur'],
    ['pilule actif', '.pilule--seve'],
    ['bouton apte', '.bouton--principal'],
  ]);

  let echecs = 0;
  console.log('cible                     px   ratio   seuil  verdict');
  for (const m of [...avant, ...replie, ...saisi, ...fiche]) {
    if (m.absent) { console.log(`${m.nom.padEnd(24)}  — ABSENT`); echecs++; continue; }
    const ok = m.ratio >= m.seuil;
    if (!ok) echecs++;
    console.log(
      `${m.nom.padEnd(24)} ${String(m.taille).padStart(3)}  ${String(m.ratio).padStart(6)}  ${String(m.seuil).padStart(5)}  ${ok ? 'OK' : 'ÉCHEC'}`,
    );
  }
  console.log(echecs ? `\n${echecs} contraste(s) sous le seuil WCAG AA.` : '\nTous les contrastes passent WCAG AA.');
  await b.close();
  process.exit(echecs ? 1 : 0);
})();
