// Luftbälle (Nacht 2b): Schuss gedrückt (Tipp oder Halten), Ball in der Luft in Reichweite oder in den nächsten
// ~0,9 s dort → der Spieler läuft/springt in Position und nimmt ihn je nach Situation mit Kopfball, Volley, Dropkick,
// Seitfallzieher, Fallrückzieher oder Flugkopfball. Die Technik ergibt sich aus Höhe am Treffpunkt und Lage (woher der
// Ball kommt ↔ wo das Tor ist) per Punktwert (technique.js), dazu Erreichbarkeit und Timing: Abweichung des Drucks vom
// idealen Vorlauf kostet Tempo und Genauigkeit. Die Ballbahn kommt aus der echten Physik (predictBall), der Schuss
// aus shot.js (Ziel im Tor, Qualität) – danach fliegt der Ball normal weiter.
import { predictBall, clamp, setKick } from './kickplan.js';
import { airScores, AIR_TECH, AIR_KEYS, AIR_PROPS, timingFit, spektakelRang } from './technique.js';
import { planShot, attackGoalX } from './shot.js';
import { planPass, passCandidates } from './pass.js';

const DEG = Math.PI / 180;
const _pred = [];
const _predKey = { g: null, tick: -1 };
// Anlauf-Zeitpunkt vor dem Treffpunkt (Absprung, Fallen, Hechten, Ausholen)
export const TAKEOFF = { volley: 0.14, dropkick: 0.14, seitfall: 0.26, fallrueck: 0.3, kopf: 0.3, flugkopf: 0.3, salto: 0.32 };
// Technik-Güte (zusätzlicher q-Faktor: riskante Techniken ungenauer) und Kontakt-Toleranz (m)
export const TECH_Q = { volley: 1, dropkick: 0.95, seitfall: 0.84, fallrueck: 0.74, kopf: 0.9, flugkopf: 0.82, salto: 0.66 };
const TOL = { volley: 0.42, dropkick: 0.4, seitfall: 0.45, fallrueck: 0.42, kopf: 0.34, flugkopf: 0.5, salto: 0.45 };
// n11 (Peter 02.11.: „spieler springen höher“): Absprungtempo je Technik (m/s) vor sprungAkro; Kopfball nach Höhe, Volley springt
// über 0,85 m (Ballmitte) hoch
const JUMP_V = { seitfall: 2.6, fallrueck: 2.6, flugkopf: 1.8, salto: 2.4 };
export function jumpFor(P, tech, h) {
  if (tech === 'kopf') { const jh = Math.max(0, h - P.headH); return jh > 0.02 ? Math.sqrt(2 * P.g * jh) : 0; }
  if (tech === 'volley') return P.akro && h > 0.85 ? Math.sqrt(2 * P.g * (h - 0.85)) : 0;
  return (JUMP_V[tech] || 0) * (P.sprungAkro || 1);
}
// Erfolgs-Maß eines Luftball-Plans für die Spektakel-Wahl: Planwert × Technik-Güte
const succOf = (c) => c.total * (TECH_Q[c.tech] ?? 1);

