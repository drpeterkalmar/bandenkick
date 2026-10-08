// Grafik-Steuerung für Bandenkick (n4-Technik, Audit #2): ersetzt die alte Automatik autoQuality() (nur abwärts, nur
// Bildabstand) durch den Qualitäts-Autopiloten aus dem Grafik-Kern (kern/autopilot.js, Kopie aus der Stuntbahn):
//   • misst Arbeitszeit je Bild (CPU, dazu GPU-Zeit, wenn der Browser sie liefert) und regelt AUF- und ABWÄRTS mit Hysterese,
//   • Reihenfolge nach unten: Renderskala (stufenlos) → Deko-Effekte schlank → Echtzeit-Schatten der Menschen → Grafikstufe;
//     nach oben umgekehrt, die Grafikstufe erst, wenn die Renderskala am Maximum ist (ein starkes Handy kommt so auf Stufe 2),
//   • Startwert der Renderskala aus einer Kurzmessung im Ladebildschirm (kern/startprobe.js), Ergebnis je Gerät gemerkt
//     (localStorage, 21 Tage); die zuletzt gefahrene Stufe merkt sich das Spiel separat (bk_grafik), weil die Kantenglättung
//     des Canvas schon beim Erzeugen des Renderers feststehen muss.
// Ohne three.js und ohne DOM (alle Wirkungen über Rückruf-Funktionen) → in Node testbar (tests/node/grafik.test.mjs).
// ?autopilot=0 = alte Automatik, ?q=0|1|2 = feste Stufe (Autopilot aus), ?startprobe=0 = ohne Kurzmessung.
import { GrafikAutopilot, GpuZeit } from './kern/autopilot.js';
import { skalaAusProbe } from './kern/startprobe.js';

export const DPR_CAP = [1, 1.5, 2];            // Bildschirm-Pixeldichte je Stufe (wie bisher)
// Renderskala ohne Kino-Look-Pipeline (Stufe 0 bzw. ?kino=0): Faktor auf die Pixeldichte [min, max, start]
// (alte Automatik: DPR in 0,25er-Schritten bis 1,0 → Stufe 1 von 1,5 auf 1,0 ≈ 0,67)
export const SKALA_DIREKT = [[0.75, 1, 1], [0.67, 1, 1], [0.6, 1, 1]];
// Kosten-Schätzungen (Anteil an der Bildzeit) für „passt das wieder rein?“. TODO n4-Heavy: mit perf_gate --ab nachmessen
export const KOSTEN = { deko: 0.06, menschenschatten: 0.08, stufe: 0.3 };

// Werte einer Stufe (wie bisher). schatten2 = Kantenlänge der Schattenkarte auf Stufe 2 (?schatten2=1024): die enge
// Schattenkamera (schatten.js) macht die Karte nur ±10–15,5 m statt ±15,5 m groß (Node-Rechnung, die TV-Kamera sieht fast
// den ganzen Käfig) – 1024 wäre auf Stufe 2 unschärfer als bisher 2048. TODO n4-Heavy: am Bild + Gate entscheiden.
export function stufenWerte(level, { dpr = 1, schatten2 = 2048 } = {}) {
  const l = Math.max(0, Math.min(2, Math.round(+level || 0)));
  return { level: l, dpr: Math.min(dpr || 1, DPR_CAP[l]), aa: l >= 1, shadows: l >= 1, shadowSize: l >= 2 ? schatten2 : 1024, avatarShadows: l >= 2 };
}

// Renderskalen-Bereich [min, max, start] je Stufe: aus dem Kino-Look (wenn er die Stufe mit Render-Target zeichnet), sonst direkt
export function skalaBereich(level, kino) {
  if (kino && kino.presets && kino.presets[level] && kino.presets[level].pipeline && (kino.stages ? kino.stages.scale !== false : true)) {
    const [st, lo, hi] = kino.scaleRangeOf(level);
    return [lo, hi, st];
  }
  return SKALA_DIREKT[level] || SKALA_DIREKT[1];
}

// Zuletzt gefahrene Stufe (je Browser-Profil ≈ Gerät): { stufe, t } → Stufe oder null (zu alt / kaputt)
const STUFE_KEY = 'bk_grafik';
export function ladeStufe(storage, jetzt = Date.now(), maxTage = 21) {
  try {
    const d = JSON.parse((storage && storage.getItem(STUFE_KEY)) || 'null');
    if (!d || !(d.stufe >= 0 && d.stufe <= 2) || !(jetzt - (d.t || 0) < maxTage * 864e5)) return null;
    return Math.round(d.stufe);
  } catch (e) { return null; }
}
export function merkeStufe(storage, stufe, jetzt = Date.now()) {
  try { storage && storage.setItem(STUFE_KEY, JSON.stringify({ stufe, t: jetzt })); return true; } catch (e) { return false; }
}

