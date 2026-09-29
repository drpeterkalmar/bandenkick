// Bots (Utility-KI, ohne DOM). Rollen je Mannschaft wechseln dynamisch:
//   eigener Ball:  Ballführer · Anspielstation · Absicherung (= „letzte Hand“, hinterster Spieler)
//   Gegner-Ball:   Angreifer (presst) · Decker · Absicherung
// Der Ballführer bewertet Schuss, Pass, Bandenpass (auch zu sich selbst), Dribbeln und Befreien über Nutzwerte
// und spielt über die Schuss-/Pass-API des Spielers (Player.kickAt). Bandenpass: Zielpunkt an der Bande aus
// der gemessenen Abprall-Kennzahl der echten Ballphysik (Bande + Rollspin + Effet), einmal beim Start gemessen.
// Stärken ?bots=1…3: Reaktion, Tempo, Streuung, Fangsicherheit, Fehlerquote.
import { passSpeedFor } from './player.js';
import { bankRatio } from './kickplan.js';
import { shotFeatures, shotQuality } from './shot.js';
import { planAir } from './air.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const LEVELS = {
  1: { react: 0.36, think: 0.36, speed: 0.8, noise: 2.4, shotNoise: 4.4, aimNoise: 1.1, keeperReact: 0.34, airTry: 0.45, shotPow: -0.05, skill: 1.0, catchSkill: 0.3, fumble: 0.35, err: 0.35, shootMax: 11, keeperMove: 0.8, dive: 0.6, tackle: 1.4, minXg: 0.05 },
  2: { react: 0.16, think: 0.2, speed: 0.88, noise: 1.3, shotNoise: 3.0, aimNoise: 0.85, keeperReact: 0.26, airTry: 0.5, shotPow: 0, skill: 1.15, catchSkill: 0.8, fumble: 0.12, err: 0.12, shootMax: 13, keeperMove: 0.95, dive: 0.9, tackle: 1.0, minXg: 0.06 },
  3: { react: 0.1, think: 0.1, speed: 0.95, noise: 0.7, shotNoise: 2.1, aimNoise: 0.5, keeperReact: 0.19, airTry: 0.65, shotPow: 0.1, skill: 1.5, catchSkill: 1.0, fumble: 0.03, err: 0.04, shootMax: 13, keeperMove: 1.0, dive: 1.0, tackle: 0.85, minXg: 0.07 },
};
const NP = 41, PDT = 0.05; // Ballvorhersage: 2 s in 0,05-s-Schritten

// Abprall-Kennzahl an der Längsbande: siehe kickplan.js (auch vom Pass-Planer benutzt)
export { bankRatio };

export class Bots {
  constructor(game, level = 2, levels = null) {
    this.g = game;
    const lv = (t) => LEVELS[clamp(Math.round(levels ? levels[t] : level), 1, 3)];
    this.L = [lv(0), lv(1)];
    this.px = new Float32Array(NP); this.py = new Float32Array(NP); this.pz = new Float32Array(NP);
    this.brain = game.players.map((p) => ({
      role: 'support', roleT: 0, next: (p.id * 0.037) % 0.2, dribX: 0, dribZ: 0, shotSeen: -1, diveUsed: false,
      catchRoll: 1, throwAt: -1, lastRole: '', wall: null,
    }));
    this.inp = game.players.map(() => ({ mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, aim: false, aimX: 0, aimZ: 0, hand: false, dive: false, throw: false, punt: false, autoCatch: false, catchSkill: 1, fumble: false, speedCap: 1 }));
    this.ttb = game.players.map(() => ({ t: 9, x: 0, z: 0 }));
    this.owner = -1; this.ownerTeam = -1;
    this.bank = bankRatio(game.P, game.cage, 0);
    this.stats = { shots: 0, passes: 0, chips: 0, banks: 0, selfWall: 0, clears: 0, dives: 0, throws: 0, air: 0 };
  }

  // ---------- einmal je Takt: Vorhersage, Zeit zum Ball, Ballbesitz, Rollen ----------
  update() {
    const g = this.g, b = g.ball, P = g.P;
    this.predict();
    for (const p of g.players) this.ttb[p.id] = this.timeToBall(p, this.L[p.team]);
    let owner = -1;
    if (b.held >= 0) owner = b.held;
    else if (g.lastTouch >= 0 && g.t - g.lastTouchT < 2.5) {
      const p = g.players[g.lastTouch];
      const d = Math.hypot(b.p.x - p.x, b.p.z - p.z), rel = Math.hypot(b.v.x - p.vx, b.v.z - p.vz);
      if (d < 2.4 && rel < 4.5 && b.p.y < 0.7) owner = p.id;
    }
    this.owner = owner; this.ownerTeam = owner >= 0 ? g.players[owner].team : -1;
    for (let team = 0; team < 2; team++) this.roles(team);
    void P;
  }

  predict() {
    const g = this.g, b = g.ball, P = g.P, cage = g.cage, r = P.ballR;
    let x = b.p.x, y = b.p.y, z = b.p.z, vx = b.v.x, vy = b.v.y, vz = b.v.z;
    if (b.held >= 0) { vx = vy = vz = 0; }
    const hx = cage.hx - r, hz = cage.hz - r;
    for (let k = 0; k < NP; k++) {
      this.px[k] = x; this.py[k] = y; this.pz[k] = z;
      const h = PDT;
      if (y > r + 0.02 || vy > 0.4) {
        vy -= P.g * h;
        const s = Math.hypot(vx, vy, vz), dr = Math.max(0, 1 - 0.012 * s * h);
        vx *= dr; vy *= dr; vz *= dr;
        x += vx * h; y += vy * h; z += vz * h;
        if (y < r) { y = r; if (vy < -1) { vy = -vy * 0.6; vx *= 0.8; vz *= 0.8; } else vy = 0; }
      } else {
        const s = Math.hypot(vx, vz), dec = (P.turfRoll0 + P.turfRoll1 * s + 0.004 * s * s) * h;
        const f = s > dec ? (s - dec) / s : 0;
        vx *= f; vz *= f; x += vx * h; z += vz * h; y = r; vy = 0;
      }
      if (Math.abs(x) > hx && !(Math.abs(z) < cage.gw && y < cage.gH)) { x = Math.sign(x) * hx; vx = -vx * P.boardEn; }
      if (Math.abs(z) > hz) { z = Math.sign(z) * hz; vz = -vz * P.boardEn; }
    }
  }

