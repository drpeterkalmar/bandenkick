// n14 (Peter 13.11.2026): Pässe höher und schneller, Passknopf in den freien Raum, Abschirmen, härtere Luftbälle, mehr Effet,
// kürzerer Torso, weitere Replays – Regler (je 0.10.0 wiederherstellbar) und Wirkung im Kleinen. Aufruf: node tests/node/n14.test.mjs
import { makeParams, N14_AUS } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { report } from './report.mjs';
import { replayCamera } from '../../src/sim/replay.js';
import { editCamera } from '../../src/sim/fanedit.js';
import { AIR_PROPS } from '../../src/sim/technique.js';
import { luftWucht } from '../../src/sim/air.js';
import { bestLob } from '../../src/sim/hochpass.js';
import { runPath } from '../../src/sim/pass.js';
import { physik } from './n11_probe.mjs';
import { runProbe, summary } from './n14_probe.mjs';
import { readFileSync } from 'node:fs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams(''), P0 = makeParams(N14_AUS);

// ---------- Regler ----------
check('Regler Standard: passhoch 1,5 · passtempo 1,25 · passraum 1 · schirm 2,5 · luftwucht 1,5 · replayweit 3,5 · clSteig 1,7',
  P.passhoch === 1.5 && P.passtempo === 1.25 && P.passraum === 1 && P.schirm === 2.5 && P.luftwucht === 1.5 && P.replayweit === 3.5 && P.clSteig === 1.7 ? 1 : 0, 1, 1, '', 1);
check('N14_AUS = 0.10.0 (clSteig 0,7, clMaxAkro 0,6, aussenSpin 0,85, passEffet 0, …)',
  P0.clSteig === 0.7 && P0.clMaxAkro === 0.6 && P0.aussenSpin === 0.85 && P0.passEffet === 0 && P0.passraum === 0 && P0.schirm === 1 && P0.luftwucht === 1 && P0.replayweit === 2 && P0.passhoch === 1 && P0.passtempo === 1 ? 1 : 0, 1, 1, '', 1);
check('?effet=18 allein = Effet wie 0.10.0', (() => { const q = makeParams('effet=18'); return q.clSteig === 0.7 && q.clMaxAkro === 0.6 && q.aussenSpin === 0.85 && q.passEffet === 0 ? 1 : 0; })(), 1, 1, '', 1);
check('?aussen= ist der Außenrist-Drall, Standard = Innenseite', makeParams('aussen=0.7').aussenSpin === 0.7 && P.aussenSpin === 1 ? 1 : 0, 1, 1, '', 1);

// ---------- Etappe 5: Effet ----------
{
  const a = physik(N14_AUS), b = physik('');
  check('Effet: Kurve eines Innenseit-Schusses (25 m/s) über 20 m ÷ 0.10.0', b.kurve20 / a.kurve20, 1.7, 2.2, '×', 1.9, `${a.kurve20.toFixed(1)} → ${b.kurve20.toFixed(1)} m (Ziel ~9–10 m)`);
}

