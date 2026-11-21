// n16 (Peter 21.11.2026): Nachtrag 1 – Marker aus (?marker), Eckflanke (?eckflanke), sicherer Abstoß (?abstoss); Dribbeltricks (?dribbel).
// Regler und Wirkung im Kleinen; Messungen: n16_*_probe.mjs (N16_BERICHT.md). Aufruf: node tests/node/n16.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { einKnopfArt, eckZone, torWinkel } from '../../src/sim/akro.js';
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

process.exit(report('n16 Marker, Ecke, Abstoß, Dribbeltricks', rows, 'n16') ? 0 : 1);
