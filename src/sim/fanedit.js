// Fan-Edit der Tor-Wiederholung (n6, Peter 09.10.2026: „Mit Fan-Cam meinte ich eigentlich so ein überdrehtes,
// TikTok-artiges Video mit Effekten und Zooms usw.“). Ein „Velocity Edit“ aus dem Ringpuffer (ReplayRecorder), ohne DOM
// und ohne three.js (läuft auch in Node, tests/node/fanedit.test.mjs):
//  - Schnittraster: stummer Takt (EDIT_BPM), jede Einstellung beginnt genau auf einem Schlag. Bandenkick bleibt lautlos –
//    der Takt wird sichtbar (Bild-Pulse, Zoom-Punches, Text-Einschläge, Wackler nur auf dem Schlag).
//  - Einstellungen: Seitenlinie tief (Anlauf) → Makro Fuß/Ball (fast Standbild am Kontakt) → Torwart-Sicht (schnell) →
//    hinter dem Tor (Netz zappelt, Einschlag auf dem Schlag) → Standbild weit mit Kontur um den Schützen → derselbe Schuss
//    aus drei Winkeln (Drohne, hinter dem Schützen, Torecke) → Jubel in Zeitlupe.
//  - Tempo je Einstellung als monotone Kurve Echtzeit → Spielzeit (Speed-Ramps ohne Sprünge innerhalb einer Einstellung,
//    Standbild = flaches Stück). Harte Schnitte nur an den Einstellungsgrenzen (= Schläge).
//  - Effekt-Fahrplan je Schlag: Weiß-Flash (höchstens 3, je < 120 ms), Zoom-Punch, Wackler, RGB-Versatz, Wischschwenk,
//    Speed-Lines, Leuchten/Kometenschweif am Ball. opts.reduce („Blitze reduzieren“): sanftes Aufhellen statt Flash,
//    kein RGB-Versatz, weniger Wackler und Punches.
//  - Kamera-Rechnung (Lage, Blickpunkt, Öffnungswinkel) inkl. Effekten – die Grafik setzt sie nur um.
import { findContact, REC_HZ } from './replay.js';

export const EDIT_BPM = 128;
export const BEAT = 60 / EDIT_BPM; // s je Schlag (0,469 s)
export const EDIT_DELAY = 2.0;     // s Live-Jubel vor dem Clip (der Jubel-Teil des Clips braucht Aufzeichnung nach dem Tor)
export const FLASH_MAX = 3, FLASH_S = 0.09;

