// Banane und Flanke (Nacht 2c, ?banane=, ?flanke=): Tabelle vorher/nachher mit echter Ballphysik (curve_probe.mjs).
// Banane ≥ 95 % des Vollspann-Tempos, Kurve bleibt; Flanke 14–28° statt 25–45°, Flugzeit etwa −30 %, Scheitel unter dem
// Dachnetz, landet beim Mitspieler; kurzer Chip bleibt steil. Aufruf: node tests/node/curve.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { curveTable, crossTable } from './curve_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');

const c1 = curveTable(''), c0 = curveTable('banane=0');
for (const D of [8, 12, 16]) {
  const vs = c1.find((r) => r.D === D && r.tech === 'vollspann'), cu = c1.find((r) => r.D === D && r.tech !== 'vollspann'), cu0 = c0.find((r) => r.D === D && r.tech !== 'vollspann');
  check(`Banane aus ${D} m: Tempo ÷ Vollspann`, cu.speed / vs.speed, 0.95, 1.0, '', 0.97, `${cu.speed.toFixed(1)} von ${vs.speed.toFixed(1)} m/s (Nacht 2b ${cu0.speed.toFixed(1)} m/s = ${(cu0.speed / vs.speed * 100).toFixed(0)} %)`);
  check(`Banane aus ${D} m: Kurve bleibt (seitlich)`, cu.dev, cu0.dev * 0.9, 9, 'm', null, `Nacht 2b ${cu0.dev.toFixed(2)} m; Flugzeit ${cu0.t.toFixed(2)} → ${cu.t.toFixed(2)} s, Drall ${Math.abs(cu0.spin).toFixed(1)} → ${Math.abs(cu.spin).toFixed(1)} U/s`);
}
const x1 = crossTable(''), x0 = crossTable('flanke=0');
for (let i = 0; i < x1.length; i++) {
  const a = x1[i], o = x0[i], D = Math.round(a.D);
  if (D <= 6) {
    check(`Kurzer Chip ${D} m bleibt steil (über den Tormann)`, a.el, 35, P.chipElevMax + 0.5, '°', null, `Nacht 2b ${o.el.toFixed(0)}°`);
    continue;
  }
  check(`Flanke ${D} m: Abflugwinkel`, a.el, 13.5, 28, '°', null, `Nacht 2b ${o.el.toFixed(0)}°, Abflug ${o.speed.toFixed(1)} → ${a.speed.toFixed(1)} m/s`);
  check(`Flanke ${D} m: Flugzeit ÷ Nacht 2b`, a.t / o.t, 0, 0.8, '×', 0.7, `${o.t.toFixed(2)} → ${a.t.toFixed(2)} s, Scheitel ${o.apex.toFixed(2)} → ${a.apex.toFixed(2)} m`);
  check(`Flanke ${D} m: landet beim Mitspieler`, a.err, 0, 0.35, 'm', 0, 'Chip-Tabelle mit erstem Aufsetzer (Nacht 2c korrigiert)');
  check(`Flanke ${D} m: Scheitel unter dem Dachnetz`, a.apex, 0, P.roofH - 0.5, 'm', null);
}

const ok = report('Banane und Flanke (vorher/nachher)', rows, 'curve');
console.log('\n| Schuss | Technik | Nacht 2b: Tempo / Flugzeit / Scheitel / Kurve | Nacht 2c |\n|---|---|---|---|');
for (let i = 0; i < c1.length; i++) { const a = c1[i], o = c0[i]; console.log(`| ${a.D} m | ${a.tech} | ${o.speed.toFixed(1)} m/s / ${o.t.toFixed(2)} s / ${o.apex.toFixed(2)} m / ${o.dev.toFixed(2)} m | ${a.speed.toFixed(1)} m/s / ${a.t.toFixed(2)} s / ${a.apex.toFixed(2)} m / ${a.dev.toFixed(2)} m |`); }
console.log('\n| Pass hoch | Nacht 2b: Winkel / Tempo / Flugzeit / Scheitel | Nacht 2c |\n|---|---|---|');
for (let i = 0; i < x1.length; i++) { const a = x1[i], o = x0[i]; console.log(`| ${a.D.toFixed(0)} m | ${o.el.toFixed(0)}° / ${o.speed.toFixed(1)} m/s / ${o.t.toFixed(2)} s / ${o.apex.toFixed(2)} m | ${a.el.toFixed(0)}° / ${a.speed.toFixed(1)} m/s / ${a.t.toFixed(2)} s / ${a.apex.toFixed(2)} m |`); }
process.exit(ok ? 0 : 1);
