// Torwart (Nacht 2c): Auto-Torwart des Menschen (fängt und hechtet ohne Knöpfe, Stick gewinnt, Abwurf nach 1 s (Nacht 2e; vorher 2 s) ohne
// Eingabe bzw. sofort auf den Pass-Knopf) und schwächere CPU-Tormänner (Stufen monoton, Tore aus Platzierung und
// Tempo, harmlose Roller ≤ 5 %). Aufruf: node tests/node/keeper.test.mjs  (KEEPER_N = Spiele je Stufe, Standard 24)
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { aimAt, spinOf, setKick } from '../../src/sim/kickplan.js';
import { Rng } from '../../src/sim/rng.js';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keeperSeries } from './keeper_series.mjs';
import { report } from './report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const idle = { ...EMPTY_INPUT, passDown: false, shotDown: false };

// Einzelner Mensch (Orange, verteidigt links x = −hx) als letzte Hand, ohne Gegner
function keeperGame(qs = '', seed = 1) {
  const g = new Game(makeParams(qs), seed, { match: true, human: 0, perTeam: [1, 0], kickoffTeam: 0 });
  g.rules.phase = 'play';
  return g;
}
// Schuss aus d m auf (zt, yt) im linken Tor; Ausgang: 'catch' | 'parry' | 'goal' | 'miss'
function shotAt(g, rng, d, zt, yt, v, input = () => idle) {
  const gx = -g.cage.hx, me = g.players[0];
  me.place(gx + 1.0, 0, 0); me.resetHands(); g.rules.phase = 'play'; g.rules.updateKeepers(0, true);
  const z0 = rng.range(-2, 2), from = [gx + d, 0.11, z0];
  g.ball.place(...from); g.ball.held = -1;
  const sol = aimAt(g.P, from, [gx, yt, zt], v, spinOf(0, 0), [-1, 0, 0]);
  setKick(g.ball, sol.dir[0], sol.dir[1], v, sol.el, 0, 0);
  g.lastTouch = -1; g.lastTouchT = g.t;
  let res = 'miss', dive = false;
  for (let i = 0; i < 1.6 / DT && res === 'miss'; i++) {
    for (const e of g.step([input(g, i)])) {
      if (e.type === 'dive') dive = true;
      if (e.type === 'catch') res = 'catch';
      else if (e.type === 'parry') res = 'parry';
      else if (e.type === 'goal') res = 'goal';
    }
  }
  return { res, dive };
}
function series(qs, input) {
  const g = keeperGame(qs), rng = new Rng(7);
  const c = { catch: 0, parry: 0, goal: 0, miss: 0, dive: 0, n: 0 };
  for (let k = 0; k < 40; k++) {
    const zt = (k % 2 ? 1 : -1) * rng.range(0.3, 1.25), yt = rng.next() < 0.5 ? rng.range(0.2, 0.5) : rng.range(0.9, 1.6);
    const r = shotAt(g, rng, rng.range(7, 10), zt, yt, rng.range(14, 20), input);
    c[r.res]++; c.n++; if (r.dive) c.dive++;
  }
  return c;
}

