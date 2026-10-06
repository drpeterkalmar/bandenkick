// Tor-Wiederholung (Nacht 2d, Peter: „nach tor Actionreplay mit extrem zoom und effekt fan cam slo mo im moment des
// Ballkontaktes und im Torbereich“). Ohne DOM und ohne three.js (läuft auch in Node):
//  - ReplayRecorder: Ringpuffer der letzten REC_SECS s, nur der Darstellungs-Zustand je Spieltakt (Positionen, Blick,
//    Posen-Zustand: Luftball, am Boden, Grätsche, Hände/Hechten, Technik, Schussbein, Laufphase; Ball mit Drehlage und
//    Drall) und die Ereignisse. Er liest die Simulation nur – sie bleibt unberührt und deterministisch.
//  - ReplayDirector: Ablauf der Wiederholung als Abschnitte in Spielzeit mit Abspieltempo und Kamera:
//    Aufbau (Echtzeit, TV-Kamera) → Ballkontakt (Zeitlupe 0,2 ×, extremer Zoom auf Fuß und Ball, Blitz und Druckwelle)
//    → Flug (Echtzeit) → Torbereich als Fan-Cam hinter dem Tor (Zeitlupe) → zurück zum Jubel. Tippen überspringt.
//  - Kameras als reine Rechnung (Position, Blickpunkt, Öffnungswinkel), die Grafik setzt sie nur um.

export const REC_SECS = 8;      // s Ringpuffer
export const REC_HZ = 120;      // je Spieltakt (DT = 1/120 s)
const TECHS = ['', 'volley', 'dropkick', 'seitfall', 'fallrueck', 'kopf', 'flugkopf', 'vollspann', 'innenrist', 'aussenrist',
  'innen', 'aussen', 'ferse', 'chip', 'brust', 'oberschenkel', 'graetsche', 'stolpern', 'heber'];
const TECH_ID = Object.fromEntries(TECHS.map((t, i) => [t, i]));
const HAND = ['none', 'hold', 'dive', 'ground'];
const HAND_ID = { none: 0, hold: 1, dive: 2, ground: 3 };
const SLIDE = ['', 'slide', 'ground'];
const KEEP_EV = new Set(['kick', 'air', 'airstart', 'goal', 'catch', 'parry', 'dive', 'post', 'net', 'board', 'tackle']);

// Felder je Spieler (Reihenfolge im Puffer)
const PF = ['x', 'z', 'face', 'speed', 'vx', 'vz', 'kickT', 'kickFoot', 'plant', 'jumpY', 'techT', 'tech', 'hand', 'handT', 'handTT',
  'handDx', 'handDz', 'air', 'airGo', 'airT0', 'airTc', 'airCy', 'fall', 'fallT', 'fallDur', 'slide', 'slideT', 'keeper'];
const NPF = PF.length;
const HF = 20; // Kopf: t, Ball x y z, Drehlage q0…q3, v x y z, gehalten, frei, Netz-Ausbeulung (Tiefe, x y z, Normale)

