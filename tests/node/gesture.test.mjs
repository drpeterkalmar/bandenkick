// Gesten-Grammatik (src/input/gesture.js): Halten, Tipp + Halten, Einzeltipp, zu später zweiter Druck,
// Knopf-Wechsel mitten in der Geste, kein Zusatz-Delay für „Standard“. Im 120-Hz-Takt wie im Spiel.
// Aufruf: node tests/node/gesture.test.mjs
import { newGestures, stepGestures, gestureView, GESTURE_CFG } from '../../src/input/gesture.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const DT = 1 / 120;
const cfg = GESTURE_CFG;

// Ablauf: Liste von [t0, t1, btn] = Knopf gedrückt von t0 bis t1 (s). Gibt alle Ereignisse zurück.
function play(presses, T = 1.5) {
  const g = newGestures(), ev = [];
  for (let i = 0; i <= Math.round(T / DT); i++) {
    const t = i * DT;
    const down = { pass: false, shot: false };
    for (const [a, b, btn] of presses) if (t >= a - 1e-9 && t < b - 1e-9) down[btn] = true;
    for (const e of stepGestures(g, t, down, cfg)) ev.push(e);
  }
  return ev;
}
const find = (ev, btn, type, mode) => ev.find((e) => e.btn === btn && e.type === type && (!mode || e.mode === mode));
const f3 = (v) => (v == null ? '–' : v.toFixed(3));

