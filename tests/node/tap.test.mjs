// Tipp-Grammatik (Nacht 2c, Standard): Tipp = Standard mit Auto-Stärke, Doppeltipp = Zweitfunktion, kein Aufladen.
// Parser-Regeln im 120-Hz-Takt, 1000 Zufalls-Gesten (jeder erste Druck genau ein Ergebnis), dazu im Spiel: Tipp →
// Ballkontakt im Mittel ≤ 0,2 s beim Führen, Tipp/Doppeltipp auf Pass und Schuss, Halten wie Tipp, Schuss-Stärke nach
// Entfernung, ?laden=1 = alte Lade-Grammatik. Aufruf: node tests/node/tap.test.mjs
import { newGestures, stepGestures, TAP_CFG } from '../../src/input/gesture.js';
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const cfg = TAP_CFG;
const f3 = (v) => (v == null ? '–' : v.toFixed(3));

function play(presses, T = 1.5) {
  const g = newGestures(), ev = [];
  for (let i = 0; i <= Math.round(T / DT); i++) {
    const t = i * DT, down = { pass: false, shot: false };
    for (const [a, b, btn] of presses) if (t >= a - 1e-9 && t < b - 1e-9) down[btn] = true;
    for (const e of stepGestures(g, t, down, cfg)) ev.push(e);
  }
  return ev;
}
const find = (ev, btn, type, mode) => ev.find((e) => e.btn === btn && e.type === type && (!mode || e.mode === mode));

// 1) Parser
{
  const ev = play([[0.1, 0.17, 'pass']]);
  const st = find(ev, 'pass', 'start'), tap = find(ev, 'pass', 'tap');
  check('Tipp: Kick sofort beim Druck vorgemerkt (start)', st ? st.t - 0.1 : 9, -1e-6, 1e-6, 's', 0);
  check('Tipp: Standard steht fest nach Tippdauer + doppel', tap ? tap.t - 0.1 : 9, 0.07 + cfg.doppel, 0.07 + cfg.doppel + 2 * DT + 1e-6, 's', 0.07 + cfg.doppel, `doppel ${cfg.doppel} s (Nacht 2b: Fenster 0,25 s nach dem Loslassen)`);
  const dbl = play([[0.1, 0.17, 'shot'], [0.25, 0.3, 'shot']]);
  const v = find(dbl, 'shot', 'release', 'var');
  check('Doppeltipp: Zweitfunktion steht beim zweiten Druck fest', v ? v.t - 0.25 : 9, -1e-6, 1e-6, 's', 0, `kein Einzeltipp: ${dbl.filter((e) => e.type === 'tap').length}`);
  const hold = play([[0.1, 0.9, 'shot']]);
  const ht = find(hold, 'shot', 'tap');
  check('Halten = Tipp: Standard steht nach tapMax fest (wartet nicht aufs Loslassen)', ht ? ht.t - 0.1 : 9, cfg.tapMax - 1e-6, cfg.tapMax + DT, 's', cfg.tapMax, `${hold.length} Ereignisse`);
  const late = play([[0.1, 0.17, 'shot'], [0.17 + cfg.doppel + 0.05, 0.4, 'shot']]);
  check('Zweiter Druck zu spät: zwei Standard-Tipps', late.filter((e) => e.type === 'tap').length, 2, 2, '×', 2);
  const sw = play([[0.1, 0.16, 'pass'], [0.2, 0.26, 'shot']]);
  check('Knopf-Wechsel im Fenster: Pass verworfen, Schuss gilt', find(sw, 'pass', 'cancel') && find(sw, 'shot', 'tap') ? 1 : 0, 1, 1, '', 1);
  let bad = 0, s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let k = 0; k < 1000; k++) {
    const pr = []; let t = 0.05;
    for (let j = 0; j < 5; j++) { const btn = rnd() < 0.6 ? 'shot' : 'pass'; const d = rnd() < 0.7 ? 0.03 + rnd() * 0.15 : 0.2 + rnd() * 0.8; pr.push([t, t + d, btn]); t += d + rnd() * 0.3; }
    const ev = play(pr, t + 0.6);
    const std = ev.filter((e) => e.type === 'start' && e.mode === 'std').length;
    const ends = ev.filter((e) => e.type === 'release' || e.type === 'tap' || e.type === 'cancel').length;
    const vStarts = ev.filter((e) => e.type === 'start' && e.mode === 'var').length, pauses = ev.filter((e) => e.type === 'pause').length;
    if (std !== ends || vStarts > pauses) bad++;
  }
  check('1000 Zufalls-Gesten: jeder Druck genau ein Ergebnis', bad, 0, 0, '×', 0);
}

