// Tormann isoliert (Nacht 2c): feste Schussserie gegen den CPU-Tormann der Stufe K (?tormann=K). Der Ball liegt
// 7–11 m vor dem Tor, der Tormann stellt sich 1,2 s lang selbst hin, dann ein Schuss 14–22 m/s in eine Ecke
// (seitlich 0,5–1,3 m, flach oder hoch). Zählt Tore / gefangen / abgewehrt.
// Aufruf: node tests/node/keeper_series.mjs [Schüsse=120] [Stufen=1,2,3] [Query]   (SPEED=30-40: andere Tempi)
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { aimAt, spinOf, setKick } from '../../src/sim/kickplan.js';
import { Rng } from '../../src/sim/rng.js';

const idle = { ...EMPTY_INPUT, passDown: false, shotDown: false };
export function keeperSeries(K, n = 120, qs = '', vLo = 14, vHi = 22) {
  const g = new Game(makeParams(`${qs}&tormann=${K}`), 9, { match: true, human: 0, perTeam: [1, 1], botLevels: [2, 2] });
  const rng = new Rng(21), gx = g.cage.hx, sh = g.players[0], kp = g.players[1];
  const c = { goal: 0, catch: 0, parry: 0, miss: 0, n: 0, dive: 0, wide: 0, wideDive: 0, diveSave: 0 };
  for (let k = 0; k < n; k++) {
    g.rules.phase = 'play';
    const d = rng.range(7, 11), z0 = rng.range(-3, 3);
    g.ball.place(gx - d, g.ball.r, z0); g.ball.held = -1;
    sh.place(gx - d - 0.5, z0, 0); kp.place(gx - 1, 0, Math.PI); kp.resetHands();
    g.rules.updateKeepers(0, true); g.lastTouch = 0; g.lastTouchT = g.t;
    for (let i = 0; i < 1.2 / DT; i++) { g.step([idle]); g.ball.place(gx - d, g.ball.r, z0); g.ball.v.set(0, 0, 0); }
    const zt = (rng.next() < 0.5 ? -1 : 1) * rng.range(0.5, 1.3), yt = rng.next() < 0.5 ? rng.range(0.25, 0.5) : rng.range(0.9, 1.6);
    const v = rng.range(vLo, vHi), from = [g.ball.p.x, g.ball.p.y, g.ball.p.z];
    const sol = aimAt(g.P, from, [gx, yt, zt], v, spinOf(0, 0), [1, 0, 0]);
    setKick(g.ball, sol.dir[0], sol.dir[1], v, sol.el, 0, 0);
    g.lastTouch = 0; g.lastTouchT = g.t; c.n++;
    // Nacht 2d: seitlicher Abstand Ball ↔ Tormann dort, wo der Ball seine Linie kreuzt (≥ 0,8 m: soll hechten)
    const tk = (kp.x - from[0]) / (g.ball.v.x || 1e-6), off = Math.abs(from[2] + g.ball.v.z * tk - kp.z);
    let res = '', dive = false;
    for (let i = 0; i < 1.5 / DT && !res; i++) for (const e of g.step([idle])) {
      if (e.type === 'dive') dive = true;
      if (e.type === 'goal') res = 'goal'; else if (e.type === 'catch') res = 'catch'; else if (e.type === 'parry' && !e.tip) res = 'parry';
    }
    c[res || 'miss']++;
    if (dive) { c.dive++; if (res === 'catch' || res === 'parry') c.diveSave++; }
    if (off >= 0.8 && res) { c.wide++; if (dive) c.wideDive++; } // nur Bälle aufs Tor (die 15 „sonst“ gehen drüber)
    g.rules.phase = 'play'; g.ball.held = -1; kp.resetHands();
  }
  return c;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 120), lv = (process.argv[3] || '1,2,3').split(',').map(Number), qs = process.argv[4] || '';
  const vr = (process.env.SPEED || '14-22').split('-').map(Number); // SPEED=30-40: harte Schüsse (Wucht)
  for (const K of lv) { const c = keeperSeries(K, n, qs, vr[0], vr[1]); console.log(`Tormann ${K}: Tore ${c.goal}/${c.n} = ${(100 * c.goal / c.n).toFixed(0)} %, gefangen ${c.catch}, abgewehrt ${c.parry}, sonst ${c.miss} | gehechtet ${c.dive} (davon gehalten ${c.diveSave}), Ball ≥ 0,8 m neben ihm: ${c.wideDive}/${c.wide} gehechtet`); }
}
