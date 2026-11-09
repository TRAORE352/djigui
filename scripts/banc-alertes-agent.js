/**
 * Banc d'essai de l'écran « Appels au don ».
 *
 * Le défaut d'origine : les trois étapes du formulaire ne tenaient plus
 * en colonne parce que la classe `.etape` était redéfinie plus bas dans
 * la feuille de style par la frise du laboratoire (`inline-flex`). Le
 * premier contrôle ci-dessous mesure donc la LARGEUR réellement occupée
 * par chaque étape : c'est ce qu'une capture seule ne dit pas.
 *
 * Les réponses d'API sont simulées, mais toutes les interactions sont
 * réelles : cocher, tout sélectionner, cliquer un modèle, changer
 * l'urgence, envoyer.
 */
const { lancerNavigateur, contexteFr } = require('./navigateur-banc');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3101';
const DIR = process.argv[2] || '/root/alertes-apres';

const AGENT = {
  id: 'scene-1', nomComplet: 'Compaoré Awa', email: 'awa@exemple.test',
  roles: ['agent_stock', 'agent_accueil', 'agent_labo'],
  siteId: 'site-1', siteNom: 'Centre de transfusion de Ouagadougou',
};

const ZONES = [
  { id: 'z1', nom: 'Dassasgho', ville: 'Ouagadougou' },
  { id: 'z2', nom: 'Gounghin', ville: 'Ouagadougou' },
  { id: 'z3', nom: 'Kamsonghin', ville: 'Ouagadougou' },
  { id: 'z4', nom: 'Koulouba', ville: 'Ouagadougou' },
  { id: 'z5', nom: 'Paspanga', ville: 'Ouagadougou' },
  { id: 'z6', nom: 'Tanghin', ville: 'Ouagadougou' },
];

/** L'estimation dépend du nombre de zones : on vérifie qu'elle SUIT. */
const parZone = 37;

async function nouveauContexte(b, vue, prefs = {}) {
  // Locale et fuseau du poste réel : un champ `datetime-local` affiche
  // son format selon la locale DU NAVIGATEUR, pas selon `lang="fr"` du
  // document. Sans cette ligne le banc montre « mm/dd/yyyy » et laisse
  // croire à un défaut de l'application.
  const ctx = await contexteFr(b, {
    viewport: vue, deviceScaleFactor: 2,
  });
  await ctx.addInitScript(([a, p]) => {
    localStorage.setItem('dds:jeton-agent', 'jeton-de-scene');
    localStorage.setItem('dds:agent', JSON.stringify(a));
    for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v);
  }, [AGENT, prefs]);

  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!/\/api\//.test(u.pathname) && !/:4000/.test(u.host)) return route.continue();
    if (u.pathname.includes('/zones')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: ZONES }) });
    }
    if (u.pathname.includes('/alertes/estimation')) {
      const corps = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ donnees: { donneursCibles: (corps.zoneIds || []).length * parZone } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ donnees: [] }) });
  });
  return ctx;
}

