// Luftbälle (Nacht 2b): Schuss gedrückt (Tipp oder Halten), Ball in der Luft in Reichweite oder in den nächsten
// ~0,9 s dort → der Spieler läuft/springt in Position und nimmt ihn je nach Situation mit Kopfball, Volley, Dropkick,
// Seitfallzieher, Fallrückzieher oder Flugkopfball. Die Technik ergibt sich aus Höhe am Treffpunkt und Lage (woher der
// Ball kommt ↔ wo das Tor ist) per Punktwert (technique.js), dazu Erreichbarkeit und Timing: Abweichung des Drucks vom
// idealen Vorlauf kostet Tempo und Genauigkeit. Die Ballbahn kommt aus der echten Physik (predictBall), der Schuss
// aus shot.js (Ziel im Tor, Qualität) – danach fliegt der Ball normal weiter.
import { predictBall, clamp, setKick } from './kickplan.js';
import { airScores, AIR_TECH, AIR_KEYS, AIR_PROPS, timingFit } from './technique.js';
import { planShot, attackGoalX } from './shot.js';

const DEG = Math.PI / 180;
const _pred = [];
const _predKey = { g: null, tick: -1 };
// Anlauf-Zeitpunkt vor dem Treffpunkt (Absprung, Fallen, Hechten, Ausholen)
export const TAKEOFF = { volley: 0.14, dropkick: 0.14, seitfall: 0.26, fallrueck: 0.3, kopf: 0.3, flugkopf: 0.3 };
// Technik-Güte (zusätzlicher q-Faktor: riskante Techniken ungenauer) und Kontakt-Toleranz (m)
const TECH_Q = { volley: 1, dropkick: 0.95, seitfall: 0.84, fallrueck: 0.74, kopf: 0.9, flugkopf: 0.82 };
const TOL = { volley: 0.42, dropkick: 0.4, seitfall: 0.45, fallrueck: 0.42, kopf: 0.34, flugkopf: 0.5 };