// Luftball-Plan: bester Treffpunkt (Zeit, Technik) für diesen Spieler. purpose 'shot' (aufs Tor) | 'clear' (weg vom
// eigenen Tor). tPress = Zeitpunkt des Drucks (Timing). Gibt null zurück, wenn kein Luftball sinnvoll ist.
// n11: purpose 'pass' = Direktpass aus der Luft (Kopfballpass, Volleypass, …) zum Mitspieler in Stick-/Blickrichtung (aim). Unter
// Techniken mit fast gleichem Erfolg (≥ 1 − spektakel) nimmt der Plan die spektakulärste (SPEKTAKEL in technique.js).
export function planAir(game, pl, { tPress = game.t, purpose = 'shot', minScore = 0.22, minSpeed = 0, aim = null } = {}) {
  const P = game.P, b = game.ball;
  if (b.held >= 0 || pl.fall || pl.hand.mode !== 'none') return null;
  // Ball ist oder wird in der Vorschau hoch genug und nah genug
  if (b.p.y < 0.3 && b.v.y < 1.0 && Math.hypot(b.p.x - pl.x, b.p.z - pl.z) > 1.5) return null;
  // Ballvorhersage einmal je Takt (mehrere Spieler prüfen im selben Takt)
  if (_predKey.g !== game || _predKey.tick !== game.tick) { predictBall(P, game.cage, b, P.airHorizon, 2, _pred); _predKey.g = game; _predKey.tick = game.tick; }
  const pred = _pred;
  const gx = purpose === 'clear' ? -attackGoalX(game, pl) : attackGoalX(game, pl);
  const scale = P.luft || 1;
  const ext = P.akro ? Math.max(0, P.jumpMax - 0.6) : 0, hMax = Math.max(2.7, P.headH + P.jumpMax + 0.1), salto = !!P.salto;
  // Pass aus der Luft: Ziel = bester Mitspieler in Stick-/Blickrichtung (die Bahn plant planPass beim Kontakt)
  let passT = null;
  if (purpose === 'pass') {
    const a0 = aim || [Math.cos(pl.face), Math.sin(pl.face)];
    const c = passCandidates(game, pl, a0, [b.p.x, b.p.z], aim ? 70 : 180).find((m) => !m.bank && !m.virtual);
    if (!c) return null;
    passT = [c.x + (c.vx || 0) * 0.6, c.z + (c.vz || 0) * 0.6];
  }
  let best = null, maxScore = 0; // maxScore: bester Technik-Wert ohne Timing (für Bots/Skripte: auf die beste warten)
  const byTech = {};
  let lastBounce = -9;
  for (let k = 1; k < pred.length; k++) {
    const s = pred[k];
    if (s.bounce) lastBounce = s.t;
    if (s.t < 0.08) continue;
    const h = s.y;
    if (h < 0.12 || h > hMax) continue;
    const vxz = Math.hypot(s.vx, s.vz);
    if (minSpeed && Math.hypot(vxz, s.vy) < minSpeed) continue;
    let sx, sz; // Richtung, aus der der Ball kommt
    if (vxz > 1.0) { sx = -s.vx / vxz; sz = -s.vz / vxz; } else { const dx = pl.x - s.x, dz = pl.z - s.z, dl = Math.hypot(dx, dz) || 1; sx = dx / dl; sz = dz / dl; }
    // Ziel: Tormitte (Schuss) bzw. gegnerische Hälfte (Befreiung)
    const tx = passT ? passT[0] : purpose === 'clear' ? -gx * 0.4 : gx, tz = passT ? passT[1] : purpose === 'clear' ? s.z * 0.5 : 0;
    const gdx = tx - s.x, gdz = tz - s.z, gl = Math.hypot(gdx, gdz) || 1;
    const theta = Math.acos(clamp((sx * gdx + sz * gdz) / gl, -1, 1)) / DEG;
    const bounced = s.t - lastBounce < 0.2 && lastBounce > 0;
    const sc = airScores(h, theta, bounced, scale, ext, salto && purpose !== 'clear');
    const lead = game.t + s.t - tPress;
    for (const tech of AIR_KEYS) {
      if (sc[tech] < 0.12) continue;
      const T = AIR_TECH[tech];
      // Körperposition und Blick je Technik (airFrame), Abstand zum Treffpunkt je Technik
      const fr = airFrame(tech, sx, sz, gdx / gl, gdz / gl, T.dist);
      const bx = s.x + fr.ox, bz = s.z + fr.oz;
      const d = Math.hypot(bx - pl.x, bz - pl.z);
      const va = ((bx - pl.x) * pl.vx + (bz - pl.z) * pl.vz) / (d || 1);
      const reach = pl.travel(va, P.vTop, s.t) + T.extra + 0.25;
      if (d > reach) continue;
      // Kopfball über Kopfhöhe: Sprung nötig (Scheitel am Treffpunkt), braucht Zeit
      let takeoff = TAKEOFF[tech];
      if (tech === 'kopf' && h > P.headH + 0.02) {
        const jh = h - P.headH;
        if (jh > P.jumpMax || s.t < Math.sqrt(2 * jh / P.g) + 0.04) continue;
        if (P.akro) takeoff = Math.min(0.36, Math.max(takeoff, Math.sqrt(2 * jh / P.g))); // n11: Absprung früher (Kopf nahe am Scheitel, höchstens 0,36 s vorher)
      }
      if (s.t < TAKEOFF[tech] * 0.6) continue; // zu spät für die Bewegung
      const tq = timingFit(tech, lead);
      const margin = clamp(1 - d / (reach + 0.01), 0, 1);
      if (sc[tech] > maxScore) maxScore = sc[tech];
      const total = sc[tech] * (0.35 + 0.65 * tq) * (0.75 + 0.25 * margin) * (1 - 0.12 * s.t);
      const c = { tech, total, score: sc[tech], tq, t: s.t, tc: game.t + s.t, bx, bz, cx: s.x, cy: h, cz: s.z, sx, sz, fx: fr.fx, fz: fr.fz, foot: fr.foot, theta, h, bounced, lead, vin: Math.hypot(s.vx, s.vy, s.vz), purpose, goalX: attackGoalX(game, pl), takeoff, aim };
      if (!best || total > best.total) best = c;
      if (!byTech[tech] || total > byTech[tech].total) byTech[tech] = c;
    }
  }
  if (!best) return null;
  // n11 Spektakel: unter fast gleich erfolgreichen Techniken die spektakulärste (nie eine klar schlechtere)
  if (P.akro && P.spektakel > 0) {
    const lim = (1 - P.spektakel) * succOf(best);
    for (const k in byTech) { const c = byTech[k]; if (c.total >= minScore && succOf(c) >= lim && spektakelRang(c.tech) > spektakelRang(best.tech)) best = c; }
  }
  best.maxScore = maxScore;
  return best.total >= minScore ? best : null;
}

