// Die Spielwelt im festen Takt (120 Hz): Spieler, Ball, Regeln, Bots. Ohne DOM, deterministisch aus Seed +
// Eingaben. Gleiche Welt läuft im Browser (src/main.js) und in den Node-Tests.
// new Game(P, seed)                      → Einzelspieler wie Nacht 1 (Ball und Käfig, Messungen/Tests)
// new Game(P, seed, { match: true, … }) → 3 gegen 3 mit Regeln („letzte Hand“, Spielzeit) und Bots
import { makeParams } from './params.js';
import { Rng } from './rng.js';
import { Ball } from './ball.js';
import { Player, EMPTY_INPUT } from './player.js';
import { buildCage, goalSide, outOfCage } from './world.js';
import { Rules } from './rules.js';
import { Bots, keeperLevel } from './bots.js';
import { newGestures, stepGestures, gestureView } from '../input/gesture.js';
import { makeChallenge, challengeDef } from './challenges.js';

export const HZ = 120;
export const DT = 1 / HZ;

export class Game {
  constructor(params = makeParams({}), seed = 1, opts = {}) {
    this.P = params;
    this.seed = seed;
    this.rng = new Rng(seed);
    this.cage = buildCage(params);
    this.events = [];
    this.ball = new Ball(params);
    this.ball.events = this.events;
    this.ball.held = -1;            // Index des Spielers, der den Ball in der Hand hat
    this.t = 0; this.tick = 0;
    this.score = [0, 0];            // Einzelspieler: Tore rechts / links; Spiel: Tore je Mannschaft
    this.state = 'play'; this.stateT = 0;
    this.lastGoal = 0;
    this.faults = 0;                // Numerik-Notbremsen (muss 0 bleiben)
    this.lastTouch = -1; this.lastTouchT = -99; this.passTo = -1;
    this.passPlan = null;           // laufender Pass in den Laufweg {to, from, x, z, t} (Empfänger-Hilfe)
    this.gest = newGestures();      // Gesten des Menschen (halten / tipp + halten), im Spieltakt ausgewertet
    this.gcfg = { doppel: params.doppel, tapMax: params.tapMax, laden: params.laden ? 1 : 0 };
    const cdef = opts.challenge ? challengeDef(opts.challenge) : null;
    this.match = !!opts.match || !!cdef;
    if (this.match) {
      const n = cdef ? cdef.per : opts.perTeam ?? params.perTeam;
      const per = Array.isArray(n) ? n : [n, n];   // [Orange, Blau] – Challenges/Tests auch 1 gegen 0 usw.
      this.players = [];
      for (let team = 0; team < 2; team++) for (let i = 0; i < per[team]; i++) this.players.push(new Player(params, this.players.length, team));
      this.human = opts.human ?? 0;  // gesteuerter Spieler (−1: nur Bots)
      this.switchT = 9;
      this.rules = new Rules(this);
      this.bots = opts.bots === false || (cdef && this.players.length < 2) ? null : new Bots(this, (cdef && cdef.botLevel) || (opts.botLevel ?? params.botLevel), opts.botLevels);
      if (cdef) { // Training/Challenge: eigene Welt, keine Uhr, kein Anstoß, Mensch fest (Orange 0)
        // Nacht 2d: eigene Tormann-Stufe je Übung (Elfmeter: der schnellere Tormann von Nacht 2d würde aus 6 m jeden
        // 1,5-mal härteren Schuss halten – Stufe 1 reagiert wie bisher erst, wenn der Ball schon da ist)
        if (this.bots && cdef.keeperLevel) this.bots.K = [0, 1].map(() => keeperLevel(params, cdef.keeperLevel));
        this.human = 0;
        this.rules.phase = 'play';
        this.rules.handsOffTeam = cdef.hands ? -1 : 0;
        this.rules.updateKeepers(0, true);
        this.challenge = makeChallenge(this, cdef.id);
        this.challenge.bots = this.bots;
        this.challengeGoal = false;
      } else {
        this.rules.firstKickoff = opts.kickoffTeam ?? 0;
        this.rules.kickoff(this.rules.firstKickoff);
      }
      this.events.length = 0;
    } else {
      this.players = [new Player(params, 0, 0)];
      this.human = 0;
      this.kickoff();
    }
  }