// Luftball-Plan: bester Treffpunkt (Zeit, Technik) für diesen Spieler. purpose 'shot' (aufs Tor) | 'clear' (weg vom
// eigenen Tor). tPress = Zeitpunkt des Drucks (Timing). Gibt null zurück, wenn kein Luftball sinnvoll ist.
export function planAir(game, pl, { tPress = game.t, purpose = 'shot', minScore = 0.22, minSpeed = 0 } = {}) {
  const P = game.P, b = game.ball;
  if (b.held >= 0 || pl.fall || pl.hand.mode !== 'none') return null;
  // Ball ist oder wird in der Vorschau hoch genug und nah genug
  if (b.p.y < 0.3 && b.v.y < 1.0 && Math.hypot(b.p.x - pl.x, b.p.z - pl.z) > 1.5) return null;
  // Ballvorhersage einmal je Takt (mehrere Spieler prüfen im selben Takt)
  if (_predKey.g !== game || _predKey.tick !== game.tick) { predictBall(P, game.cage, b, P.airHorizon, 2, _pred); _predKey.g = game; _predKey.tick = game.tick; }
  const pred = _pred;
  const gx = purpose === 'clear' ? -attackGoalX(game, pl) : attackGoalX(game, pl);
  const scale = P.luft || 1;
  let best = null, maxScore = 0; // maxScore: bester Technik-Wert ohne Timing (für Bots/Skripte: auf die beste warten)
  let lastBounce = -9;
  for (let k = 1; k < pred.length; k++) {
    const s = pred[k];
    if (s.bounce) lastBounce = s.t;
    if (s.t < 0.08) continue;
    const h = s.y;
    if (h < 0.12 || h > 2.7) continue;
    const vxz = Math.hypot(s.vx, s.vz);
    if (minSpeed && Math.hypot(vxz, s.vy) < minSpeed) continue;
    let sx, sz; // Richtung, aus der der Ball kommt
    if (vxz > 1.0) { sx = -s.vx / vxz; sz = -s.vz / vxz; } else { const dx = pl.x - s.x, dz = pl.z - s.z, dl = Math.hypot(dx, dz) || 1; sx = dx / dl; sz = dz / dl; }
    // Ziel: Tormitte (Schuss) bzw. gegnerische Hälfte (Befreiung)
    const tx = purpose === 'clear' ? -gx * 0.4 : gx, tz = purpose === 'clear' ? s.z * 0.5 : 0;
    const gdx = tx - s.x, gdz = tz - s.z, gl = Math.hypot(gdx, gdz) || 1;
    const theta = Math.acos(clamp((sx * gdx + sz * gdz) / gl, -1, 1)) / DEG;
    const bounced = s.t - lastBounce < 0.2 && lastBounce > 0;
    const sc = airScores(h, theta, bounced, scale);
    const lead = game.t + s.t - tPress;
    for (const tech of AIR_KEYS) {
      if (sc[tech] < 0.12) continue;
      const T = AIR_TECH[tech];
      // Körperposition: auf der Seite, von der der Ball kommt, Abstand je Technik
      const bx = s.x + sx * T.dist, bz = s.z + sz * T.dist;
      const d = Math.hypot(bx - pl.x, bz - pl.z);
      const va = ((bx - pl.x) * pl.vx + (bz - pl.z) * pl.vz) / (d || 1);
      const reach = pl.travel(va, P.vSprint, s.t) + T.extra + 0.25;
      if (d > reach) continue;
      // Kopfball über Kopfhöhe: Sprung nötig (Scheitel am Treffpunkt), braucht Zeit
      if (tech === 'kopf' && h > P.headH + 0.02) {
        const jh = h - P.headH;
        if (jh > P.jumpMax || s.t < Math.sqrt(2 * jh / P.g) + 0.04) continue;
      }
      if (s.t < TAKEOFF[tech] * 0.6) continue; // zu spät für die Bewegung
      const tq = timingFit(tech, lead);
      const margin = clamp(1 - d / (reach + 0.01), 0, 1);
      if (sc[tech] > maxScore) maxScore = sc[tech];
      const total = sc[tech] * (0.35 + 0.65 * tq) * (0.75 + 0.25 * margin) * (1 - 0.12 * s.t);
      if (!best || total > best.total) best = { tech, total, score: sc[tech], tq, t: s.t, tc: game.t + s.t, bx, bz, cx: s.x, cy: h, cz: s.z, sx, sz, theta, h, bounced, lead, vin: Math.hypot(s.vx, s.vy, s.vz), purpose };
    }
  }
  if (best) best.maxScore = maxScore;
  return best && best.total >= minScore ? best : null;
}

// Timing-Hilfe (Nacht 2c, Mensch per Tipp, Regler ?timinghilfe=0…1): der Druck merkt den Luftball nur vor, die
// Technik-Hilfe wählt den besten Moment – geplant wird, als drücke der Spieler jetzt; übernommen wird der Plan erst,
// wenn der Zeitpunkt ideal ist (bestes Technik-Fenster) oder gleich keine Zeit mehr bleibt. Ein zu später Druck kostet
// dann höchstens 15 % Timing-Wert (help = 1). Gibt den Plan oder null (weiter warten) zurück.
export function planAirHelp(game, pl, help = 1) {
  const plan = planAir(game, pl, { tPress: game.t });
  if (!plan) return null;
  const ideal = plan.tq >= 0.999 && plan.score >= 0.85 * plan.maxScore;
  if (!ideal && plan.t > AIR_TECH[plan.tech].lead[0] + 0.1) return null; // der beste Moment kommt noch
  plan.tq = 1 - (1 - plan.tq) * (1 - 0.85 * clamp(help, 0, 1));
  return plan;
}

