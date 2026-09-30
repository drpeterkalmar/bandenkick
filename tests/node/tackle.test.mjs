// Grätsche (Nacht 2c): Auslöser (nicht am Ball, Ball bzw. ballführender Gegner ≤ 2,5 m, Gegner näher am Ball), Ablauf
// (0,5 s rutschen + 0,6 s am Boden), Ergebnis (Ball zuerst: Pass zum Mitspieler / Schuss aufs Tor / klären; Gegner
// zuerst: Ball springt frei, Gegner stolpert), ?graetsche=0, Bots grätschen je Stufe, Selbstspiel ohne Hänger.
// Aufruf: node tests/node/tackle.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { playGame } from './selfplay.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });

// Orange: Mensch (0) + Mitspieler (1); Blau: Gegner (2) mit Ball. Ohne Bots (alle stehen, außer dem Menschen).
function scene(qs, { me, opp, ball, mate = [4, -4], oppFace = 0 }) {
  const g = new Game(makeParams(qs), 5, { match: true, perTeam: [2, 1], human: 0, bots: false });
  g.rules.phase = 'play';
  const [h, m, o] = g.players;
  h.place(me[0], me[1], Math.atan2(ball[1] - me[1], ball[0] - me[0])); m.place(mate[0], mate[1], 0);
  o.place(opp[0], opp[1], oppFace); g.ball.place(ball[0], 0.11, ball[1]); g.ball.v.set(0, 0, 0);
  g.lastTouch = o.id; g.lastTouchT = g.t; g.rules.updateKeepers(0, true);
  return g;
}
// Knopf tippen (70 ms), 2 s laufen lassen; Ereignisse sammeln
function tap(g, btn = 'shot', T = 2, stick = [0, 0]) {
  const ev = []; const t0 = g.t;
  for (let i = 0; i < T / DT; i++) {
    const t = g.t - t0;
    for (const e of g.step([H({ [btn + 'Down']: t < 0.07, mx: t < 0.3 ? stick[0] : 0, mz: t < 0.3 ? stick[1] : 0 })])) ev.push({ ...e, t: g.t - t0 });
  }
  return ev;
}
const first = (ev, f) => ev.find(f) || null;

