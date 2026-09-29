// Skript-Spieler für die Challenges (headless): liefern je Takt die Eingabe des Menschen – mit den echten Gesten
// (Knopf-Pegel passDown/shotDown) und dem Stick, genau wie Touch/Tastatur. Damit testen die Challenges Gesten, Pass,
// Schuss, Luftbälle und Tormann-Knöpfe. Tormann-Skript = Tormann-Logik der Bots (Stufe 2) für den Menschen.
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planAir } from '../../src/sim/air.js';
import { Bots } from '../../src/sim/bots.js';

const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const norm = (x, z, m = 1) => { const l = Math.hypot(x, z) || 1; return [x / l * m, z / l * m]; };

// Zustand je Versuch zurücksetzen
function perAttempt(st, C) { if (st.att !== C.attempt) { st.att = C.attempt; st.t0 = null; st.k = {}; } }

export function makeScript(id, opts = {}) {
  const st = { att: -1, k: {} };
  const mode = opts.mode || 'std';
  switch (id) {
    case 'torwand': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      if (C.phase !== 'run' || C.attemptT < 0.25) return H();
      const me = g.players[0], t = C.targets.find((tt) => tt.lit), hold = 0.65;
      if (k.t0 == null) k.t0 = g.t;
      const dt = g.t - k.t0;
      const seq = mode === 'var' ? [[0, 0.07], [0.17, 0.17 + hold]] : [[0, hold]];
      const end = seq[seq.length - 1][1];
      const down = seq.some(([a, b]) => dt >= a && dt < b);
      // Stick erst beim Loslassen: seitlich = flache Ecke, schräg nach vorn = hohe Ecke (Tor bei +x, rechts = +z)
      const rel = dt >= end && dt < end + 0.05;
      const [sx, sz] = t.y > 1 ? norm(1, Math.sign(t.z), 0.2) : norm(0.08, Math.sign(t.z), 0.2);
      void me;
      return H({ shotDown: down, ...(rel ? { mx: sx, mz: sz } : {}) });
    };
    case 'volley': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      const me = g.players[0];
      // Test: fester Druck-Zeitpunkt relativ zum Abschuss (Maschine schießt bei 1,4 s im Versuch), z. B. −0,3 = zu früh
      if (opts.pressAt != null) { if (C.phase === 'run' && k.press == null && C.attemptT >= 1.4 + opts.pressAt) k.press = g.t; }
      else if (C.phase === 'run' && C.fired && !me.air && k.press == null && g.ball.held < 0) {
        const plan = planAir(g, me, { tPress: g.t });
        if (plan && plan.tq >= 0.999 && plan.score >= 0.85 * plan.maxScore) k.press = g.t;
      }
      return H({ shotDown: k.press != null && g.t - k.press < 0.08 });
    };
    case 'bande': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      if (C.phase !== 'run' || C.attemptT < 0.3) return H();
      const z = C.zones[0], b = g.ball, s = Math.sign(z.z) || 1;
      const mz = 2 * s * g.cage.hz - z.z; // Spiegelbild an der Längsbande
      if (k.t0 == null) k.t0 = g.t;
      const dt = g.t - k.t0;
      const [sx, sz] = norm(z.x - b.p.x, mz - b.p.z, 0.16);
      return H({ passDown: dt < 0.06, ...(dt < 0.45 ? { mx: sx, mz: sz } : {}) });
    };
    case 'dribbel': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      if (C.phase !== 'run') return H();
      const me = g.players[0], b = g.ball;
      const gate = C.gates[C.next];
      // Dribbel-Regler: Richtung Ziel, aber höchstens 30° neben dem Ball (Hilfe und Kontakte bleiben aktiv);
      // Ball verloren (> 1,5 m) → holen, erst unter 0,9 m wieder Richtung Ziel (Hysterese)
      const bd = Math.hypot(b.p.x - me.x, b.p.z - me.z);
      if (bd > 1.5) k.fetch = true; else if (bd < 0.9) k.fetch = false;
      if (k.fetch && k.shot == null) { const [sx, sz] = norm(b.p.x + b.v.x * 0.3 - me.x, b.p.z + b.v.z * 0.3 - me.z, 1); return H({ mx: sx, mz: sz }); }
      const steer = (tx, tz, m) => {
        let a = Math.atan2(tz - me.z, tx - me.x);
        const ab = Math.atan2(b.p.z - me.z, b.p.x - me.x);
        let d = a - ab; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        if (bd > 0.35) a = ab + Math.max(-0.52, Math.min(0.52, d));
        return H({ mx: Math.cos(a) * m, mz: Math.sin(a) * m });
      };
      if (gate) return steer(gate.x + 1.0, gate.z, 0.75);
      // alle Tore durch: aufs Tor, schießen sobald nah genug
      if (k.shot == null && me.x > 3.8 && bd < 1.2) k.shot = g.t;
      const down = k.shot != null && g.t - k.shot < 0.45;
      if (k.shot != null && g.t - k.shot > 1.6) k.shot = null; // daneben: nochmal
      if (down) return H({ shotDown: true });
      return steer(10, 0, 0.8);
    };
    case 'elfmeter': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      if (C.phase !== 'run' || C.attemptT < 0.4) return H();
      if (k.t0 == null) k.t0 = g.t;
      const dt = g.t - k.t0, side = C.attempt % 2 ? 1 : -1, hold = 0.8;
      const v = C.attempt % 3 === 0;
      const seq = v ? [[0, 0.07], [0.17, 0.17 + hold]] : [[0, hold]];
      const end = seq[seq.length - 1][1];
      const [sx, sz] = norm(0.08, side, 0.2);
      return H({ shotDown: seq.some(([a, b]) => dt >= a && dt < b), ...(dt >= end && dt < end + 0.05 ? { mx: sx, mz: sz } : {}) });
    };
    case 'doppelpass': return (g, C) => {
      perAttempt(st, C); const k = st.k;
      if (C.phase !== 'run' || C.attemptT < 0.3) return H();
      const me = g.players[0], wall = g.players[1], b = g.ball;
      if (k.t0 == null) k.t0 = g.t;
      const dt = g.t - k.t0;
      if (dt < 0.45) { const [sx, sz] = norm(wall.x - b.p.x, wall.z - b.p.z, 0.16); return H({ passDown: dt < 0.06, mx: sx, mz: sz }); }
      // loslaufen Richtung Tor; kommt der Rückpass, übernimmt die Empfänger-Hilfe (Stick los)
      const pp = g.passPlan;
      if (pp && pp.to === 0) return H();
      if (g.lastTouch === 0 && C.wallTouched) {
        // Ball im Lauf angenommen: Richtung Tor dribbeln, ab ~6 m abschließen
        if (k.shot == null && me.x > 0 && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 1.0) k.shot = g.t;
        if (k.shot != null) { const [sx, sz] = norm(b.p.x - me.x, b.p.z - me.z, 1); return H({ shotDown: g.t - k.shot < 0.8, mx: sx, mz: sz }); }
        const bd = Math.hypot(b.p.x - me.x, b.p.z - me.z);
        const [sx, sz] = bd > 1.3 ? norm(b.p.x - me.x, b.p.z - me.z, 0.9) : norm(9 - me.x, -me.z * 0.7, 0.9);
        return H({ mx: sx, mz: sz });
      }
      const [sx, sz] = norm(5.5 - me.x, -me.z * 0.6, 0.85);
      return H({ mx: sx, mz: sz });
    };
    default: { // Tormann-Challenges: Tormann-Logik der Bots steuert den Menschen
      let bots = null;
      return (g, C) => {
        if (!bots || bots.g !== g) bots = new Bots(g, opts.level || 2);
        bots.update();
        const pl = g.players[0];
        bots.brain[0].role = 'keeper';
        const inp = bots.input(0);
        void C;
        return { ...inp, mx: inp.mx, mz: inp.mz };
      };
    }
  }
}

// Challenge komplett abspielen: Spiel mit Skript bis zum Ende. Gibt Ergebnis + Ereignisse zurück.
export function playChallenge(Game, P, id, { seed = 1, script = null, maxT = 400, onEvent = null } = {}) {
  const g = new Game(P, seed, { challenge: id });
  const sc = script === false ? null : script || makeScript(id);
  const C = g.challenge;
  while (!C.done && g.t < maxT) {
    const ev = g.step([sc ? sc(g, C) : undefined]);
    if (onEvent) for (const e of ev) onEvent(e, g, C);
  }
  return { g, C, res: C.result(), done: C.done };
}
