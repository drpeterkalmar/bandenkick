// Aerodynamik-Prüfungen: Drag-Crisis (Hong & Asai 2014), Magnus-Kurve (Asai et al. 2007 / Goff & Carré),
// Flatterball-Streuung (Kick-Roboter von Hong & Asai 2014), Determinismus. Aufruf: node tests/node/aero.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { flight } from '../../src/sim/lab.js';
import { cdNoSpin, cdOf, clOf, spForCl, reynolds } from '../../src/sim/aero.js';
import { report } from './report.mjs';

const P = makeParams({});
const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => {
  const ok = value >= lo && value <= hi;
  rows.push({ name, value, lo, hi, unit, target, ok, note });
  return ok;
};
const vOfRe = (Re) => Re * P.nu / (2 * P.ballR);

// 1) Drag-Crisis-Kurve gegen die Werte aus Hong & Asai 2014 (Text, Abb. 3)
check('cD unterkritisch, Re 1,0·10⁵', cdNoSpin(1.0e5, P), 0.45, 0.55, '', 0.5, `${vOfRe(1e5).toFixed(1)} m/s; Paper: „~0,5“`);
check('cD bei Re 1,5·10⁵ (Beginn Abfall)', cdNoSpin(1.5e5, P), 0.42, 0.52, '', null, `${vOfRe(1.5e5).toFixed(1)} m/s; Cafusa: Abfall ab 1,5–1,7·10⁵`);
check('cD bei Re 2,2·10⁵ (Brazuca B krit.)', cdNoSpin(2.2e5, P), 0.14, 0.22, '', 0.16, `${vOfRe(2.2e5).toFixed(1)} m/s`);
check('cD bei Re 2,5·10⁵ (Brazuca A / herk. A krit.)', cdNoSpin(2.5e5, P), 0.14, 0.18, '', 0.155, `${vOfRe(2.5e5).toFixed(1)} m/s; Paper 0,15–0,16`);
check('cD bei Re 2,8·10⁵ (herk. Ball B krit.)', cdNoSpin(2.8e5, P), 0.14, 0.18, '', 0.17, `${vOfRe(2.8e5).toFixed(1)} m/s`);
// Übergangsbereich in m/s (Plan: ~10…17 m/s)
let v95 = 0, v05 = 0;
for (let v = 5; v < 25; v += 0.01) {
  const c = cdNoSpin(reynolds(v, P), P);
  const f = (c - P.cdSuper) / (P.cdSub - P.cdSuper);
  if (!v95 && f < 0.95) v95 = v;
  if (!v05 && f < 0.05) v05 = v;
}
check('Übergang beginnt (95 %)', v95, 9.5, 12, 'm/s', null, 'Plan: ~10 m/s');
check('Übergang fertig (5 %)', v05, 15, 17.5, 'm/s', null, 'Plan: ~17 m/s');
// Spin erhöht cD überkritisch (Goff & Carré 2010, Abb. 2 / Gl. 4)
check('cD überkritisch mit Sp 0,3', cdOf(3.5e5, 0.3, P), 0.25, 0.32, '', 0.285, 'Gl. 4: 0,4127·Sp^0,3056');

// 2) Drag-Crisis im Flug: Ein 30-m/s-Heber wird langsamer; unter ~17 m/s bremst die Luft plötzlich stärker.
{
  const f = flight(P, { v0: 30, elevDeg: 52, knuckle: false, h0: 0.2, maxT: 8 });
  // Luft-Verzögerung aus dem Tempo-Verlauf: nur Drag, deshalb mit cD neu gerechnet
  const drag = (v) => 0.5 * P.rho * Math.PI * P.ballR ** 2 * cdNoSpin(reynolds(v, P), P) * v * v / P.ballM;
  const vs = f.path.map((p) => p[4]);
  const vmin = Math.min(...vs);
  check('Heber 30 m/s, 52°: tiefstes Tempo im Flug', vmin, 0, 13, 'm/s', null, 'muss durch die Krise laufen');
  const a17 = drag(17), a13 = drag(13), a28 = drag(28);
  check('Luftbremse 13 m/s ÷ 17 m/s', a13 / a17, 1.15, 2.0, '×', null, `${a17.toFixed(2)} → ${a13.toFixed(2)} m/s² (trotz kleinerem v²); 28 m/s: ${a28.toFixed(2)} m/s²`);
  check('Flugweite Heber (Info)', f.end[1], 0, 100, 'm', null, `Landung nach ${f.t.toFixed(2)} s`);
}

