/**
 * Mesure des contrastes WCAG de l'écran « Appels au don ».
 * Même méthode que les autres écrans : couleurs calculées, fond effectif
 * remonté, formule WCAG 2.1. Seuils 4,5:1 (texte) et 3:1 (gros texte).
 */
const { lancerNavigateur, contexteFr } = require('./navigateur-banc');

const BASE = process.env.BASE || 'http://localhost:3101';
const ZONES = [
  { id: 'z1', nom: 'Dassasgho', ville: 'Ouagadougou' },
  { id: 'z2', nom: 'Gounghin', ville: 'Ouagadougou' },
];

(async () => {
  const b = await lancerNavigateur();
  const ctx = await contexteFr(b, { viewport: { width: 1440, height: 950 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('dds:jeton-agent', 'x');
    localStorage.setItem('dds:agent', JSON.stringify({
      id: 's1', nomComplet: 'Compaoré Awa', email: 'a@b.c',
      roles: ['agent_stock'], siteId: 'site-1', siteNom: 'Centre de Ouagadougou' }));
  });
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return r.continue();
    if (u.pathname.includes('/zones')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: ZONES }) });
    if (u.pathname.includes('/alertes/estimation')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: { donneursCibles: 74 } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: [] }) });
  });

  const p = await ctx.newPage();
  await p.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.zones', { timeout: 30000 });
  await p.waitForTimeout(600);

  const outils = () => {
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const fond = (el) => { let n = el; while (n && n !== document.documentElement) { const c = getComputedStyle(n).backgroundColor; const a = c.includes('rgba') ? Number(c.split(',')[3]) : 1; if (c && c !== 'transparent' && a > 0.9) return rgb(c); n = n.parentElement; } return [255, 255, 255]; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
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
        const gros = taille >= 24 || (Number(s.fontWeight) >= 700 && taille >= 18.66);
        return { nom, taille: Math.round(taille), ratio: Math.round(ratio(rgb(s.color), fond(el)) * 100) / 100, seuil: gros ? 3 : 4.5 };
      });
    }, { cibles, src: outils.toString() });
  }

  const vide = await mesurer([
    ['titre de page', '.contenu__titre'],
    ['titre étape', '.etape__titre'],
    ['résumé étape', '.etape__resume'],
    ['numéro étape', '.etape__numero'],
    ['compte quartiers', '.zones__compte'],
    ['tout sélectionner', '.lien-action'],
    ['estimation vide', '.estimation--vide'],
    ['titre modèles', '.modeles__titre'],
    ['modèle inactif', '.modele'],
    ['urgence non choisie', '.urgence:not(.urgence--choisie)'],
    ['urgence choisie', '.urgence--choisie'],
    ['étiquette champ', '.champ__etiquette'],
    ['aide champ', '.champ__aide'],
    ['avertissement', '.avertissement'],
    ['état vide titre', '.etat-vide__titre'],
    ['état vide texte', '.etat-vide__texte'],
  ]);

  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);
  await p.click('.modele:first-child');
  await p.waitForTimeout(300);
  const rempli = await mesurer([
    ['estimation chiffre', '.estimation__chiffre'],
    ['estimation mot', '.estimation__mot'],
    ['estimation note', '.estimation__note'],
    ['modèle actif', '.modele--actif'],
    ['urgence critique', '.urgence--critique.urgence--choisie'],
  ]);

  let echecs = 0;
  console.log('cible                     px   ratio   seuil  verdict');
  for (const m of [...vide, ...rempli]) {
    if (m.absent) { console.log(`${m.nom.padEnd(24)}  — ABSENT`); echecs++; continue; }
    const ok = m.ratio >= m.seuil;
    if (!ok) echecs++;
    console.log(`${m.nom.padEnd(24)} ${String(m.taille).padStart(3)}  ${String(m.ratio).padStart(6)}  ${String(m.seuil).padStart(5)}  ${ok ? 'OK' : 'ÉCHEC'}`);
  }
  console.log(echecs ? `\n${echecs} contraste(s) sous le seuil WCAG AA.` : '\nTous les contrastes passent WCAG AA.');
  await b.close();
  process.exit(echecs ? 1 : 0);
})();
