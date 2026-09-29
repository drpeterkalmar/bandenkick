// Spielregeln 3 gegen 3 (ohne DOM): „letzte Hand“, Torraum, Fangen/Hechten/Abwurf, 6-s-Regel, Schnellstart
// nach Tor (Tormann des Gegentors hat den Ball) oder Anstoß (?anstoss=1), Spielzeit 2 × dauer min, Golden Goal.
// Mannschaft 0 verteidigt das linke Tor (x = −L/2) und spielt nach rechts, Mannschaft 1 umgekehrt.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Abwurf-Tempo nach Entfernung (kommt mit ~6 m/s beim Mitspieler an)
export const throwSpeedFor = (P, D) => clamp(Math.sqrt(49 + 3 * D), 8, P.throwSpeed + 3);

export class Rules {
  constructor(game) {
    this.g = game;
    const P = game.P;
    this.keeper = [-1, -1];             // „letzte Hand“ je Mannschaft (Spieler-Index)
    this.chal = [{ id: -1, t: 0 }, { id: -1, t: 0 }];
    this.clock = 0;                     // gespielte Zeit (s), läuft nur im Spiel
    this.half = 1;
    this.halfLen = Math.max(0.25, P.dauer) * 60;
    this.phase = 'kickoff';             // kickoff | play | goal | halftime | out | end
    this.phaseT = 0;
    this.kickoffTeam = 0;
    this.golden = false;                // Golden-Goal-Verlängerung läuft
    this.lastTouchTeam = -1;
    this.goals = [];                    // [{t, team, scorer}]
    this.winner = -1;
    this.handsOffTeam = -1;             // Training: diese Mannschaft darf keine Hände nehmen
  }

  // ---------- Geometrie ----------
  goalX(team) { return team === 0 ? -this.g.cage.hx : this.g.cage.hx; }
  lineDist(pl) { return pl.team === 0 ? pl.x + this.g.cage.hx : this.g.cage.hx - pl.x; }
  // Liegt (x, z) im Torraum der Mannschaft? Halbkreis Radius torraum um die Tormitte, feldseitig.
  inBox(team, x, z, tol = 0) {
    const gx = this.goalX(team), R = this.g.P.torraum + tol;
    const dx = x - gx;
    if ((team === 0 && dx < -0.05) || (team === 1 && dx > 0.05)) return false;
    return dx * dx + z * z <= R * R;
  }
  // Darf dieser Spieler gerade die Hände benutzen? Nur die letzte Hand, nur im eigenen Torraum.
  handsOk(pl) {
    if (this.handsOffTeam === pl.team) return false; // Schützen-Challenges: keine Hände
    return this.keeper[pl.team] === pl.id && this.inBox(pl.team, pl.x, pl.z) && this.phase !== 'end';
  }

  // ---------- „Letzte Hand“ mit Hysterese ----------
  updateKeepers(dt, force = false) {
    const g = this.g;
    for (let team = 0; team < 2; team++) {
      const pls = g.players.filter((p) => p.team === team);
      if (!pls.length) { this.keeper[team] = -1; continue; }
      let best = pls[0];
      for (const p of pls) if (this.lineDist(p) < this.lineDist(best)) best = p;
      const cur = g.players[this.keeper[team]];
      if (force || !cur || cur.team !== team) { this.keeper[team] = best.id; this.chal[team] = { id: -1, t: 0 }; continue; }
      // Hält oder hechtet der Tormann, bleibt er es
      if (cur.hand.mode !== 'none' || g.ball.held === cur.id) { this.chal[team] = { id: -1, t: 0 }; continue; }
      const c = this.chal[team];
      if (best.id !== cur.id && this.lineDist(cur) - this.lineDist(best) >= g.P.keeperDist) {
        if (c.id === best.id) c.t += dt; else { c.id = best.id; c.t = dt; }
        if (c.t >= g.P.keeperT - 1e-9) {
          this.keeper[team] = best.id; this.chal[team] = { id: -1, t: 0 };
          g.events.push({ type: 'keeper', team, player: best.id });
        }
      } else { c.id = -1; c.t = 0; }
    }
  }

