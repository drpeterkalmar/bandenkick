// Nacht 2e (Peter 03.10.: „erlaube keinen Rückpass“): der eigene Tormann (letzte Hand im Torraum) ist kein Pass-Empfänger
// (Mensch und Bots), ein Stick Richtung eigenes Tor spielt nie aufs eigene Tor; spielt ein Mitspieler dem Tormann den Ball
// absichtlich zu, nimmt er ihn nicht mit den Händen (Hinweis einmal, kein Freistoß); nach einem Gegner-Kontakt wieder.
// 6 Bot-Spiele: 0 Rückpässe, 0 Hand-Aufnahmen nach Rückpass. ?rueckpass=1 = alt. Aufruf: node tests/node/rueckpass.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planPass } from '../../src/sim/pass.js';
import { holdProbe } from './keeper_hold_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const inp = (o = {}) => ({ ...EMPTY_INPUT, passDown: false, shotDown: false, ...o });
const mk = (qs = '', per = [2, 1]) => { const g = new Game(makeParams(qs), 3, { match: true, perTeam: per, human: -1, bots: false }); g.rules.phase = 'play'; return g; };

// 1) Pass-Auswahl: Tormann im Torraum im Stick-Kegel → nicht er; nur er im Kegel → nie aufs eigene Tor
for (const qs of ['', 'rueckpass=1']) {
  const g = mk(qs, [3, 1]);
  const [a, kp, m, o] = g.players, gx = -g.cage.hx;
  kp.place(gx + 1.5, 0.5, 0); a.place(gx + 9, 0.5, Math.PI); g.ball.place(gx + 8.6, 0.11, 0.5);
  m.place(gx + 6, 5.5, 0); o.place(gx + 14, -3, Math.PI);
  g.rules.updateKeepers(0, true);
  const toKp = planPass(g, a, { stick: [-1, 0] });
  const D0 = Math.hypot(toKp.target[0] - gx, toKp.target[1]);
  if (!qs) {
    check('Stick aufs eigene Tor (Tormann im Kegel): Pass nicht zum Tormann', toKp.to === kp.id ? 0 : 1, 1, 1, '', 1, `Empfänger ${toKp.to} (Mitspieler im erweiterten Kegel: ${m.id}), Ziel (${toKp.target.map((v) => v.toFixed(1)).join(', ')})`);
    check('… Ziel nicht im eigenen Torraum (+ 1 m)', D0, g.P.torraum + 1, Infinity, 'm', null, `Abstand Ziel ↔ Tormitte ${D0.toFixed(1)} m`);
    m.place(gx + 14, 6.5, 0); // kein Mitspieler im erweiterten Kegel → seitlich in den freien Raum
    const side = planPass(g, a, { stick: [-1, 0.05] });
    const D1 = Math.hypot(side.target[0] - gx, side.target[1]);
    const segMin = (() => { let mn = 99; for (let k = 0; k <= 20; k++) { const x = g.ball.p.x + (side.target[0] - g.ball.p.x) * k / 20, z = g.ball.p.z + (side.target[1] - g.ball.p.z) * k / 20; mn = Math.min(mn, Math.hypot(x - gx, z)); } return mn; })();
    check('Stick aufs eigene Tor, niemand im erweiterten Kegel: seitlich in den freien Raum', side.to === -1 && segMin >= g.P.torraum + 1 - 0.05 ? 1 : 0, 1, 1, '', 1, `Empfänger ${side.to}, Ziel (${side.target.map((v) => v.toFixed(1)).join(', ')}), Weg ≥ ${segMin.toFixed(1)} m vom Tor, Ziel ${D1.toFixed(1)} m`);
  } else check('?rueckpass=1: Stick aufs eigene Tor → Pass zum Tormann (alt)', toKp.to === kp.id ? 1 : 0, 1, 1, '', 1);
}