// Luftball ausführen (vom Spieler je Takt aufgerufen, solange pl.air läuft). Gibt true zurück, solange der Spieler
// dadurch gesteuert wird (Anlauf mit Hilfe, Absprung, Flug, Treffpunkt).
export function stepAir(pl, dt, game, want, sx, sz) {
  const P = pl.P, a = pl.air, b = game.ball;
  const tRem = a.tc - game.t;
  // Anlauf: deutliche Eingabe gegen die Hilfe → nach 0,3 s abbrechen (Hilfe nimmt nie die Kontrolle)
  const dx = a.bx - pl.x, dz = a.bz - pl.z, d = Math.hypot(dx, dz);
  if (!a.go) {
    if (want && d > 0.25) {
      const agree = (sx * dx + sz * dz) / (d || 1);
      a.against = agree < 0.3 ? (a.against || 0) + dt : 0;
      if (a.against > 0.3) { pl.air = null; return false; }
    }
    if (tRem <= TAKEOFF[a.tech]) {
      a.go = true; a.t0 = game.t;
      if (a.tech === 'kopf') { const jh = Math.max(0, a.h - P.headH); pl.jumpV = jh > 0.02 ? Math.sqrt(2 * P.g * jh) : 0; }
      else if (a.tech === 'seitfall' || a.tech === 'fallrueck') pl.jumpV = 2.6;
      else if (a.tech === 'flugkopf') pl.jumpV = 1.8;
      game.events.push({ type: 'airstart', tech: a.tech, player: pl.id, x: pl.x, z: pl.z });
    }
  }
  // Bewegung: zur Körperposition, pünktlich zum Treffpunkt (im Flug nur noch Schwung)
  if (!a.go || a.tech === 'flugkopf') {
    const need = d / Math.max(0.06, tRem);
    const vmax = a.tech === 'flugkopf' && a.go ? 6 : P.vSprint;
    const v = clamp(need, 0, vmax);
    const k = 1 - Math.exp(-dt * (a.go ? 20 : 9));
    const tvx = d > 0.02 ? dx / d * v : 0, tvz = d > 0.02 ? dz / d * v : 0;
    pl.vx += (tvx - pl.vx) * k; pl.vz += (tvz - pl.vz) * k;
  } else { pl.vx *= Math.exp(-dt * 3); pl.vz *= Math.exp(-dt * 3); }
  pl.x += pl.vx * dt; pl.z += pl.vz * dt;
  const lx = game.cage.hx - P.bodyR, lz = game.cage.hz - P.bodyR;
  pl.x = clamp(pl.x, -lx, lx); pl.z = clamp(pl.z, -lz, lz);
  pl.speed = Math.hypot(pl.vx, pl.vz);
  // Blick: zum Ball (von dort kommt er); Fallrückzieher mit dem Rücken zum Tor, Seitfall seitlich
  const fAng = Math.atan2(-a.sz, -a.sx);
  let df = fAng - pl.face; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
  pl.face += clamp(df, -P.turnCap * dt, P.turnCap * dt);
  // Treffpunkt
  if (tRem <= dt * 0.5) {
    const err = Math.hypot(b.p.x - a.cx, b.p.y - a.cy, b.p.z - a.cz) + 0.6 * Math.hypot(pl.x - a.bx, pl.z - a.bz);
    const tol = TOL[a.tech];
    const tech = a.tech;
    if (b.held < 0 && err <= tol) airKick(pl, game, a, err / tol);
    else game.events.push({ type: 'airmiss', tech, player: pl.id, x: pl.x, z: pl.z, err });
    pl.air = null;
    pl.tech = tech; pl.techT = 0; pl.kickT = 0;
    const g = AIR_PROPS[tech].ground;
    if (g > 0) pl.fall = { tech, t: 0, dur: g + 0.25 }; // Flug + Landung + am Boden
    return true;
  }
  return true;
}

