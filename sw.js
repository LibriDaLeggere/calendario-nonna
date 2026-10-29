// Tiene l'app disponibile anche senza connessione e mostra le notifiche. Cambiare VERSIONE a ogni aggiornamento dei file.
const VERSIONE = "nonna-v8";
const FILE = ["./", "index.html", "usanze.json", "bonaria.jpg", "icona-180.png", "icona-192.png", "icona-512.png", "manifest.webmanifest", "privacy.html"];

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

// notifica mandata dal «postino» su GitHub: {titolo, testo, tag}
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { testo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titolo || "Bonaria", {
    body: d.testo || "C'è un'usanza in arrivo: apri il calendario.",
    icon: "icona-192.png",
    badge: "icona-192.png",
    tag: d.tag || "bonaria",
    data: { url: "./" }
  }));
});

// tocco sulla notifica: apre Bonaria (o la porta in primo piano se è già aperta)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(finestre => {
    const aperta = finestre.find(f => new URL(f.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    return aperta ? aperta.focus() : self.clients.openWindow(e.notification.data.url);
  }));
});
