'use strict';
// Cache the interface only. Private API responses never enter Cache Storage.
// Last observations remain in this browser's existing local storage.
const version = 'web-tools-now-shell-computer-2';
const assets = ['/', '/phone.js', '/computer.js', '/reading.js', '/now-shared.js', '/usage-view.js', '/icon.svg', '/apple-touch-icon.png', '/manifest.webmanifest', '/vendor/tailwind.js', '/vendor/marked.js', '/vendor/purify.js', '/vendor/assistant-mark.js', '/vendor/claude-mark.js'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(version);
  await Promise.all(assets.map(async path => {
    const response = await fetch(path, {cache:'no-store'});
    if (!response.ok) throw new Error('Interface unavailable');
    await cache.put(path,response);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('web-tools-now-shell-') && key !== version) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !assets.includes(url.pathname)) return;
  event.respondWith((async () => {
    // Access denials are authoritative. A sleeping laptop or unavailable local
    // companion may produce a network error or a proxy/server error instead.
    try {
      const response = await fetch(event.request);
      if (response.status < 500) return response;
      return await (await caches.open(version)).match(url.pathname) || response;
    } catch { return await (await caches.open(version)).match(url.pathname) || Response.error(); }
  })());
});
