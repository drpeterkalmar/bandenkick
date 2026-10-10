// Action-Momente LIVE im Spiel (n6, Peter 09.10.2026: „Bei Torschüssen oder Zweikämpfen schnelle Zoom-ins auf die Szene
// mit Effekten und Speed-Ramps … oder Bullet-Time!“). Baut auf der Live-Zeitlupe aus Nacht 2 auf (main.js `slow`,
// camera.js `zoom`) und ersetzt sie. Ohne DOM und ohne three.js (Node-Test tests/node/action.test.mjs):
//  - Auslöser aus den Spiel-Ereignissen: harter Schuss (≥ 90 km/h) oder Volley/Fallrückzieher/Seitfall/Flugkopf/Banane,
//    Großchance (Pfosten/Latte), Glanzparade, Fangen eines harten Balls, Grätsche mit Balleroberung, Kopfball-Duell.
//    Jedes Ereignis bekommt eine Spektakel-Wertung 0…1; Zufall + Wertung + Abkühlzeit (≥ 8 s Spielzeit) entscheiden.
//  - Nie, wenn der Spieler sofort reagieren muss: Gegner am (langsamen) Ball dicht vor dem eigenen Tor.
//  - Ablauf „ramp“ (≤ 1,2 s): Zoom-Punch auf die Szene → Zeitlupe am Kontakt (0,12×) → kurz schneller (1,5×) → 1×.
//    Ablauf „bullet“ (≤ 1,45 s) beim Spektakulärsten: Zeit steht (Simulation pausiert und setzt exakt fort), die Kamera
//    fährt in ≈ 1,1 s im Halbkreis um den Moment, dann ruckartig zurück zur Spielkamera (mit Wackler).
//  - Die Simulation selbst bleibt unverändert: nur ihr Takt läuft langsamer/schneller bzw. steht (Eingaben werden
//    weiter angenommen und in den nächsten Takten verarbeitet).

export const AKTION = {
  abkuehl: 8,            // s Spielzeit zwischen zwei Momenten (mindestens; je Stufe länger)
  bulletAbkuehl: 40,     // s Spielzeit zwischen zwei Bullet-Times (sonst wird es eine Speed-Ramp)
  // Stufen: Mindest-Wertung, Wahrscheinlichkeit, Abkühlzeit
  stufen: { selten: { min: 0.8, p: 0.35, abk: 45 }, oft: { min: 0.5, p: 0.75, abk: 12 } },
  ramp: 1.18, bullet: 1.45, // s Echtzeit
  langsam: 0.12,         // Tempo in der Zeitlupe
};
const SPEKTAKEL_TECH = { fallrueck: 0.95, seitfall: 0.85, flugkopf: 0.8, volley: 0.7, dropkick: 0.6, innenrist: 0.55, aussenrist: 0.6, ferse: 0.6, chip: 0.45, kopf: 0.45 };
const BULLET_TECH = new Set(['fallrueck', 'seitfall', 'flugkopf']);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Ziel eines Schusses: Höhe/Seite beim Erreichen der Torlinie (gerade Bahn mit Schwerkraft, grob) → „Kreuzeck?“
function zielImTor(e, game) {
  const b = game.ball, gx = Math.sign(e.dx || b.v.x || 1) * game.cage.hx;
  if (!(Math.abs(b.v.x) > 1)) return null;
  const t = (gx - b.p.x) / b.v.x;
  if (!(t > 0 && t < 1.5)) return null;
  return { y: b.p.y + b.v.y * t - 4.9 * t * t, z: b.p.z + b.v.z * t, t };
}