  // Frühester Zeitpunkt, zu dem der Spieler den (vorhergesagten) Ball am Fuß haben kann
  timeToBall(p, L) {
    const vmax = this.g.P.vSprint * L.speed;
    for (let k = 0; k < NP; k++) {
      if (this.py[k] > 1.0) continue;
      const t = k * PDT;
      const d = Math.hypot(this.px[k] - p.x, this.pz[k] - p.z) - 0.5;
      if (vmax * Math.max(0, t - 0.12) + 0.4 * Math.min(t, 0.3) * p.speed >= d) return { t, x: this.px[k], z: this.pz[k] };
    }
    const d = Math.hypot(this.px[NP - 1] - p.x, this.pz[NP - 1] - p.z);
    return { t: 2 + d / vmax, x: this.px[NP - 1], z: this.pz[NP - 1] };
  }

  roles(team) {
    const g = this.g, R = g.rules;
    const kp = R.keeper[team];
    const field = g.players.filter((p) => p.team === team && p.id !== kp);
    field.sort((a, c) => this.ttb[a.id].t - this.ttb[c.id].t);
    const set = (id, role) => { const br = this.brain[id]; if (br.role !== role) { br.role = role; br.roleT = 0; } };
    if (kp < 0) return;
    set(kp, 'keeper');
    const oppBest = Math.min(9, ...g.players.filter((p) => p.team !== team).map((p) => this.ttb[p.id].t));
    // Hysterese: der bisherige Jäger bleibt es, solange der andere nicht deutlich schneller am Ball ist
    let first = field[0], second = field[1];
    if (second) {
      const b0 = this.brain[first.id], b1 = this.brain[second.id];
      const chasing = (r) => r === 'chase' || r === 'press' || r === 'carrier';
      if (chasing(b1.role) && !chasing(b0.role) && this.ttb[first.id].t > 0.35 && this.ttb[second.id].t < this.ttb[first.id].t + 0.25) [first, second] = [second, first];
    }
    if (this.ownerTeam === team) {
      const own = g.players[this.owner];
      if (own.id === kp) { for (const p of field) set(p.id, 'support'); }
      else { set(own.id, 'carrier'); for (const p of field) if (p.id !== own.id) set(p.id, 'support'); }
    } else if (!first) {
      // nur der Tormann: keine Feldspieler-Rollen
    } else if (this.ownerTeam === 1 - team) {
      set(first.id, 'press'); if (second) set(second.id, 'cover');
    } else {
      set(first.id, 'chase');
      if (second) set(second.id, this.ttb[first.id].t < oppBest - 0.1 ? 'support' : 'cover');
    }
    for (const p of g.players) if (p.team === team) this.brain[p.id].roleT += 1 / 120;
  }

  // ---------- Eingabe je Bot ----------
  input(i) {
    const g = this.g, pl = g.players[i], br = this.brain[i], inp = this.inp[i], L = this.L[pl.team];
    inp.pass = false; inp.shootHeld = false; inp.shootRelease = false; inp.dive = false; inp.throw = false; inp.punt = false;
    inp.hand = false; inp.autoCatch = false; inp.sprint = false; inp.aim = false; inp.speedCap = L.speed;
    inp.catchSkill = L.catchSkill; inp.fumble = br.catchRoll < L.fumble;
    const phase = g.rules.phase;
    if (phase === 'kickoff') return this.kickoffInput(pl, br, inp, L);
    if (pl.air || pl.fall || this.airCheck(pl, br, L)) { inp.mx = 0; inp.mz = 0; return inp; } // Luftball läuft
    switch (br.role) {
      case 'keeper': this.keeper(pl, br, inp, L); break;
      case 'carrier': this.carrier(pl, br, inp, L); break;
      case 'chase': this.chase(pl, br, inp, L, false); break;
      case 'press': this.chase(pl, br, inp, L, true); break;
      case 'support': this.support(pl, br, inp, L); break;
      default: this.cover(pl, br, inp, L);
    }
    // Hält der gegnerische Tormann den Ball, darf niemand angreifen: raus aus seinem Torraum
    const b = g.ball;
    if (b.held >= 0 && g.players[b.held].team !== pl.team) this.keepOut(pl, inp, 1 - pl.team);
    return inp;
  }

