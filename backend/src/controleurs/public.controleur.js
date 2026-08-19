// =====================================================================
//  DJIGUI — données publiques et diagnostic.
//  La liste des zones est publique : le formulaire d'inscription en a
//  besoin avant toute connexion (ajout à la liste 10.3, reporté en v1.2).
// =====================================================================
const { diagnostiquer, expliquerPanne } = require('../db');
const { listerZones } = require('../requetes/zones');

async function zonesPubliques(requete, reponse) {
  const zones = await listerZones();
  return reponse.json({
    zones: zones.map((zone) => ({ id_zone: zone.id_zone, nom: zone.nom, ville: zone.ville }))
  });
}

// GET /api/sante — l'écran de diagnostic. Il répond à la question
// « est-ce que tout est en place ? » en une seule requête.
async function sante(requete, reponse) {
  try {
    const etat = await diagnostiquer();
    const alertes = [];
    if (etat.nb_tables < 17) {
      alertes.push('Toutes les tables ne sont pas créées. Importez sql/01-creation.sql.');
    }
    if (etat.nb_parametres === 0) {
      alertes.push('Les paramètres sont absents. Importez sql/02-parametres.sql.');
    }
    if (etat.comptes_actifs.admin === 0) {
      alertes.push('Aucun administrateur. Lancez : npm run creer-admin');
    }
    if (etat.nb_structures === 0) {
      alertes.push('Aucune structure. Créez-en une dans Administration, Structures et zones.');
    }
    if (etat.nb_zones === 0) {
      alertes.push('Aucune zone. Sans zone, personne ne peut s\u2019inscrire. Créez-en dans Administration.');
    }
    return reponse.json({ etat: alertes.length === 0 ? 'pret' : 'incomplet', ...etat, alertes });
  } catch (erreur) {
    return reponse.status(503).json({
      etat: 'en_panne',
      base_connectee: false,
      alertes: [expliquerPanne(erreur)]
    });
  }
}

// Page lisible dans le navigateur, à l'adresse racine du service.
async function pageAccueil(requete, reponse) {
  let etat;
  try {
    etat = await diagnostiquer();
  } catch (erreur) {
    etat = { base_connectee: false, panne: expliquerPanne(erreur) };
  }
  const ligne = (mot, valeur) =>
    `<tr><td>${mot}</td><td class="v">${valeur}</td></tr>`;
  const corps = etat.base_connectee
    ? `<table>
         ${ligne('Base de données', 'connectée')}
         ${ligne('Tables', etat.nb_tables)}
         ${ligne('Réglages', etat.nb_parametres)}
         ${ligne('Zones', etat.nb_zones)}
         ${ligne('Structures', etat.nb_structures)}
         ${ligne('Administrateurs actifs', etat.comptes_actifs.admin)}
         ${ligne('Gestionnaires actifs', etat.comptes_actifs.gestionnaire)}
         ${ligne('Donneurs inscrits', etat.comptes_actifs.donneur)}
       </table>`
    : `<p class="panne">${etat.panne}</p>`;
  reponse.setHeader('Content-Type', 'text/html; charset=utf-8');
  return reponse.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>DJIGUI — service</title>
<style>
 body{font-family:system-ui,sans-serif;background:#FBF7F4;color:#241E1D;
      margin:0;padding:48px 24px;display:flex;justify-content:center}
 main{max-width:520px;width:100%}
 h1{font-size:28px;letter-spacing:.02em;border-bottom:2px solid #8C1C2C;
    display:inline-block;padding-bottom:6px;margin:0 0 4px}
 p.sous{color:#6B5F5C;margin:8px 0 28px}
 table{width:100%;border-collapse:collapse}
 td{padding:10px 0;border-top:1px solid #E5DCD6;font-size:15px}
 td.v{text-align:right;font-family:ui-monospace,monospace}
 .panne{border-left:4px solid #8C1C2C;padding:12px 16px;background:#fff}
 code{background:#fff;padding:2px 6px;border:1px solid #E5DCD6}
</style></head><body><main>
<h1>DJIGUI</h1>
<p class="sous">Couche de service. Cette page n\u2019est pas l\u2019application :
l\u2019application s\u2019ouvre sur <code>http://localhost:3000</code>.</p>
${corps}
<p class="sous" style="margin-top:28px">État détaillé au format machine :
<code>/api/sante</code></p>
</main></body></html>`);
}

module.exports = { zonesPubliques, sante, pageAccueil };
