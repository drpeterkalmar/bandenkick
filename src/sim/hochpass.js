// n11 (Peter 02.11.: „Pässe gehen immer hoch damit mehr Akrobatik entsteht“, 02.11. abends: „die Pässe wurden bisher immer
// abgefangen“): hoher Pass (Lupfer/Flanke) mit Ankunft beim Mitspieler in Volley-, Brust- oder Kopfhöhe – und nur über einen freien
// Passweg. Ohne DOM, geprüft in tests/node/hochpass.test.mjs.
//  - Lupfer-Tabelle: Flugbahnen (Weg, Höhe, Tempo über der Zeit) je Abflugwinkel und Tempo, einmal mit dem echten Ball-Modell
//    simuliert (Luftwiderstand, Magnus mit dem Rückdrall der Flanke; mit Effet zusätzlich die seitliche Kurve)
//  - Löser: Tempo so, dass der Ball den Treffpunkt im Laufweg des Empfängers in der gewünschten Höhe im Fallen erreicht
//  - Sicherheit: für jeden Gegner, ob er irgendeinen Punkt der Bahn, den er in der Höhe erreicht (Fuß, Brust, Kopf mit Sprung,
//    Tormann mit den Händen), rechtzeitig erreicht (Reaktion + Laufweg) → Zeitreserve „slack“ (s, > 0 = er kommt zu spät)
import { Ball } from './ball.js';
import { setKick, chipBack, clamp } from './kickplan.js';

const DEG = Math.PI / 180;
const EMPTY_CAGE = { rects: [], bars: [], hx: 1e4, hz: 1e4, top: 1e4, bH: 1e4 };
// Tabelle: Abflug 10 … 60°, Tempo 3 … 30 m/s, Proben alle 0,04 s bis 3 s
const LE0 = 10, LDE = 5, LNE = 11, LU0 = 3, LDU = 0.5, LNU = 55, LDT = 0.04, LNT = 76;
export const HOCH_H = [1.0, 1.3, 1.7];             // m Ankunftshöhe (Ballmitte): Volley, Brust, Kopf
const cache = new WeakMap();
// Effet des Kurvenpasses (rad/s um die Hochachse): 0,5 × spinMax
export const kurvenSpin = (P) => 0.5 * P.spinMax * 2 * Math.PI;

function build(P, side) {
  const X = new Float32Array(LNE * LNU * LNT), Y = new Float32Array(LNE * LNU * LNT), V = new Float32Array(LNE * LNU * LNT), Z = side ? new Float32Array(LNE * LNU * LNT) : null;
  const b = new Ball({ ...P, knuckleF30: 0 });
  const sub = Math.round(LDT * 240), back = chipBack(P);
  for (let e = 0; e < LNE; e++) for (let i = 0; i < LNU; i++) {
    const o = (e * LNU + i) * LNT;
    b.place(0, b.r, 0);
    setKick(b, 1, 0, LU0 + i * LDU, (LE0 + e * LDE) * DEG, back, side);
    let landed = false;
    for (let k = 0; k < LNT; k++) {
      X[o + k] = b.p.x; Y[o + k] = landed ? -1 : b.p.y; V[o + k] = b.v.len(); if (Z) Z[o + k] = b.p.z;
      for (let s = 0; s < sub && !landed; s++) { b.step(1 / 240, EMPTY_CAGE); if (b.p.y <= b.r + 1e-4 && b.v.y <= 0.01) landed = true; }
      if (!landed && b.v.y < 0 && b.p.y < b.r + 0.02) landed = true;
    }
  }
  return { X, Y, V, Z };
}
export function lobTable(P, curve = false) {
  let c = cache.get(P);
  if (!c) { c = {}; cache.set(P, c); }
  if (curve) return c.s || (c.s = build(P, kurvenSpin(P)));
  return c.t || (c.t = build(P, 0));
}