  // Luftball (Nacht 2b, gleiche Technik-Wahl wie beim Menschen): der Bot in der Nähe drückt zum passenden Zeitpunkt –
  // im Angriff Schuss (Kopfball/Volley/Seitfall-/Fallrückzieher), in der eigenen Hälfte Befreiung. Starke Bots treffen
  // das ideale Zeitfenster, schwache drücken auch zu früh/spät.
  airCheck(pl, br, L) {
    const g = this.g, b = g.ball, R = g.rules;
    if (b.held >= 0 || g.rules.phase !== 'play' || pl.hand.mode !== 'none') return false;
    if (b.p.y < 0.45 && b.v.y < 1.5) return false;
    if (Math.hypot(b.p.x - pl.x, b.p.z - pl.z) > 6 || g.t < (br.airNext || 0)) return false;
    if (R.keeper[pl.team] === pl.id && R.inBox(pl.team, pl.x, pl.z)) return false; // Tormann fängt
    if (g.players.some((m) => m.team === pl.team && m.air)) return false;
    br.airNext = g.t + 0.05;
    const gx = this.oppGoalX(pl.team);
    const Dg = Math.hypot(gx - b.p.x, b.p.z), press = this.space(pl);
    // nur echte Gelegenheiten: Direktabnahme in Tornähe (nah oder unter Druck), Befreiung unter Druck in der eigenen
    // Hälfte – sonst den Ball lieber annehmen (Brust/Oberschenkel/Fuß)
    const lt = g.lastTouch >= 0 ? g.players[g.lastTouch] : null;
    const fromOwnKeeper = lt && lt.team === pl.team && lt.id === R.keeper[pl.team];   // Abwurf/Abschlag: annehmen
    const ownGoalD = Math.hypot(R.goalX(pl.team) - b.p.x, b.p.z);
    const purpose = Dg < 9 && (Dg < 6 || press < 2.5) && !fromOwnKeeper ? 'shot'
      : ownGoalD < 8 && press < 2.5 && lt && lt.team !== pl.team ? 'clear' : null;
    if (!purpose) return false;
    const plan = planAir(g, pl, { tPress: g.t, purpose, minScore: 0.4, minSpeed: 4 });
    if (!plan) return false;
    const need = L.err > 0.3 ? 0.55 : L.err > 0.1 ? 0.8 : 0.95;
    if (plan.tq < need || plan.score < 0.85 * plan.maxScore) return false; // auf die beste Technik warten
    // einmal je Luftball-Situation entscheiden (seit der letzten Ballberührung): nicht jeder nimmt direkt
    if (br.airEp === g.lastTouchT) return false;
    br.airEp = g.lastTouchT;
    if (g.rng.next() > (purpose === 'shot' ? L.airTry : 0.7)) return false;
    // nur wer am schnellsten an der Körperposition ist (grob: kein Mitspieler deutlich näher)
    const dMe = Math.hypot(plan.bx - pl.x, plan.bz - pl.z);
    if (g.players.some((m) => m.team === pl.team && m.id !== pl.id && Math.hypot(plan.bx - m.x, plan.bz - m.z) < dMe - 0.8)) return false;
    pl.air = plan; pl.pending = null; pl.airNoise = L.aimNoise * 1.3; pl.skill = L.skill;
    this.stats.air++;
    return true;
  }

  // Challenges: Tormann-Bot (Elfmeter, Doppelpass) bzw. einzelner Stürmer (1 gegen 1)
  keeperInput(i) { this.brain[i].role = 'keeper'; return this.input(i); }
  attackInput(i) { this.brain[i].role = this.owner === i ? 'carrier' : 'chase'; return this.input(i); }

  // Außerhalb des Spiels (Torjubel, Halbzeit, Aus): alle laufen auf ihre Anstoß-Plätze in der eigenen Hälfte
  formation(i) {
    const g = this.g, pl = g.players[i], inp = this.inp[i], hx = g.cage.hx;
    inp.pass = false; inp.shootHeld = false; inp.shootRelease = false; inp.dive = false; inp.throw = false; inp.punt = false;
    inp.hand = false; inp.autoCatch = false; inp.sprint = false; inp.speedCap = 0.75;
    const k = g.players.filter((p) => p.team === pl.team).indexOf(pl);
    const own = pl.team === 0 ? -1 : 1;
    const spots = [[own * (hx - 1.5), 0], [own * 2.2, -2.2], [own * 2.8, 2.4]];
    const [x, z] = spots[k % 3];
    this.moveTo(inp, pl, x, z, false, 1.5);
    return inp;
  }

  moveTo(inp, pl, x, z, urgent = false, slow = 1.2) {
    const cage = this.g.cage;
    x = clamp(x, -cage.hx + 0.35, cage.hx - 0.35); z = clamp(z, -cage.hz + 0.35, cage.hz - 0.35);
    const dx = x - pl.x, dz = z - pl.z, d = Math.hypot(dx, dz);
    if (d < 0.18) { inp.mx = 0; inp.mz = 0; return d; }
    const m = Math.min(1, d / slow);
    inp.mx = dx / d * m; inp.mz = dz / d * m;
    inp.sprint = urgent && d > 2.0;
    return d;
  }

  keepOut(pl, inp, team) {
    const R = this.g.rules, gx = R.goalX(team), rad = this.g.P.torraum + 2.0; // Tormann mit Ball: Platz lassen
    const nx = pl.x + inp.mx * 0.6, nz = pl.z + inp.mz * 0.6;
    const dx = nx - gx, dz = nz, d = Math.hypot(dx, dz);
    if (d < rad) { const ex = gx + dx / (d || 1) * rad, ez = dz / (d || 1) * rad; this.moveTo(inp, pl, ex, ez, false); }
  }

  oppGoalX(team) { return team === 0 ? this.g.cage.hx : -this.g.cage.hx; }
  fwd(team, x) { return team === 0 ? x : -x; }

  // Anstoß: die anstoßende Mitte spielt kurz auf einen Mitspieler, alle anderen warten auf ihren Plätzen
  kickoffInput(pl, br, inp, L) {
    const g = this.g, R = g.rules, b = g.ball;
    inp.mx = 0; inp.mz = 0;
    if (pl.team !== R.kickoffTeam) return inp;
    const d = Math.hypot(b.p.x - pl.x, b.p.z - pl.z);
    const nearest = g.players.filter((p) => p.team === pl.team).sort((a, c) => Math.hypot(b.p.x - a.x, b.p.z - a.z) - Math.hypot(b.p.x - c.x, b.p.z - c.z))[0];
    if (nearest.id !== pl.id || g.human === pl.id) return inp;
    if (R.phaseT < 0.8 + L.react) return inp;
    if (!pl.pending) {
      const mate = g.players.filter((p) => p.team === pl.team && p.id !== pl.id && p.id !== R.keeper[pl.team])[0] || R.bestMate(pl);
      if (mate) pl.kickAt({ kind: 'pass', target: [mate.x + (pl.team === 0 ? 1.5 : -1.5), mate.z], noise: L.noise, to: mate.id });
    }
    this.moveTo(inp, pl, b.p.x, b.p.z, false, 0.5);
    void d;
    return inp;
  }

