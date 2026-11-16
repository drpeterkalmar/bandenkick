// n15 E6: Einfach-Modus gegen Standard, gleiche Seeds. (a) Skript-Mensch wie einknopf_probe (führt Richtung Tor, drückt nach 0,4–1,5 s am Ball);
// (b) „ohne Knopf“: derselbe Spieler drückt nie. Gemessen: Tore : Gegentore, Pässe, abgefangen. Aufruf: node tests/node/n15_easy_probe.mjs [Spiele=8]
import { spiele } from './einknopf_probe.mjs';
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { pathToFileURL } from 'node:url';

export function ohneKnopf(qs = '', games = 8, seed0 = 1) {
  const P = makeParams('dauer=4&' + qs), r = { tore: 0, gegentore: 0, paesse: 0, ab: 0 };
  for (let s = 0; s < games; s++) {
    const g = new Game(P, 'ek' + (seed0 + s), { match: true, human: 1, botLevel: 2 });
    let open = null;
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 200) {
      const me = g.players[g.human], b = g.ball, gx = me.team === 0 ? g.cage.hx : -g.cage.hx;
      const mine = g.lastTouch === me.id && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 1.5;
      let mx, mz;
      if (mine) { const l = Math.hypot(gx - me.x, -me.z * 0.5) || 1; mx = (gx - me.x) / l * 0.7; mz = -me.z * 0.5 / l * 0.7; }
      else { const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1; mx = l > 0.3 ? dx / l : 0; mz = l > 0.3 ? dz / l : 0; }
      const ins = []; ins[g.human] = { ...EMPTY_INPUT, mx, mz, passDown: false, shotDown: false };
      for (const e of g.step(ins)) {
        const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
        if (open && p && e.player !== open.from && ['touch', 'kick', 'control', 'catch', 'air'].includes(e.type)) { if (p.team !== open.team) r.ab++; open = null; }
        if (e.type === 'kick' && e.kind === 'pass' && p && p.team === 0 && e.to >= 0) { r.paesse++; open = { from: e.player, team: 0 }; }
        if (e.type === 'goal') { if (e.team === 0) r.tore++; else r.gegentore++; }
      }
    }
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8);
  for (const q of ['easy=0', 'easy=1']) {
    const a = spiele(q, G), b = ohneKnopf(q, G);
    console.log(`${q} | mit Knopf: Tore ${a.tore} : ${a.gegentore}, Pässe ${a.paesse}, abgefangen ${(100 * a.ab / Math.max(1, a.paesse)).toFixed(1)} % | ohne Knopf: Tore ${b.tore} : ${b.gegentore}, Pässe ${b.paesse}, abgefangen ${(100 * b.ab / Math.max(1, b.paesse)).toFixed(1)} %`);
  }
}
