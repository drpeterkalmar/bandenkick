// Gesten-Grammatik für Pass- und Schuss-Knopf (ohne DOM – gleich für Touch, Tastatur, Maus und Gamepad; läuft im
// Sim-Takt, damit Host und Tests dieselben Gesten sehen):
//   halten                 → Standard (Pass flach / Schuss Vollspann), Stärke = Haltedauer
//   tipp + sofort halten   → Variante (Pass hoch / Schuss angeschnitten): zweiter Druck innerhalb `doppel` s
//                             nach dem Loslassen des ersten Tipps
//   kurzer Einzeltipp      → Standard mit automatischer Stärke (Pass) bzw. kurzer Schuss
// Der Modus entscheidet sich beim ZWEITEN Druck: ein Druck ohne vorherigen Tipp ist sofort „Standard“ und lädt
// ab dem ersten Takt auf – der normale Halte-Schuss wartet nie auf einen möglichen Doppeltipp. Nur ein kurzer
// Einzeltipp wird erst nach Ablauf des Fensters ausgelöst (sonst ließe sich „tipp + halten“ nicht erkennen).
// Knopf-Wechsel mitten in der Geste: der neue Knopf gewinnt (Tipp des anderen wird sofort aufgelöst, sein
// Aufladen abgebrochen).
//
// Ereignisse: {btn: 'pass'|'shot', type, mode: 'std'|'var', dur, t}
//   start   – Druck beginnt (std sofort beim ersten Druck, var beim zweiten Druck im Fenster)
//   pause   – erster Druck war kurz (Tipp): Aufladen ruht, Fenster für den zweiten Druck läuft
//   tap     – Einzeltipp aufgelöst (Fenster abgelaufen oder anderer Knopf gedrückt)
//   release – Halten beendet (std nach ≥ tapMax, var immer) → auslösen mit Stärke aus dur
//   cancel  – Geste abgebrochen (anderer Knopf gedrückt), späteres Loslassen zählt nicht

// Nacht 2c (Peter: „einfacherer schuss und pass ohne genaues timing oder aufladen … doppeltipp f zweitfunktion“):
// Standard ist jetzt die Tipp-Grammatik (stepTaps unten): Tipp = Standard mit Auto-Stärke, Doppeltipp = Zweitfunktion,
// Halten hat keine eigene Bedeutung mehr. Die Lade-Grammatik oben bleibt als Profi-Option (?laden=1).

export const BTNS = ['pass', 'shot'];
export const GESTURE_CFG = { doppel: 0.25, tapMax: 0.2 };           // Lade-Grammatik (?laden=1), wie Nacht 2b
export const TAP_CFG = { doppel: 0.11, tapMax: 0.2, laden: 0 };     // Tipp-Grammatik (Standard seit Nacht 2c)

const fresh = () => ({ st: 'idle', down: false, t0: 0, tUp: 0, mode: 'std', dur: 0 });
export function newGestures() { return { pass: fresh(), shot: fresh() }; }
const other = (b) => (b === 'pass' ? 'shot' : 'pass');

// Ein Schritt: t = Zeit (s, monoton), down = {pass, shot} Knopf-Pegel. Gibt die Ereignisse dieses Schritts zurück.
// cfg.laden = 0 → Tipp-Grammatik (stepTaps), sonst Lade-Grammatik.
export function stepGestures(g, t, down, cfg = GESTURE_CFG) {
  if (cfg.laden === 0) return stepTaps(g, t, down, cfg);
  const out = [];
  // 1) Tipp-Fenster abgelaufen → Einzeltipp
  for (const b of BTNS) {
    const s = g[b];
    if (s.st === 'wait' && t - s.tUp > cfg.doppel + 1e-9) { s.st = 'idle'; out.push({ btn: b, type: 'tap', mode: 'std', dur: s.dur, t }); }
  }
  // 2) Drücken und Loslassen
  for (const b of BTNS) {
    const s = g[b], d = !!(down && down[b]);
    if (d && !s.down) {
      const o = g[other(b)];
      if (o.st === 'wait') { o.st = 'idle'; out.push({ btn: other(b), type: 'tap', mode: 'std', dur: o.dur, t }); }
      else if (o.st === 'down1' || o.st === 'down2') { out.push({ btn: other(b), type: 'cancel', mode: o.mode, dur: t - o.t0, t }); o.st = 'dead'; }
      if (s.st === 'wait') { s.st = 'down2'; s.mode = 'var'; }
      else { s.st = 'down1'; s.mode = 'std'; }
      s.t0 = t;
      out.push({ btn: b, type: 'start', mode: s.mode, dur: 0, t });
    } else if (!d && s.down) {
      const dur = t - s.t0;
      if (s.st === 'down1') {
        if (dur < cfg.tapMax) { s.st = 'wait'; s.tUp = t; s.dur = dur; out.push({ btn: b, type: 'pause', mode: 'std', dur, t }); }
        else { s.st = 'idle'; out.push({ btn: b, type: 'release', mode: 'std', dur, t }); }
      } else if (s.st === 'down2') { s.st = 'idle'; out.push({ btn: b, type: 'release', mode: 'var', dur, t }); }
      else if (s.st === 'dead') s.st = 'idle';
    }
    s.down = d;
  }
  return out;
}