  // Zum Ball (loser Ball) bzw. Gegner am Ball angreifen; am Ball: sofort sinnvoll weiterspielen
  chase(pl, br, inp, L, press) {
    const g = this.g, b = g.ball, team = pl.team;
    const tt = this.ttb[pl.id];
    let tx = tt.x, tz = tt.z;
    if (press) {
      const gx = g.rules.goalX(team);
      const dx = gx - tx, dz = -tz, l = Math.hypot(dx, dz) || 1;
      // Zustellen statt blind hinein: hat der Gegner den Ball eng am Fuß, 1,3 m torseitig davor warten;
      // angreifen, sobald der Ball vom Fuß springt (Vorlage) oder der Gegner sich wegdreht
      const own = g.players[this.owner];
      if (own && own.team !== team) {
        const [fx, fz] = own.footPoint();
        const loose = Math.hypot(b.p.x - fx, b.p.z - fz) > L.tackle;
        if (!loose) {
          this.moveTo(inp, pl, b.p.x + dx / l * 1.3, b.p.z + dz / l * 1.3, false, 0.6);
          return;
        }
      }
      tx += dx / l * 0.35; tz += dz / l * 0.35;
    }
    const d = Math.hypot(b.p.x - pl.x, b.p.z - pl.z);
    if (d < 1.4 && b.p.y < 0.7 && b.held < 0 && !pl.pending && g.t >= br.next) {
      // Erster Kontakt: wie Ballführer entscheiden; Dribbeln → Ball kontrolliert mitnehmen
      br.next = g.t + L.think;
      const pick = this.decide(pl, br, L, true);
      if (pick.kind === 'dribble') this.firstTouch(pl, L);
    }
    if (pl.pending) { this.approach(inp, pl); return; }
    this.moveTo(inp, pl, tx, tz, true, 0.6);
  }

  // Zum Ball mit vorgemerktem Kick: beim Schuss von hinten anlaufen (Körper zum Tor, Ball vor dem Fuß)
  approach(inp, pl) {
    const b = this.g.ball;
    if (pl.pending.kind === 'shot') {
      const gx = this.oppGoalX(pl.team), dx = gx - b.p.x, dz = -b.p.z, d = Math.hypot(dx, dz) || 1;
      const px = b.p.x - dx / d * 0.3, pz = b.p.z - dz / d * 0.3;
      const off = Math.hypot(px - pl.x, pz - pl.z);
      // erst hinter den Ball, dann auf den Ball (sonst wartet er ewig hinter ihm)
      if (off > 0.35 && ((pl.x - b.p.x) * dx + (pl.z - b.p.z) * dz) / d > -0.15) { this.moveTo(inp, pl, px, pz, false, 0.3); return; }
    }
    this.moveTo(inp, pl, b.p.x, b.p.z, false, 0.4);
  }

  carrier(pl, br, inp, L) {
    const g = this.g, b = g.ball;
    const [fx, fz] = pl.footPoint();
    const atFeet = Math.hypot(b.p.x - fx, b.p.z - fz) < 1.0 && b.p.y < 0.5;
    if (g.t >= br.next && !pl.pending && atFeet) { br.next = g.t + L.think; this.decide(pl, br, L, false); }
    if (pl.pending) { this.approach(inp, pl); return; }
    if (br.wall && g.t < br.wall.until) { // nach Bandenpass zu sich selbst: zum Abprallpunkt sprinten
      this.moveTo(inp, pl, br.wall.x, br.wall.z, true, 0.6); return;
    }
    // Dribbeln: Richtung Tor, Gegnern vor mir seitlich ausweichen
    const gx = this.oppGoalX(pl.team);
    let gdx = gx - pl.x, gdz = -pl.z * 0.6;
    let l = Math.hypot(gdx, gdz) || 1; gdx /= l; gdz /= l;
    let dx = gdx, dz = gdz;
    const px = -gdz, pz = gdx; // quer zur Torrichtung
    for (const o of g.players) {
      if (o.team === pl.team) continue;
      const ox = o.x - pl.x, oz = o.z - pl.z, od = Math.hypot(ox, oz);
      if (od > 4 || od < 0.01) continue;
      const ahead = (ox * gdx + oz * gdz) / od;
      if (ahead < -0.2) continue;
      const away = (px * ox + pz * oz) >= 0 ? -1 : 1;
      const w = (4 - od) / 4 * 1.3 * (0.5 + 0.5 * ahead);
      dx += px * away * w; dz += pz * away * w;
    }
    // Bande: nicht in die Ecke dribbeln
    const cz = g.cage.hz;
    if (Math.abs(pl.z) > cz - 1.5) dz -= Math.sign(pl.z) * 0.6;
    l = Math.hypot(dx, dz) || 1;
    br.dribX = dx / l; br.dribZ = dz / l;
    // Ball nicht in Dribbelrichtung am Fuß (z. B. hinter dem Spieler in der Ecke): nicht davonlaufen, sondern den Ball
    // mit einem vorgemerkten Kontakt in Spielrichtung mitnehmen (auch aus der Ecke) – der Vormerk hält die Absicht stabil
    const bdx = b.p.x - fx, bdz = b.p.z - fz, bdl = Math.hypot(bdx, bdz);
    if (bdl > 0.45 && (bdx * br.dribX + bdz * br.dribZ) / bdl < 0.5 && b.p.y < 0.5) {
      this.firstTouch(pl, L);
      this.moveTo(inp, pl, b.p.x, b.p.z, false, 0.4); return;
    }
    inp.mx = br.dribX; inp.mz = br.dribZ;
    inp.sprint = this.space(pl) > 3.5;
  }

  space(pl) {
    let m = 9;
    for (const o of this.g.players) if (o.team !== pl.team) m = Math.min(m, Math.hypot(o.x - pl.x, o.z - pl.z));
    return m;
  }

