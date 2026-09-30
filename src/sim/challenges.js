// Training und Challenges (Nacht 2b, ohne DOM): jede Challenge richtet ihre Spielwelt ein (Spieler, Ball, Ballmaschine,
// Zielscheiben, Hütchen, Puppen), steuert Ballmaschine und Bots im Takt, zählt Treffer und vergibt 1–3 Sterne.
// Headless mit Skript-Eingaben abspielbar (tests/node/challenge.test.mjs, air.test.mjs) – damit sind die Challenges
// auch das Test-Werkzeug für Gesten, Pass, Schuss und Luftbälle. Die Ballmaschine schießt mit echter Physik: ihre
// Abflugrichtung kommt aus dem Ziel-Löser (kickplan.aimAt), danach fliegt der Ball normal.
import { aimAt, spinOf, setKick, clamp } from './kickplan.js';
import { EMPTY_INPUT } from './player.js';
import { Ball } from './ball.js';

const DEG = Math.PI / 180, TAU = 2 * Math.PI;

// ---------------- Katalog ----------------
// per = Spieler je Mannschaft [Orange, Blau]; stars = Schwellen für 1/2/3 Sterne (better 'hi' = mehr ist besser,
// 'lo' = weniger ist besser, z. B. Zeit); hands = Mensch ist „letzte Hand“ im eigenen Torraum (Tormann-Challenges)
export const CHALLENGES = [
  { id: 'torwand', group: 'schuetze', name: 'Torwand', icon: '🎯', per: [1, 0], attempts: 10, unit: 'Treffer', better: 'hi', stars: [3, 5, 7],
    hint: '10 Schüsse aus 7 m. Getroffen zählt nur die leuchtende Scheibe: Stick seitlich = flache Ecke, schräg nach vorn = hohe Ecke. Tipp = Vollspann, Doppeltipp = angeschnitten.' },
  { id: 'volley', group: 'schuetze', name: 'Volley-Station', icon: '🦵', per: [1, 0], attempts: 10, unit: 'Tore', better: 'hi', stars: [3, 5, 7],
    hint: 'Die Ballmaschine flankt. Tipp Schuss, wenn der Ball kommt – je nach Höhe wird es Volley, Kopfball, Seitfall- oder Fallrückzieher. Den besten Moment wählt das Spiel.' },
  { id: 'bande', group: 'schuetze', name: 'Bandenpass', icon: '↗️', per: [1, 0], attempts: 6, unit: 'Treffer', better: 'hi', stars: [2, 4, 6],
    hint: 'Puppen versperren den direkten Weg. Spiel den Ball über die Bande in den leuchtenden Kreis: Stick zur Bande (aufs Spiegelbild des Kreises), dann Pass.' },
  { id: 'dribbel', group: 'schuetze', name: 'Dribbel-Parcours', icon: '🔶', per: [1, 0], attempts: 1, unit: 's', better: 'lo', stars: [26, 19, 15],
    hint: 'Slalom durch die 5 Hütchen-Tore, dann ins Tor. Die Zeit läuft ab dem ersten Ballkontakt. Verpasstes Tor: +3 s.' },
  { id: 'elfmeter', group: 'schuetze', name: 'Elfmeter', icon: '⚽', per: [1, 1], attempts: 5, unit: 'Tore', better: 'hi', stars: [2, 3, 4],
    hint: '5 Elfmeter aus 6 m gegen den Bot-Tormann. Stick wählt die Ecke, doppeltippen = angeschnitten: der Ball dreht um ihn herum.' },
  { id: 'doppelpass', group: 'schuetze', name: 'Doppelpass', icon: '🔁', per: [2, 1], attempts: 5, unit: 'Tore', better: 'hi', stars: [2, 3, 4], botLevel: 1,
    hint: 'Spiel deinen Mitspieler an und lauf los: Er spielt dir den Ball direkt in den Lauf. Dann abschließen – 7 s je Versuch.' },
  { id: 'tw_serie', group: 'torwart', name: 'Ballmaschine', icon: '🧤', per: [1, 0], attempts: 12, unit: 'gehalten', better: 'hi', stars: [5, 8, 10], hands: true,
    hint: 'Du bist Tormann. Schuss-Knopf halten = fangen, Pass-Knopf = hechten (Stick = Richtung). Flach, hoch, Flatterball, Aufsetzer, Bande, Kurve – es wird schwerer.' },
  { id: 'tw_reaktion', group: 'torwart', name: 'Reaktion', icon: '⚡', per: [1, 0], attempts: 10, unit: 'gehalten', better: 'hi', stars: [3, 5, 7], hands: true,
    hint: 'Schnellfeuer aus 6 m in zufällige Ecken. Reagieren, hechten, fangen.' },
  { id: 'tw_1gegen1', group: 'torwart', name: '1 gegen 1', icon: '🥅', per: [1, 1], attempts: 5, unit: 'gehalten', better: 'hi', stars: [2, 3, 4], hands: true,
    hint: 'Ein Bot-Stürmer läuft allein auf dich zu. Raus aus dem Tor, Winkel verkürzen, rechtzeitig hechten.' },
];
export const challengeDef = (id) => CHALLENGES.find((c) => c.id === id);
export function starsFor(def, score) {
  if (score == null) return 0;
  let n = 0;
  for (const s of def.stars) if (def.better === 'lo' ? score <= s : score >= s) n++;
  return n;
}

