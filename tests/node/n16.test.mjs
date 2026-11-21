// n16 (Peter 21.11.2026): Nachtrag 1 – Marker aus (?marker), Eckflanke (?eckflanke), sicherer Abstoß (?abstoss); Dribbeltricks (?dribbel).
// Regler und Wirkung im Kleinen; Messungen: n16_*_probe.mjs (N16_BERICHT.md). Aufruf: node tests/node/n16.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { einKnopfArt, eckZone, torWinkel } from '../../src/sim/akro.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { FREI } from '../../src/sim/skills.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { rows.push({ name, value, lo, hi, unit, target, ok: value >= lo && value <= hi, note }); };
const yes = (name, c, note = '') => check(name, c ? 1 : 0, 1, 1, '', 1, note);
const P = makeParams('');

// A: Marker
yes('A: Standard marker 0 (keine Boden-Markierungen), ?marker=1 = an', P.marker === 0 && makeParams('marker=1').marker === 1);
// B: Eckflanke
yes('B: Standard eckflanke 1, ?eckflanke=0 = aus', P.eckflanke === 1 && makeParams('eckflanke=0').eckflanke === 0);
{
  const gx = 12;
  yes('B: Eckzone – 2 m vor der Grundlinie, 5 m seitlich ja; Elfmeterpunkt, Strafraum-Mitte nein',
    eckZone(P, gx, 10, 5) && eckZone(P, gx, 9, -4.5) && !eckZone(P, gx, 6, 0) && !eckZone(P, gx, 9, 1) && !eckZone(P, gx, 2, 6), `Torwinkel (10|5) ${torWinkel(P, gx, 10, 5).toFixed(1)}°, (6|0) ${torWinkel(P, gx, 6, 0).toFixed(1)}°`);
  const art = (qs) => {
    const Pq = makeParams(qs), g = new Game(Pq, 4, { match: true, human: 0 }); g.rules.phase = 'play';
    const me = g.players[0], hx = g.cage.hx; const f = Math.atan2(-5, 2.6); me.place(hx - 2.6, 5, f); g.ball.place(hx - 2.6 + 0.4 * Math.cos(f), g.ball.r, 5 + 0.4 * Math.sin(f)); g.lastTouch = 0;
    const m = g.players.find((p) => p.team === 0 && p.id !== 0 && p.id !== g.rules.keeper[0]); m.place(hx - 6, 0.5, 0);
    for (const o of g.players) if (o.team === 1 && o.id !== g.rules.keeper[1]) o.place(-4, -3 + o.id, 0);
    g.players[g.rules.keeper[1]].place(hx - 0.6, 0.8, Math.PI);
    return einKnopfArt(g, me, null);
  };
  yes('B: Ein-Knopf aus der Ecke (Mitspieler vor dem Tor frei) → Flanke statt Schuss; ?eckflanke=0 → Schuss', art('') === 'pass' && art('eckflanke=0') === 'shot', `neu ${art('')}, alt ${art('eckflanke=0')}`);
}
// C: Abstoß
yes('C: Standard abstoss 1, ?abstoss=0 = aus', P.abstoss === 1 && makeParams('abstoss=0').abstoss === 0);
{
  // Tormann (Mensch-Team bzw. Bot-Team) wirft zum Mitspieler 9 m vor ihm, ein Gegner steht mitten im Weg und läuft zum Ball
  const lauf = (qs, human) => {
    const g = new Game(makeParams(qs), 11, { match: true, human }); g.rules.phase = 'play'; g.bots = null;
    const R = g.rules, kp = g.players[R.keeper[0]], gx = R.goalX(0);
    const m = g.players.find((p) => p.team === 0 && p.id !== kp.id), o = g.players.find((p) => p.team === 1 && p.id !== R.keeper[1]);
    for (const p of g.players) if (p !== kp && p !== m && p !== o) p.place(p.team === 0 ? -2 : 8, p.team === 0 ? -6 : 6, 0);
    kp.place(gx + 1.2, 0, 0); m.place(gx + 10.2, 0.5, Math.PI); o.place(gx + 5.5, 0.3, Math.PI);
    g.ball.held = kp.id; kp.hand.mode = 'hold';
    R.release(kp, m.x, m.z, 'throw', 1);
    const art = g.events.find((e) => e.type === 'throw' || e.type === 'punt');
    let erst = -1;
    for (let i = 0; i < 600 && erst < 0; i++) {
      const ins = []; ins[o.id] = { mx: Math.sign(g.ball.p.x - o.x) || 0, mz: Math.sign(g.ball.p.z - o.z) * 0.5, shotDown: i % 20 < 2 };
      g.step(ins);
      if (g.lastTouch >= 0 && g.lastTouch !== kp.id) erst = g.lastTouch;
    }
    return { art: art && art.type, team: erst >= 0 ? g.players[erst].team : -1 };
  };
  const a = lauf('', 0), b = lauf('', -1), c = lauf('abstoss=0', -1);
  yes('C: Gegner im Wurfweg → Abschlag über ihn, erste Berührung beim Mitspieler (Mensch-Tormann und Bot-Tormann)', a.team === 0 && b.team === 0 && a.art === 'punt', `Mensch ${a.art} → Team ${a.team}, Bot ${b.art} → Team ${b.team}; ?abstoss=0: ${c.art} → Team ${c.team}`);
}
// Dribbeltricks
yes('D: Standard dribbel 1, chaos 0 (ersetzt), ?dribbel=0 = aus', P.dribbel === 1 && P.chaos === 0 && makeParams('dribbel=0').dribbel === 0);
yes('D: freie Tricks dauern 0,45 … 0,8 s', Object.values(FREI).every((f) => f.dur >= 0.45 && f.dur <= 0.8));
{
  // Mensch läuft mit Ball (Stick vorwärts), Gegner weit weg, Trick sicher ausgelöst (dribbelMensch 1); optional Kick-Druck während des Tricks
  const lauf = (kickBei = -1) => {
    const g = new Game(makeParams('dribbelMensch=1'), 21, { match: true, human: 1 }); g.rules.phase = 'play'; g.bots = null;
    const me = g.players[g.human];
    let k = 0; for (const p of g.players) if (p !== me) p.place(p.team === me.team ? -10 : 9, -5 + 3.3 * (k++ % 4), Math.PI);
    me.place(-6, 0, 0); g.ball.place(-5.6, g.ball.r, 0); g.lastTouch = me.id; me.besitzT = g.t; me.vx = 4; me.speed = 4;
    let start = -1, v0 = 0, vMin = 99, dMax = 0, kick = -1;
    for (let i = 0; i < 240; i++) {
      const ins = []; ins[g.human] = { ...EMPTY_INPUT, mx: 1, mz: 0, passDown: false, shotDown: kickBei >= 0 && start >= 0 && g.t >= start + kickBei && g.t < start + kickBei + 0.07 };
      const ev = g.step(ins);
      if (start < 0 && me.skill2 && me.skill2.frei) { start = g.t; v0 = me.speed; }
      if (start >= 0 && me.skill2) { vMin = Math.min(vMin, me.speed); dMax = Math.max(dMax, Math.hypot(g.ball.p.x - me.x, g.ball.p.z - me.z)); }
      if (kick < 0 && ev.some((e) => e.type === 'kick' && e.player === me.id)) kick = g.t;
    }
    return { start, v0, vMin, dMax, kick, lt: g.lastTouch === me.id };
  };
  const a = lauf();
  yes('D: freier Trick beim Laufen mit Ball ausgelöst, Tempo bleibt (≥ 90 %), Ball ≤ 1,1 m am Fuß', a.start >= 0 && a.vMin >= 0.9 * a.v0 && a.dMax <= 1.1, `Start ${a.start.toFixed(2)} s, Tempo ${a.v0.toFixed(2)} → min ${a.vMin.toFixed(2)} m/s, Ball bis ${a.dMax.toFixed(2)} m`);
  const b = lauf(0.12);
  check('D: Kick-Druck während des Tricks → Kick sofort (Abstand Druck → Kick)', b.kick >= 0 ? b.kick - (b.start + 0.12) : 9, 0, 0.25, 's', 0.1);
}

process.exit(report('n16 Marker, Ecke, Abstoß, Dribbeltricks', rows, 'n16') ? 0 : 1);
