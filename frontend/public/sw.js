// Changer la version lorsque la page de secours ou ses ressources changent.
const CACHE_NAME = "vedem-pwa-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  // La mise à jour attend la fermeture des onglets pour préserver les parcours en cours.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys
        .filter((key) => key.startsWith("vedem-pwa-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)));
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Seules les navigations HTML sont interceptées. API, mutations et réponses
  // privées (billets, commandes, administration) ne sont jamais mises en cache.
  if (request.method !== "GET" || request.mode !== "navigate"
    || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    }),
  );
});
