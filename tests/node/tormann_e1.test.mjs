// n7 Vorlagen E1 (Tormann): Müdigkeit (Energie, Fanggrenze, Aufstehen), Winkelhalbierende, Herauslaufen 1 gegen 1 mit Blocken,
// Heber-Stolpern – reine Funktionen und kurze Szenen, dazu das Bot-Spiel (Energie-Minimum, Nachschuss-Tore, Hechter).
// Aufruf: node tests/node/tormann_e1.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { keeperLevel } from '../../src/sim/bots.js';
import { oneOnOne, runProbe, summary } from './n7_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');

// 1) Müdigkeit: Kosten, Erholung, Fanggrenze, Aufstehen
{
  const g = new Game(P, 1, { match: true, human: -1, perTeam: [1, 1], bots: false }); g.rules.phase = 'play';
  const R = g.rules;
  R.tire(1, P.muedeHecht); R.tire(1, P.muedeAbwehr);
  check('Energie nach Hechter + Abklatschen', R.energy[1], 100 - P.muedeHecht - P.muedeAbwehr - 0.01, 100 - P.muedeHecht - P.muedeAbwehr + 0.01, '', 100 - P.muedeHecht - P.muedeAbwehr);
  for (let i = 0; i < 2 / DT; i++) g.step([]);
  check('Erholung in 2 s Spielzeit', R.energy[1] - (100 - P.muedeHecht - P.muedeAbwehr), 2 * P.muedeErh - 0.05, 2 * P.muedeErh + 0.05, '', 2 * P.muedeErh);
  R.energy[1] = 100; check('Aufstehen frisch: Tempo × 1', R.getUpRate(1), 1, 1, '×', 1);
  R.energy[1] = 20; check('Aufstehen bei Energie 20: Tempo × muedeAuf', R.getUpRate(1), P.muedeAuf - 0.01, P.muedeAuf + 0.01, '×', P.muedeAuf);
  const g3 = new Game(P, 1, { match: true, human: -1, perTeam: [1, 1], botLevels: [1, 3] }); g3.rules.tire(0, 10); g3.rules.tire(1, 10);
  check('Kondition je Stufe: 10 Punkte kosten Stufe 1 / Stufe 3', g3.rules.energy[0] - g3.rules.energy[1], -6.6, -6.4, '', -6.5, `Stufe 1: ${g3.rules.energy[0].toFixed(1)}, Stufe 3: ${g3.rules.energy[1].toFixed(1)}`);
  const g0 = new Game(makeParams('muede=0'), 1, { match: true, human: -1, perTeam: [1, 1], bots: false }); g0.rules.tire(1, 50);
  check('?muede=0: keine Kosten', g0.rules.energy[1], 100, 100, '', 100);
}
// Ball mit v m/s neben den Körper (dz) auf einen stehenden Tormann der Stufe 2 mit Energie E → 'catch' | 'parry' | …
function shotAt(E, v, dz = 0.45, qs = '') {
  const g = new Game(makeParams(qs), 3, { match: true, human: -1, perTeam: [1, 1], bots: false });
  g.rules.phase = 'play'; g.rules.energy[1] = E;
  const kp = g.players[1], hx = g.cage.hx, K = keeperLevel(g.P, 2);
  kp.place(hx - 1, 0, Math.PI); g.players[0].place(-6, 0, 0); g.rules.updateKeepers(0, true);
  const b = g.ball; b.place(hx - 4, 1.0, dz); b.v.set(v, 0, 0); b.w.set(0, 0, 0);
  const inp = { ...EMPTY_INPUT, hand: true, autoCatch: true, catchSkill: K.catchSkill, fumble: false, diveReach: K.diveReach, catchRel: K.catchRel, tip: 0, reachMul: K.reach };
  for (let i = 0; i < 0.5 / DT; i++) { b.v.y = 0; b.p.y = 1.0; for (const e of g.step([EMPTY_INPUT, inp])) if (e.type === 'catch' || e.type === 'parry') return e.type; }
  return 'none';
}
check('Frisch: 11 m/s (40 km/h) gefangen', shotAt(100, 11) === 'catch' ? 1 : 0, 1, 1, '', 1);
check('Müde (Energie 10): 11 m/s abgeklatscht (Fanggrenze für mittlere Bälle gesunken)', shotAt(10, 11) === 'parry' ? 1 : 0, 1, 1, '', 1);
check('Müde: langsamer Roller 6 m/s weiter gefangen', shotAt(10, 6) === 'catch' ? 1 : 0, 1, 1, '', 1);
check('?muede=0: müde Energie wirkt nicht', shotAt(10, 11, 0.45, 'muede=0') === 'catch' ? 1 : 0, 1, 1, '', 1);

