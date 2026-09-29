// Kick-Planung mit der echten Ballphysik (ohne DOM). Die Techniken erzeugen nur Anfangsbedingungen (Tempo, Richtung,
// Abflugwinkel, Drall) – der Flug bleibt Physik aus ball.js. Hier wird dieselbe Physik vorausgerechnet:
//  - Roll-Tabelle (flacher Pass): Weg und Tempo über der Zeit je Abspieltempo, einmal mit dem Ball-Modell simuliert
//    (inkl. kleinem Hüpfer, Gleiten und Rollen) → Pass in den Laufweg per Iteration statt linearer Schätzung
//  - Chip-Tabelle (hoher Pass mit Rückdrall): Landeweite, Flugzeit, Scheitelhöhe je Abflugwinkel und Tempo
//  - Flug-Integrator (Luftwiderstand, Magnus, Schwerkraft; ohne Käfig) und Ziel-Löser (Richtung + Abflugwinkel so,
//    dass der Ball mit gegebenem Tempo und Drall durch einen Zielpunkt fliegt – Kurve wird mit eingerechnet)
//  - Ballvorhersage im echten Käfig (Luftbälle, Ballmaschine)
import { Ball } from './ball.js';
import { V3 } from './v3.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const EMPTY_CAGE = { rects: [], bars: [], hx: 1e4, hz: 1e4, top: 1e4, bH: 1e4 };

// Anfangsbedingungen eines Kicks (von Player.kick, Tabellen und Ballmaschine gemeinsam benutzt):
// Richtung (dx, dz) waagrecht, Tempo u, Abflugwinkel el (rad), back = Rückdrall (rad/s, negativ = Vorwärtsdrall),
// side = Drall um die Hochachse (rad/s, + = Kurve nach links in Schussrichtung)
export function setKick(ball, dx, dz, u, el, back = 0, side = 0) {
  const ce = Math.cos(el), se = Math.sin(el);
  ball.v.set(dx * u * ce, u * se, dz * u * ce);
  ball.w.set(-dz * back, side, dx * back);
  if (ball.p.y < ball.r + 0.02) ball.p.y = ball.r + 0.002;
  ball.contact = el < 2.5 * DEG && ball.p.y < ball.r + 0.01;
}
// Flacher Pass: 1,5° Abflug, leichter Vorwärtsdrall (rutscht kurz, rollt dann) – wie seit Nacht 1
export const PASS_ELEV = 1.5 * DEG;
export const passRoll = (u, r) => -0.3 * u / r;

// Planungs-Parameter: Flatterball aus (Vorhersage = mittlere Bahn)
const cacheP = new WeakMap();
function planP(P) {
  let c = cacheP.get(P);
  if (!c) { c = { P0: { ...P, knuckleF30: 0 } }; cacheP.set(P, c); }
  return c;
}

