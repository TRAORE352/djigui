// DJIGUI — agent de service.
// Sa présence rend l'application installable sur l'écran d'accueil (E12).
// Il garde aussi la coquille de l'application, pour que l'ouverture
// fonctionne quand le réseau est lent ou coupé (contrainte K7).
const CACHE = 'djigui-coquille-v1';
const RESSOURCES = ['/', '/manifest.json'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(RESSOURCES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))))
      .then(() => self.clients.claim())
  );
});

// Le réseau d'abord, le cache en secours : les données restent fraîches
// quand le réseau est là, et la page s'ouvre quand il est coupé.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || !requete.url.startsWith(self.location.origin)) return;
  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(requete, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(requete).then((trouve) => trouve || caches.match('/')))
  );
});

// Un appel au don arrive : { titre, corps, url }. Payload absent ou
// malformé → valeurs par défaut, jamais une notification vide ou une
// erreur qui ferait taire le push.
self.addEventListener('push', (evenement) => {
  let donnees = {};
  try { donnees = evenement.data ? evenement.data.json() : {}; } catch { donnees = {}; }

  const titre = donnees.titre || 'DJIGUI';
  const corps = donnees.corps || 'Un centre a besoin de votre groupe sanguin.';
  const url = donnees.url || '/alertes';

  evenement.waitUntil(
    self.registration.showNotification(titre, {
      body: corps,
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      data: { url }
    })
  );
});

// Réutilise un onglet DJIGUI déjà ouvert plutôt que d'en empiler un
// nouveau à chaque notification ; n'ouvre une fenêtre que si aucun
// onglet de l'application n'est là, OU si la reprise de l'onglet
// existant échoue pour une raison quelconque (fermé entre-temps, etc.)
// — le donneur atterrit toujours sur l'alerte, jamais un clic muet.
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const url = evenement.notification.data?.url || '/alertes';

  evenement.waitUntil((async () => {
    const fenetres = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const fenetreDjigui = fenetres.find((f) => f.url.startsWith(self.location.origin));

    if (fenetreDjigui) {
      try {
        await fenetreDjigui.focus();
        if ('navigate' in fenetreDjigui) await fenetreDjigui.navigate(url);
        return;
      } catch {
        // Repli sur l'ouverture d'une fenêtre plutôt qu'un clic sans effet.
      }
    }
    await clients.openWindow(url);
  })());
});