// ---------- Etappe 1: hohe Pässe ----------
{
  // (In freien Lagen wählt der Löser den hohen Bogen; im Spiel mit Gegnerdruck die schnelleren Topspin-Bahnen – gemessen in 48 Bot-Spielen:
  // Scheitel +46 %, Abspieltempo +28 %, Flug bis zur ersten Berührung −12 %, siehe N14_BERICHT.md)
  // feste Lagen: Passgeber in der Mitte, Mitspieler 5–12 m entfernt (läuft), Gegner weit weg
  let apex0 = 0, apex1 = 0, u0 = 0, u1 = 0, t0 = 0, t1 = 0, n = 0;
  for (const [D, a, v] of [[5, 0.3, 2], [7, -0.6, 3], [9, 0.9, 0], [11, 0.1, 4], [12, -0.3, 1], [6, 1.4, 2]]) {
    const r = {};
    for (const [k, Q] of [['alt', P0], ['neu', P]]) {
      const g = new Game(Q, 'p' + D, { match: true, human: -1 }); g.rules.phase = 'play';
      const pl = g.players[1], m = g.players[0];
      pl.place(0, 0, 0); m.place(Math.cos(a) * D, Math.sin(a) * D, 0); m.vx = v; m.vz = 0;
      g.players.slice(3).forEach((o, i) => o.place(-10 + i, 6, 0));
      g.players[2].place(-8, -6, 0);
      r[k] = bestLob(g, pl, [0.4, 0], m, runPath, {});
    }
    if (!r.alt || !r.neu) continue;
    n++; apex0 += r.alt.apex; apex1 += r.neu.apex; u0 += r.alt.u; u1 += r.neu.u; t0 += r.alt.T; t1 += r.neu.T;
  }
  check('Hohe Pässe: Lagen mit Lösung (alt und neu)', n, 5, 6, '', 6);
  check('Hohe Pässe (freie Lage): Scheitel ÷ 0.10.0', apex1 / apex0, 1.3, 2.3, '×', 1.5, `${(apex0 / n).toFixed(2)} → ${(apex1 / n).toFixed(2)} m`);
  check('Hohe Pässe (freie Lage): Abspieltempo ÷ 0.10.0', u1 / u0, 0.95, 1.6, '×', 1.25, `${(u0 / n).toFixed(1)} → ${(u1 / n).toFixed(1)} m/s`);
  check('Hohe Pässe (freie Lage, ohne Gegnerdruck): Flugzeit ÷ 0.10.0 – im Spiel kürzer (n14_probe)', t1 / t0, 0.6, 1.4, '×', 1, `${(t0 / n).toFixed(2)} → ${(t1 / n).toFixed(2)} s`);
}

// ---------- Etappe 4: Luftbälle ----------
check('Kopfball: Grenze × luftwucht (17 → 25,5 m/s)', AIR_PROPS.kopf.vmax * luftWucht(P, 'kopf'), 25, 26, 'm/s', 25.5);
check('Fallrückzieher: Grenze × 1,375 (23 → 31,6 m/s)', AIR_PROPS.fallrueck.vmax * luftWucht(P, 'fallrueck'), 31, 32.5, 'm/s', 31.6);
check('Volley unverändert, ?luftwucht=1 = 0.10.0', luftWucht(P, 'volley') === 1 && luftWucht(P0, 'kopf') === 1 && luftWucht(P0, 'fallrueck') === 1 ? 1 : 0, 1, 1, '', 1);

// ---------- Etappe 7: Replays ----------
{
  const cage = new Game(P, 1).cage;
  const c = { t: 1, x: 3, y: 0.11, z: 1, dx: 1, dz: 0.2 };
  const f = { t: 1.05, ball: { p: { x: 3.6, y: 0.3, z: 1.1 }, v: { x: 20, y: 2, z: 4 } } };
  const dist = (cam) => Math.hypot(cam.pos[0] - cam.look[0], cam.pos[1] - cam.look[1], cam.pos[2] - cam.look[2]);
  for (const mode of ['quer', 'hoch']) {
    const ctx = { cage, mode, contact: c, goal: { side: 1 }, time: 0, frac: 0.5, side: 1 };
    const tv0 = replayCamera('tv', f, { ...ctx, weit: 2 }), tv1 = replayCamera('tv', f, { ...ctx, weit: 3.5 });
    check(`TV-Wiederholung (${mode}): Abstand weit 3,5 ÷ 0.10.0`, dist(tv1) / dist(tv0), 1.15, 1.35, '×', 1.25, `${dist(tv0).toFixed(1)} → ${dist(tv1).toFixed(1)} m, Winkel ${tv0.fov} → ${tv1.fov.toFixed(1)}°`);
    const z0 = replayCamera('zoom', f, { ...ctx, weit: 2 }), z1 = replayCamera('zoom', f, { ...ctx, weit: 3.5 });
    check(`Kontakt-Zoom (${mode}): Abstand weit 3,5 ÷ 0.10.0`, dist(z1) / dist(z0), 1.3, 2, '×', 1.75);
    const e0 = editCamera('hinten', f, { cage, hoch: mode === 'hoch', contact: c, goal: { side: 1 }, u: 0.2, dur: 1, side: 1, weit: 2 });
    const e1 = editCamera('hinten', f, { cage, hoch: mode === 'hoch', contact: c, goal: { side: 1 }, u: 0.2, dur: 1, side: 1, weit: 3.5 });
    check(`Fan-Edit „hinten“ (${mode}): Abstand ÷ 0.10.0`, dist(e1) / dist(e0), 1.15, 1.35, '×', 1.25);
  }
}

