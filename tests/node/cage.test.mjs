// Käfig: Bande, Ballfangnetz, Dachnetz, Tore. Der Ball bleibt immer im Käfig (mit Dach).
// Aufruf: node tests/node/cage.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { Rng } from '../../src/sim/rng.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };

function shot(P, { from = [0, 0.11, 0], v = [0, 0, 0], w = [0, 0, 0], T = 6, seed = 1 }) {
  const g = new Game(P, seed);
  g.players.length = 0; // nur der Ball
  const b = g.ball;
  b.place(from[0], from[1], from[2]);
  b.contact = false;
  b.v.set(...v); b.w.set(...w);
  b.reseedKnuckle(g.rng);
  const ev = [];
  let maxY = 0, maxAX = 0, maxAZ = 0, out = false;
  for (let i = 0; i < T / DT; i++) {
    for (const e of g.step()) ev.push({ ...e, t: g.t });
    maxY = Math.max(maxY, b.p.y); maxAX = Math.max(maxAX, Math.abs(b.p.x)); maxAZ = Math.max(maxAZ, Math.abs(b.p.z));
    if (g.state === 'out') out = true;
    if (g.state !== 'play') break;
  }
  return { g, b, ev, maxY, maxAX, maxAZ, out };
}

const P = makeParams({});
const hx = P.fieldL / 2, hz = P.fieldW / 2;

