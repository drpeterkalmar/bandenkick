// Regeln 3 gegen 3: „letzte Hand“ (hinterster Spieler, Hysterese 0,5 m / 0,3 s), Torraum (Halbkreis 4 m,
// ?torraum=), Hände nur dort, Ball in der Hand max. 6 s, niemand darf angreifen, Hechtsprung, Schnellstart
// nach Tor bzw. ?anstoss=1, Spielzeit 2 × dauer, Golden Goal. Aufruf: node tests/node/rules.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const inp = (o = {}) => ({ ...EMPTY_INPUT, ...o });
// Spiel ohne Bots: alle Eingaben kommen aus dem Test (Mensch = Spieler 0, die anderen stehen)
const mk = (qs = '', seed = 1) => { const g = new Game(makeParams(qs), seed, { match: true, human: -1, bots: false }); g.rules.phase = 'play'; return g; };
const run = (g, sec, inputs = () => []) => { const ev = []; for (let i = 0; i < Math.round(sec / DT); i++) { for (const e of g.step(inputs(g))) ev.push({ ...e, t: g.t }); } return ev; };
const park = (g) => { // alle Spieler weit weg von Ball und Toren
  g.players.forEach((p, i) => p.place((i % 3 - 1) * 2, (i < 3 ? -5 : 5), p.team === 0 ? 0 : Math.PI));
  g.ball.place(0, 0.11, 0);
};

