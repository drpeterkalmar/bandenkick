// n8 (Peter 26.10.: „Spielerwechsel braucht keiner“): Der ⇄-Knopf ist weg – belegt wird, dass der gesteuerte Spieler ohne
// Wechsel-Eingabe automatisch wechselt: zum ballnächsten Mitspieler (Zeit zum Ball, Hysterese 0,18 s, frühestens nach
// switchT), nach dem eigenen Pass sofort zum Empfänger, beim Ball in der Hand des eigenen Tormanns zum Tormann. Dazu ganze
// Spiele mit einem Skript-Menschen (läuft zum Ball, führt, passt), der nie wechselt. Tastatur C/Tab (inp.switch) bleibt.
// Aufruf: node tests/node/wechsel.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const P = makeParams('');
const ttb = (g, p) => Math.hypot(g.ball.p.x + g.ball.v.x * 0.3 - p.x, g.ball.p.z + g.ball.v.z * 0.3 - p.z) / g.P.vTop;

// 1) Ball frei, ein Mitspieler deutlich näher → Wechsel ohne Eingabe nach switchT
{
  const g = new Game(P, 1, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play'; g.switchT = 5;
  const [a, b, o] = g.players;
  a.place(-8, -4, 0); b.place(2, 3, 0); o.place(10, -6, Math.PI); g.ball.place(3, g.ball.r, 2);
  let t = -1;
  for (let i = 0; i < 1.5 / DT && t < 0; i++) { const ins = []; ins[g.human] = H(); g.step(ins); if (g.human === b.id) t = g.t; }
  check('Ball frei, Mitspieler näher am Ball: wechselt ohne Eingabe', t, 0, 0.1, 's', 0, `gesteuert danach Spieler ${g.human}`);
}
// 2) Eigener Pass → sofort der Empfänger (auch wenn der Passgeber näher am Ball bleibt)
{
  const g = new Game(P, 2, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play'; g.switchT = 5;
  const [a, b, o] = g.players;
  a.place(-4, 0, 0); b.place(4, 0, Math.PI); o.place(8, 6, Math.PI); g.ball.place(-3.6, g.ball.r, 0);
  g.lastTouch = a.id; a.lastTouchT = 0;
  let kickT = -1, swT = -1;
  for (let i = 0; i < 1.5 / DT && swT < 0; i++) {
    const ins = []; ins[g.human] = H(g.t < 0.07 ? { passDown: true, mx: 1 } : {});
    for (const e of g.step(ins)) if (e.type === 'kick' && e.player === a.id && kickT < 0) kickT = g.t;
    if (kickT >= 0 && g.human === b.id) swT = g.t - kickT;
  }
  check('Nach dem eigenen Pass: Steuerung beim Empfänger', swT, 0, 2 * DT + 1e-9, 's', 0, `Pass nach ${kickT.toFixed(2)} s`);
}
// 3) Gegner hat den Ball, ein Mitspieler steht näher → wechselt zu ihm
{
  const g = new Game(P, 3, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play'; g.switchT = 5;
  const [a, b, o] = g.players;
  a.place(9, 5, 0); b.place(-3, -1, 0); o.place(-4, 0, Math.PI); g.ball.place(-4.4, g.ball.r, 0);
  g.lastTouch = o.id; o.lastTouchT = 0;
  let t = -1;
  for (let i = 0; i < 1.5 / DT && t < 0; i++) { const ins = []; ins[g.human] = H(); g.step(ins); if (g.human === b.id) t = g.t; }
  check('Gegner am Ball, Mitspieler näher: wechselt ohne Eingabe', t, 0, 0.1, 's', 0);
}
// 4) Tastatur C/Tab bzw. Gamepad Y (inp.switch) wechselt weiter von Hand
{
  const g = new Game(P, 4, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play'; g.switchT = 5;
  const [a, b, o] = g.players;
  a.place(-1, 0, 0); b.place(6, 4, 0); o.place(9, -5, Math.PI); g.ball.place(-0.6, g.ball.r, 0); g.lastTouch = a.id;
  const ins = []; ins[g.human] = H({ switch: true }); g.step(ins);
  check('C/Tab/Gamepad Y wechselt von Hand', g.human, b.id, b.id, '', b.id);
}

// 5) Ganze Spiele 3 gegen 3 (2 × 2 min, Bots Stufe 2): Skript-Mensch ohne Wechsel-Eingabe. Gemessen: Wechsel je Minute,
// Anteil der Zeit (Ball frei oder beim Gegner), in der der Gesteuerte der ballnächste eigene Spieler ist (Hysterese 0,2 s),
// längste Zeit, in der ein Mitspieler klar näher (≥ 0,5 s Laufzeit) am Ball war, Pässe → Empfänger gesteuert.
function scriptGame(seed) {
  const g = new Game(P, 'w' + seed, { match: true, human: 1, botLevel: 2 });
  const r = { switches: 0, near: 0, tot: 0, worst: 0, cur: 0, passes: 0, passOk: 0, blocked: 0, minutes: 0 };
  let pressT = -9, pend = null;
  while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 120) {
    const me = g.players[g.human], b = g.ball;
    const mates = g.players.filter((p) => p.team === me.team && p.id !== me.id);
    const bd = Math.hypot(b.p.x - me.x, b.p.z - me.z);
    let inp;
    if (g.t - pressT < 0.07) inp = H({ passDown: true, mx: pend[0], mz: pend[1] });
    else if (g.lastTouch === me.id && bd < 1.2 && g.rules.phase === 'play' && b.held < 0) {
      // führt Richtung gegnerisches Tor, nach ~1 s Pass zum vordersten Mitspieler (Stick zeigt auf ihn)
      const gx = me.team === 0 ? g.cage.hx : -g.cage.hx;
      if (me.lastTouchT > 0.9 && mates.length) {
        const m = mates.reduce((a, c) => (Math.abs(gx - c.x) < Math.abs(gx - a.x) ? c : a));
        const dx = m.x - b.p.x, dz = m.z - b.p.z, l = Math.hypot(dx, dz) || 1; pend = [dx / l, dz / l]; pressT = g.t;
        inp = H({ passDown: true, mx: pend[0], mz: pend[1] });
      } else { const dx = gx - me.x, dz = -me.z * 0.5, l = Math.hypot(dx, dz) || 1; inp = H({ mx: dx / l * 0.8, mz: dz / l * 0.8 }); }
    } else { const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1; inp = H(l > 0.3 ? { mx: dx / l, mz: dz / l } : {}); }
    const ins = []; ins[g.human] = inp;
    const ev = g.step(ins);
    for (const e of ev) {
      if (e.type === 'switch') r.switches++;
      // (im selben Takt schon von einem anderen berührt = am Fuß geblockt: dann bleibt der Ball weg vom Empfänger, kein Wechsel)
      if (e.type === 'kick' && e.kind === 'pass' && e.player === me.id && e.to >= 0 && e.to !== me.id && g.players[e.to].team === me.team) { if (g.lastTouch !== me.id) { r.blocked++; continue; } r.passes++; if (g.human === e.to) r.passOk++; }
    }
    const h = g.players[g.human];
    const own = g.lastTouch >= 0 && g.players[g.lastTouch].team === h.team && Math.hypot(b.p.x - g.players[g.lastTouch].x, b.p.z - g.players[g.lastTouch].z) < 2.2;
    if (g.rules.phase === 'play' && b.held < 0 && !own && h.hand.mode !== 'dive' && h.hand.mode !== 'ground') {
      const th = ttb(g, h), tm = Math.min(...g.players.filter((p) => p.team === h.team && p.id !== h.id).map((p) => ttb(g, p)));
      r.tot += DT; if (th <= tm + 0.2) r.near += DT;
      if (tm < th - 0.5) { r.cur += DT; r.worst = Math.max(r.worst, r.cur); } else r.cur = 0;
    } else r.cur = 0;
  }
  r.minutes = g.t / 60;
  return r;
}
{
  const S = { switches: 0, near: 0, tot: 0, worst: 0, passes: 0, passOk: 0, blocked: 0, minutes: 0 };
  const N = +(process.env.WECHSEL_N || 6);
  for (let s = 1; s <= N; s++) { const r = scriptGame(s); for (const k of Object.keys(S)) S[k] = k === 'worst' ? Math.max(S.worst, r.worst) : S[k] + r[k]; }
  check(`${N} Spiele (2 × ${P.dauer} min) ohne Wechsel-Eingabe: automatische Wechsel je Minute`, S.switches / S.minutes, 3, 60, '/min', null, `${S.switches} Wechsel in ${S.minutes.toFixed(1)} min`);
  check('… Ball frei/beim Gegner: Gesteuerter ist der ballnächste eigene Spieler (± 0,2 s)', 100 * S.near / Math.max(1e-9, S.tot), 85, 100, '%', null, `${S.tot.toFixed(0)} s gemessen`);
  check('… längste Zeit, in der ein Mitspieler klar näher war (≥ 0,5 s Laufzeit)', S.worst, 0, 1.0, 's', null, `Mindestabstand zweier Wechsel switchT = ${P.switchT} s`);
  check('… eigener Pass zum Mitspieler → Steuerung beim Empfänger', 100 * S.passOk / Math.max(1, S.passes), 100, 100, '%', 100, `${S.passes} Pässe (dazu ${S.blocked} gleich am Fuß geblockt)`);
}
process.exit(report('Spielerwechsel automatisch (n8, ohne ⇄-Knopf)', rows, 'wechsel') ? 0 : 1);
