// n7 Vorlagen E4 (Kinder-Steuerung): Stick-Ruhe (Zittern geglättet, größere Richtungswechsel und Kehrtwenden sofort, Zielen mit
// dem ungefilterten Stick) und Wechsel-Glättung (nach dem Spielerwechsel halb Schwung, in 0,3 s ganz Stick); Kinderhand-Führen
// mit/ohne. Aufruf: node tests/node/kinderstick.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { kidDribble } from './dribble_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const deg = (x, z) => Math.atan2(z, x) * 180 / Math.PI;
const game = (qs = '') => { const g = new Game(makeParams(qs), 1, { match: true, human: 0, perTeam: [2, 1], bots: false }); g.rules.phase = 'play'; g.switchT = 5; return g; };

// 1) Stick-Ruhe (nur mit ?stickruhe=0.1, Standard aus): Zittern ±8° um 0° (Daumen) – gefilterte Richtung schwankt weniger
{
  const g = game('stickruhe=0.1'), g0 = game('stickruhe=0');
  let s = 0, s0 = 0, n = 0;
  for (let i = 0; i < 240; i++) {
    const a = (i % 6 < 3 ? 1 : -1) * 8 * Math.PI / 180, inp = { ...EMPTY_INPUT, mx: Math.cos(a), mz: Math.sin(a) };
    const o = g.kinderStick(inp), o0 = g0.kinderStick(inp);
    if (i > 30) { s += deg(o.mx, o.mz) ** 2; s0 += deg(o0.mx, o0.mz) ** 2; n++; }
    g.t += DT; g0.t += DT;
  }
  check('?stickruhe=0.1: Zittern ±8° → Schwankung der Laufrichtung', Math.sqrt(s / n), 0, 4, '°', null, `ohne ${Math.sqrt(s0 / n).toFixed(1)}°`);
}
// 2) Größere Richtungswechsel und Kehrtwenden sofort, Stärke ungefiltert, Zielen mit dem rohen Stick
{
  const g = game('stickruhe=0.1');
  for (let i = 0; i < 30; i++) g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  const t45 = g.kinderStick({ ...EMPTY_INPUT, mx: Math.SQRT1_2, mz: Math.SQRT1_2 });
  check('… 45°-Richtungswechsel geht sofort durch', deg(t45.mx, t45.mz), 44.9, 45.1, '°', 45);
  for (let i = 0; i < 30; i++) g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  const k = g.kinderStick({ ...EMPTY_INPUT, mx: -0.6, mz: 0 });
  check('… Kehrtwende sofort, Stärke bleibt', k.mx, -0.601, -0.599, '', -0.6);
  for (let i = 0; i < 30; i++) g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  const a = 6 * Math.PI / 180, sm = g.kinderStick({ ...EMPTY_INPUT, mx: Math.cos(a), mz: Math.sin(a) });
  check('… 6°-Zucken wird geglättet (Laufrichtung)', deg(sm.mx, sm.mz), 0.1, 3, '°', null);
  check('… gezielt wird mit dem rohen Stick', deg(sm.zielX, sm.zielZ), 5.9, 6.1, '°', 6);
}
// 3) Wechsel-Glättung: neuer Spieler läuft mit 6 m/s nach +z, Stick zeigt nach +x
{
  const g = game();
  const m = g.players[1]; m.vx = 0; m.vz = 6; m.speed = 6;
  g.setHuman(1);
  const o = g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  check('Wechsel: im ersten Takt halb Schwung, halb Stick', deg(o.mx, o.mz), 40, 50, '°', 45, `Eingabe (${o.mx.toFixed(2)}, ${o.mz.toFixed(2)})`);
  g.switchT = 0.15; const h = g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  check('… nach 0,15 s überwiegt der Stick', deg(h.mx, h.mz), 15, 35, '°', 26.6);
  g.switchT = 0.31; const f = g.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  check('… nach 0,3 s ganz Stick', deg(f.mx, f.mz), -0.1, 0.1, '°', 0);
  const g0 = game('wechselGlatt=0'); g0.players[1].vz = 6; g0.setHuman(1);
  const o0 = g0.kinderStick({ ...EMPTY_INPUT, mx: 1, mz: 0 });
  check('?wechselGlatt=0: sofort ganz Stick', deg(o0.mx, o0.mz), -0.1, 0.1, '°', 0);
  const gx = game('stickruhe=0&wechselGlatt=0'), raw = { ...EMPTY_INPUT, mx: 0.3, mz: 0.7 };
  check('Beide Regler 0: Eingabe unverändert', gx.kinderStick(raw) === raw ? 1 : 0, 1, 1, '', 1);
}
// 4) Kinderhand-Führen (60 × 60 s, allein und gegen einen Stufe-2-Bot): Standard (nur Wechsel-Glättung) nicht schlechter als
// ohne; die Werte mit ?stickruhe=0.1 stehen im Hinweis (Messung: kein Nutzen, deshalb Standard aus)
{
  const run = (qs) => { let a = 0, b = 0, v = 0; const N = 60; for (let s = 1; s <= N; s++) { const r = kidDribble(qs, { seed: s }); a += r.lost / N; v += r.speed / N; b += kidDribble(qs, { seed: s, opp: true }).lost / N; } return { a, b, v }; };
  const on = run(''), off = run('stickruhe=0&wechselGlatt=0'), sr = run('stickruhe=0.1');
  check('Kinderhand allein: Ball weg je Minute', on.a, 0, 3.5, '/min', 3.5, `ohne E4 ${off.a.toFixed(2)}, mit ?stickruhe=0.1 ${sr.a.toFixed(2)} (Datenblatt-Ziel ≤ 3,5, n6: 4,9)`);
  check('Kinderhand gegen Bot: Ball weg je Minute', on.b, 0, off.b + 0.3, '/min', null, `ohne E4 ${off.b.toFixed(2)}, mit ?stickruhe=0.1 ${sr.b.toFixed(2)}`);
  check('Kinderhand: Tempo mit Ball', on.v - off.v, -0.1, 9, 'm/s', null, `${off.v.toFixed(2)} → ${on.v.toFixed(2)} m/s, mit ?stickruhe=0.1 ${sr.v.toFixed(2)}`);
}
process.exit(report('Kinder-Steuerung (n7 Vorlagen E4)', rows, 'kinderstick') ? 0 : 1);