// 1) Auslöser
{
  const g = scene('', { me: [-1.8, 0], opp: [0.6, 0.3], ball: [0.2, 0.1], oppFace: 0 });
  const ev = tap(g);
  const st = first(ev, (e) => e.type === 'tackle' && e.phase === 'start');
  check('Gegner am Ball in 2 m, Schuss tippen → Grätsche', st ? 1 : 0, 1, 1, '', 1, st ? `nach ${st.t.toFixed(3)} s` : '');
  const g2 = scene('', { me: [-1.8, 0], opp: [5, 4], ball: [0.2, 0] });
  const ev2 = tap(g2);
  check('Freier Ball in 2 m (kein Gegner dran) → keine Grätsche, hinlaufen und schießen', !first(ev2, (e) => e.type === 'tackle') && first(ev2, (e) => e.type === 'kick' && e.player === 0) ? 1 : 0, 1, 1, '', 1);
  const g3 = scene('', { me: [-0.2, 0], opp: [1.2, 0.3], ball: [0.2, 0] });
  const ev3 = tap(g3);
  check('Ball am Fuß → normaler Schuss, keine Grätsche', !first(ev3, (e) => e.type === 'tackle') && first(ev3, (e) => e.type === 'kick' && e.player === 0) ? 1 : 0, 1, 1, '', 1);
  const g4 = scene('', { me: [-4.5, 0], opp: [0.6, 0.3], ball: [0.2, 0.1] });
  const ev4 = tap(g4);
  check('Gegner am Ball in 4,5 m → keine Grätsche (läuft hin)', first(ev4, (e) => e.type === 'tackle') ? 0 : 1, 1, 1, '', 1);
  const g5 = scene('graetsche=0', { me: [-1.8, 0], opp: [0.6, 0.3], ball: [0.2, 0.1] });
  check('?graetsche=0: aus', first(tap(g5), (e) => e.type === 'tackle') ? 0 : 1, 1, 1, '', 1);
}
// 2) Ball zuerst: Pass zum Mitspieler, Schuss aufs Tor (Tornähe), sonst klären
{
  const g = scene('', { me: [-1.9, 0.2], opp: [0.9, 0.3], ball: [0.2, 0.2] });
  const ev = tap(g, 'pass', 2, [0.5, -0.5]);
  const hit = first(ev, (e) => e.type === 'tackle' && e.phase === 'hit'), k = first(ev, (e) => e.type === 'kick' && e.player === 0);
  check('Grätsche mit Pass-Knopf: Ball erwischt → Pass zum Mitspieler', hit && hit.result === 'ball' && k && k.kind === 'pass' && k.to === 1 ? 1 : 0, 1, 1, '', 1, hit ? `${hit.result} nach ${hit.t.toFixed(2)} s, ${k ? k.kind + ' → ' + k.to : 'kein Kick'}` : 'kein Kontakt');
  const hx = g.cage.hx;
  const gs = scene('', { me: [hx - 8.4, 0.5], opp: [hx - 5.6, 0.4], ball: [hx - 6.3, 0.4] });
  const es = tap(gs, 'shot');
  const ks = first(es, (e) => e.type === 'kick' && e.player === 0), goal = first(es, (e) => e.type === 'goal');
  check('Grätsche mit Schuss-Knopf in Tornähe: Schuss aufs Tor', ks && ks.kind === 'shot' ? 1 : 0, 1, 1, '', 1, ks ? `${ks.tech}, ${ks.speed.toFixed(1)} m/s${goal ? ', Tor' : ''}` : '');
  const gc = scene('', { me: [-hx + 5, 1], opp: [-hx + 7.6, 1.1], ball: [-hx + 7.1, 1.05], mate: [0, -5] });
  const ec = tap(gc, 'shot');
  const kc = first(ec, (e) => e.type === 'kick' && e.player === 0);
  check('Grätsche mit Schuss-Knopf weit weg: klären nach vorn', kc && kc.kind === 'clear' && kc.dx > 0.3 ? 1 : 0, 1, 1, '', 1, kc ? `${kc.kind}, Richtung x ${kc.dx.toFixed(2)}` : '');
}
// 3) Gegner zuerst: Ball springt frei, Gegner stolpert (kein Foul); Dauer der Grätsche
{
  // Gegner steht zwischen Mensch und Ball (Ball hinter ihm)
  const g = scene('', { me: [-1.8, 0], opp: [0, 0], ball: [0.5, 0.05], oppFace: 0 });
  const o = g.players[2];
  let stumble = 0, oppTouch = 0, t0 = g.t, hitT = null, freeT = null, back = null;
  const pl = g.players[0];
  for (let i = 0; i < 2.5 / DT; i++) {
    const t = g.t - t0;
    for (const e of g.step([H({ shotDown: t < 0.07 })])) {
      if (e.type === 'tackle' && e.phase === 'hit') { hitT = t; if (e.result === 'player') stumble = o.stumbleT; }
      if ((e.type === 'touch' || e.type === 'kick') && e.player === 2 && hitT != null && t - hitT < 0.55) oppTouch++;
    }
    if (hitT != null && freeT == null && g.ball.v.len() > 1) freeT = t;
    if (pl.slide == null && hitT != null && back == null) back = t;
  }
  check('Gegner zuerst getroffen: Gegner stolpert (kann 0,6 s nicht an den Ball)', stumble, 0.5, 0.65, 's', 0.6, `Gegner-Kontakte in der Zeit: ${oppTouch}`);
  check('… Ball springt frei', freeT != null && freeT - hitT < 0.05 ? 1 : 0, 1, 1, '', 1);
  check('Grätsche: rutschen + am Boden bis wieder frei', back ?? 9, 0.9, 1.25, 's', 1.1, '0,5 s rutschen + 0,6 s am Boden (ab Druck)');
}
// 4) Bots grätschen je Stufe, Selbstspiel ohne Hänger
{
  const per = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
  let stuck = 0, hits = 0, games = 0;
  for (let s = 1; s <= 9; s++) {
    const lv = ((s - 1) % 3) + 1;
    const r = playGame(300 + s, { levels: [lv, lv] });
    per[lv][0] += r.bot.tackles; per[lv][1]++; stuck += r.stuck.length; hits += r.events.tackle || 0; games++;
  }
  const rate = (lv) => per[lv][0] / per[lv][1];
  check('Bots grätschen gelegentlich (je Spiel, Stufe 2)', rate(2), 2, 15, '×', null, `Stufe 1: ${rate(1).toFixed(1)}, 2: ${rate(2).toFixed(1)}, 3: ${rate(3).toFixed(1)} je Spiel`);
  check('Selbstspiel mit Grätschen: keine Hänger (9 Spiele)', stuck, 0, 0, '×', 0, `Grätschen-Ereignisse ${(hits / games).toFixed(1)} je Spiel`);
}

process.exit(report('Grätsche', rows, 'tackle') ? 0 : 1);
