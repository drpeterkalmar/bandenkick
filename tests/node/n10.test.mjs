// n10 (Peter 02.11.2026: „mehr ballmagnet, schärfere Pässe“): Ballmagnet 2,4 (enger vor den Fuß, schärferes Abschirmen) und
// Pass-Tempo 13,5 m/s gegen 0.7.0 (?magnet=1.8&pass=10.5). Gleiche Seeds vorher/nachher. Aufruf: node tests/node/n10.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { passScharf } from '../../src/sim/kickplan.js';
import { runProbe as botProbe, summary } from './n7_probe.mjs';
import { runProbe as passProbe, summarize } from './pass_probe.mjs';
import { kidDribble } from './dribble_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const ALT = 'magnet=1.8&pass=10.5';
const f = (x, d = 1) => x.toFixed(d).replace('.', ',');

// 1) Regler
{
  const P = makeParams(''), A = makeParams(ALT), M = makeParams('magnet=1.8'), M2 = makeParams('magnet=1.8&schirmVor=0.5');
  check('Standard: Ballmagnet 2,4, Abschirmen 0,6 m, Pass 13,5 m/s', P.magnet === 2.4 && P.schirmVor === 0.6 && P.passSpeed === 13.5 ? 1 : 0, 1, 1, '', 1);
  check('?magnet=1.8 = Ballmagnet wie 0.7.0 (auch schirmVor 0,3), ausdrücklich gesetztes schirmVor bleibt', M.schirmVor === 0.3 && M2.schirmVor === 0.5 ? 1 : 0, 1, 1, '', 1);
  check('?pass=10.5 = Pässe wie 0.7.0 (Schärfe 1)', passScharf(A), 1, 1, '×', 1);
}
// 2) Bot-Selbstspiel (60 Spiele Stufe 2 gegen 2): weniger Ballverluste beim Führen, Grätsche bleibt wirksam
{
  const a = summary(await botProbe(ALT, 60, 'st2', 4)), n = summary(await botProbe('', 60, 'st2', 4));
  check('Bot-Spiel: Ballverluste beim Führen je Minute ÷ 0.7.0', n.lossMin / a.lossMin, 0, 0.95, '×', 0.75, `${f(a.lossMin, 2)} → ${f(n.lossMin, 2)} (Zweikampf ${f(a.duelMin, 2)} → ${f(n.duelMin, 2)}); gemessen mit 160 Spielen −11 %`);
  check('… Grätschen mit Ballgewinn ≥ 70 % von 0.7.0', n.tackleBallPerGame / a.tackleBallPerGame, 0.7, 9, '×', null, `${f(a.tackleBallPerGame)} → ${f(n.tackleBallPerGame)} je Spiel`);
  check('… Bot-Pässe kommen an: höchstens 3 Punkte schlechter', n.passOkShare - a.passOkShare, -3, 99, 'Punkte', 0, `${f(a.passOkShare, 0)} → ${f(n.passOkShare, 0)} %`);
  check('… Hänger / Numerik', n.stuck + n.faults, 0, 0, '', 0);
}
// 3) Pass-Probe (echte Gesten, 80 je Variante): schärfer, kommt mindestens so oft an, Annahme verspringt nicht öfter
{
  const s = (q) => summarize(passProbe(q, 80).flatMap((o) => o.rs));
  const a = s(ALT), n = s('');
  check('Pass-Probe: Abspieltempo p50 ÷ 0.7.0', n.speed50 / a.speed50, 1.1, 1.4, '×', null, `${f(a.speed50)} → ${f(n.speed50)} m/s`);
  check('… kommt beim Gemeinten an: nicht schlechter', n.ok - a.ok, -1, 99, 'Punkte', 0, `${f(a.ok)} → ${f(n.ok)} % (abgefangen ${f(a.abgefangen)} → ${f(n.abgefangen)} %)`);
  check('… Annahme gelingt: nicht schlechter', n.annOk - a.annOk, -2, 99, 'Punkte', 0, `${f(a.annOk)} → ${f(n.annOk)} %`);
}
// 4) Kinder-Stick gegen einen Bot (20 × 60 s): Ball springt nicht öfter weg
{
  const k = (q) => { let s = 0; for (let i = 1; i <= 20; i++) s += kidDribble(q, { seed: i, opp: true }).lost; return s / 20; };
  const a = k(ALT), n = k('');
  check('Kinder-Stick gegen Bot: Ball springt weg je Minute ÷ 0.7.0', n / a, 0, 1.1, '×', null, `${f(a)} → ${f(n)}`);
}

process.exit(report('n10 Ballmagnet und Pässe (gegen 0.7.0)', rows, 'n10') ? 0 : 1);
