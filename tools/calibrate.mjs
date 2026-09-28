// Stellt die Rasen- und Betonwerte auf die FIFA-Zielwerte (Bisektion) und gibt sie aus.
// Aufruf: node tools/calibrate.mjs   → Werte in src/sim/params.js übernehmen.
// Ziele (FIFA Quality Pro, trocken): Ballabprall 0,72 m, schräger Abprall 52 %, Ballrollen 6,0 m;
// Testball auf Beton 1,35 m aus 2,00 m.
import { makeParams } from '../src/sim/params.js';
import { dropTestFine, angleTest, rollTest } from '../src/sim/lab.js';

function bisect(f, lo, hi, target, it = 40) {
  let flo = f(lo) - target;
  for (let i = 0; i < it; i++) {
    const mid = (lo + hi) / 2, fm = f(mid) - target;
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}
const base = makeParams({});
const turfEn = bisect((e) => dropTestFine({ ...base, turfEn: e }).H, 0.4, 0.8, 0.72);
const concreteEn = bisect((e) => dropTestFine({ ...base, concreteEn: e }, 'concrete').H, 0.7, 0.95, 1.35);
const turfEx = bisect((x) => angleTest({ ...base, turfEn, turfEx: x }).ratio, 0.0, 0.5, 0.52);
const turfRoll0 = bisect((r0) => -rollTest({ ...base, turfEn, turfEx, turfRoll0: r0 }).dist, 0.05, 1.5, -6.0);
console.log(JSON.stringify({ turfEn: +turfEn.toFixed(4), concreteEn: +concreteEn.toFixed(4), turfEx: +turfEx.toFixed(4), turfRoll0: +turfRoll0.toFixed(4) }));
