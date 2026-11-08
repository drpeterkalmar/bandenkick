// n13 Spektakel-Probe: Szenen mit Ball am Fuß, Schuss-Tipp in verschiedenen Winkeln zum Tor, Tormann im Tor (Stufe 2).
// Misst je Art (Jonglier-Fallrückzieher, Megaferse, normaler Schuss im Kegel, Drehung) Torquote, gehalten, daneben.
// node tests/node/n13_spektakel_probe.mjs [Szenen=200] [Query]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { Rng } from '../../src/sim/rng.js';
import { pathToFileURL } from 'node:url';

export function szene(qs, { x = 6, z = 0, face = Math.PI, opp = null, mate = [-6, 5], seed = 1, human = 0 } = {}) {
  // Blau: Tormann (Bot, Stufe 2) und – nur mit opp – ein Feldspieler an dieser Stelle; Orange: Schütze (Mensch) + Mitspieler (Bot)
  const g = new Game(makeParams(qs), seed, { match: true, perTeam: [2, opp ? 2 : 1], human, botLevels: [2, 2] });
  g.rules.phase = 'play';
  const [s, m, k, o] = g.players;
  s.place(x, z, face); m.place(mate[0], mate[1], 0); k.place(g.cage.hx - 1, 0, Math.PI); if (o) o.place(...opp, Math.PI);
  g.rules.updateKeepers(0, true);
  g.ball.place(x + Math.cos(face) * 0.42, 0.11, z + Math.sin(face) * 0.42); g.ball.v.set(0, 0, 0);
  g.lastTouch = s.id; s.lastTouchT = g.t;
  s.kickAt({ kind: 'shot', auto: true });
  const ev = [];
  let art = null, ende = null, maxY = 0;
  for (let i = 0; i < 4 / DT; i++) {
    for (const e of g.step(human >= 0 ? [{}] : [])) {
      ev.push({ ...e, t: g.t });
      if (!art && e.type === 'jongl') art = 'fallrueck';
      if (!art && e.type === 'drehschuss') art = 'drehen';
      if (!art && e.type === 'lupfer') art = 'lupfer';
      if (!art && e.type === 'kick') art = e.tech === 'megaferse' ? 'megaferse' : e.tech === 'lupfer' ? 'lupfer' : 'kegel';
      if (art === 'lupfer' && e.type === 'comic') art = 'lupfer+direkt';
      if (!ende && (e.type === 'goal' || e.type === 'catch' || e.type === 'parry')) ende = e.type;
    }
    maxY = Math.max(maxY, g.ball.p.y);
    if (g.rules.phase !== 'play' || ende) break;
  }
  return { art, ende: ende || 'daneben', ev, g, maxY };
}

// fall: 'frei' (niemand nah), 'gegner' (Gegner 1 m hinter dem Schützen, Rücken zum Tor), 'mitspieler' (Mitspieler frei vor dem Tor)
export function probe(N = 200, qs = '', fall = 'frei') {
  const rng = new Rng(13), R = {};
  for (let i = 0; i < N; i++) {
    const x = rng.range(-2, 8), z = rng.range(-4, 4), gx = 12;
    const zumTor = Math.atan2(-z, gx - x), ab = fall === 'gegner' ? rng.range(2.3, Math.PI) : rng.range(0, Math.PI); // Winkel Blick ↔ Tor
    const face = zumTor + (rng.next() < 0.5 ? ab : -ab);
    const opp = fall === 'gegner' ? [x + Math.cos(zumTor) * 1.1, z + Math.sin(zumTor) * 1.1] : null;
    const mate = fall === 'mitspieler' ? [rng.range(3, 7), (rng.next() < 0.5 ? -1 : 1) * rng.range(1.5, 3.5)] : [-6, 5];
    const r = szene(qs, { x: fall === 'mitspieler' ? x - 6 : x, z, face, opp, mate, seed: 100 + i });
    const a = r.art || 'nichts', o = (R[a] = R[a] || { n: 0, goal: 0, catch: 0, parry: 0, daneben: 0 });
    o.n++; o[r.ende]++;
  }
  return R;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const R = probe(+(process.argv[2] || 200), process.argv[3] || '', process.argv[4] || 'frei');
  for (const [a, o] of Object.entries(R)) console.log(`${a}: ${o.n} Szenen, Tor ${(100 * o.goal / o.n).toFixed(0)} %, gefangen ${o.catch}, abgewehrt ${o.parry}, daneben ${o.daneben}`);
}