// Startstufe: ?q= gewinnt (fest), sonst gemerkte Stufe, sonst Touch → 1, Desktop → 2
export function startStufe({ q = null, gemerkt = null, touch = false, autopilot = true } = {}) {
  if (q != null && /^[012]$/.test(String(q))) return { stufe: +q, fest: true };
  if (autopilot && gemerkt != null) return { stufe: gemerkt, fest: false };
  return { stufe: touch ? 1 : 2, fest: false };
}

// Start-Renderskala aus der Kurzmessung (Median ms je Bild bei Skala `aktuell`) im Bereich der Stufe
export function startSkala(medianMs, bereich, aktuell) {
  const [lo, hi] = bereich;
  return skalaAusProbe(medianMs, { min: lo, max: hi, aktuell });
}

// Wirkungen (alle optional): stufe(l) – Stufe anwenden (Pixeldichte, Schatten, Kino-Stufe …), skala(s, l) – Renderskala
// (Kino-Look oder Pixeldichte), deko(an), menschenschatten(an), merke(zustand) – je Änderung speichern
export class GrafikSteuerung {
  constructor({ level = 1, kino = null, wirkung = {}, gl = null, einstellungen = null } = {}) {
    this.level = level; this.kino = kino; this.w = wirkung;
    this.dekoAn = true; this.menschenAn = true;
    const [lo, hi, st] = skalaBereich(level, kino);
    this.ap = new GrafikAutopilot({
      skala: { min: lo, max: hi, start: st, setzen: (s) => { this.skala = s; if (this.w.skala) this.w.skala(s, this.level); } },
      einstellungen,
      onAenderung: (e) => { this.lerneKosten(e); this.log.push(e); if (this.log.length > 40) this.log.shift(); if (this.w.merke) this.w.merke(this.zustand()); },
    });
    this.log = [];
    this.skala = st;
    this.ap.register('deko', KOSTEN.deko, (s) => { this.dekoAn = s > 0; if (this.w.deko) this.w.deko(this.dekoAn); });
    this.ap.register('menschenschatten', KOSTEN.menschenschatten, (s) => { this.menschenAn = s > 0; if (this.w.menschenschatten) this.w.menschenschatten(this.menschenAn); });
    this.ap.register('stufe', KOSTEN.stufe, (s, r) => {
      this.level = s;
      if (this.w.stufe) this.w.stufe(s);
      const [a, b, c] = skalaBereich(s, this.kino);
      return { skala: [a, b, r < 0 ? c : a] };   // runter: Start der Stufe; rauf: vorsichtig am Minimum
    }, { stufen: 2, start: level, raufBeiSkalaMax: true });
    // Der Kern hebt nur wieder an, was er selbst abgeschaltet hat (Stapel). Startet das Spiel unter Stufe 2 (Handy: 1),
    // liegen die fehlenden Stufen als „abgeschaltet“ auf dem Stapel → bei Luft und Renderskala am Maximum geht es hoch.
    const sd = this.ap.ding('stufe');
    for (let l = 2; l > level; l--) this.ap.stapel.unshift({ d: sd, skala: hi });
    this.gpu = gl ? new GpuZeit(gl) : null;
  }
  // Scheitert ein Schritt nach oben (kurz danach wieder herunter), war die Kosten-Schätzung zu klein: aus der gemessenen
  // Arbeit vorher/nachher lernen (z. B. Stufe 0 → 1: direktes Zeichnen → Render-Target, Schatten, MSAA ≈ ×2), damit der
  // Autopilot es nach der Sperre nicht wieder und wieder probiert (jedes Mal ~1,5 s Ruckeln). Nur mit GPU-Zeit (Arbeit bekannt).
  lerneKosten(e) {
    const r = this._rauf || (this._rauf = {});
    if (e.richtung > 0) { r[e.was] = e; return; }
    const u = r[e.was];
    if (u && e.t - u.t < this.ap.o.probeZeit + 0.6 && u.arbeit > 0 && e.arbeit > 0) {
      const d = this.ap.ding(e.was);
      if (d) d.kosten = Math.max(d.kosten, +(e.arbeit / u.arbeit - 1).toFixed(3));
    }
    r[e.was] = null;
  }
  // Start-Renderskala (Kurzmessung oder gespeichert) setzen
  start(skala) {
    if (skala != null) this.ap.setzeSkala(skala, true); else this.ap.setzeSkala(this.ap.skala, true);
    this.skala = this.ap.skala;
  }
  schonen(sek = 1.5) { this.ap.schonen(sek); }
  // ein Bild im Spiel: abstand (s, rAF), cpuMs (Arbeit der Spielschleife), GPU-Zeit aus GpuZeit (falls vorhanden)
  bild(abstand, cpuMs) { return this.ap.bild(abstand, cpuMs, this.gpu ? this.gpu.ms : null); }
  zustand() { return { ...this.ap.zustand(), level: this.level, deko: this.dekoAn, menschenschatten: this.menschenAn }; }
  // für info().auto.steps (Tests): kurze Texte der letzten Entscheidungen
  schritte() { return this.log.map((e) => `${e.was} ${e.richtung > 0 ? '+' : '−'} (Skala ${e.skala}, ${e.fps} fps)`); }
}
