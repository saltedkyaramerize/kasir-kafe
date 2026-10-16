// Service worker — Saung Inspirasi
// Naikkan VERSION (v1 -> v2, dst.) setiap kali Anda mengubah index.html, login.html, script.js, atau style.css.
const VERSION = 'v1';
const CACHE = `saung-inspirasi-${VERSION}`;
const BASE = self.registration.scope; // mis. https://.../kasir-kafe/
const OFFLINE_URL = new URL('offline.html', BASE).href;

const PRECACHE = [
  './', 'login.html', 'index.html', 'style.css', 'script.js',
  'offline.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'
].map((p) => new URL(p, BASE).href);

// Pustaka pihak ketiga yang aman di-cache (font & library Excel).
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function simpan(req, res) {
  // Jangan simpan respons redirect/error agar tidak merusak navigasi.
  if (res && (res.type === 'opaque' || (res.ok && !res.redirected))) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // CDN (font & xlsx): stale-while-revalidate.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => { simpan(req, res); return res; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Domain lain (terutama Google Apps Script / spreadsheet): JANGAN disentuh,
  // supaya data stok selalu real-time dan tidak pernah basi dari cache.
  if (url.origin !== self.location.origin) return;

  // File aplikasi sendiri: network-first (selalu coba versi terbaru), cadangan cache.
  event.respondWith(
    fetch(req)
      .then((res) => { simpan(req, res); return res; })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match(OFFLINE_URL);
          return Response.error();
        })
      )
  );
});
