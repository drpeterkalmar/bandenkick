// n7 Vorlagen E5 (abgeschrägte Käfig-Ecken): Geometrie, Ball in die Ecke (prallt schräg heraus statt hin und her), harte
// Schüsse in die Ecken bleiben im Käfig (Bande, Ecknetz, Fuge), Spieler bleiben vor der Schräge, Bot-Spiel (Ballkontakte in
// den Ecken, eingeklemmt, Hänger). Aufruf: node tests/node/eckschraege.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { outOfCage } from '../../src/sim/world.js';
import { Rng } from '../../src/sim/rng.js';
import { runProbe, summary } from './n7_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');

// 1) Geometrie
{
  const g = new Game(P, 1), c = g.cage, k = c.rects.filter((R) => R.tag === 'corner'), kn = c.rects.filter((R) => R.tag === 'cornernet');
  check('Vier Eck-Banden und vier Ecknetze', k.length + kn.length, 8, 8, '', 8, `Schenkel ${c.ecke} m`);
  const R = k[0], len = 2 * R.hu;
  check('… Eck-Bande so lang wie die Schräge (Schenkel · √2)', len, c.ecke * Math.SQRT2 - 1e-6, c.ecke * Math.SQRT2 + 1e-6, 'm', c.ecke * Math.SQRT2);
  const g0 = new Game(makeParams('eckschraege=0'), 1);
  check('?eckschraege=0: eckig wie bisher', g0.cage.rects.filter((R) => R.tag === 'corner').length, 0, 0, '', 0);
}
// 2) Flacher Ball diagonal in die Ecke (8 m/s): mit Schräge kommt er in einem Abprall zurück ins Feld, eckig in zwei
function corner(qs, v = 8) {
  const g = new Game(makeParams(qs), 2); g.players.length = 0;
  const b = g.ball, hx = g.cage.hx, hz = g.cage.hz;
  b.place(hx - 5, b.r, hz - 5); b.v.set(v * Math.SQRT1_2, 0, v * Math.SQRT1_2); b.w.set(0, 0, 0); b.contact = true;
  let boards = 0, t = 0, maxS = 0;
  for (let i = 0; i < 3 / DT; i++) {
    g.step([]); for (const e of g.events) if (e.type === 'board') boards++;
    maxS = Math.max(maxS, Math.abs(b.p.x) + Math.abs(b.p.z));
    if (b.v.x < 0 && b.v.z < 0 && !t) t = g.t;
  }
  return { boards, t, maxS, out: Math.hypot(b.p.x - hx, b.p.z - hz) };
}
{
  const a = corner(''), a0 = corner('eckschraege=0');
  check('Ball diagonal in die Ecke: Abpraller an der Bande', a.boards, 1, 1, '×', 1, `eckig: ${a0.boards}×`);
  check('… nach 3 s mindestens doppelt so weit aus der Ecke wie eckig', a.out / a0.out, 2, 99, '×', null, `${a.out.toFixed(1)} m, eckig ${a0.out.toFixed(1)} m`);
  check('… nie hinter der Schräge', a.maxS, 0, new Game(P, 1).cage.hx + new Game(P, 1).cage.hz - new Game(P, 1).cage.ecke, 'm', null);
}
// 3) Harte Schüsse in die Ecken (30–52 m/s, Höhe 0,1–4 m, Drall), 800 Stück: alle bleiben im Käfig
{
  const rng = new Rng(9); let out = 0, nan = 0, hits = 0;
  for (let k = 0; k < 800; k++) {
    const g = new Game(P, 10 + k); g.players.length = 0;
    const b = g.ball, hx = g.cage.hx, hz = g.cage.hz, sx = rng.next() < 0.5 ? -1 : 1, sz = rng.next() < 0.5 ? -1 : 1;
    b.place(rng.range(-4, 4), rng.range(0.11, 1.5), rng.range(-3, 3)); b.contact = false;
    const tx = sx * (hx - rng.range(0, 1.6)), tz = sz * (hz - rng.range(0, 1.6)), ty = rng.range(0.1, 4), sp = rng.range(30, 52);
    const dx = tx - b.p.x, dy = ty - b.p.y, dz = tz - b.p.z, L = Math.hypot(dx, dy, dz);
    b.v.set(dx / L * sp, dy / L * sp + 2, dz / L * sp); b.w.set(rng.range(-60, 60), rng.range(-120, 120), rng.range(-60, 60));
    let hit = false;
    for (let i = 0; i < 2 / DT; i++) {
      g.step([]); for (const e of g.events) if (e.tag === 'corner' || e.tag === 'cornernet') hit = true;
      if (!Number.isFinite(b.p.x)) { nan++; break; }
      if (outOfCage(g.cage, b.p) || Math.abs(b.p.x) + Math.abs(b.p.z) > hx + hz - g.cage.ecke + 0.9) { out++; break; }
    }
    if (hit) hits++;
  }
  check('800 harte Schüsse in die Ecken (30–52 m/s): Ball draußen / hinter der Schräge', out + nan, 0, 0, '×', 0, `${hits} trafen Eck-Bande oder Ecknetz`);
}
// 4) Spieler läuft in die Ecke: bleibt vor der Schräge
{
  const g = new Game(P, 3, { perTeam: [1, 0] }); const pl = g.players[0], c = g.cage;
  pl.place(c.hx - 4, c.hz - 4, 0);
  let m = 0; for (let i = 0; i < 2 / DT; i++) { g.step([{ ...EMPTY_INPUT, mx: Math.SQRT1_2, mz: Math.SQRT1_2 }]); m = Math.max(m, pl.x + pl.z); }
  check('Spieler läuft in die Ecke: Abstand zur Schräge ≥ Körperradius', c.hx + c.hz - c.ecke - m, P.bodyR * Math.SQRT2 - 0.01, 9, 'm', null);
}
// 5) Bot-Spiel Stufe 2 (20 Spiele): Ballkontakte in den Ecken −30 %, eingeklemmt 0, Hänger 0
{
  const s = summary(await runProbe('', 20, 'st2', 4)), s0 = summary(await runProbe('eckschraege=0', 20, 'st2', 4));
  check('Bot-Spiel: Ballkontakte in den Ecken (2,5 × 2,5 m) je Spiel ÷ eckig', s.cornerTouchesPerGame / s0.cornerTouchesPerGame, 0, 0.7, '×', 0.7, `${s.cornerTouchesPerGame.toFixed(1)} / eckig ${s0.cornerTouchesPerGame.toFixed(1)}`);
  check('… Ball in der Ecke eingeklemmt', s.cornerStuck, 0, 0, '×', 0);
  check('… Tore je Schuss', s.goalsPerShot, 25, 35, '%', 30, `eckig ${s0.goalsPerShot.toFixed(1)} %`);
  check('… Hänger / Numerik', s.stuck + s.faults, 0, 0, '', 0);
}
process.exit(report('Abgeschrägte Käfig-Ecken (n7 Vorlagen E5)', rows, 'eckschraege') ? 0 : 1);
