/**
 * Vérifie que chaque adresse sert bien SON espace, et refuse les autres.
 *
 * Un écran `"use client"` protégé par session rend un HTML quasi vide :
 * chercher « Espace CNTS » dans la page renvoie 0 sur un déploiement
 * parfaitement réussi. On lit donc :
 *   · les métadonnées (<title>), qui sont rendues côté serveur ;
 *   · les CODES (route de l'espace 200, route étrangère redirigée) ;
 *   · l'URL d'API inlinée dans le bundle, qui prouve que le front de prod
 *     parle bien au back de prod.
 */
const ADRESSES = [
  {
    nom: 'agent', base: 'https://djigui-agent.vercel.app',
    titre: 'Espace agent', porte: '/connexion/agent',
    sien: '/agent', etranger: '/admin', porteEtrangere: '/connexion/cnts',
  },
  {
    nom: 'cnts', base: 'https://djigui-cnts.vercel.app',
    titre: 'Espace CNTS', porte: '/connexion/cnts',
    sien: '/admin', etranger: '/agent', porteEtrangere: '/connexion/agent',
  },
];

const DONNEUR = 'https://mydjigui.vercel.app';
const API = 'https://djigui-api.vercel.app';

const echecs = [];
const ok = (c, m) => { console.log((c ? '  OK  ' : ' ECHEC') + '  ' + m); if (!c) echecs.push(m); };

/** Code HTTP sans suivre les redirections : c'est la redirection qu'on teste. */
async function code(url) {
  const r = await fetch(url, { redirect: 'manual' });
  return r.status;
}

(async () => {
  for (const a of ADRESSES) {
    console.log(`\n--- ${a.nom} (${a.base})`);

    const html = await (await fetch(a.base + a.porte)).text();
    const titre = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    ok(titre.includes(a.titre), `le titre servi annonce « ${a.titre} » (vu : ${titre || 'aucun'})`);
    ok(titre.includes('Djigui'), 'le titre porte la marque Djigui');

    // La porte de l'espace et ses écrans répondent.
    ok(await code(a.base + a.porte) === 200, `${a.porte} répond 200`);
    ok(await code(a.base + a.sien) === 200, `${a.sien} répond 200`);

    // Les chemins de l'AUTRE espace sont refusés, pas servis.
    const cEtranger = await code(a.base + a.etranger);
    ok(cEtranger === 307, `${a.etranger} (espace étranger) refusé — vu ${cEtranger}`);
    const cPorte = await code(a.base + a.porteEtrangere);
    ok(cPorte === 307, `${a.porteEtrangere} (porte étrangère) refusée — vu ${cPorte}`);

    // Une route inventée doit rester un 404 : sinon le middleware avalerait tout.
    const cFaux = await code(a.base + '/route-inventee-xyz');
    ok(cFaux === 307 || cFaux === 404, `route inventée non servie — vu ${cFaux}`);

    // Le front de prod parle-t-il au back de prod ?
    const assets = [...new Set((html.match(/\/_next\/[^"']+\.js/g) || []))].slice(0, 12);
    let trouve = false;
    for (const as of assets) {
      const js = await (await fetch(a.base + as)).text();
      if (js.includes('djigui-api.vercel.app')) { trouve = true; break; }
    }
    ok(trouve, `le bundle cite l'API de production (${assets.length} fichiers lus)`);
  }

  console.log('\n--- donneur et api');
  ok(await code(DONNEUR) === 200, `${DONNEUR} répond 200`);
  const ca = await code(API + '/api/sante');
  ok(ca === 200, `API ${API}/api/sante répond 200 — vu ${ca}`);

  console.log('\n--- anciennes adresses (doivent rediriger, pas mourir)');
  for (const [vieux, neuf] of [
    ['https://don-de-sang-plateforme.vercel.app', 'djigui-agent'],
    ['https://don-de-sang-donneur.vercel.app', 'mydjigui'],
  ]) {
    const c = await code(vieux);
    ok(c === 308 || c === 307, `${vieux} -> ${neuf} (vu ${c})`);
  }

  console.log(echecs.length ? `\n${echecs.length} ECHEC(S)` : '\nToutes les vérifications passent.');
  process.exit(echecs.length ? 1 : 0);
})();