// ---------------- Ballmaschine ----------------
// Steht am Feldrand bzw. auf dem Feld, dreht sich zum Ziel, schießt aus der Mündung (0,75 m hoch).
export const MACHINE_H = 0.75;
function fireMachine(game, m, target, speed, back = 0, side = 0, normal = null) {
  const P = game.P, b = game.ball;
  const from = [m.x, MACHINE_H, m.z];
  const sol = aimAt(P, from, target, speed, spinOf(back, side), normal);
  b.place(from[0], from[1], from[2]); b.held = -1;
  setKick(b, sol.dir[0], sol.dir[1], speed, sol.el, back, side);
  b.contact = false;
  b.reseedKnuckle(game.rng);
  m.yaw = Math.atan2(sol.dir[1], sol.dir[0]); m.pitch = sol.el; m.firedT = game.t; m.shots++;
  game.lastTouch = -1; game.lastTouchT = game.t; game.passPlan = null;
  game.events.push({ type: 'machine', x: m.x, z: m.z, speed });
  return sol;
}
// Ball im Käfig simulieren (Ziel-Suche für Aufsetzer und Bandenabpraller): kreuzt er die Torlinie im Tor?
function simCross(game, from, v, w, gx, T = 2.5) {
  const b = new Ball({ ...game.P, knuckleF30: 0 });
  b.p.set(from[0], from[1], from[2]); b.v.set(v[0], v[1], v[2]); b.w.set(w[0], w[1], w[2]); b.contact = false;
  for (let i = 0; i < T * 120; i++) { b.step(1 / 120, game.cage); if (Math.sign(gx) * (b.p.x - gx) > 0) return { z: b.p.z, y: b.p.y }; }
  return null;
}

// ---------------- Grundgerüst ----------------
class Challenge {
  constructor(game, def) {
    this.g = game; this.def = def; this.id = def.id;
    this.attempt = 0; this.score = 0; this.done = false; this.log = [];
    this.phase = 'setup'; this.phaseT = 0; this.attemptT = 0;
    this.machine = null; this.targets = []; this.cones = []; this.gates = []; this.dummies = []; this.zones = []; this.marks = [];
    this.msg = ''; this.msgT = 0;
    this.hx = game.cage.hx; this.hz = game.cage.hz; this.gw = game.cage.gw; this.gH = game.cage.gH;
  }
  get me() { return this.g.players[this.g.human]; }
  // Ergebnis eines Versuchs festhalten, kurze Meldung, nächster Versuch nach `pause` s
  finish(ok, text, pause = 1.3, add = ok ? 1 : 0) {
    if (this.phase === 'between' || this.done) return;
    if (ok === null) { // Versuch zählt nicht (z. B. Ballmaschine daneben): wiederholen, höchstens 3× je Challenge
      this.repeats = (this.repeats || 0) + 1;
      if (this.repeats <= 3) { this.attempt--; text += ' – wird wiederholt'; }
      ok = false; add = 0;
    }
    this.score += add;
    this.log.push({ attempt: this.attempt, ok, text, t: this.g.t });
    this.msg = text; this.msgT = 1.6;
    this.phase = 'between'; this.phaseT = 0; this.pause = pause;
    this.g.events.push({ type: 'challenge', ok, text, attempt: this.attempt, score: this.score });
  }
  step() {
    const g = this.g;
    this.phaseT += 1 / 120; this.attemptT += 1 / 120; if (this.msgT > 0) this.msgT -= 1 / 120;
    if (this.done) return;
    if (this.phase === 'setup') { this.attempt++; this.attemptT = 0; this.phase = 'run'; this.phaseT = 0; this.setupAttempt(this.attempt); return; }
    if (this.phase === 'between') {
      if (this.phaseT >= this.pause) {
        if (this.attempt >= this.def.attempts) { this.done = true; g.events.push({ type: 'challengeEnd', id: this.id, score: this.resultScore() }); }
        else this.phase = 'setup';
      }
      return;
    }
    this.run();
  }
  resultScore() { return this.score; }
  result() { const s = this.resultScore(); return { id: this.id, score: s, stars: starsFor(this.def, s), unit: this.def.unit, attempts: this.def.attempts, log: this.log }; }
  // Eingabe der Bots dieser Challenge (Standard: stehen)
  input(i) { void i; return EMPTY_INPUT; }
  onGoal(side) { void side; }
  passTargets() { return []; }
  status() { return `${this.def.name} · Versuch ${Math.min(this.attempt, this.def.attempts)}/${this.def.attempts} · ${this.score} ${this.def.unit}`; }
  placeMe(x, z, face) { const p = this.me; p.place(x, z, face); p.resetHands(); p.air = null; p.fall = null; p.jumpY = 0; p.jumpV = 0; p.pending = null; p.charging = false; }
}