  // ---------- Hände: Fangen, Abwehren, Hechten, Halten, Abwurf/Abschlag ----------
  // inputs: je Spieler {hand (Fangen gedrückt/gehalten), dive (Flanke), throw (Flanke), punt (Flanke), mx, mz}
  hands(dt, inputOf) {
    const g = this.g, P = g.P, b = g.ball;
    for (let team = 0; team < 2; team++) {
      const pl = g.players[this.keeper[team]];
      if (!pl) continue;
      const inp = inputOf(pl.id);
      const ok = this.handsOk(pl);
      // Hechtsprung auslösen (nur im Torraum, nicht mit Ball in der Hand)
      if (inp.dive && ok && pl.hand.mode === 'none' && b.held < 0) {
        let dx = inp.diveX ?? inp.mx ?? 0, dz = inp.diveZ ?? inp.mz ?? 0;
        let l = Math.hypot(dx, dz);
        if (l < 0.2) { // Hechtrichtung-Hilfe: zum Ball
          dx = b.p.x - pl.x; dz = b.p.z - pl.z; l = Math.hypot(dx, dz) || 1;
        }
        pl.startDive(dx / l, dz / l);
        g.events.push({ type: 'dive', player: pl.id });
      }
      if (b.held === pl.id) { this.holding(dt, pl, inp); continue; }
      if (b.held >= 0 || !ok || g.t < pl.catchCd) continue;
      // Fangen: Ball in Reichweite der Hände
      const want = inp.hand || pl.hand.mode === 'dive' || inp.autoCatch;
      if (!want) continue;
      const dx = b.p.x - pl.x, dz = b.p.z - pl.z;
      // Fanghilfe (Mensch ohne Knopf): nur Bälle, die ohnehin auf den Körper kommen (autoReach).
      // Reichweite im Stand nach Höhe (Nacht 2b): Hüfte bis Kopf voll, flache Bälle nur mit Bücken (sonst hechten)
      const hB = b.p.y, rH = hB < 0.7 ? 0.55 + 0.45 * clamp((hB - 0.12) / 0.58, 0, 1) : hB > 1.9 ? 1 - 0.25 * clamp((hB - 1.9) / 0.45, 0, 1) : 1;
      let reach = Math.min(!inp.hand && inp.autoReach ? inp.autoReach : P.catchReach, P.catchReach * rH), hi = P.catchHigh, d = Math.hypot(dx, dz);
      if (pl.hand.mode === 'dive') { // im Flug: Strecke Körper → ausgestreckte Hände
        const t = clamp(dx * pl.hand.dx + dz * pl.hand.dz, 0, P.diveReach);
        d = Math.hypot(dx - pl.hand.dx * t, dz - pl.hand.dz * t);
        reach = 0.42; hi = 1.75;
      }
      if (pl.hand.mode === 'ground') continue;
      if (d > reach || b.p.y > hi || b.p.y < 0) continue;
      if (!this.inBox(team, b.p.x, b.p.z, 0.4)) continue;
      const rel = Math.hypot(b.v.x - pl.vx, b.v.y, b.v.z - pl.vz);
      const skill = inp.catchSkill ?? 1;
      if (rel > P.catchMaxRel * (0.8 + 0.2 * skill) || (inp.fumble && rel > 9)) {
        // Abwehren: Ball prallt von den Händen ab (weg vom Tor, gedämpft)
        const out = team === 0 ? 1 : -1;
        const sp = rel * 0.32;
        const side = g.rng.range(-0.8, 0.8);
        const l = Math.hypot(1, side);
        b.v.set(out * sp / l, 1.5 + g.rng.next() * 2, (side * sp) / l + b.v.z * 0.2);
        b.w.scale(0.3); b.contact = false;
        pl.touchCd = 0.4;
        this.touch(pl);
        g.events.push({ type: 'parry', player: pl.id, speed: rel, x: b.p.x, y: b.p.y, z: b.p.z });
        continue;
      }
      b.held = pl.id; b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.contact = false;
      pl.hand.mode = pl.hand.mode === 'dive' ? 'dive' : 'hold';
      pl.holdT = 0; pl.pending = null; pl.charging = false;
      this.touch(pl);
      g.events.push({ type: 'catch', player: pl.id, speed: rel, x: b.p.x, y: b.p.y, z: b.p.z });
    }
  }