  kickoff() {
    if (this.match) { this.rules.kickoff(this.rules.kickoffTeam); return; }
    const b = this.ball, pl = this.players[0];
    b.place(0, b.r, 0); b.held = -1;
    pl.place(-2.2, 0, 0);
    this.state = 'play'; this.stateT = 0;
  }

  // Aufstellung zum Anstoß: je Mannschaft hinten (letzte Hand), Mitte, Flügel; Gegner ≥ 2 m vom Ball
  setupKickoff(team) {
    const b = this.ball, hx = this.cage.hx, n = this.P.perTeam;
    b.place(0, b.r, 0); b.held = -1;
    const cnt = [0, 0];
    for (const pl of this.players) {
      const k = cnt[pl.team]++;
      const own = pl.team === 0 ? -1 : 1, face = pl.team === 0 ? 0 : Math.PI;
      const att = pl.team === team;
      pl.resetHands(); pl.pending = null; pl.charging = false;
      if (k === 0) pl.place(own * (hx - 1.3), 0, face);
      else if (k === 1) pl.place(att ? own * 0.42 : own * 3.0, att ? 0 : -1.4, face);
      else pl.place(own * (att ? 2.6 : 4.2), (k % 2 ? 1 : -1) * (att ? 2.4 : 1.6) + (k > 2 ? 2 : 0), face);
    }
    void n;
    this.lastTouch = -1; this.passTo = -1;
  }

  step(inputs = []) {
    this.events.length = 0;
    return this.match ? this.stepMatch(inputs) : this.stepSolo(inputs);
  }

  // Eingabe des Menschen mit Knopf-Pegeln (passDown/shotDown) → Gesten-Ereignisse. Ältere Eingaben mit Flanken
  // (pass, shootHeld/shootRelease – Tests) bleiben unverändert.
  humanInput(inp) {
    if (!inp || (inp.passDown === undefined && inp.shotDown === undefined)) return inp;
    const gest = stepGestures(this.gest, this.t, { pass: !!inp.passDown, shot: !!inp.shotDown }, this.gcfg);
    return { ...inp, gest, gview: gestureView(this.gest, this.t) };
  }

  stepSolo(inputs) {
    const b = this.ball;
    for (let i = 0; i < this.players.length; i++) this.players[i].step(DT, (i === 0 ? this.humanInput(inputs[i]) : inputs[i]) || EMPTY_INPUT, this);
    b.step(DT, this.cage);
    this.numerics();
    this.stateT += DT;
    if (this.state === 'play') {
      const g = goalSide(this.cage, b.p, b.r);
      if (g) {
        this.score[g > 0 ? 0 : 1]++;
        this.lastGoal = g;
        this.state = 'goal'; this.stateT = 0;
        this.events.push({ type: 'goal', side: g, speed: b.v.len() });
      } else if (outOfCage(this.cage, b.p)) {
        if (this.cage.roof) this.faults++; // mit Dach darf das nie passieren
        this.state = 'out'; this.stateT = 0;
        this.events.push({ type: 'out', x: b.p.x, y: b.p.y, z: b.p.z });
      }
    } else if (this.state === 'goal' && this.stateT > 2.4) {
      // Schnellstart (Einzelspieler: Ball in die Mitte, Spieler davor)
      this.kickoff();
      this.events.push({ type: 'restart' });
    } else if (this.state === 'out' && this.stateT > 1.2) {
      const pl = this.players[0];
      const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
      b.place(pl.x + fx * 0.8, b.r, pl.z + fz * 0.8);
      this.state = 'play'; this.stateT = 0;
      this.events.push({ type: 'restart' });
    }
    this.t += DT; this.tick++;
    return this.events;
  }