  // Abstand eines Punkts zur Strecke a→b
  static segDist(px, pz, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
    const t = clamp(((px - ax) * ex + (pz - az) * ez) / L2, 0, 1);
    return Math.hypot(px - ax - ex * t, pz - az - ez * t);
  }

  laneFree(team, ax, az, bx, bz, skipId = -1) {
    let m = 9;
    for (const o of this.g.players) {
      if (o.team === team || o.id === skipId) continue;
      m = Math.min(m, Bots.segDist(o.x, o.z, ax, az, bx, bz));
    }
    return m;
  }

  // Gegner, der den Passweg a→b am stärksten zustellt: {d = Abstand vom Ball entlang des Wegs, lane}
  blocker(team, ax, az, bx, bz) {
    let best = null;
    for (const o of this.g.players) {
      if (o.team === team) continue;
      const lane = Bots.segDist(o.x, o.z, ax, az, bx, bz);
      if (lane > 1.0) continue;
      const d = Math.hypot(o.x - ax, o.z - az);
      if (!best || lane < best.lane) best = { d, lane };
    }
    return best;
  }

  // Torchance (grobe xG-Schätzung) von (x, z) aus: Entfernung und sichtbarer Torwinkel
  xg(team, x, z) {
    const cage = this.g.cage, gx = this.oppGoalX(team);
    const D = Math.hypot(gx - x, z);
    const dx = Math.max(0.3, Math.abs(gx - x));
    const view = Math.atan2(cage.gw - z, dx) + Math.atan2(cage.gw + z, dx); // Winkel zwischen den Pfosten
    return clamp(0.95 * Math.exp(-D / 3.6) * Math.min(1, view / 0.55), 0.005, 0.9);
  }
  // Wert des Ballbesitzes an (x, z): eigene Torchance + Grundwert + Raumgewinn; Ballverlust dort kostet die
  // Torchance des Gegners von dieser Stelle aus
  keepVal(team, x, z) { return this.xg(team, x, z) + 0.05 + 0.03 * clamp((this.fwd(team, x) + this.g.cage.hx) / (2 * this.g.cage.hx), 0, 1); }
  loseVal(team, x, z) { return -this.xg(1 - team, x, z) - 0.02; }
  // Chance, den Ball am Fuß zu behalten: nächster Gegner (vor mir zählt doppelt)
  keepChance(pl, dx, dz) {
    let m = 9;
    for (const o of this.g.players) {
      if (o.team === pl.team) continue;
      const ox = o.x - pl.x, oz = o.z - pl.z, od = Math.hypot(ox, oz);
      const ahead = od > 0.01 ? (ox * dx + oz * dz) / od : 0;
      m = Math.min(m, od / (ahead > 0.3 ? 1.6 : 1));
    }
    return clamp((m - 0.5) / 2.2, 0.15, 0.95);
  }