// Torwart frontal: Fokus zwischen Torwart und Ball, Kamera vom Feld her schräg vor ihm
function torwartBlick(k, e) {
  if (!k) return { fokus: [e.x, Math.max(0.6, e.y || 0.6), e.z], dir: null };
  const s = -Math.sign(k.x || 1); // zur Feldmitte
  return { fokus: [k.x * 0.65 + e.x * 0.35, 0.85, k.z * 0.65 + e.z * 0.35], dir: [s * 0.85, k.z > 0 ? -0.5 : 0.5], nah: true };
}
// Spektakel-Wertung eines Ereignisses (0 = nichts) und Art des Moments
export function bewerte(e, game) {
  const P = game.players, cage = game.cage;
  if (e.type === 'kick' && e.kind === 'shot') {
    const kmh = (e.speed || 0) * 3.6;
    let w = clamp((kmh - 70) / 50, 0, 0.75), t = SPEKTAKEL_TECH[e.tech] || 0;
    w = Math.max(w, t);
    if (kmh >= 90) w = Math.max(w, 0.62);
    const z = zielImTor(e, game);
    const kreuzeck = z && z.y > game.cage.gH * 0.62 && z.y < cage.gH + 0.1 && Math.abs(z.z) > cage.gw - 0.7 && Math.abs(z.z) < cage.gw + 0.05;
    if (z && Math.abs(z.z) < cage.gw + 0.4 && z.y < cage.gH + 0.4) w += 0.12; // aufs Tor
    if (kreuzeck) w += 0.15;
    const bullet = BULLET_TECH.has(e.tech) || (kreuzeck && (e.tech === 'volley' || kmh >= 105));
    // Fokus zwischen Schütze und Ball, Kamera quer zur Schussrichtung (Schütze von der Seite)
    const pl = P[e.player], fx = pl ? e.x * 0.6 + pl.x * 0.4 : e.x, fz = pl ? e.z * 0.6 + pl.z * 0.4 : e.z, dl = Math.hypot(e.dx || 0, e.dz || 0) || 1;
    return { w: clamp(w, 0, 1), art: bullet ? 'bullet' : 'ramp', fokus: [fx, Math.max(0.6, (e.y || 0) * 0.5 + 0.5), fz], ...(pl ? { dir: [-Math.sin(pl.face), Math.cos(pl.face)], vor: [Math.cos(pl.face), Math.sin(pl.face)] } : { dir: [-(e.dz || 0) / dl, (e.dx || 1) / dl], vor: [(e.dx || 1) / dl, (e.dz || 0) / dl] }), spieler: e.player, grund: kreuzeck ? 'kreuzeck' : e.tech || 'schuss' };
  }
  if (e.type === 'post' && (e.speed || 0) > 10) return { w: 0.72, art: 'ramp', fokus: [game.ball.p.x, game.ball.p.y, game.ball.p.z], spieler: -1, grund: 'pfosten' };
  if (e.type === 'parry' && (e.speed || 0) > 14) {
    const kp = P[e.player], hecht = kp && kp.hand && (kp.hand.mode === 'dive' || kp.hand.mode === 'ground');
    const w = hecht ? clamp(0.5 + ((e.speed || 0) - 14) / 22, 0, 0.9) : 0.3; // nur mit Hechtsprung spektakulär
    return { w, art: (e.speed || 0) > 24 ? 'bullet' : 'ramp', ...torwartBlick(P[e.player], e), spieler: e.player, grund: 'parade' };
  }
  if (e.type === 'catch' && (e.speed || 0) > 17) {
    const pl = P[e.player], hecht = pl && pl.hand && pl.hand.mode === 'dive';
    return { w: hecht ? 0.68 : 0.3, art: 'ramp', ...torwartBlick(pl, e), spieler: e.player, grund: hecht ? 'hechtfang' : 'fang' };
  }
  if (e.type === 'dive') {
    const k = P[e.player], b = game.ball, sp = Math.hypot(b.v.x, b.v.y, b.v.z);
    const aufsTor = k && Math.sign(b.v.x) === Math.sign(k.x) && Math.abs(b.v.x) > 6;
    if (k && aufsTor && sp > 14) return { w: clamp(0.62 + (sp - 14) / 25, 0, 0.95), art: sp > 26 ? 'bullet' : 'ramp', langsam: 0.3, ...torwartBlick(k, { x: b.p.x, y: b.p.y, z: b.p.z }), spieler: e.player, grund: 'hechtsprung' };
  }
  if (e.type === 'tackle' && e.phase === 'hit') return { w: e.result === 'ball' ? 0.55 : 0.45, art: 'ramp', fokus: [e.x, 0.4, e.z], spieler: e.player, grund: 'graetsche' };
  if (e.type === 'air' && e.tech === 'kopf') {
    // Kopfball-Duell: ein Gegner springt nah mit
    const pl = P[e.player];
    const duell = pl && P.some((q) => q.team !== pl.team && Math.hypot(q.x - pl.x, q.z - pl.z) < 1.3 && (q.jumpY || 0) > 0.08);
    if (duell) return { w: 0.62, art: 'ramp', fokus: [e.x, e.y || 1.5, e.z], spieler: e.player, grund: 'kopfballduell' };
  }
  return null;
}

// Muss der Mensch gerade sofort reagieren? (Gegner am langsamen Ball dicht vor dem eigenen Tor)
export function unsicher(game) {
  if (!game.match || game.human < 0) return false;
  const me = game.players[game.human], b = game.ball, R = game.rules;
  const ownX = R && R.goalX ? R.goalX(me.team) : -Math.sign(me.x || 1) * game.cage.hx;
  const nah = Math.hypot(b.p.x - ownX, b.p.z) < 9;
  const sp = Math.hypot(b.v.x, b.v.z);
  const gegnerAmBall = (b.held >= 0 && game.players[b.held].team !== me.team) ||
    game.players.some((q) => q.team !== me.team && Math.hypot(q.x - b.p.x, q.z - b.p.z) < 1.2);
  return nah && gegnerAmBall && sp < 12;
}

