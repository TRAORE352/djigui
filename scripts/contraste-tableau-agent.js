/**
 * Mesure des contrastes WCAG du tableau de bord agent.
 *
 * On ne juge pas le contraste à l'œil : on lit les couleurs CALCULÉES par
 * le navigateur, on remonte le fond effectif (un fond transparent n'est
 * pas blanc : c'est celui du parent), et on applique la formule WCAG 2.1.
 *
 * Seuils : 4,5:1 pour le texte courant, 3:1 pour le gros texte
 * (≥ 24 px, ou ≥ 18,66 px en gras).
 */
const { lancerNavigateur, contexteFr } = require('./navigateur-banc');

const BASE = process.env.BASE || 'http://localhost:3101';

const AGENT = {
  id: 'scene-1', nomComplet: 'Compaoré Awa', email: 'awa@exemple.test',
  roles: ['agent_labo', 'agent_stock', 'agent_accueil'],
  siteId: 'site-1', siteNom: 'Centre de transfusion de Ouagadougou',
};

const SCENE = {
  '/poches/file-labo': { aRecevoir: [{}, {}], aGrouper: [{}], aTester: [], aLiberer: [{}] },
  '/stock': [
    { typeProduit: 'CGR', groupeSanguin: 'O-', niveau: 'critique', unites: 1 },
    { typeProduit: 'CGR', groupeSanguin: 'B+', niveau: 'bas', unites: 4 },
  ],
  '/produits': [],
  '/demandes': [],
};

(async () => {
  const b = await lancerNavigateur();
  const ctx = await contexteFr(b, { viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript((a) => {
    localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
    localStorage.setItem('dds:agent', JSON.stringify(a));
  }, AGENT);
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
    const cle = Object.keys(SCENE).find((k) => u.pathname.includes(k));
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ donnees: cle ? SCENE[cle] : [] }),
    });
  });

  const p = await ctx.newPage();
  await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.bord-carte', { timeout: 30000 });
  await p.waitForTimeout(800);

  const mesures = await p.evaluate(() => {
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    /** Fond effectif : on remonte les parents tant que c'est transparent. */
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

    const cibles = [
      ['titre', '.bord-entete__titre'],
      ['jeton rôle', '.bord-jeton'],
      ['jeton centre', '.bord-jeton--sobre'],
      ['statut en ligne', '.bord-statut'],
      ['horloge', '.bord-horloge'],
      ['libellé urgent', '.bord-carte--urgent .bord-carte__libelle'],
      ['chiffre urgent', '.bord-carte--urgent .bord-carte__valeur'],
      ['badge urgent', '.bord-carte--urgent .bord-badge'],
      ['détail urgent', '.bord-carte--urgent .bord-carte__detail'],
      ['libellé agir', '.bord-carte--agir .bord-carte__libelle'],
      ['chiffre agir', '.bord-carte--agir .bord-carte__valeur'],
      ['badge agir', '.bord-carte--agir .bord-badge'],
      ['libellé calme', '.bord-carte--calme .bord-carte__libelle'],
      ['rassurant calme', '.bord-carte--calme .bord-carte__rassurant'],
      ['détail calme', '.bord-carte--calme .bord-carte__detail'],
      ['bouton principal', '.bord-actions .bouton--principal'],
      ['bouton secondaire', '.bord-actions .bouton--secondaire'],
      ['profil nom', '.lateral__profil-nom'],
      ['profil rôle', '.lateral__profil-role'],
      ['menu actif', '.lateral__lien--actif'],
      ['déconnexion', '.lateral__deconnexion'],
    ];

    return cibles.map(([nom, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return { nom, absent: true };
      const s = getComputedStyle(el);
      const taille = parseFloat(s.fontSize);
      const gras = Number(s.fontWeight) >= 700;
      const gros = taille >= 24 || (gras && taille >= 18.66);
      return {
        nom,
        taille: Math.round(taille),
        ratio: Math.round(ratio(rgb(s.color), fond(el)) * 100) / 100,
        seuil: gros ? 3 : 4.5,
      };
    });
  });

  let echecs = 0;
  console.log('cible                     px   ratio   seuil  verdict');
  for (const m of mesures) {
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