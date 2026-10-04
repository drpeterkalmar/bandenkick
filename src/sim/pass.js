// Pass (Nacht 2b): Empfänger im Kegel um die Stick-Richtung (ohne Stick: Blickrichtung), gewichtet nach Winkel,
// Abstand und freiem Passweg – direkt oder über die Längsbande (Spiegelbild des Mitspielers). Kein Mitspieler im
// Kegel → Pass in den freien Raum. Gespielt wird IN DEN LAUFWEG: Treffpunkt aus Laufrichtung/Tempo des Empfängers
// und der echten Rollphysik (Roll-Tabelle aus ball.js, Iteration über die Ankunftszeit). Hoch = Chip mit Rückdrall,
// Abflug 25–45° je nach Weite, Landepunkt im Laufweg, Scheitel unter dem Dachnetz.
// Technik nach Lage: vor dem Körper Innenseite/Vorfuß, seitlich Außenrist, hinter dem Körper (Ball am Standbein) Hacke.
import { passDist, passSpeedAt, passSpeedFor, passTimeTo, chipTime, chipApex, chipSpeedFor, chipBack, bankRatio, clamp } from './kickplan.js';
import { passTechnique, PASS_PROPS } from './technique.js';

const DEG = Math.PI / 180;

// Abstand eines Punkts zur Strecke a→b
function segDist(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
  const t = clamp(((px - ax) * ex + (pz - az) * ez) / L2, 0, 1);
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}
function laneFree(game, team, ax, az, bx, bz, skip = -1) {
  let m = 9;
  for (const o of game.players) if (o.team !== team && o.id !== skip) m = Math.min(m, segDist(o.x, o.z, ax, az, bx, bz));
  return m;
}

// Nacht 2e: Würde ein Pass in Richtung ad (Weite D) aufs eigene Tor zu durch den eigenen Torraum (+1 m) laufen? Nur im Spiel.
function ownGoalRisk(game, pl, from, ad, D) {
  const R = game.match ? game.rules : null;
  if (!R || game.challenge || game.P.rueckpass) return false;
  const gx = R.goalX(pl.team), ex = gx - from[0], ez = -from[1];
  if (ad[0] * ex + ad[1] * ez <= 0) return false; // weg vom eigenen Tor
  return segDist(gx, 0, from[0], from[1], from[0] + ad[0] * D, from[1] + ad[1] * D) < game.P.torraum + 1;
}

// Hoch = Nacht 2c feste Flanke (?flanke=): bei 8 m 24°, ab 15 m 14°, 2,5 U/s Rückdrall; kurz bleibt der Chip steil.
// Laufweg des Empfängers: läuft mit seinem Tempo weiter (höchstens ~2,2 s), bleibt 0,7 m vor der Bande
export function runPath(cage, r0, rv, T) {
  const tt = Math.min(T, 2.2);
  const lx = cage.hx - 0.7, lz = cage.hz - 0.7;
  return [clamp(r0[0] + rv[0] * tt, -lx, lx), clamp(r0[1] + rv[1] * tt, -lz, lz)];
}

// Flacher Pass in den Laufweg. Auto-Stärke: Ankunftszeit T so, dass der Ball mit angenehmem Tempo ankommt
// (4,3 m/s + 0,12 m/s je Meter, Relativtempo zum Empfänger ≤ 8 m/s). Mit fester Stärke (Halten): T so, dass der Ball
// den Laufweg genau trifft. Gibt {T, u, meet, vArr, D} zurück.
export function leadFlat(P, cage, b0, r0, rv, { speedMul = 1, maxSpeed = P.passMaxSpeed } = {}) {
  let best = null;
  for (let T = 0.25; T <= 3.6; T += 0.02) {
    const R = runPath(cage, r0, rv, T);
    const D = Math.hypot(R[0] - b0[0], R[1] - b0[1]);
    const u = passSpeedFor(P, D, T);
    if (u == null || u > maxSpeed) continue;
    const vA = passSpeedAt(P, u, T);
    const dx = (R[0] - b0[0]) / (D || 1), dz = (R[1] - b0[1]) / (D || 1);
    const rel = Math.hypot(vA * dx - rv[0], vA * dz - rv[1]);
    const vIdeal = 4.3 + 0.12 * D;
    const cost = ((vA - vIdeal) / 1.2) ** 2 + (T > 2.4 ? (T - 2.4) * 2 : 0) + (rel > 8 ? (rel - 8) ** 2 : 0) + (vA < 1.2 ? 4 : 0);
    if (!best || cost < best.cost) best = { cost, T, u, meet: R, vArr: vA, D };
  }
  if (!best) { // zu weit: so hart wie erlaubt Richtung Laufweg
    const R = runPath(cage, r0, rv, 1.5), D = Math.hypot(R[0] - b0[0], R[1] - b0[1]);
    best = { T: passTimeTo(P, maxSpeed, D), u: maxSpeed, meet: R, vArr: 0, D };
  }
  if (speedMul !== 1) { // Stärke aus der Haltedauer: Tempo fest, Treffpunkt auf dem Laufweg neu suchen
    const u = clamp(best.u * speedMul, 2, maxSpeed);
    let pick = null;
    for (let T = 0.1; T <= 4; T += 0.02) {
      const R = runPath(cage, r0, rv, T);
      const D = Math.hypot(R[0] - b0[0], R[1] - b0[1]);
      const err = Math.abs(passDist(P, u, T) - D);
      if (!pick || err < pick.err) pick = { err, T, R, D };
    }
    best = { T: pick.T, u, meet: pick.R, vArr: passSpeedAt(P, u, pick.T), D: pick.D };
  }
  return best;
}

