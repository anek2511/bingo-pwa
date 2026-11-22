'use strict';

const cachePrefix = 'bingo75-' + self.registration.scope + '-';
const cacheName = cachePrefix + 'v2';
const appFiles = ['./index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './mark.wav', './bingo.wav'];
const appURLs = new Set(appFiles.map(file => new URL(file, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(appFiles.map(file => new Request(file, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  const entry = new URL('./index.html', self.registration.scope).href;
  const asset = url.href === self.registration.scope ? entry : url.href;
  if (!appURLs.has(asset)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(asset)) || fetch(request);
  })());
});