// ---------------- Torwand: 10 Schüsse, leuchtende Scheibe zählt ----------------
class Torwand extends Challenge {
  constructor(g, d) {
    super(g, d);
    const P = g.P, gx = this.hx;
    this.targets = [[1, 0], [1, 1], [-1, 0], [-1, 1]].map(([s, hi]) => ({ x: gx, y: hi ? P.shotHigh : P.shotLow, z: s * P.shotZ, r: 0.3, name: `${hi ? 'oben' : 'unten'} ${s > 0 ? 'rechts' : 'links'}`, lit: false, hit: 0 }));
    this.order = [1, 2, 0, 3, 2, 1, 3, 0, 1, 2];
    this.spots = [[-7, 0], [-7, 1.2], [-7, -1.2], [-7.5, 0.6], [-7.5, -0.6], [-7, 0], [-6.5, 1.5], [-6.5, -1.5], [-7, 0.8], [-7, -0.8]];
  }
  setupAttempt(k) {
    const g = this.g, gx = this.hx, [dx, z] = this.spots[(k - 1) % this.spots.length];
    const bx = gx + dx;
    const f = Math.atan2(-z, gx - bx);
    g.ball.place(bx, g.ball.r, z); g.ball.held = -1;
    this.placeMe(bx - Math.cos(f) * 0.45, z - Math.sin(f) * 0.45, f);
    this.targets.forEach((t, i) => { t.lit = i === this.order[(k - 1) % this.order.length]; });
    this.kicked = false; this.cross = null;
  }
  run() {
    const g = this.g, b = g.ball;
    if (!this.kicked && g.lastTouch === g.human && g.t - g.lastTouchT < 0.1 && b.v.len() > 4) this.kicked = true;
    if (this.kicked && !this.cross && b.p.x >= this.hx) {
      this.cross = { y: b.p.y, z: b.p.z };
      const t = this.targets.find((tt) => tt.lit);
      const d = Math.hypot(b.p.y - t.y, b.p.z - t.z);
      if (d <= t.r) { t.hit++; this.finish(true, `Treffer ${t.name}!`); }
      else {
        const other = this.targets.find((tt) => Math.hypot(b.p.y - tt.y, b.p.z - tt.z) <= tt.r);
        this.finish(false, other ? `Falsche Scheibe (${other.name})` : Math.abs(b.p.z) < this.gw && b.p.y < this.gH ? 'Tor, aber keine Scheibe' : 'Vorbei');
      }
    }
    if (this.kicked && !this.cross && this.attemptT > 1 && (b.v.len() < 0.4 || this.attemptT > 6)) this.finish(false, 'Zu kurz');
    if (!this.kicked && this.attemptT > 12) this.finish(false, 'Zeit um');
  }
  status() { const t = this.targets.find((tt) => tt.lit); return `Torwand · Schuss ${Math.min(this.attempt, 10)}/10 · Treffer ${this.score} · Ziel: ${t ? t.name : ''}`; }
}