// Technik → Einblendung (Großbuchstaben, TikTok-Stil). Angeschnittene Schüsse heißen „BANANE“.
export const EDIT_TECH = {
  // „|“ = Zeilenumbruch (lange Wörter zweizeilig statt kleiner)
  vollspann: 'VOLLSPANN', innenrist: 'BANANE', aussenrist: 'AUSSENRIST-|BANANE', innen: 'INNEN-|SEITE', aussen: 'AUSSEN-|RIST',
  volley: 'VOLLEY', dropkick: 'DROPKICK', seitfall: 'SEITFALL-|ZIEHER', fallrueck: 'FALLRÜCK-|ZIEHER', kopf: 'KOPFBALL',
  flugkopf: 'FLUG-|KOPFBALL', ferse: 'HACKE', chip: 'LUPFER', heber: 'LUPFER', brust: 'BRUST', oberschenkel: 'OBER-|SCHENKEL',
  graetsche: 'GRÄTSCHE', stolpern: 'STOLPER-|TOR',
};
// Untertitel-Gags (Bildunterschrift oben wie bei TikTok und kurzer Spruch beim Jubel)
export const EDIT_POV = [
  'POV: der Torwart dachte, er hat ihn 🙏', 'POV: du sagst „schieß doch einfach“', 'Wenn der Ball Feierabend im Netz macht',
  'Niemand: … Absolut niemand: … Er:', 'Physiklehrer hassen diesen Trick', 'POV: Hallenkick um 22 Uhr',
];
export const EDIT_GAG = [
  'Torwart.exe reagiert nicht', 'Netz braucht jetzt Urlaub', 'Lieferung zugestellt 📦', 'Das war Steuerhinterziehung für Torhüter',
  'Bro hat das Netz gefrühstückt', 'Kein VAR kann das retten', 'Erklär das mal deiner Oma', 'Mama, ich bin im Fernsehen',
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Monotone kubische Kurve durch Stützpunkte [[x, y], …] (Fritsch–Carlson): x streng steigend, y nicht fallend →
// Spielzeit läuft nie rückwärts, flache Stücke (Standbild) bleiben flach, Tempo stetig innerhalb der Einstellung.
export function monoKurve(P) {
  const n = P.length, x = P.map((p) => p[0]), y = P.map((p) => p[1]), d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
  if (n === 1) return { at: () => y[0], rate: () => 0, x0: x[0], x1: x[0] };
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  const seg = (v) => { let i = 0; while (i < n - 2 && v > x[i + 1]) i++; return i; };
  return {
    x0: x[0], x1: x[n - 1],
    at(v) {
      v = clamp(v, x[0], x[n - 1]);
      const i = seg(v), h = x[i + 1] - x[i], u = (v - x[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
    },
    rate(v) {
      v = clamp(v, x[0], x[n - 1]);
      const i = seg(v), h = x[i + 1] - x[i], u = (v - x[i]) / h, u2 = u * u;
      return ((6 * u2 - 6 * u) * y[i] + (3 * u2 - 4 * u + 1) * h * m[i] + (-6 * u2 + 6 * u) * y[i + 1] + (3 * u2 - 2 * u) * h * m[i + 1]) / h;
    },
  };
}

// Einschlag ins Netz: erstes Netz-Ereignis nach dem Tor (sonst knapp nach dem Tor)
function einschlag(rec, tg) {
  for (const e of rec.events) if (e.type === 'net' && e.t >= tg - 0.05 && e.t <= tg + 0.8) return e.t;
  return tg + 0.04;
}

// Ablauf in Schlägen. b0/b1 = Einstellung von Schlag b0 bis b1 (Schnitt auf b0), keys = Stützpunkte [Sekunden ab b0,
// Spielzeit], cam = Kamera, whip = Wischschwenk in diese Einstellung, glow = Ball leuchtet (nach dem Kontakt)
function plan(tc, ti, tEnd, tFirst, tg, jub, winkel) {
  const B = BEAT, F = Math.max(0.12, ti - tc), cl = (t) => clamp(t, tFirst, tEnd);
  // Jubel: nach dem Tor stehen alle ≈ 1,2 s still (Jubelpose), danach laufen sie zum Anstoß → Fenster bis 1,15 s nach dem Tor
  const jubel1 = cl(jub ? jub[1] : Math.min(tEnd - 0.02, tg + 1.15)), jubel0 = cl(jub ? jub[0] : Math.min(jubel1 - 0.3, Math.max(ti + 0.25, jubel1 - 1.0)));
  const W = winkel || ['drohne', 'hinten', 'ecke'];
  return [
    { name: 'anlauf', cam: 'tief', b0: 0, b1: 2, keys: [[0, cl(tc - 0.95)], [2 * B - 0.2, cl(tc - 0.16)], [2 * B, cl(tc - 0.12)]] },
    // Kontakt genau auf Schlag 3, davor/danach fast Standbild (≈ 0,05×), am Ende ruckartig schneller
    { name: 'kontakt', cam: 'makro', b0: 2, b1: 4, keys: [[0, cl(tc - 0.1)], [0.2, cl(tc - 0.016)], [B, tc], [B + 0.27, cl(tc + 0.012)], [2 * B, cl(tc + Math.min(0.2, F * 0.4))]] },
    { name: 'torwart', cam: 'keeper', b0: 4, b1: 5, whip: 1, keys: [[0, cl(tc + Math.min(0.03, F * 0.1))], [0.15, cl(tc + Math.min(0.08, F * 0.25))], [B, cl(ti - Math.min(0.06, F * 0.15))]] },
    // Netzeinschlag genau auf Schlag 6
    { name: 'netz', cam: 'netz', b0: 5, b1: 7, keys: [[0, cl(ti - Math.min(0.22, F * 0.6))], [B, ti], [2 * B, cl(ti + 0.2)]] },
    { name: 'standbild', cam: 'weit', b0: 7, b1: 8, freeze: 1, keys: [[0, ti], [B, ti]] },
    { name: 'winkel1', cam: W[0], b0: 8, b1: 9, whip: 1, keys: [[0, cl(tc - 0.12)], [B, cl(ti + 0.03)]] },
    { name: 'winkel2', cam: W[1], b0: 9, b1: 10, whip: -1, keys: [[0, cl(tc - 0.12)], [B, cl(ti + 0.03)]] },
    { name: 'winkel3', cam: W[2], b0: 10, b1: 11, whip: 1, keys: [[0, cl(tc - 0.12)], [B, cl(ti + 0.03)]] },
    // Jubel in zwei Einstellungen: frontal von unten (Fahrt heran), dann nah seitlich mit Wischschwenk
    { name: 'jubel', cam: 'jubel', b0: 11, b1: 13, keys: [[0, jubel0], [2 * B, (jubel0 + jubel1) / 2]] },
    { name: 'jubel2', cam: 'jubel2', b0: 13, b1: 15, whip: -1, keys: [[0, (jubel0 + jubel1) / 2], [2 * B, jubel1]] },
  ];
}

// Effekt-Ereignisse je Schlag. flash: Weiß-Flash (Drop), punch: Zoom-Punch (Stärke), shake: Wackler, ca: RGB-Versatz,
// text: Einblendung (vom HUD gezeichnet)
function fahrplan() {
  return [
    { b: 0, text: 'pov' }, { b: 0, punch: 0.25 },
    { b: 1, punch: 0.25 }, { b: 2, punch: 0.45 },
    { b: 3, flash: 1, punch: 1, ca: 1, shake: 0.35, text: 'technik', emoji: '😱' },
    { b: 4, punch: 0.6, ca: 0.4, text: 'kmh', lines: 1 },
    { b: 5, punch: 0.35, text: 'kmhStempel' },
    { b: 6, flash: 1, punch: 1, ca: 1, shake: 1, text: 'golazo', emoji: '💥' },
    { b: 7, punch: 0.3, text: 'kontur', emoji: '🐐' },
    { b: 8, punch: 0.7, ca: 0.35, text: 'x1', lines: 1 },
    { b: 9, punch: 0.7, ca: 0.35, text: 'x2', lines: 1 },
    { b: 10, punch: 0.7, ca: 0.35, text: 'x3', lines: 1 },
    { b: 11, flash: 1, punch: 1, ca: 0.8, shake: 0.5, text: 'name', emoji: '🔥' },
    { b: 12, punch: 0.35, shake: 0.25 }, { b: 12.5, text: 'gag' },
    { b: 13, punch: 0.8, shake: 0.4, ca: 0.45, emoji: '⚡' },
    { b: 14, punch: 0.35, shake: 0.25, text: 'ende' },
  ];
}

export class FanEdit {
  // opts: {reduce: Blitze reduzieren, seed: Zahl für Gags/Wackeln}
  constructor(rec, goal, opts = {}) {
    this.edit = true; this.rec = rec; this.goal = goal; this.reduce = !!opts.reduce;
    const seed = Math.abs(Math.round(opts.seed ?? goal.t * 1000)) || 1;
    this.seed = seed;
    const e = findContact(rec, goal);
    let c = null;
    if (e) {
      const f = rec.frameAt(e.t + 1 / 60, {});
      const v = f ? f.ball.v : { x: e.dx || 1, z: e.dz || 0 };
      c = { t: e.t, x: e.x, y: e.y, z: e.z, dx: v.x, dz: v.z, speed: e.speed || (f ? Math.hypot(f.ball.v.x, f.ball.v.y, f.ball.v.z) : 0), tech: e.tech || '', player: e.player, type: e.type };
    }
    this.contact = c;
    const tg = goal.t, tFirst = rec.tFirst, tLast = rec.tLast;
    const tc = clamp(c ? c.t : tg - 0.5, tFirst + 0.05, tg);
    const ti = clamp(einschlag(rec, tg), tc + 0.05, tLast);
    this.tc = tc; this.ti = ti;
    this.schuetze = goal.scorer >= 0 ? goal.scorer : c ? c.player : -1;
    this.makroDir = c ? freieSicht(rec, [tc - 0.1, tc, tc + 0.08], [c.x, c.z], makroWinkel(c), 1.75, c.player) : null;
    // Jubel erst, wenn der Schütze wieder steht (nach Fallrückzieher, Flugkopfball, Hechten), sonst ≈ 1 s nach dem Tor
    let tu = Math.max(ti + 0.25, tg + 0.15);
    if (this.schuetze >= 0) {
      const ok = (t) => rec.aufrecht(this.schuetze, t) && rec.aufrecht(this.schuetze, t + 0.15);
      while (tu < tLast - 0.6 && !ok(tu)) tu += 0.05;
    }
    const jub = [Math.min(tu, tLast - 0.4), Math.min(tLast - 0.02, Math.max(tu, tLast - 0.4) + 1.0)];
    // derselbe Schuss aus drei Winkeln – Reihenfolge je Tor anders
    const WK = [['drohne', 'hinten', 'ecke'], ['hinten', 'drohne', 'ecke'], ['ecke', 'drohne', 'hinten'], ['drohne', 'ecke', 'hinten']][seed % 4];
    this.jubelClip = seed % 2 ? 'cheer' : 'cheer2'; this.jubelVersatz = seed % 2 ? 1.8 : 0.8; // Faust ballen / Faust küssen
    this.shots = plan(tc, ti, tLast, tFirst, tg, jub, WK).map((s) => ({ ...s, t0: s.b0 * BEAT, t1: s.b1 * BEAT, k: monoKurve(s.keys) }));
    this.events = fahrplan().map((x) => ({ ...x, t: x.b * BEAT }));
    // Flashes: höchstens FLASH_MAX, im reduzierten Modus nur sanftes Aufhellen
    let nf = 0; for (const x of this.events) if (x.flash && ++nf > FLASH_MAX) x.flash = 0;
    this.realTotal = this.shots[this.shots.length - 1].t1;
    this.segs = this.shots.map((s) => ({ name: s.name, cam: s.cam, t0: s.keys[0][1], t1: s.keys[s.keys.length - 1][1], rate: 1 }));
    this.pov = EDIT_POV[seed % EDIT_POV.length];
    this.gag = EDIT_GAG[(seed >> 3) % EDIT_GAG.length];
    this.tech = c ? EDIT_TECH[c.tech] || (c.type === 'air' ? 'VOLLEY' : 'KNALLER') : 'ABSTAUBER';
    this.kmh = c ? Math.round((c.speed || 0) * 3.6) : 0;
    this.real = 0; this.i = 0; this.done = false; this.skipped = false; this.schnitte = 0;
    this.t = this.shots[0].k.at(0);
  }
  get phase() { return this.done ? 'ende' : this.shots[this.i].name; }
  get cur() { const s = this.shots[Math.min(this.i, this.shots.length - 1)]; return { name: s.name, cam: s.cam, rate: 1 }; }
  get beat() { return this.real / BEAT; }
  segFrac() { const s = this.shots[Math.min(this.i, this.shots.length - 1)]; return clamp((this.real - s.t0) / (s.t1 - s.t0), 0, 1); }
  // Einstellung zur Clip-Zeit r (Echtzeit ab Start)
  shotAt(r) { let i = 0; while (i < this.shots.length - 1 && r >= this.shots[i].t1) i++; return i; }
  spielzeit(r) { const s = this.shots[this.shotAt(r)]; return s.k.at(r - s.t0); }
  rateAt() { const s = this.shots[this.i]; return s.k.rate(this.real - s.t0); }
  update(dt) {
    if (this.done) return this.t;
    this.real += dt;
    if (this.real >= this.realTotal) { this.done = true; this.real = this.realTotal; }
    const i = this.shotAt(Math.min(this.real, this.realTotal - 1e-6));
    if (i !== this.i) { this.i = i; this.schnitte++; }
    this.t = this.spielzeit(Math.min(this.real, this.realTotal - 1e-6));
    return this.t;
  }
  skip() { this.done = true; this.skipped = true; }
  nochmal() { this.real = 0; this.i = 0; this.done = false; this.skipped = false; this.t = this.shots[0].k.at(0); }

  // Effekte zur Clip-Zeit r: Stärken 0…1 (Bild-Effekte im Nachbearbeitungs-Pass bzw. CSS)
  fx(r = this.real) {
    const R = this.reduce, o = { flash: 0, white: 0, punch: 0, shake: 0, ca: 0, lines: 0, puls: 0, glow: 0, whip: 0, whipDir: 0, freeze: 0, grain: 0.07 };
    // Schlag-Puls (jeder Schlag): kurz heller und etwas näher
    const bp = r / BEAT - Math.floor(r / BEAT), pt = bp * BEAT;
    o.puls = Math.exp(-pt / 0.09);
    for (const e of this.events) {
      const dt = r - e.t;
      if (dt < -0.06 || dt > 0.6) continue;
      if (e.flash) {
        if (R) { if (dt >= 0) o.white = Math.max(o.white, 0.22 * Math.sin(Math.PI * clamp(dt / 0.3, 0, 1))); } // sanftes Aufhellen
        else if (dt >= 0 && dt < FLASH_S) { o.white = Math.max(o.white, 0.9 * (1 - dt / FLASH_S)); o.flash = 1; }
      }
      if (e.punch && dt >= -0.03) {
        // schneller Ran-Zoom (30 ms rein, dann abklingen); kurz vor dem Schlag schon anlaufen
        const k = dt < 0 ? 1 + dt / 0.03 : Math.exp(-dt / 0.14);
        o.punch = Math.max(o.punch, e.punch * clamp(k, 0, 1) * (R ? 0.5 : 1));
      }
      if (e.shake && dt >= 0) o.shake = Math.max(o.shake, e.shake * Math.exp(-dt / 0.12) * (R ? 0.3 : 1));
      if (e.ca && dt >= 0 && !R) o.ca = Math.max(o.ca, e.ca * Math.exp(-dt / 0.1));
    }
    const s = this.shots[this.shotAt(r)], u = r - s.t0, rest = s.t1 - r;
    // Wischschwenk: die letzten 0,07 s vor einem Schnitt in eine Wisch-Einstellung und die ersten 0,12 s danach
    const nx = this.shots[this.shotAt(r) + 1];
    if (s.whip && u < 0.12) { o.whip = 1 - ss(u / 0.12); o.whipDir = s.whip; }
    else if (nx && nx.whip && rest < 0.07) { o.whip = ss(1 - rest / 0.07) * 0.8; o.whipDir = -nx.whip; }
    if (s.cam === 'keeper' || s.name.startsWith('winkel')) o.lines = 0.8 * (1 - ss((u - s.t1 + s.t0 + 0.25) / 0.25));
    if (s.freeze) { o.freeze = 1; o.lines = 0; }
    const t = s.k.at(u);
    o.glow = t >= this.tc - 0.01 && t <= this.ti + 0.35 ? 1 : 0;
    // Ende: abblenden
    o.fade = ss((r - (this.realTotal - 0.3)) / 0.3);
    return o;
  }
}

// Feldseite des Kontakts (Kamera quer zur Schussrichtung auf der Seite zur Feldmitte) und Standard-Winkel der Makro-Kamera
export function kontaktSeite(c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; return nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
function makroWinkel(c) {
  const dl = Math.hypot(c.dx, c.dz) || 1, ux = c.dx / dl, uz = c.dz / dl, sd = kontaktSeite(c), nx = -uz * sd, nz = ux * sd;
  const ca = Math.cos(0.5), sa = Math.sin(0.5);
  return Math.atan2(nz * ca - uz * sa, nx * ca - ux * sa); // schräg von vorn-seitlich
}
// Winkel (um das Ziel z = [x, z]) möglichst nah an a0, bei dem über die Zeiten ts niemand (außer `ohne`) zwischen Kamera im
// Abstand D und Ziel steht (≥ 0,55 m neben der Sichtlinie)
export function freieSicht(rec, ts, z, a0, D, ohne = -1) {
  const fr = {};
  let best = a0, bestFrei = -1;
  for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 7]) {
    const a = a0 + d * 0.42, cx = z[0] + Math.cos(a) * D, cz = z[1] + Math.sin(a) * D;
    let frei = 9;
    for (const t of ts) {
      const f = rec.frameAt(t, fr);
      if (!f) continue;
      for (let j = 0; j < f.players.length; j++) {
        const q = f.players[j], vx = cx - z[0], vz = cz - z[1], L2 = vx * vx + vz * vz;
        const u = clamp(((q.x - z[0]) * vx + (q.z - z[1]) * vz) / L2, 0, 1.2);
        if (u < (j === ohne ? 0.22 : 0.05)) continue; // der Schütze steht am Ball – stört nur, wenn er klar davor steht
        frei = Math.min(frei, Math.hypot(q.x - z[0] - vx * u, q.z - z[1] - vz * u) + (j === ohne ? 0.15 : 0));
      }
    }
    if (frei >= 0.55) return a;
    if (frei > bestFrei) { bestFrei = frei; best = a; }
  }
  return best;
}
// Blickrichtung der Jubel-Kamera (Winkel um den Schützen): möglichst von vorn (Blickrichtung des Schützen), aber so, dass
// über die ganze Jubel-Einstellung niemand zwischen Kamera und Schütze steht (Abstand zur Sichtlinie ≥ 0,75 m).
// keys = Stützpunkte der Jubel-Einstellung [[s, Spielzeit], …], D = Kamera-Abstand
// a0 = gewünschte Richtung relativ zur Blickrichtung des Schützen (jubel2: seitlich)
export function jubelRichtung(rec, k, keys, D, a0 = 0, cage = null) {
  const t0 = keys[0][1], t1 = keys[keys.length - 1][1], ts = [t0, (t0 + t1) / 2, t1];
  const S = rec.spielerGlatt(k, (t0 + t1) / 2, 0.3), fr = {};
  let best = S.face + a0, bestFrei = -1;
  for (const d of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const a = S.face + a0 + d * Math.PI / 6;
    let frei = 9;
    // Kamera muss im Käfig bleiben (sonst steht die Bande davor)
    if (cage && (Math.abs(S.x + Math.cos(a) * D) > cage.hx - 0.4 || Math.abs(S.z + Math.sin(a) * D) > cage.hz - 0.4)) continue;
    for (const t of ts) {
      const f = rec.frameAt(t, fr), sp = f.players[k];
      const cx = sp.x + Math.cos(a) * D, cz = sp.z + Math.sin(a) * D;
      for (let j = 0; j < f.players.length; j++) {
        if (j === k) continue;
        const q = f.players[j], vx = cx - sp.x, vz = cz - sp.z, L2 = vx * vx + vz * vz;
        const u = clamp(((q.x - sp.x) * vx + (q.z - sp.z) * vz) / L2, 0, 1.15);
        if (u < 0.12) continue; // hinter/neben dem Schützen stört nicht
        frei = Math.min(frei, Math.hypot(q.x - sp.x - vx * u, q.z - sp.z - vz * u));
      }
    }
    if (frei >= 0.75) return a;
    if (frei > bestFrei) { bestFrei = frei; best = a; }
  }
  return best;
}

// ---------------- Kameras (reine Rechnung) ----------------
// kind: tief | makro | keeper | netz | weit | drohne | hinten | ecke | jubel. f = Zustand (frameAt), ctx = {cage, hoch,
// contact, goal: {side}, u (s seit Schnitt), dur (s Dauer der Einstellung), side (Feldseite des Kontakts), ball (geglättet),
// schuetze: {x, z, face} geglättet, impact: [x, y, z] Einschlagpunkt}
export function editCamera(kind, f, ctx) {
  const { cage, hoch, goal } = ctx, c = ctx.contact || { x: f.ball.p.x, y: 0.11, z: f.ball.p.z, dx: goal.side, dz: 0 };
  const b = ctx.ball || f.ball.p, sx = goal.side, gx = sx * cage.hx;
  const dl = Math.hypot(c.dx, c.dz) || 1, ux = c.dx / dl, uz = c.dz / dl;
  const sd = ctx.side || 1, nx = -uz * sd, nz = ux * sd; // quer zur Schussrichtung, zur Feldmitte hin
  const fr = clamp(ctx.u / Math.max(0.05, ctx.dur), 0, 1);
  const I = ctx.impact || [gx + sx * 0.5, 0.8, 0];
  if (kind === 'tief') {
    // Seitenlinie tief: Kamera knapp über dem Rasen quer zum Anlauf, langsame Fahrt mit
    const D = hoch ? 6.2 : 5.2, px = c.x + nx * D - ux * (1.4 - fr * 0.8), pz = c.z + nz * D - uz * (1.4 - fr * 0.8);
    return { pos: [px, 0.42, pz], look: [b.x * 0.75 + c.x * 0.25, 0.55, b.z * 0.75 + c.z * 0.25], fov: hoch ? 50 : 34 };
  }
  if (kind === 'makro') {
    // Extreme Nahaufnahme Fuß/Ball: Blick fest auf den Kontaktpunkt, langsame Fahrt heran (Ball am Kontakt sicher im Bild)
    const D = (hoch ? 1.75 : 1.45) - fr * 0.25, ca = Math.cos(0.5), sa = Math.sin(0.5);
    let ox = nx * ca - ux * sa, oz = nz * ca - uz * sa; // schräg von vorn-seitlich
    if (ctx.makroDir != null) { ox = Math.cos(ctx.makroDir); oz = Math.sin(ctx.makroDir); } // ohne Verdeckung (FanEdit.makroDir)
    const ly = Math.max(0.14, c.y + 0.05);
    // nach dem Kontakt reißt die Kamera dem Ball hinterher (Ball bleibt länger im Bild)
    const kk = c.t != null && f.t > c.t ? 0.85 * ss((f.t - c.t) / 0.12) : 0;
    const lx = c.x - ux * 0.08, lz = c.z - uz * 0.08;
    return { pos: [c.x + ox * D, ly + 0.16, c.z + oz * D], look: [lx + (b.x - lx) * kk, ly + (Math.max(0.15, b.y) - ly) * kk, lz + (b.z - lz) * kk], fov: hoch ? 44 : 30 };
  }
  if (kind === 'keeper') {
    // Torwart-Sicht: im Tor knapp unter der Latte, über die Schulter des Tormanns, der Ball fliegt auf die Kamera zu
    const pz = clamp(I[2] * 0.4 - sd * 0.3, -cage.gw + 0.4, cage.gw - 0.4);
    return { pos: [gx + sx * (cage.gD - 0.25), Math.min(cage.gH - 0.15, 1.45), pz], look: [b.x, clamp(b.y, 0.3, 2) * 0.6 + 0.35, b.z], fov: hoch ? 62 : 48 };
  }
  if (kind === 'netz') {
    // hinter dem Tor (außen), tief, Blick durchs Netz aufs Feld: das Netz zappelt im Vordergrund
    // Blick durch den Einschlagpunkt hindurch aufs Feld: der Einschlag liegt in der Bildmitte (auch im schmalen Hochformat)
    const pz = clamp(I[2] * 0.7, -cage.gw, cage.gw), px = gx + sx * (cage.gD + 1.25), py = 0.95;
    const iy = clamp(I[1], 0.3, 1.6), dx = I[0] - px, dy = iy - py, dz = I[2] - pz - 0.35 * sd, dd = Math.hypot(dx, dy, dz) || 1;
    return { pos: [px, py, pz + 0.35 * sd], look: [I[0] + dx / dd * 3, iy + dy / dd * 1.5, I[2] + dz / dd * 3], fov: hoch ? 64 : 50 };
  }
  if (kind === 'weit') {
    // Standbild weit: Schütze und Tor gemeinsam im Bild (Kontur um den Schützen zeichnet das HUD)
    const S = ctx.schuetze || { x: c.x, z: c.z };
    const mx = (S.x + I[0]) / 2, mz = (S.z + I[2]) / 2, L = Math.hypot(I[0] - S.x, I[2] - S.z) || 1;
    if (hoch) {
      const vx = (I[0] - S.x) / L, vz = (I[2] - S.z) / L;
      return { pos: [S.x - vx * 3.6 + nx * 1.0, 4.0, S.z - vz * 3.6 + nz * 1.0], look: [mx * 0.4 + S.x * 0.6, 0.6, mz * 0.4 + S.z * 0.6], fov: 54 * (1 - 0.14 * ss(fr)) };
    }
    const qx = -(I[2] - S.z) / L, qz = (I[0] - S.x) / L, sg = qx * -mx + qz * -mz >= 0 ? 1 : -1; // von der Feldmitte her
    const D = L * 0.6 + 3.8, lx = mx * 0.5 + S.x * 0.5, lz = mz * 0.5 + S.z * 0.5;
    return { pos: [lx + qx * sg * D, 3.2, lz + qz * sg * D], look: [lx, 0.8, lz], fov: 40 * (1 - 0.14 * ss(fr)) };
  }
  if (kind === 'drohne') {
    // Drohne von oben: über der Mitte zwischen Kontakt und Tor, dreht sich langsam (Bild rotiert)
    const mx = (c.x + I[0]) / 4 + b.x / 2, mz = (c.z + I[2]) / 4 + b.z / 2, a = 0.45 * (fr - 0.5);
    let ox = hoch ? -ux : nx, oz = hoch ? -uz : nz; // hoch: Schuss läuft im Bild nach oben, quer: quer durchs Bild
    const ca = Math.cos(a), sa = Math.sin(a), rx = ox * ca - oz * sa, rz = ox * sa + oz * ca; ox = rx; oz = rz;
    return { pos: [mx + ox * 1.3, hoch ? 7.5 : 6.5, mz + oz * 1.3], look: [mx, 0, mz], fov: hoch ? 60 : 50 };
  }
  if (kind === 'hinten') {
    // hinter dem Schützen, Blick über die Schulter aufs Tor
    // (über Kopfhöhe, damit Mitspieler hinter dem Schützen nicht das Bild verdecken)
    return { pos: [c.x - ux * 3.0 + nx * 0.7, 2.35, c.z - uz * 3.0 + nz * 0.7], look: [gx * 0.45 + b.x * 0.55, 0.7, I[2] * 0.5 + b.z * 0.5], fov: hoch ? 58 : 42 };
  }
  if (kind === 'ecke') {
    // Torecke tief: neben dem Pfosten, der Ball kommt auf die Kamera zu und schlägt daneben ein
    const zs = c.z >= 0 ? -1 : 1;
    return { pos: [gx - sx * 0.6, 0.35, zs * (cage.gw + 0.9)], look: [c.x * 0.2 + b.x * 0.8, Math.max(0.3, b.y * 0.8 + 0.1), c.z * 0.2 + b.z * 0.8], fov: hoch ? 56 : 42 };
  }
  // Jubel: Schütze nah von vorn, leicht unten (Held-Perspektive), langsames Kreisen und Fahrt heran; jubel2: nah von der
  // Seite, tief, Blick hoch zum Gesicht
  const S = ctx.schuetze || { x: b.x, z: b.z, face: 0 };
  const a0 = ctx.jubelDir ?? S.face ?? 0;
  // Kopfhöhe des Schützen aus dem letzten Bild (liegt er noch nach Fallrückzieher/Hechten, zielt die Kamera tiefer)
  const ky = clamp(ctx.kopfY ?? 1.7, 0.25, 1.9), lyB = Math.max(0.3, ky - (hoch ? 0.5 : 0.32));
  if (kind === 'jubel2') {
    const a = (ctx.jubel2Dir ?? a0 + 0.9) + 0.35 * (fr - 0.5), D = (hoch ? 2.1 : 2.0) - 0.3 * fr;
    return { pos: [S.x + Math.cos(a) * D, Math.min(0.65, ky * 0.4 + 0.1), S.z + Math.sin(a) * D], look: [S.x, Math.max(0.3, ky - 0.25), S.z], fov: hoch ? 46 : 38 };
  }
  const a = a0 + 0.6 * (fr - 0.5), D = hoch ? 3.0 - 0.8 * ss(fr) : 2.6 - 0.6 * ss(fr);
  return { pos: [S.x + Math.cos(a) * D, Math.min(0.8, ky * 0.45 + 0.1), S.z + Math.sin(a) * D], look: [S.x, lyB, S.z], fov: hoch ? 48 : 38 };
}

// Kamera mit Effekten: Zoom-Punch (Öffnungswinkel), Wackler (Winkel, nur auf dem Schlag), Wischschwenk (Blick seitlich
// versetzt). rnd(k) = deterministisches Rauschen −1…1 (für Tests gleiche Bilder).
export function editCameraFx(cam, fx, r, seed = 1) {
  const pos = cam.pos, look = [...cam.look];
  const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2], D = Math.hypot(dx, dy, dz) || 1;
  // rechts (horizontal) und oben relativ zur Blickrichtung
  let rx = -dz, rz = dx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const rnd = (k) => { const s = Math.sin((Math.floor(r * 60) + k * 97.13 + seed * 13.7) * 12.9898) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  if (fx.shake > 0.001) {
    const A = 0.035 * fx.shake * D;
    look[0] += rx * rnd(1) * A; look[2] += rz * rnd(1) * A; look[1] += rnd(2) * A * 0.8;
  }
  if (fx.whip > 0.001) {
    const W = 0.55 * D * fx.whip * (fx.whipDir || 1);
    look[0] += rx * W; look[2] += rz * W;
  }
  const fov = cam.fov * (1 - 0.2 * fx.punch - 0.025 * fx.puls);
  return { pos, look, fov };
}