// n11: Zeitreserve der Gegner für einen Direktpass aus der Luft vom Treffpunkt des Plans aus (Ball dafür kurz an den Treffpunkt
// gesetzt) → {slack, to} oder null
export function airPassSlack(game, pl, plan) {
  const b = game.ball, sx = b.p.x, sy = b.p.y, sz = b.p.z;
  b.p.x = plan.cx; b.p.y = plan.cy; b.p.z = plan.cz;
  let r = null;
  try { const pp = planPass(game, pl, { stick: plan.aim, must: true, maxU: AIR_PROPS[plan.tech].vmax }); if (pp && pp.hoch && pp.to >= 0) r = { slack: pp.slack, to: pp.to }; }
  finally { b.p.x = sx; b.p.y = sy; b.p.z = sz; }
  return r;
}

// Ausrichtung je Technik (Nacht 2d, Peter: „Fallrückzieher in die richtige Richtung“). Bis Nacht 2c schaute jeder Spieler
// in Flugrichtung des Balls – mit dem Rücken zum Ball –, der Körper stand dabei auf der Seite, von der der Ball kommt.
// s = Richtung, aus der der Ball kommt; g = Richtung Ziel (Tormitte); d = Abstand Körper ↔ Treffpunkt (AIR_TECH.dist).
// → Blick f, Körper = Treffpunkt + (ox, oz), Schussbein foot (+1 rechts, −1 links; 0 = egal)
//  - Fallrückzieher: Blick zum Ball, Rücken zum Tor, Treffpunkt über/hinter dem Kopf (Körper auf der Ballseite);
//    er fällt rückwärts, also mit dem Kopf zum Tor
//  - Seitfallzieher: Blick zum Ball, Tor seitlich; Treffpunkt neben dem Körper zur Torseite, Schussbein auf der Torseite
//  - Volley, Dropkick, Kopfball, Flugkopfball: Blick zwischen Ball und Tor (zum Ball hin), Treffpunkt vor dem Körper bzw.
//    vor dem Kopf (Flugkopfball: Körper 0,95 m dahinter, er hechtet hinein)
export function airFrame(tech, sx, sz, gx, gz, d) {
  const norm = (x, z, fx, fz) => { const l = Math.hypot(x, z); return l > 0.2 ? [x / l, z / l] : [fx, fz]; };
  let f, ox, oz, foot = 0;
  if (tech === 'fallrueck') { f = [sx, sz]; ox = sx * d; oz = sz * d; }
  else if (tech === 'salto') { f = [gx, gz]; ox = gx * d; oz = gz * d; } // n11: Blick zum Ziel, Ball schon hinter dem Rücken
  else if (tech === 'seitfall') {
    f = [sx, sz]; ox = -gx * d; oz = -gz * d;
    foot = -gx * Math.sin(Math.atan2(sz, sx)) + gz * Math.cos(Math.atan2(sz, sx)) > 0 ? -1 : 1; // Tor links → linkes Bein
  } else f = norm(sx + gx, sz + gz, sx, sz); // Flugkopfball: hechtet so zum Ball hin, dass er ihn Richtung Tor nickt
  if (!ox && !oz) { ox = -f[0] * d; oz = -f[1] * d; }
  return { fx: f[0], fz: f[1], ox, oz, foot };
}