// ---------------- Volley-Station: Ballmaschine flankt, Kopfball/Volley/Seitfall/Fallrückzieher ----------------
// Jede Station: Spielerplatz, Maschine, Treffpunkt (Höhe am Spieler), Tempo. So gebaut, dass die Technik-Wahl
// die gewünschte Technik ergibt (Höhe × Lage) – geprüft in air.test.mjs.
export const VOLLEY_STATIONS = [
  { want: 'volley', me: [4.8, 0.8], face: 'ball', mach: [7.4, -6.0], hit: [0.55, 0.62], v: 11 },
  { want: 'kopf', me: [5.2, 0.4], face: 'ball', mach: [7.6, -6.0], hit: [0.25, 1.95], v: 12 },
  { want: 'seitfall', me: [5.0, 0.6], face: 'ball', mach: [7.6, 6.0], hit: [0.55, 1.2], v: 11.5 },
  { want: 'fallrueck', me: [6.2, 0.2], face: 'machine', mach: [-2.0, 0.4], hit: [0.25, 1.45], v: 11 },
  { want: 'volley', me: [4.6, -0.8], face: 'ball', mach: [7.4, 6.0], hit: [0.55, 0.7], v: 12 },
  { want: 'kopf', me: [5.6, -0.5], face: 'ball', mach: [7.8, 6.0], hit: [0.22, 2.2], v: 12.5 },
  { want: 'dropkick', me: [4.2, 0.4], face: 'ball', mach: [8.6, 4.6], hit: [1.1, 0.2], v: 10.5, bounce: true },
  { want: 'flugkopf', me: [4.6, 0.2], face: 'ball', mach: [7.6, -6.0], hit: [0.2, 0.75, 1.75], v: 13 },
  { want: 'seitfall', me: [5.2, -0.6], face: 'ball', mach: [7.6, -6.0], hit: [0.55, 1.25], v: 11.5 },
  { want: 'fallrueck', me: [6.0, -0.3], face: 'machine', mach: [-2.0, -0.2], hit: [0.25, 1.6], v: 11.5 },
];
class Volley extends Challenge {
  constructor(g, d) { super(g, d); this.machine = { x: 7.4, z: -6, yaw: 0, pitch: 0, firedT: -9, shots: 0 }; this.stations = VOLLEY_STATIONS; }
  setupAttempt(k) {
    const g = this.g, st = this.stations[(k - 1) % this.stations.length];
    this.st = st;
    const m = this.machine; m.x = st.mach[0]; m.z = st.mach[1];
    const [mx, mz] = st.me;
    const face = st.face === 'machine' ? Math.atan2(m.z - mz, m.x - mx) : Math.atan2(m.z - mz, m.x - mx) * 0.5;
    this.placeMe(mx, mz, face);
    g.ball.place(m.x, MACHINE_H, m.z); g.ball.held = -1; g.ball.v.set(0, 0, 0); g.ball.contact = false;
    g.lastTouch = -1;
    m.yaw = Math.atan2(mz - m.z, mx - m.x);
    this.fired = false; this.scored = false; this.tech = null;
  }
  run() {
    const g = this.g, b = g.ball, st = this.st, m = this.machine;
    if (!this.fired) {
      b.place(m.x, MACHINE_H, m.z); b.v.set(0, 0, 0); b.contact = false; // Ball liegt in der Maschine
      if (this.attemptT >= 1.4) {
        // Treffpunkt: vor dem Spielerplatz Richtung Maschine (hit[0] m), in Höhe hit[1], seitlich zur Torseite hit[2] m
        const [mx, mz] = st.me, dx = m.x - mx, dz = m.z - mz, dl = Math.hypot(dx, dz);
        let nx = -dz / dl, nz = dx / dl; if (nx < 0) { nx = -nx; nz = -nz; }
        const lat = st.hit[2] || 0;
        const T = [mx + dx / dl * st.hit[0] + nx * lat, st.bounce ? 0.25 : st.hit[1], mz + dz / dl * st.hit[0] + nz * lat];
        fireMachine(g, m, T, st.v, st.bounce ? 0 : 6, 0);
        if (st.bounce) { // Aufsetzer: flacher Bogen, der Ball springt kurz vor dem Spieler auf
          const sol = aimAt(g.P, [m.x, MACHINE_H, m.z], T, st.v, spinOf(0, 0));
          setKick(b, sol.dir[0], sol.dir[1], st.v, sol.el, 0, 0); b.contact = false;
        }
        this.fired = true; this.firedT = g.t;
      }
      return;
    }
    for (const e of g.events) if ((e.type === 'air' || e.type === 'kick' || e.type === 'control') && e.player === g.human) this.tech = e.tech || e.part || this.tech;
    if (g.t - this.firedT > 4.2) this.finish(false, this.tech ? `${techName(this.tech)} – kein Tor` : 'Ball verpasst');
  }
  onGoal(side) { if (side > 0 && this.fired && this.tech) this.finish(true, `Tor! ${techName(this.tech)}`); }
  status() { return `Volley-Station · Ball ${Math.min(this.attempt, 10)}/10 · Tore ${this.score}`; }
}
const TECH_DE = { volley: 'Volley', dropkick: 'Dropkick', seitfall: 'Seitfallzieher', fallrueck: 'Fallrückzieher', kopf: 'Kopfball', flugkopf: 'Flugkopfball', vollspann: 'Vollspann', innenrist: 'Innenrist', aussenrist: 'Außenrist', innen: 'Innenseite', aussen: 'Außenrist', ferse: 'Hacke', chip: 'Chip', brust: 'Brust', oberschenkel: 'Oberschenkel' };
export const techName = (t) => TECH_DE[t] || t || '';

