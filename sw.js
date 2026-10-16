// Service worker Saung Inspirasi: cache cangkang aplikasi agar bisa dibuka cepat/offline.
// Data (Apps Script) dan CDN TIDAK di-cache, jadi stok selalu terbaru.
const VERSI = "saung-v2";
const CANGKANG = [
  "./", "./login.html", "./index.html", "./style.css", "./script.js",
  "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(CANGKANG)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Hanya file milik aplikasi sendiri; Apps Script, font, dan CDN langsung ke jaringan
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Jaringan dulu (agar update kode langsung terlihat), cache sebagai cadangan offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        const salinan = res.clone();
        caches.open(VERSI).then((c) => c.put(req, salinan));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./login.html")))
  );
});