// Chip (hoher Pass mit Rückdrall): Abflug steil bei kurzen, flach bei weiten Pässen; Landepunkt = Laufweg zur
// Landezeit (Iteration über die Chip-Tabelle); Scheitel ≥ 0,5 m unter dem Dachnetz. Gibt {T, u, el, meet, D, apex}.
export function chipElev(P, D) {
  const old = clamp(P.chipElevMax - (P.chipElevMax - P.chipElevMin) * (D - 5) / 12, P.chipElevMin, P.chipElevMax);
  const f = clamp(P.flanke ?? 0, 0, 1);
  if (!f) return old;
  // Nacht 2c: feste Flanke – bis 5 m steiler Chip (über den Tormann), bei flankeD m flankeElev, ab 15 m flankeMin
  const nw = D <= 5 ? P.chipElevMax
    : D <= P.flankeD ? P.chipElevMax + (P.flankeElev - P.chipElevMax) * (D - 5) / (P.flankeD - 5)
      : Math.max(P.flankeMin, P.flankeElev + (P.flankeMin - P.flankeElev) * (D - P.flankeD) / Math.max(0.1, 15 - P.flankeD));
  return old + (nw - old) * f;
}
export function leadChip(P, cage, b0, r0, rv, { speedMul = 1 } = {}) {
  let T = 1.0, res = null;
  const top = P.roof ? P.roofH - 0.5 : 99;
  for (let it = 0; it < 7; it++) {
    const R = runPath(cage, r0, rv, T);
    let D = Math.max(1.5, Math.hypot(R[0] - b0[0], R[1] - b0[1]));
    let el = chipElev(P, D), u = chipSpeedFor(P, el, D);
    while (u != null && chipApex(P, el, u) > top && el > 18) { el -= 4; u = chipSpeedFor(P, el, D); }
    if (u == null) { el = Math.min(P.chipElevMin, chipElev(P, 99)); u = chipSpeedFor(P, el, D) ?? 24; }
    const T2 = chipTime(P, el, u);
    res = { T: T2, u, el, meet: R, D, apex: chipApex(P, el, u) };
    if (Math.abs(T2 - T) < 0.01) break;
    T = T2;
  }
  if (speedMul !== 1) { res.u = clamp(res.u * speedMul, 3, 24); res.T = chipTime(P, res.el, res.u); }
  return res;
}