// ---------------- Roll-Tabelle (flacher Pass) ----------------
const RU0 = 1, RDU = 0.5, RNU = 51;          // Abspieltempo 1 … 26 m/s
const RDT = 0.02, RNT = 351;                  // bis 7 s
export function rollTable(P) {
  const c = planP(P);
  if (c.roll) return c.roll;
  const X = new Float32Array(RNU * RNT), V = new Float32Array(RNU * RNT);
  const b = new Ball(c.P0);
  const sub = Math.round(RDT * 120);
  for (let i = 0; i < RNU; i++) {
    const u = RU0 + i * RDU;
    b.place(0, b.r, 0);
    setKick(b, 1, 0, u, PASS_ELEV, passRoll(u, b.r), 0);
    for (let k = 0; k < RNT; k++) {
      X[i * RNT + k] = b.p.x; V[i * RNT + k] = Math.hypot(b.v.x, b.v.z);
      for (let s = 0; s < sub; s++) b.step(RDT / sub, EMPTY_CAGE);
    }
  }
  c.roll = { X, V };
  return c.roll;
}
function rollLookup(T, arr, u, t) {
  const fu = clamp((u - RU0) / RDU, 0, RNU - 1.001), iu = Math.floor(fu), au = fu - iu;
  const ft = clamp(t / RDT, 0, RNT - 1.001), it = Math.floor(ft), at = ft - it;
  const a = arr[iu * RNT + it] * (1 - at) + arr[iu * RNT + it + 1] * at;
  const b = arr[(iu + 1) * RNT + it] * (1 - at) + arr[(iu + 1) * RNT + it + 1] * at;
  return a * (1 - au) + b * au;
}
// Weg (m) und Tempo (m/s) eines flachen Passes mit Abspieltempo u nach t Sekunden
export const passDist = (P, u, t) => rollLookup(rollTable(P), rollTable(P).X, u, t);
export const passSpeedAt = (P, u, t) => rollLookup(rollTable(P), rollTable(P).V, u, t);
// Abspieltempo, mit dem der Ball nach T Sekunden D Meter weit ist (Bisektion; null = nicht erreichbar)
export function passSpeedFor(P, D, T) {
  let lo = RU0, hi = RU0 + (RNU - 1) * RDU;
  if (passDist(P, hi, T) < D) return null;
  if (passDist(P, lo, T) >= D) return lo;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (passDist(P, m, T) < D) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Zeit, bis ein Pass mit Tempo u D Meter geschafft hat (Infinity = bleibt vorher liegen)
export function passTimeTo(P, u, D) {
  const tab = rollTable(P);
  let lo = 0, hi = (RNT - 1) * RDT;
  if (rollLookup(tab, tab.X, u, hi) < D) return Infinity;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (rollLookup(tab, tab.X, u, m) < D) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------------- Chip-Tabelle (hoher Pass, Rückdrall) ----------------
const CE0 = 20, CDE = 5, CNE = 7;             // Abflugwinkel 20 … 50°
const CU0 = 3, CDU = 0.5, CNU = 43;           // Tempo 3 … 24 m/s
export const CHIP_BACK = 5 * 2 * Math.PI;     // 5 U/s Rückdrall (Chip/Lupfer)
export function chipTable(P) {
  const c = planP(P);
  if (c.chip) return c.chip;
  const R = new Float32Array(CNE * CNU), T = new Float32Array(CNE * CNU), H = new Float32Array(CNE * CNU);
  const b = new Ball(c.P0);
  for (let e = 0; e < CNE; e++) for (let i = 0; i < CNU; i++) {
    const u = CU0 + i * CDU, el = (CE0 + e * CDE) * DEG;
    b.place(0, b.r, 0);
    setKick(b, 1, 0, u, el, CHIP_BACK, 0);
    let t = 0, h = 0, up = true;
    for (let k = 0; k < 900; k++) {
      b.step(1 / 240, EMPTY_CAGE); t += 1 / 240;
      h = Math.max(h, b.p.y);
      if (b.v.y < 0) up = false;
      if (!up && b.p.y <= b.r + 1e-4) break;
    }
    R[e * CNU + i] = b.p.x; T[e * CNU + i] = t; H[e * CNU + i] = h;
  }
  c.chip = { R, T, H };
  return c.chip;
}
function chipLookup(arr, elDeg, u) {
  const fe = clamp((elDeg - CE0) / CDE, 0, CNE - 1.001), ie = Math.floor(fe), ae = fe - ie;
  const fu = clamp((u - CU0) / CDU, 0, CNU - 1.001), iu = Math.floor(fu), au = fu - iu;
  const g = (e, i) => arr[e * CNU + i];
  const a = g(ie, iu) * (1 - au) + g(ie, iu + 1) * au, b = g(ie + 1, iu) * (1 - au) + g(ie + 1, iu + 1) * au;
  return a * (1 - ae) + b * ae;
}
export const chipRange = (P, elDeg, u) => chipLookup(chipTable(P).R, elDeg, u);
export const chipTime = (P, elDeg, u) => chipLookup(chipTable(P).T, elDeg, u);
export const chipApex = (P, elDeg, u) => chipLookup(chipTable(P).H, elDeg, u);
// Tempo für eine Landeweite D bei Abflugwinkel el (Bisektion; null = zu weit)
export function chipSpeedFor(P, elDeg, D) {
  let lo = CU0, hi = CU0 + (CNU - 1) * CDU;
  if (chipRange(P, elDeg, hi) < D) return null;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (chipRange(P, elDeg, m) < D) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// ---------------- Flug-Integrator und Ziel-Löser ----------------
const _fb = new WeakMap();
function flyBall(P) { let b = _fb.get(P); if (!b) { b = new Ball(planP(P).P0); _fb.set(P, b); } return b; }
const _a = new V3();
// Freier Flug (ohne Käfig) bis zur Ebene (p − Q)·n ≥ 0 oder Bodenberührung/Zeitende.
// spin(dx, dz) → [wx, wy, wz]. Gibt {x, y, z, t, hit: 'plane'|'ground'|'time', vx, vy, vz} zurück.
export function flyTo(P, from, dir, u, el, spin, Q, n, tMax = 2.5, h = 1 / 360) {
  const b = flyBall(P);
  b.p.set(from[0], from[1], from[2]);
  const ce = Math.cos(el);
  b.v.set(dir[0] * u * ce, u * Math.sin(el), dir[1] * u * ce);
  const w = spin(dir[0], dir[1]);
  b.w.set(w[0], w[1], w[2]);
  b.contact = false;
  const L = P.spinDecayL;
  let t = 0;
  const a = _a;
  let px = b.p.x, py = b.p.y, pz = b.p.z;
  while (t < tMax) {
    b.aero(a, h);
    b.v.x += a.x * h; b.v.y += a.y * h; b.v.z += a.z * h;
    const sp = Math.hypot(b.v.x, b.v.y, b.v.z);
    const f = Math.exp(-sp * h / L); b.w.x *= f; b.w.y *= f; b.w.z *= f;
    px = b.p.x; py = b.p.y; pz = b.p.z;
    b.p.x += b.v.x * h; b.p.y += b.v.y * h; b.p.z += b.v.z * h;
    t += h;
    const s1 = (b.p.x - Q[0]) * n[0] + (b.p.y - Q[1]) * n[1] + (b.p.z - Q[2]) * n[2];
    if (s1 >= 0) {
      const s0 = (px - Q[0]) * n[0] + (py - Q[1]) * n[1] + (pz - Q[2]) * n[2];
      const k = s0 < 0 ? -s0 / (s1 - s0) : 0;
      return { x: px + (b.p.x - px) * k, y: py + (b.p.y - py) * k, z: pz + (b.p.z - pz) * k, t: t - h * (1 - k), hit: 'plane', vx: b.v.x, vy: b.v.y, vz: b.v.z };
    }
    if (b.p.y < b.r) return { x: b.p.x, y: b.p.y, z: b.p.z, t, hit: 'ground', vx: b.v.x, vy: b.v.y, vz: b.v.z };
  }
  return { x: b.p.x, y: b.p.y, z: b.p.z, t, hit: 'time', vx: b.v.x, vy: b.v.y, vz: b.v.z };
}

// Richtung und Abflugwinkel, damit der Ball (Tempo u, Drall spin) durch den Zielpunkt T fliegt. Die Zielebene geht
// durch T mit Normale n (Tor: Torlinie; sonst waagrecht von „from“ nach T). Broyden-Verfahren (≤ 7 Flüge).
// Gibt {dir: [dx, dz], el, t, err, ok} zurück.
export function aimAt(P, from, T, u, spin, n = null) {
  const hx = T[0] - from[0], hz = T[2] - from[2], D = Math.hypot(hx, hz) || 1e-6;
  const N = n || [hx / D, 0, hz / D];
  let az = Math.atan2(hz, hx);
  const tf = D / Math.max(3, u);
  let el = Math.atan2(T[1] - from[1] + 0.5 * P.g * tf * tf, D);
  el = clamp(el, -0.3, 1.3);
  // seitlicher Einheitsvektor (links in Schussrichtung) für das Fehlermaß in der Zielebene
  const lx = -hz / D, lz = hx / D;
  const res = (a, e) => {
    const r = flyTo(P, from, [Math.cos(a), Math.sin(a)], u, e, spin, T, N, 3.5);
    if (r.hit !== 'plane') {
      // nicht angekommen (zu kurz/zu tief): Fehler als Höhe unter dem Ziel werten
      return [((r.x - T[0]) * lx + (r.z - T[2]) * lz), r.y - T[1] - 3 * Math.max(0, D - Math.hypot(r.x - from[0], r.z - from[2])), r];
    }
    return [(r.x - T[0]) * lx + (r.z - T[2]) * lz, r.y - T[1], r];
  };
  let [e1, e2, r] = res(az, el);
  // Start-Jacobi-Matrix numerisch
  const da = 0.01, de = 0.01;
  const [a1, a2] = res(az + da, el), [b1, b2] = res(az, el + de);
  let J = [[(a1 - e1) / da, (b1 - e1) / de], [(a2 - e2) / da, (b2 - e2) / de]];
  for (let it = 0; it < 6 && Math.hypot(e1, e2) > 0.01; it++) {
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (Math.abs(det) < 1e-9) break;
    let sa = -(J[1][1] * e1 - J[0][1] * e2) / det, se = -(-J[1][0] * e1 + J[0][0] * e2) / det;
    sa = clamp(sa, -0.35, 0.35); se = clamp(se, -0.35, 0.35);
    az += sa; el = clamp(el + se, -0.35, 1.35);
    const [f1, f2, rr] = res(az, el);
    // Broyden-Update
    const y1 = f1 - e1, y2 = f2 - e2, s2 = sa * sa + se * se || 1e-12;
    const j1 = y1 - (J[0][0] * sa + J[0][1] * se), j2 = y2 - (J[1][0] * sa + J[1][1] * se);
    J = [[J[0][0] + j1 * sa / s2, J[0][1] + j1 * se / s2], [J[1][0] + j2 * sa / s2, J[1][1] + j2 * se / s2]];
    e1 = f1; e2 = f2; r = rr;
  }
  return { dir: [Math.cos(az), Math.sin(az)], el, t: r.t, err: Math.hypot(e1, e2), ok: r.hit === 'plane' && Math.hypot(e1, e2) < 0.08 };
}

// Drall-Funktion für aimAt: back = Rückdrall (rad/s), side = Drall um die Hochachse
export const spinOf = (back, side) => (dx, dz) => [-dz * back, side, dx * back];

// ---------------- Ballvorhersage im echten Käfig ----------------
// Simuliert den aktuellen Ball (ohne Flattern) T Sekunden im Käfig. Proben alle `every` Takte:
// {t, x, y, z, vx, vy, vz, bounce} (bounce = Aufsetzer seit der letzten Probe). Ohne Spieler.
const _pb = new WeakMap();
export function predictBall(P, cage, ball, T = 1.0, every = 2, out = []) {
  let b = _pb.get(P);
  if (!b) { b = new Ball(planP(P).P0); b.events = []; _pb.set(P, b); }
  b.p.copy(ball.p); b.v.copy(ball.v); b.w.copy(ball.w); b.contact = ball.contact; b.net.depth = 0; b.netWas = false;
  out.length = 0;
  const DT = 1 / 120, n = Math.round(T / DT);
  let bounced = false;
  for (let i = 0; i <= n; i++) {
    if (i % every === 0) { out.push({ t: i * DT, x: b.p.x, y: b.p.y, z: b.p.z, vx: b.v.x, vy: b.v.y, vz: b.v.z, bounce: bounced }); bounced = false; }
    b.events.length = 0;
    b.step(DT, cage);
    for (const e of b.events) if (e.type === 'ground') bounced = true;
  }
  return out;
}

// Abprall an der Längsbande für einen flach gespielten, rollenden Pass, gemessen mit der echten Ballphysik:
// ρ = tan(Ausfallswinkel)/tan(Einfallswinkel) und Tempo danach. Effet (spinY) dreht den Abprall.
const bankCache = new WeakMap();
export function bankRatio(P, cage, spinY = 0) {
  let m = bankCache.get(P); if (!m) { m = new Map(); bankCache.set(P, m); }
  const key = spinY.toFixed(1);
  if (m.has(key)) return m.get(key);
  const b = new Ball(P);
  const ang = 45 * Math.PI / 180, sp = 10;
  const z0 = cage.hz - 4;
  b.place(0, P.ballR, z0);
  const dx = Math.sin(ang), dz = Math.cos(ang);
  b.v.set(dx * sp, 0, dz * sp);
  b.w.set(dz * sp / P.ballR, spinY, -dx * sp / P.ballR);
  let hit = false, out = null;
  for (let i = 0; i < 360; i++) {
    const vz0 = b.v.z;
    b.step(1 / 120, cage);
    if (!hit && vz0 > 0 && b.v.z < 0) hit = true;
    if (hit && b.p.z < cage.hz - 1.5) { out = { vx: b.v.x, vz: b.v.z }; break; }
  }
  const tin = Math.tan(ang);
  const r = out ? { rho: (out.vx / -out.vz) / tin, keep: Math.hypot(out.vx, out.vz) / sp } : { rho: 1, keep: 0.6 };
  m.set(key, r);
  return r;
}

export { DEG, clamp };
