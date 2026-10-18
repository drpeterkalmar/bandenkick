// n7 Etappe 0: Messwerkzeug von Hermes (14.10.), übernommen und erweitert. Bot-Spiele (alle Stufen reihum): Schusstempo und
// erster Torwartkontakt bzw. Tor nach einem Schuss je Schusstempo – alle Schüsse und nur direkte (nicht von Bande, Pfosten,
// Netz oder einem Spieler abgefälscht). Dazu Fangquote langsamer Bälle (< 45 km/h an den Händen).
// Aufruf: node tests/node/keeper_catch_probe.mjs "<query>" 12
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { pathToFileURL } from 'node:url';

export const BINS = [[0, 13], [13, 16], [16, 20], [20, 25], [25, 99]];
export function catchProbe(qs = '', N = 12) {
  const all = BINS.map(() => ({ catch: 0, parry: 0, goal: 0 })), direct = BINS.map(() => ({ catch: 0, parry: 0, goal: 0 }));
  const sp = []; let slowAll = 0, slowCatch = 0;
  for (let s = 1; s <= N; s++) {
    const P = makeParams(qs);
    const lv = [[1, 1], [2, 2], [3, 3], [2, 3]][s % 4];
    const g = new Game(P, 1000 + s, { match: true, human: -1, botLevels: lv });
    let last = null;
    while (g.rules.phase !== 'end' && g.t < 900) {
      for (const e of g.step([])) {
        if (e.type === 'kick') { last = e.kind === 'shot' ? { v: e.speed, t: g.t, defl: false } : null; if (e.kind === 'shot') sp.push(e.speed); continue; }
        if ((e.type === 'catch' || e.type === 'parry') && e.speed < 12.5) { slowAll++; if (e.type === 'catch') slowCatch++; }
        if (e.type === 'touch' || e.type === 'control') { last = null; continue; }
        if (last && ['board', 'post', 'net', 'body'].includes(e.type)) { last.defl = true; continue; }
        if (!last || g.t - last.t > 2) continue;
        const i = BINS.findIndex(([a, b]) => last.v >= a && last.v < b);
        if (e.type === 'catch' || e.type === 'parry' || e.type === 'goal') { all[i][e.type]++; if (!last.defl) direct[i][e.type]++; last = null; }
      }
    }
  }
  return { all, direct, sp: sp.sort((a, b) => a - b), slowAll, slowCatch };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const qs = process.argv[2] || '', N = +(process.argv[3] || 12);
  const r = catchProbe(qs, N), q = (p) => (r.sp[Math.floor(p * (r.sp.length - 1))] * 3.6).toFixed(0);
  console.log(`qs=${qs} Spiele ${N}, Schüsse ${r.sp.length}, Schusstempo km/h p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)}`);
  for (const [lbl, arr] of [['alle Schüsse', r.all], ['nur direkte Schüsse', r.direct]]) {
    console.log(`Erster Torwartkontakt bzw. Tor nach Schuss (je Schusstempo), ${lbl}:`);
    BINS.forEach(([a, b], i) => { const x = arr[i], n = x.catch + x.parry; console.log(`  ${Math.round(a * 3.6)}-${Math.round(b * 3.6)} km/h: gefangen ${x.catch}, abgewehrt ${x.parry} → Fangquote ${n ? Math.round(100 * x.catch / n) : '-'} %, Tore direkt ${x.goal}`); });
  }
  console.log(`Langsame Bälle (< 45 km/h an den Händen): gefangen ${r.slowCatch}/${r.slowAll} = ${(100 * r.slowCatch / Math.max(1, r.slowAll)).toFixed(0)} %`);
}
