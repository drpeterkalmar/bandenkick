// Ballmagnet (Nacht 2c, ?magnet=, Standard 0,5): vorher/nachher. „Kinderhand“-Führen (Stick wechselt alle 0,5–1,2 s
// die Richtung, zittert): Ball springt weg je Minute, allein und gegen einen Bot; Dribbel-Parcours (Skript und
// Kinderhand); Selbstspiel: Ballverluste beim Führen je Minute (Tackles bleiben möglich). Dazu die Regeln: schwächer im
// Sprint, bei scharfen Richtungswechseln und mit Gegner < 1 m; gilt für alle Spieler. Aufruf: node tests/node/magnet.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { kidDribble, parcours, dribbleLosses } from './dribble_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

// 1) Kinderhand-Führen
const kid = (qs, opp) => { const r = []; for (let s = 1; s <= 30; s++) r.push(kidDribble(qs, { seed: s, opp })); return { lost: avg(r.map((x) => x.lost)), speed: avg(r.map((x) => x.speed)) }; };
const a0 = kid('magnet=0', false), a1 = kid('', false), b0 = kid('magnet=0', true), b1 = kid('', true);
check('Kinderhand allein (30 × 60 s): Ball springt weg (Magnet ÷ ohne)', a1.lost / a0.lost, 0, 0.65, '×', 0.5, `${a0.lost.toFixed(1)} → ${a1.lost.toFixed(1)} je Minute, Tempo mit Ball ${a0.speed.toFixed(2)} → ${a1.speed.toFixed(2)} m/s`);
check('Kinderhand allein: Tempo mit Ball höher', a1.speed - a0.speed, 0.1, 9, 'm/s', null);
check('Kinderhand gegen Bot (Stufe 2): Ball springt weg (Magnet ÷ ohne)', b1.lost / b0.lost, 0, 0.85, '×', null, `${b0.lost.toFixed(1)} → ${b1.lost.toFixed(1)} je Minute`);

// 2) Dribbel-Parcours
// (das vorsichtige Challenge-Skript lenkt nie mehr als 30° neben den Ball und verpasst im Slalom 2–3 Tore → nur Info)
const pt = (qs, naive, sprint = false) => { const r = parcours(qs, [1, 2, 3, 4, 5, 6], naive, sprint); return { t: avg(r.map((x) => x.time)), lost: r.reduce((s, x) => s + x.lost, 0), pen: r.reduce((s, x) => s + +(x.pen || 0), 0) }; };
const p0 = pt('magnet=0', false), p1 = pt('', false), k0 = pt('magnet=0', true), k1 = pt('', true), s0 = pt('magnet=0', true, true), s1 = pt('', true, true);
check('Dribbel-Parcours, Kinderhand (direkt aufs Tor): Zeit mit Magnet nicht langsamer', k1.t, 0, k0.t + 0.3, 's', null, `ohne ${k0.t.toFixed(2)} s (${k0.lost} Ballverluste), mit ${k1.t.toFixed(2)} s (${k1.lost})`);
check('… im Sprint: Zeit inkl. Strafsekunden (Info)', s1.t, 0, Infinity, 's', null, `ohne ${s0.t.toFixed(2)} s (${s0.lost} Verluste, ${s0.pen} s Strafe), mit ${s1.t.toFixed(2)} s (${s1.lost}, ${s1.pen} s)`);
check('… Challenge-Skript (Info)', p1.t, 0, Infinity, 's', null, `ohne ${p0.t.toFixed(2)} s (${p0.pen} s Strafe), mit ${p1.t.toFixed(2)} s (${p1.pen} s Strafe)`);

// 3) Selbstspiel: Ballverluste beim Führen – Zweikämpfe bleiben möglich
{
  const r0 = dribbleLosses('magnet=0', 24), r1 = dribbleLosses('', 24);
  const l0 = r0.losses / r0.minutes, l1 = r1.losses / r1.minutes;
  check('Selbstspiel: Ballverluste beim Führen je Minute (Zweikämpfe bleiben möglich)', l1, 0.5, l0 * 1.05, '/min', null, `ohne Magnet ${l0.toFixed(2)} (Zweikampf ${(r0.duel / r0.minutes).toFixed(2)}, verspringt ${(r0.free / r0.minutes).toFixed(2)}), mit ${l1.toFixed(2)} (${(r1.duel / r1.minutes).toFixed(2)}, ${(r1.free / r1.minutes).toFixed(2)}); Ball am Fuß ${(r0.dribbleT / r0.minutes).toFixed(1)} → ${(r1.dribbleT / r1.minutes).toFixed(1)} s je Minute`);
  check('Selbstspiel: verspringende Bälle (ohne Zweikampf) seltener', r1.free / r1.minutes, 0, r0.free / r0.minutes * 0.85, '/min', null);
}

// 4) Regeln der Stärke: Sprint, Richtungswechsel, Gegner nah; alle Spieler
{
  const g = new Game(makeParams(''), 1, { match: true, perTeam: [1, 1], human: 0, bots: false });
  const pl = g.players[0], op = g.players[1];
  pl.place(0, 0, 0); pl.vx = 5; pl.speed = 5; pl.hx = 1; pl.hz = 0; g.ball.place(0.6, 0.11, 0); op.place(6, 3, Math.PI);
  const base = pl.magnetStrength(g, true, 1, 0);
  pl.sprinting = true; const spr = pl.magnetStrength(g, true, 1, 0); pl.sprinting = false;
  const turn = pl.magnetStrength(g, true, Math.cos(2), Math.sin(2));
  op.place(0.9, 0.3, Math.PI); const near = pl.magnetStrength(g, true, 1, 0);
  check('Magnetstärke im Lauf = Regler', base, 0.49, 0.51, '', 0.5);
  check('… im Sprint schwächer', spr / base, 0, 0.6, '×', 0.45);
  check('… bei scharfem Richtungswechsel (115°) schwächer', turn / base, 0, 0.4, '×', null);
  check('… Gegner 0,3 m am Ball: schwächer', near / base, 0, 0.6, '×', 0.5);
  check('… gilt auch für Bots (gleiche Spieler-Physik)', op.magnetStrength(g, false, 0, 0) > 0 ? 1 : 0, 1, 1, '', 1);
  const g0 = new Game(makeParams('magnet=0'), 1);
  check('?magnet=0: aus', g0.players[0].magnetStrength(g0, true, 1, 0), 0, 0, '', 0);
}

process.exit(report('Ballmagnet (vorher/nachher)', rows, 'magnet') ? 0 : 1);
