/**
 * Vérification visuelle du tableau de bord agent refondu.
 *
 * On ne dépend pas du backend de production : les réponses d'API sont
 * interceptées et remplacées par des données de scène contrôlées, afin de
 * voir ensemble les trois états de carte (urgent, à traiter, sous contrôle)
 * sur une seule capture. C'est un banc d'essai DESIGN, pas une preuve de
 * données — les chiffres affichés ici sont fabriqués exprès.
 *
 * Usage : BASE=http://localhost:3101 node scripts/banc-tableau-agent.js /root/bord-apres
 */
const { lancerNavigateur, contexteFr } = require('./navigateur-banc');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3101';
const DIR = process.argv[2] || '/root/bord-apres';

/** Agent de scène : plusieurs rôles, pour éprouver le bloc profil. */
const AGENT = {
  id: 'scene-1',
  nomComplet: 'Compaoré Awa',
  email: 'awa@exemple.test',
  roles: ['agent_labo', 'agent_stock', 'agent_accueil'],
  siteId: 'site-1',
  siteNom: 'Centre de transfusion de Ouagadougou',
};

/** Jeux de données : un scénario chargé, un scénario tout calme. */
const SCENES = {
  'charge': {
    '/poches/file-labo': {
      aRecevoir: [{ code: 'A' }, { code: 'B' }],
      aGrouper: [{ code: 'C' }],
      aTester: [],
      aLiberer: [{ code: 'D' }],
    },
    '/stock': [
      { typeProduit: 'CGR', groupeSanguin: 'O-', niveau: 'critique', unites: 1 },
      { typeProduit: 'CGR', groupeSanguin: 'B+', niveau: 'bas', unites: 4 },
    ],
    '/produits': [],
    '/demandes': [],
  },
  'calme': {
    '/poches/file-labo': { aRecevoir: [], aGrouper: [], aTester: [], aLiberer: [] },
    '/stock': [{ typeProduit: 'CGR', groupeSanguin: 'O+', niveau: 'normal', unites: 40 }],
    '/produits': [],
    '/demandes': [],
  },
};

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await lancerNavigateur();

  const refus = [];

  for (const [nom, scene] of Object.entries(SCENES)) {
    for (const vue of [{ k: 'desktop', w: 1440, h: 950 }, { k: 'mobile', w: 390, h: 844 }]) {
      const ctx = await contexteFr(b, {
        viewport: { width: vue.w, height: vue.h },
        deviceScaleFactor: 2,
      });
      await ctx.addInitScript((a) => {
        localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
        localStorage.setItem('dds:agent', JSON.stringify(a));
      }, AGENT);

      // Toute requête d'API renvoie la scène ; une route non prévue est
      // signalée plutôt que silencieusement vide.
      await ctx.route('**/*', async (route) => {
        const u = new URL(route.request().url());
        if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
        const cle = Object.keys(scene).find((k) => u.pathname.includes(k));
        if (!cle) { refus.push(`${nom}: route non simulée ${u.pathname}`); return route.fulfill({ status: 404, body: '{}' }); }
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ donnees: scene[cle] }),
        });
      });

      const p = await ctx.newPage();
      const erreurs = [];
      p.on('pageerror', (x) => erreurs.push(x.message.slice(0, 120)));

      try {
        await p.goto(`${BASE}/agent`, { waitUntil: 'networkidle', timeout: 90000 });
        await p.waitForSelector('.bord-entete__titre', { timeout: 30000 });
        await p.waitForFunction(() => document.querySelectorAll('.squelette').length === 0,
          null, { timeout: 20000 }).catch(() => {});
        await p.waitForTimeout(800);

        // Garde-fous : la refonte doit avoir produit ses éléments, et le
        // fil d'Ariane textuel doit avoir disparu.
        const etat = await p.evaluate(() => ({
          titre: document.querySelector('.bord-entete__titre')?.textContent?.trim(),
          jetons: [...document.querySelectorAll('.bord-jeton')].map((e) => e.textContent.trim()),
          statut: !!document.querySelector('.bord-statut'),
          horloge: document.querySelector('.bord-horloge')?.textContent?.trim(),
          cartes: [...document.querySelectorAll('.bord-carte')].map((e) => ({
            ton: /urgent|agir|calme/.exec(e.className)?.[0],
            badge: e.querySelector('.bord-badge')?.textContent?.trim() ?? null,
            valeur: e.querySelector('.bord-carte__valeur')?.textContent?.trim() ?? null,
            rassurant: e.querySelector('.bord-carte__rassurant')?.textContent?.trim() ?? null,
          })),
          principal: [...document.querySelectorAll('.bord-actions .bouton--principal')].map((e) => e.textContent.trim()),
          secondaires: [...document.querySelectorAll('.bord-actions .bouton--secondaire')].map((e) => e.textContent.trim()),
          ariane: document.body.innerText.includes('il me reste') || document.body.innerText.includes('il est '),
          profilNom: document.querySelector('.lateral__profil-nom')?.textContent?.trim(),
          profilRole: document.querySelector('.lateral__profil-role')?.textContent?.trim(),
          avatar: document.querySelector('.lateral__avatar')?.textContent?.trim(),
          actif: document.querySelector('.lateral__lien--actif')?.textContent?.trim(),
          rayon: getComputedStyle(document.querySelector('.bord-carte')).borderRadius,
        }));

        const h = await p.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
        await p.setViewportSize({ width: vue.w, height: Math.min(h + 20, 4000) });
        await p.waitForTimeout(400);
        await p.screenshot({ path: `${DIR}/${nom}-${vue.k}.png` });

        console.log(`\n=== ${nom} / ${vue.k} ===`);
        console.log(JSON.stringify(etat, null, 2));
        if (erreurs.length) refus.push(`${nom}/${vue.k} JS: ${erreurs[0]}`);
        if (etat.ariane) refus.push(`${nom}/${vue.k}: fil d'Ariane textuel encore présent`);
      } catch (x) {
        refus.push(`${nom}/${vue.k}: ${String(x.message).slice(0, 120)}`);
      }
      await ctx.close();
    }
  }

  console.log(refus.length ? '\nPROBLÈMES :\n  ' + refus.join('\n  ') : '\nAucun problème détecté.');
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();