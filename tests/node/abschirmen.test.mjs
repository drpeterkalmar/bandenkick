// n7 Etappe 0 (Peter 14.10.: „besserer Ballbesitz“): Abschirmen. Führt ein Spieler den Ball eng am Fuß, bekommt ein Gegner ihn
// per bloßem Kontakt nur, wenn sein Fuß ihn klar früher erreicht – nicht durch den Körper des Führenden hindurch. Die
// Grätsche erobert ihn weiter. Dazu: kürzere Vorlage und Ball zur abgewandten Seite, wenn ein Gegner nah ist; ?abschirmen=0 = n6.
// Aufruf: node tests/node/abschirmen.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { humanHold } from './n7_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };

// Szene: Orange 0 führt (Ball 0,35 m vor dem Fuß, eben berührt), Blau 1 steht irgendwo
function scene(qs, ox, oz, { ballAhead = 0.35 } = {}) {
  const g = new Game(makeParams(qs), 1, { match: true, human: -1, perTeam: [1, 1], bots: false });
  g.rules.phase = 'play';
  const c = g.players[0], o = g.players[1], b = g.ball;
  c.place(0, 0, 0); o.place(ox, oz, Math.atan2(-oz, -ox));
  const [fx, fz] = c.footPoint();
  b.place(fx + ballAhead, b.r, fz); b.held = -1;
  g.lastTouch = 0; g.lastTouchT = g.t; c.lastTouchT = g.t; c.kickT = 9; c.selfKick = false;
  return { g, c, o, b };
}
{
  // Gegner direkt hinter dem Führenden: Körper dazwischen → gesperrt
  const s1 = scene('', -0.6, 0.05);
  check('Gegner hinter dem Führenden (Körper dazwischen): bloßer Kontakt gesperrt', s1.o.shieldBlocked(s1.g) ? 1 : 0, 1, 1, '', 1);
  // Gegner seitlich, sein Fuß nicht näher am Ball → gesperrt
  const s2 = scene('', 0.75, 0.75);
  check('Gegner seitlich, nicht klar früher am Ball: gesperrt', s2.o.shieldBlocked(s2.g) ? 1 : 0, 1, 1, '', 1);
  // Gegner vorn, sein Fuß klar näher (Ball weit vorgelegt) → erlaubt
  const s3 = scene('', 1.6, 0.0, { ballAhead: 0.8 });
  check('Gegner vorn, Fuß klar früher am Ball: darf spielen', s3.o.shieldBlocked(s3.g) ? 1 : 0, 0, 0, '', 0);
  // Ball nicht mehr am Fuß (> schirmNah) → frei
  const s4 = scene('', 0.75, 0.75, { ballAhead: 1.2 });
  check('Ball weg vom Fuß (> 0,9 m): frei für alle', s4.o.shieldBlocked(s4.g) ? 1 : 0, 0, 0, '', 0);
  // Pass/Schuss des Führenden (kein Mitnehmen) → frei
  const s5 = scene('', -0.6, 0.05); s5.c.kickT = 0.1;
  check('nach Pass/Schuss des Führenden: frei', s5.o.shieldBlocked(s5.g) ? 1 : 0, 0, 0, '', 0);
  const s6 = scene('abschirmen=0', -0.6, 0.05);
  check('?abschirmen=0: nie gesperrt (n6)', s6.o.shieldBlocked(s6.g) ? 1 : 0, 0, 0, '', 0);
}
// Ablauf: Gegner läuft 1,5 s von schräg hinten auf den Ball zu, der Führende steht mit dem Ball → kein Ballgewinn durch Kontakt
function fromBehind(qs) {
  const s = scene(qs, -0.3, 0.8), { g, o, b } = s;
  let got = 0;
  for (let i = 0; i < 1.5 / DT; i++) {
    const dx = b.p.x - o.x, dz = b.p.z - o.z, d = Math.hypot(dx, dz) || 1;
    const ev = g.step([{ ...EMPTY_INPUT }, { ...EMPTY_INPUT, mx: dx / d, mz: dz / d }]);
    if (ev.some((e) => e.player === 1 && (e.type === 'touch' || e.type === 'kick'))) { got = 1; break; }
  }
  return got;
}
{
  const n = [], a = [];
  for (const q of ['', 'abschirmen=0']) (q ? a : n).push(fromBehind(q));
  check('Gegner von schräg hinten am Körper vorbei: kein Ballgewinn per Kontakt', n[0], 0, 0, '', 0);
  check('… mit ?abschirmen=0 spielt er den Ball (n6)', a[0], 1, 1, '', 1);
}
// Grätsche erobert den Ball trotz Abschirmen
{
  const s = scene('', -1.5, 0.3), { g, o } = s;
  o.startTackle(g, 'pass', null);
  let hit = null;
  for (let i = 0; i < 0.6 / DT && !hit; i++) for (const e of g.step([{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }])) if (e.type === 'tackle' && e.phase === 'hit') hit = e.result;
  check('Grätsche trifft trotz Abschirmen (Ball oder Gegner zuerst)', hit ? 1 : 0, 1, 1, '', 1, `Ergebnis: ${hit}`);
}
// Kürzere Vorlage mit Gegner nah
{
  const s = scene('', 2, 0), far = s.c.oppNearBall(s.g);
  const t = scene('', 0.9, 0.5), near = t.c.oppNearBall(t.g);
  check('Gegner nah am Ball → Nähe-Faktor für kürzere Vorlage', near - far, 0.3, 1, '', null, `fern ${far.toFixed(2)}, nah ${near.toFixed(2)}`);
}
// Mensch (Skript) gegen Stufe-2-Verteidiger: Ballverluste je Minute am Ball deutlich weniger als n6
{
  const N6 = 'sprintfrei=0&magnet=1.2&abschirmen=0&magnetTurnMin=0.25&magnetC=20';
  const h1 = humanHold('', 12), h0 = humanHold(N6, 12);
  check('Mensch gegen Stufe-2-Verteidiger: Ballverluste je Minute am Ball (÷ n6)', h1.lostPerMin / h0.lostPerMin, 0, 0.5, '×', null,
    `n6 ${h0.lostPerMin.toFixed(1)}/min (Ball weg in ${h0.lostShare.toFixed(0)} % der Versuche, Haltedauer ${h0.holdMean.toFixed(2)} s, bis vors Tor ${h0.okShare.toFixed(0)} %) → jetzt ${h1.lostPerMin.toFixed(1)}/min (${h1.lostShare.toFixed(0)} %, ${h1.holdMean.toFixed(2)} s, ${h1.okShare.toFixed(0)} %)`);
  check('… der Verteidiger gewinnt den Ball trotzdem noch (kein Klebeball)', h1.lostShare, 15, 80, '%', null);
}
process.exit(report('Abschirmen (n7 Etappe 0)', rows, 'abschirmen') ? 0 : 1);