export class ReplayRecorder {
  constructor(nPlayers, secs = REC_SECS) {
    this.n = nPlayers;
    this.cap = Math.round(secs * REC_HZ);
    this.stride = HF + NPF * nPlayers;
    this.buf = new Float32Array(this.cap * this.stride);
    this.tAbs = new Float64Array(this.cap); // Spielzeit genau (Float32 reicht nach Minuten nicht mehr)
    this.head = 0; this.count = 0;
    this.events = [];
  }
  reset() { this.head = 0; this.count = 0; this.events.length = 0; }
  // Nach jedem Spieltakt: Zustand und Ereignisse dieses Takts aufnehmen
  record(game, events = []) {
    if (game.players.length !== this.n) return;
    const i = this.head, o = i * this.stride, B = this.buf, b = game.ball;
    this.tAbs[i] = game.t;
    B[o] = 0; B[o + 1] = b.p.x; B[o + 2] = b.p.y; B[o + 3] = b.p.z;
    B[o + 4] = b.q[0]; B[o + 5] = b.q[1]; B[o + 6] = b.q[2]; B[o + 7] = b.q[3];
    B[o + 8] = b.v.x; B[o + 9] = b.v.y; B[o + 10] = b.v.z; B[o + 11] = b.held; B[o + 12] = 0;
    const nt = b.net;
    B[o + 13] = nt ? nt.depth : 0;
    if (nt && nt.depth > 0) { B[o + 14] = nt.x; B[o + 15] = nt.y; B[o + 16] = nt.z; B[o + 17] = nt.n[0]; B[o + 18] = nt.n[1]; B[o + 19] = nt.n[2]; }
    const R = game.match ? game.rules : null;
    for (let k = 0; k < this.n; k++) {
      const p = game.players[k], q = o + HF + k * NPF, a = p.air, f = p.fall, s = p.slide;
      B[q] = p.x; B[q + 1] = p.z; B[q + 2] = p.face; B[q + 3] = p.speed; B[q + 4] = p.vx; B[q + 5] = p.vz;
      B[q + 6] = Math.min(p.kickT, 99); B[q + 7] = p.kickFoot; B[q + 8] = p.plant || 0; B[q + 9] = p.jumpY || 0;
      B[q + 10] = Math.min(p.techT, 99); B[q + 11] = TECH_ID[p.tech] || 0;
      B[q + 12] = HAND_ID[p.hand.mode] || 0; B[q + 13] = p.hand.t; B[q + 14] = p.hand.T || 0; B[q + 15] = p.hand.dx; B[q + 16] = p.hand.dz;
      B[q + 17] = a ? TECH_ID[a.tech] || 0 : 0; B[q + 18] = a && a.go ? 1 : 0; B[q + 19] = a && a.t0 != null ? a.t0 - game.t : 0;
      B[q + 20] = a ? a.tc - game.t : 0; B[q + 21] = a ? a.cy : 0;
      B[q + 22] = f ? TECH_ID[f.tech] || 0 : 0; B[q + 23] = f ? f.t : 0; B[q + 24] = f ? f.dur : 0;
      B[q + 25] = s ? (s.phase === 'slide' ? 1 : 2) : 0; B[q + 26] = s ? s.t : 0;
      B[q + 27] = R && R.keeper[p.team] === p.id && R.handsOffTeam !== p.team ? 1 : 0;
    }
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) this.count++;
    // Ereignisse geschehen zu Beginn des Takts (Ball noch am Fuß) → Zeit des vorigen Takts
    for (const e of events) if (KEEP_EV.has(e.type)) this.events.push({ ...e, t: game.t - 1 / REC_HZ });
    const tMin = game.t - this.cap / REC_HZ;
    let cut = 0; while (cut < this.events.length && this.events[cut].t < tMin) cut++;
    if (cut) this.events.splice(0, cut);
  }
  get tFirst() { return this.count ? this.tAbs[(this.head - this.count + this.cap) % this.cap] : 0; }
  get tLast() { return this.count ? this.tAbs[(this.head - 1 + this.cap) % this.cap] : 0; }
  // Index (im Ring) des Takts ≤ t und Anteil zum nächsten
  locate(t) {
    if (!this.count) return null;
    const t0 = this.tFirst, f = Math.max(0, Math.min(this.count - 1, (t - t0) * REC_HZ));
    const k = Math.floor(f), a = k >= this.count - 1 ? 0 : f - k;
    const i0 = (this.head - this.count + k + this.cap) % this.cap, i1 = (i0 + 1) % this.cap;
    return { i0, i1, a, t: this.tAbs[i0] + a / REC_HZ };
  }
  // Darstellungs-Zustand zur Spielzeit t (zwischen zwei Takten interpoliert) in out = {t, ball, players}. Die Spieler
  // haben dieselben Felder, die die Grafik am echten Spieler liest (avatars.js update/techPose, actors.js posePlayer).
  frameAt(t, out, P = null) {
    const L = this.locate(t);
    if (!L) return null;
    const B = this.buf, o0 = L.i0 * this.stride, o1 = L.i1 * this.stride, a = L.a;
    const lerp = (j) => B[o0 + j] + (B[o1 + j] - B[o0 + j]) * a;
    out.t = L.t;
    const ball = out.ball || (out.ball = { p: { x: 0, y: 0, z: 0 }, q: [1, 0, 0, 0], v: { x: 0, y: 0, z: 0 }, held: -1 });
    ball.p.x = lerp(1); ball.p.y = lerp(2); ball.p.z = lerp(3);
    // Drehlage: normalisierter Lerp (die Schritte je Takt sind klein); Vorzeichen angleichen
    let d = 0; for (let j = 0; j < 4; j++) d += B[o0 + 4 + j] * B[o1 + 4 + j];
    const s1 = d < 0 ? -a : a;
    let ql = 0; for (let j = 0; j < 4; j++) { ball.q[j] = B[o0 + 4 + j] * (1 - a) + B[o1 + 4 + j] * s1; ql += ball.q[j] ** 2; }
    ql = Math.sqrt(ql) || 1; for (let j = 0; j < 4; j++) ball.q[j] /= ql;
    ball.v.x = lerp(8); ball.v.y = lerp(9); ball.v.z = lerp(10); ball.held = B[o0 + 11];
    const net = ball.net || (ball.net = { depth: 0, x: 0, y: 0, z: 0, n: [0, 1, 0] });
    const oN = B[o1 + 13] > B[o0 + 13] ? o1 : o0; // Netz-Ausbeulung des Takts mit der tieferen Delle
    net.depth = B[o0 + 13] + (B[o1 + 13] - B[o0 + 13]) * a; net.x = B[oN + 14]; net.y = B[oN + 15]; net.z = B[oN + 16];
    net.n[0] = B[oN + 17]; net.n[1] = B[oN + 18]; net.n[2] = B[oN + 19];
    const ps = out.players || (out.players = []);
    for (let k = 0; k < this.n; k++) {
      const q0 = o0 + HF + k * NPF, q1 = o1 + HF + k * NPF;
      const L2 = (j) => B[q0 + j] + (B[q1 + j] - B[q0 + j]) * a;
      const p = ps[k] || (ps[k] = { id: k, P, hand: { mode: 'none', t: 0, T: 0, dx: 1, dz: 0 }, air: null, fall: null, slide: null, ghost: true });
      p.P = P || p.P;
      p.x = L2(0); p.z = L2(1);
      let df = B[q1 + 2] - B[q0 + 2]; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
      p.face = B[q0 + 2] + df * a;
      p.speed = L2(3); p.vx = L2(4); p.vz = L2(5); p.kickT = B[q0 + 6] + a / REC_HZ; p.kickFoot = B[q0 + 7]; p.plant = L2(8); p.jumpY = L2(9);
      p.techT = B[q0 + 10] + a / REC_HZ; p.tech = TECHS[B[q0 + 11]] || '';
      p.hand.mode = HAND[B[q0 + 12]] || 'none'; p.hand.t = B[q0 + 13] + a / REC_HZ; p.hand.T = B[q0 + 14]; p.hand.dx = B[q0 + 15]; p.hand.dz = B[q0 + 16];
      if (B[q0 + 17]) {
        const ar = p._air || (p._air = {});
        ar.tech = TECHS[B[q0 + 17]]; ar.go = !!B[q0 + 18]; ar.t0 = out.t + B[q0 + 19] - a / REC_HZ; ar.tc = out.t + B[q0 + 20] - a / REC_HZ; ar.cy = B[q0 + 21];
        if (!ar.go) ar.t0 = null;
        p.air = ar;
      } else p.air = null;
      if (B[q0 + 22]) { const fl = p._fall || (p._fall = {}); fl.tech = TECHS[B[q0 + 22]]; fl.t = B[q0 + 23] + a / REC_HZ; fl.dur = B[q0 + 24]; p.fall = fl; } else p.fall = null;
      if (B[q0 + 25]) { const sl = p._slide || (p._slide = {}); sl.phase = SLIDE[B[q0 + 25]]; sl.t = B[q0 + 26] + a / REC_HZ; p.slide = sl; } else p.slide = null;
      p.keeper = !!B[q0 + 27];
    }
    return out;
  }
  // Ballbahn der letzten `back` s bis t (für die Ballspur), höchstens n Punkte
  trail(t, back, n, out = []) {
    out.length = 0;
    for (let k = n - 1; k >= 0; k--) {
      const L = this.locate(t - back * k / (n - 1));
      if (!L) break;
      const o = L.i0 * this.stride, o1 = L.i1 * this.stride, B = this.buf, a = L.a;
      out.push([B[o + 1] + (B[o1 + 1] - B[o + 1]) * a, B[o + 2] + (B[o1 + 2] - B[o + 2]) * a, B[o + 3] + (B[o1 + 3] - B[o + 3]) * a]);
    }
    return out;
  }
}

