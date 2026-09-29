// Training/Challenges (Nacht 2b) headless: jede Challenge endet (untätig und mit Skript-Spieler), der Skript-Spieler
// holt Sterne, Sterne/Bestwert-Logik, Ballmaschine trifft mit echter Physik (ohne Tormann), Torwand zählt nur die
// leuchtende Scheibe, Dribbel-Parcours bestraft verpasste Tore. Aufruf: node tests/node/challenge.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { CHALLENGES, starsFor, challengeDef } from '../../src/sim/challenges.js';
import { playChallenge } from './scripts.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams({});
const fmt = (r) => (r.score == null ? '–' : String(r.score).replace('.', ','));

// 1) Jede Challenge: untätig → endet; Skript-Spieler (2 Seeds) → endet mit ≥ 1 Stern
const table = [];
for (const c of CHALLENGES) {
  const idle = playChallenge(Game, P, c.id, { seed: 1, script: false, maxT: 300 });
  const runs = [1, 2].map((seed) => playChallenge(Game, P, c.id, { seed }));
  const stars = runs.map((r) => r.res.stars);
  check(`${c.name}: untätig endet`, idle.done ? 1 : 0, 1, 1, '', 1, `${fmt(idle.res)} ${c.unit}, ${idle.res.stars} ★ nach ${idle.g.t.toFixed(0)} s`);
  check(`${c.name}: Skript-Spieler holt Sterne`, Math.min(...stars), 1, 3, '★', 3, runs.map((r) => `${fmt(r.res)} ${c.unit} (${r.res.stars} ★, ${r.g.t.toFixed(0)} s)`).join(' / '));
  table.push(`| ${c.icon} ${c.name} | ${c.group === 'torwart' ? 'Torwart' : 'Schütze'} | ${c.attempts} | ${c.stars.join(' / ')} ${c.unit} | ${runs.map((r) => `${fmt(r.res)} (${r.res.stars} ★)`).join(', ')} | ${fmt(idle.res)} (${idle.res.stars} ★) |`);
}
// 2) Sterne-Logik
{
  const tw = challengeDef('torwand'), dr = challengeDef('dribbel');
  const ok = starsFor(tw, 2) === 0 && starsFor(tw, 3) === 1 && starsFor(tw, 7) === 3 && starsFor(dr, 30) === 0 && starsFor(dr, 25) === 1 && starsFor(dr, 14) === 3 && starsFor(dr, null) === 0;
  check('Sterne: Schwellen (mehr/weniger ist besser, kein Ergebnis = 0)', ok ? 1 : 0, 1, 1, '', 1, 'Torwand 3/5/7 Treffer, Dribbel 26/19/15 s');
}
// 3) Ballmaschine (Tormann-Serie) ohne Tormann: echte Physik trifft das Tor – auch Aufsetzer, Bande, Kurve
{
  const g = new Game(P, 4, { challenge: 'tw_serie' });
  const C = g.challenge, me = g.players[0];
  let goals = 0, shots = 0; const kinds = {};
  while (!C.done && g.t < 200) {
    me.place(-2, 6, 0); // Tormann weit weg
    const ev = g.step([EMPTY_INPUT]);
    for (const e of ev) {
      if (e.type === 'machine') { shots++; }
      if (e.type === 'goal') { goals++; kinds[C.s.kind] = (kinds[C.s.kind] || 0) + 1; }
    }
  }
  check('Ballmaschine ohne Tormann: Schüsse gehen ins Tor', goals, shots - 1, shots, `/${shots}`, shots, `Treffer je Art ${JSON.stringify(kinds)}`);
}
// 4) Torwand: nur die leuchtende Scheibe zählt
{
  const g = new Game(P, 2, { challenge: 'torwand' });
  const C = g.challenge;
  while (C.phase !== 'run') g.step([EMPTY_INPUT]);
  const lit = C.targets.find((t) => t.lit), other = C.targets.find((t) => !t.lit);
  // Ball direkt auf die andere Scheibe schießen (als hätte der Mensch geschossen)
  const b = g.ball, from = [b.p.x, b.p.y, b.p.z];
  const dx = other.x - from[0], dz = other.z - from[2], D = Math.hypot(dx, dz);
  b.v.set(dx / D * 20, (other.y - from[1]) / D * 20 + 9.81 * (D / 20) / 2, dz / D * 20); b.contact = false; g.lastTouch = 0; g.lastTouchT = g.t;
  let res = null;
  for (let i = 0; i < 300 && !res; i++) { g.step([EMPTY_INPUT]); if (C.log.length) res = C.log[0]; }
  check('Torwand: andere Scheibe getroffen zählt nicht', res && !res.ok ? 1 : 0, 1, 1, '', 1, `leuchtend ${lit.name}, getroffen: ${res && res.text}`);
}
// 5) Dribbel-Parcours: verpasstes Hütchen-Tor kostet 3 s
{
  const g = new Game(P, 2, { challenge: 'dribbel' });
  const C = g.challenge, me = g.players[0];
  while (C.phase !== 'run') g.step([EMPTY_INPUT]);
  // geradeaus bei z = 0 → alle Hütchen-Tore (z ±1,2–1,6, 1,7 m breit) verfehlt
  let k = 0;
  while (!C.done && g.t < 60) {
    const o = { ...EMPTY_INPUT, mx: 1, mz: -me.z * 0.5 };
    if (me.x > 4 && k === 0) k = g.t;
    g.step([k && g.t - k < 0.5 ? { ...EMPTY_INPUT, shotDown: true, passDown: false } : { ...o, passDown: false, shotDown: false }]);
  }
  const r = C.result();
  check('Dribbel: alle Tore verfehlt → 5 × 3 s Strafe', C.pen, 15, 15, 's', 15, `Zeit ${fmt(r)} s`);
}

const ok = report('Training und Challenges (headless, Skript-Spieler)', rows, 'challenge');
console.log('\n| Challenge | Gruppe | Versuche | Sterne ab | Skript-Spieler (Seed 1, 2) | untätig |\n|---|---|---|---|---|---|\n' + table.join('\n'));
process.exit(ok ? 0 : 1);
