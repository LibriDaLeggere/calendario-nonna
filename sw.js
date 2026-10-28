// Tiene l'app disponibile anche senza connessione. Cambiare VERSIONE a ogni aggiornamento dei file.
const VERSIONE = "nonna-v1";
const FILE = ["./", "index.html", "usanze.json", "bonaria.jpg", "plin.wav", "icona-192.png", "icona-512.png", "manifest.webmanifest", "privacy.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSIONE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

// prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata se si è offline
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => { const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(r, copia)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }))
  );
});