  holding(dt, pl, inp) {
    const g = this.g, P = g.P;
    pl.holdT += dt;
    if (pl.hand.mode === 'dive' || pl.hand.mode === 'ground') return; // erst aufstehen
    pl.hand.mode = 'hold';
    // Im Torraum bleiben
    const gx = this.goalX(pl.team), R = P.torraum - 0.35;
    let dx = pl.x - gx, dz = pl.z;
    const side = pl.team === 0 ? 1 : -1;
    if (dx * side < 0.35) dx = 0.35 * side;
    const l = Math.hypot(dx, dz);
    if (l > R) { dx *= R / l; dz *= R / l; }
    pl.x = gx + dx; pl.z = dz;
    const auto = pl.holdT >= P.holdMax;
    if (inp.throw || inp.punt || auto) {
      let tx = inp.aimX, tz = inp.aimZ;
      if (tx === undefined || (Math.hypot(tx - pl.x, tz - pl.z) < 1 && !inp.punt)) {
        // Ziel-Hilfe: freiester Mitspieler, sonst geradeaus
        const mate = this.bestMate(pl);
        if (mate) { tx = mate.x + mate.vx * 0.6; tz = mate.z + mate.vz * 0.6; }
        else { tx = pl.x + side * 10; tz = pl.z; }
      }
      this.release(pl, tx, tz, inp.punt ? 'punt' : 'throw', inp.power ?? 1);
      if (auto) g.events.push({ type: 'sixsec', player: pl.id });
    }
  }

