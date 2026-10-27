// n7 Vorlagen E3: Traumpass → Direktabnahme und Geben und Gehen. Reine Wertung (frei, Schussweg, Passweg, Abstand),
// Direktabnahme-Bonus (Qualität, Tempo), Lauf des Passgebers, Bot-Spiel mit Messgrößen aus dem Datenblatt.
// Aufruf: node tests/node/traumpass.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { perfektWertung, perfektPass } from '../../src/sim/perfekt.js';
import { planShot } from '../../src/sim/shot.js';
import { runProbe, summary } from './n7_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };

// Lage: Mannschaft 0 greift nach +x an. Passgeber 0 bei (hx − 12, 0), Empfänger 1 trifft den Ball bei (hx − 5, 2),
// Gegner 3 (Tormann) im Tor, Gegner 4/5 je nach Fall
function lage(qs, opp = [[-8, -5], [-8, 5]], kp = null) {
  const g = new Game(makeParams(qs), 3, { match: true, human: -1, perTeam: [3, 3], botLevels: [2, 2] });
  g.rules.phase = 'play';
  const hx = g.cage.hx, P = g.players;
  P[0].place(hx - 12.4, 0, 0); P[1].place(hx - 6, 2, 0); P[2].place(-hx + 1, 0, 0);
  P[3].place(kp ? kp[0] : hx - 0.8, kp ? kp[1] : 0, Math.PI); P[4].place(opp[0][0], opp[0][1], Math.PI); P[5].place(opp[1][0], opp[1][1], Math.PI);
  g.ball.place(hx - 12, g.ball.r, 0);
  g.rules.updateKeepers(0, true);
  return g;
}
{
  const hx = new Game(makeParams(''), 1, { match: true, human: -1, perTeam: [1, 1] }).cage.hx;
  const w = (g, mx = hx - 5, mz = 2) => perfektWertung(g, g.players[0], g.players[1], g.ball.p.x, g.ball.p.z, mx, mz);
  const a = w(lage(''));
  check('Empfänger 5 m vor dem Tor, frei, Wege frei → Traumpass', a.ok ? 1 : 0, 1, 1, '', 1, `Wertung ${a.w.toFixed(2)}, Abstand ${a.D.toFixed(1)} m`);
  check('… Gegner 1 m neben dem Treffpunkt → nein', w(lage('', [[hx - 5, 3], [-8, 5]])).ok ? 1 : 0, 0, 0, '', 0);
  check('… Gegner im Schussweg → nein', w(lage('', [[hx - 2.5, 1], [-8, 5]])).ok ? 1 : 0, 0, 0, '', 0);
  check('… Tormann steht im Passweg → nein', w(lage('', undefined, [hx - 8.5, 1.2])).ok ? 1 : 0, 0, 0, '', 0);
  check('… Treffpunkt 9 m vor dem Tor → nein', w(lage(''), hx - 9, 1).ok ? 1 : 0, 0, 0, '', 0);
  check('… ?perfekt=0: kein Ereignis', (() => { const g = lage('perfekt=0'); perfektPass(g, g.players[0], { kind: 'pass', to: 1, meet: [hx - 5, 2], T: 0.6 }, g.ball.p.x, g.ball.p.z); return g.events.some((e) => e.type === 'perfektpass') ? 1 : 0; })(), 0, 0, '', 0);

  // Direktabnahme: gleicher Schuss mit und ohne laufenden Traumpass
  const shotPlan = (pf) => {
    const g = lage('');
    const r = g.players[1]; r.place(hx - 5.2, 2.6, -1.0); g.ball.place(hx - 5, g.ball.r, 2.2); // (Körper schräg weg vom Tor: q < 1)
    g.lastTouch = 0; g.lastTouchT = g.t;
    if (pf) { perfektPass(g, g.players[0], { kind: 'pass', to: 1, meet: [hx - 5, 2], T: 0.6 }, hx - 12, 0); }
    // (qMul: Lage künstlich schlechter, sonst ist q schon 1)
    return { plan: planShot(g, r, { mode: 'std', power: 0.8, qMul: 0.5 }), ev: g.events.some((e) => e.type === 'perfektpass'), g };
  };
  const o = shotPlan(false), p = shotPlan(true);
  check('Traumpass-Ereignis gemeldet', p.ev ? 1 : 0, 1, 1, '', 1);
  check('Direktabnahme: Qualität + perfektQ', p.plan.q - o.plan.q, 0.05, p.g.P.perfektQ + 1e-6, '', p.g.P.perfektQ, `${o.plan.q.toFixed(2)} → ${p.plan.q.toFixed(2)}`);
  check('… Schuss härter', p.plan.speed / o.plan.speed, 1.08, 1.6, '×', null, `${(o.plan.speed * 3.6).toFixed(0)} → ${(p.plan.speed * 3.6).toFixed(0)} km/h`);
  check('… Bonus nur einmal (Traumpass verbraucht)', p.g.perfekt && p.g.perfekt.used ? 1 : 0, 1, 1, '', 1);
}