  // Training/Challenge: Regeln nur für die Hände, Bots/Ballmaschine steuert die Challenge, Tore meldet sie selbst
  stepChallenge(inputs) {
    const b = this.ball, R = this.rules, C = this.challenge, n = this.players.length;
    R.phase = 'play';
    R.updateKeepers(DT);
    if (this.bots) this.bots.update();
    const ins = this._ins || (this._ins = []);
    for (let i = 0; i < n; i++) ins[i] = i === this.human ? (this.humanInput(inputs[i]) || EMPTY_INPUT) : C.input(i);
    const off = this.tick % n;
    for (let k = 0; k < n; k++) { const i = (k + off) % n; this.players[i].step(DT, ins[i], this); }
    R.hands(DT, (i) => ins[i]);
    if (b.held >= 0) R.carry(); else b.step(DT, this.cage);
    this.separate();
    this.numerics();
    const gs = goalSide(this.cage, b.p, b.r);
    if (gs && !this.challengeGoal) { this.challengeGoal = true; this.events.push({ type: 'goal', side: gs, team: gs > 0 ? 0 : 1, speed: b.v.len(), challenge: true }); C.onGoal(gs); }
    else if (!gs) this.challengeGoal = false;
    C.step();
    this.state = C.done ? 'end' : 'play';
    this.t += DT; this.tick++;
    return this.events;
  }

  stepMatch(inputs) {
    if (this.challenge) return this.stepChallenge(inputs);
    const b = this.ball, R = this.rules, n = this.players.length;
    R.updateKeepers(DT);
    if (this.bots) this.bots.update();
    const ins = this._ins || (this._ins = []);
    const live = R.phase === 'play' || R.phase === 'kickoff';
    for (let i = 0; i < n; i++) {
      // Torjubel: erst 1,2 s stehen und jubeln, dann (wie in der Halbzeit) zurück in die eigene Hälfte
      if (!live) ins[i] = this.bots && !(R.phase === 'goal' && R.phaseT < 1.2) ? this.bots.formation(i) : EMPTY_INPUT;
      else if (inputs[i] && (i === this.human || !this.bots)) ins[i] = i === this.human ? this.humanInput(inputs[i]) : inputs[i]; // Mensch (ohne Bots: alle)
      else ins[i] = this.bots ? this.bots.input(i) : EMPTY_INPUT;
    }
    // Auto-Torwart (Nacht 2c): ist der Mensch die letzte Hand, übernimmt die Tormann-Logik der Bots die Hände
    const h = this.human;
    // (nur im eigenen Torraum oder mit Ball in der Hand – im Feld bleibt der Mensch ganz er selbst)
    const hp = h >= 0 ? this.players[h] : null;
    if (live && hp && this.P.autoTorwart && this.bots && R.keeper[hp.team] === h && ins[h] && (b.held === h || R.inBox(hp.team, hp.x, hp.z, 0.5))) ins[h] = this.bots.humanKeeper(h, ins[h]);
    // Reihenfolge rotiert: bei gleichzeitigem Ballkontakt ist nicht immer derselbe zuerst dran
    const off = this.tick % n;
    for (let k = 0; k < n; k++) {
      const i = (k + off) % n;
      this.players[i].step(DT, ins[i], this);
    }
    if (live) R.hands(DT, (i) => ins[i]);
    if (b.held >= 0) R.carry(); else b.step(DT, this.cage);
    this.separate();
    this.numerics();
    if (live) {
      const gs = goalSide(this.cage, b.p, b.r);
      if (gs) R.onGoal(gs);
      else if (outOfCage(this.cage, b.p)) { if (this.cage.roof) this.faults++; R.onOut(); }
    }
    R.post(DT);
    if (this.human >= 0) this.autoSwitch(inputs[this.human]);
    this.state = R.phase === 'goal' ? 'goal' : R.phase === 'out' ? 'out' : 'play';
    this.t += DT; this.tick++;
    return this.events;
  }