// 1) Letzte Hand = hinterster Spieler (kleinster Abstand zur eigenen Torlinie)
{
  const g = mk(); park(g);
  const [a, b, c] = g.players; // Mannschaft 0 (Tor links, x = −10)
  a.place(-4, -5); b.place(-7, 3); c.place(-2, 5);
  g.rules.updateKeepers(0, true);
  check('Letzte Hand = hinterster Spieler', g.rules.keeper[0] === b.id ? 1 : 0, 1, 1, '', 1, `Abstände zur Linie 6 / 3 / 8 m → Spieler ${b.id}`);
}
// 2) Hysterese: 0,4 m näher → kein Wechsel; 0,6 m näher → Wechsel erst nach 0,3 s
{
  const g = mk(); park(g);
  const [a, b] = g.players;
  a.place(-7, -3); b.place(-6, 3);
  g.rules.updateKeepers(0, true);
  const k0 = g.rules.keeper[0];
  b.place(-7.4, 3); // 0,4 m näher als a
  let sw = -1;
  for (let i = 0; i < 1 / DT; i++) { g.rules.updateKeepers(DT); if (g.rules.keeper[0] !== k0 && sw < 0) sw = i * DT; }
  check('Hysterese: 0,4 m Vorsprung → kein Wechsel (1 s)', sw < 0 ? 1 : 0, 1, 1, '', 1, `letzte Hand bleibt Spieler ${k0}`);
  b.place(-7.6, 3); // 0,6 m näher
  let t = -1;
  for (let i = 0; i < 1 / DT; i++) { g.rules.updateKeepers(DT); if (g.rules.keeper[0] === b.id && t < 0) t = (i + 1) * DT; }
  check('Hysterese: 0,6 m Vorsprung → Wechsel nach', t, 0.29, 0.34, 's', 0.3, 'erst wenn ≥ 0,5 m für ≥ 0,3 s');
  // Flackern: zwei Spieler pendeln ±0,3 m um den gleichen Abstand → kein Wechsel
  const g2 = mk(); park(g2);
  const [p, q] = g2.players; p.place(-7, -3); q.place(-7, 3);
  g2.rules.updateKeepers(0, true);
  let switches = 0, last = g2.rules.keeper[0];
  for (let i = 0; i < 5 / DT; i++) { q.x = -7 + 0.3 * Math.sin(i * DT * 9); g2.rules.updateKeepers(DT); if (g2.rules.keeper[0] !== last) { switches++; last = g2.rules.keeper[0]; } }
  check('Kein Flackern bei ±0,3 m Pendeln (5 s)', switches, 0, 0, '×', 0);
  // Kurzes Überholen (< 0,3 s) zählt nicht
  const g3 = mk(); park(g3);
  const [r1, r2] = g3.players; r1.place(-7, -3); r2.place(-5, 3);
  g3.rules.updateKeepers(0, true);
  const k3 = g3.rules.keeper[0]; r2.place(-8, 3);
  for (let i = 0; i < 0.25 / DT; i++) g3.rules.updateKeepers(DT);
  r2.place(-5, 3);
  for (let i = 0; i < 0.5 / DT; i++) g3.rules.updateKeepers(DT);
  check('Überholen nur 0,25 s → kein Wechsel', g3.rules.keeper[0] === k3 ? 1 : 0, 1, 1, '', 1);
}
// 3) Torraum: Halbkreis 4 m um die Tormitte, feldseitig; ?torraum=5
{
  const g = mk(); const R = g.rules, hx = g.cage.hx;
  const inside = [R.inBox(0, -hx + 3.9, 0), R.inBox(0, -hx + 2.4, 3.0), R.inBox(1, hx - 1, -3.8)].every(Boolean);
  const outside = [R.inBox(0, -hx + 4.1, 0), R.inBox(0, -hx + 2, 3.5), R.inBox(0, -hx - 0.3, 0), R.inBox(1, -hx + 1, 0)].some(Boolean);
  check('Torraum: Punkte innen (3,9 m; 3,84 m schräg)', inside ? 1 : 0, 1, 1, '', 1);
  check('Torraum: Punkte außen (4,1 m; 4,03 m schräg; hinter der Linie; anderes Tor)', outside ? 0 : 1, 1, 1, '', 1);
  const g5 = mk('?torraum=5');
  check('?torraum=5: 4,5 m ist drin', g5.rules.inBox(0, -hx + 4.5, 0) ? 1 : 0, 1, 1, '', 1);
}
// 4) Hände nur für die letzte Hand im eigenen Torraum
{
  const tryCatch = (kx, kz, keeperIsLast = true, qs = '') => {
    const g = mk(qs); park(g);
    const k = g.players[0], other = g.players[1];
    k.place(kx, kz, 0);
    other.place(keeperIsLast ? kx + 3 : kx - 0.5, 4, 0);
    g.rules.updateKeepers(0, true);
    g.ball.place(k.x + 0.5, 1.0, k.z); g.ball.contact = false; g.ball.v.set(-3, 0, 0);
    const ev = run(g, 0.3, (gg) => { const a = []; a[0] = inp({ hand: true }); a[1] = inp({ hand: true }); return a; });
    return { caught: ev.some((e) => e.type === 'catch'), held: g.ball.held };
  };
  const hx = makeParams('').fieldL / 2; // Nacht 2c: Standardfeld 24 × 15 (vorher fest 10)
  check('Letzte Hand im Torraum fängt', tryCatch(-hx + 2, 0).caught ? 1 : 0, 1, 1, '', 1);
  check('Letzte Hand außerhalb des Torraums: keine Hand möglich', tryCatch(-hx + 5, 0).caught ? 0 : 1, 1, 1, '', 1, 'Ball prallt nur ab / wird mit dem Fuß gespielt');
  check('Nicht-hinterster Spieler im Torraum: keine Hand', tryCatch(-hx + 2, 0, false).caught ? 0 : 1, 1, 1, '', 1);
}
// 5) Ball in der Hand höchstens 6 s, dann automatisch Abwurf; solange darf niemand angreifen
{
  const g = mk(); park(g);
  const k = g.players[0];
  k.place(-8, 0, 0); g.rules.updateKeepers(0, true);
  g.rules.giveKeeper(0);
  // Gegner läuft direkt in den Tormann
  const opp = g.players[4]; opp.place(-5, 0, Math.PI);
  let rel = -1, sixsec = false, stolen = false;
  for (let i = 0; i < 8 / DT && rel < 0; i++) {
    const a = []; a[4] = inp({ mx: -1, mz: 0 }); a[0] = inp({});
    const ev = g.step(a);
    if (g.ball.held !== k.id && rel < 0) { rel = g.t; sixsec = ev.some((e) => e.type === 'sixsec'); }
    if (g.lastTouch === opp.id) stolen = true;
  }
  const held = rel;
  check('Ball in der Hand: automatischer Abwurf nach', held, 5.95, 6.1, 's', 6, sixsec ? 'Ereignis „6 s“' : 'ohne Ereignis?');
  check('Während des Haltens: Gegner kommt nicht an den Ball', stolen ? 0 : 1, 1, 1, '', 1, 'Gegner lief 1,5 s lang in den Tormann');
  // Abwurf per Eingabe landet beim Mitspieler
  const g2 = mk(); park(g2);
  const k2 = g2.players[0], mate = g2.players[1];
  k2.place(-8, 0, 0); mate.place(-2, 2, 0); g2.rules.updateKeepers(0, true); g2.rules.giveKeeper(0);
  const a = []; a[0] = inp({ throw: true, aimX: mate.x, aimZ: mate.z });
  g2.step(a);
  let arrive = 99;
  for (let i = 0; i < 3 / DT; i++) { g2.step([]); const d = Math.hypot(g2.ball.p.x - mate.x, g2.ball.p.z - mate.z); arrive = Math.min(arrive, d); }
  check('Abwurf auf Mitspieler (6,3 m): Ball kommt an', arrive, 0, 0.8, 'm', 0, 'kleinster Abstand Ball–Mitspieler');
}
// 6) Hechtsprung: nur im Torraum; Flug, dann am Boden; fängt Ball im Flug
{
  const g = mk(); park(g);
  const k = g.players[0]; k.place(-9, 0, 0); g.rules.updateKeepers(0, true);
  // (Nacht 2d: die Arme fahren im Sprung erst in 0,2 s aus – der Ball rollt deshalb langsamer davon als vorher 6 m/s)
  g.ball.place(-9, 0.6, 1.7); g.ball.contact = false; g.ball.v.set(-2.5, 0, 0.05);
  let caught = false, tGround = -1, mode = [];
  for (let i = 0; i < 1.4 / DT; i++) {
    const a = []; a[0] = i === 0 ? inp({ dive: true, mz: 1, hand: true }) : inp({ hand: true });
    const ev = g.step(a);
    if (ev.some((e) => e.type === 'catch')) caught = true;
    if (k.hand.mode === 'ground' && tGround < 0) tGround = g.t;
    if (!mode.length || mode[mode.length - 1] !== k.hand.mode) mode.push(k.hand.mode);
  }
  check('Hechtsprung seitlich 1,7 m: Ball gefangen', caught ? 1 : 0, 1, 1, '', 1, `Ablauf ${mode.join(' → ')}`);
  check('Hechtsprung: Flugphase bis „am Boden“', tGround, 0.3, 0.5, 's', g.P.diveT);
  const g2 = mk(); park(g2);
  const k2 = g2.players[0]; k2.place(-4, 0, 0); g2.rules.updateKeepers(0, true); // außerhalb (6 m vor dem Tor)
  const a = []; a[0] = inp({ dive: true, mz: 1 });
  g2.step(a);
  check('Hechtsprung außerhalb des Torraums nicht möglich', k2.hand.mode === 'none' ? 1 : 0, 1, 1, '', 1);
}
// 7) Nach Tor: Standard seit 30.09. (Peter) = Anstoß in der Mitte; ?anstoss=0 = Schnellstart (Tormann des Gegentors hat den Ball)
{
  const g = mk('?anstoss=0'); park(g);
  g.ball.place(9.5, 0.5, 0); g.ball.contact = false; g.ball.v.set(12, 0, 0);
  const ev = run(g, 0.5);
  const goal = ev.find((e) => e.type === 'goal');
  check('Tor erkannt, Mannschaft 0 trifft', goal && goal.team === 0 ? 1 : 0, 1, 1, '', 1);
  const clock0 = g.rules.clock;
  let clockAtRestart = -1;
  const ev2 = [];
  for (let i = 0; i < Math.round((g.P.celebrateT + 0.2) / DT); i++) {
    for (const e of g.step([])) { ev2.push({ ...e, t: g.t }); if (e.type === 'restart' && clockAtRestart < 0) clockAtRestart = g.rules.clock; }
  }
  const rs = ev2.find((e) => e.type === 'restart');
  const kp = g.players[g.rules.keeper[1]];
  check('?anstoss=0 Schnellstart: Tormann des Gegentors (Mannschaft 1) hat den Ball', rs && rs.mode === 'keeper' && g.ball.held === kp.id ? 1 : 0, 1, 1, '', 1, rs ? `nach ${(rs.t - goal.t).toFixed(2)} s` : '');
  check('?anstoss=0 Schnellstart: Tormann steht im eigenen Torraum', g.rules.inBox(1, kp.x, kp.z) ? 1 : 0, 1, 1, '', 1);
  check('Uhr steht während des Torjubels', clockAtRestart - clock0, 0, 0.01, 's', 0, `Jubel ${g.P.celebrateT} s`);
  // Standard: Anstoß in der Mitte für die Mannschaft, die das Tor bekommen hat
  const h = mk(); park(h);
  h.ball.place(-9.5, 0.5, 0); h.ball.contact = false; h.ball.v.set(-12, 0, 0);
  run(h, 0.5 + h.P.celebrateT + 0.2);
  check('Anstoß nach Tor (Standard): in der Mitte für Mannschaft 0', h.rules.phase === 'kickoff' && h.rules.kickoffTeam === 0 && Math.hypot(h.ball.p.x, h.ball.p.z) < 0.01 && h.ball.held < 0 ? 1 : 0, 1, 1, '', 1);
  const far = h.players.filter((p) => p.team === 1).every((p) => Math.hypot(p.x, p.z) >= 2);
  check('Anstoß nach Tor: Gegner ≥ 2 m vom Ball, jeder in seiner Hälfte', far && h.players.every((p) => (p.team === 0 ? p.x <= 0 : p.x >= 0)) ? 1 : 0, 1, 1, '', 1);
}
// 7b) Torschütze/Eigentor (Peter 30.09.: „es steht Eigentor, wenn ich ein reguläres Tor schieße“): Eine Tormann-Parade
// (Fingerspitzen/Abwehren), nach der der Ball trotzdem reingeht, ist kein Eigentor – das Tor zählt für den Schützen.
{
  const goalAfter = (touches) => { const g = mk(); park(g); for (const [id, defl] of touches) g.rules.touch(g.players[id], defl); g.rules.onGoal(1); return g.rules.goals[0]; };
  const a = goalAfter([[0, false], [3, true]]);          // Orange 0 schießt, Blau-Tormann 3 mit den Fingerspitzen dran → rein
  check('Parade, Ball trotzdem rein: kein Eigentor, Tor für den Schützen', !a.own && a.scorer === 0 && a.saved ? 1 : 0, 1, 1, '', 1, JSON.stringify(a));
  const b = goalAfter([[0, false], [4, false]]);         // Blau 4 spielt den Ball selbst ins eigene Tor
  check('Selbst ins eigene Tor gespielt: Eigentor', b.own && b.scorer === -1 ? 1 : 0, 1, 1, '', 1, JSON.stringify(b));
  const c = goalAfter([[0, false], [3, true], [4, false]]); // Parade, dann klärt Blau 4 ins eigene Tor
  check('Parade, dann eigener Mitspieler ins eigene Tor: Eigentor', c.own ? 1 : 0, 1, 1, '', 1, JSON.stringify(c));
  const d = goalAfter([[1, false]]);                     // Orange 1 trifft direkt
  check('Direkter Treffer: Tor für den Schützen', !d.own && d.scorer === 1 && !d.saved ? 1 : 0, 1, 1, '', 1, JSON.stringify(d));
}
// 8) Spielzeit 2 × dauer, Halbzeit, Ende; Golden Goal bei Gleichstand
{
  const g = new Game(makeParams('?dauer=0.5'), 3, { match: true, human: -1 });
  const ev = run(g, 200);
  const half = ev.find((e) => e.type === 'halftime'), end = ev.find((e) => e.type === 'end');
  check('?dauer=0,5: Halbzeit nach 30 s gespielter Zeit', half ? 1 : 0, 1, 1, '', 1);
  check('Ende nach 2 × 30 s gespielter Zeit', end ? g.rules.clock : 0, 59.9, 60.1, 's', 60, `Ergebnis ${g.score.join(':')}`);
  // Golden Goal: Gleichstand bei Abpfiff → weiter bis zum nächsten Tor
  const gg = mk('?dauer=0.1&golden=1'); park(gg);
  gg.rules.clock = gg.rules.halfLen * 2 - 0.05; gg.rules.half = 2;
  run(gg, 0.2);
  check('Golden Goal: bei 0:0 läuft das Spiel weiter', gg.rules.golden && gg.rules.phase === 'play' ? 1 : 0, 1, 1, '', 1);
  gg.ball.place(-9.5, 0.5, 0); gg.ball.contact = false; gg.ball.v.set(-12, 0, 0);
  const ev2 = run(gg, 0.6);
  check('Golden Goal: erstes Tor beendet das Spiel', ev2.some((e) => e.type === 'end') && gg.rules.winner === 1 ? 1 : 0, 1, 1, '', 1);
  const nog = mk('?dauer=0.1'); park(nog);
  nog.rules.clock = nog.rules.halfLen * 2 - 0.05; nog.rules.half = 2;
  run(nog, 0.2);
  check('Ohne Golden Goal: 0:0 → Unentschieden', nog.rules.phase === 'end' && nog.rules.winner === -1 ? 1 : 0, 1, 1, '', 1);
}

process.exit(report('Regeln 3 gegen 3 (letzte Hand, Torraum, 6 s, Schnellstart, Spielzeit)', rows) ? 0 : 1);