// 2) Regel: Mitspieler spielt dem Tormann den Ball zu → keine Hände, Hinweis einmal; nach Gegner-Kontakt wieder Hände
function backPass(qs, oppTouch = false) {
  const g = mk(qs, [2, 1]);
  const [kp, a, o] = g.players, gx = -g.cage.hx;
  kp.place(gx + 1.2, 0, 0); a.place(gx + 8, 0.3, Math.PI); g.ball.place(gx + 7.6, 0.11, 0.3);
  o.place(gx + 14, 5, Math.PI);
  g.rules.updateKeepers(0, true);
  a.kickAt({ kind: 'pass', target: [kp.x, kp.z], speed: 8, to: kp.id });
  let caught = false, told = 0, footTouch = false;
  for (let i = 0; i < 2.5 / DT; i++) {
    const ins = []; ins[kp.id] = inp({ autoCatch: true, hand: true }); ins[a.id] = inp(); ins[o.id] = inp();
    if (oppTouch && i === Math.round(0.25 / DT) && g.ball.held < 0) { o.place(g.ball.p.x, g.ball.p.z + 2, Math.PI); g.rules.touch(o); /* Kontakt ohne Körper im Weg */ }
    for (const e of g.step(ins)) {
      if (e.type === 'catch' && e.player === kp.id) caught = true;
      if (e.type === 'rueckpass') told++;
      if ((e.type === 'touch' || e.type === 'kick') && e.player === kp.id) footTouch = true;
    }
  }
  return { caught, told, footTouch, held: g.ball.held };
}
{
  const r = backPass(''), r1 = backPass('rueckpass=1'), r2 = backPass('', true);
  check('Rückpass vom Mitspieler: Tormann nimmt keine Hände', r.caught ? 0 : 1, 1, 1, '', 1, `gefangen ${r.caught}, mit dem Fuß gespielt ${r.footTouch}`);
  check('… Hinweis „Rückpass – keine Hände“ genau einmal (kein Freistoß)', r.told, 1, 1, '×', 1);
  check('… nach einem Gegner-Kontakt darf er wieder fangen', r2.caught ? 1 : 0, 1, 1, '', 1);
  check('?rueckpass=1: Tormann fängt den Rückpass (alt)', r1.caught ? 1 : 0, 1, 1, '', 1);
}
// 3) Auto-Torwart des Menschen bekommt einen Rückpass: keine Hände, er spielt ihn als Feldspieler
{
  const g = new Game(makeParams(''), 4, { match: true, perTeam: [2, 1], human: 0 });
  g.rules.phase = 'play';
  const [kp, a, o] = g.players, gx = -g.cage.hx;
  kp.place(gx + 1.2, 0, 0); a.place(gx + 8, 0.3, Math.PI); g.ball.place(gx + 7.6, 0.11, 0.3); o.place(gx + 16, 5, Math.PI);
  g.rules.updateKeepers(0, true); g.setHuman(kp.id);
  a.kickAt({ kind: 'pass', target: [kp.x, kp.z], speed: 8, to: kp.id });
  let caught = false;
  for (let i = 0; i < 2 / DT; i++) { const ins = []; ins[g.human] = inp(); for (const e of g.step(ins)) if (e.type === 'catch' && e.player === kp.id) caught = true; }
  check('Auto-Torwart (Mensch): Rückpass nicht gefangen', caught ? 0 : 1, 1, 1, '', 1);
}
// 4) Bot-Spiele: keine Rückpässe, keine Hand nach Rückpass (vorher/nachher)
{
  const N = +(process.env.RUECK_N || 6);
  const neu = holdProbe('', N), alt = holdProbe('rueckpass=1', N);
  check(`Bot-Spiele (${N}): Pässe zum eigenen Tormann im Torraum`, neu.backPass, 0, 0, '×', 0, `von ${neu.passes} Pässen · vorher (?rueckpass=1) ${alt.backPass} von ${alt.passes}`);
  check(`Bot-Spiele (${N}): Hand-Aufnahmen nach Rückpass`, neu.backCatch, 0, 0, '×', 0, `von ${neu.catches} Fängen · vorher ${alt.backCatch} von ${alt.catches}`);
  check('Bot-Spiele: Numerik-Fehler', neu.faults, 0, 0, '×', 0, `Tore ${neu.goals} (vorher ${alt.goals}), Haltezeit Median ${neu.med.toFixed(2)} s`);
}
process.exit(report('Kein Rückpass (Nacht 2e)', rows, 'rueckpass') ? 0 : 1);