async function capturer(p, chemin, largeur) {
  const h = await p.evaluate(() =>
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  await p.setViewportSize({ width: largeur, height: Math.min(h + 20, 5000) });
  await p.waitForTimeout(400);
  await p.screenshot({ path: chemin });
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await lancerNavigateur();
  const refus = [];
  const ok = (c, m) => { console.log((c ? '  OK  ' : ' ECHEC') + '  ' + m); if (!c) refus.push(m); };

  const ctx = await nouveauContexte(b, { width: 1440, height: 950 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (x) => erreurs.push(x.message.slice(0, 140)));
  await p.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForSelector('.zones', { timeout: 30000 });
  await p.waitForTimeout(700);

  // ---- 1. Les étapes ne flottent plus -------------------------------
  console.log('\n--- 1. Mise en page des étapes');
  const etapes = await p.evaluate(() => {
    const zone = document.querySelector('.contenu').getBoundingClientRect();
    return [...document.querySelectorAll('.etape')].map((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return {
        affichage: s.display,
        part: Math.round((r.width / zone.width) * 100),
        titre: e.querySelector('.etape__titre')?.textContent?.trim().slice(0, 28),
      };
    });
  });
  console.log(JSON.stringify(etapes, null, 2));
  ok(etapes.length === 3, `les trois étapes sont présentes (${etapes.length})`);
  ok(etapes.every((e) => e.affichage === 'flex'),
    `chaque étape est en colonne, pas en pastille (${etapes.map((e) => e.affichage).join(', ')})`);
  ok(etapes.every((e) => e.part >= 90),
    `chaque étape occupe la largeur (${etapes.map((e) => e.part + '%').join(', ')})`);

  // ---- 2. Bannière repliable ---------------------------------------
  console.log('\n--- 2. Bannière');
  ok(await p.locator('.explication__bascule').count() === 1, 'la bannière est repliable');
  const hOuverte = await p.evaluate(() => Math.round(document.querySelector('.explication').getBoundingClientRect().height));
  await p.click('.explication__bascule');
  await p.waitForTimeout(350);
  const hRepliee = await p.evaluate(() => Math.round(document.querySelector('.explication').getBoundingClientRect().height));
  ok(hRepliee < hOuverte, `hauteur du bandeau : ${hOuverte}px -> ${hRepliee}px (${hOuverte - hRepliee}px rendus)`);
  ok(await p.evaluate(() => localStorage.getItem('dds:explication:alertes')) === 'replie',
    'le choix est mémorisé sur le poste');

  // ---- 3. Sélection rapide des quartiers ----------------------------
  console.log('\n--- 3. Sélection rapide');
  const boutons = await p.locator('.lien-action').allTextContents();
  ok(boutons.includes('Tout sélectionner') && boutons.includes('Tout désélectionner'),
    `les deux actions rapides existent (${boutons.join(' / ')})`);

  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);
  const toutes = await p.evaluate(() => ({
    cochees: document.querySelectorAll('.case input:checked').length,
    compte: document.querySelector('.zones__compte')?.textContent?.trim(),
    estimation: document.querySelector('.estimation__chiffre')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(toutes, null, 2));
  ok(toutes.cochees === ZONES.length, `tout sélectionner coche les ${ZONES.length} quartiers (${toutes.cochees})`);
  ok(Number(toutes.estimation) === ZONES.length * parZone,
    `estimation à jour sans clic : ${toutes.estimation} attendu ${ZONES.length * parZone}`);

  // L'estimation doit SUIVRE la sélection, pas rester figée.
  await p.click('.case:first-child');
  await p.waitForTimeout(900);
  const apresDecoche = await p.evaluate(() => document.querySelector('.estimation__chiffre')?.textContent?.trim());
  ok(Number(apresDecoche) === (ZONES.length - 1) * parZone,
    `l'estimation suit la sélection : ${apresDecoche} après décochage`);

  await p.click('.lien-action:has-text("Tout désélectionner")');
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelectorAll('.case input:checked').length) === 0,
    'tout désélectionner vide la sélection');

  // ---- 4. Modèles de message ----------------------------------------
  console.log('\n--- 4. Modèles de message');
  const modeles = await p.locator('.modele').allTextContents();
  console.log('  modèles :', modeles.join(' | '));
  ok(modeles.length >= 3, `au moins trois modèles proposés (${modeles.length})`);
  await p.click('.modele:has-text("Urgence stock général")');
  await p.waitForTimeout(300);
  const apresModele = await p.evaluate(() => ({
    message: document.querySelector('.champ__saisie')?.value,
    urgence: document.querySelector('.urgence--choisie')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(apresModele, null, 2));
  ok((apresModele.message || '').length > 30, 'un clic remplit le message');
  ok(apresModele.urgence === 'Critique', `le modèle règle aussi l'urgence (${apresModele.urgence})`);

  // ---- 5. Urgence en badges colorés ---------------------------------
  console.log('\n--- 5. Degré d\'urgence');
  const urgences = await p.evaluate(() =>
    [...document.querySelectorAll('.urgence')].map((e) => ({
      mot: e.textContent.trim(),
      pastille: getComputedStyle(e.querySelector('.urgence__point')).backgroundColor,
      choisie: e.classList.contains('urgence--choisie'),
    })));
  console.log(JSON.stringify(urgences, null, 2));
  ok(urgences.length === 3, 'les trois niveaux sont des badges visibles sans clic');
  const couleurs = new Set(urgences.map((u) => u.pastille));
  ok(couleurs.size === 3, `chaque niveau a sa couleur (${couleurs.size} distinctes)`);
  await p.click('.urgence--normale');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.urgence--normale').classList.contains('urgence--choisie')),
    'cliquer un badge change le niveau');

  // ---- 6. Avertissement tant que l'envoi est impossible --------------
  console.log('\n--- 6. Avertissement et envoi');
  const avant = await p.evaluate(() => ({
    avertissement: document.querySelector('.avertissement')?.textContent?.trim(),
    boutonInactif: document.querySelector('.envoi__bouton')?.disabled,
  }));
  console.log(JSON.stringify(avant, null, 2));
  ok(!!avant.avertissement, 'un avertissement dit ce qui manque');
  ok(/quartier/.test(avant.avertissement || ''), 'il nomme l\'étape 1 quand aucune zone n\'est cochée');
  ok(avant.boutonInactif === true, 'le bouton d\'envoi reste inactif');

  await capturer(p, `${DIR}/1-avant-remplissage.png`, 1440);

  // On remplit tout, puis on vérifie que l'avertissement disparaît.
  await p.click('.lien-action:has-text("Tout sélectionner")');
  await p.waitForTimeout(900);
  const dans2h = new Date(Date.now() + 7_200_000).toISOString().slice(0, 16);
  await p.fill('input[type="datetime-local"]', dans2h);
  await p.waitForTimeout(400);
  const apres = await p.evaluate(() => ({
    avertissement: document.querySelectorAll('.avertissement').length,
    boutonInactif: document.querySelector('.envoi__bouton')?.disabled,
    portee: document.querySelector('.envoi__portee')?.textContent?.trim(),
  }));
  console.log(JSON.stringify(apres, null, 2));
  ok(apres.avertissement === 0, 'l\'avertissement disparaît une fois tout rempli');
  ok(apres.boutonInactif === false, 'le bouton d\'envoi devient actif');
  ok(/\d+ donneurs/.test(apres.portee || ''), `la portée de l'envoi est rappelée (${apres.portee})`);

  await capturer(p, `${DIR}/2-pret-a-envoyer.png`, 1440);

  // ---- 7. État vide du suivi ----------------------------------------
  const vide = await p.evaluate(() => {
    const e = document.querySelector('.etat-vide');
    if (!e) return null;
    const s = getComputedStyle(e);
    return { rayon: s.borderRadius, style: s.borderStyle, doux: e.classList.contains('etat-vide--doux') };
  });
  console.log('\n--- 7. Suivi (état vide)', JSON.stringify(vide));
  ok(vide && vide.doux && vide.rayon === '12px' && vide.style === 'solid',
    'l\'état vide du suivi est adouci (12px, trait continu)');

  // ---- 8. Mobile -----------------------------------------------------
  await ctx.close();
  const ctxM = await nouveauContexte(b, { width: 390, height: 844 });
  const pm = await ctxM.newPage();
  await pm.goto(`${BASE}/agent/alertes`, { waitUntil: 'networkidle', timeout: 90000 });
  await pm.waitForSelector('.zones', { timeout: 30000 });
  await pm.waitForTimeout(700);
  const mob = await pm.evaluate(() => {
    const zone = document.querySelector('.contenu').getBoundingClientRect();
    const et = document.querySelector('.etape').getBoundingClientRect();
    return {
      partEtape: Math.round((et.width / zone.width) * 100),
      debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  console.log('\n--- 8. Mobile', JSON.stringify(mob));
  ok(mob.partEtape >= 90, `les étapes occupent la largeur en mobile (${mob.partEtape}%)`);
  ok(!mob.debordement, 'aucun débordement horizontal en mobile');
  await capturer(pm, `${DIR}/3-mobile.png`, 390);
  await ctxM.close();

  if (erreurs.length) refus.push('Erreur JS : ' + erreurs[0]);
  console.log(refus.length ? `\n${refus.length} PROBLÈME(S) :\n  ` + refus.join('\n  ') : '\nToutes les vérifications passent.');
  await b.close();
  process.exit(refus.length ? 1 : 0);
})();