// ---------------- Bandenpass: Puppen versperren den Weg, Ball über die Bande in den Kreis ----------------
export const BANDE_STATIONS = [
  { ball: [-6, 3.6], zone: [-0.5, 3.4], r: 1.3, dummies: [[-3.3, 3.6], [-3.3, 2.9], [-3.3, 4.3]] },
  { ball: [-6, -3.8], zone: [0, -3.6], r: 1.3, dummies: [[-3.0, -3.8], [-3.0, -3.1], [-3.0, -4.5]] },
  { ball: [-2, 3.0], zone: [5, 4.0], r: 1.2, dummies: [[1.4, 3.3], [1.4, 2.6], [1.4, 4.0], [1.4, 4.7]] },
  { ball: [-2, -2.6], zone: [4.5, -4.2], r: 1.1, dummies: [[1.2, -3.2], [1.2, -2.5], [1.2, -3.9], [1.2, -4.6]] },
  { ball: [-7, 2.0], zone: [1.5, 1.2], r: 1.0, dummies: [[-3, 1.8], [-3, 1.1], [-3, 2.5], [-3, 0.4]] },
  { ball: [0, -3.0], zone: [7, -2.2], r: 0.9, dummies: [[3.4, -2.8], [3.4, -2.1], [3.4, -3.5], [3.4, -1.4]] },
];
class Bande extends Challenge {
  setupAttempt(k) {
    const g = this.g, st = BANDE_STATIONS[(k - 1) % BANDE_STATIONS.length];
    this.st = st;
    // Puppen als harte Rohre im Käfig (Ball prallt ab), vorherige entfernen
    g.cage.bars = g.cage.bars.filter((bb) => bb.tag !== 'dummy');
    this.dummies = st.dummies.map(([x, z]) => ({ x, z, r: 0.22 }));
    for (const d of this.dummies) g.cage.bars.push({ a: [d.x, 0, d.z], b: [d.x, 1.75, d.z], r: d.r, tag: 'dummy' });
    this.zones = [{ x: st.zone[0], z: st.zone[1], r: st.r, lit: true }];
    const [bx, bz] = st.ball, f = Math.atan2(st.zone[1] - bz, st.zone[0] - bx);
    g.ball.place(bx, g.ball.r, bz); g.ball.held = -1;
    this.placeMe(bx - Math.cos(f) * 0.42, bz - Math.sin(f) * 0.42, f);
    this.kicked = false; this.boardHit = false; this.dummyHit = false;
  }
  run() {
    const g = this.g, b = g.ball, z = this.zones[0];
    for (const e of g.events) { if (e.type === 'board' && e.tag === 'side') this.boardHit = true; if (e.type === 'post' && e.tag === 'dummy') this.dummyHit = true; }
    if (!this.kicked && g.lastTouch === g.human && b.v.len() > 2 && g.t - g.lastTouchT < 0.1) { this.kicked = true; this.kickT = g.t; }
    if (!this.kicked) { if (this.attemptT > 12) this.finish(false, 'Zeit um'); return; }
    if (this.boardHit && Math.hypot(b.p.x - z.x, b.p.z - z.z) <= z.r && b.p.y < 1) { this.finish(true, 'Treffer über die Bande!'); return; }
    if (g.lastTouch === g.human && g.t - g.lastTouchT < 0.05 && g.t - this.kickT > 0.3) { this.finish(false, 'Nochmal berührt – zählt nicht'); return; }
    if (b.v.len() < 0.3 || g.t - this.kickT > 6) this.finish(false, this.dummyHit ? 'Puppe getroffen' : this.boardHit ? 'Über die Bande, aber daneben' : 'Nicht über die Bande');
  }
  passTargets() { const z = this.zones[0]; return z ? [{ id: -10, x: z.x, z: z.z, vx: 0, vz: 0, virtual: true }] : []; }
  status() { return `Bandenpass · Station ${Math.min(this.attempt, 6)}/6 · Treffer ${this.score}`; }
}

// ---------------- Dribbel-Parcours: 5 Hütchen-Tore im Slalom, dann ins Tor, auf Zeit ----------------
export const DRIBBEL_GATES = [[-6, 1.6], [-3, -1.6], [0, 1.6], [3, -1.6], [5.6, 1.2]];
class Dribbel extends Challenge {
  constructor(g, d) {
    super(g, d);
    this.gates = DRIBBEL_GATES.map(([x, z]) => ({ x, z, w: 1.7, passed: false, missed: false }));
    this.cones = []; for (const gt of this.gates) this.cones.push({ x: gt.x, z: gt.z - gt.w / 2 }, { x: gt.x, z: gt.z + gt.w / 2 });
  }
  setupAttempt() {
    const g = this.g;
    g.ball.place(-8.6, g.ball.r, 0); g.ball.held = -1;
    this.placeMe(-9.1, 0, 0);
    this.gates.forEach((gt) => { gt.passed = false; gt.missed = false; });
    this.t0 = null; this.pen = 0; this.next = 0; this.prevX = this.me.x; this.time = null;
  }
  run() {
    const g = this.g, p = this.me;
    if (this.t0 == null && g.lastTouch === g.human) this.t0 = g.t;
    // Tor-Durchgang: Spieler kreuzt x des nächsten Hütchen-Tors
    const gt = this.gates[this.next];
    if (gt && this.prevX < gt.x && p.x >= gt.x) {
      if (Math.abs(p.z - gt.z) <= gt.w / 2) gt.passed = true; else { gt.missed = true; this.pen += 3; this.msg = 'Hütchen-Tor verpasst: +3 s'; this.msgT = 1.2; }
      this.next++;
    }
    this.prevX = p.x;
    if ((this.t0 != null && g.t - this.t0 > 90) || (this.t0 == null && this.attemptT > 60)) this.finish(false, 'Zeit um (90 s)');
  }
  onGoal(side) {
    if (side > 0 && this.t0 != null) {
      const miss = this.gates.length - this.next; // Tore nicht erreicht = verpasst
      this.pen += 3 * miss;
      this.time = +(this.g.t - this.t0 + this.pen).toFixed(2);
      this.finish(true, `Zeit ${this.time.toFixed(1).replace('.', ',')} s${this.pen ? ` (inkl. ${this.pen} s Strafe)` : ''}`, 1.5, 0);
    }
  }
  resultScore() { return this.time; }
  status() { const t = this.t0 == null ? 0 : this.g.t - this.t0; return `Dribbel-Parcours · ${t.toFixed(1).replace('.', ',')} s · Tor ${Math.min(this.next + 1, 5)}/5${this.pen ? ` · +${this.pen} s` : ''}`; }
}