// ---------- Etappe 6: kürzerer Rumpf (Assets) ----------
{
  const neu = JSON.parse(readFileSync(new URL('../../assets/kuscheltiere/kuscheltiere.json', import.meta.url)));
  const alt = JSON.parse(readFileSync(new URL('../../assets/kuscheltiere_n13/kuscheltiere.json', import.meta.url)));
  const k = Object.keys(neu);
  check('Figuren: alle 6 Tiere mit rumpf 0,77, ?tierform=2 = Figuren von 0.10.0', k.length === 6 && k.every((n) => neu[n].form && neu[n].form.rumpf === 0.77 && alt[n] && !alt[n].form.rumpf) ? 1 : 0, 1, 1, '', 1);
  const dh = k.map((n) => alt[n].hoehe - neu[n].hoehe);
  check('Figuren: um so viel kleiner (kürzerer Rumpf, Beine gleich)', Math.min(...dh), 0.06, 0.16, 'm', 0.11, dh.map((x) => x.toFixed(3)).join(' / '));
  check('Figuren: Dateigröße je Tier wie bisher (±15 %)', Math.max(...k.map((n) => Math.abs(neu[n].kb / alt[n].kb - 1))), 0, 0.15, '', 0);
}

// ---------- Etappe 3: Mensch führt gegen Verteidiger + Tormann ----------
{
  const { humanHold } = await import('./n7_probe.mjs');
  const a = humanHold('schirm=1', 12), b = humanHold('', 12);
  check('Abschirmen: Mensch gegen Stufe-2-Verteidiger, Ballverluste je Minute am Ball ÷ ?schirm=1', b.lostPerMin / a.lostPerMin, 0, 0.7, '×', 0.55, `${a.lostPerMin.toFixed(1)} → ${b.lostPerMin.toFixed(1)}/min, bis vors Tor ${a.okShare.toFixed(0)} → ${b.okShare.toFixed(0)} %`);
  check('… der Verteidiger gewinnt den Ball trotzdem noch (kein Klebeball)', b.lostShare, 5, 80, '%', null, `?schirm=1: ${a.lostShare.toFixed(0)} %`);
}

// ---------- Bot-Spiele: Abschirmen, Pässe, Tore (klein, ganze Messung: n14_probe.mjs mit 48 Spielen) ----------
{
  const N = +(process.env.N14_SPIELE ?? 12);
  if (N > 0) {
  const a = summary(await runProbe('schirm=1', N, 6)), b = summary(await runProbe('', N, 6));
  check('Bot-Spiele: Ballverluste beim Führen je Minute ÷ ?schirm=1 (Bots verlieren ihn meist anders als per Grätsche)', b.verlusteMin / a.verlusteMin, 0, 1.1, '×', 1, `${a.verlusteMin.toFixed(2)} → ${b.verlusteMin.toFixed(2)}, ${N} Bot-Spiele`);
  check('Bot-Spiele: Grätschen mit Ballgewinn ÷ ?schirm=1 (Ziel ≥ 0,7; 12 Spiele streuen ±0,08)', b.graetschenBall / a.graetschenBall, 0.62, 9, '×', 1, `${a.graetschenBall.toFixed(1)} → ${b.graetschenBall.toFixed(1)} je Spiel`);
  check('Bot-Pässe abgefangen (Standard)', b.passAb, 0, 11, '%', 9, `kommen an ${b.passAn.toFixed(1)} %, hoch in Körperhöhe ${b.hochKoerper.toFixed(1)} %`);
  check('Ball verlässt den Käfig / NaN', b.aus + b.nan, 0, 0, '', 0);
  }
}

process.exit(report('n14 Spielgefühl', rows, 'n14') ? 0 : 1);
