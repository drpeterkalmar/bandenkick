// n6 Action-Momente live: Verlauf (Speed-Ramp ≤ 1,2 s, Bullet-Time ≤ 1,45 s mit Pause, Blitz < 120 ms, „Blitze
// reduzieren“), Häufigkeit in ganzen Bot-Spielen je Stufe (selten/oft), Abkühlzeit ≥ 8 s, Sicherheitsregel (Gegner am Ball
// vor dem eigenen Tor → kein Moment) und: die Regie liest nur – die Simulation bleibt gleich.
// Aufruf: node tests/node/action.test.mjs
import { createHash } from 'node:crypto';
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { ActionRegie, verlauf, unsicher, AKTION } from '../../src/sim/action.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit = '', target = null, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');
const lcg = (s) => () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);

// 1) Verlauf
for (const art of ['ramp', 'bullet']) {
  let t = 0, dauer = 0, minR = 9, maxR = 0, pause = 0, flash = 0, spiel = 0;
  while (t < 3) { const v = verlauf(art, t); if (v.ende) { dauer = t; break; } minR = Math.min(minR, v.rate); maxR = Math.max(maxR, v.rate); if (v.rate === 0) pause += 0.001; if (v.flash > 0.001) flash += 0.001; spiel += v.rate * 0.001; t += 0.001; }
  check(`${art}: Dauer`, dauer, 0.5, art === 'ramp' ? 1.2 : 1.5, 's', art === 'ramp' ? '≤ 1,2' : '≤ 1,5');
  check(`${art}: langsamstes Tempo`, minR, 0, art === 'ramp' ? 0.15 : 0.05, '×', art === 'ramp' ? '≈ 0,1' : '0 (Pause)', `schnellstes ${maxR.toFixed(2)} ×, Spielzeit im Moment ${spiel.toFixed(2)} s`);
  if (art === 'bullet') check('bullet: Zeit steht (Pause)', pause, 0.9, 1.3, 's', '≈ 1,1');
  check(`${art}: Weißblitz kürzer als 120 ms`, flash * 1000, 1, 119, 'ms', '< 120');
  let sanft = true; for (let x = 0; x < 1.5; x += 0.002) { const v = verlauf(art, x, true); if (v.flash > 0.2 || v.ca > 0) sanft = false; }
  check(`${art}: „Blitze reduzieren“ (kein Blitz, kein RGB-Versatz)`, sanft ? 1 : 0, 1, 1);
}

// 2) Häufigkeit in ganzen Bot-Spielen, Abkühlzeit, Simulation unverändert
const hash = (g) => createHash('sha1').update(JSON.stringify({ s: g.snapshot(), tick: g.tick })).digest('hex').slice(0, 12);
const stat = {};
let abkOk = true, hashOk = true;
for (const stufe of ['selten', 'oft']) {
  const z = [], gruende = {}, arten = { ramp: 0, bullet: 0 };
  for (const seed of [3, 7, 11]) {
    const g = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] }), A = new ActionRegie(stufe, lcg(seed * 31));
    let nachTor = -1e9, steps = 0, last = -1e9;
    while (g.rules.phase !== 'end' && g.t < 900) {
      const ev = g.step([]); steps++;
      if (ev.some((e) => e.type === 'goal')) nachTor = g.t;
      const m = g.t - nachTor > 3 ? A.pruefe(ev, g) : null;
      if (m) { if (g.t - last < AKTION.abkuehl - 1e-6) abkOk = false; last = g.t; arten[m.art]++; gruende[m.grund] = (gruende[m.grund] || 0) + 1; }
      // Moment im Zeitraffer abspielen (Echtzeit 1/60 s je Takt reicht für die Regie)
      if (A.moment) A.bild(1 / 60);
    }
    z.push({ n: A.zahl, min: g.t / 60 });
    if (seed === 3 && stufe === 'selten') {
      const twin = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] });
      for (let i = 0; i < steps; i++) twin.step([]);
      if (hash(twin) !== hash(g)) hashOk = false;
    }
  }
  const proSpiel = z.reduce((a, x) => a + x.n, 0) / z.length, proMin = z.reduce((a, x) => a + x.n, 0) / z.reduce((a, x) => a + x.min, 0);
  stat[stufe] = { proSpiel, proMin, gruende, arten };
  check(`Häufigkeit „${stufe}“ je Bot-Spiel (2 × 4 min)`, proSpiel, stufe === 'selten' ? 1 : 3, stufe === 'selten' ? 8 : 25, '', stufe === 'selten' ? '2–6' : 'mehr',
    `${proMin.toFixed(2)} je Spielminute; ${z.map((x) => x.n).join('/')} in 3 Spielen; Bullet-Time ${arten.bullet}, Ramp ${arten.ramp}; ${Object.entries(gruende).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
check('„oft“ häufiger als „selten“', stat.oft.proSpiel - stat.selten.proSpiel, 0.5, 99);
check('Abkühlzeit ≥ 8 s Spielzeit eingehalten', abkOk ? 1 : 0, 1, 1);
check('Simulation unverändert (Regie liest nur, Hash = Zwilling ohne Regie)', hashOk ? 1 : 0, 1, 1);

// 3) Sicherheitsregel: Gegner mit Ball dicht vor dem Tor des Menschen → kein Moment
{
  const g = new Game(P, 5, { match: true, human: 1, botLevels: [2, 2] });
  const me = g.players[1], ownX = g.rules.goalX(me.team), sx = Math.sign(ownX);
  const opp = g.players.find((p) => p.team !== me.team);
  opp.place(ownX - sx * 5, 0.5, 0); g.ball.place(ownX - sx * 4.4, g.ball.r, 0.5); g.ball.v.set(0, 0, 0);
  const u1 = unsicher(g);
  g.ball.place(-ownX * 0.8, g.ball.r, 0); opp.place(-ownX * 0.8 + 0.5, 0, 0);
  const u2 = unsicher(g);
  const A = new ActionRegie('oft', () => 0);
  opp.place(ownX - sx * 5, 0.5, 0); g.ball.place(ownX - sx * 4.4, g.ball.r, 0.5);
  const m = A.pruefe([{ type: 'tackle', phase: 'hit', result: 'ball', player: opp.id, x: opp.x, z: opp.z }], g);
  check('Sicherheitsregel: Gegner am Ball vor dem eigenen Tor → unsicher, kein Moment', u1 && !u2 && !m ? 1 : 0, 1, 1, '', 1, `vor dem Tor ${u1}, vor dem Gegnertor ${u2}`);
}

process.exit(report('Action-Momente (n6)', rows, 'action') ? 0 : 1);
