// Gabarito service worker — app shell offline; banco (Supabase) sempre pela rede
const CACHE = "gabarito-v43";
const SHELL = ["./", "index.html", "config.js", "sinonimos.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "gabarito-img").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  // imagens das questões (Storage, link assinado): cache pelo caminho, ignorando o token — funcionam offline
  if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/storage/v1/object/sign/")) {
    const key = url.origin + url.pathname;
    e.respondWith(caches.open("gabarito-img").then(c => c.match(key).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }))));
    return;
  }
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return; // dados: só rede
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