// Bahn für Winkel-Index e und Tempo u (zwischen zwei Tabellenzeilen linear): schreibt Proben in out (x längs, y, z quer, v, t)
function pathRow(T, e, u, out) {
  const fu = clamp((u - LU0) / LDU, 0, LNU - 1.001), iu = Math.floor(fu), a = fu - iu;
  const o0 = (e * LNU + iu) * LNT, o1 = o0 + LNT;
  out.n = 0;
  for (let k = 0; k < LNT; k++) {
    const y0 = T.Y[o0 + k], y1 = T.Y[o1 + k];
    if (y0 < 0 || y1 < 0) break;
    const j = out.n++;
    out.x[j] = T.X[o0 + k] * (1 - a) + T.X[o1 + k] * a; out.y[j] = y0 * (1 - a) + y1 * a; out.v[j] = T.V[o0 + k] * (1 - a) + T.V[o1 + k] * a;
    out.z[j] = T.Z ? T.Z[o0 + k] * (1 - a) + T.Z[o1 + k] * a : 0;
  }
  return out;
}
const mk = () => ({ n: 0, x: new Float32Array(LNT), y: new Float32Array(LNT), z: new Float32Array(LNT), v: new Float32Array(LNT) });
const _p = mk(), _q = mk();
// Höhe beim Erreichen der Weite D (Zeit, Tempo, fällt der Ball schon?) – null, wenn er vorher landet
function atDist(path, D) {
  for (let k = 1; k < path.n; k++) {
    if (path.x[k] >= D) {
      const a = (D - path.x[k - 1]) / Math.max(1e-6, path.x[k] - path.x[k - 1]);
      return { k, a, t: (k - 1 + a) * LDT, y: path.y[k - 1] + (path.y[k] - path.y[k - 1]) * a, v: path.v[k - 1] + (path.v[k] - path.v[k - 1]) * a,
        z: path.z[k - 1] + (path.z[k] - path.z[k - 1]) * a, down: path.y[k] < path.y[k - 1] };
    }
  }
  return null;
}
// Tempo für Abflug-Index e, Weite D, Ankunftshöhe h (im Fallen); y0 = Starthöhe über der Tabelle (Luftball-Pass). null = keins
export function solveLob(P, e, D, h, y0 = 0, curve = false) {
  const T = lobTable(P, curve);
  let lo = LU0, hi = LU0 + (LNU - 1) * LDU;
  const f = (u) => { const r = atDist(pathRow(T, e, u, _p), D); return r ? r.y + y0 : -1; };
  if (f(hi) < h) return null;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (f(m) < h) lo = m; else hi = m; }
  const u = (lo + hi) / 2;
  pathRow(T, e, u, _p);
  const r = atDist(_p, D);
  if (!r || !r.down) return null;
  let apex = 0; for (let k = 0; k <= r.k && k < _p.n; k++) apex = Math.max(apex, _p.y[k] + y0);
  return { u, el: LE0 + e * LDE, T: r.t, vArr: r.v, apex, zD: r.z, k: r.k };
}

// Erreichbarkeit eines Gegners: Höhe, bis zu der er den Ball spielen kann, und Reichweite um den Körper
// Reichweite je Höhe (m um den Körper): Fuß 0,6, Volley/Seitfall/Flugkopf (Hüft- bis Brusthöhe) 0,9, Kopf 0,5
function reachOf(game, o) {
  const P = game.P, R = game.match ? game.rules : null;
  if (R && R.keeper[o.team] === o.id && R.inBox(o.team, o.x, o.z, 0.3) && o.hand.mode !== 'ground') return { h: P.catchHigh, r: () => P.catchReach + 0.35 };
  if (o.fall || o.slide || (o.hand.mode !== 'none' && o.hand.mode !== 'hold')) return null;
  return { h: P.headH + 0.85 * P.jumpMax + 0.1, r: (y) => (y < 0.5 ? 0.6 : y < 1.6 ? 0.9 : 0.5) };
}
// Zeitreserve der Gegner (s) für die Bahn path (Abflug am Punkt from in Richtung dir, Proben bis Index kEnd, Bogen quer bow(x)).
// > 0: jeder Gegner kommt um so viel zu spät; < 0: abfangbar
// Nach der Ankunft (Index kEnd) bleibt der Ball noch nachT s am Treffpunkt erreichbar (Annahme, Abpraller): auch dort darf kein
// Gegner früher sein. tRead = Reaktion (hoch: hochLesen, flach: reaktion)
function slackOf(game, team, from, dir, path, kEnd, y0, bowK, skip = -1, tRead = game.P.hochLesen, nachT = 0.45) {
  const P = game.P, lat = [-dir[1], dir[0]];
  let slack = 9;
  const need = (o, px, pz, r, y, t = 0) => {
    const ex = px - o.x, ez = pz - o.z, dl = Math.hypot(ex, ez), d = dl - r;
    // ohne Reaktion: Ball läuft dem Gegner direkt an den Fuß (flach, ≤ reaktionR) oder an den Körper (bis 1,85 m) – dort, wo er in
    // dieser Zeit mit seinem Tempo ohnehin hinläuft (der Pressende läuft weiter auf den Ball zu)
    const tt = Math.min(t, tRead), ox = o.x + o.vx * tt, oz = o.z + o.vz * tt;
    if (Math.hypot(px - ox, pz - oz) < 0.22 + P.ballR + 0.08 && y < 1.85) return 0;
    if (y < P.reachH + 0.1) { const fx = ox + Math.cos(o.face) * P.footAhead, fz = oz + Math.sin(o.face) * P.footAhead; if (Math.hypot(px - fx, pz - fz) < P.reach) return 0; }
    let n = tRead;
    if (d > 0) { const v0 = dl > 0.01 ? clamp((o.vx * ex + o.vz * ez) / dl / P.vTop, 0, 1) : 0; n += d / (P.vTop * 0.9) + 0.25 * (1 - v0); }
    if (y > P.headH + 0.1) n += 0.12;                     // Absprung
    return n;
  };
  for (const o of game.players) {
    if (o.team === team || o.id === skip) continue;
    const rc = reachOf(game, o);
    if (!rc) continue;
    for (let k = 1; k <= kEnd && k < path.n; k++) {
      const y = path.y[k] + y0;
      if (y > rc.h) continue;
      const zq = path.z[k] - path.x[k] * bowK;            // Kurve: Abstand zur geraden Linie (Abflug ist entsprechend gedreht)
      const px = from[0] + dir[0] * path.x[k] + lat[0] * zq, pz = from[1] + dir[1] * path.x[k] + lat[1] * zq;
      const n = need(o, px, pz, rc.r(y), y, k * LDT) - k * LDT;
      if (n < slack) slack = n;
    }
    // am Treffpunkt nach der Ankunft (der Empfänger nimmt an – ein Gegner direkt daneben stört trotzdem)
    if (nachT > 0 && kEnd < path.n) {
      const k = kEnd, zq = path.z[k] - path.x[k] * bowK;
      const px = from[0] + dir[0] * path.x[k] + lat[0] * zq, pz = from[1] + dir[1] * path.x[k] + lat[1] * zq;
      const n = need(o, px, pz, 0.6, 0) - (k * LDT + nachT);
      if (n < slack) slack = n;
    }
  }
  return slack;
}

