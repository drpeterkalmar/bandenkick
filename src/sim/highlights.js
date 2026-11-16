// Highlights (Peter 13.11.: „Spiel zur Halbzeit und nach Abpfiff die schönsten Tore ab“): Bestenliste der Tore eines Spiels.
// Je Tor (auch Gegentore) eine Kopie der Aufzeichnung mit wert (km/h + Technik-Bonus wie n6 „Tor des Spiels“) und Halbzeit;
// je Halbzeit nur die besten PRO_HALBZEIT (Speicher ≈ 1 MB je Clip). Eigentore zählen nur, wenn zu wenige andere da sind:
// beim Sortieren rangieren sie hinter allen anderen Toren. Ohne DOM/Three – Node-Test: tests/node/highlights.test.mjs
export const PRO_HALBZEIT = 3;
export const TECH_BONUS = { fallrueck: 60, seitfall: 50, flugkopf: 45, volley: 35, dropkick: 25, innenrist: 20, aussenrist: 25, ferse: 30 };
export const torWert = (kmh, tech) => (kmh || 0) + (TECH_BONUS[tech] || 0);
const rang = (x) => x.wert - (x.own ? 1000 : 0);

// Tor eintragen (x: {wert, halbzeit, own, ...}); behält je Halbzeit die besten n (Reihenfolge der Liste: nach Tor-Zeit)
export function merkeTor(liste, x, n = PRO_HALBZEIT) {
  liste.push(x);
  const h = liste.filter((y) => y.halbzeit === x.halbzeit);
  if (h.length > n) {
    const raus = h.reduce((a, b) => (rang(b) < rang(a) ? b : a));
    liste.splice(liste.indexOf(raus), 1);
  }
  return liste;
}

// die schönsten max Tore (halbzeit: nur diese Halbzeit, sonst alle), nach Rang absteigend
export function besteTore(liste, max, halbzeit = 0) {
  return liste.filter((y) => !halbzeit || y.halbzeit === halbzeit).sort((a, b) => rang(b) - rang(a)).slice(0, max);
}

// Ablauf: Halbzeit max. 2 (bestes zuerst, „⭐ Halbzeit-Highlights i/n“); Abpfiff max. 3, das beste zuletzt als „🏆 Tor des Spiels“
export function highlightFolge(liste, art) {
  if (art === 'halbzeit') {
    const b = besteTore(liste, 2, 1);
    return b.map((x, i) => ({ x, titel: `⭐ HALBZEIT-HIGHLIGHTS ${i + 1}/${b.length}` }));
  }
  const b = besteTore(liste, 3).reverse();
  return b.map((x, i) => ({ x, titel: i === b.length - 1 ? '🏆 TOR DES SPIELS' : `⭐ HIGHLIGHTS ${i + 1}/${b.length}` }));
}
