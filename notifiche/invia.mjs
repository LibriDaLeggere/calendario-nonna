// Il «postino» di Bonaria: ogni mattina guarda le usanze di oggi e di domani e manda la notifica
// a tutti i telefoni che l'hanno attivata. Lo lancia GitHub Actions (.github/workflows/notifiche.yml).
//
// Variabili (segreti di GitHub): VAPID_PRIVATE, NOTIFICHE_TOKEN.
// Per le prove: PROVA=1 manda una notifica di prova; OGGI=AAAA-MM-GG fa finta che oggi sia quel giorno.
import webpush from "web-push";
import { readFileSync, appendFileSync } from "node:fs";

const ISCRIZIONI_URL = "https://script.google.com/macros/s/AKfycbxKrKKLw5fdLvzET2q0C6FYNtqhgQGaN5Mys1mEkO4KssrTM0gSq6f-Mc6Y8Wh6wvHD/exec";
const CHIAVE_PUBBLICA = readFileSync(new URL("./chiave-pubblica.txt", import.meta.url), "utf8").trim();
const { VAPID_PRIVATE, NOTIFICHE_TOKEN, PROVA, OGGI } = process.env;
if (!VAPID_PRIVATE || !NOTIFICHE_TOKEN) throw new Error("Mancano i segreti VAPID_PRIVATE o NOTIFICHE_TOKEN su GitHub.");

const romaOggi = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
const piu = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const oggi = /^\d{4}-\d{2}-\d{2}$/.test(OGGI || "") ? OGGI : romaOggi();
const domani = piu(oggi, 1);

// le notifiche da mandare oggi
const usanze = JSON.parse(readFileSync(new URL("../usanze.json", import.meta.url), "utf8"));
const elenco = lista => lista.length === 1 ? lista[0].titolo : `${lista[0].titolo} e altre ${lista.length - 1} usanze`;
const pagine = lista => lista.length === 1 ? `pagina ${lista[0].pagina}` : `pagine ${lista.map(u => u.pagina).join(", ")}`;
const messaggi = [];
if (PROVA) messaggi.push({ titolo: "Bonaria · prova", testo: "Le notifiche funzionano: ti avviserò il giorno prima e il giorno di ogni usanza.", tag: "prova" });
else {
  const diOggi = usanze.filter(u => u.data === oggi), diDomani = usanze.filter(u => u.data === domani);
  if (diOggi.length) messaggi.push({ titolo: `Oggi: ${elenco(diOggi)}`, testo: `La trovi a ${pagine(diOggi)} del libro. Apri Bonaria per vedere cosa ti serve.`, tag: "oggi-" + oggi });
  if (diDomani.length) messaggi.push({ titolo: `Domani: ${elenco(diDomani)}`, testo: `Preparati: ${pagine(diDomani)} del libro, con tutto quello che ti serve.`, tag: "domani-" + domani });
}
if (!messaggi.length) { console.log(`${oggi}: nessuna usanza oggi o domani, nessuna notifica.`); process.exit(0); }

// i telefoni iscritti, dal Google Sheet
const r = await fetch(`${ISCRIZIONI_URL}?azione=iscritti&token=${encodeURIComponent(NOTIFICHE_TOKEN)}`);
const testo = await r.text();
let iscritti;
try { iscritti = JSON.parse(testo); } catch { throw new Error("Il Google Sheet non ha dato l'elenco: " + testo.slice(0, 120)); }

webpush.setVapidDetails("mailto:bonastella.maria.mail@gmail.com", CHIAVE_PUBBLICA, VAPID_PRIVATE);
let inviate = 0, errori = 0;
const scaduti = new Set();
for (const m of messaggi) {
  for (const s of iscritti) {
    try { await webpush.sendNotification(s, JSON.stringify(m), { TTL: 12 * 3600, urgency: "normal" }); inviate++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) scaduti.add(s.endpoint); else { errori++; console.log("errore", e.statusCode || e.message); } }
  }
}

// i telefoni che hanno disinstallato l'app o tolto il permesso escono dall'elenco
if (scaduti.size) {
  await fetch(ISCRIZIONI_URL, { method: "POST", body: new URLSearchParams({ azione: "notifiche-scadute", token: NOTIFICHE_TOKEN, endpoint: [...scaduti].join("\n") }) });
}

const riga = `${oggi} · ${messaggi.map(m => m.titolo).join(" | ")} · telefoni ${iscritti.length} · inviate ${inviate} · scaduti ${scaduti.size} · errori ${errori}`;
console.log(riga);
appendFileSync(new URL("./registro.txt", import.meta.url), riga + "\n");