// 3) Magnus: Rechenprobe des Plans – 25 m/s, cL = 0,25 → ~8 m/s² Seitenbeschleunigung, ~3 m Kurve auf 20 m
{
  const Sp = spForCl(0.25);
  const w = Sp * 25 / P.ballR;
  const aSide = 0.5 * P.rho * Math.PI * P.ballR ** 2 * 0.25 * 625 / P.ballM;
  check('Seitenbeschleunigung 25 m/s, cL 0,25', aSide, 7.5, 9.0, 'm/s²', 8.3);
  const f = flight(P, { v0: 25, elevDeg: 12, spin: [0, w, 0], untilX: 20, knuckle: false, h0: 0.11 });
  check('Kurve nach 20 m (Sp₀ ' + Sp.toFixed(3) + ', ' + (w / 2 / Math.PI).toFixed(1) + ' U/s)', Math.abs(f.end[3]), 2.5, 3.5, 'm', 3.0, `Höhe dort ${f.end[2].toFixed(2)} m, ${f.end[0].toFixed(2)} s, Richtung ${f.end[3] < 0 ? 'links' : 'rechts'} (gegen den Uhrzeigersinn → links)`);
  check('  Kurve nach links bei Drall gegen den Uhrzeigersinn', f.end[3] < 0 ? 1 : 0, 1, 1, '', 1);
  const f10 = flight(P, { v0: 25, elevDeg: 12, spin: [0, 10 * 2 * Math.PI, 0], untilX: 20, knuckle: false, h0: 0.11 });
  check('Info: Innenseite 10 U/s, 25 m/s → Kurve auf 20 m', Math.abs(f10.end[3]), -Infinity, Infinity, 'm', null, 'Maximum im Spiel');
  // cL-Tabelle trifft die Asai-Mediane
  check('cL(Sp 0,11) (Asai-Median 0,22)', clOf(0.11), 0.2, 0.24, '', 0.22);
  check('cL(Sp 0,49) (Goff & Carré 2009: 0,285)', clOf(0.49), 0.26, 0.31, '', 0.285);
  // Rückdrall hebt, Vorwärtsdrall senkt
  const fb = flight(P, { v0: 20, elevDeg: 10, spin: [0, 0, 30], knuckle: false, h0: 0.11 });
  const ft = flight(P, { v0: 20, elevDeg: 10, spin: [0, 0, -30], knuckle: false, h0: 0.11 });
  const f0 = flight(P, { v0: 20, elevDeg: 10, knuckle: false, h0: 0.11 });
  check('Rückdrall trägt weiter als ohne', fb.end[1] - f0.end[1], 0.5, 40, 'm', null, `${fb.end[1].toFixed(1)} vs. ${f0.end[1].toFixed(1)} m`);
  check('Vorwärtsdrall senkt früher', f0.end[1] - ft.end[1], 0.5, 40, 'm', null, `${ft.end[1].toFixed(1)} vs. ${f0.end[1].toFixed(1)} m`);
}

// 4) Flatterball: Kick-Roboter (Hong & Asai 2014) – 30 m/s, 15°, < 1 Umdrehung, Tor in 25 m, viele Seeds
{
  const zs = [], ys = [];
  for (let s = 1; s <= 80; s++) {
    const f = flight(P, { v0: 30, elevDeg: 15, spin: [0, 0.5, 0], seed: 'robot' + s, untilX: 25, h0: 0.11 });
    zs.push(f.end[3]); ys.push(f.end[2]);
  }
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  check('Flatterball: Streuung seitlich (SD)', sd(zs), 0.2, 0.5, 'm', null, 'Paper: Brazuca 0,20–0,22 / herk. Ball 0,48–0,51 m');
  check('Flatterball: Streuung vertikal (SD)', sd(ys), 0.15, 0.5, 'm', null, 'Paper: 0,19–0,45 m');
  const zs2 = [];
  for (let s = 1; s <= 30; s++) zs2.push(flight(P, { v0: 30, elevDeg: 15, spin: [0, 5 * 2 * Math.PI, 0], seed: 'robot' + s, untilX: 25, h0: 0.11 }).end[3]);
  check('Mit Effet 5 U/s kein Flattern (SD)', sd(zs2), 0, 0.03, 'm', 0);
  // Determinismus: gleicher Seed = gleiche Bahn, anderer Seed = andere Bahn
  const a = flight(P, { v0: 30, elevDeg: 15, seed: 4711, untilX: 25, h0: 0.11 }).end;
  const b = flight(P, { v0: 30, elevDeg: 15, seed: 4711, untilX: 25, h0: 0.11 }).end;
  const c = flight(P, { v0: 30, elevDeg: 15, seed: 4712, untilX: 25, h0: 0.11 }).end;
  check('Gleicher Seed → identische Bahn', Math.abs(a[3] - b[3]) + Math.abs(a[2] - b[2]), 0, 0, 'm', 0);
  check('Anderer Seed → andere Bahn', Math.abs(a[3] - c[3]) + Math.abs(a[2] - c[2]), 0.001, Infinity, 'm', null);
}

process.exit(report('Aerodynamik (Drag-Crisis, Magnus, Flatterball)', rows) ? 0 : 1);