// 2) Winkelhalbierende: Ball spitz vor dem Tor → Tormann rückt Richtung kurzer Pfosten (zwischen Mittellinie und Halbierender)
function keeperZ(qs) {
  const g = new Game(makeParams('raus=0&' + qs), 5, { match: true, human: -1, perTeam: [2, 2], botLevels: [2, 2] }); // (ohne Herauslaufen: reine Stellung)
  g.rules.phase = 'play'; const hx = g.cage.hx;
  g.players[0].place(hx - 3.2, 4.2, 0); g.ball.place(hx - 2.9, g.ball.r, 4.2); g.players[1].place(-hx + 1, 0, 0);
  g.players[2].place(hx - 1, 0, Math.PI); g.players[3].place(-3, -4, 0);
  g.rules.updateKeepers(0, true); g.lastTouch = 0; g.lastTouchT = 0;
  g.bots.K[1] = { ...g.bots.K[1], posErr: 0 };
  for (let i = 0; i < 1.5 / DT; i++) { g.step([]); g.ball.place(hx - 2.9, g.ball.r, 4.2); g.ball.v.set(0, 0, 0); g.players[0].place(hx - 3.2, 4.2, 0); }
  return g.players[2].z;
}
{
  const z1 = keeperZ(''), z0 = keeperZ('winkel=0'), zf = keeperZ('winkel=1');
  check('Winkelhalbierende: Tormann näher am kurzen Pfosten als auf der Mittellinie', z1 - z0, 0.05, 1.5, 'm', null, `?winkel=0: z = ${z0.toFixed(2)} m, Standard (0,5): ${z1.toFixed(2)} m, ?winkel=1: ${zf.toFixed(2)} m (Pfosten bei 1,5 m)`);
}
// 3) Herauslaufen 1 gegen 1 (Stufe 2): mehr vereitelt als ohne; Mittel über die Stufen 35–50 %
{
  // n8: mit 7 m/s holt der zurücklaufende Verteidiger den Stürmer öfter ein (vereitelt auch ohne Tormann) – die Tormann-Mechanik
  // wird deshalb im n7-Lauftempo geprüft (?ein=6&vAntritt=7.5), das n8-Tempo steht als Info darunter
  const N7T = 'ein=6&vAntritt=7.5&';
  const on = [1, 2, 3].map((lv) => oneOnOne(N7T, 40, lv)), off = [1, 2, 3].map((lv) => oneOnOne(N7T + 'raus=0', 40, lv));
  const avg = (a) => a.reduce((s, x) => s + x.savedShare, 0) / a.length;
  check('1 gegen 1 vereitelt, Mittel Stufe 1–3 (n7-Lauftempo)', avg(on), 35, 55, '%', null, `je Stufe ${on.map((x) => x.savedShare.toFixed(0)).join('/')} % · ?raus=0: ${off.map((x) => x.savedShare.toFixed(0)).join('/')} % (Mittel ${avg(off).toFixed(0)} %)`);
  check('… Stufe 2 mit Herauslaufen besser als ohne (n7-Lauftempo)', on[1].savedShare - off[1].savedShare, 5, 100, 'Punkte', null);
  const on8 = [1, 2, 3].map((lv) => oneOnOne('', 40, lv)), off8 = [1, 2, 3].map((lv) => oneOnOne('raus=0', 40, lv));
  check('… n8-Lauftempo 7 m/s (Info)', avg(on8), 0, 100, '%', null, `je Stufe ${on8.map((x) => x.savedShare.toFixed(0)).join('/')} % · ?raus=0: ${off8.map((x) => x.savedShare.toFixed(0)).join('/')} % (Mittel ${avg(off8).toFixed(0)} %)`);
}
// Blocken: Tormann außerhalb des Torraums mit gespreizten Beinen – flacher Ball 0,45 m neben der Körpermitte prallt ab
{
  const g = new Game(P, 2, { match: true, human: -1, perTeam: [1, 1], bots: false }); g.rules.phase = 'play';
  const kp = g.players[1], hx = g.cage.hx; kp.place(hx - 6, 0, Math.PI); kp.block = 1;
  const b = g.ball; b.place(hx - 9, b.r, 0.42); b.v.set(17, 0, 0); b.w.set(0, 0, 0);
  let blk = false; for (let i = 0; i < 0.4 / DT && !blk; i++) for (const e of g.step([])) if (e.type === 'block') blk = true;
  check('Blocken mit gespreizten Beinen: flacher Ball 0,42 m neben der Mitte prallt ab', blk ? 1 : 0, 1, 1, '', 1);
}
// 4) Heber-Stolpern: Chip eines Gegners über den Tormann im Torraum (Chance 1 für den Test)
{
  const g = new Game(makeParams('stolpern=1'), 4, { match: true, human: -1, perTeam: [1, 1], bots: false }); g.rules.phase = 'play';
  const sh = g.players[0], kp = g.players[1], hx = g.cage.hx;
  kp.place(hx - 2, 0, Math.PI); sh.place(hx - 9, 0, 0); g.rules.updateKeepers(0, true);
  g.events.length = 0; g.events.push({ type: 'kick', kind: 'pass', tech: 'chip', player: 0, x: hx - 8.6, z: 0, dx: 1, dz: 0 });
  g.rules.chipCheck();
  check('Heber über den Tormann: er stolpert (Chance 1)', kp.stumbleT > 0 && g.events.some((e) => e.type === 'stolpern') ? 1 : 0, 1, 1, '', 1);
  const g0 = new Game(makeParams('stolpern=0'), 4, { match: true, human: -1, perTeam: [1, 1], bots: false });
  g0.players[1].place(g0.cage.hx - 2, 0, Math.PI); g0.rules.updateKeepers(0, true);
  g0.events.push({ type: 'kick', kind: 'pass', tech: 'chip', player: 0, x: g0.cage.hx - 8.6, z: 0, dx: 1, dz: 0 }); g0.rules.chipCheck();
  check('?stolpern=0: nie', g0.players[1].stumbleT, 0, 0, 's', 0);
}
// 5) Bot-Spiel (Stufe 2, 12 Spiele): Gates aus dem Datenblatt
{
  const s = summary(await runProbe('', 12, 'st2', 4)), s0 = summary(await runProbe('muede=0', 12, 'st2', 4));
  check('Bot-Spiel: Tore je Schuss (Stufe 2)', s.goalsPerShot, 25, 35, '%', 30, `?muede=0: ${s0.goalsPerShot.toFixed(1)} %`);
  check('… Nachschuss-Tore (Anteil aller Tore)', s.reboundShare, 10, 100, '%', null);
  check('… Hechter je Spiel', s.divesPerGame, 15, Infinity, '', null);
  check('… Tormann-Energie Minimum je Spiel (Mittel)', s.energyMin, 30, 60, '', null, `unter ${P.muedeFang}: ${s.lowShare.toFixed(1)} % der Spielzeit`);
  check('… Hänger / Numerik', s.stuck + s.faults, 0, 0, '', 0);
}
process.exit(report('Tormann (n7 Vorlagen E1)', rows, 'tormann_e1') ? 0 : 1);
