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

export const BTNS = ['pass', 'shot'];
export const GESTURE_CFG = { doppel: 0.25, tapMax: 0.2 };

const fresh = () => ({ st: 'idle', down: false, t0: 0, tUp: 0, mode: 'std', dur: 0 });
export function newGestures() { return { pass: fresh(), shot: fresh() }; }
const other = (b) => (b === 'pass' ? 'shot' : 'pass');

// Ein Schritt: t = Zeit (s, monoton), down = {pass, shot} Knopf-Pegel. Gibt die Ereignisse dieses Schritts zurück.
export function stepGestures(g, t, down, cfg = GESTURE_CFG) {
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

// Anzeige: welcher Knopf lädt gerade auf (Modus, Haltedauer) bzw. wartet auf den zweiten Druck
export function gestureView(g, t) {
  for (const b of BTNS) {
    const s = g[b];
    if (s.st === 'down1' || s.st === 'down2') return { btn: b, mode: s.mode, dur: t - s.t0, wait: false };
  }
  for (const b of BTNS) if (g[b].st === 'wait') return { btn: b, mode: 'std', dur: g[b].dur, wait: true };
  return null;
}