// 1) Auto-Torwart ohne Eingabe hält wie ein Tormann der alten Stufe 2; ohne Automatik (alte Knöpfe, nicht gedrückt)
//    nur, was zufällig auf den Körper kommt
{
  const auto = series('');
  const off = series('autotorwart=0');
  const saved = (c) => (c.catch + c.parry) / c.n * 100;
  check('Auto-Torwart ohne Knopf: gehalten (40 Schüsse 14–20 m/s aus 7–10 m)', saved(auto), 55, 100, '%', null, `gefangen ${auto.catch}, abgewehrt ${auto.parry}, Tore ${auto.goal}, gehechtet ${auto.dive}×`);
  check('… ohne Automatik (?autotorwart=0, kein Knopf)', saved(off), 0, saved(auto) - 25, '%', null, `gefangen ${off.catch}, abgewehrt ${off.parry}, Tore ${off.goal}`);
  check('Auto-Torwart hechtet selbst', auto.dive, 3, Infinity, '×', null);
}
// 2) Stick gewinnt: Mensch läuft deutlich weg (Stick nach +z), der Automat läuft nicht zum Ball
{
  const g = keeperGame(), rng = new Rng(3);
  const me = g.players[0];
  let zEnd = 0;
  const r = shotAt(g, rng, 9, -1.1, 0.3, 15, (gg, i) => { zEnd = me.z; return { ...idle, mx: 0, mz: 1 }; });
  check('Stick gewinnt: Tormann läuft mit dem Stick (Schuss in die andere Ecke)', zEnd, 0.8, Infinity, 'm', null, `Ausgang ${r.res}`);
}
// 3) Ball in der Hand: ohne Eingabe Abwurf nach P.autoWurf (Nacht 2e: 1 s, vorher 2 s), mit Pass-Knopf sofort
{
  // mit freiem Mitspieler: Abwurf nach P.autoWurf
  const g = new Game(makeParams(''), 2, { match: true, human: 0, perTeam: [2, 0], kickoffTeam: 0 });
  g.rules.phase = 'play'; g.players[1].place(-3, 3, 0); g.rules.giveKeeper(0);
  const human = g.rules.keeper[0]; g.setHuman(human);
  let tRel = -1, kind = ''; const tg = g.t;
  for (let i = 0; i < 7 / DT && tRel < 0; i++) for (const e of g.step(Object.assign([], { [human]: idle }))) if ((e.type === 'throw' || e.type === 'punt') && e.player === human) { tRel = g.t - tg; kind = e.type; }
  const AW = g.P.autoWurf;
  check('Ball in der Hand ohne Eingabe, Mitspieler frei: Auto-Torwart wirft ab nach', tRel, AW - 0.05, AW + 0.3, 's', AW, kind === 'throw' ? 'Abwurf zum Mitspieler' : kind);
  const g2 = keeperGame('', 2); g2.rules.giveKeeper(0);
  const t0 = g2.t; let t2 = -1;
  for (let i = 0; i < 2 / DT && t2 < 0; i++) for (const e of g2.step([i === 30 ? { ...idle, throw: true } : idle])) if (e.type === 'throw' && e.player === 0) t2 = g2.t - t0;
  const gT = keeperGame('', 2); gT.rules.giveKeeper(0);
  let tAuto = -1; const t1 = gT.t;
  for (let i = 0; i < 7 / DT && tAuto < 0; i++) for (const e of gT.step([idle])) if ((e.type === 'throw' || e.type === 'punt' || e.type === 'sixsec') && e.player === 0) tAuto = gT.t - t1;
  check('… ohne Mitspieler: Auto-Torwart gibt ab nach', tAuto, AW, AW + 1.1, 's', AW + 1, 'ohne Mitspieler: Abschlag 1 s nach dem Abwurf-Zeitpunkt (Nacht 2e; vorher bis 4,4 s), nie Zwangsabwurf');
  check('… mit Pass-Knopf (Abwurf) sofort', t2, 0.2, 0.3, 's', 0.25, 'Knopf nach 0,25 s');
}
// 4) Harmlose Roller (6–11 m/s, flach, aus 6–10 m) gegen den CPU-Tormann: höchstens 5 % Tore je Stufe
function rollers(K) {
  const g = new Game(makeParams(`tormann=${K}`), 5 + K, { match: true, human: 0, perTeam: [1, 1], botLevels: [2, 2] });
  const rng = new Rng(11 + K), gx = g.cage.hx, sh = g.players[0], kp = g.players[1];
  let goals = 0, n = 0;
  for (let k = 0; k < 40; k++) {
    g.rules.phase = 'play';
    const d = rng.range(6, 10), z0 = rng.range(-3, 3);
    g.ball.place(gx - d, g.ball.r, z0); g.ball.held = -1;
    sh.place(gx - d - 0.5, z0, 0); kp.place(gx - rng.range(0.5, 2), rng.range(-1, 1), Math.PI); kp.resetHands();
    g.rules.updateKeepers(0, true); g.lastTouch = 0; g.lastTouchT = g.t;
    for (let i = 0; i < 1.2 / DT; i++) { g.step([idle]); g.ball.place(gx - d, g.ball.r, z0); }
    const zt = rng.range(-1.3, 1.3), v = rng.range(6, 11), dx = gx - g.ball.p.x, dz = zt - g.ball.p.z, dl = Math.hypot(dx, dz);
    setKick(g.ball, dx / dl, dz / dl, v, 0, -0.3 * v / g.ball.r, 0);
    g.lastTouch = 0; g.lastTouchT = g.t; n++;
    let res = '';
    for (let i = 0; i < 3 / DT && !res; i++) for (const e of g.step([idle])) if (e.type === 'goal') res = 'goal'; else if (e.type === 'catch') res = 'catch';
    if (res === 'goal') goals++;
    g.rules.phase = 'play'; g.ball.held = -1; kp.resetHands();
  }
  return { goals, n };
}
{
  const r = [1, 2, 3].map(rollers);
  check('Harmlose Roller (6–11 m/s, 6–10 m) werden Tor: schwächste Stufe', 100 * r[0].goals / r[0].n, 0, 5, '%', 5, r.map((x, i) => `Stufe ${i + 1}: ${x.goals}/${x.n}`).join(', '));
}
// 5) CPU-Tormann: Tore je Schuss nach Stufe (Mannschaft 0 schießt mit Stufe 2), monoton, Roller
{
  // je Stufe ≥ 20 Spiele (Brief), die drei Stufen parallel in eigenen Prozessen
  // Nacht 2e: zwei Serien (Seeds 100 und 300) je Stufe – eine Serie à 24 Spiele streut um ±2–3 Punkte
  const N = +(process.env.KEEPER_N || 24);
  const runs = await Promise.all([1, 2, 3].flatMap((K) => [100, 300].map((seed) => new Promise((ok, bad) => {
    execFile(process.execPath, [join(here, 'keeper_probe.mjs'), String(N), '', String(K)], { env: { ...process.env, PROBE_JSON: '1', KEEPER_ONLY: '', PROBE_SEED: String(seed) }, maxBuffer: 1 << 24 },
      (err, out) => (err ? bad(err) : ok(JSON.parse(out.trim().split('\n').pop()))));
  }))));
  const r = [0, 1, 2].map((i) => { const a = runs[2 * i], b = runs[2 * i + 1], o = { ...a, bySpeed: {} };
    for (const k of ['shots', 'goals', 'goalsAll', 'catch', 'parry', 'dive', 'rollers', 'rollerGoals', 'onTarget', 'onGoals', 'games']) o[k] = a[k] + b[k];
    for (const x of [a, b]) for (const [k, v] of Object.entries(x.bySpeed)) { const e = o.bySpeed[k] || (o.bySpeed[k] = { n: 0, goals: 0 }); e.n += v.n; e.goals += v.goals; }
    return o; });
  const q = r.map((x) => 100 * x.goalsAll / Math.max(1, x.shots));
  const note = (x) => `${x.goalsAll}/${x.shots}, Fangen ${(x.catch / x.games).toFixed(1)}, Abwehr ${(x.parry / x.games).toFixed(1)} je Spiel`;
  check(`CPU-Tormann Stufe 1: Tore je Schuss (${2 * N} Spiele)`, q[0], 38, 100, '%', 40, note(r[0]));
  check(`CPU-Tormann Stufe 2 (Standard): Tore je Schuss (${2 * N} Spiele)`, q[1], 24, 36, '%', 30, note(r[1]) + ' · Nacht 2b: 14 %, Nacht 2d: 29–31 %');
  check(`CPU-Tormann Stufe 3: Tore je Schuss (${2 * N} Spiele)`, q[2], 0, 26, '%', 25, note(r[2]));
  check('Stufen monoton (1 > 2 > 3)', q[0] > q[1] && q[1] > q[2] ? 1 : 0, 1, 1, '', 1, q.map((x) => x.toFixed(1)).join(' > '));
  const slow = r.reduce((a, x) => [a[0] + (x.bySpeed['<12']?.goals || 0), a[1] + (x.bySpeed['<12']?.n || 0)], [0, 0]);
  // Nacht 2e: nur ~60 solche Schüsse je Lauf – gemessen je Seed mit ?halten=0 (Nacht 2d) 8–16 %, neu 9–17 % → Grenze 18 %
  check('Langsame Schüsse (< 12 m/s, auch Stocherbälle aus 2 m) werden Tor', 100 * slow[0] / Math.max(1, slow[1]), 0, 18, '%', 5, `${slow[0]}/${slow[1]} (alle Stufen), harmlose Roller vom Boden ≥ 5 m: ${r.reduce((a, x) => a + x.rollerGoals, 0)}/${r.reduce((a, x) => a + x.rollers, 0)}`);
}