// 1) Halten = Standard, Start im selben Takt wie der Druck (kein Warten auf einen Doppeltipp)
for (const btn of ['shot', 'pass']) {
  const ev = play([[0.1, 0.7, btn]]);
  const st = find(ev, btn, 'start'), rel = find(ev, btn, 'release');
  const nm = btn === 'shot' ? 'Schuss' : 'Pass';
  check(`${nm} halten: Start „Standard“ ohne Verzögerung`, st && st.mode === 'std' ? st.t - 0.1 : 9, -1e-6, 1e-6, 's', 0, 'Aufladen ab dem ersten Takt');
  check(`${nm} halten: Auslösen beim Loslassen (Standard)`, rel && rel.mode === 'std' ? rel.t - 0.7 : 9, -1e-6, 1e-6, 's', 0, rel ? `Haltedauer ${f3(rel.dur)} s` : 'kein release');
  check(`${nm} halten: kein Tipp, kein Abbruch`, ev.filter((e) => e.type === 'tap' || e.type === 'cancel' || e.type === 'pause').length, 0, 0, '×', 0);
}
// 2) Tipp + sofort halten = Variante
for (const btn of ['shot', 'pass']) {
  const ev = play([[0.1, 0.18, btn], [0.3, 0.9, btn]]);
  const p = find(ev, btn, 'pause'), s2 = ev.filter((e) => e.btn === btn && e.type === 'start')[1], rel = find(ev, btn, 'release');
  const nm = btn === 'shot' ? 'Schuss' : 'Pass';
  check(`${nm} Tipp + halten: zweiter Druck startet „Variante“`, s2 && s2.mode === 'var' ? 1 : 0, 1, 1, '', 1, `Pause nach ${f3(p && p.dur)} s, zweiter Druck ${f3(s2 && s2.t - 0.18)} s nach dem Loslassen`);
  check(`${nm} Tipp + halten: Auslösen „Variante“ mit Haltedauer des zweiten Drucks`, rel && rel.mode === 'var' ? rel.dur : 0, 0.59, 0.61, 's', 0.6);
  check(`${nm} Tipp + halten: kein Einzeltipp ausgelöst`, ev.filter((e) => e.type === 'tap').length, 0, 0, '×', 0);
}
// 3) Einzeltipp: erst nach dem Fenster (sonst wäre Tipp + halten nicht erkennbar), genau einmal
{
  const ev = play([[0.1, 0.19, 'pass']]);
  const tap = find(ev, 'pass', 'tap'), up = find(ev, 'pass', 'pause');
  check('Pass Einzeltipp: aufgelöst nach dem Fenster', tap && up ? tap.t - up.t : 9, cfg.doppel, cfg.doppel + DT + 1e-6, 's', cfg.doppel, `Tipp ${f3(tap && tap.dur)} s lang`);
  check('Pass Einzeltipp: genau ein Tipp, kein Auslösen', ev.filter((e) => e.type === 'tap').length * 10 + ev.filter((e) => e.type === 'release').length, 10, 10, '', 10);
  const ev2 = play([[0.1, 0.15, 'shot']]);
  check('Schuss Einzeltipp: „Standard“ mit kurzer Haltedauer', find(ev2, 'shot', 'tap') ? find(ev2, 'shot', 'tap').dur : 9, 0.04, 0.06, 's', 0.05);
}
// 4) Zu später zweiter Druck: zwei getrennte Gesten (Tipp, dann neues Halten „Standard“)
{
  const late = cfg.doppel + 0.05;
  const ev = play([[0.1, 0.18, 'shot'], [0.18 + late, 0.9, 'shot']]);
  const tap = find(ev, 'shot', 'tap'), starts = ev.filter((e) => e.btn === 'shot' && e.type === 'start');
  check('Zu später zweiter Druck: erster bleibt Einzeltipp', tap ? 1 : 0, 1, 1, '', 1, `Tipp bei ${f3(tap && tap.t)} s`);
  check('Zu später zweiter Druck: zweiter startet „Standard“', starts[1] && starts[1].mode === 'std' ? 1 : 0, 1, 1, '', 1);
  // Grenzfall: zweiter Druck genau am Fensterende zählt noch, einen Takt danach nicht mehr
  const edge = play([[0.1, 0.18, 'shot'], [0.18 + cfg.doppel, 0.9, 'shot']]);
  check('Grenzfall: zweiter Druck genau am Fensterende → Variante', edge.filter((e) => e.type === 'start')[1]?.mode === 'var' ? 1 : 0, 1, 1, '', 1);
  const edge2 = play([[0.1, 0.18, 'shot'], [0.18 + cfg.doppel + 2 * DT, 0.9, 'shot']]);
  check('Grenzfall: zwei Takte nach dem Fenster → Standard', edge2.filter((e) => e.type === 'start')[1]?.mode === 'std' ? 1 : 0, 1, 1, '', 1);
  // Kurz gehalten, aber über der Tipp-Grenze: sofort auslösen (kein Fenster)
  const hold = play([[0.1, 0.1 + cfg.tapMax + 0.02, 'shot']]);
  check('Kurzes Halten über der Tipp-Grenze: sofort ausgelöst', find(hold, 'shot', 'release') ? find(hold, 'shot', 'release').t - (0.1 + cfg.tapMax + 0.02) : 9, -1e-6, DT, 's', 0);
}
// 5) Knopf-Wechsel mitten in der Geste
{
  // Pass-Tipp, dann innerhalb des Fensters Schuss drücken: Pass-Tipp sofort aufgelöst, Schuss startet „Standard“
  const ev = play([[0.1, 0.18, 'pass'], [0.26, 0.9, 'shot']]);
  const tap = find(ev, 'pass', 'tap'), st = find(ev, 'shot', 'start');
  check('Knopf-Wechsel: Pass-Tipp sofort aufgelöst (kein Warten)', tap && st ? tap.t - st.t : 9, -1e-6, 1e-6, 's', 0, 'im selben Takt wie der Schuss-Druck');
  check('Knopf-Wechsel: Schuss startet „Standard“ (nicht Variante)', st && st.mode === 'std' ? 1 : 0, 1, 1, '', 1);
  // Schuss halten, dann Pass drücken: Schuss wird abgebrochen, sein Loslassen zählt nicht
  const ev2 = play([[0.1, 0.9, 'shot'], [0.4, 0.6, 'pass']]);
  const cancel = find(ev2, 'shot', 'cancel'), relShot = find(ev2, 'shot', 'release'), relPass = find(ev2, 'pass', 'release');
  check('Knopf-Wechsel beim Halten: Schuss abgebrochen', cancel ? cancel.t - 0.4 : 9, -1e-6, 1e-6, 's', 0);
  check('Knopf-Wechsel beim Halten: kein Schuss beim späteren Loslassen', relShot ? 1 : 0, 0, 0, '', 0, relPass ? `Pass ausgelöst (${f3(relPass.dur)} s gehalten)` : '');
  // Doppeltipp (Tipp + Tipp) = Variante mit kurzer Haltedauer
  const dbl = play([[0.1, 0.16, 'pass'], [0.25, 0.31, 'pass']]);
  const r = find(dbl, 'pass', 'release');
  check('Doppeltipp: Variante (z. B. hoher Pass mit Auto-Stärke)', r && r.mode === 'var' ? 1 : 0, 1, 1, '', 1, r ? `zweiter Druck ${f3(r.dur)} s` : '');
}
// 6) Anzeige: während des Haltens Modus + Dauer, im Fenster „wartet“
{
  const g = newGestures();
  stepGestures(g, 0, { shot: true });
  stepGestures(g, 0.1, { shot: false });
  const w = gestureView(g, 0.15);
  stepGestures(g, 0.2, { shot: true });
  const v = gestureView(g, 0.5);
  check('Anzeige: Fenster nach dem Tipp → wartet', w && w.wait ? 1 : 0, 1, 1, '', 1);
  check('Anzeige: zweiter Druck → Variante, Dauer läuft', v && v.mode === 'var' && !v.wait ? v.dur : 0, 0.299, 0.301, 's', 0.3);
}
// 7) Zufällige Gesten (1000): nie zwei Auslösungen je Druck, jeder Druck endet in genau einem Ergebnis
{
  let bad = 0;
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let k = 0; k < 1000; k++) {
    const pr = []; let t = 0.05;
    for (let j = 0; j < 4; j++) { const btn = rnd() < 0.7 ? 'shot' : 'pass'; const d = rnd() < 0.5 ? 0.03 + rnd() * 0.15 : 0.2 + rnd() * 0.8; pr.push([t, t + d, btn]); t += d + rnd() * 0.4; }
    const ev = play(pr, t + 0.6);
    // Jede Geste beginnt mit genau einem „Standard“-Start und endet mit genau einem Abschluss (Tipp, Auslösen,
    // Abbruch); ein Varianten-Start setzt eine Geste nach einer Pause fort.
    const std = ev.filter((e) => e.type === 'start' && e.mode === 'std').length;
    const ends = ev.filter((e) => e.type === 'release' || e.type === 'tap' || e.type === 'cancel').length;
    const pauses = ev.filter((e) => e.type === 'pause').length;
    const vStarts = ev.filter((e) => e.type === 'start' && e.mode === 'var').length;
    if (std !== ends || vStarts > pauses) bad++;
  }
  check('1000 Zufalls-Gesten: jeder Druck genau ein Ergebnis', bad, 0, 0, '×', 0);
}

process.exit(report('Gesten-Grammatik (halten / tipp + halten / Einzeltipp)', rows) ? 0 : 1);
