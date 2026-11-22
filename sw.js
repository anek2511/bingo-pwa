'use strict';

const cachePrefix = 'bingo75-' + self.registration.scope + '-';
const cacheName = cachePrefix + 'v4';
const appFiles = ['./index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './mark.wav', './bingo.wav'];
const appURLs = new Set(appFiles.map(file => new URL(file, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(appFiles.map(file => new Request(file, { cache: 'reload' })))
  ).then(() => self.skipWaiting()));
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
  const range = request.headers.get('range');
  const audioRange = range && url.pathname.endsWith('.wav') && /^bytes=(\d+)-(\d*)$/.exec(range);
  if (range && !audioRange) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const response = await cache.match(asset);
    if (!response) return fetch(request);
    if (!audioRange) return response;

    const bytes = await response.arrayBuffer();
    const start = Number(audioRange[1]);
    const end = audioRange[2] ? Math.min(Number(audioRange[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': 'bytes */' + bytes.byteLength }
      });
    }
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(end - start + 1),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes.byteLength,
        'Accept-Ranges': 'bytes'
      }
    });
  })());
});