// Ballkontakt des Torschusses: letztes Schuss-Ereignis (Schuss, Luftball, auch Pass/Klärung – manchmal fällt ein Tor
// aus einem Pass) des Torschützen vor dem Tor; ohne Schützen (Eigentor) der letzte Kontakt vor dem Tor überhaupt.
export function findContact(rec, goal) {
  const ev = rec.events, tg = goal.t;
  let any = null;
  for (let i = ev.length - 1; i >= 0; i--) {
    const e = ev[i];
    if (e.t > tg + 1e-6 || e.t < tg - 5) continue;
    const kick = e.type === 'kick' || e.type === 'air';
    if (!kick) continue;
    if (!any) any = e;
    if (goal.scorer >= 0 && e.player === goal.scorer) return e;
  }
  return any;
}

// Ablauf. opts: {aufbau: s Echtzeit vor dem Kontakt, maxReal: s gesamt}
export const REPLAY_SHOTS = { kontaktRate: 0.2, kontaktVor: 0.15, kontaktNach: 0.2, fanRate: 0.3, fanVor: 0.3, fanNach: 0.5, aufbau: 2.2, maxReal: 7.0 };
export class ReplayDirector {
  constructor(rec, goal, opts = {}) {
    const S = { ...REPLAY_SHOTS, ...opts };
    this.rec = rec; this.goal = goal; this.S = S;
    const e = findContact(rec, goal);
    // Kontakt mit Schussrichtung aus der Aufzeichnung (Luftball-Ereignisse haben keine Richtung)
    let c = null;
    if (e) {
      const f = rec.frameAt(e.t + 1 / 60, {});
      const v = f ? f.ball.v : { x: e.dx || 1, z: e.dz || 0 };
      c = { t: e.t, x: e.x, y: e.y, z: e.z, dx: v.x, dz: v.z, speed: e.speed || 0, tech: e.tech || '', player: e.player, type: e.type };
    }
    this.contact = c;
    const tg = goal.t, tc = c ? c.t : tg - 0.5;
    const k0 = Math.max(rec.tFirst, tc - S.kontaktVor), k1 = Math.min(tg, tc + S.kontaktNach);
    const f0 = Math.max(k1, tg - S.fanVor), f1 = Math.min(rec.tLast, tg + S.fanNach);
    // Aufbau so lang, dass alles in maxReal passt
    const fixed = (k1 - k0) / S.kontaktRate + (f0 - k1) + (f1 - f0) / S.fanRate;
    const aufbau = Math.max(0.8, Math.min(S.aufbau, S.maxReal - fixed));
    const a0 = Math.max(rec.tFirst, k0 - aufbau);
    this.segs = [
      { name: 'aufbau', t0: a0, t1: k0, rate: 1, cam: 'tv' },
      { name: 'kontakt', t0: k0, t1: k1, rate: S.kontaktRate, cam: 'zoom' },
      { name: 'flug', t0: k1, t1: f0, rate: 1, cam: 'tv' },
      { name: 'fancam', t0: f0, t1: f1, rate: S.fanRate, cam: 'fan' },
    ].filter((s) => s.t1 - s.t0 > 1e-3);
    this.seg = 0; this.t = this.segs.length ? this.segs[0].t0 : tg; this.real = 0; this.done = !this.segs.length; this.skipped = false;
    this.realTotal = this.segs.reduce((a, s) => a + (s.t1 - s.t0) / s.rate, 0);
  }
  get phase() { return this.done ? 'ende' : this.segs[this.seg].name; }
  get cur() { return this.segs[Math.min(this.seg, this.segs.length - 1)]; }
  // Echtzeit dt weiter → aktuelle Spielzeit der Wiederholung
  update(dt) {
    if (this.done) return this.t;
    this.real += dt;
    let rem = dt;
    while (rem > 0 && !this.done) {
      const s = this.segs[this.seg], need = (s.t1 - this.t) / s.rate;
      if (rem < need) { this.t += rem * s.rate; rem = 0; }
      else { rem -= need; this.t = s.t1; this.seg++; if (this.seg >= this.segs.length) this.done = true; }
    }
    return this.t;
  }
  skip() { this.done = true; this.skipped = true; }
  // Anteil 0…1 im laufenden Abschnitt
  segFrac() { const s = this.cur; return Math.max(0, Math.min(1, (this.t - s.t0) / Math.max(1e-6, s.t1 - s.t0))); }
}

