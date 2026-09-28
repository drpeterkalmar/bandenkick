// FIFA-Prüfungen für den Kunstrasen – so wie im Labor (Handbook of Test Methods 2015), Fenster aus dem
// FIFA Test Manual 2024 Teil II, „FIFA Quality Pro“, trocken. Aufruf: node tests/node/fifa.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { dropTestFine, angleTest, rollTest, reducedRollTest } from '../../src/sim/lab.js';
import { report } from './report.mjs';

const P = makeParams({});
const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => {
  const ok = value >= lo && value <= hi;
  rows.push({ name, value, lo, hi, unit, target, ok, note });
  return ok;
};

// Methode 01: vertikaler Ballabprall aus 2,00 m (Unterseite)
const d = dropTestFine(P, 'turf');
check('Ballabprall (M01), H = 1,23·T²', d.H, 0.60, 0.85, 'm', 0.72, `T = ${d.T.toFixed(3)} s, Scheitel ${d.apex.toFixed(3)} m`);
// Kalibrierung des Testballs: 1,35 ± 0,03 m auf Beton
const c = dropTestFine(P, 'concrete');
check('Testball auf Beton (Kalibrierung)', c.H, 1.32, 1.38, 'm', 1.35, `Scheitel ${c.apex.toFixed(3)} m`);

// Methode 02: schräger Abprall, 15° ± 2°, 50 ± 5 km/h → alle Ecken des Toleranzfensters
const a0 = angleTest(P, 15, 50);
check('Schräger Abprall (M02) 15°, 50 km/h', a0.ratio * 100, 45, 60, '%', 52, `S1 ${(a0.S1 * 3.6).toFixed(1)} km/h → S2 ${(a0.S2 * 3.6).toFixed(1)} km/h`);
for (const [ang, kmh] of [[13, 45], [13, 55], [17, 45], [17, 55]]) {
  const r = angleTest(P, ang, kmh);
  check(`  Toleranzecke ${ang}°, ${kmh} km/h`, r.ratio * 100, 45, 60, '%', 52);
}
// Nur Info: Methode 02 schreibt eine Kanone ohne Drall vor; mit ±3 U/s (Grenze der Splash-Kanone) zeigt sich,
// wie stark Drall den Abprall ändert (Rückdrall bremst, Vorwärtsdrall lässt laufen).
for (const rps of [-3, 3]) {
  const r = angleTest(P, 15, 50, rps);
  check(`  Info: mit ${rps > 0 ? 'Rück' : 'Vor'}drall ${Math.abs(rps)} U/s`, r.ratio * 100, -Infinity, Infinity, '%', null, 'nicht Teil der Norm');
}

// Methode 03: Ballrollen von der Rampe (45°, R 500 mm, Stäbe Ø 40 mm / 100 mm, Start 1,000 m)
const r = rollTest(P, 1.0);
check('Ballrollen (M03)', r.dist, 4.0, 8.0, 'm', 6.0, `Rampen-Ende ${r.exitV.toFixed(2)} m/s, Rollradius ${(r.rEff * 1000).toFixed(1)} mm, ${r.time.toFixed(1)} s`);
for (const [ang, h, label] of [[43, 0.995, '43°, 0,995 m'], [47, 1.005, '47°, 1,005 m']]) {
  const rr = rollTest(P, h, { angle: ang });
  check(`  Toleranz ${label}`, rr.dist, 4.0, 8.0, 'm', 6.0);
}
// Methode 17: „Reduced Ball Roll“ (vier Starthöhen, Lichtschranken bei 1,0 m und 2,5 m, Polynom-Iteration)
const rb = reducedRollTest(P);
check('Reduced Ball Roll (M17)', rb.pred, 4.0, 8.0, 'm', 6.0, `Höhen ${rb.heights.map((x) => x.toFixed(2)).join('/')} m, ${rb.n}×1,5 m + ${rb.Sr.toFixed(2)} m`);
check('  M17 ↔ M03 (Abweichung)', Math.abs(rb.pred - r.dist), 0, 0.5, 'm', 0);

// Gleiten/Rollen mit Spin (Plan: Rückspin bremst, Vorwärtsspin lässt nachlaufen)
import { Ball } from '../../src/sim/ball.js';
const open = { hx: 1e6, hz: 1e6, bH: 0, top: 1e6, gw: 0, gH: 0, gD: 0, rects: [], bars: [], roof: false };
function slide(spinRps) {
  const b = new Ball(P);
  b.place(0, P.ballR, 0); b.contact = true;
  b.v.set(8, 0, 0); b.w.set(0, 0, -spinRps * 2 * Math.PI); // + = Vorwärtsdrall
  for (let i = 0; i < 120 * 20; i++) { b.step(1 / 120, open); if (b.v.x <= 0 && i > 10) break; }
  return b.p.x;
}
const dNo = slide(0), dTop = slide(8), dBack = slide(-8);
check('Gleiten: Rückdrall 8 U/s kürzer als ohne', dNo - dBack, 0.5, 50, 'm', null, `${dBack.toFixed(1)} m vs. ${dNo.toFixed(1)} m`);
check('Gleiten: Vorwärtsdrall 8 U/s weiter als ohne', dTop - dNo, 0.5, 50, 'm', null, `${dTop.toFixed(1)} m vs. ${dNo.toFixed(1)} m`);

process.exit(report('FIFA-Rasenprüfung (Quality Pro, trocken)', rows) ? 0 : 1);
