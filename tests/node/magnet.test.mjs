// Ballmagnet (Nacht 2c, ?magnet=; Nacht 2d „viel mehr“: Standard 1,2, Sprint 70 %): vorher/nachher. „Kinderhand“-Führen (Stick wechselt alle 0,5–1,2 s
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
const kid = (qs, opp) => { const r = []; for (let s = 1; s <= 30; s++) r.push(kidDribble(qs, { seed: s, opp })); return { lost: avg(r.map((x) => x.lost)), rev: avg(r.map((x) => x.lostRev)), speed: avg(r.map((x) => x.speed)) }; };
// Nacht 2c = magnet 0,5 / Sprint 0,45 (Referenz für „viel mehr“)
const N2C = 'magnet=0.5&magnetSprint=0.45&magnetSlide=1&tackleBall=0.1&sprintfrei=0&magnetC=20&magnetTurnMin=0.25&abschirmen=0'; // (n7: Nacht 2c hatte noch Sprint)
// n7 Etappe 0 (Peter 14.10.: „besserer Ballbesitz, mehr Magnet“): Referenz n6 = Stand vor Etappe 0
const N6 = 'sprintfrei=0&magnet=1.2&abschirmen=0&magnetTurnMin=0.25&magnetC=20';
const a0 = kid('magnet=0', false), aC = kid(N2C, false), a1 = kid('', false), b0 = kid('magnet=0', true), bC = kid(N2C, true), b1 = kid('', true);
check('Kinderhand allein (30 × 60 s): Ball springt weg (Magnet ÷ ohne)', a1.lost / a0.lost, 0, 0.3, '×', 0.17, `ohne ${a0.lost.toFixed(1)}, Nacht 2c ${aC.lost.toFixed(1)}, jetzt ${a1.lost.toFixed(1)} je Minute, davon ${a1.rev.toFixed(1)} nach einer Kehrtwende (> 150°: dort lässt der Magnet absichtlich los), Tempo mit Ball ${a0.speed.toFixed(2)} → ${a1.speed.toFixed(2)} m/s`);
check('… gegenüber Nacht 2c (Magnet 0,5): Ball springt weg', a1.lost / aC.lost, 0, 0.6, '×', 0.5, `${aC.lost.toFixed(1)} → ${a1.lost.toFixed(1)} je Minute`);
check('… ohne Kehrtwenden: Ball springt weg je Minute', a1.lost - a1.rev, 0, 3, '/min', null, `Nacht 2c ${(aC.lost - aC.rev).toFixed(1)}, ohne Magnet ${(a0.lost - a0.rev).toFixed(1)}`);
check('Kinderhand allein: Tempo mit Ball höher', a1.speed - a0.speed, 0.1, 9, 'm/s', null);
check('Kinderhand gegen Bot (Stufe 2): Ball springt weg je Minute', b1.lost, 0, 9, '/min', null, `ohne ${b0.lost.toFixed(1)}, Nacht 2c ${bC.lost.toFixed(1)}, jetzt ${b1.lost.toFixed(1)} je Minute (Ziel ≤ 9)`);

// 2) Dribbel-Parcours (n7: Skript-Parcours nicht langsamer als n6, 0 Verluste)
{
  const r6 = parcours(N6, [1, 2, 3, 4, 5, 6]), r1 = parcours('', [1, 2, 3, 4, 5, 6]);
  const t6 = avg(r6.map((x) => x.time)), t1 = avg(r1.map((x) => x.time));
  check('Dribbel-Parcours Skript: nicht langsamer als n6 (inkl. Strafsekunden)', t1, 0, t6 + 0.2, 's', null, `n6 ${t6.toFixed(2)} s, jetzt ${t1.toFixed(2)} s`);
  check('… Ballverluste im Parcours', r1.reduce((s, x) => s + x.lost, 0), 0, 0, '', 0);
}
// (das vorsichtige Challenge-Skript lenkt nie mehr als 30° neben den Ball und verpasst im Slalom 2–3 Tore → nur Info)
const pt = (qs, naive, sprint = false) => { const r = parcours(qs, [1, 2, 3, 4, 5, 6], naive, sprint); return { t: avg(r.map((x) => x.time)), lost: r.reduce((s, x) => s + x.lost, 0), pen: r.reduce((s, x) => s + +(x.pen || 0), 0) }; };
const p0 = pt('magnet=0', false), p1 = pt('', false), k0 = pt('magnet=0', true), k1 = pt('', true), s0 = pt('magnet=0', true, true), s1 = pt('', true, true);
check('Dribbel-Parcours, Kinderhand (direkt aufs Tor): Zeit mit Magnet nicht langsamer', k1.t, 0, k0.t + 0.3, 's', null, `ohne ${k0.t.toFixed(2)} s (${k0.lost} Ballverluste), mit ${k1.t.toFixed(2)} s (${k1.lost})`);
check('… im Sprint: Zeit inkl. Strafsekunden (Info)', s1.t, 0, Infinity, 's', null, `ohne ${s0.t.toFixed(2)} s (${s0.lost} Verluste, ${s0.pen} s Strafe), mit ${s1.t.toFixed(2)} s (${s1.lost}, ${s1.pen} s)`);
check('… Challenge-Skript (Info)', p1.t, 0, Infinity, 's', null, `ohne ${p0.t.toFixed(2)} s (${p0.pen} s Strafe), mit ${p1.t.toFixed(2)} s (${p1.pen} s Strafe)`);