  // Nutzwerte (erwarteter Wert): Schuss, Pass, Bandenpass (zum Mitspieler / zu sich selbst), Dribbeln, Befreien.
  // first = erster Kontakt eines Jägers. Gibt die gewählte Option zurück; Dribbeln hat keine Aktion (Stick).
  decide(pl, br, L, first) {
    const g = this.g, b = g.ball, R = g.rules, cage = g.cage, team = pl.team, rng = g.rng;
    const opts = [];
    const gx = this.oppGoalX(team);
    const Dg = Math.hypot(gx - b.p.x, b.p.z);
    const kp = g.players[R.keeper[1 - team]] || null; // Training: Gegner ohne Spieler möglich
    const empty = !kp || !R.inBox(1 - team, kp.x, kp.z) || kp.hand.mode === 'ground';
    const lose = this.loseVal(team, b.p.x, b.p.z);
    // Schuss: danach hat meist der Tormann den Ball (Wert ≈ 0)
    if (Dg < L.shootMax && (this.xg(team, b.p.x, b.p.z) >= L.minXg || empty)) {
      const zc = cage.gw - 0.38, kz = kp ? kp.z : 0;
      const tz = Math.abs(kz - zc) > Math.abs(kz + zc) ? zc : -zc;
      const lane = this.laneFree(team, b.p.x, b.p.z, gx, tz, kp ? kp.id : -1);
      const kpOff = kp ? clamp(Math.abs(kp.z - tz) / cage.gw, 0, 1) : 1;
      // Unter Druck (Gegner < 1,3 m) wird ein Schuss hastig: doppelte Streuung, seltener gewählt
      const pressure = this.space(pl), rushed = pressure < 1.3;
      // Schussqualität q wie beim Menschen (Lage, Körper, Ball am Fuß, Druck): schlechte Lage = langsamer, zentraler
      const q = Math.pow(shotQuality(shotFeatures(g, pl, [gx, 0.35, 0], pl.strong), g.P).qEff, 1 / L.skill);
      const u = this.xg(team, b.p.x, b.p.z) * (lane > 0.8 ? 1 : 0.2) * (0.7 + 0.5 * kpOff) * (empty ? 2.2 : 1) * (rushed ? 0.6 : 1) * (0.55 + 0.45 * q);
      // Schuss wie beim Menschen (Nacht 2b): Ziel automatisch am Tormann vorbei, Qualität q aus der Lage, Vollspann
      // oder angeschnitten (Innen-/Außenrist); Stärke-Streuung der Bots über noise
      opts.push({ kind: 'shot', u, act: () => { pl.kickAt({ kind: 'shot', auto: true, mode: rng.next() < 0.4 ? 'var' : 'std', power: Math.min(1, (rushed ? 0.55 : 0.7) + L.shotPow + 0.3 * rng.next()), noise: L.aimNoise * (rushed ? 1.5 : 1), skill: L.skill }); this.stats.shots++; } });
    }
    // Pass und Bandenpass zu Mitspielern
    for (const m of g.players) {
      if (m.team !== team || m.id === pl.id) continue;
      const isKp = m.id === R.keeper[team];
      const D0 = Math.hypot(m.x - b.p.x, m.z - b.p.z);
      if (D0 < 2.5 || D0 > 15) continue;
      const tl = D0 / 9;
      const tx = clamp(m.x + m.vx * tl, -cage.hx + 0.6, cage.hx - 0.6), tz = clamp(m.z + m.vz * tl, -cage.hz + 0.6, cage.hz - 0.6);
      let open = 9; for (const o of g.players) if (o.team !== team) open = Math.min(open, Math.hypot(o.x - tx, o.z - tz));
      const lane = this.laneFree(team, b.p.x, b.p.z, tx, tz);
      const succ = clamp((lane - 0.4) / 1.4, 0, 0.97) * clamp(open / 2.2, 0.25, 1) * (1 - D0 / 35);
      const mid = this.loseVal(team, (b.p.x + tx) / 2, (b.p.z + tz) / 2);
      const val = this.keepVal(team, tx, tz) - (isKp ? 0.03 : 0);
      if (lane > 1.0) opts.push({ kind: 'pass', u: succ * val + (1 - succ) * mid, act: () => { pl.kickAt({ kind: 'pass', lead: true, to: m.id, noise: L.noise / 1.3 }); this.stats.passes++; } });
      else {
        // Passweg zu: Chip über den Gegner in den Laufweg, wenn der Gegner nicht direkt vor dem Ball steht
        const blk = this.blocker(team, b.p.x, b.p.z, tx, tz);
        if (blk && blk.d > 2.2 && D0 > 5 && !isKp) {
          const cs = clamp(0.75 - D0 / 40, 0.3, 0.7) * clamp(open / 2.2, 0.25, 1);
          opts.push({ kind: 'chip', u: cs * val + (1 - cs) * mid, act: () => { pl.kickAt({ kind: 'pass', lead: true, mode: 'var', to: m.id, noise: L.noise / 1.3 }); this.stats.chips++; } });
        }
        const bank = this.bankPlan(pl, tx, tz);
        if (bank) {
          const bs = clamp(bank.score / 1.5, 0.2, 0.85) * clamp(open / 2.2, 0.25, 1);
          opts.push({ kind: 'bank', u: bs * val + (1 - bs) * mid, act: () => { pl.kickAt({ kind: 'pass', target: bank.aim, speed: bank.speed, noise: L.noise, to: m.id }); this.stats.banks++; } });
        }
      }
    }
    // Bandenpass zu sich selbst: Gegner direkt vor mir, Bande nah
    const pressure = this.space(pl);
    if (pressure < 2.2 && Math.abs(pl.z) > cage.hz - 4.5) {
      const dir = team === 0 ? 1 : -1;
      const tx = clamp(pl.x + dir * 4.5, -cage.hx + 1, cage.hx - 1), tz = clamp(pl.z * 0.6, -cage.hz + 1, cage.hz - 1);
      const bank = this.bankPlan(pl, tx, tz);
      if (bank) {
        const bs = clamp(bank.score / 1.5, 0.2, 0.75);
        opts.push({ kind: 'wall', u: bs * this.keepVal(team, tx, tz) + (1 - bs) * lose, act: () => {
          pl.kickAt({ kind: 'pass', target: bank.aim, speed: bank.speed, noise: L.noise, to: pl.id });
          br.wall = { x: tx, z: tz, until: g.t + 1.6 }; this.stats.selfWall++;
        } });
      }
    }
    // Befreien: weit weg, danach 50:50 – Wert ≈ 0 (besser als Ballverlust vor dem eigenen Tor)
    if (this.fwd(team, b.p.x) < 0) {
      const tz = (b.p.z > 0 ? -1 : 1) * (cage.hz - 1.5);
      opts.push({ kind: 'clear', u: -0.01, act: () => { pl.kickAt({ kind: 'clear', target: [this.fwd(team, 1) * 6, tz], noise: L.noise }); this.stats.clears++; } });
    }
    // Dribbeln: Ball behalten (Chance nach Gegnerdruck) und Raum gewinnen
    const dgx = gx - b.p.x, dgz = -b.p.z * 0.5, dgl = Math.hypot(dgx, dgz) || 1;
    const kc = this.keepChance(pl, dgx / dgl, dgz / dgl);
    const ahead = this.keepVal(team, b.p.x + dgx / dgl * 2.5, b.p.z + dgz / dgl * 2.5);
    opts.push({ kind: 'dribble', u: kc * ahead + (1 - kc) * lose + (first ? -0.01 : 0), act: null });
    // Wahl: bester Wert, mit Fehlerquote der Stärke gelegentlich eine andere Option
    opts.sort((a, c) => c.u - a.u);
    let pick = opts[0];
    if (opts.length > 1 && rng.next() < L.err) pick = opts[1 + Math.floor(rng.next() * (opts.length - 1))];
    if (pick.act) pick.act();
    return pick;
  }

  // Erster Kontakt ohne Pass/Schuss: Ball kontrolliert in die Spielrichtung mitnehmen (auch aus der Ecke)
  firstTouch(pl, L) {
    const g = this.g, b = g.ball, cage = g.cage, team = pl.team;
    const gx = this.oppGoalX(team);
    let dx = gx - b.p.x, dz = -b.p.z * 0.5;
    // von der Bande weg
    if (Math.abs(b.p.z) > cage.hz - 1.2) dz -= Math.sign(b.p.z) * 3;
    if (Math.abs(b.p.x) > cage.hx - 1.2) dx -= Math.sign(b.p.x) * 3;
    const l = Math.hypot(dx, dz) || 1;
    pl.kickAt({ kind: 'pass', target: [b.p.x + dx / l * 2.6, b.p.z + dz / l * 2.6], speed: 4.5, noise: L.noise * 0.7, to: pl.id });
  }