  // Anspielbarer Mitspieler für den Abwurf: frei (Abstand zum nächsten Gegner), Passweg frei, eher vorn.
  // Gibt null zurück, wenn niemand sinnvoll anspielbar ist (dann Abschlag weit).
  bestMate(pl, needLane = false, minLane = 1.2, minFree = 1.5) {
    const g = this.g;
    let best = null, bs = -1e9;
    for (const m of g.players) {
      if (m.team !== pl.team || m.id === pl.id) continue;
      let free = 9, lane = 9;
      const ex = m.x - pl.x, ez = m.z - pl.z, L2 = ex * ex + ez * ez || 1;
      for (const o of g.players) {
        if (o.team === pl.team) continue;
        free = Math.min(free, Math.hypot(o.x - m.x, o.z - m.z));
        const t = clamp(((o.x - pl.x) * ex + (o.z - pl.z) * ez) / L2, 0, 1);
        lane = Math.min(lane, Math.hypot(o.x - pl.x - ex * t, o.z - pl.z - ez * t));
      }
      if (needLane && (lane < minLane || free < minFree || (minLane > 1.5 && this.interceptable(pl, m)))) continue;
      const fwd = (pl.team === 0 ? m.x : -m.x);
      const s = Math.min(free, 5) * 1.2 + Math.min(lane, 3) * 1.5 + fwd * 0.15 - Math.abs(Math.sqrt(L2) - 8) * 0.2;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  // Kann ein Gegner einen Abwurf von pl zu m abfangen? Für Punkte entlang des Wegs: Gegner (Sprint, 0,3 s Reaktion,
  // 0,45 m Reichweite) deutlich früher dort als der Ball (Abwurf-Tempo wie in release)?
  interceptable(pl, m) {
    const g = this.g, P = g.P;
    const ex = m.x - pl.x, ez = m.z - pl.z, D = Math.hypot(ex, ez) || 1;
    const v = throwSpeedFor(P, D);
    for (const o of g.players) {
      if (o.team === pl.team) continue;
      for (let s = 1; s < D; s += 0.5) {
        const px = pl.x + ex / D * s, pz = pl.z + ez / D * s;
        const to = Math.max(0, Math.hypot(o.x - px, o.z - pz) - 0.45) / P.vSprint + 0.3;
        if (to < s / v - 0.05) return true;
      }
    }
    return false;
  }

  // Ball aus der Hand abgeben: Abwurf (flach, auf den Mitspieler) oder Abschlag (hoch und weit)
  release(pl, tx, tz, kind = 'throw', power = 1) {
    const g = this.g, P = g.P, b = g.ball;
    let dx = tx - pl.x, dz = tz - pl.z;
    const D = Math.hypot(dx, dz) || 1; dx /= D; dz /= D;
    b.held = -1;
    const hx = pl.x + dx * 0.45, hz = pl.z + dz * 0.45;
    if (kind === 'punt') {
      const sp = P.punt * clamp(power, 0.4, 1.15), el = 32 * Math.PI / 180;
      b.p.set(hx, 0.55, hz);
      b.v.set(dx * sp * Math.cos(el), sp * Math.sin(el), dz * sp * Math.cos(el));
      b.w.set(-dz * 20, 0, dx * 20); // leichter Rückdrall
    } else {
      // flach geworfen (Nacht 2b: zügiger, 8–14 m/s – ein gerollter 6-m/s-Abwurf wurde zu 3/4 abgefangen)
      const sp = throwSpeedFor(P, D);
      b.p.set(hx, 1.25, hz);
      b.v.set(dx * sp, -1.2, dz * sp);
      b.w.set(dz * sp / b.r * 0.3, 0, -dx * sp / b.r * 0.3);
    }
    b.contact = false; b.reseedKnuckle(g.rng);
    pl.hand.mode = 'none'; pl.holdT = 0; pl.touchCd = 0.45; pl.kickT = 0;
    pl.catchCd = g.t + 1.0; // den eigenen Abwurf nicht gleich wieder fangen
    pl.lastKick = { kind, speed: Math.hypot(b.v.x, b.v.y, b.v.z), spinRps: 0, sideRps: 0, elevDeg: 0, t: g.t };
    this.touch(pl);
    g.events.push({ type: kind, player: pl.id, speed: Math.hypot(b.v.x, b.v.z), x: b.p.x, y: b.p.y, z: b.p.z, dx, dz });
  }

  // Ball in der Hand folgt den Händen
  carry() {
    const g = this.g, b = g.ball, pl = g.players[b.held];
    if (!pl) { b.held = -1; return; }
    const f = pl.face, lying = pl.hand.mode === 'dive' || pl.hand.mode === 'ground';
    const r = lying ? 0.7 : 0.4;
    b.p.set(pl.x + Math.cos(f) * r, lying ? 0.25 : 1.13, pl.z + Math.sin(f) * r);
    b.v.set(pl.vx, 0, pl.vz); b.w.set(0, 0, 0); b.contact = false;
  }

  touch(pl) {
    this.lastTouchTeam = pl.team; this.g.lastTouch = pl.id; this.g.lastTouchT = this.g.t;
    const pp = this.g.passPlan;
    if (pp && pp.from !== pl.id) this.g.passPlan = null; // Pass angekommen oder abgefangen
  }

  // ---------- Ablauf: Tor, Aus, Uhr, Halbzeit, Ende ----------
  onGoal(side) {
    const g = this.g;
    const team = side > 0 ? 0 : 1;   // Ball im rechten Tor → Mannschaft 0 trifft
    g.score[team]++;
    let scorer = g.lastTouch;
    const own = scorer >= 0 && g.players[scorer].team !== team; // Eigentor: zuletzt ein Gegner am Ball
    if (own) scorer = -1;
    this.goals.push({ t: this.clock, team, scorer, own });
    this.phase = 'goal'; this.phaseT = 0;
    this.scoredTeam = team;
    g.events.push({ type: 'goal', side, team, scorer, own, speed: g.ball.v.len() });
    if (this.golden) this.finish();
  }

  onOut() {
    this.phase = 'out'; this.phaseT = 0;
    this.g.events.push({ type: 'out', x: this.g.ball.p.x, y: this.g.ball.p.y, z: this.g.ball.p.z });
  }

  finish() {
    const g = this.g;
    this.phase = 'end'; this.phaseT = 0;
    this.winner = g.score[0] > g.score[1] ? 0 : g.score[1] > g.score[0] ? 1 : -1;
    g.events.push({ type: 'end', score: [...g.score], winner: this.winner });
  }

  // Tormann der Mannschaft `team` bekommt den Ball in die Hände (Schnellstart, Abwurf nach Aus)
  giveKeeper(team) {
    const g = this.g, P = g.P;
    this.updateKeepers(0, true);
    const pl = g.players[this.keeper[team]];
    if (!pl) return;
    const gx = this.goalX(team), side = team === 0 ? 1 : -1;
    if (!this.inBox(team, pl.x, pl.z, -0.4)) pl.place(gx + side * 1.4, clamp(pl.z, -1.5, 1.5), team === 0 ? 0 : Math.PI);
    pl.hand.mode = 'hold'; pl.holdT = 0; pl.pending = null;
    pl.face = team === 0 ? 0 : Math.PI;
    g.ball.held = pl.id; g.ball.v.set(0, 0, 0); g.ball.w.set(0, 0, 0);
    this.carry();
    this.touch(pl);
    this.phase = 'play'; this.phaseT = 0;
    g.events.push({ type: 'restart', mode: 'keeper', team, player: pl.id });
    void P;
  }

  kickoff(team) {
    const g = this.g;
    g.setupKickoff(team);
    this.kickoffTeam = team;
    this.phase = 'kickoff'; this.phaseT = 0;
    this.updateKeepers(0, true);
    g.events.push({ type: 'restart', mode: 'kickoff', team });
  }

  post(dt) {
    const g = this.g, P = g.P;
    this.phaseT += dt;
    if (this.phase === 'kickoff') {
      // Anstoß: Spiel läuft, sobald der Ball berührt wird (oder nach 4 s Wartezeit automatisch)
      if (g.ball.v.len() > 0.3 || this.phaseT > 4) { this.phase = 'play'; this.phaseT = 0; }
    }
    if (this.phase === 'play') {
      this.clock += dt;
      const end = this.halfLen * 2;
      if (!this.golden && this.half === 1 && this.clock >= this.halfLen) {
        this.phase = 'halftime'; this.phaseT = 0; this.half = 2;
        g.events.push({ type: 'halftime', score: [...g.score] });
      } else if (!this.golden && this.half === 2 && this.clock >= end) {
        if (P.golden && g.score[0] === g.score[1]) { this.golden = true; g.events.push({ type: 'golden' }); }
        else this.finish();
      }
    } else if (this.phase === 'goal' && this.phaseT >= P.celebrateT) {
      if (this.golden) return;
      const conceding = 1 - this.scoredTeam;
      if (P.anstoss) this.kickoff(conceding); else this.giveKeeper(conceding);
    } else if (this.phase === 'halftime' && this.phaseT >= 3) {
      this.kickoff(1 - this.firstKickoff);
    } else if (this.phase === 'out' && this.phaseT >= 1.2) {
      // Abwurf: Tormann der Mannschaft, die den Ball nicht zuletzt berührt hat
      this.giveKeeper(this.lastTouchTeam === 0 ? 1 : 0);
    }
  }

  snapshot() {
    return { phase: this.phase, clock: this.clock, half: this.half, keeper: [...this.keeper], golden: this.golden, winner: this.winner };
  }
}