// Kontakt: Schuss aufs Tor (bzw. Befreiung) mit Technik-Tempo, Qualität aus Lage × Timing × Treffgenauigkeit
function airKick(pl, game, a, errFrac) {
  const P = game.P, b = game.ball;
  const T = AIR_PROPS[a.tech];
  const vin = b.v.len();
  const cq = clamp(1 - 0.5 * errFrac * errFrac, 0.4, 1);            // Treffgenauigkeit
  const tq = 0.45 + 0.55 * a.tq;                                    // Timing
  const sp = Math.min(T.vmax, T.v0 + T.vin * vin);
  const qMul = tq * cq * TECH_Q[a.tech];
  if (a.purpose === 'clear') {
    const gx = -attackGoalX(game, pl);
    const tx = -gx * 0.4 - b.p.x, tz = b.p.z * 0.5 - b.p.z, tl = Math.hypot(tx, tz) || 1;
    const e = (T.noise * (2 - qMul) * (pl.airNoise ?? 1)) * DEG * game.rng.gauss();
    const dx = tx / tl * Math.cos(e) - tz / tl * Math.sin(e), dz = tx / tl * Math.sin(e) + tz / tl * Math.cos(e);
    const speed = sp * (0.7 + 0.3 * qMul);
    setKick(b, dx, dz, speed, (a.tech === 'kopf' ? 12 : 22) * DEG, 0, 0);
    b.contact = false; b.reseedKnuckle(game.rng);
    finishAir(pl, game, a, { kind: 'clear', tech: a.tech, speed, q: qMul, dir: [dx, dz] });
    return;
  }
  // Schuss: gleiche Planung wie am Boden (Ziel im Tor, Lage), Körper/Ball-Merkmale gehören hier zur Technik
  const plan = planShot(game, pl, {
    tech: a.tech, from: [b.p.x, b.p.y, b.p.z], speed: sp, qMul, noiseBase: T.noise, noiseMul: pl.airNoise ?? 1, skill: pl.skill ?? 1,
    back: a.tech === 'fallrueck' ? -12 : a.tech === 'volley' ? -6 : 0,
    featMod: (f) => { f.bodyAng = 0; f.ballAhead = 0.35; f.ballSide = 0; f.strongFoot = true; f.crossed = false; f.bounceH = 0; f.vy = 0; f.speed = Math.min(f.speed, 3); f.sprint = false; },
  });
  plan.timing = a.tq;
  plan.kind = 'shot';
  pl.applyPlan(plan, game, 0);
  if (b.p.y < b.r + 0.02) b.p.y = b.r + 0.02;
  b.contact = false;
  game.events.push({ type: 'air', tech: a.tech, player: pl.id, speed: plan.speed, q: plan.q, timing: a.tq, x: b.p.x, y: b.p.y, z: b.p.z });
}

function finishAir(pl, game, a, k) {
  const b = game.ball;
  pl.touchCd = 0.35; pl.bodyOffT = 0.3; pl.lastTouchT = game.t; pl.kickT = 0; pl.touchT = 0;
  pl.lastKick = { kind: k.kind, tech: k.tech, mode: 'air', speed: k.speed, q: k.q, t: game.t, timing: a.tq, spinRps: 0, sideRps: 0, elevDeg: 0 };
  if (game.match) { game.passTo = -1; game.rules.touch(pl); }
  game.passPlan = null;
  game.events.push({ type: 'kick', kind: k.kind, tech: k.tech, player: pl.id, speed: k.speed, x: b.p.x, y: b.p.y, z: b.p.z, dx: k.dir[0], dz: k.dir[1], to: -1 });
  game.events.push({ type: 'air', tech: a.tech, player: pl.id, speed: k.speed, q: k.q, timing: a.tq, x: b.p.x, y: b.p.y, z: b.p.z });
}

// Am Boden nach Seit-/Fallrückzieher bzw. Flugkopfball (~0,8 s): keine Bewegung, kein Ballkontakt
export function stepFall(pl, dt, game) {
  const f = pl.fall;
  f.t += dt;
  pl.vx *= Math.exp(-dt * 6); pl.vz *= Math.exp(-dt * 6);
  pl.x += pl.vx * dt; pl.z += pl.vz * dt;
  const lx = game.cage.hx - pl.P.bodyR, lz = game.cage.hz - pl.P.bodyR;
  pl.x = clamp(pl.x, -lx, lx); pl.z = clamp(pl.z, -lz, lz);
  pl.speed = Math.hypot(pl.vx, pl.vz);
  if (f.t >= f.dur) pl.fall = null;
}