// 1) Schuss gegen die Seitenbande: 30 m/s flach
{
  const s = shot(P, { v: [0, 0.8, 30], T: 1.2 });
  const hit = s.ev.find((e) => e.type === 'board');
  const after = s.b.v.z;
  check('Bande: Schuss 30 m/s prallt ab', hit ? 1 : 0, 1, 1, '', 1, hit ? `Aufprall ${hit.speed.toFixed(1)} m/s` : 'kein Aufprall');
  check('Bande: Ball bleibt im Feld', s.maxAZ, 0, hz, 'm', null, `max |z| ${s.maxAZ.toFixed(3)} m`);
  // Stoßzahl der Bande im Stoß selbst: senkrechter Aufprall ohne Spin
  const g = new Game(P, 2); g.players.length = 0; const b = g.ball;
  b.place(0, 0.5, hz - 0.5); b.contact = false; b.v.set(0, 0, 10); b.w.set(0, 0, 0);
  let vin = 0, vout = 0;
  for (let i = 0; i < 60; i++) { const vz = b.v.z; g.step(); if (vz > 0 && b.v.z < 0) { vin = vz; vout = -b.v.z; break; } }
  check('Bande: Stoßzahl (senkrecht, 10 m/s)', vout / vin, 0.6, 0.7, '', 0.65);
}
// 2) Spin ändert den Abprallwinkel (Bandenpass)
{
  const ang = (spinRps) => {
    const g = new Game(P, 3); g.players.length = 0; const b = g.ball;
    b.place(-3, 0.11, 0); b.contact = true; b.v.set(8, 0, 8); b.w.set(8 / 0.11, spinRps * 2 * Math.PI, -8 / 0.11);
    for (let i = 0; i < 240; i++) { g.step(); if (b.v.z < 0) break; }
    return Math.atan2(-b.v.z, b.v.x) * 180 / Math.PI;
  };
  const a0 = ang(0), aL = ang(8), aR = ang(-8);
  check('Bandenpass: Abprallwinkel ohne Drall', a0, 25, 65, '°', null, 'rollender Ball, 45° Einfall');
  check('Bandenpass: Drall ±8 U/s ändert den Winkel', Math.abs(aL - aR), 5, 90, '°', null, `${aR.toFixed(1)}° / ${a0.toFixed(1)}° / ${aL.toFixed(1)}°`);
}
// 3) Dachnetz: Schuss steil nach oben
{
  const s = shot(P, { v: [2, 29.5, 1], T: 8 });
  const roof = s.ev.find((e) => e.type === 'net' && e.tag === 'roof');
  check('Dachnetz: steiler Schuss 30 m/s trifft das Dach', roof ? 1 : 0, 1, 1, '', 1, roof ? `mit ${roof.speed.toFixed(1)} m/s` : '');
  check('Dachnetz: max. Höhe (Dach 5 m + Eindellung)', s.maxY, 0, P.roofH + P.netMaxDepth, 'm', null, `${s.maxY.toFixed(2)} m`);
  check('Dachnetz: Ball bleibt im Käfig', s.out ? 1 : 0, 0, 0, '', 0);
  const vUp = s.ev.find((e) => e.type === 'net');
  check('Netz schluckt Energie (Rückprall ÷ Aufprall)', netCOR(P), 0, 0.2, '', 0.1, 'Feder-Dämpfer, einseitig, ζ = 1,2');
}
function netCOR(P) {
  const g = new Game(P, 5); g.players.length = 0; const b = g.ball;
  b.place(0, 2.5, hz - 1); b.contact = false; b.v.set(0, 0, 20); b.w.set(0, 0, 0);
  let vin = 20, vout = 0;
  for (let i = 0; i < 240; i++) { g.step(); if (b.v.z < 0) vout = Math.max(vout, -b.v.z); if (b.p.z < hz - 0.6 && vout > 0) break; }
  return vout / vin;
}
// 4) Befreiungsschlag: 30 m/s unter 45° Richtung Stirnseite
{
  const s = shot(P, { v: [21.2, 21.2, 0], T: 8 });
  check('Befreiungsschlag 30 m/s, 45°: im Käfig', s.out ? 1 : 0, 0, 0, '', 0, `max |x| ${s.maxAX.toFixed(2)} m, max y ${s.maxY.toFixed(2)} m`);
}
// 5) Tor und Pfosten
{
  const x6 = P.fieldL / 2 - 6; // 6 m vor dem rechten Tor (Nacht 2c: Feld 24 × 15, vorher fest x = 4)
  const s = shot(P, { from: [x6, 0.11, 0], v: [18, 1.5, 0.3], T: 3 });
  check('Tor erkannt (Schuss mittig)', s.ev.some((e) => e.type === 'goal') ? 1 : 0, 1, 1, '', 1);
  const s2 = shot(P, { from: [x6, 0.11, 0], v: [18, 1.2, 18 * (P.goalW / 2) / 6], T: 3 });
  const post = s2.ev.find((e) => e.type === 'post');
  check('Pfosten: harter Abprall', post ? 1 : 0, 1, 1, '', 1, post ? `${post.speed.toFixed(1)} m/s` : 'verfehlt');
}
// 6) Zufallsbeschuss: 1500 Schüsse (5–30 m/s, alle Richtungen/Höhen, Spin bis 10 U/s) → nie draußen
{
  const rng = new Rng('käfig');
  let outs = 0, faults = 0, maxY = 0, maxOut = 0, n = 1500;
  for (let i = 0; i < n; i++) {
    const sp = rng.range(5, 30), el = rng.range(0, 85) * Math.PI / 180, az = rng.range(0, 2 * Math.PI);
    const from = [rng.range(-hx + 0.5, hx - 0.5), 0.11, rng.range(-hz + 0.5, hz - 0.5)];
    const v = [sp * Math.cos(el) * Math.cos(az), sp * Math.sin(el), sp * Math.cos(el) * Math.sin(az)];
    const w = [rng.gauss() * 20, rng.gauss() * 40, rng.gauss() * 20];
    const s = shot(P, { from, v, w, T: 5, seed: i });
    if (s.out) outs++;
    faults += s.g.faults;
    maxY = Math.max(maxY, s.maxY);
    maxOut = Math.max(maxOut, s.maxAZ - hz);
  }
  check(`Zufallsbeschuss ${n} Schüsse: Ball draußen`, outs, 0, 0, '×', 0);
  check('Zufallsbeschuss: Numerik-Notbremsen', faults, 0, 0, '×', 0);
  check('Zufallsbeschuss: max. Höhe', maxY, 0, P.roofH + P.netMaxDepth, 'm', null);
  check('Zufallsbeschuss: max. Netz-Eindellung seitlich', maxOut, -1, P.netMaxDepth, 'm', null);
}
// 7) Ohne Dach (?dach=0): hoher Schuss fliegt raus → „Aus“ wird erkannt
{
  const P0 = makeParams('?dach=0');
  const s = shot(P0, { v: [8, 26, 6], T: 8 });
  check('Ohne Dach: hoher Schuss → Aus erkannt', s.out ? 1 : 0, 1, 1, '', 1, `Netzoberkante ${P0.netTop} m`);
  const P3 = makeParams('?feld=30x15');
  check('?feld=30x15 übernommen', P3.fieldL * 100 + P3.fieldW, 3015, 3015, '', 3015);
}

process.exit(report('Käfig (Bande, Netze, Dach, Tore)', rows) ? 0 : 1);