// 2) Im Spiel
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const mk = (qs = '', seed = 1) => { const g = new Game(makeParams(qs), seed, { match: true, perTeam: [2, 0], human: 0, bots: false }); g.rules.phase = 'play'; return g; };
// Knopf-Folge [[t0, t1, btn]] ab jetzt, Stick (mx, mz) die ganze Zeit; gibt den ersten Kick des Spielers 0 zurück
function press(g, seq, stick = [0, 0], T = 2, sprint = false) {
  const pl = g.players[0], t0 = g.t;
  for (let i = 0; i < T / DT; i++) {
    const t = g.t - t0;
    const down = { passDown: seq.some(([a, b, k]) => k === 'pass' && t >= a && t < b), shotDown: seq.some(([a, b, k]) => k === 'shot' && t >= a && t < b) };
    // Zeit des Takts mit dem Kick (g.t ist nach dem Schritt schon einen Takt weiter)
    for (const e of g.step([H({ ...down, mx: stick[0], mz: stick[1], sprint })])) if (e.type === 'kick' && e.player === 0) return { dt: g.t - DT - t0, k: pl.lastKick, e };
  }
  return null;
}
// Führen, Tipp (70 ms) zu zufälligem Zeitpunkt im Kontakt-Rhythmus → Zeit bis zum Ballkontakt (Mittel). Im Sprint legt
// der Spieler den Ball weit vor (bis ~1,8 m): der Kick kommt erst, wenn er den Ball erreicht – das ist Laufweg, keine
// Gesten-Wartezeit, deshalb nur als Info.
export function tapLatency(qs = '', sprint = false, n = 40) {
  const R = new Rng(sprint ? 6 : 5), dts = [];
  let missed = 0;
  for (let k = 0; k < n; k++) {
    const g = mk(qs, 10 + k), pl = g.players[0];
    g.players[1].place(8, R.range(-3, 3), 0);
    pl.place(-8, 0, 0); g.ball.place(-7.6, 0.11, 0);
    const run = R.range(0.6, 1.6);
    for (let i = 0; i < run / DT; i++) g.step([H({ mx: 1, mz: 0, sprint })]);
    const r = press(g, [[0, 0.07, k % 2 ? 'pass' : 'shot']], [1, 0], 2, sprint);
    if (r) dts.push(r.dt); else missed++;
  }
  dts.sort((a, b) => a - b);
  return { mean: dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length), med: dts[dts.length >> 1], p90: dts[Math.floor(dts.length * 0.9)], missed };
}
{
  const r = tapLatency(''), sp = tapLatency('', true);
  check('Tipp → Ballkontakt beim Führen (Laufen, Mittel aus 40 Situationen)', r.mean, 0, 0.2, 's', 0.2, `Median ${f3(r.med)} s, p90 ${f3(r.p90)} s, ohne Kick ${r.missed}`);
  check('… im Sprint (Ball weit vorgelegt, Info)', sp.mean, 0, Infinity, 's', null, `Median ${f3(sp.med)} s, p90 ${f3(sp.p90)} s, ohne Kick ${sp.missed}`);
  // Ball ruhig am Fuß (Stand): Wartezeit = Tippdauer + doppel
  const g = mk('', 2); g.players[1].place(-4, 3, 0); g.players[0].place(0, 0, 0); g.ball.place(0.4, 0.11, 0);
  const st = press(g, [[0, 0.07, 'pass']]);
  check('Tipp → Ballkontakt, Ball ruhig am Fuß', st ? st.dt : 9, 0, 0.07 + cfg.doppel + 0.03, 's', 0.19, 'Tippdauer 0,07 s + doppel');
}
{
  // Ball ruhig am Fuß, zum Tor gedreht (Tor rechts bei +10 m)
  const at = (qs = '', x = 2, seed = 3) => { const g = mk(qs, seed); g.players[1].place(x - 4, 3, 0); g.players[0].place(x, 0.4, 0); g.ball.place(x + 0.4, 0.11, 0.4); return g; };
  const t1 = press(at(), [[0, 0.07, 'shot']]);
  const t2 = press(at(), [[0, 0.07, 'shot'], [0.15, 0.2, 'shot']]);
  check('Schuss Tipp = Vollspann (Auto-Stärke)', t1 && t1.k.tech === 'vollspann' ? t1.k.speed : 0, 20, 30, 'm/s', null, t1 ? `${t1.k.tech}, ${f3(t1.dt)} s nach dem Druck, Drall ${t1.k.sideRps.toFixed(1)} U/s` : 'kein Schuss');
  check('Schuss Doppeltipp = angeschnitten', t2 && /rist/.test(t2.k.tech) ? Math.abs(t2.k.sideRps) : 0, 3, 99, 'U/s', null, t2 ? `${t2.k.tech}, ${t2.k.speed.toFixed(1)} m/s, ${f3(t2.dt)} s nach dem ersten Druck` : 'kein Schuss');
  const near = press(at('', 6, 4), [[0, 0.07, 'shot']]), far = press(at('', -1, 4), [[0, 0.07, 'shot']]);
  check('Auto-Stärke: weiter weg härter', far && near ? far.k.speed - near.k.speed : -9, 1, 99, 'm/s', null, `4 m: ${near && near.k.speed.toFixed(1)}, 11 m: ${far && far.k.speed.toFixed(1)} m/s`);
  const hold = press(at(), [[0, 0.9, 'shot']]);
  check('Schuss halten = wie Tipp (kein Aufladen), Kick vor dem Loslassen', hold ? hold.dt : 9, 0, 0.35, 's', null, hold ? `${hold.k.tech} ${hold.k.speed.toFixed(1)} m/s` : '');
  // Pass: Mitspieler vorn links
  const pg = () => { const g = mk('', 7); g.players[0].place(0, 0, 0); g.ball.place(0.4, 0.11, 0); g.players[1].place(7, -3, 0); return g; };
  const p1 = press(pg(), [[0, 0.07, 'pass']], [0.15, -0.06]);
  const p2 = press(pg(), [[0, 0.07, 'pass'], [0.15, 0.2, 'pass']], [0.15, -0.06]);
  check('Pass Tipp = flach zum Mitspieler', p1 && !p1.k.chip && p1.k.to === 1 ? p1.k.speed : 0, 4, 22, 'm/s', null, p1 ? `${p1.k.tech}, ${p1.k.elevDeg.toFixed(1)}°` : '');
  check('Pass Doppeltipp = hoch (Chip)', p2 && p2.k.chip ? p2.k.elevDeg : 0, 10, 50, '°', null, p2 ? `${p2.k.tech} ${p2.k.speed.toFixed(1)} m/s` : '');
  // ?laden=1: alte Lade-Grammatik – halten lädt, Stärke aus der Haltedauer
  const lk = press(at('laden=1'), [[0, 0.25, 'shot']]), lf = press(at('laden=1'), [[0, 1.0, 'shot']]);
  check('?laden=1: Stärke aus der Haltedauer (lang härter als kurz)', lk && lf ? lf.k.speed - lk.k.speed : -9, 4, 99, 'm/s', null, `0,25 s: ${lk && lk.k.speed.toFixed(1)}, 1,0 s: ${lf && lf.k.speed.toFixed(1)} m/s`);
}

process.exit(report('Tipp-Grammatik (Tipp / Doppeltipp, Auto-Stärke)', rows, 'tap') ? 0 : 1);