// Timing-Hilfe (Nacht 2c, Mensch per Tipp, Regler ?timinghilfe=0…1): der Druck merkt den Luftball nur vor, die
// Technik-Hilfe wählt den besten Moment – geplant wird, als drücke der Spieler jetzt; übernommen wird der Plan erst,
// wenn der Zeitpunkt ideal ist (bestes Technik-Fenster) oder gleich keine Zeit mehr bleibt. Ein zu später Druck kostet
// dann höchstens 15 % Timing-Wert (help = 1). Gibt den Plan oder null (weiter warten) zurück.
// out.wait = true: es gibt einen Luftball, nur der beste Moment kommt noch (n11: der Tipp-Kick wartet dann am Boden nicht)
export function planAirHelp(game, pl, help = 1, purpose = 'shot', aim = null, out = null) {
  const plan = planAir(game, pl, { tPress: game.t, purpose, aim });
  if (!plan) return null;
  const ideal = plan.tq >= 0.999 && plan.score >= 0.85 * plan.maxScore;
  if (!ideal && plan.t > AIR_TECH[plan.tech].lead[0] + 0.1) { if (out) out.wait = true; return null; } // der beste Moment kommt noch
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
    if (tRem <= (a.takeoff ?? TAKEOFF[a.tech])) {
      a.go = true; a.t0 = game.t;
      pl.jumpV = jumpFor(P, a.tech, a.h);
      if (a.foot) pl.kickFoot = a.foot; // Seitfallzieher: Schussbein auf der Torseite (Pose kippt zur anderen Seite)
      game.events.push({ type: 'airstart', tech: a.tech, player: pl.id, x: pl.x, z: pl.z });
    }
  }
  // Bewegung: zur Körperposition, pünktlich zum Treffpunkt (im Flug nur noch Schwung)
  if (!a.go || a.tech === 'flugkopf') {
    const need = d / Math.max(0.06, tRem);
    const vmax = a.tech === 'flugkopf' && a.go ? 6 : P.vTop;
    const v = clamp(need, 0, vmax);
    const k = 1 - Math.exp(-dt * (a.go ? 20 : 9));
    const tvx = d > 0.02 ? dx / d * v : 0, tvz = d > 0.02 ? dz / d * v : 0;
    pl.vx += (tvx - pl.vx) * k; pl.vz += (tvz - pl.vz) * k;
  } else { pl.vx *= Math.exp(-dt * 3); pl.vz *= Math.exp(-dt * 3); }
  pl.x += pl.vx * dt; pl.z += pl.vz * dt;
  const lx = game.cage.hx - P.bodyR, lz = game.cage.hz - P.bodyR;
  pl.x = clamp(pl.x, -lx, lx); pl.z = clamp(pl.z, -lz, lz);
  pl.speed = Math.hypot(pl.vx, pl.vz);
  // Blick je Technik (airFrame): Fallrückzieher zum Ball mit dem Rücken zum Tor, Seitfall seitlich, sonst zwischen Ball und Tor
  const fAng = Math.atan2(a.fz, a.fx);
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
    if (g > 0) pl.fall = { tech, t: 0, dur: g + 0.25, cy: a.cy }; // Flug + Landung + am Boden (n11: cy für die Treff-Pose der Grafik)
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
  const sp = Math.min(T.vmax, T.v0 + T.vin * vin) * (T.wucht ? Math.max(0.3, P.wucht ?? 1) : 1);
  const qMul = tq * cq * TECH_Q[a.tech];
  if (a.purpose === 'pass') { // n11: Direktpass aus der Luft – hohe Bahn zum Mitspieler wie am Boden (planPass ab dem Treffpunkt)
    const plan = planPass(game, pl, { stick: a.aim, must: true, maxU: T.vmax, noiseMul: (pl.airNoise ?? 1) * (2 - qMul) });
    if (plan && plan.to !== -1 && plan.hoch) {
      plan.tech = a.tech === 'kopf' || a.tech === 'flugkopf' ? 'kopfpass' : a.tech === 'volley' || a.tech === 'dropkick' ? 'volleypass' : a.tech;
      plan.timing = a.tq;
      pl.applyPlan(plan, game, 0);
      if (b.p.y < b.r + 0.02) b.p.y = b.r + 0.02;
      b.contact = false;
      game.events.push({ type: 'air', tech: a.tech, pass: true, player: pl.id, speed: plan.speed, q: qMul, timing: a.tq, x: b.p.x, y: b.p.y, z: b.p.z });
      return;
    }
    a.purpose = 'clear'; // kein Mitspieler erreichbar: wegschlagen
  }
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