// 3) Selbstspiel: Ballverluste beim Führen – Zweikämpfe bleiben möglich
{
  // Nacht 2c und jetzt je 48 Spiele (Grätschen mit Ballgewinn schwanken mit 24 Spielen um ±10 %)
  const r0 = dribbleLosses('magnet=0', 24), rC = dribbleLosses(N2C, 48), r6 = dribbleLosses(N6, 48), r1 = dribbleLosses('', 48);
  const l0 = r0.losses / r0.minutes, l1 = r1.losses / r1.minutes, l6 = r6.losses / r6.minutes;
  // n7 Etappe 0: Ballverluste beim Führen ≤ 2,3 je Minute (Zweikampf ≤ 2,1; n6: 3,8), Grätsche bleibt das Mittel zum Ballgewinn
  check('Selbstspiel: Ballverluste beim Führen je Minute (n7-Ziel ≤ 2,3)', l1, 0.5, 2.3, '/min', null, `ohne Magnet ${l0.toFixed(2)} (Zweikampf ${(r0.duel / r0.minutes).toFixed(2)}), n6 ${l6.toFixed(2)} (${(r6.duel / r6.minutes).toFixed(2)}, verspringt ${(r6.free / r6.minutes).toFixed(2)}), jetzt ${l1.toFixed(2)} (${(r1.duel / r1.minutes).toFixed(2)}, ${(r1.free / r1.minutes).toFixed(2)})`);
  check('… davon im Zweikampf (n7-Ziel ≤ 2,1)', r1.duel / r1.minutes, 0, 2.1, '/min', null, `Nacht 2c ${(rC.duel / rC.minutes).toFixed(2)}, n6 ${(r6.duel / r6.minutes).toFixed(2)}`);
  check('… Ball am Fuß je Minute mehr als n6', r1.dribbleT / r1.minutes - r6.dribbleT / r6.minutes, 0.5, Infinity, 's', null, `n6 ${(r6.dribbleT / r6.minutes).toFixed(1)} → jetzt ${(r1.dribbleT / r1.minutes).toFixed(1)} s je Minute (Ziel ≥ 5)`);
  check('… Grätschen mit Ballgewinn je Spiel (nicht seltener als n6)', r1.tackleBall / r1.games, r6.tackleBall / r6.games * 0.9, Infinity, '', null, `Nacht 2c ${(rC.tackleBall / rC.games).toFixed(1)}, n6 ${(r6.tackleBall / r6.games).toFixed(1)}, jetzt ${(r1.tackleBall / r1.games).toFixed(1)} (Treffer gesamt ${(r6.tackles / r6.games).toFixed(1)} → ${(r1.tackles / r1.games).toFixed(1)}); je 48 Spiele`);
  // (seit der Grätsche nur noch ~0,1 je Minute – zu selten für ein Gate, deshalb Info)
  check('Selbstspiel: verspringende Bälle ohne Zweikampf (Info)', r1.free / r1.minutes, 0, Infinity, '/min', null, `ohne Magnet ${(r0.free / r0.minutes).toFixed(2)} je Minute`);
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
  check('Magnetstärke im Lauf = Regler', base, g.P.magnet - 0.01, g.P.magnet + 0.01, '', g.P.magnet);
  check('… im Sprint schwächer (Nacht 2d: 70 %)', spr / base, 0.6, 0.8, '×', 0.7);
  check('… bei scharfem Richtungswechsel (115°) schwächer, n7 milder (bis 120° auf 50 %)', turn / base, 0.45, 0.6, '×', 0.5);
  check('… Gegner 0,3 m am Ball: schwächer', near / base, 0, 0.6, '×', 0.5);
  check('… gilt auch für Bots (gleiche Spieler-Physik)', op.magnetStrength(g, false, 0, 0) > 0 ? 1 : 0, 1, 1, '', 1);
  const g0 = new Game(makeParams('magnet=0'), 1);
  check('?magnet=0: aus', g0.players[0].magnetStrength(g0, true, 1, 0), 0, 0, '', 0);
}

process.exit(report('Ballmagnet (vorher/nachher)', rows, 'magnet') ? 0 : 1);