// ---------------- Elfmeter: 5 aus 6 m gegen den Bot-Tormann ----------------
class Elfmeter extends Challenge {
  setupAttempt() {
    const g = this.g, gx = this.hx;
    g.ball.place(gx - 6, g.ball.r, 0); g.ball.held = -1;
    this.placeMe(gx - 7.0, 0, 0);
    const k = g.players[1]; k.place(gx - 0.35, 0, Math.PI); k.resetHands();
    g.rules.updateKeepers(0, true);
    this.kicked = false;
  }
  run() {
    const g = this.g, b = g.ball;
    if (!this.kicked && g.lastTouch === g.human && b.v.len() > 3) { this.kicked = true; this.kickT = g.t; }
    if (!this.kicked) { if (this.attemptT > 14) this.finish(false, 'Zeit um'); return; }
    if (b.held >= 0) { this.finish(false, 'Gehalten!'); return; }
    if (g.lastTouch === 1 && g.t - g.lastTouchT < 0.05) { this.finish(false, 'Abgewehrt!'); return; }
    if (g.t - this.kickT > 2.5) this.finish(false, 'Vorbei');
  }
  onGoal(side) { if (side > 0 && this.kicked) this.finish(true, 'Tor!'); }
  input(i) { return lineKeeper(this, i, this.kicked ? 2.5 : 0.5); } // bis zum Schuss auf der Linie
  status() { return `Elfmeter · Schuss ${Math.min(this.attempt, 5)}/5 · Tore ${this.score}`; }
}

// ---------------- Doppelpass: Mitspieler spielt direkt in den Lauf ----------------
class Doppelpass extends Challenge {
  setupAttempt(k) {
    const g = this.g;
    const side = k % 2 ? 1 : -1;
    g.ball.place(-5.6, g.ball.r, -1.6 * side); g.ball.held = -1;
    this.placeMe(-6.0, -1.6 * side, 0);
    const wall = g.players[1]; wall.place(-0.5, 2.6 * side, Math.PI + 0.4 * side); wall.resetHands();
    const kp = g.players[2]; kp.place(this.hx - 0.5, 0, Math.PI); kp.resetHands();
    g.rules.updateKeepers(0, true);
    this.wallTouched = false; this.returned = false;
  }
  run() {
    const g = this.g, b = g.ball, wall = g.players[1];
    if (g.lastTouch === wall.id && !this.wallTouched) this.wallTouched = true;
    if (this.attemptT > 7) this.finish(false, this.wallTouched ? 'Zu langsam abgeschlossen' : 'Kein Doppelpass');
    if (b.held >= 0 && g.players[b.held].team === 1) this.finish(false, 'Tormann hat ihn');
  }
  input(i) {
    const g = this.g, pl = g.players[i];
    if (pl.team === 1) return lineKeeper(this, i, 1.0);
    // Wand: steht, nimmt den Ball direkt und spielt ihn in den Lauf des Menschen
    const b = g.ball, d = Math.hypot(b.p.x - pl.x, b.p.z - pl.z);
    if (!pl.pending && d < 3.5 && g.lastTouch === g.human && !this.returned) { pl.kickAt({ kind: 'pass', lead: true, to: g.human, noise: 0.6 }); this.returned = true; }
    return EMPTY_INPUT;
  }
  onGoal(side) { if (side > 0) this.finish(this.wallTouched, this.wallTouched ? 'Tor nach Doppelpass!' : 'Tor – aber ohne Doppelpass', 1.3, this.wallTouched ? 1 : 0); }
  status() { return `Doppelpass · Versuch ${Math.min(this.attempt, 5)}/5 · Tore ${this.score}`; }
}

