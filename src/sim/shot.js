// Schuss (Nacht 2b): Ziel immer automatisch im Tor – eine Ecke nach freiem Winkel am Tormann vorbei, der Stick darf
// die Ecke vorgeben (seitlich = links/rechts, zurück = hoch). Qualität q (0…1) aus der Lage: Winkel zum Tor,
// Entfernung, Körperausrichtung, Ball zum Fuß (zu weit, zu nah, falsches Bein), Tempo/Sprint, springender Ball,
// Gegnerdruck. Niedriges q → langsamer, Ziel wandert zur Tormitte, mehr Streuung (monoton, Regler ?schusshilfe=).
// Vollspann = kaum Drall (Flatterball), angeschnitten = Innen-/Außenrist mit Kurve zum Tor hin. Die Richtung kommt
// aus dem Ziel-Löser (echte Flugphysik inkl. Kurve), der Flug danach ist die normale Ballphysik.
import { aimAt, spinOf, clamp } from './kickplan.js';
import { shotTechnique, curveSign } from './technique.js';

// Tor, auf das der Spieler schießt: im Spiel/Challenge nach Mannschaft (0 → rechts), im freien Training das Tor in
// Blickrichtung
export function attackGoalX(game, pl) {
  const hx = game.cage.hx;
  if (game.match) return pl.team === 0 ? hx : -hx;
  return Math.cos(pl.face) >= 0 ? hx : -hx;
}

// ---------------- Qualität q: Faktoren je Merkmal (jeder monoton in seiner „Schlechtigkeit“) ----------------
const lin = (x, x0, y0, x1, y1) => (x <= x0 ? y0 : x >= x1 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0));
export const Q_TABLE = {
  view: (v) => clamp(v / 0.30, 0.05, 1),                                                  // Torwinkel (rad) zwischen den Pfosten
  dist: (D) => lin(D, 9, 1, 20, 0.6),                                                      // Entfernung zur Tormitte (m)
  body: (a) => (a <= 45 ? 1 : a <= 100 ? lin(a, 45, 1, 100, 0.75) : lin(a, 100, 0.75, 180, 0.25)), // Körper ↔ Tormitte (°)
  ahead: (a) => (a < 0.15 ? Math.max(0.5, 1 - (0.15 - a) * 1.2) : a > 0.55 ? Math.max(0.5, 1 - (a - 0.55) * 1.5) : 1), // Ball vor dem Körper (m)
  side: (s) => lin(Math.abs(s), 0.2, 1, 0.5, 0.75),                                        // Ball seitlich (m)
  foot: (strong, crossed) => (strong ? 1 : 0.9) * (crossed ? 0.85 : 1),                    // schwaches Bein, Ball auf der anderen Seite
  move: (v, sprint) => Math.min(lin(v, 3, 1, 5.2, 0.9), sprint ? 0.82 : 1),                // Tempo des Schützen (m/s)
  bounce: (h, vy) => Math.max(0.75, 1 - clamp(h / 0.3, 0, 1) * 0.15 - clamp(Math.abs(vy) / 3, 0, 1) * 0.1), // Ball springt
  press: (d) => lin(d, 0.5, 0.72, 2, 1),                                                   // nächster Gegner (m)
};
// Auto-Stärke des Tipp-Schusses (Nacht 2c, kein Aufladen): nah platziert, weit hart. D = Ball ↔ Tormitte (m):
// 4 m → 0,68 (≈ 22 m/s bei q = 1), 8 m → 0,86 (≈ 27 m/s), ab 10 m 0,95 (≈ 29 m/s)
export const autoShotPower = (D) => clamp(0.5 + 0.045 * D, 0.65, 0.95);
// Kurven q → Tempo-Faktor, Anteil der Ecke (Rest Richtung Mitte), Streuungs-Faktor
export const speedFactor = (q) => 0.42 + 0.58 * Math.pow(q, 0.85);
export const aimFactor = (q) => Math.pow(clamp((q - 0.05) / 0.55, 0, 1), 0.8);
export const noiseFactor = (q) => 1 + 2 * (1 - q);

export function shotQuality(f, P) {
  const fa = {
    view: Q_TABLE.view(f.view), dist: Q_TABLE.dist(f.D), body: Q_TABLE.body(f.bodyAng), ahead: Q_TABLE.ahead(f.ballAhead),
    side: Q_TABLE.side(f.ballSide), foot: Q_TABLE.foot(f.strongFoot, f.crossed), move: Q_TABLE.move(f.speed, f.sprint),
    bounce: Q_TABLE.bounce(f.bounceH, f.vy), press: Q_TABLE.press(f.press),
  };
  let q = 1;
  for (const k in fa) q *= fa[k];
  q = clamp(q, 0.02, 1);
  const sh = Math.max(0.2, P.schusshilfe ?? 1);
  return { q, qEff: Math.pow(q, 1 / sh), factors: fa };
}