// Geben und Gehen: Bot 0 spielt zu Bot 1, danach läuft er Richtung Tor (Vergleich ?gebengehen=0)
function lauf(qs) {
  const g = lage(qs, [[-6, -5], [-6, 5]]);
  const hx = g.cage.hx, a = g.players[0], m = g.players[1];
  a.place(hx - 14, -1, 0); m.place(hx - 9, 3, 0); g.ball.place(hx - 13.6, g.ball.r, -1);
  g.lastTouch = 0; g.lastTouchT = g.t; a.lastTouchT = g.t;
  a.kickAt({ kind: 'pass', lead: true, to: 1, noise: 0 });
  const x0 = a.x, tr = []; let gg = 0, kicked = false;
  for (let i = 0; i < 2.5 / DT; i++) { for (const e of g.step([])) { if (e.type === 'gebengehen' && e.player === 0) gg++; if (e.type === 'kick' && e.player === 0) kicked = true; } tr.push(a.x - x0); }
  return { dx: a.x - x0, gg, kicked, tr };
}
{
  const on = lauf(''), off = lauf('gebengehen=0');
  check('Geben und Gehen: Passgeber startet einen Lauf', on.gg, 1, 1, '', 1, on.kicked ? '' : 'Pass nicht gespielt!');
  check('… läuft in 2,5 s nach vorn', on.dx, 4, 20, 'm', null, `?gebengehen=0: ${off.dx.toFixed(1)} m`);
  // n8: mit 7 m/s ist der Lauf (Ziel 4,5–7,5 m vor ihm) nach ≈ 2 s am Ziel, ohne Geben und Gehen holt er bis 2,5 s auf – gemessen
  // wird deshalb der größte Vorsprung während der 2,5 s (n7: am Ende 2,0 m)
  const lead = Math.max(...on.tr.map((x, i) => x - off.tr[i]));
  check('… deutlich weiter als ohne (größter Vorsprung in 2,5 s)', lead, 2, 20, 'm', null, `nach 2,5 s ${(on.dx - off.dx).toFixed(1)} m`);
}

// Bot-Spiel Stufe 2 (20 Spiele): Datenblatt-Messgrößen 8 und 9
{
  const s = summary(await runProbe('', 20, 'st2', 6)), s0 = summary(await runProbe('perfekt=0&gebengehen=0', 20, 'st2', 6));
  check('Bot-Spiel: Traumpässe je Spiel', s.perfektPerGame, 2, 5, '', null, `direkt abgenommen ${s.perfektShotShare.toFixed(0)} %`);
  check('… Tore nach Traumpass', s.perfektGoalShare, 30, 65, '%', 45, 'Datenblatt 40–55 % (kleine Stichprobe, ± 8 Punkte je 20 Spiele)');
  check('… Geben und Gehen (Anteil der Pässe ≥ 4 m)', s.ggShare, 27, 50, '%', 35, `ohne: ${s0.ggShare.toFixed(0)} %`);
  check('… Doppelpässe je Spiel', s.doublesPerGame, 3, Infinity, '', null, `ohne: ${s0.doublesPerGame.toFixed(1)}`);
  check('… Bot-Pässe kommen an', s.passOkShare, 57, 100, '%', 60, `ohne: ${s0.passOkShare.toFixed(0)} %`);
  check('… Tore je Schuss', s.goalsPerShot, 25, 35, '%', 30, `ohne: ${s0.goalsPerShot.toFixed(1)} %`);
  check('… Tore je Spiel ± 20 % zu ohne', s.goalsPerGame / s0.goalsPerGame, 0.8, 1.2, '×', 1);
  check('… Hänger / Numerik', s.stuck + s.faults, 0, 0, '', 0);
}
process.exit(report('Traumpass und Geben und Gehen (n7 Vorlagen E3)', rows, 'traumpass') ? 0 : 1);
