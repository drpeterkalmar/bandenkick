// n15 E7: Flanken (hoher Pass von außen in den Strafraum) – Scheitel, Ankunftshöhe, Zeitreserve der Gegner in festen Lagen, ?flankehoch=1 = n14.
// Aufruf: node tests/node/n15_flanke_probe.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { bestLob } from '../../src/sim/hochpass.js';
import { runPath } from '../../src/sim/pass.js';
import { pathToFileURL } from 'node:url';

export function flanken(qs = '') {
  const P = makeParams(qs), out = [];
  for (const [px, pz, mx, mz, mv, ox, oz] of [[-3, 6, 4, 0.5, 2, -8, -5], [-1, -6, 4.5, -1, 1, -9, 5], [-4, 6.2, 3.5, 1, 3, -9, -6], [-2, 6, 4, -1.5, 0, -8, -4], [0, -6.3, 4.5, 1.5, 2, -8, 6], [-3, -6, 4, 0, 3, -9, 5], [2, 6, 6, 0.5, 2, -6, -5], [3, -6, 6.5, -1, 1, -7, 5]]) {
    const g = new Game(P, 'f' + px, { match: true, human: -1 }); g.rules.phase = 'play';
    const [pl, m, k] = g.players; pl.place(px, pz, 0); m.place(mx, mz, 0); m.vx = mv; k.place(-11, 0, 0);
    const opp = g.players.slice(3); opp[0].place(11.6, 0, Math.PI); opp[1].place(ox, oz, Math.PI); opp[2].place(-5, 2, 0);
    const r = bestLob(g, pl, [px, pz], m, runPath, {});
    if (r) out.push(r);
  }
  const av = (f) => out.reduce((a, c) => a + f(c), 0) / Math.max(1, out.length);
  return { n: out.length, apex: av((c) => c.apex), hArr: av((c) => c.hArr), slack: av((c) => Math.min(c.slack, 0.4)), T: av((c) => c.T) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const q of ['flankehoch=1', '']) { const r = flanken(q); console.log(`${q || 'Standard'} | ${r.n} Flanken · Scheitel ${r.apex.toFixed(2)} m · Ankunft ${r.hArr.toFixed(2)} m · Reserve ${r.slack.toFixed(2)} s · Flug ${r.T.toFixed(2)} s`); }
}