// ---------------- Tipp-Grammatik (Standard seit Nacht 2c) ----------------
//   Tipp                → Standard (Pass flach / Schuss Vollspann), Stärke automatisch
//   Doppeltipp          → Zweitfunktion (Pass hoch / Schuss angeschnitten): zweiter Druck höchstens `doppel` s
//                         nach dem Loslassen des ersten (kein Halten nötig)
//   Halten              → wie Tipp: nach `tapMax` s steht „Standard“ fest (der Kick wartet nicht aufs Loslassen)
// Der Kick wird beim ersten Druck sofort vorgemerkt („start“, gesperrt) – der Spieler läuft schon zum Ball. Er wird
// frei, sobald der Modus feststeht: Einzeltipp beim Loslassen + `doppel` (bzw. nach `tapMax` gehalten), Doppeltipp
// beim zweiten Druck. Wartezeit eines Einzeltipps = Tippdauer + doppel (≈ 0,07 + 0,11 s).
// Ereignisse: start (std, erster Druck) · pause (losgelassen, Fenster läuft) · tap (Standard steht fest) ·
//   start (var, zweiter Druck) + release (var, steht sofort fest) · cancel (anderer Knopf gedrückt, bevor der Modus
//   feststand – der neue Knopf gewinnt). Jeder erste Druck endet in genau einem tap, release oder cancel.
export function stepTaps(g, t, down, cfg = TAP_CFG) {
  const out = [];
  for (const b of BTNS) {
    const s = g[b];
    if (s.st === 'wait' && t - s.tUp > cfg.doppel + 1e-9) { s.st = 'idle'; out.push({ btn: b, type: 'tap', mode: 'std', dur: s.dur, t }); }
    if (s.st === 'down1' && t - s.t0 >= cfg.tapMax - 1e-9) { s.st = 'held'; out.push({ btn: b, type: 'tap', mode: 'std', dur: t - s.t0, t }); }
  }
  for (const b of BTNS) {
    const s = g[b], d = !!(down && down[b]);
    if (d && !s.down) {
      const o = g[other(b)];
      if (o.st === 'wait' || o.st === 'down1') { out.push({ btn: other(b), type: 'cancel', mode: 'std', dur: t - o.t0, t }); o.st = o.st === 'wait' ? 'idle' : 'dead'; }
      if (s.st === 'wait') {
        s.st = 'down2'; s.mode = 'var'; s.t0 = t;
        out.push({ btn: b, type: 'start', mode: 'var', dur: 0, t }, { btn: b, type: 'release', mode: 'var', dur: 0, t });
      } else {
        s.st = 'down1'; s.mode = 'std'; s.t0 = t;
        out.push({ btn: b, type: 'start', mode: 'std', dur: 0, t });
      }
    } else if (!d && s.down) {
      if (s.st === 'down1') { s.st = 'wait'; s.tUp = t; s.dur = t - s.t0; out.push({ btn: b, type: 'pause', mode: 'std', dur: s.dur, t }); }
      else s.st = 'idle'; // held, down2, dead: schon entschieden
    }
    s.down = d;
  }
  return out;
}

// Anzeige: welcher Knopf lädt gerade auf (Modus, Haltedauer) bzw. wartet auf den zweiten Druck
export function gestureView(g, t) {
  for (const b of BTNS) {
    const s = g[b];
    if (s.st === 'down1' || s.st === 'down2') return { btn: b, mode: s.mode, dur: t - s.t0, wait: false };
  }
  for (const b of BTNS) if (g[b].st === 'wait') return { btn: b, mode: 'std', dur: g[b].dur, wait: true };
  return null;
}
