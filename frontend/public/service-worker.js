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