// Bandenpass über die Längsbande (Seite s = ±1): Zielpunkt an der Bande aus der gemessenen Abprall-Kennzahl ρ,
// Tempo so, dass der Ball nach dem Abprall (Anteil keep) mit ~4,5 m/s ankommt
export function leadBank(P, cage, b0, r0, rv, s) {
  const br = bankRatio(P, cage, 0), r = P.ballR;
  const zw = s * (cage.hz - r);
  let M = r0, out = null;
  for (let it = 0; it < 3; it++) {
    const d1 = Math.abs(zw - b0[1]), d2 = Math.abs(zw - M[1]);
    if (d1 < 0.6 || d2 < 0.4) return null;
    const a = (M[0] - b0[0]) / (1 + br.rho * d2 / d1);
    const wx = b0[0] + a;
    if (Math.abs(wx) > cage.hx - 0.8) return null;
    const L1 = Math.hypot(a, d1), L2 = Math.hypot(M[0] - wx, d2);
    // Tempo nach dem Abprall: kommt mit ~4,5 m/s beim Empfänger an
    let lo = 2, hi = 22;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; const t = passTimeTo(P, m, L2); if (!Number.isFinite(t) || passSpeedAt(P, m, t) < 4.5) lo = m; else hi = m; }
    const u2 = (lo + hi) / 2, v1 = u2 / Math.max(0.35, br.keep);
    lo = v1; hi = 24;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; const t = passTimeTo(P, m, L1); if (!Number.isFinite(t) || passSpeedAt(P, m, t) < v1) lo = m; else hi = m; }
    const u = (lo + hi) / 2;
    const T = passTimeTo(P, u, L1) + passTimeTo(P, u2, L2);
    out = { T, u, aim: [wx, zw + s * 0.3], meet: M, L1, L2, D: L1 + L2 };
    M = runPath(cage, r0, rv, T);
  }
  return out && out.u <= P.passMaxSpeed + 2 ? out : null;
}

// Mögliche Empfänger: Mitspieler direkt und über beide Längsbanden, dazu Challenge-Ziele. Bewertet nach Winkel zur
// Zielrichtung (Kegel ±passCone), Abstand und freiem Passweg. aim = [x, z] (Einheitsvektor).
export function passCandidates(game, pl, aim, from, cone = game.P.passCone) {
  const P = game.P, cage = game.cage, R = game.match ? game.rules : null;
  const list = [];
  // Nacht 2e: kein Rückpass – die eigene letzte Hand im Torraum ist kein Empfänger (?rueckpass=1 = alt)
  const mates = game.players.filter((m) => m.team === pl.team && m.id !== pl.id && !(R && R.isBackPassTarget(m))).map((m) => ({ id: m.id, x: m.x, z: m.z, vx: m.vx, vz: m.vz }));
  if (game.challenge && game.challenge.passTargets) for (const t of game.challenge.passTargets()) mates.push(t);
  for (const m of mates) {
    for (const bank of [0, 1, -1]) {
      const tz = bank ? bank * 2 * cage.hz - m.z : m.z;
      const dx = m.x - from[0], dz = tz - from[1], D = Math.hypot(dx, dz);
      if (D < 1.2) continue;
      const ang = Math.acos(clamp((dx * aim[0] + dz * aim[1]) / D, -1, 1)) / DEG;
      if (ang > cone) continue;
      const D0 = Math.hypot(m.x - from[0], m.z - from[1]);
      let lane;
      if (bank) {
        const zw = bank * cage.hz, k = (zw - from[1]) / (tz - from[1] || 1e-6), wx = from[0] + dx * k;
        lane = Math.min(laneFree(game, pl.team, from[0], from[1], wx, zw), laneFree(game, pl.team, wx, zw, m.x, m.z));
        if (Math.abs(wx) > cage.hx - 0.8) continue;
      } else lane = laneFree(game, pl.team, from[0], from[1], m.x, m.z);
      const wAng = 1 - 0.6 * (ang / cone) ** 2;
      const wDist = D0 < 2 ? 0.25 : D0 < 3.5 ? 0.75 : D0 <= 14 ? 1 : 0.8;
      const wLane = clamp((lane - 0.25) / 1.1, 0.15, 1);
      const score = wAng * wDist * wLane * (bank ? 0.72 : 1) * (m.virtual ? 1.1 : 1);
      list.push({ ...m, bank, ang, lane, score, D0 });
    }
  }
  list.sort((a, b) => b.score - a.score);
  return list;
}