// Bester hoher Pass von from (Ball, [x, z], Höhe y0 über dem Boden) zum Mitspieler m (Position, Tempo), Laufweg per runPath.
// Gibt {u, el, T, meet, hArr, vArr, apex, side, slack, dir} oder null zurück. opts: curve (Kurvenpass erlaubt), maxU, y0, hs (Höhen)
export function bestLob(game, pl, from, m, runPath, { curve = true, maxU = 26, y0 = 0, hs = HOCH_H, skip = -1 } = {}) {
  const P = game.P, cage = game.cage, top = P.roof ? P.roofH - 0.4 : 99;
  const r0 = [m.x, m.z], rv = [m.vx || 0, m.vz || 0];
  let best = null;
  // erst ohne Effet; ist so keiner sicher, auch als Kurvenpass (Effet um den Gegner herum)
  const pass = (sides) => { for (const hArr of hs) for (let e = 1; e < LNE - 1; e++) for (const sg of sides) {
    // Treffpunkt im Laufweg zur Ankunftszeit (Iteration)
    let T = 1.0, sol = null, meet = r0, D = 0;
    for (let it = 0; it < 4; it++) {
      meet = runPath(cage, r0, rv, T, P.vorhaltMax);
      D = Math.hypot(meet[0] - from[0], meet[1] - from[1]);
      if (D < 2.5) { sol = null; break; }
      sol = solveLob(P, e, D, hArr, y0 - P.ballR, sg !== 0);
      if (!sol) break;
      if (Math.abs(sol.T - T) < 0.02) break;
      T = sol.T;
    }
    if (!sol || sol.u > maxU || sol.apex > top) continue;
    const dx = (meet[0] - from[0]) / D, dz = (meet[1] - from[1]) / D;
    // Kurve: Abflug so gedreht, dass der Ball beim Treffpunkt ankommt (zD quer bei Weite D)
    const zD = sg * sol.zD, bowK = zD / D, rot = -Math.atan2(zD, D);
    const dir = [dx * Math.cos(rot) - dz * Math.sin(rot), dx * Math.sin(rot) + dz * Math.cos(rot)];
    const path = pathRow(lobTable(P, sg !== 0), e, sol.u, _q);
    if (sg < 0) for (let k = 0; k < path.n; k++) path.z[k] = -path.z[k];
    const slack = slackOf(game, pl.team, from, [dx, dz], path, sol.k, y0 - P.ballR, bowK, skip);
    // Wahl: sicher zuerst (Reserve bis 0,4 s zählt), dann kurz unterwegs, Ankunft gut annehmbar (Brust bevorzugt, nicht zu hart)
    const score = 2.2 * Math.min(slack, 0.4) - 0.7 * sol.T - 0.25 * Math.abs(hArr - 1.3) - 0.08 * Math.max(0, sol.vArr - 10) - (sg ? 0.05 : 0);
    if (!best || score > best.score) best = { score, u: sol.u, el: sol.el, T: sol.T, meet, hArr, vArr: sol.vArr, apex: sol.apex, side: sg * kurvenSpin(P), curve: sg, slack, dir, D };
  } };
  pass([0]);
  if (curve && P.kurvenpass && (!best || best.slack < P.hochSicher)) pass([1, -1]);
  return best;
}

// Flacher Pass (Fallback, wenn kein hoher sicher ist): Zeitreserve der Gegner entlang der Rollbahn (Roll-Tabelle aus kickplan.js)
export function flatSlack(game, team, from, dir, u, T, passDist, skip = -1) {
  const n = Math.min(LNT - 1, Math.ceil(T / LDT));
  _q.n = n + 1;
  for (let k = 0; k <= n; k++) { _q.x[k] = passDist(game.P, u, k * LDT); _q.y[k] = game.P.ballR; _q.z[k] = 0; }
  return slackOf(game, team, from, dir, _q, n, 0, 0, skip, game.P.reaktion, 0.3);
}