// ---------------- Kameras (reine Rechnung) ----------------
// mode 'hoch' | 'quer'; cage aus world.js; f = Zustand (frameAt), c = Kontakt, goal = {side: ±1}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function replayCamera(kind, f, ctx) {
  const { cage, mode, contact: c, goal, time } = ctx;
  const b = f.ball.p, hoch = mode === 'hoch';
  if (kind === 'zoom' && c) {
    // Extremer Zoom auf Fuß und Ball: seitlich zur Schussrichtung, knapp über dem Boden, langsames Kreisen; nach dem
    // Kontakt zieht die Kamera mit dem Ball mit (Blick zwischen Kontaktpunkt und Ball, etwas weiter weg)
    const dl = Math.hypot(c.dx || 1, c.dz || 0) || 1, ux = (c.dx || 1) / dl, uz = (c.dz || 0) / dl;
    const sd = ctx.side || 1, orbit = 0.35 * (ctx.frac - 0.5);
    const ca = Math.cos(orbit), sa = Math.sin(orbit);
    const nx = -uz * sd, nz = ux * sd; // quer zur Schussrichtung
    const ox = nx * ca - ux * sa, oz = nz * ca - uz * sa;
    const run = Math.max(0, (b.x - c.x) * ux + (b.z - c.z) * uz); // Weg des Balls seit dem Kontakt
    const fx = c.x + ux * (0.1 + run * 0.55), fz = c.z + uz * (0.1 + run * 0.55), fy = Math.max(0.2, c.y + (b.y - c.y) * 0.5);
    if (hoch) { // Hochformat: knapp hinter und neben dem Schützen, Blick über den Fuß dem Ball nach in die Tiefe
      const lx = c.x + ux * (0.6 + run * 0.85), lz = c.z + uz * (0.6 + run * 0.85);
      return { pos: [c.x - ux * 1.5 + nx * 0.45, Math.max(0.35, c.y + 0.3), c.z - uz * 1.5 + nz * 0.45], look: [lx, Math.max(0.15, c.y + (b.y - c.y) * 0.8), lz], fov: 42 };
    }
    const D = 2.0 + run * 0.45, h = Math.max(0.3, fy + 0.18);
    return { pos: [fx + ox * D, h, fz + oz * D], look: [fx, fy, fz], fov: 22 };
  }
  if (kind === 'fan') {
    // Fan-Cam: Handkamera außerhalb des Käfigs schräg hinter dem Tor auf Zuschauerhöhe, Blick durch Netz und Zaun
    const sx = goal.side, gx = sx * cage.hx;
    const zs = c && c.z < 0 ? 1 : -1; // von der Seite gegenüber dem Schützen: Ball fliegt auf die Kamera zu
    const px = gx + sx * (cage.gD + 2.6), pz = zs * (cage.gw + 1.6), py = 1.65;
    const wa = ctx.calm ? 0.2 : 1; // Deko: „Bewegung reduzieren“ → kaum Wackeln
    const w = (s, k) => (Math.sin(time * s + k) * 0.5 + Math.sin(time * s * 2.3 + k * 1.7) * 0.25) * wa; // Wackeln
    const lx = clamp(b.x, gx - sx * 6, gx + sx * 0.6), lz = clamp(b.z, -cage.gw - 1, cage.gw + 1);
    return { pos: [px + w(1.9, 0.3) * 0.05, py + w(2.6, 1.1) * 0.05, pz + w(1.4, 2.2) * 0.05],
      look: [lx * 0.7 + gx * 0.3 + w(2.2, 0.7) * 0.12, clamp(b.y, 0.4, 1.8) * 0.7 + 0.3, lz * 0.8 + w(1.7, 2.9) * 0.1], fov: hoch ? 62 : 44 };
  }
  // TV-Kamera: von der Längsseite erhöht, folgt dem Ball (hoch: vom Tor her über das Feld)
  if (hoch) {
    const gx = goal.side * cage.hx;
    return { pos: [gx + goal.side * 3.5, 7.5, clamp(b.z * 0.4, -3, 3)], look: [b.x, 0.6, b.z * 0.8], fov: 58 };
  }
  return { pos: [clamp(b.x * 0.85, -cage.hx, cage.hx), 6.2, cage.hz + 8.5], look: [b.x, 0.7, b.z * 0.6], fov: 32 };
}
