// n11 (Peter 02.11.: „Beim 1knopf bin ich skeptisch, die Pässe wurden bisher immer abgefangen und wurden eher Torvorlagen für den
// Gegner“): Ein-Knopf-Test (?einknopf=1) gegen zwei Knöpfe in ganzen Spielen. Skript-Mensch (Orange, sonst Bots Stufe 2) führt den
// Ball Richtung Tor und tippt nach 0,4–1,5 s: mit zwei Knöpfen Schuss (≤ 9 m vor dem Tor, Tor grob vorn) bzw. Pass (Stick auf einen
// Mitspieler, Daumen-Fehler σ 8°); mit einem Knopf immer den Kick-Knopf (Schuss-Knopf, Stick genauso). Gemessen je Tipp: Pass
// abgefangen, daraus binnen 8 s Gegentor; Schüsse, Tore. Aufruf: node tests/node/einknopf_probe.mjs [Spiele=8] ["qs"]
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { pathToFileURL } from 'node:url';

const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
export function spiele(qs = '', games = 8, seed0 = 1) {
  const P = makeParams('dauer=4&' + qs), ein = !!P.einknopf;
  const r = { games, tipps: 0, paesse: 0, ab: 0, abTor: 0, schuesse: 0, tore: 0, gegentore: 0, keinKick: 0 };
  for (let s = 0; s < games; s++) {
    const g = new Game(P, 'ek' + (seed0 + s), { match: true, human: 1, botLevel: 2 });
    const R = new Rng('ekr' + (seed0 + s));
    let hold = -1, press = null, open = null; const ints = [];
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 200) {
      const me = g.players[g.human], b = g.ball, team = me.team, gx = team === 0 ? g.cage.hx : -g.cage.hx;
      const mine = g.lastTouch === me.id && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 1.5 && b.held < 0 && g.rules.phase === 'play';
      let inp;
      if (press && g.t - press.t < 0.6) inp = H({ mx: press.w[0], mz: press.w[1], [press.btn + 'Down']: g.t - press.t < 0.07 });
      else if (mine) {
        if (hold < 0) hold = g.t + R.range(0.4, 1.5);
        if (g.t >= hold) {
          const D = Math.hypot(gx - b.p.x, b.p.z), mates = g.players.filter((p) => p.team === team && p.id !== me.id && p.id !== g.rules.keeper[team]);
          const schuss = D < 9 && ((gx - me.x) * Math.cos(me.face) - me.z * Math.sin(me.face)) / (Math.hypot(gx - me.x, me.z) || 1) > 0.3;
          let w;
          if (schuss || !mates.length) { const l = Math.hypot(gx - me.x, -me.z) || 1; w = [(gx - me.x) / l, -me.z / l]; }
          else { const m = mates[R.next() < 0.5 ? 0 : mates.length - 1], a = Math.atan2(m.z - me.z, m.x - me.x) + R.gauss() * 8 * Math.PI / 180; w = [Math.cos(a), Math.sin(a)]; }
          press = { from: me.id, t: g.t, w: [w[0] * 0.8, w[1] * 0.8], btn: ein ? 'shot' : schuss ? 'shot' : 'pass' }; hold = -1; r.tipps++;
          inp = H({ mx: press.w[0], mz: press.w[1], [press.btn + 'Down']: true });
        } else { const l = Math.hypot(gx - me.x, -me.z * 0.5) || 1; inp = H({ mx: (gx - me.x) / l * 0.7, mz: -me.z * 0.5 / l * 0.7 }); }
      } else {
        hold = -1;
        const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1;
        inp = H(l > 0.3 ? { mx: dx / l, mz: dz / l } : {});
      }
      const ins = []; ins[g.human] = inp;
      const ev = g.step(ins);
      for (const e of ev) {
        const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
        if (open && p && e.player !== open.from && ['touch', 'kick', 'control', 'catch', 'parry', 'body', 'air'].includes(e.type) && g.t > open.t) {
          if (p.team !== open.team) { r.ab++; ints.push({ t: g.t, team: p.team, done: false }); }
          open = null;
        }
        if (e.type === 'kick' && press && e.player === press.from && g.t - press.t < 1.6) {
          if (e.kind === 'pass' && e.to >= 0 && e.to !== e.player) { r.paesse++; open = { from: e.player, team: p.team, t: g.t }; }
          if (e.kind === 'shot') r.schuesse++;
          press = null;
        }
        if (e.type === 'goal') {
          if (e.team === 0) r.tore++; else r.gegentore++;
          for (const it of ints) if (!it.done && it.team === e.team && g.t - it.t <= 8) { it.done = true; r.abTor++; }
          open = null;
        }
      }
      if (press && g.t - press.t > 1.6) { r.keinKick++; press = null; }
    }
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8), qs = process.argv[3] || '';
  for (const q of [qs, (qs ? qs + '&' : '') + 'einknopf=1']) {
    const r = spiele(q, G);
    console.log(`${q.includes('einknopf=1') ? 'Ein Knopf ' : 'Zwei Knöpfe'} | Tipps ${r.tipps} | Pässe ${r.paesse}, abgefangen ${(100 * r.ab / Math.max(1, r.paesse)).toFixed(1)} %, Gegentor ≤ 8 s danach ${r.abTor} | Schüsse ${r.schuesse} | Tore ${r.tore} : ${r.gegentore} | ohne Kick ${r.keinKick}`);
  }
}
