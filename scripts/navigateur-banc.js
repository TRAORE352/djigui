/**
 * Lancement du navigateur pour les bancs d'essai visuels.
 *
 * Pourquoi un module partagé : un banc n'a de valeur que s'il montre ce
 * que l'agent voit vraiment. Deux réglages faciles à oublier, et qui
 * produisent des faux défauts quand ils manquent :
 *
 *  · `LANG` du PROCESSUS. Les widgets natifs de Chromium (`date`,
 *    `datetime-local`, `time`) sont rendus par le système, pas par la
 *    page : ils ignorent `lang="fr"` du document, `locale` du contexte
 *    Playwright et même `--lang`. Le conteneur tourne en `C.UTF-8`, ce
 *    qui affiche « 11/25/2026, 09:05 PM » là où un poste français montre
 *    « 25/11/2026 21:05 ».
 *
 *  · `locale` + `timezoneId` du CONTEXTE, qui gouvernent eux les dates
 *    formatées en JavaScript (`toLocaleString`, `Intl`).
 *
 * Les deux sont nécessaires : ils ne couvrent pas les mêmes rendus.
 */
const { chromium } = require('/root/node_modules/playwright-core');

const CHROME = '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

/** Navigateur réglé comme le poste d'un agent au Burkina Faso. */
async function lancerNavigateur() {
  return chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=fr-FR'],
    env: { ...process.env, LANG: 'fr_FR.UTF-8', LC_ALL: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR' },
  });
}

/** Contexte français, fuseau d'Ouagadougou. */
async function contexteFr(navigateur, options = {}) {
  return navigateur.newContext({
    locale: 'fr-FR',
    timezoneId: 'Africa/Ouagadougou',
    ...options,
  });
}

module.exports = { lancerNavigateur, contexteFr, CHROME };
