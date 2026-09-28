// Die Spielwelt im festen Takt (120 Hz): Spieler, Ball, Regeln (Tor, Aus). Ohne DOM, deterministisch
// aus Seed + Eingaben. Gleiche Welt läuft im Browser (src/main.js) und in den Node-Tests.
import { makeParams } from './params.js';
import { Rng } from './rng.js';
import { Ball } from './ball.js';
import { Player, EMPTY_INPUT } from './player.js';
import { buildCage, goalSide, outOfCage } from './world.js';

export const HZ = 120;
export const DT = 1 / HZ;

export class Game {
  constructor(params = makeParams({}), seed = 1) {
    this.P = params;
    this.seed = seed;
    this.rng = new Rng(seed);
    this.cage = buildCage(params);
    this.events = [];
    this.ball = new Ball(params);
    this.ball.events = this.events;
    this.players = [new Player(params, 0, 0)];
    this.t = 0; this.tick = 0;
    this.score = [0, 0];            // Tore rechts (x > 0) / links
    this.state = 'play'; this.stateT = 0;
    this.lastGoal = 0;
    this.faults = 0;                // Numerik-Notbremsen (muss 0 bleiben)
    this.kickoff();
  }

  kickoff() {
    const b = this.ball, pl = this.players[0];
    b.place(0, b.r, 0);
    pl.place(-2.2, 0, 0);
    this.state = 'play'; this.stateT = 0;
  }

  step(inputs = []) {
    this.events.length = 0;
    const b = this.ball;
    for (let i = 0; i < this.players.length; i++) this.players[i].step(DT, inputs[i] || EMPTY_INPUT, this);
    b.step(DT, this.cage);
    // Notbremse bei Numerik-Fehlern
    if (!Number.isFinite(b.p.x + b.p.y + b.p.z + b.v.x + b.v.y + b.v.z)) {
      this.faults++;
      b.place(0, b.r, 0);
      this.events.push({ type: 'fault' });
    }
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
      // Schnellstart (Nacht 1: Ball in die Mitte, Spieler davor)
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

  snapshot() {
    return { t: this.t, tick: this.tick, state: this.state, score: [...this.score], ball: this.ball.snapshot(), players: this.players.map((p) => p.snapshot()), faults: this.faults };
  }
}