  // Bandenpass: Zielpunkt an der Längsbande so, dass der Abprall (gemessene Kennzahl ρ) beim Ziel ankommt
  bankPlan(pl, tx, tz) {
    const g = this.g, b = g.ball, cage = g.cage, r = g.P.ballR;
    let best = null;
    for (const s of [1, -1]) {
      const zw = s * (cage.hz - r);
      const d1 = Math.abs(zw - b.p.z), d2 = Math.abs(zw - tz);
      if (d1 < 0.8 || d2 < 0.5) continue;
      const a = (tx - b.p.x) / (1 + this.bank.rho * d2 / d1);
      const wx = b.p.x + a;
      if (Math.abs(wx) > cage.hx - 1) continue;
      const lane1 = this.laneFree(pl.team, b.p.x, b.p.z, wx, zw), lane2 = this.laneFree(pl.team, wx, zw, tx, tz);
      if (lane1 < 0.8 || lane2 < 0.8) continue;
      const L1 = Math.hypot(a, d1), L2 = Math.hypot(tx - wx, d2);
      // Tempo: nach dem Abprall (Anteil keep) soll er noch ~4 m/s haben
      const speed = clamp(passSpeedFor(g.P, L1) + (passSpeedFor(g.P, L2, 4) - 3.5) / Math.max(0.4, this.bank.keep), 8, 18);
      const score = Math.min(lane1, lane2) - (L1 + L2) * 0.05;
      if (!best || score > best.score) best = { aim: [wx, zw + s * 0.3], speed, score };
    }
    return best;
  }

  // Anspielstation: freien Raum vor dem Ball suchen
  support(pl, br, inp, L) {
    const g = this.g, b = g.ball, cage = g.cage, team = pl.team;
    const pp = g.passPlan;
    if (pp && pp.to === pl.id && b.held < 0 && g.t < pp.t + 1.2) { // Pass in den Laufweg: Empfänger-Hilfe (wie beim Menschen)
      inp.mx = 0; inp.mz = 0; inp.speedCap = 1;
      return;
    }
    if (g.passTo === pl.id && g.t - g.lastTouchT < 1.5 && b.held < 0) { // Pass kommt: entgegenlaufen
      const tt = this.ttb[pl.id];
      this.moveTo(inp, pl, tt.x, tt.z, true, 0.5);
      return;
    }
    if (g.t >= br.next) {
      br.next = g.t + L.think * 2;
      let best = null, bs = -1e9;
      const dir = team === 0 ? 1 : -1;
      for (let i = 0; i < 12; i++) {
        const ax = b.p.x + dir * (2 + (i % 4) * 2), az = [-1, 1, 0][Math.floor(i / 4)] * (2.5 + (i % 2)) + b.p.z * 0.2;
        const x = clamp(ax, -cage.hx + 1.5, cage.hx - 1.5), z = clamp(az, -cage.hz + 1, cage.hz - 1);
        let open = 9; for (const o of g.players) if (o.team !== team) open = Math.min(open, Math.hypot(o.x - x, o.z - z));
        const lane = this.laneFree(team, b.p.x, b.p.z, x, z);
        const dBall = Math.hypot(x - b.p.x, z - b.p.z);
        let s = Math.min(open, 4) + Math.min(lane, 2) * 0.8 + this.fwd(team, x) * 0.12 - Math.abs(dBall - 6) * 0.25 - Math.hypot(x - pl.x, z - pl.z) * 0.08;
        if (g.rules.inBox(1 - team, x, z)) s -= 1.5;
        if (s > bs) { bs = s; best = [x, z]; }
      }
      br.spot = best;
    }
    if (br.spot) this.moveTo(inp, pl, br.spot[0], br.spot[1], false, 1.5);
  }

  // Decker: Passweg zum gefährlichsten freien Gegner zustellen
  cover(pl, br, inp, L) {
    const g = this.g, b = g.ball, R = g.rules, team = pl.team;
    const gx = R.goalX(team);
    let target = null, bestD = 1e9;
    for (const o of g.players) {
      if (o.team === team || o.id === this.owner || o.id === R.keeper[o.team]) continue;
      if (Math.hypot(o.x - b.p.x, o.z - b.p.z) < 2) continue; // am Ball im Zweikampf: nicht decken
      const d = Math.abs(gx - o.x);
      if (d < bestD) { bestD = d; target = o; }
    }
    let x, z;
    if (target) { // zwischen Ball und Gegner, etwas zum eigenen Tor versetzt
      x = b.p.x * 0.4 + target.x * 0.6 + (team === 0 ? -0.8 : 0.8); z = b.p.z * 0.4 + target.z * 0.6;
    } else { x = (b.p.x + gx) / 2; z = b.p.z / 2; }
    if (R.inBox(team, x, z, 0.3)) { const dx = x - gx, dz = z, d = Math.hypot(dx, dz) || 1, rad = g.P.torraum + 0.4; x = gx + dx / d * rad; z = dz / d * rad; }
    // Nie in den Ballbereich (sonst steht der Decker den Spielern am Ball im Weg)
    const bx = x - b.p.x, bz = z - b.p.z, bd = Math.hypot(bx, bz);
    if (bd < 2) { const ux = bd > 0.01 ? bx / bd : (team === 0 ? -1 : 1), uz = bd > 0.01 ? bz / bd : 0; x = b.p.x + ux * 2; z = b.p.z + uz * 2; }
    x = clamp(x, -g.cage.hx + 1, g.cage.hx - 1); z = clamp(z, -g.cage.hz + 1, g.cage.hz - 1);
    this.moveTo(inp, pl, x, z, Math.hypot(x - pl.x, z - pl.z) > 4, 1.2);
    void L;
  }

