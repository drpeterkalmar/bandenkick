// n7 Vorlagen E2 (Nachdrall nach dem Schuss): reine Funktionen (Abkling-Gewichte, Stick relativ zur Schussrichtung),
// gleicher Schuss mit/ohne Nachdrall (seitlicher Versatz nach 15 m, Höhe), Stick beim Kontakt zählt nicht, Regler aus,
// Bot-Spiel (Torquote mit/ohne, Hänger). Aufruf: node tests/node/nachdrall.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { ndShare, ndStick, ND_W } from '../../src/sim/nachdrall.js';
import { runProbe, summary } from './n7_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');

// 1) Abklingen: Summe 1, erste drei Abschnitte 12/23, erste 0,08 s ≥ 50 %
{
  let sum = 0; for (let t = 0; t < P.nachdrallT + DT; t += DT) sum += ndShare(t, DT, P.nachdrallT);
  check('Gewichte: Summe über das Fenster', sum, 0.999, 1.001, '', 1);
  const first3 = ndShare(0, 3 * P.nachdrallT / ND_W.length, P.nachdrallT);
  check('… erste drei Abschnitte (5-4-3 von 23)', 100 * first3, 52, 52.3, '%', 52.2);
  check('… in den ersten 0,08 s', 100 * ndShare(0, 0.08, P.nachdrallT), 50, 100, '%', null);
  const s = ndStick(0, -1, 1, 0); // Schuss nach +x, Stick nach −z = links
  check('Stick relativ zur Schussrichtung: −z bei Schuss nach +x = links', s.lat, 1, 1, '', 1);
}

// 2) Gleicher Schuss (Training, Spieler 0 = Mensch, 22 m/s, 7° nach +x), danach Stick → Ball nach 15 m
function shot(qs, stickAfter, stickAt = [0, 0], v = 22, el = 7) {
  const g = new Game(makeParams(qs), 5, { perTeam: [1, 0] });
  const pl = g.players[0], b = g.ball;
  pl.place(-6.6, 0, 0); b.place(-6.15, b.r, 0); b.v.set(0, 0, 0);
  pl.kickAt({ kind: 'shot', target: [9, 0.6], technique: 'vollspann', speed: v, elev: el, noise: 0 });
  let kicked = false, x0 = 0, z0 = 0, res = null, nd = null;
  for (let i = 0; i < 3 / DT && !res; i++) {
    const inp = { ...EMPTY_INPUT, mx: kicked ? stickAfter[0] : stickAt[0], mz: kicked ? stickAfter[1] : stickAt[1] };
    for (const e of g.step([inp])) {
      if (e.type === 'kick') { kicked = true; x0 = e.x; z0 = e.z; }
      if (e.type === 'nachdrall') nd = e;
    }
    if (kicked && b.p.x >= x0 + 15) res = { z: b.p.z - z0, y: b.p.y, nd };
  }
  return res || { z: NaN, y: NaN, nd };
}
{
  const o = shot('', [0, 0]), l = shot('', [0, -1]), r = shot('', [0, 1]);
  check('Kein Stick: kein Nachdrall-Ereignis', o.nd ? 1 : 0, 0, 0, '', 0);
  check('Stick voll links: seitlicher Versatz nach 15 m', o.z - l.z, 1.5, 3, 'm', null, `ohne ${o.z.toFixed(2)} m, links ${l.z.toFixed(2)} m, rechts ${r.z.toFixed(2)} m; Drall ${l.nd ? l.nd.side.toFixed(1) : '-'} U/s`);
  check('… rechts spiegelbildlich', r.z - o.z, 1.5, 3, 'm', null);
  const half = shot('', [0, -0.5]);
  check('Stick halb: halber Drall', half.nd ? half.nd.side / l.nd.side : 0, 0.4, 0.6, '×', 0.5, `Kurve ${((o.z - half.z) / (o.z - l.z)).toFixed(2)} × (der Auftrieb sättigt)`);
  const o10 = shot('', [0, 0], [0, 0], 24, 10), back = shot('', [-1, 0], [0, 0], 24, 10);
  check('Stick zurück: Ball steigt (24 m/s, 10°, Höhe nach 15 m)', back.y - o10.y, 0.5, 3, 'm', null, `ohne ${o10.y.toFixed(2)} m, zurück ${back.y.toFixed(2)} m`);
  const o14 = shot('', [0, 0], [0, 0], 24, 14), fwd = shot('', [1, 0], [0, 0], 24, 14);
  check('Stick vor: Ball taucht ab (24 m/s, 14°)', o14.y - fwd.y, 0.4, 3, 'm', null, `ohne ${o14.y.toFixed(2)} m, vor ${fwd.y.toFixed(2)} m`);
  const held = shot('', [0, -1], [0, -1]);
  check('Stick schon beim Kontakt so gehalten: keine Kurve', Math.abs(held.z - o.z), 0, 0.1, 'm', 0);
  const off = shot('nachdrall=0', [0, -1]);
  check('?nachdrall=0: keine Kurve', Math.abs(off.z - o.z), 0, 0.02, 'm', 0);
  const slow = shot('', [0, -1], [0, 0], 12), slow0 = shot('', [0, 0], [0, 0], 12);
  check('Langsamer Schuss (12 m/s): schwächerer Drall (× Wucht)', slow.nd ? slow.nd.side / l.nd.side : 0, 0.3, 0.6, '×', 0.48, `Versatz ${(slow0.z - slow.z).toFixed(2)} m`);
}

// 3) Bot-Spiel Stufe 2 (20 Spiele): Bots mit 15 % Nachdrall – Torquote höchstens +10 Punkte, Hänger 0
{
  const s = summary(await runProbe('', 20, 'st2', 6)), s0 = summary(await runProbe('nachdrall=0', 20, 'st2', 6));
  check('Bot-Spiel: Nachdrall je Spiel (Stufe 2, 15 %)', s.nachdrallPerGame, 3, 15, '', null, `Schüsse/Spiel ${s.shotsPerGame.toFixed(1)}`);
  check('… Torquote mit − ohne Nachdrall', s.goalsPerShot - s0.goalsPerShot, -10, 10, 'Punkte', 0, `${s.goalsPerShot.toFixed(1)} % / ?nachdrall=0: ${s0.goalsPerShot.toFixed(1)} %`);
  check('… Tore je Schuss im Ziel', s.goalsPerShot, 25, 35, '%', 30);
  check('… Hänger / Numerik', s.stuck + s.faults, 0, 0, '', 0);
}
process.exit(report('Nachdrall (n7 Vorlagen E2)', rows, 'nachdrall') ? 0 : 1);