  numerics() {
    const b = this.ball;
    if (!Number.isFinite(b.p.x + b.p.y + b.p.z + b.v.x + b.v.y + b.v.z)) {
      this.faults++;
      b.place(0, b.r, 0); b.held = -1;
      this.events.push({ type: 'fault' });
    }
  }

  // Spieler berühren sich: Körper (Radius 0,3 m) schieben sich auseinander, Aufprall-Anteil wird gebremst
  separate() {
    const ps = this.players, R2 = 0.6;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], c = ps[j];
        let dx = c.x - a.x, dz = c.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= R2) continue;
        if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        const push = (R2 - d) / 2;
        a.x -= dx * push; a.z -= dz * push; c.x += dx * push; c.z += dz * push;
        const rv = (c.vx - a.vx) * dx + (c.vz - a.vz) * dz;
        if (rv < 0) { const j2 = rv / 2; a.vx += dx * j2; a.vz += dz * j2; c.vx -= dx * j2; c.vz -= dz * j2; }
        if (rv < -3) this.events.push({ type: 'bump', a: a.id, b: c.id, speed: -rv });
      }
    }
    const lx = this.cage.hx - this.P.bodyR, lz = this.cage.hz - this.P.bodyR;
    for (const p of ps) { p.x = Math.max(-lx, Math.min(lx, p.x)); p.z = Math.max(-lz, Math.min(lz, p.z)); }
  }

  // Spielerwechsel für den Menschen: Taste (inp.switch), nach eigenem Pass zum Empfänger, sonst automatisch
  // zum ballnächsten Mitspieler (Zeit zum Ball, mit Hysterese); hält der eigene Tormann den Ball → Tormann.
  autoSwitch(inp) {
    const P = this.P, b = this.ball;
    const me = this.players[this.human];
    this.switchT += DT;
    if (b.held >= 0) {
      const h = this.players[b.held];
      if (h.team === me.team && h.id !== me.id) this.setHuman(h.id);
      return;
    }
    if (me.hand.mode === 'dive' || me.hand.mode === 'ground') return;
    const ttb = (p) => {
      const tx = b.p.x + b.v.x * 0.3, tz = b.p.z + b.v.z * 0.3;
      return Math.hypot(tx - p.x, tz - p.z) / P.vSprint;
    };
    const mates = this.players.filter((p) => p.team === me.team && p.id !== me.id);
    if (inp && inp.switch) {
      if (this.t - (this.manualT ?? -9) < 0.25) return; // Doppeltipp nicht zweimal wechseln
      this.manualT = this.t;
      let best = null;
      for (const m of mates) if (!best || ttb(m) < ttb(best)) best = m;
      if (best) this.setHuman(best.id);
      return;
    }
    if (this.passTo >= 0 && this.lastTouch === me.id && this.players[this.passTo].team === me.team && this.passTo !== me.id) {
      this.setHuman(this.passTo); this.passTo = -1; return;
    }
    if (this.switchT < P.switchT) return;
    const mine = this.lastTouch === me.id && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 2.2;
    if (mine) return;
    let best = me, bt = ttb(me) - 0.18;
    for (const m of mates) { const t = ttb(m); if (t < bt) { bt = t; best = m; } }
    if (best !== me) this.setHuman(best.id);
  }

  setHuman(id) {
    if (id === this.human) return;
    const old = this.players[this.human];
    if (old) { old.pending = null; old.charging = false; old.charge = 0; }
    this.human = id; this.switchT = 0;
    this.events.push({ type: 'switch', player: id });
  }

  snapshot() {
    return { t: this.t, tick: this.tick, state: this.state, score: [...this.score], ball: { ...this.ball.snapshot(), held: this.ball.held }, players: this.players.map((p) => p.snapshot()), faults: this.faults, rules: this.match ? this.rules.snapshot() : null, human: this.human };
  }
}