  // Absicherung / „letzte Hand“: zwischen Ball und Tor, Schüsse abwehren (hechten), Ball aufnehmen, abwerfen
  keeper(pl, br, inp, L) {
    const g = this.g, b = g.ball, R = g.rules, P = g.P, cage = g.cage, team = pl.team;
    const gx = R.goalX(team), side = team === 0 ? 1 : -1;
    inp.speedCap = L.speed * L.keeperMove;
    if (b.held === pl.id) { // Ball in der Hand: Abwurf, sobald ein Mitspieler frei anspielbar ist
      if (br.throwAt < 0) br.throwAt = g.t + 0.8 + g.rng.next() * 0.8 + (1 - L.catchSkill) * 0.6;
      // Abwurf nur bei freiem Passweg (gute Tormänner: ≥ 2 m zum Weg, Empfänger ≥ 2,3 m frei) – sonst warten bzw.
      // spät weit abschlagen; ein abgefangener Abwurf am Torraum ist fast immer ein Gegentor
      const safe = L.catchSkill > 0.5;
      const mate = g.t >= br.throwAt ? R.bestMate(pl, true, safe ? 1.6 : 1.2, safe ? 2.0 : 1.5) : null;
      const late = pl.holdT > 3.6 + L.catchSkill;
      if (mate || late) {
        if (mate) { inp.aimX = mate.x + mate.vx * 0.5; inp.aimZ = mate.z + mate.vz * 0.5; }
        const far = mate ? Math.hypot(mate.x - pl.x, mate.z - pl.z) : 99;
        if (far > 13) { // niemand frei: Abschlag weit in die gegnerische Hälfte, zur freieren Seite
          const any = R.bestMate(pl);
          inp.aimX = (team === 0 ? 1 : -1) * 6; inp.aimZ = any ? any.z : 0;
          inp.punt = true;
        } else inp.throw = true;
        br.throwAt = -1; this.stats.throws++;
      }
      this.moveTo(inp, pl, gx + side * 1.6, clamp(pl.z, -1.5, 1.5), false, 1);
      return;
    }
    br.throwAt = -1;
    // Neuer Ball im Spiel: Fang-Sicherheit neu würfeln (Stärke)
    if (g.lastTouchT !== br.rollT) { br.rollT = g.lastTouchT; br.catchRoll = g.rng.next(); br.diveUsed = false; }
    inp.fumble = br.catchRoll < L.fumble;
    const inOwnBox = R.inBox(team, b.p.x, b.p.z, 0.3);
    // Schuss aufs Tor? Kreuzt der Ball die Linie des Tormanns im Tor-Bereich?
    const vtow = -side * b.v.x;
    if (vtow > 4 && b.held < 0) {
      const tc = (pl.x - b.p.x) / (b.v.x || 1e-6);
      if (tc > 0 && tc < 1.2) {
        const zc = b.p.z + b.v.z * tc, yc = b.p.y + b.v.y * tc - 4.9 * tc * tc;
        if (Math.abs(zc) < cage.gw + 0.5 && yc < cage.gH + 0.3) {
          if (br.shotSeen < 0) br.shotSeen = g.t;
          const seen = g.t - br.shotSeen;
          inp.autoCatch = true; inp.hand = true;
          if (seen >= L.keeperReact) { // Reaktionszeit auf einen Schuss (Mensch ≈ 0,2–0,3 s; Nacht 2b: vorher 0,1–0,36 s)
            const dz = zc - pl.z;
            this.moveTo(inp, pl, pl.x, zc, true, 0.3);
            const reachRun = P.vSprint * L.speed * tc * 0.6;
            if (!br.diveUsed && Math.abs(dz) > 0.55 && Math.abs(dz) > reachRun && Math.abs(dz) < (P.diveReach + P.diveSpeed * P.diveT) * L.dive + 0.3 && tc < 0.5 && R.handsOk(pl)) {
              inp.dive = true; inp.diveX = side * 0.25; inp.diveZ = Math.sign(dz); br.diveUsed = true; this.stats.dives++;
            }
          }
          return;
        }
      }
    }
    br.shotSeen = -1;
    // Loser Ball im eigenen Torraum oder knapp davor: holen (im Torraum mit den Händen)
    const tt = this.ttb[pl.id];
    let oppBest = 9; for (const o of g.players) if (o.team !== team) oppBest = Math.min(oppBest, this.ttb[o.id].t);
    if ((inOwnBox || R.inBox(team, tt.x, tt.z)) && b.held < 0 && tt.t < oppBest + 0.4 && b.p.y < 2.2) {
      inp.autoCatch = true; inp.hand = true;
      this.moveTo(inp, pl, tt.x, tt.z, true, 0.4);
      if (!R.inBox(team, pl.x, pl.z, -0.2) && !pl.pending && Math.hypot(b.p.x - pl.x, b.p.z - pl.z) < 1.3) this.decide(pl, br, L, true);
      return;
    }
    // Eigener Ballbesitz am Fuß (Tormann dribbelt): schnell abspielen
    if (this.owner === pl.id) {
      if (!pl.pending) this.decide(pl, br, L, true);
      this.moveTo(inp, pl, b.p.x, b.p.z, false, 0.4);
      return;
    }
    // Stellungsspiel: auf der Linie Tormitte → Ball, je nach Ballentfernung weiter vor
    const bx = b.p.x + b.v.x * 0.25, bz = b.p.z + b.v.z * 0.25;
    const dx = bx - gx, dz = bz, d = Math.hypot(dx, dz) || 1;
    const own = this.ownerTeam === team;
    // Nacht 2b: Schüsse zielen jetzt genau ins freie Eck → vorsichtiger stehen: Ball in Schussweite (Gegner am Ball
    // oder loser Ball < 9 m) höchstens 1,3 m vor der Linie; nur bei eigenem Ballbesitz weiter heraus. Schnell zurück.
    const danger = !own && d < 9;
    const rk = danger ? clamp(0.6 + 0.1 * d, 0.75, 1.5) : clamp(0.7 + 0.12 * d + (own ? 1.0 : 0), 0.9, own ? 3.0 : 2.2);
    const kx = gx + dx / d * rk, kz = clamp(dz / d * rk, -cage.gw - 0.3, cage.gw + 0.3);
    this.moveTo(inp, pl, kx, kz, danger && Math.hypot(kx - pl.x, kz - pl.z) > 1.2, 0.6);
    inp.autoCatch = inOwnBox; inp.hand = inOwnBox;
  }
}
