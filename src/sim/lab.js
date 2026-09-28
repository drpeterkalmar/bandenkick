// FIFA-Prüfverfahren als Simulation – genau wie im Labor (FIFA Quality Programme for Football Turf,
// Handbook of Test Methods 2015): Methode 01 Ballabprall, 02 schräger Abprall, 03 Ballrollen,
// 17 „Reduced Ball Roll“. Dazu Aerodynamik-Versuche. Genutzt von tests/node/*.test.mjs und tools/calibrate.mjs.
import { Ball } from './ball.js';
import { buildCage } from './world.js';
import { makeParams } from './params.js';
import { Rng } from './rng.js';

export const DT = 1 / 120;

// Freies Testfeld ohne Käfig (nur Boden)
function openCage() { return { hx: 1e6, hz: 1e6, bH: 0, top: 1e6, gw: 0, gH: 0, gD: 0, rects: [], bars: [], roof: false }; }

// Methode 01: Ball fällt aus 2,00 m (Unterseite), Zeit T zwischen 1. und 2. Aufprall.
// Labor: H = 1,23·(T − Δt)² mit Δt = 0,025 s für die Kontaktdauer. Unser Stoß ist punktförmig
// (Kontaktdauer 0), deshalb H = 1,23·T². Zusätzlich die echte Scheitelhöhe der Unterseite.
export function dropTest(P, surface = 'turf', h0 = 2.0) {
  const b = new Ball(P);
  b.ground = surface;
  b.place(0, h0 + P.ballR, 0);
  b.contact = false;
  b.events = [];
  const cage = openCage();
  let t = 0, t1 = -1, t2 = -1, apex = 0;
  for (let i = 0; i < 120 * 8 && t2 < 0; i++) {
    const nEv = b.events.length;
    b.step(DT, cage);
    t += DT;
    if (b.events.length > nEv) {
      // genaue Aufprallzeit innerhalb des Takts rekonstruieren: lineare Näherung reicht bei Unterschritten
      if (t1 < 0) t1 = t; else if (t2 < 0) t2 = t;
    }
    if (t1 >= 0 && t2 < 0) apex = Math.max(apex, b.p.y - P.ballR);
  }
  const T = t2 - t1;
  return { T, H: 1.23 * T * T, apex };
}

// Feinere Variante mit kleinem Takt für genaue Zeiten (Unterschritt-Auflösung)
export function dropTestFine(P, surface = 'turf', h0 = 2.0) {
  const b = new Ball(P);
  b.ground = surface;
  b.place(0, h0 + P.ballR, 0);
  b.contact = false;
  b.events = [];
  const cage = openCage();
  const dt = 1 / 4800;
  let t = 0, t1 = -1, t2 = -1, apex = 0;
  for (let i = 0; i < 4800 * 8 && t2 < 0; i++) {
    const nEv = b.events.length;
    b.substep(dt, cage);
    t += dt;
    if (b.events.length > nEv) { if (t1 < 0) t1 = t; else if (t2 < 0) t2 = t; }
    if (t1 >= 0 && t2 < 0) apex = Math.max(apex, b.p.y - P.ballR);
  }
  const T = t2 - t1;
  return { T, H: 1.23 * T * T, apex };
}

// Methode 02: Kanone, Mündung (Unterkante) 0,90 m hoch, Abflug 15° ± 2° nach unten, 50 ± 5 km/h unmittelbar
// vor dem Aufprall, Radar misst die Horizontalgeschwindigkeit vor und nach dem Aufprall. Ergebnis S2/S1 in %.
export function angleTest(P, angleDeg = 15, kmh = 50, spinRps = 0) {
  const target = kmh / 3.6;
  // Abfluggeschwindigkeit so suchen, dass unmittelbar vor dem Aufprall `target` erreicht ist
  let v0 = target;
  let res = null;
  for (let it = 0; it < 30; it++) {
    res = angleShot(P, angleDeg, v0, spinRps);
    const err = target - res.vImpact;
    if (Math.abs(err) < 1e-4) break;
    v0 += err;
  }
  return res;
}
function angleShot(P, angleDeg, v0, spinRps) {
  const b = new Ball(P);
  const a = angleDeg * Math.PI / 180;
  b.place(0, 0.90 + P.ballR, 0);
  b.contact = false;
  b.v.set(v0 * Math.cos(a), -v0 * Math.sin(a), 0);
  b.w.set(0, 0, spinRps * 2 * Math.PI); // + = Rückwärtsdrall bei Flug in +x
  b.events = [];
  const cage = openCage();
  const dt = 1 / 4800;
  let before = null, after = null, vImpact = 0;
  for (let i = 0; i < 4800 * 3; i++) {
    const vx = b.v.x, vy = b.v.y, vz = b.v.z;
    const nEv = b.events.length;
    b.substep(dt, cage);
    if (b.events.length > nEv && !before) {
      before = vx; vImpact = Math.hypot(vx, vy, vz);
      after = b.v.x;
      break;
    }
  }
  return { S1: before, S2: after, ratio: after / before, vImpact, v0 };
}