// ---------------- Tormann: Ballmaschine-Serie (steigende Schwierigkeit) und Reaktion ----------------
// Serien-Schüsse (Orange verteidigt das linke Tor, x = −10): Art, Maschinenplatz relativ zum Tor, Ziel im Tor, Tempo, Drall
export const KEEPER_SERIES = [
  { kind: 'flach', m: [8, 0], t: [0.6, 0.3], v: 14 },
  { kind: 'flach', m: [8, 2], t: [-0.9, 0.3], v: 16 },
  { kind: 'hoch', m: [8, -1.5], t: [0.8, 1.55], v: 17 },
  { kind: 'flatter', m: [9.5, 0], t: [-0.4, 1.0], v: 26 },
  { kind: 'aufsetzer', m: [8, 1], t: [0.5, 0.25], v: 18, bounce: 1.8 },
  { kind: 'flach', m: [7, -2.5], t: [1.1, 0.35], v: 20 },
  { kind: 'bande', m: [9, -4.8], t: [-0.6, 0.6], v: 17, board: 1 },
  { kind: 'kurve', m: [8, 2.5], t: [-1.1, 0.5], v: 20, side: 9 },
  { kind: 'hoch', m: [7, 0.5], t: [-1.1, 1.6], v: 21 },
  { kind: 'flatter', m: [10, -1], t: [0.9, 0.7], v: 27 },
  { kind: 'kurve', m: [8, -2.5], t: [1.15, 1.3], v: 21, side: -9 },
  { kind: 'aufsetzer', m: [7, -0.5], t: [-1.0, 0.3], v: 22, bounce: 1.4 },
];
const KIND_DE = { flach: 'flach', hoch: 'hoch', flatter: 'Flatterball', aufsetzer: 'Aufsetzer', bande: 'über die Bande', kurve: 'Kurvenball', reaktion: 'Reaktion' };
class KeeperSeries extends Challenge {
  constructor(g, d) { super(g, d); this.machine = { x: 0, z: 0, yaw: Math.PI, pitch: 0, firedT: -9, shots: 0 }; this.reaction = d.id === 'tw_reaktion'; }
  setupAttempt(k) {
    const g = this.g, gx = -this.hx, rng = g.rng;
    const s = this.reaction
      ? { kind: 'reaktion', m: [6, rng.range(-1.5, 1.5)], t: [(rng.next() < 0.5 ? -1 : 1) * rng.range(0.6, 1.2), rng.next() < 0.5 ? rng.range(0.2, 0.6) : rng.range(1.1, 1.6)], v: rng.range(17, 22), side: rng.range(-3, 3) }
      : KEEPER_SERIES[(k - 1) % KEEPER_SERIES.length];
    this.s = s;
    const m = this.machine; m.x = gx + s.m[0]; m.z = s.m[1]; m.yaw = Math.atan2(-m.z, gx - m.x);
    const me = this.me;
    if (k === 1 || this.reaction || Math.abs(me.x - gx) > 3.5) this.placeMe(gx + 1.1, 0, 0);
    me.resetHands();
    g.ball.place(m.x, MACHINE_H, m.z); g.ball.held = -1; g.ball.v.set(0, 0, 0); g.ball.contact = false;
    g.rules.updateKeepers(0, true);
    this.fired = false; this.saved = false;
  }
  run() {
    const g = this.g, b = g.ball, s = this.s, m = this.machine, gx = -this.hx;
    const delay = this.reaction ? 0.9 + g.rng.next() * 0.02 : 1.6;
    if (!this.fired) {
      b.place(m.x, MACHINE_H, m.z); b.v.set(0, 0, 0); b.contact = false;
      if (this.attemptT >= delay) { this.fire(s, gx); this.fired = true; this.firedT = g.t; }
      return;
    }
    if (b.held >= 0) { this.finish(true, 'Gefangen!', this.reaction ? 0.9 : 1.3); return; }
    for (const e of g.events) if ((e.type === 'parry' || (e.type === 'body' && e.player === g.human)) && !this.saved) this.saved = true;
    if (g.t - this.firedT > (this.reaction ? 1.6 : 2.4)) { if (this.saved) this.finish(true, 'Abgewehrt!', this.reaction ? 0.8 : 1.2, 1); else this.finish(null, 'Vorbei', 1.0); }
  }
  fire(s, gx) {
    const g = this.g, m = this.machine, P = g.P;
    const T = [gx, s.t[1], s.t[0]];
    const n = [Math.sign(gx), 0, 0];
    if (s.bounce) { // Aufsetzer: zielt auf einen Punkt vor dem Tor, springt hinein
      const Tb = [gx + 1 * Math.sign(-gx) * s.bounce, 0.2, s.t[0] * 0.8];
      fireMachine(g, m, Tb, s.v, -8, 0);
    } else if (s.board) { // Bandenabpraller: Zielpunkt an der Längsbande per Rastersuche (Abprall + Aufsetzer sind nicht
      // monoton), mit dem echten Ball im Käfig: der Punkt, dessen Abpraller dem Ziel im Tor am nächsten kommt
      const zb = Math.sign(m.z || -1) * (this.hz - 0.12);
      let best = null;
      for (let xm = gx + 0.8 * Math.sign(-gx); Math.sign(-gx) * (m.x - xm) > 0.4; xm += 0.2 * Math.sign(-gx)) {
        const sol = aimAt(P, [m.x, MACHINE_H, m.z], [xm, 0.6, zb], s.v, spinOf(0, 0));
        const ce = Math.cos(sol.el);
        const c = simCross(g, [m.x, MACHINE_H, m.z], [sol.dir[0] * s.v * ce, s.v * Math.sin(sol.el), sol.dir[1] * s.v * ce], [0, 0, 0], gx);
        if (!c || Math.abs(c.z) > this.gw - 0.15 || c.y > this.gH - 0.2) continue;
        const err = Math.abs(c.z - s.t[0]);
        if (!best || err < best.err) best = { err, xm };
      }
      fireMachine(g, m, best ? [best.xm, 0.6, zb] : T, s.v, 0, 0, best ? null : n);
    } else fireMachine(g, m, T, s.v, s.kind === 'flatter' ? 0 : -6, (s.side || 0) * TAU, n);
    this.msg = KIND_DE[s.kind] ? `Schuss ${this.attempt}: ${KIND_DE[s.kind]}` : ''; this.msgT = 1.0;
  }
  onGoal(side) { if (side < 0 && this.fired) this.finish(false, 'Tor – nicht gehalten', this.reaction ? 0.9 : 1.3); }
  status() { return `${this.reaction ? 'Reaktion' : 'Ballmaschine'} · Schuss ${Math.min(this.attempt, this.def.attempts)}/${this.def.attempts} · gehalten ${this.score}`; }
}