// Verlauf eines Moments zur Echtzeit t (s): Tempo der Simulation, Zoom-Punch 0…1, Effekte, Bullet-Time-Kreisfahrt
export function verlauf(art, t, reduce = false, langsam = AKTION.langsam) {
  const o = { rate: 1, punch: 0, flash: 0, lines: 0, ca: 0, sat: 0, orbit: -1, shake: 0, drift: 0, whip: 0, rueck: -1, ende: false };
  const L = langsam;
  if (art === 'bullet') {
    const T = AKTION.bullet;
    if (t >= T) { o.ende = true; return o; }
    if (t < 0.1) { const u = ss(t / 0.1); o.rate = 1 + (0.05 - 1) * u; o.punch = u; }
    else if (t < 1.25) { o.rate = 0; o.punch = 1; o.orbit = ss((t - 0.1) / 1.15); o.orbitLin = clamp((t - 0.1) / 1.15, 0, 1); o.ca = reduce ? 0 : 0.3; }
    else { const u = ss((t - 1.25) / (T - 1.25)); o.rate = 1.4 + (1 - 1.4) * u; o.punch = 0; o.shake = t < 1.32 ? (reduce ? 0.25 : 0.7) : 0; }
    o.sat = t < 1.25 ? ss(t / 0.15) : 1 - ss((t - 1.25) / 0.2);
    o.lines = t < 0.35 ? 1 - t / 0.35 : 0;
  } else {
    const T = AKTION.ramp;
    if (t >= T) { o.ende = true; return o; }
    if (t < 0.1) { const u = ss(t / 0.1); o.rate = 1 + (L - 1) * u; o.punch = u; }
    else if (t < 0.65) { o.rate = L; o.punch = 1; o.drift = (t - 0.1) / 0.55; o.rueck = t < 0.55 ? 1 - (1 - (t - 0.1) / 0.45) ** 2 : -1; } // Rückblick 0,45 s, bremst bis zum Kontakt (≈ 0,55 s) fast zum Stand
    else if (t < 0.8) { const u = ss((t - 0.65) / 0.15); o.rate = L + (1.5 - L) * u; o.punch = 1; o.drift = 1 + 0.4 * u; }
    else { const u = ss((t - 0.8) / (T - 0.8)); o.rate = 1.5 + (1 - 1.5) * u; o.punch = 0; o.whip = Math.max(0, 1 - (t - 0.8) / 0.1); o.shake = t < 0.86 ? (reduce ? 0.2 : 0.5) : 0; } // harter Schnitt zurück
    o.sat = t < 0.95 ? ss(t / 0.15) : 1 - ss((t - 0.95) / 0.25);
    o.lines = t < 0.4 ? 1 - t / 0.4 : 0;
  }
  // kurzer Weißblitz am Anfang (< 120 ms) bzw. sanftes Aufhellen
  o.flash = reduce ? 0.18 * Math.sin(Math.PI * clamp(t / 0.25, 0, 1)) : t < 0.08 ? 0.38 * (1 - t / 0.08) : 0;
  return o;
}

// Regie: Ereignisse eines Spieltakts prüfen, Moment starten, je Bild fortschreiben
export class ActionRegie {
  constructor(stufe = 'selten', rnd = Math.random) {
    this.stufe = stufe; this.rnd = rnd; this.moment = null; this.letzt = -1e9; this.zahl = 0; this.log = [];
  }
  // nach jedem Spieltakt: evs = Ereignisse, game = Spiel; gibt den neuen Moment zurück (oder null)
  pruefe(evs, game) {
    if (this.stufe === 'aus' || this.moment || !game.match) return null;
    const S = AKTION.stufen[this.stufe] || AKTION.stufen.selten;
    if (game.t - this.letzt < Math.max(AKTION.abkuehl, S.abk || 0)) return null;
    let best = null;
    for (const e of evs) { const b = bewerte(e, game); if (b && (!best || b.w > best.w)) best = b; }
    if (!best || best.w < S.min) return null;
    if (unsicher(game)) { this.log.push({ t: game.t, grund: best.grund, aus: 'unsicher' }); return null; }
    // Zufall: höhere Wertung → wahrscheinlicher; Spektakulärstes fast immer
    const p = S.p * (0.6 + 0.6 * best.w);
    if (this.rnd() > p) return null;
    if (best.art === 'bullet' && game.t - (this.letztBullet ?? -1e9) < AKTION.bulletAbkuehl) best = { ...best, art: 'ramp' };
    if (best.art === 'bullet') this.letztBullet = game.t;
    // Rückblick: die Zeitlupe zeigt die letzten Zehntel vor dem Auslösen aus der Aufzeichnung (Kontakt, Parade), die
    // Simulation steht so lange; der Hechtsprung beginnt erst – da braucht es keinen
    const rueck = best.art === 'ramp' && best.grund !== 'hechtsprung' ? (best.grund === 'parade' || best.grund === 'fang' || best.grund === 'hechtfang' ? 0.16 : 0.25) : 0; // Schuss: Ausholen + Kontakt
    this.moment = { ...best, t: 0, tSpiel: game.t, real: 0, rueck };
    this.letzt = game.t; this.zahl++;
    this.log.push({ t: game.t, grund: best.grund, art: best.art, w: +best.w.toFixed(2) });
    return this.moment;
  }
  // je Bild: dt Echtzeit → Verlauf (oder null, wenn kein Moment läuft)
  bild(dt, reduce = false) {
    const m = this.moment;
    if (!m) return null;
    m.real += dt;
    const v = verlauf(m.art, m.real, reduce, m.langsam || AKTION.langsam);
    if (v.ende) { this.moment = null; return null; }
    return v;
  }
  abbrechen() { this.moment = null; }
}