// Rampe (Abb. 4/51): zwei Rundstäbe (Kontaktdurchmesser ≤ 40 mm, Innenkanten 100 mm Abstand), 45° ± 2°,
// Auslauf-Radius 500 mm, Ball-Unterseite beim Start 1,000 m über dem Rasen. Auf den Stäben rollt der Ball mit
// dem Rollradius r_eff (Kontaktpunkte seitlich versetzt) → mehr Drall als auf dem Rasen.
export function rampGeometry(P, barD = 0.040, gap = 0.100) {
  const R = P.ballR, rho = barD / 2, e = gap / 2 + rho;
  const dc = R + rho;                               // Ballmitte ↔ Stabachse
  const hc = Math.sqrt(dc * dc - e * e);            // Ballmitte über der Stabachsen-Ebene
  const rEff = hc * R / dc;                         // Rollradius (Abstand Kontakt ↔ Drehachse)
  const bottomAbove = hc - R;                       // Ball-Unterseite über der Stabachsen-Ebene
  return { rEff, hc, bottomAbove, rho };
}

// Ball die Rampe hinab: Energie mit Luftwiderstand numerisch entlang der Bahn (45°-Gerade + Kreisbogen R 0,5 m
// bis waagrecht), dann Übergabe an den Rasen mit v und ω = v/r_eff.
export function rampExit(P, releaseH = 1.0, angleDeg = 45, arcR = 0.5, barD = 0.040, gap = 0.100) {
  const g = rampGeometry(P, barD, gap);
  const m = P.ballM, I = P.ballK * m * P.ballR * P.ballR;
  const meff = m + I / (g.rEff * g.rEff);
  const th = angleDeg * Math.PI / 180;
  // Höhe der Ball-Unterseite über dem Rasen am Rampenende: Stäbe liegen auf dem Granulat (Achse = ρ hoch)
  const endBottom = g.rho + g.bottomAbove;
  const drop = releaseH - endBottom;                 // Fallhöhe der Ballmitte
  // Weg: Bogen (Höhe arcR·(1−cos θ) bezogen auf die Ballbahn ≈ Stabbahn + Versatz) und Gerade
  const arcDrop = (arcR + g.hc) * (1 - Math.cos(th));
  const lineLen = Math.max(0, (drop - arcDrop) / Math.sin(th));
  const arcLen = (arcR + g.hc) * th;
  let s = 0, v = 0, y = drop; // y = Resthöhe über Ende
  const ds = 0.0005;
  const A = Math.PI * P.ballR * P.ballR;
  while (s < lineLen + arcLen) {
    const slope = s < lineLen ? Math.sin(th) : Math.sin(th * (1 - (s - lineLen) / arcLen));
    // Energieänderung: m g sinφ ds − F_drag ds = d(½ meff v²)
    const Re = v * 2 * P.ballR / P.nu;
    const cd = P.cdSuper + (P.cdSub - P.cdSuper) / (1 + Math.exp((Re - P.reMid) / P.reWidth));
    const Fd = 0.5 * P.rho * A * cd * v * v;
    const dE = m * P.g * slope * ds - Fd * ds;
    v = Math.sqrt(Math.max(0, v * v + 2 * dE / meff));
    y -= slope * ds;
    s += ds;
  }
  return { v, w: v / g.rEff, rEff: g.rEff, drop, endBottom };
}

// Methode 03: Ball rollt von der Rampe über den Rasen bis zum Stillstand; Weg vom ersten Rasenkontakt.
// Liefert auch den Geschwindigkeitsverlauf für Methode 17.
export function rollTest(P, releaseH = 1.0, opts = {}) {
  const ex = rampExit(P, releaseH, opts.angle ?? 45, opts.arcR ?? 0.5, opts.barD ?? 0.040, opts.gap ?? 0.100);
  const b = new Ball(P);
  b.place(0, P.ballR, 0);
  b.contact = true;
  b.v.set(ex.v, 0, 0);
  b.w.set(0, 0, -ex.w); // Vorwärtsdrall (rollend in +x ⇒ ω_z < 0)
  const cage = openCage();
  const dt = 1 / 2400;
  const trace = [];
  let t = 0;
  for (let i = 0; i < 2400 * 30; i++) {
    b.substep(dt, cage);
    t += dt;
    if ((i & 7) === 0) trace.push([t, b.p.x, b.v.x]);
    if (b.v.x <= 0 && t > 0.1) break;
  }
  return { dist: b.p.x, exitV: ex.v, exitW: ex.w, rEff: ex.rEff, time: t, trace };
}