// ---------------- 1 gegen 1: Bot-Stürmer läuft allein aufs Tor ----------------
class OneOnOne extends Challenge {
  setupAttempt(k) {
    const g = this.g, gx = -this.hx;
    const z = [0, 2.5, -2.5, 1.2, -1.2][(k - 1) % 5];
    const att = g.players[1]; att.place(1.5, z, Math.PI); att.resetHands();
    g.ball.place(1.1, g.ball.r, z); g.ball.held = -1;
    if (k === 1 || Math.abs(this.me.x - gx) > 3) this.placeMe(gx + 1.1, 0, 0);
    this.me.resetHands();
    g.rules.updateKeepers(0, true);
    this.started = false;
  }
  run() {
    const g = this.g, b = g.ball, gx = -this.hx;
    if (b.held >= 0 && b.held === g.human) { this.finish(true, 'Gefangen!'); return; }
    if (g.lastTouch === g.human && g.t - g.lastTouchT < 0.05 && b.held < 0) this.touchedByMe = true;
    if (this.attemptT > 9) { this.finish(true, 'Gehalten (Zeit)'); return; }
    // Ball weit vom Tor weg nach einer Parade/Klärung: gehalten
    if (this.touchedByMe && Math.hypot(b.p.x - gx, b.p.z) > 7) this.finish(true, 'Geklärt!');
  }
  input(i) { return this.bots ? this.bots.attackInput(i) : EMPTY_INPUT; }
  onGoal(side) { if (side < 0) this.finish(false, 'Tor – der Stürmer trifft'); }
  status() { return `1 gegen 1 · Versuch ${Math.min(this.attempt, 5)}/5 · gehalten ${this.score}`; }
}

// Tormann-Bot, der höchstens `maxOut` m vor seiner Torlinie steht (Training: Tormann bleibt auf der Linie)
function lineKeeper(C, i, maxOut) {
  if (!C.bots) return EMPTY_INPUT;
  const inp = C.bots.keeperInput(i), pl = C.g.players[i], gx = C.hx;
  const out = gx - pl.x;
  if (out > maxOut && inp.mx < 0.2) { inp.mx = 0.8; inp.mz *= 0.3; }
  return inp;
}

const CLASSES = { torwand: Torwand, volley: Volley, bande: Bande, dribbel: Dribbel, elfmeter: Elfmeter, doppelpass: Doppelpass, tw_serie: KeeperSeries, tw_reaktion: KeeperSeries, tw_1gegen1: OneOnOne };
export function makeChallenge(game, id) {
  const def = challengeDef(id);
  if (!def) throw new Error('Unbekannte Challenge ' + id);
  return new CLASSES[id](game, def);
}
void clamp; void DEG;
