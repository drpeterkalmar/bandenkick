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
export const EDIT_WORT = ['UNHALTBAR!', 'WAHNSINN!', 'BRUTAL!', 'WELTKLASSE!', 'KRANK!', 'TOOOR!'];
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
    // Hook: ein Schlag Vorgriff auf den Einschlag (fast Standbild), dann zurück zum Anlauf
    { name: 'vorgriff', cam: 'netz', b0: 0, b1: 1, keys: [[0, cl(ti - 0.03)], [B, cl(ti + 0.02)]] },
    { name: 'anlauf', cam: 'tief', b0: 1, b1: 2, whip: -1, keys: [[0, cl(tc - 0.6)], [B - 0.15, cl(tc - 0.16)], [B, cl(tc - 0.12)]] },
    // Kontakt genau auf Schlag 3, davor/danach fast Standbild (≈ 0,05×), am Ende ruckartig schneller
    { name: 'kontakt', cam: 'makro', b0: 2, b1: 4, keys: [[0, cl(tc - 0.1)], [0.2, cl(tc - 0.016)], [B, tc], [B + 0.27, cl(tc + 0.012)], [2 * B, cl(tc + Math.min(0.2, F * 0.4))]] },
    { name: 'torwart', cam: 'keeper', b0: 4, b1: 5, whip: 1, keys: [[0, cl(tc + Math.min(0.03, F * 0.1))], [0.15, cl(tc + Math.min(0.08, F * 0.25))], [B, cl(ti - Math.min(0.06, F * 0.15))]] },
    // Netzeinschlag genau auf Schlag 6
    // hinter dem Tor bis kurz vor den Einschlag, Schnitt genau auf Schlag 6 = Einschlag: zweiter Winkel am Pfosten
    { name: 'netz', cam: 'netz', b0: 5, b1: 6, keys: [[0, cl(ti - Math.min(0.22, F * 0.6))], [B, cl(ti - 0.012)]] },
    { name: 'einschlag', cam: 'pfosten', b0: 6, b1: 7, keys: [[0, cl(ti - 0.012)], [0.12, ti], [B, cl(ti + 0.2)]] },
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
    { b: 0, text: 'pov', punch: 0.6, ca: 0.5 }, { b: 0, text: 'warte' },
    { b: 1, punch: 0.6, ca: 0.4, text: 'zurueck' }, { b: 1.5, punch: 0.3 }, { b: 2, punch: 0.6, ca: 0.4, text: 'leer' },
    { b: 3, flash: 1, punch: 1, ca: 1, shake: 0.35, text: 'technik', emoji: '😱' },
    { b: 4, punch: 0.6, ca: 0.4, text: 'kmh', lines: 1 },
    { b: 5, punch: 0.35, text: 'kmhStempel' },
    { b: 6, flash: 1, punch: 1, ca: 1, shake: 1, text: 'golazo', emoji: '💥' },
    { b: 6.5, punch: 0.5, text: 'golazo2' },
    { b: 7, punch: 0.3, text: 'kontur' },
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
    // (Drohne nur noch im Querformat-Mix selten: von oben ist der Ball zu klein → Seitenlinie tief statt dessen)
    const WK = [['tief', 'hinten', 'gegen'], ['hinten', 'tief', 'gegen'], ['gegen', 'tief', 'hinten'], ['tief', 'gegen', 'hinten']][seed % 4];
    this.jubelClip = seed % 2 ? 'cheer' : 'cheer2'; this.jubelVersatz = seed % 2 ? 1.8 : 0.8; // Faust ballen / Faust küssen
    this.shots = plan(tc, ti, tLast, tFirst, tg, jub, WK).map((s) => ({ ...s, t0: s.b0 * BEAT, t1: s.b1 * BEAT, k: monoKurve(s.keys) }));
    this.events = fahrplan().map((x) => ({ ...x, t: x.b * BEAT }));
    // Flashes: höchstens FLASH_MAX, im reduzierten Modus nur sanftes Aufhellen
    let nf = 0; for (const x of this.events) if (x.flash && ++nf > FLASH_MAX) x.flash = 0;
    this.realTotal = this.shots[this.shots.length - 1].t1;
    this.segs = this.shots.map((s) => ({ name: s.name, cam: s.cam, t0: s.keys[0][1], t1: s.keys[s.keys.length - 1][1], rate: 1 }));
    this.pov = EDIT_POV[seed % EDIT_POV.length];
    this.wort = EDIT_WORT[(seed >> 2) % EDIT_WORT.length]; // zweites Jubelwort nach GOLAZO!
    this.gag = EDIT_GAG[(seed >> 3) % EDIT_GAG.length];
    this.tech = c ? EDIT_TECH[c.tech] || (c.type === 'air' ? 'VOLLEY' : 'KNALLER') : 'ABSTAUBER';
    this.kmh = c ? Math.round((c.speed || 0) * 3.6) : 0;
    // langsame Schüsse (Kopfball, Lupfer): statt km/h die Entfernung zum Tor hochzählen
    this.dist = c && opts.cage ? Math.hypot(goal.side * opts.cage.hx - c.x, c.z) : 0;
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
    if (s.name === 'anlauf') o.lines = Math.max(o.lines, 0.9 * (1 - ss(u / 0.35))); // Einstieg: Speed-Lines-Stoß
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
  const t0 = keys[0][1], t1 = keys[keys.length - 1][1], ts = Array.from({ length: 9 }, (_, i) => t0 + (t1 - t0) * i / 8);
  const S = rec.spielerGlatt(k, (t0 + t1) / 2, 0.3), fr = {};
  let best = S.face + a0, bestFrei = -1;
  for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
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
    if (frei >= 0.9) return a;
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
    // Seitenlinie tief: knapp über dem Rasen quer zum Anlauf, auf den Schützen und den Ball, langsame Fahrt heran
    const S = ctx.schuetze || { x: c.x, z: c.z }, mx = (S.x + b.x) / 2, mz = (S.z + b.z) / 2;
    const D = (hoch ? 4.6 : 3.8) - 1.0 * ss(fr);
    let px = mx + nx * D - ux * 0.6, pz = mz + nz * D - uz * 0.6;
    if (Math.abs(px) > cage.hx - 0.3 || Math.abs(pz) > cage.hz - 0.3) { px = mx - nx * D - ux * 0.6; pz = mz - nz * D - uz * 0.6; } // im Käfig bleiben
    return { pos: [clamp(px, -cage.hx + 0.3, cage.hx - 0.3), 0.42, clamp(pz, -cage.hz + 0.3, cage.hz - 0.3)], look: [mx, 0.75, mz], fov: hoch ? 50 : 36 };
  }
  if (kind === 'makro') {
    // Extreme Nahaufnahme Fuß/Ball: Blick fest auf den Kontaktpunkt, langsame Fahrt heran (Ball am Kontakt sicher im Bild)
    // Luftbälle (Kopfball, Volley, Fallrückzieher): weiter weg, damit der Spieler mit ins Bild kommt
    const D = (hoch ? 1.75 : 1.45) * (c.y > 0.45 ? 1.5 : 1) - fr * 0.25, ca = Math.cos(0.5), sa = Math.sin(0.5);
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
    const Z = [I[0] * 0.5 + b.x * 0.5, clamp(I[1] * 0.5 + b.y * 0.5, 0.3, 1.6), I[2] * 0.5 + b.z * 0.5];
    const dx = Z[0] - px, dy = Z[1] - py, dz = Z[2] - pz - 0.35 * sd, dd = Math.hypot(dx, dy, dz) || 1;
    return { pos: [px, py, pz + 0.35 * sd], look: [Z[0] + dx / dd * 3, Z[1] + dy / dd * 1.5, Z[2] + dz / dd * 3], fov: hoch ? 68 : 52 };
  }
  if (kind === 'weit') {
    // Standbild: Nahaufnahme des Schützen im Moment des Einschlags (Kontur und Spotlight zeichnet das HUD)
    const S = ctx.schuetze || { x: c.x, z: c.z };
    if (ctx.freezeDir != null) {
      const D = (hoch ? 3.0 : 2.8) - 0.5 * ss(fr), a = ctx.freezeDir, ky = clamp(ctx.kopfY ?? 1.7, 0.3, 1.9);
      return { pos: [S.x + Math.cos(a) * D, Math.max(0.9, ky * 0.8), S.z + Math.sin(a) * D], look: [S.x, Math.max(0.35, ky * 0.55), S.z], fov: hoch ? 54 : 42 };
    }
    const mx = (S.x + I[0]) / 2, mz = (S.z + I[2]) / 2, L = Math.hypot(I[0] - S.x, I[2] - S.z) || 1;
    if (hoch) {
      const vx = (I[0] - S.x) / L, vz = (I[2] - S.z) / L;
      return { pos: [S.x - vx * 3.0 + nx * 0.9, 3.4, S.z - vz * 3.0 + nz * 0.9], look: [mx * 0.3 + S.x * 0.7, 0.7, mz * 0.3 + S.z * 0.7], fov: 52 * (1 - 0.16 * ss(fr)) };
    }
    const qx = -(I[2] - S.z) / L, qz = (I[0] - S.x) / L, sg = qx * -mx + qz * -mz >= 0 ? 1 : -1; // von der Feldmitte her
    const D = L * 0.45 + 3.0, lx = mx * 0.35 + S.x * 0.65, lz = mz * 0.35 + S.z * 0.65;
    return { pos: [lx + qx * sg * D, 2.8, lz + qz * sg * D], look: [lx, 0.8, lz], fov: 40 * (1 - 0.16 * ss(fr)) };
  }
  if (kind === 'drohne') {
    // Drohne von oben: über der Mitte zwischen Kontakt und Tor, dreht sich langsam (Bild rotiert)
    const mx = (c.x + I[0]) / 4 + b.x / 2, mz = (c.z + I[2]) / 4 + b.z / 2, a = 0.45 * (fr - 0.5);
    let ox = hoch ? -ux : nx, oz = hoch ? -uz : nz; // hoch: Schuss läuft im Bild nach oben, quer: quer durchs Bild
    const ca = Math.cos(a), sa = Math.sin(a), rx = ox * ca - oz * sa, rz = ox * sa + oz * ca; ox = rx; oz = rz;
    return { pos: [mx + ox * 1.4, hoch ? 4.6 : 4.2, mz + oz * 1.4], look: [mx, 0, mz], fov: hoch ? 58 : 48 };
  }
  if (kind === 'hinten') {
    // hinter dem Schützen, Blick über die Schulter aufs Tor
    // (über Kopfhöhe, damit Mitspieler hinter dem Schützen nicht das Bild verdecken)
    return { pos: [c.x - ux * 2.5 + nx * 0.6, 2.0, c.z - uz * 2.5 + nz * 0.6], look: [gx * 0.35 + b.x * 0.65, 0.6, I[2] * 0.4 + b.z * 0.6], fov: hoch ? 56 : 40 };
  }
  if (kind === 'gegen') {
    // Gegenschuss: vor dem Schützen tief, er schießt auf die Kamera zu (Schütze groß von vorn)
    const px = clamp(c.x + ux * 3.0 + nx * 0.9, -cage.hx + 0.3, cage.hx - 0.3), pz = clamp(c.z + uz * 3.0 + nz * 0.9, -cage.hz + 0.3, cage.hz - 0.3);
    return { pos: [px, 0.55, pz], look: [c.x, Math.max(0.6, c.y + 0.4), c.z], fov: hoch ? 56 : 40 };
  }
  if (kind === 'pfosten') {
    // am Pfosten im Feld, tief, Blick schräg ins Tor auf den Einschlag
    const zs = I[2] >= 0 ? -1 : 1, px = gx - sx * 1.1, pz = zs * (cage.gw + 0.35);
    return { pos: [px, 0.55, pz], look: [I[0] * 0.7 + b.x * 0.3, clamp(I[1], 0.3, 1.6), I[2] * 0.7 + b.z * 0.3], fov: hoch ? 60 : 46 };
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
  const ky = clamp(ctx.kopfY ?? 1.7, 0.25, 1.9), lyB = Math.max(0.3, ky - (hoch ? 0.5 : 0.15)); // quer: Platz über dem Kopf für die Arme
  if (kind === 'jubel2') {
    const a = (ctx.jubel2Dir ?? a0 + 0.45) + 0.3 * (fr - 0.5), D = (hoch ? 1.7 : 1.9) - 0.45 * ss(fr);
    return { pos: [S.x + Math.cos(a) * D, Math.max(0.5, ky - 0.55), S.z + Math.sin(a) * D], look: [S.x, Math.max(0.3, ky - 0.2), S.z], fov: hoch ? 44 : 36 };
  }
  const a = a0 + 0.6 * (fr - 0.5), D = hoch ? 3.0 - 0.8 * ss(fr) : 3.2 - 0.6 * ss(fr);
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