// Methode 17 (Reduced Ball Roll): vier Starthöhen, Lichtschranken-Paare (Sensoren 0,2 m auseinander) mit
// Mitte 1,0 m und 2,5 m hinter dem Rasenkontakt; v_end = a·v_start² + b·v_start + c (quadratischer Fit),
// iterativ in 1,5-m-Schritten bis v_end ≤ 0, Rest über die Verzögerung des vorletzten Schritts.
export function reducedRollTest(P) {
  // „Höhe 1 so, dass der Ball 0,1–0,25 m hinter der 2. Schranke stoppt“: suchen
  const stopAt = (h) => rollTest(P, h).dist;
  let lo = 0.05, hi = 1.0;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (stopAt(mid) > 2.6 + 0.175) hi = mid; else lo = mid; }
  const h1 = (lo + hi) / 2;
  const heights = [h1, h1 + (1 - h1) / 3, h1 + 2 * (1 - h1) / 3, 1.0];
  const R = P.ballR;
  const gate = (trace, c) => { // Zeit, bis die Ballfront von c−0,1 bis c+0,1 läuft (Front = Mitte + r)
    const tAt = (x) => { for (let i = 1; i < trace.length; i++) if (trace[i][1] + R >= x) { const [t0, x0] = trace[i - 1], [t1, x1] = trace[i]; return t0 + (t1 - t0) * (x - (x0 + R)) / ((x1 + R) - (x0 + R) || 1e-9); } return NaN; };
    return 0.2 / (tAt(c + 0.1) - tAt(c - 0.1));
  };
  const pts = heights.map((h) => { const r = rollTest(P, h); return [gate(r.trace, 1.0), gate(r.trace, 2.5)]; });
  const fit = quadFit(pts);
  const Sg = 1.5, Si = 1.0;
  let vs = pts[3][0], n = 0, prev = null;
  for (; n < 100; n++) {
    const ve = fit.a * vs * vs + fit.b * vs + fit.c;
    if (ve <= 0) break;
    prev = [vs, ve];
    vs = ve;
  }
  const a1 = prev ? (prev[1] * prev[1] - prev[0] * prev[0]) / (2 * Sg) : -1;
  const Sr = -(vs * vs) / (2 * a1);
  return { pred: Si + n * Sg + Sr, heights, pts, fit, n, Sr };
}

function quadFit(pts) { // kleinste Quadrate für y = a x² + b x + c
  let S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (const [x, y] of pts) { let p = 1; for (let k = 0; k < 5; k++) { S[k] += p; p *= x; } T[0] += y; T[1] += y * x; T[2] += y * x * x; }
  const M = [[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]];
  const B = [T[2], T[1], T[0]];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  const col = (i) => M.map((row, r) => row.map((v, c) => (c === i ? B[r] : v)));
  return { a: det(col(0)) / D, b: det(col(1)) / D, c: det(col(2)) / D };
}

// ---------------- Aerodynamik-Versuche ----------------
// Freier Flug über ebenem Boden bis Weg x erreicht oder Aufprall.
export function flight(P, { v0, elevDeg = 0, azDeg = 0, spin = [0, 0, 0], seed = 1, h0 = 0.11 + 0.0, untilX = 1e9, maxT = 6, knuckle = true }) {
  const Pk = knuckle ? P : { ...P, knuckleF30: 0 };
  const b = new Ball(Pk);
  b.reseedKnuckle(new Rng(seed));
  const e = elevDeg * Math.PI / 180, az = azDeg * Math.PI / 180;
  b.place(0, Math.max(h0, P.ballR + 1e-4), 0);
  b.contact = false;
  b.v.set(v0 * Math.cos(e) * Math.cos(az), v0 * Math.sin(e), v0 * Math.cos(e) * Math.sin(az));
  b.w.set(spin[0], spin[1], spin[2]);
  b.events = [];
  const cage = openCage();
  const dt = 1 / 1200;
  const path = [[0, b.p.x, b.p.y, b.p.z, v0]];
  let t = 0;
  while (t < maxT) {
    const x0 = b.p.x, y0 = b.p.y, z0 = b.p.z;
    b.substep(dt, cage);
    t += dt;
    if (b.p.x >= untilX) { // auf untilX interpolieren
      const f = (untilX - x0) / (b.p.x - x0);
      path.push([t, untilX, y0 + f * (b.p.y - y0), z0 + f * (b.p.z - z0), b.v.len()]);
      return { path, end: path[path.length - 1], landed: false, t };
    }
    if ((Math.round(t / dt) % 12) === 0) path.push([t, b.p.x, b.p.y, b.p.z, b.v.len()]);
    if (b.events.length) return { path, end: [t, b.p.x, b.p.y, b.p.z, b.v.len()], landed: true, t };
  }
  return { path, end: path[path.length - 1], landed: false, t };
}

export { makeParams, buildCage };