// Merkmale der Lage für einen Schuss vom Ball auf den Zielpunkt C (Welt), mit Fuß `foot`
export function shotFeatures(game, pl, C, foot, from = null) {
  const b = game.ball, gx = attackGoalX(game, pl), gw = game.cage.gw;
  const Bx = from ? from[0] : b.p.x, By = from ? from[1] : b.p.y, Bz = from ? from[2] : b.p.z;
  const v1x = gx - Bx, v1z = gw - Bz, v2z = -gw - Bz;
  const view = Math.abs(Math.atan2(v1x * v2z - v1z * v1x, v1x * v1x + v1z * v2z));
  const D = Math.hypot(gx - Bx, Bz);
  // Körperausrichtung zur Tormitte, vom Körper aus (nicht zur gewählten Ecke: die Eckenwahl soll q nicht verändern)
  const tx = gx - pl.x, tz = -pl.z, tl = Math.hypot(tx, tz) || 1;
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
  const bodyAng = Math.acos(clamp((tx * fx + tz * fz) / tl, -1, 1)) * 180 / Math.PI;
  void C;
  const rx = Bx - pl.x, rz = Bz - pl.z;
  const ballAhead = rx * fx + rz * fz, ballSide = -rx * fz + rz * fx;
  let press = 9;
  for (const o of game.players) if (o.team !== pl.team) press = Math.min(press, Math.hypot(o.x - Bx, o.z - Bz));
  return {
    view, D, bodyAng, ballAhead, ballSide, strongFoot: foot === (pl.strong || 1), crossed: ballSide * foot < -0.1,
    speed: pl.speed, sprint: !!pl.sprinting, bounceH: Math.max(0, By - b.r), vy: from ? 0 : b.v.y, press,
  };
}

// Tormann des Gegners (nur wenn er im eigenen Torraum steht)
function oppKeeper(game, pl) {
  if (!game.match || !game.rules) return null;
  const k = game.players[game.rules.keeper[1 - pl.team]];
  return k && game.rules.inBox(k.team, k.x, k.z, 0.6) ? k : null;
}

// Ecke wählen: freier Winkel am Tormann vorbei (Abstand des Tormanns zur Schusslinie), flach leicht bevorzugt, ohne
// Tormann das lange Eck. Stick (relativ zur Richtung aufs Tor): seitlich = flache Ecke dieser Seite, schräg nach vorn
// = hohe Ecke dieser Seite, gerade aufs Tor oder los = automatisch (man muss sich dafür nicht vom Ball wegbewegen)
export function chooseCorner(game, pl, stick = null, from = null) {
  const P = game.P, b = game.ball, gx = attackGoalX(game, pl);
  const Bx = from ? from[0] : b.p.x, Bz = from ? from[2] : b.p.z;
  const dx = gx - Bx, dz = -Bz, dl = Math.hypot(dx, dz) || 1;
  const ux = dx / dl, uz = dz / dl, rx = -uz, rz = ux;
  let sl = 0, sa = 0;
  if (stick) { const l = Math.hypot(stick[0], stick[1]) || 1; sl = (stick[0] * rx + stick[1] * rz) / l; sa = (stick[0] * ux + stick[1] * uz) / l; }
  const sideSet = Math.abs(sl) >= 0.3;
  const K = oppKeeper(game, pl);
  let best = null;
  for (const zs of [-1, 1]) for (const high of [false, true]) {
    const cz = zs * P.shotZ, cy = high ? P.shotHigh : P.shotLow;
    const lat = (gx - Bx) * rx + (cz - Bz) * rz;     // + = Ecke rechts vom Schützen
    let s = high ? 0 : 0.15;
    if (K) {
      const ex = gx - Bx, ez = cz - Bz, L2 = ex * ex + ez * ez || 1;
      const t = clamp(((K.x - Bx) * ex + (K.z - Bz) * ez) / L2, 0, 1);
      s += Math.min(2.5, Math.hypot(K.x - Bx - ex * t, K.z - Bz - ez * t));
      if (high && Math.abs(K.x - gx) > 2.2) s += 0.3; // Tormann weit vor dem Tor: hoch ist frei
    } else if (Math.abs(Bz) > 0.5) s += Math.sign(cz) !== Math.sign(Bz) ? 0.12 : 0; // ohne Tormann: langes Eck
    else s += lat * (pl.strong || 1) > 0 ? 0.02 : 0;                               // mittig: Ecke des starken Beins
    if (sideSet) {
      if (Math.sign(lat) !== Math.sign(sl)) s -= 10;
      s += (sa > 0.45) === high ? 1 : -1;                                            // schräg vorn = hoch, seitlich = flach
    }
    if (!best || s > best.s) best = { s, x: gx, y: cy, z: cz, high, lat };
  }
  return best;
}

