// n11 (Peter 04.11.2026: „separater schuss und pass knopf der aber mit 1x drauftippen alles automatisch berechnet und je nach
// situation das beste und spektakulärste draus macht“): automatische Technik-Wahl für den Schuss am Boden und der Ein-Knopf-Test.
// Ohne DOM, geprüft in tests/node/akro.test.mjs. Luftbälle wählen ihre Technik in air.js (planAir, gleiche Spektakel-Regel), Pässe
// in pass.js/hochpass.js (Pass-Sicherheit zuerst).
//
// Regel: zuerst die Erfolgschance (hier: Torchance des Schusses), dann unter allen Optionen mit höchstens P.spektakel (10 %)
// weniger Chance die spektakulärste (SPEKTAKEL in technique.js). Nie eine klar schlechtere Option nur fürs Spektakel.
import { previewShot, attackGoalX, autoShotPower, shotFeatures, shotQuality, speedFactor, aimFactor, noiseFactor } from './shot.js';
import { spektakelRang } from './technique.js';
import { passCandidates } from './pass.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;
// Fehlerfunktion (Abramowitz/Stegun 7.1.26, |Fehler| < 1,5·10⁻⁷)
function erf(x) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}

// Torchance einer Schuss-Option: aufs Tor (Streuung gegen den Abstand zu Pfosten/Latte/Boden) × am Tormann vorbei (Reichweite in
// der Flugzeit, Hechtsprung) × Qualität. aim = [x, y, z] im Tor, dist (m), noiseDeg (°), speed (m/s)
export function shotChance(game, pl, aim, dist, noiseDeg, speed, q) {
  const P = game.P, gw = P.goalW / 2, sig = Math.max(0.02, dist * Math.tan(noiseDeg * DEG));
  const mL = Math.max(0, gw - P.ballR - Math.abs(aim[2])), mV = Math.max(0, Math.min(P.goalH - P.ballR - aim[1], aim[1]));
  const pOn = erf(mL / (sig * Math.SQRT2)) * (0.5 + 0.5 * erf(mV / (sig * Math.SQRT2)));
  let beat = 1;
  const R = game.match ? game.rules : null, k = R ? game.players[R.keeper[1 - pl.team]] : null;
  if (k && R.inBox(k.team, k.x, k.z, 0.6) && k.hand.mode !== 'ground') {
    const t = dist / Math.max(5, speed);
    const dK = Math.hypot(k.z - aim[2], Math.max(0, aim[1] - 1.1) * 0.7);
    const reach = Math.min(2.2, P.catchReach * 0.75 + 4.2 * Math.max(0, t - 0.22));
    beat = clamp(0.3 + (dK - reach) / 1.1, 0.08, 1);
  }
  return Math.sqrt(clamp(q, 0.02, 1)) * pOn * beat;
}

// Optionen am Boden: Vollspann, angeschnitten (Innen- bzw. Außenrist, wie shotTechnique wählt) und – mit ?salto=1 – Hackenschuss,
// wenn der Spieler mit dem Rücken zum Tor steht und der Ball nah am Standbein liegt. Gibt {mode, tech, chance, options} zurück.
export function autoShot(game, pl, stick = null) {
  const P = game.P, b = game.ball;
  const gx = attackGoalX(game, pl), power = autoShotPower(Math.hypot(gx - b.p.x, b.p.z));
  const W = Math.max(0.3, P.wucht ?? 1);
  const opts = [];
  for (const mode of ['std', 'var']) {
    const pv = previewShot(game, pl, mode, stick, power);
    const cs = mode === 'std' ? 1 : P.curveSpeed + (P.bananeSpeed - P.curveSpeed) * clamp(P.banane ?? 0, 0, 1);
    const speed = (P.shotMin + (P.shotMax * cs - P.shotMin) * power) * speedFactor(pv.q) * W;
    opts.push({ mode, tech: pv.tech, q: pv.q, chance: shotChance(game, pl, pv.aim, pv.dist, pv.noiseDeg, speed, pv.q) });
  }
  if (P.salto) {
    // Hackenschuss: Körper (fast) mit dem Rücken zum Tor, Ball ≤ hackeNear m an der Körpermitte → Lage-Faktor Körper gespiegelt
    const f = shotFeatures(game, pl, [gx, 0.5, 0], pl.strong || 1);
    const bd = Math.hypot(b.p.x - pl.x, b.p.z - pl.z);
    if (f.bodyAng > 115 && bd <= P.hackeNear + 0.1) {
      f.bodyAng = 180 - f.bodyAng; f.ballAhead = 0.3; f.ballSide = 0; f.crossed = false;
      const Q = shotQuality(f, P), q = Q.qEff * 0.8;
      const pv = previewShot(game, pl, 'std', stick, power);
      const aim = [gx, 0.6 + (pv.corner.y - 0.6) * aimFactor(q), pv.corner.z * aimFactor(q)];
      const speed = Math.min(19, P.shotMin + (P.shotMax * 0.62 - P.shotMin) * power) * speedFactor(q);
      opts.push({ mode: 'std', tech: 'ferse', q, chance: shotChance(game, pl, aim, pv.dist, 2.2 * noiseFactor(q), speed, q) });
    }
  }
  let best = opts[0];
  for (const o of opts) if (o.chance > best.chance) best = o;
  const lim = (1 - (P.spektakel || 0)) * best.chance;
  for (const o of opts) if (o.chance >= lim && spektakelRang(o.tech) > spektakelRang(best.tech)) best = o;
  return { ...best, options: opts };
}

// Ein-Knopf-Kick (Standard seit Peter 13.11., ?einknopf=0 = zwei Knöpfe): Schuss, wenn die Torchance gut genug ist (nah, Tor in Stick-/Blickrichtung), sonst Pass zum
// Mitspieler in dieser Richtung (falls einer da ist), sonst doch Schuss
export function einKnopfArt(game, pl, stick = null) {
  const b = game.ball, gx = attackGoalX(game, pl), D = Math.hypot(gx - b.p.x, b.p.z);
  const a = stick || [Math.cos(pl.face), Math.sin(pl.face)];
  const toGoal = ((gx - b.p.x) * a[0] - b.p.z * a[1]) / (D || 1);
  if (D < 11 && toGoal > 0.5) {
    const s = autoShot(game, pl, stick);
    if (s.chance > 0.18 || D < 6) return 'shot';
  }
  const c = passCandidates(game, pl, a, [b.p.x, b.p.z], stick ? 60 : 180).find((m) => !m.bank);
  return c ? 'pass' : 'shot';
}
