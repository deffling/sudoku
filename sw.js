const CACHE_NAME = 'sudoku-shell-@@BUILD_ID@@';
// On a slow connection the cached copy is used once the network has taken this long,
// and for the next SLOW_WINDOW_MS the cache answers at once while the network refreshes it.
const NETWORK_TIMEOUT_MS = 3000;
const SLOW_WINDOW_MS = 30000;
let slowUntil = 0;
const SHELL_ASSETS = [
  './',
  './sudoku.html',
  './sudoku.css',
  './logic.js',
  './sudoku.js',
  './vendor/qrcode.min.js',
  './manifest.webmanifest',
  './assets/kitchen-companion.png',
  './icons/favicon-48.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith('sudoku-shell-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(event, request));
});

// The cached copy of a request, or the game itself for a page that was never cached.
async function cachedCopy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  if (request.mode === 'navigate') return caches.match('./sudoku.html');
  return undefined;
}

// Network first, so a new version is picked up at once; the cache answers when
// the network fails or takes longer than NETWORK_TIMEOUT_MS.
async function networkFirst(event, request) {
  // 'no-cache' revalidates with the server, so the browser's own cache never serves an old game file.
  const network = fetch(request, { cache: 'no-cache' }).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
    }
    return response;
  });
  network.catch(() => {});   // a failure after the timeout needs no second report
  event.waitUntil(network.catch(() => {}));   // keep refreshing the cache after the page was answered

  if (Date.now() < slowUntil) {
    const cached = await cachedCopy(request);
    if (cached) return cached;
  }
  const afterTimeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS))
    .then(async () => {
      const cached = await cachedCopy(request);
      if (!cached) return network;
      slowUntil = Date.now() + SLOW_WINDOW_MS;
      return cached;
    });
  try {
    return await Promise.race([network, afterTimeout]);
  } catch {
    return (await cachedCopy(request)) || Response.error();
  }
}