// Kompletter Pass-Plan. opts: mode 'std' (flach) | 'var' (hoch), power (null = Auto-Stärke), stick [x,z]|null,
// to (fester Empfänger, Bots), aim (Richtung überschreiben), noiseMul
export function planPass(game, pl, opts = {}) {
  const P = game.P, cage = game.cage, b = game.ball;
  const from = [b.p.x, b.p.z];
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
  const aim = opts.aim || opts.stick || [fx, fz];
  const al = Math.hypot(aim[0], aim[1]) || 1;
  const ad = [aim[0] / al, aim[1] / al];
  const chip = opts.mode === 'var';
  const power = opts.power;
  let cand = null;
  if (opts.to != null && opts.to >= 0) {
    const m = game.players[opts.to];
    cand = { id: m.id, x: m.x, z: m.z, vx: m.vx, vz: m.vz, bank: 0 };
  } else {
    cand = passCandidates(game, pl, ad, from)[0] || null;
    // Nacht 2e: zeigt der Stick (ohne Mitspieler im Kegel) aufs eigene Tor, geht der Pass zum nächstbesten Mitspieler im
    // erweiterten Kegel (±70°) oder seitlich in den freien Raum – nie aufs eigene Tor zu
    if (!cand && ownGoalRisk(game, pl, from, ad, power == null ? P.passFree : 18)) {
      cand = passCandidates(game, pl, ad, from, 70)[0] || null;
      if (!cand) {
        const a0 = Math.atan2(ad[1], ad[0]);
        for (let k = 1; k <= 18; k++) {
          const opt = [1, -1].map((sg) => [Math.cos(a0 + sg * k * 10 * DEG), Math.sin(a0 + sg * k * 10 * DEG)]).filter((d) => !ownGoalRisk(game, pl, from, d, power == null ? P.passFree : 18));
          if (opt.length) { opt.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); ad[0] = opt[0][0]; ad[1] = opt[0][1]; break; }
        }
      }
    }
  }
  let plan;
  if (cand) {
    const r0 = [cand.x, cand.z], rv = [cand.vx || 0, cand.vz || 0];
    if (cand.bank && !chip) {
      const bk = leadBank(P, cage, from, r0, rv, cand.bank);
      if (bk) plan = { to: cand.id, bank: cand.bank, target: bk.aim, meet: bk.meet, T: bk.T, u: bk.u, el: 1.5, back: -0.3 * bk.u / b.r, virtual: !!cand.virtual };
    }
    if (!plan && chip) {
      const c = leadChip(P, cage, from, r0, rv, { speedMul: power == null ? 1 : 0.9 + 0.3 * power });
      plan = { to: cand.id, bank: 0, target: c.meet, meet: c.meet, T: c.T, u: c.u, el: c.el, back: chipBack(P), chip: true, apex: c.apex, virtual: !!cand.virtual };
    }
    if (!plan) {
      const f = leadFlat(P, cage, from, r0, rv, { speedMul: power == null ? 1 : 0.8 + 0.7 * power });
      plan = { to: cand.id, bank: 0, target: f.meet, meet: f.meet, T: f.T, u: f.u, el: 1.5, back: -0.3 * f.u / b.r, vArr: f.vArr, virtual: !!cand.virtual };
    }
  } else {
    // freier Raum in Zielrichtung: Tipp 7 m, Halten 4 … 18 m
    const D = power == null ? P.passFree : 4 + 14 * power;
    const tx = from[0] + ad[0] * D, tz = from[1] + ad[1] * D;
    if (chip) {
      const el = chipElev(P, D), u = chipSpeedFor(P, el, D) ?? 18;
      plan = { to: -1, bank: 0, target: [tx, tz], meet: [tx, tz], T: chipTime(P, el, u), u, el, back: chipBack(P), chip: true };
    } else {
      let lo = 1, hi = 24; // kommt mit ~1,8 m/s an
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; const t = passTimeTo(P, m, D); if (!Number.isFinite(t) || passSpeedAt(P, m, t) < 1.8) lo = m; else hi = m; }
      const u = (lo + hi) / 2;
      plan = { to: -1, bank: 0, target: [tx, tz], meet: [tx, tz], T: passTimeTo(P, u, D), u, el: 1.5, back: -0.3 * u / b.r };
    }
  }
  // Technik nach Lage (Winkel Blickrichtung ↔ Passrichtung, Ball am Standbein)
  const kx = plan.target[0] - from[0], kz = plan.target[1] - from[1], kl = Math.hypot(kx, kz) || 1;
  const ang = Math.acos(clamp((kx * fx + kz * fz) / kl, -1, 1)) / DEG;
  const bd = Math.hypot(b.p.x - pl.x, b.p.z - pl.z);
  let tech = chip ? 'chip' : passTechnique(ang, bd, P);
  const props = PASS_PROPS[tech];
  if (plan.u > props.maxSpeed) plan.u = props.maxSpeed; // Hacke: höchstens ~8 m
  let noise = 1.1 * props.noise * (pl.sprinting ? 1.6 : 1) * (opts.noiseMul ?? 1);
  if (chip && ang > P.passHackeDeg) noise *= 2.5; // Chip über die Schulter: selten und ungenau
  plan.dir = [kx / kl, kz / kl];
  Object.assign(plan, { kind: 'pass', mode: chip ? 'var' : 'std', tech, ang, noiseDeg: noise, power, elRad: plan.el * DEG, speed: plan.u });
  return plan;
}