// Vorschau ohne Flugbahn-Löser (Anzeige beim Aufladen, jedes Bild): Technik, Ecke, Qualität, Zielpunkt, Streuung
export function previewShot(game, pl, mode = 'std', stick = null, power = 0.7) {
  const P = game.P, b = game.ball;
  const from = [b.p.x, Math.max(b.r, b.p.y), b.p.z];
  const gx = attackGoalX(game, pl);
  const corner = chooseCorner(game, pl, stick, from);
  const curveLeft = corner.lat > 0.05 ? true : corner.lat < -0.05 ? false : (pl.strong || 1) > 0;
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
  const ballSide = -(from[0] - pl.x) * fz + (from[2] - pl.z) * fx;
  const { tech, foot } = shotTechnique(mode, curveLeft, ballSide, pl.strong || 1);
  const Q = shotQuality(shotFeatures(game, pl, [corner.x, corner.y, corner.z], foot), P);
  const q = Q.qEff, af = aimFactor(q);
  const aim = [gx, 0.6 + (corner.y - 0.6) * af, corner.z * af];
  const noiseDeg = (tech === 'vollspann' ? 0.5 : 0.7) + 1.1 * power * power;
  return { tech, foot, q, corner, aim, noiseDeg: noiseDeg * noiseFactor(q) * (tech === 'aussenrist' ? P.aussenNoise : 1), dist: Math.hypot(aim[0] - from[0], aim[2] - from[2]) };
}

// Kompletter Schuss-Plan. opts: mode 'std'|'var', power 0…1, stick [x,z]|null, noiseMul (Bots), sowie für Luftbälle
// tech/speed/spin/qMul/noiseBase/from (Treffpunkt statt Ballposition).
export function planShot(game, pl, opts = {}) {
  const P = game.P, b = game.ball;
  const mode = opts.mode || 'std';
  const from = opts.from || [b.p.x, Math.max(b.r, b.p.y), b.p.z];
  const gx = attackGoalX(game, pl);
  const power = clamp(opts.power ?? autoShotPower(Math.hypot(gx - from[0], from[2])), 0, 1); // ohne Stärke: automatisch
  const corner = chooseCorner(game, pl, opts.stick, from);
  // Kurve zum Tor hin: Ecke rechts vom Schützen → Ball dreht nach links in die Ecke (und umgekehrt)
  const curveLeft = corner.lat > 0.05 ? true : corner.lat < -0.05 ? false : (pl.strong || 1) > 0;
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
  const ballSide = -(from[0] - pl.x) * fz + (from[2] - pl.z) * fx;
  let tech, foot;
  if (opts.tech) { tech = opts.tech; foot = opts.foot ?? (ballSide >= 0 ? 1 : -1); }
  else ({ tech, foot } = shotTechnique(mode, curveLeft, ballSide, pl.strong || 1));
  const feat = shotFeatures(game, pl, [corner.x, corner.y, corner.z], foot, opts.from);
  if (opts.featMod) opts.featMod(feat);
  const Q = shotQuality(feat, P);
  // Technik des Schützen (Bots je Stufe, Mensch 1): wirkt wie ?schusshilfe= – gute Technik platziert auch aus
  // mittelmäßiger Lage noch gut
  const q = clamp(Math.pow(Q.qEff, 1 / (opts.skill || 1)) * (opts.qMul ?? 1), 0.02, 1);
  const af = aimFactor(q);
  const aim = [gx, 0.6 + (corner.y - 0.6) * af, corner.z * af];
  let speed, side = 0, back = 0, noiseDeg;
  if (opts.speed != null) {
    speed = opts.speed * speedFactor(q);
    side = opts.side || 0; back = opts.back || 0;
    noiseDeg = (opts.noiseBase ?? 2) * noiseFactor(q);
  } else if (tech === 'vollspann') {
    speed = (P.shotMin + (P.shotMax - P.shotMin) * power) * speedFactor(q);
    noiseDeg = (0.5 + 1.1 * power * power) * noiseFactor(q);
  } else {
    const aussen = tech === 'aussenrist';
    speed = (P.shotMin + (P.shotMax * P.curveSpeed - P.shotMin) * power) * speedFactor(q);
    side = curveSign(curveLeft) * P.spinMax * 2 * Math.PI * Math.min(1, speed / 25) * (aussen ? P.aussenSpin : 1) * (0.7 + 0.3 * q);
    noiseDeg = (0.7 + 1.1 * power * power) * noiseFactor(q) * (aussen ? P.aussenNoise : 1);
  }
  noiseDeg *= opts.noiseMul ?? 1;
  let sol = aimAt(P, from, aim, speed, spinOf(back, side), [Math.sign(gx), 0, 0]);
  if (!sol.ok) {
    // Tor im Flug nicht erreichbar (schwacher Schuss von weit weg): flach Richtung Ziel, rollt/springt aufs Tor
    const dx = aim[0] - from[0], dz = aim[2] - from[2], D = Math.hypot(dx, dz) || 1, tf = D / Math.max(3, speed);
    const need = Math.atan2(aim[1] - from[1] + 0.5 * P.g * tf * tf, D);
    sol = { dir: [dx / D, dz / D], el: need > 0.45 ? 0.035 : clamp(need, 0.02, 0.45), t: tf, ok: false, err: 0 };
  }
  return { kind: 'shot', mode, tech, foot, q, qRaw: Q.q, factors: Q.factors, corner, aim, speed, side, back, noiseDeg, dir: sol.dir, el: sol.el, elRad: sol.el, ok: sol.ok, flightT: sol.t, from };
}