// 6) Tormann isoliert: feste Eckschuss-Serie (er stellt sich selbst hin). Nacht 2d: Tempo × wucht (21–33 m/s aus 7–11 m,
//    wie die harten Schüsse im Spiel; 14–22 m/s hält jetzt jede Stufe fast alles)
{
  const W = makeParams('').wucht;
  const c = [1, 2, 3].map((K) => keeperSeries(K, 60, '', 14 * W, 22 * W));
  const q = c.map((x) => 100 * x.goal / x.n);
  // (Stufe 2 und 3 halten isoliert fast alles – der Unterschied liegt dann im Fangen statt Abwehren)
  check(`Eckschuss-Serie ${(14 * W).toFixed(0)}–${(22 * W).toFixed(0)} m/s: Tore gegen Tormann 1 / 2 / 3 monoton`, q[0] > q[1] + 10 && q[1] >= q[2] && c[2].catch > c[1].catch ? 1 : 0, 1, 1, '', 1, c.map((x, i) => `Stufe ${i + 1}: ${x.goal}/${x.n} Tore, ${x.catch} gefangen, ${x.parry} abgewehrt`).join(' · '));
}
// 7) Nacht 2d (Peter: „Torwart soll viel mehr hechten“): In der Eckschuss-Serie (14–22 m/s wie Nacht 2c) endet ein Ball,
//    der ≥ 0,8 m neben dem Tormann aufs Tor kommt, zu ≥ 70 % mit einem Hechtsprung – auf jeder Stufe
{
  for (const K of [1, 2, 3]) {
    const c = keeperSeries(K, 120), c0 = keeperSeries(K, 120, 'hechten=0');
    check(`Eckschuss-Serie Stufe ${K}: Ball ≥ 0,8 m neben ihm → Hechtsprung`, 100 * c.wideDive / Math.max(1, c.wide), 70, 100, '%', null, `${c.wideDive}/${c.wide}, alte Hecht-Regel (?hechten=0): ${c0.wideDive}/${c0.wide}; gehechtet gesamt ${c.dive}/${c.n}, davon gehalten ${c.diveSave}`);
  }
  const P = makeParams('');
  check('Hechtsprung: Landung und Aufstehen', P.groundT, 0, 1, 's', null, `Flugphase ${P.diveT}–${P.hechtTMax} s je nach Absprung (bis ${P.hechtVorlauf} s vor dem Ball)`);
}

process.exit(report('Torwart (Auto-Torwart, CPU-Stufen)', rows, 'keeper') ? 0 : 1);
