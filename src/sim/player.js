// Spieler: realistische Laufwerte (Sprint 7,5 m/s, 0→7 m/s in ≈ 2,5 s, Wendekreis v²/aLat), Ballführung mit echten
// Ballkontakten (kein Klebeball). Pass und Schuss über die Gesten-Grammatik (src/input/gesture.js): halten =
// flach/Vollspann, tipp + halten = hoch/angeschnitten; Ziel, Technik und Stärke planen pass.js/shot.js mit der echten
// Ballphysik, Luftbälle air.js. ?treffpunkt=1 = alte Profi-Steuerung (freie Richtung, Spin aus dem Treffpunkt).
// Hilfen ziehen nur, solange der Spieler nichts Deutliches tut.
import { setKick } from './kickplan.js';
import { planPass } from './pass.js';
import { planShot } from './shot.js';
import { planAir, stepAir, stepFall } from './air.js';
const DEG = Math.PI / 180;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Gegner näher als d am Spieler?
const oppNear = (game, pl, d) => game.players.some((o) => o.team !== pl.team && Math.hypot(o.x - pl.x, o.z - pl.z) < d);
// Tor, auf das der Spieler spielt (wie shot.js attackGoalX, ohne Import-Zyklus)
const goalX = (game, pl) => (game.match ? (pl.team === 0 ? game.cage.hx : -game.cage.hx) : (Math.cos(pl.face) >= 0 ? game.cage.hx : -game.cage.hx));

export const EMPTY_INPUT = Object.freeze({ mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, aimX: 0, aimZ: 0, aim: false });

export class Player {
  constructor(P, id = 0, team = 0) {
    this.P = P; this.id = id; this.team = team;
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0;
    this.hx = 1; this.hz = 0;     // Laufrichtung
    this.face = 0;                // Blickrichtung (rad, 0 = +x)
    this.speed = 0;
    this.sprinting = false;
    this.assistW = 0;             // aktuelles Gewicht der Ballführungs-Hilfe 0…1
    this.touchCd = 0;
    this.lastTouchT = -99;
    this.charging = false; this.charge = 0;
    this.pending = null;          // vorgemerkter Pass/Schuss
    this.kickT = 99; this.kickFoot = 1; this.touchT = 99;
    this.gait = 0;                // Laufzyklus (Grafik)
    this.lastKick = null;
    this.dribbling = false;
    this.clearT = 99;             // Zeit seit der letzten deutlichen Eingabe
    this.plant = 0;               // Stemmschritt 0…1 (Grafik: Körper stemmt sich in die neue Richtung)
    this.plantX = 1; this.plantZ = 0; this.plantT = 99;
    this.bodyOffT = 0;            // kurz keine Körper-Kollision mit dem Ball (nach Mitnahme im Stemmschritt)
    this.hand = { mode: 'none', t: 0, dx: 1, dz: 0 }; // Tormann: none | hold | dive | ground
    this.strong = id === 2 || id === 4 ? -1 : 1;    // starkes Bein (+1 rechts, −1 links): je Mannschaft ein Linksfuß
    this.chargeKind = 'shot'; this.chargeMode = 'std'; this.armed = null; // Geste: was lädt, Tipp wartet
    this.tech = ''; this.techT = 99;                 // zuletzt gespielte Technik (Grafik, Ton)
    this.air = null;                                 // geplanter Luftball (air.js)
    this.airPress = false;                           // der laufende Schuss-Druck hat einen Luftball ausgelöst
    this.jumpY = 0; this.jumpV = 0;                  // Sprung (Kopfball): Höhe der Füße über dem Boden
    this.fall = null;                                // am Boden nach Seit-/Fallrückzieher/Flugkopfball {tech, t, dur}
    this.holdT = 0;               // Ball in der Hand seit … s
    this.catchCd = -1;            // Spielzeit, ab der wieder gefangen werden darf
  }

  resetHands() { this.hand.mode = 'none'; this.hand.t = 0; this.holdT = 0; }

  // Hechtsprung in Richtung (dx, dz): kurze Flugphase, dann am Boden (siehe stepDive)
  startDive(dx, dz) {
    this.hand.mode = 'dive'; this.hand.t = 0; this.hand.dx = dx; this.hand.dz = dz;
    this.pending = null; this.charging = false;
  }

  stepDive(dt, game) {
    const P = this.P, h = this.hand;
    h.t += dt;
    if (h.mode === 'dive') {
      const k = Math.max(0, 1 - h.t / P.diveT);
      const sp = P.diveSpeed * (0.35 + 0.65 * k);
      this.vx = h.dx * sp; this.vz = h.dz * sp;
      if (h.t >= P.diveT) { h.mode = 'ground'; h.t = 0; }
    } else {
      const f = Math.exp(-dt * 10); this.vx *= f; this.vz *= f;
      if (h.t >= P.groundT) { h.mode = game.ball.held === this.id ? 'hold' : 'none'; h.t = 0; }
    }
    this.x += this.vx * dt; this.z += this.vz * dt;
    const lx = game.cage.hx - P.bodyR, lz = game.cage.hz - P.bodyR;
    this.x = clamp(this.x, -lx, lx); this.z = clamp(this.z, -lz, lz);
    this.speed = Math.hypot(this.vx, this.vz);
    this.plant = 0;
  }

  // Schuss-/Pass-API für Bots, Regeln und Challenges: Ziel statt Stick. Ausgeführt beim nächsten Ballkontakt.
  //  - mit Ziel: kind 'pass' | 'shot' | 'clear', target [x, z] (bei 'shot' Höhe als target[2]), technique
  //    'innen' | 'vollspann' | 'heber', speed/elev/spinY/spinBack optional, noise = Streuungs-Faktor, to = Empfänger
  //  - geplant wie beim Menschen (Nacht 2b): {kind: 'pass', to, lead: true, mode: 'std'|'var'} = Pass in den
  //    Laufweg (flach/Chip), {kind: 'shot', auto: true, mode, power} = Schuss mit automatischem Ziel und Qualität q
  kickAt({ kind = 'pass', target = [0, 0], technique = 'innen', speed, elev, spinY = 0, spinBack = 0, noise = 1, to = -1, lead = false, auto = false, mode = 'std', power = 0.8, skill = 1 } = {}) {
    this.pending = { kind, api: true, target: [...target], technique, speed, elev, spinY, spinBack, noise, to, lead, auto, mode, power, skill, dir: [1, 0], age: 0 };
  }

  place(x, z, face = 0) {
    this.x = x; this.z = z; this.vx = 0; this.vz = 0; this.speed = 0;
    this.face = face; this.hx = Math.cos(face); this.hz = Math.sin(face);
    this.pending = null; this.charging = false; this.charge = 0; this.assistW = 0;
    this.air = null; this.airPress = false; this.fall = null; this.jumpY = 0; this.jumpV = 0; this.armed = null;
  }

  footPoint() {
    return [this.x + Math.cos(this.face) * this.P.footAhead, this.z + Math.sin(this.face) * this.P.footAhead];
  }

  step(dt, inp, game) {
    const P = this.P, ball = game.ball, t = game.t;
    this.touchCd -= dt; this.kickT += dt; this.touchT += dt; this.clearT += dt; this.plantT += dt; this.techT += dt;
    // Sprung (Kopfball, Absprung beim Fallrückzieher): Füße über dem Boden
    if (this.jumpY > 0 || this.jumpV > 0) { this.jumpY += this.jumpV * dt; this.jumpV -= P.g * dt; if (this.jumpY <= 0) { this.jumpY = 0; this.jumpV = 0; } }
    if (this.hand.mode === 'dive' || this.hand.mode === 'ground') { this.stepDive(dt, game); return; }
    if (this.fall) { stepFall(this, dt, game); this.plant = 0; return; } // am Boden nach Seit-/Fallrückzieher
    const held = ball.held >= 0;
    if (this.pending) { this.pending.age += dt; if (this.pending.age > P.kickBuffer) this.pending = null; }

    // --- Eingabe: Stick, Aktionen ---
    let mx = inp.mx || 0, mz = inp.mz || 0;
    let mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
    const want = mag > 0.12;
    const sx = want ? mx / mag : 0, sz = want ? mz / mag : 0; // Stick-Richtung
    this.sprinting = !!inp.sprint && want;
    const aimDir = () => {
      if (inp.aim && (inp.aimX || inp.aimZ)) { const l = Math.hypot(inp.aimX, inp.aimZ); return [inp.aimX / l, inp.aimZ / l]; }
      if (want) return [sx, sz];
      return [Math.cos(this.face), Math.sin(this.face)];
    };
    const stick = () => (inp.aim && (inp.aimX || inp.aimZ) ? aimDir() : want ? [sx, sz] : null);
    if (inp.gest) this.gestures(inp, game, aimDir, stick);
    else { // Flanken (Tests, alte Eingabe): Pass = Einzeltipp, Schuss halten/loslassen = Standard
      if (inp.pass) { this.pending = { kind: 'pass', mode: inp.mode || 'std', power: null, stick: stick(), dir: aimDir(), age: 0 }; this.clearT = 0; }
      if (inp.shootHeld) { this.charging = true; this.chargeKind = 'shot'; this.chargeMode = inp.mode || 'std'; this.charge = Math.min(this.charge + dt, P.chargeT * 1.25); }
      if (inp.shootRelease && this.charging) {
        this.pending = { kind: 'shot', mode: inp.mode || 'std', power: clamp(this.charge / P.chargeT, 0, 1), cx: clamp(inp.cx || 0, -1, 1), cy: clamp(inp.cy || 0, -1, 1), stick: stick(), dir: aimDir(), age: 0 };
        this.charging = false; this.charge = 0; this.clearT = 0;
      }
      if (!inp.shootHeld && !inp.shootRelease && this.charging) { this.charging = false; this.charge = 0; }
    }
    // Luftball: Schuss gehalten oder vorgemerkt, Ball kommt in der Luft → Kopfball/Volley/… planen (Timing ab dem Druck)
    if (!this.air && !held && !P.treffpunkt && (ball.p.y > P.reachH || ball.v.y > 1.5)) {
      if (this.charging && this.chargeKind === 'shot' && !this.airPress) { if (this.tryAir(game, this.chargeT0 ?? game.t)) this.airPress = true; }
      else if (this.pending && this.pending.kind === 'shot' && !this.pending.api) { if (this.tryAir(game, this.pending.t ?? game.t)) this.pending = null; }
    }
    if (this.air) { // Anlauf, Absprung, Treffpunkt – die Hilfe steuert, deutliche Gegen-Eingabe bricht nach 0,3 s ab
      if (stepAir(this, dt, game, want, sx, sz)) { this.plant = 0; this.gait += this.speed * dt / 1.1; return; }
    }

    // --- Ball-Lage ---
    const bx = ball.p.x - this.x, bz = ball.p.z - this.z;
    const bd = Math.hypot(bx, bz);
    this.dribbling = (t - this.lastTouchT) < 3.0 && bd < 5 && ball.p.y < 1.0;

    // --- Hilfe: zieht zum Ball, solange der Stick grob dorthin zeigt; deutliche Eingabe → sofort frei ---
    let dirX = sx, dirZ = sz;
    let targetW = 0;
    const loose = !held && bd < 3 && ball.p.y < 0.6 && Math.hypot(ball.v.x, ball.v.z) < 5;
    if (held) this.dribbling = false;
    if (!held && want && bd > 0.05 && (this.dribbling || this.pending || loose)) {
      // Treffpunkt: wo der Ball in ~0,35 s ist
      const lead = 0.35;
      const ix = ball.p.x + ball.v.x * lead - this.x, iz = ball.p.z + ball.v.z * lead - this.z;
      const il = Math.hypot(ix, iz) || 1;
      const agree = (ix * sx + iz * sz) / il;
      if (agree > Math.cos(P.assistAngle * DEG)) targetW = 1;
      else this.clearT = 0; // deutliche Abweichung
      if (targetW > 0) {
        const w = this.assistW * P.assist;
        dirX = sx * (1 - w) + (ix / il) * w; dirZ = sz * (1 - w) + (iz / il) * w;
        const l = Math.hypot(dirX, dirZ) || 1; dirX /= l; dirZ /= l;
      }
    } else if (!held && !want && this.pending && bd < 3) {
      // Pass/Schuss vorgemerkt, Stick los: zum Ball laufen (Hilfe)
      targetW = 1;
      dirX = bx / bd; dirZ = bz / bd;
    }
    // Empfänger eines Passes ohne Stick: läuft in seinem Laufweg zum geplanten Treffpunkt und kommt pünktlich an
    // (Phase A); ist der Ball nah oder die Zeit fast um, geht er direkt auf den Ball (Phase B) – kein Stehenbleiben.
    const pp = game.passPlan;
    let recv = false, recvV = 0;
    if (!want && !held && pp && pp.to === this.id && !(this.pending && bd < 3) && game.t < pp.t + 1.2) {
      const tRem = pp.t - game.t;
      const bvx = ball.v.x, bvz = ball.v.z, lead = clamp(bd / 9, 0.1, 0.35);
      const near = bd < 3.2 && (ball.p.y < 1.8 || tRem < 0.4);
      const tx = near ? ball.p.x + bvx * lead : pp.x, tz = near ? ball.p.z + bvz * lead : pp.z;
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (d > 0.12) {
        recv = true; dirX = dx / d; dirZ = dz / d;
        recvV = near ? clamp(Math.max(this.speed, d / 0.35), 1.5, P.vSprint) : clamp(d / Math.max(0.12, tRem), 1.5, P.vSprint);
      }
    }
    const tau = targetW > this.assistW ? P.assistReturn : P.assistRelease;
    this.assistW += (targetW - this.assistW) * (1 - Math.exp(-dt / tau));
    // Pass/Schuss lädt oder Tipp-Fenster läuft, Stick los: in der Laufrichtung weiter statt abrupt zu bremsen
    // (sonst rollt der vorgelegte Ball davon, bevor der Kick kommt)
    const carry = !want && !recv && !(targetW > 0 && this.pending) && (this.charging || this.armed) && this.speed > 1.2 && !held;
    if (carry) { dirX = this.hx; dirZ = this.hz; }
    const moving = want || (targetW > 0 && this.pending) || recv || carry;

    // --- Bewegung ---
    let vd = 0;
    if (moving) {
      vd = (want ? mag : 0.8) * (this.sprinting ? P.vSprint : P.vRun);
      // Vorgemerkter Kick ohne Stick: dem Ball mindestens so schnell nachlaufen, wie er rollt (bis Sprint)
      if (!want && this.pending && !held) vd = Math.max(vd, Math.min(P.vSprint, Math.hypot(ball.v.x, ball.v.z) + 1.5));
      if (this.dribbling) vd *= P.dribbleSlow;
      if (this.charging && bd < 0.75) vd *= 0.8; // zum Schuss hin etwas verlangsamen – nur mit dem Ball am Fuß (sonst läuft er davon)
      if (this.hand.mode === 'hold') vd = Math.min(vd, P.vRun * 0.6); // mit Ball in der Hand nur gehen
      if (inp.speedCap) vd *= inp.speedCap;                              // Bot-Stärke
      if (carry) vd = this.speed;   // weiterlaufen: Tempo halten (nach allen Faktoren, sonst schrumpft es je Takt)
      if (recv) vd = recvV;
    }
    if (P.zack) this.moveZack(dt, moving, dirX, dirZ, vd);
    else this.moveOld(dt, moving, dirX, dirZ, vd);
    const s = Math.hypot(this.vx, this.vz);
    const hAng = s > 1e-6 ? Math.atan2(this.vz, this.vx) : Math.atan2(this.hz, this.hx);
    this.x += this.vx * dt; this.z += this.vz * dt;
    // Bande: Spieler bleibt im Feld
    const lx = game.cage.hx - P.bodyR, lz = game.cage.hz - P.bodyR;
    if (this.x > lx) { this.x = lx; if (this.vx > 0) this.vx = 0; }
    if (this.x < -lx) { this.x = -lx; if (this.vx < 0) this.vx = 0; }
    if (this.z > lz) { this.z = lz; if (this.vz > 0) this.vz = 0; }
    if (this.z < -lz) { this.z = -lz; if (this.vz < 0) this.vz = 0; }
    this.speed = Math.hypot(this.vx, this.vz);
    if (this.speed > 1e-6) { this.hx = this.vx / this.speed; this.hz = this.vz / this.speed; }
    // Blickrichtung: Stemmschritt → Körper dreht schon in die neue Richtung; läuft → Laufrichtung;
    // steht → zum Stick bzw. zum Ball
    let fAng = this.face;
    const aimGoal = !want && this.charging && this.chargeKind === 'shot' && !P.treffpunkt && bd < 2.5;
    if (aimGoal) fAng = Math.atan2(-ball.p.z, goalX(game, this) - ball.p.x); // Schuss laden ohne Stick: zum Tor drehen
    else if (this.plant > 0.4 && moving) fAng = Math.atan2(dirZ, dirX);
    else if (s > 0.6) fAng = hAng;
    else if (want) fAng = Math.atan2(sz, sx);
    else if (bd < 3 && bd > 0.2) fAng = Math.atan2(bz, bx);
    this.face += clamp(wrap(fAng - this.face), -P.turnCap * dt, P.turnCap * dt);
    this.gait += s * dt / 1.1;

    // --- Ball spielen ---
    const [fx, fz] = this.footPoint();
    const dx = ball.p.x - fx, dz = ball.p.z - fz;
    const fd = Math.hypot(dx, dz);
    // Im Stemmschritt nimmt der Spieler den Ball mit (Sohle/Außenseite): Reichweite ab Körpermitte
    const cut = this.plant > 0.3 && want && bd < P.cutReach;
    const inReach = (fd < P.reach || cut) && ball.p.y < P.reachH;
    const rvx = ball.v.x - this.vx, rvz = ball.v.z - this.vz;
    const rel = Math.hypot(rvx, ball.v.y, rvz);
    let touched = false;
    if (held) return;
    // Ballannahme aus der Luft (Brust, Oberschenkel): Ball kommt vor dem Körper herunter, nicht zu schnell → er fällt
    // kontrolliert vor die Füße. Harte Schüsse prallen weiter vom Körper ab (bodyCollision).
    if (!inReach && this.touchCd <= 0 && !this.air && ball.p.y > P.reachH && ball.p.y < 1.55 && ball.v.y < 0.5 && bd < 0.75 && rel < 11 &&
        (bx * Math.cos(this.face) + bz * Math.sin(this.face)) > -0.15 && !this.pending) {
      const k = 0.7, part = ball.p.y > 1.05 ? 'brust' : 'oberschenkel';
      ball.v.set(this.vx * k + Math.cos(this.face) * 0.6, -1.2, this.vz * k + Math.sin(this.face) * 0.6);
      ball.w.set(0, 0, 0);
      this.tech = part; this.techT = 0;
      this.afterTouch(game, 0.25, rel);
      game.events.push({ type: 'control', part, player: this.id, x: ball.p.x, y: ball.p.y, z: ball.p.z });
      touched = true;
    }
    // Vorgemerkter Kick: noch einen Schritt abwarten, wenn der Ball zu weit vorn liegt und näher kommt (bessere Lage,
    // höheres q) – höchstens 0,25 s, nie wenn er sich entfernt oder ein Gegner nah ist
    let settle = false;
    if (this.pending && !this.pending.api && inReach && !cut) {
      const fxf = Math.cos(this.face), fzf = Math.sin(this.face);
      const ahead = bx * fxf + bz * fzf, closing = (ball.v.x - this.vx) * fxf + (ball.v.z - this.vz) * fzf;
      settle = ahead > 0.6 && closing < -0.8 && this.pending.age < 0.25 && !oppNear(game, this, 1.4);
    } else if (this.pending && this.pending.api && this.pending.kind === 'shot' && inReach && !cut) {
      const fxf = Math.cos(this.face), fzf = Math.sin(this.face);
      const ahead = bx * fxf + bz * fzf, closing = (ball.v.x - this.vx) * fxf + (ball.v.z - this.vz) * fzf;
      settle = ahead > 0.6 && closing < -0.8 && this.pending.age < 0.25 && !oppNear(game, this, 1.4);
    }
    if (!touched && inReach && rel < P.ctrlRelMax && !settle) {
      if (this.pending && this.touchCd <= 0.1) {
        this.kick(this.pending, game, rel);
        this.pending = null;
        touched = true;
      } else if (this.touchCd <= 0) {
        touched = this.dribbleTouch(game, want, sx, sz, vd, fd, rel);
        // Stemmschritt mit Ball: Sohle/Außenseite führt den Ball am Körper vorbei in die neue Richtung
        if (touched && cut) this.bodyOffT = 0.35;
      }
    }
    this.bodyOffT -= dt;
    if (!touched && this.bodyOffT <= 0) this.bodyCollision(game);
  }

  // Bewegungsmodell „zack“ (Standard): Geschwindigkeit als Vektor. Kleine Winkel zur Wunschrichtung = Kurve
  // (Richtung dreht mit ω = aLat/v, Tempo bleibt). Große Winkel = Stemmschritt: der Anteil quer und rückwärts
  // zur Wunschrichtung wird mit aPlant hart abgebremst, gleichzeitig stößt sich der Spieler in die neue
  // Richtung ab (Antrittskurve ab dem Tempo in neuer Richtung). Zwischen curveDeg und plantDeg gemischt.
  moveZack(dt, moving, dirX, dirZ, vd) {
    const P = this.P;
    let vx = this.vx, vz = this.vz;
    const s = Math.hypot(vx, vz);
    const agil = this.dribbling ? P.ballAgil : 1;
    const aLat = P.aLat * agil, aPlant = P.aPlant * agil;
    let plant = 0;
    if (!moving) {
      const ns = Math.max(0, s - P.aBrake * dt);
      if (s > 1e-9) { vx *= ns / s; vz *= ns / s; }
    } else if (s < 0.05) {
      const ns = Math.min(vd, s + this.accel(s) * dt);
      vx = dirX * ns; vz = dirZ * ns;
    } else {
      const hx = vx / s, hz = vz / s;
      const phi = Math.atan2(hx * dirZ - hz * dirX, hx * dirX + hz * dirZ); // Winkel Laufrichtung → Wunsch
      const b = smoothstep(P.curveDeg * DEG, P.plantDeg * DEG, Math.abs(phi));
      let cx = 0, cz = 0, px = 0, pz = 0;
      if (b < 1) { // Kurve
        const w = Math.min(P.turnCap, aLat / s);
        const dA = clamp(phi, -w * dt, w * dt);
        const c = Math.cos(dA), sn = Math.sin(dA);
        const ns = s < vd ? Math.min(vd, s + this.accel(s) * dt) : Math.max(vd, s - P.aBrake * dt);
        cx = (hx * c - hz * sn) * ns; cz = (hx * sn + hz * c) * ns;
      }
      if (b > 0) { // Stemmschritt
        let vu = vx * dirX + vz * dirZ;
        let qx = vx - vu * dirX, qz = vz - vu * dirZ;
        const q = Math.hypot(qx, qz);
        if (q > 1e-9) { const nq = Math.max(0, q - aPlant * dt); qx *= nq / q; qz *= nq / q; }
        if (vu < 0) vu = Math.min(0, vu + aPlant * dt);
        else if (vu < vd) vu = Math.min(vd, vu + this.accel(vu) * dt);
        else vu = Math.max(vd, vu - P.aBrake * dt);
        px = vu * dirX + qx; pz = vu * dirZ + qz;
      }
      vx = cx * (1 - b) + px * b; vz = cz * (1 - b) + pz * b;
      plant = s > 1.0 ? b : 0;
    }
    this.plant = plant;
    if (plant > 0.3) { this.plantX = dirX; this.plantZ = dirZ; this.plantT = 0; }
    this.vx = vx; this.vz = vz;
    this.speed = Math.hypot(vx, vz);
    if (this.speed > 1e-6) { this.hx = vx / this.speed; this.hz = vz / this.speed; }
  }

  // Antrittskurve: dv/dt = (vSprint − v)/τ(v) mit τ(v) = τ0 + τ1·v/vSprint (erste Schritte spritzig)
  accel(v) {
    const P = this.P;
    return Math.max(0, P.vSprint - v) / (P.tauAcc0 + P.tauAcc1 * Math.max(0, v) / P.vSprint);
  }

  // Weg in T Sekunden ab Tempo v0, Antrittskurve bis vd (Stärke der Ballkontakte)
  // (v0 < 0: läuft noch rückwärts zur neuen Richtung → erst Stemmschritt-Bremsung)
  travel(v0, vd, T) {
    const n = 12, h = T / n, aP = this.P.aPlant * (this.dribbling ? this.P.ballAgil : 1);
    let v = v0, x = 0;
    for (let i = 0; i < n; i++) {
      const v2 = v < 0 ? Math.min(0, v + aP * h) : v < vd ? Math.min(vd, v + this.accel(v) * h) : v;
      x += (v + v2) / 2 * h; v = v2;
    }
    return x;
  }

  // Altes Modell aus Nacht 1 (?zack=0): Laufrichtung dreht mit ω = aLat/v, ab plantAngle erst bremsen
  moveOld(dt, moving, dirX, dirZ, vd) {
    const P = this.P;
    let s = this.speed;
    let hAng = Math.atan2(this.hz, this.hx);
    if (moving) {
      const dAng = Math.atan2(dirZ, dirX);
      const diff = wrap(dAng - hAng);
      if (s < 0.8) {
        hAng += clamp(diff, -P.turnCap * 2 * dt, P.turnCap * 2 * dt);
      } else {
        const wmax = Math.min(P.turnCap, P.aLat / s);
        if (Math.abs(diff) > P.plantAngle) { s = Math.max(0, s - P.aBrake * dt); hAng += Math.sign(diff) * wmax * dt; }
        else hAng += clamp(diff, -wmax * dt, wmax * dt);
      }
      if (s < vd) s = Math.min(vd, s + (P.vSprint - s) / P.tauAcc * dt);
      else s = Math.max(vd, s - P.aBrake * dt);
    } else s = Math.max(0, s - P.aBrake * dt);
    this.hx = Math.cos(hAng); this.hz = Math.sin(hAng);
    this.speed = s;
    this.vx = this.hx * s; this.vz = this.hz * s;
    this.plant = 0;
  }

  // Ballkontakt beim Führen: Richtung = Stick, Stärke passend zum Tempo (Hilfe), kleine Fehler aus dem Seed.
  dribbleTouch(game, want, sx, sz, vd, fd, rel) {
    const P = this.P, ball = game.ball, rng = game.rng;
    const bv = Math.hypot(ball.v.x, ball.v.z);
    if (!want) {
      // Stick los: Ball stoppen (einmaliger Kontakt), wenn er sich gegen den Spieler bewegt
      if (rel < 0.6 && bv < 0.8) return false;
      const k = 0.85;
      ball.v.set(this.vx * k, Math.min(ball.v.y, 0), this.vz * k);
      this.afterTouch(game, 0.3, rel);
      return true;
    }
    const sf = this.sprinting ? 1 : 0;
    // Beim Aufladen: kurze Vorbereitungs-Kontakte, der Ball bleibt am Fuß (sonst ist er beim Loslassen weg)
    const T = this.charging ? 0.32 : P.touchLead + (P.touchLeadSprint - P.touchLead) * sf;
    const L = this.charging ? 0.05 : P.touchExtra + (P.touchExtraSprint - P.touchExtra) * sf;
    // Weg des Spielers bis zum nächsten Kontakt: ab dem Tempo in Stick-Richtung (nach einem Stemmschritt klein)
    // mit der Antrittskurve bis zum Wunschtempo (altes Modell: pauschal +2,5 m/s²)
    // Läuft er noch gegen die neue Richtung (Stemmschritt), kommt die Bremszeit dazu.
    let Tm = T, run;
    if (P.zack) {
      const vAl = this.vx * sx + this.vz * sz;
      Tm = T + Math.max(0, -vAl) / (P.aPlant * (this.dribbling ? P.ballAgil : 1));
      run = this.travel(vAl, vd, Tm);
    } else run = Math.min(vd, this.speed + 2.5 * T) * T;
    // Stärke so, dass der Spieler den Ball nach Tm wieder am Fuß hat (+ Vorlage L): Roll-Vorhersage mit
    // derselben Verzögerung wie im Ball-Modell (Rasen + Luft).
    const ahead = (ball.p.x - this.x) * sx + (ball.p.z - this.z) * sz;
    const D = Math.max(0.15, run + (P.footAhead - ahead) + L);
    let u = vd < 0.5 ? 1.2 : solveRollSpeed(P, D, Tm);
    u = Math.min(u, 14);
    // Nur berühren, wenn nötig: Ball zu nah am Fuß oder läuft falsch
    const ang = bv > 0.2 ? Math.acos(clamp((ball.v.x * sx + ball.v.z * sz) / bv, -1, 1)) : Math.PI;
    // (läuft der Ball richtig, holt der Spieler ihn ein; berührt wird erst am Fuß → echte Vorlagen)
    const fwd = (ball.p.x - this.x - Math.cos(this.face) * P.footAhead) * Math.cos(this.face) + (ball.p.z - this.z - Math.sin(this.face) * P.footAhead) * Math.sin(this.face);
    const need = fd < 0.26 || fwd < 0.12 || ang > 20 * DEG || bv < 0.35 * u;
    if (!need) return false;
    const fast = rel > P.ctrlRel;
    const errA = P.touchErrDeg * DEG * (1 + 1.5 * sf) * (fast ? 2.5 + (rel - P.ctrlRel) * 0.3 : 1) * rng.gauss();
    const errS = 1 + P.touchErrSpeed * (1 + sf) * (fast ? 2 : 1) * rng.gauss();
    const c = Math.cos(errA), s = Math.sin(errA);
    const dx = sx * c - sz * s, dz = sx * s + sz * c;
    u *= errS;
    ball.v.set(dx * u, Math.min(ball.v.y, 0), dz * u);
    ball.w.set(dz * u / ball.r, 0, -dx * u / ball.r); // rollt sofort
    this.afterTouch(game, 0.2, rel);
    return true;
  }

  afterTouch(game, cd, rel) {
    if (game.passPlan && (game.passPlan.from !== this.id || game.t > game.passPlan.t - 0.2)) game.passPlan = null; // Pass angekommen/abgefangen
    this.touchCd = cd;
    this.lastTouchT = game.t;
    if (game.match) game.rules.touch(this);
    this.touchT = 0;
    this.kickFoot = -this.kickFoot;
    game.ball.reseedKnuckle(game.rng);
    game.events.push({ type: 'touch', player: this.id, rel, x: game.ball.p.x, y: game.ball.p.y, z: game.ball.p.z });
  }

  // Luftball versuchen (Schuss gedrückt): Plan aus air.js übernehmen → true
  tryAir(game, tPress) {
    const plan = planAir(game, this, { tPress });
    if (!plan) return false;
    this.air = plan; this.pending = null; this.charging = false;
    return true;
  }

  // Gesten-Ereignisse des Menschen (Game.humanInput → stepGestures): start/pause/tap/release/cancel
  gestures(inp, game, aimDir, stick) {
    const P = this.P;
    for (const e of inp.gest) {
      if (e.type === 'start') {
        this.pending = null; this.charging = true; this.chargeKind = e.btn; this.chargeMode = e.mode; this.charge = 0;
        this.armed = null; this.clearT = 0; this.chargeT0 = game.t;
        if (e.btn === 'shot' && !P.treffpunkt && this.tryAir) this.airPress = this.tryAir(game, game.t);
      } else if (e.type === 'pause') {
        this.charging = false; this.armed = e.btn;
      } else if (e.type === 'tap' || e.type === 'release') {
        this.armed = null;
        if (e.btn === 'shot' && this.airPress) { this.airPress = false; this.charging = false; continue; } // Luftball läuft
        const kind = e.btn === 'pass' ? 'pass' : 'shot';
        // Pass: Einzeltipp bzw. Doppeltipp (zweiter Druck kurz) = automatische Stärke, sonst Stärke aus der Haltedauer
        const power = kind === 'pass' && (e.type === 'tap' || e.dur < P.tapMax) ? null : clamp(e.dur / P.chargeT, 0, 1);
        this.pending = { kind, mode: e.mode, power, stick: stick(), dir: aimDir(), cx: clamp(inp.cx || 0, -1, 1), cy: clamp(inp.cy || 0, -1, 1), age: 0, t: this.chargeT0 ?? game.t };
        this.charging = false; this.charge = 0; this.clearT = 0;
      } else if (e.type === 'cancel') {
        if (this.chargeKind === e.btn) this.charging = false;
        if (e.btn === 'shot') this.airPress = false;
      }
    }
    if (this.charging && inp.gview && !inp.gview.wait) this.charge = inp.gview.dur;
  }

  // Pass oder Schuss ausführen
  kick(pd, game, rel) {
    if (pd.api && (pd.lead || pd.auto)) {
      const plan = pd.kind === 'shot' ? planShot(game, this, { mode: pd.mode, power: pd.power, noiseMul: pd.noise, skill: pd.skill })
        : planPass(game, this, { mode: pd.mode, to: pd.to, noiseMul: pd.noise, power: null });
      return this.applyPlan(plan, game, rel);
    }
    if (!pd.api && !this.P.treffpunkt) {
      const plan = pd.kind === 'pass' ? planPass(game, this, { mode: pd.mode, power: pd.power, stick: pd.stick })
        : planShot(game, this, { mode: pd.mode, power: pd.power, stick: pd.stick });
      return this.applyPlan(plan, game, rel);
    }
    const P = this.P, ball = game.ball, rng = game.rng;
    let [dx, dz] = pd.dir;
    let speed, elev, spinSide = 0, spinBack = 0, noiseDeg;
    const sprintPen = this.sprinting ? 1.5 : 0;
    if (pd.api) {
      // Ziel → Richtung ab der Ballposition beim Kontakt
      const tx = pd.target[0] - ball.p.x, tz = pd.target[1] - ball.p.z;
      const D = Math.hypot(tx, tz) || 1;
      dx = tx / D; dz = tz / D;
      if (pd.kind === 'pass') {
        speed = pd.speed ?? passSpeedFor(P, D);
        elev = (pd.elev ?? 1.5) * DEG;
        noiseDeg = (1.0 + sprintPen) * pd.noise;
      } else if (pd.kind === 'clear') {
        speed = pd.speed ?? 20;
        elev = (pd.elev ?? 24) * DEG;
        noiseDeg = (3 + sprintPen) * pd.noise;
      } else { // Schuss
        speed = pd.speed ?? 26;
        const h = pd.target[2] ?? 0.5;
        // Abflugwinkel für die Zielhöhe (Fallkurve grob ausgeglichen)
        elev = pd.elev != null ? pd.elev * DEG : Math.atan2(h - ball.p.y + 4.9 * (D / speed) ** 2, D);
        if (pd.technique === 'innen') spinSide = pd.spinY || 0;
        if (pd.technique === 'heber') { spinBack = 5 * 2 * Math.PI; }
        noiseDeg = (0.8 + 1.2 * (speed / P.shotMax) ** 2 + sprintPen) * pd.noise;
      }
      spinSide = pd.spinY ? pd.spinY : spinSide;
      spinBack = pd.spinBack ? pd.spinBack : spinBack;
      // Ziel hinter dem Spieler (> 100° zur Blickrichtung): nur Hacke/Sohle möglich → kurz und flach
      const back = Math.cos(this.face) * dx + Math.sin(this.face) * dz < Math.cos(100 * DEG);
      if (back) { speed = Math.min(speed, 6.5); elev = 2 * DEG; spinSide = 0; spinBack = 0; noiseDeg = Math.max(noiseDeg, 6); }
    } else if (pd.kind === 'pass') {
      speed = P.passSpeed * (1 + 0.03 * rng.gauss());
      elev = 1.5 * DEG;
      noiseDeg = 1.2 + sprintPen;
    } else {
      const f = pd.power;
      let cx = pd.cx, cy = pd.cy;
      const cl = Math.hypot(cx, cy);
      if (cl > 1) { cx /= cl; cy /= cl; }
      speed = (P.shotMin + (P.shotMax - P.shotMin) * f) * (1 - 0.18 * (cx * cx + cy * cy));
      elev = (5 + 18 * Math.max(0, -cy) - 3 * Math.max(0, cy) - (f < 0.3 ? 2 : 0) + rng.gauss()) * DEG;
      // Innenseite (Treffpunkt seitlich): Drall um die Hochachse, bis spinMax U/s
      spinSide = cx * P.spinMax * 2 * Math.PI * Math.min(1, speed / 25);
      // unter der Mitte: Rückdrall (Heber), über der Mitte: Vorwärtsdrall
      spinBack = -cy * P.backspinMax * 2 * Math.PI * Math.min(1, speed / 20);
      noiseDeg = 0.8 + 2.5 * f * f + sprintPen;
    }
    if (rel > P.ctrlRel) noiseDeg += (rel - P.ctrlRel) * 0.8;
    const e = noiseDeg * DEG * rng.gauss();
    const c = Math.cos(e), s = Math.sin(e);
    [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
    const ce = Math.cos(elev), se = Math.sin(elev);
    ball.v.set(dx * speed * ce, speed * se, dz * speed * ce);
    const bxA = -dz, bzA = dx; // d × ŷ = (d.y·0 − d.z·1, d.z·0 − d.x·0, d.x·1 − d.y·0) = (−dz, 0, dx)
    // Vollspann (Treffpunkt Mitte): kaum Drall (± 0,06 U/s) → Flatterball
    ball.w.set(bxA * spinBack + 0.4 * rng.gauss(), spinSide + 0.4 * rng.gauss(), bzA * spinBack + 0.4 * rng.gauss());
    if (pd.kind === 'pass' && !pd.spinY) { // Pass: leichter Vorwärtsdrall (rutscht kurz, rollt dann)
      ball.w.set(dz * speed / ball.r * 0.3, 0, -dx * speed / ball.r * 0.3);
    }
    if (ball.p.y < ball.r + 0.02) ball.p.y = ball.r + 0.002;
    ball.contact = elev < 2.5 * DEG && ball.p.y < ball.r + 0.01;
    ball.reseedKnuckle(rng);
    this.touchCd = 0.35;
    this.bodyOffT = 0.3; // der eigene Körper blockt den eigenen Schuss nicht
    this.lastTouchT = game.t;
    this.kickT = 0; this.touchT = 0;
    this.kickFoot = -this.kickFoot;
    const techL = pd.kind === 'pass' ? (Math.cos(this.face) * dx + Math.sin(this.face) * dz < Math.cos(100 * DEG) ? 'ferse' : 'innen') : pd.kind === 'clear' ? 'vollspann' : (Math.abs(spinSide) > 3 ? 'innenrist' : spinBack > 10 ? 'chip' : 'vollspann');
    this.tech = techL; this.techT = 0;
    this.lastKick = { kind: pd.kind, tech: techL, speed, spinRps: Math.hypot(ball.w.x, ball.w.y, ball.w.z) / (2 * Math.PI), sideRps: spinSide / (2 * Math.PI), elevDeg: elev / DEG, power: pd.power ?? 0, cx: pd.cx ?? 0, cy: pd.cy ?? 0, t: game.t };
    // Empfänger merken (Spielerwechsel zum Empfänger, Bots laufen dem Ball entgegen)
    let to = pd.to ?? -1;
    if (to < 0 && pd.kind === 'pass' && game.match) {
      let best = 0.9;
      for (const m of game.players) {
        if (m.team !== this.team || m.id === this.id) continue;
        const mx = m.x - ball.p.x, mz = m.z - ball.p.z, ml = Math.hypot(mx, mz) || 1;
        const c = (mx * dx + mz * dz) / ml;
        if (c > best) { best = c; to = m.id; }
      }
    }
    if (game.match) { game.passTo = pd.kind === 'pass' ? to : -1; game.rules.touch(this); }
    game.passPlan = null;
    game.events.push({ type: 'kick', kind: pd.kind, tech: techL, player: this.id, speed, x: ball.p.x, y: ball.p.y, z: ball.p.z, dx, dz, to });
  }

  // Geplanten Pass/Schuss/Luftball ausführen: Streuung (Richtung, Höhe, Tempo) aus dem Seed, Anfangsbedingungen per
  // setKick – danach fliegt der Ball mit der normalen Physik.
  applyPlan(plan, game, rel) {
    const P = this.P, ball = game.ball, rng = game.rng;
    let [dx, dz] = plan.dir;
    let noise = plan.noiseDeg;
    if (rel > P.ctrlRel) noise += (rel - P.ctrlRel) * 0.8;
    const e = noise * DEG * rng.gauss();
    const c = Math.cos(e), s = Math.sin(e);
    [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
    const flat = plan.kind === 'pass' && !plan.chip;
    const el = plan.elRad + (flat ? 0 : (plan.chip ? 0.25 : 0.5) * noise * DEG * rng.gauss());
    const speed = plan.speed * (1 + (plan.kind === 'pass' ? 0.03 : 0.02) * rng.gauss());
    const back = plan.kind === 'pass' && !plan.chip ? -0.3 * speed / ball.r : plan.back || 0;
    setKick(ball, dx, dz, speed, el, back, plan.side || 0);
    if (plan.tech === 'vollspann' || plan.tech === 'volley' || plan.tech === 'dropkick') { // kaum Drall → Flatterball
      ball.w.x += 0.4 * rng.gauss(); ball.w.y += 0.4 * rng.gauss(); ball.w.z += 0.4 * rng.gauss();
    }
    ball.reseedKnuckle(rng);
    this.touchCd = 0.35;
    this.bodyOffT = 0.3;
    this.lastTouchT = game.t;
    this.kickT = 0; this.touchT = 0;
    this.tech = plan.tech; this.techT = 0;
    const bs = -(ball.p.x - this.x) * Math.sin(this.face) + (ball.p.z - this.z) * Math.cos(this.face);
    this.kickFoot = plan.foot || (plan.tech === 'ferse' ? -(this.strong) : bs >= 0 ? 1 : -1);
    const sideRps = (plan.side || 0) / (2 * Math.PI);
    this.lastKick = { kind: plan.kind, tech: plan.tech, mode: plan.mode, speed, q: plan.q ?? null, factors: plan.factors || null, power: plan.power ?? null,
      spinRps: Math.hypot(ball.w.x, ball.w.y, ball.w.z) / (2 * Math.PI), sideRps, elevDeg: el / DEG, to: plan.to ?? -1, bank: plan.bank || 0, chip: !!plan.chip,
      aim: plan.aim || null, meet: plan.meet || null, T: plan.T ?? null, t: game.t, timing: plan.timing ?? null, planElDeg: plan.elRad / DEG };
    let to = plan.kind === 'pass' ? (plan.to ?? -1) : -1;
    if (to < -1) to = -1; // Challenge-Ziel (virtuell)
    if (game.match) { game.passTo = to; game.rules.touch(this); }
    game.passPlan = plan.kind === 'pass' && plan.meet ? { to: plan.to ?? -1, from: this.id, x: plan.meet[0], z: plan.meet[1], t: game.t + (plan.T || 1), chip: !!plan.chip, bank: plan.bank || 0 } : null;
    game.events.push({ type: 'kick', kind: plan.kind === 'air' ? 'shot' : plan.kind, tech: plan.tech, player: this.id, speed, x: ball.p.x, y: ball.p.y, z: ball.p.z, dx, dz, to, q: plan.q ?? null });
    return plan;
  }

  // Körper als senkrechter Zylinder (Radius 0,22 m, bis 1,85 m Höhe): Ball prallt weich ab (e = 0,35 relativ
  // zum Spieler). Nur waagrecht – ein Ball kann nie auf einem Spieler liegen bleiben (rutscht vom Kopf ab).
  bodyCollision(game) {
    const ball = game.ball, r = ball.r, R = 0.22;
    if (ball.held >= 0 || ball.p.y > (this.fall ? 0.35 : 1.85 + this.jumpY) + r) return;
    // Über der Bande einen langsamen Ball nicht gegen die Netze drücken (sonst klemmt er dort fest)
    if (ball.p.y > game.cage.bH && ball.v.len() < 2) return;
    const nx = ball.p.x - this.x, nz = ball.p.z - this.z;
    const d = Math.hypot(nx, nz);
    if (d >= r + R) return;
    const ux = d > 1e-6 ? nx / d : Math.cos(this.face), uz = d > 1e-6 ? nz / d : Math.sin(this.face);
    ball.p.x = this.x + ux * (r + R); ball.p.z = this.z + uz * (r + R);
    const rvx = ball.v.x - this.vx, rvz = ball.v.z - this.vz;
    const vn = rvx * ux + rvz * uz;
    if (vn < 0) {
      const j = (1 + 0.35) * vn;
      ball.v.x -= j * ux; ball.v.z -= j * uz;
      ball.w.scale(0.6);
      if (-vn > 1.5) game.events.push({ type: 'body', player: this.id, speed: -vn, x: ball.p.x, y: ball.p.y, z: ball.p.z });
    }
  }

  snapshot() {
    return { x: this.x, z: this.z, vx: this.vx, vz: this.vz, face: this.face, speed: this.speed, assistW: this.assistW, charging: this.charging, charge: this.charge, hand: this.hand.mode, team: this.team };
  }
}

// Starttempo, mit dem ein rollender Ball in der Zeit T die Strecke D schafft (Rasen-Rollwiderstand + Luft,
// Luftkraft beim Rollen geteilt durch 1 + k wie in ball.js). Bisektion, 12 Schritte × 16 Teilschritte.
function rollDist(P, u, T) {
  const n = 16, h = T / n, A = Math.PI * P.ballR * P.ballR;
  let v = u, x = 0;
  for (let i = 0; i < n && v > 0; i++) {
    const Re = v * 2 * P.ballR / P.nu;
    const cd = P.cdSuper + (P.cdSub - P.cdSuper) / (1 + Math.exp((Re - P.reMid) / P.reWidth));
    const a = P.turfRoll0 + P.turfRoll1 * v + 0.5 * P.rho * A * cd * v * v / (P.ballM * (1 + P.ballK));
    const v2 = Math.max(0, v - a * h);
    x += (v + v2) / 2 * h; v = v2;
  }
  return x;
}
// Pass-Tempo, mit dem ein flach gespielter Ball nach D Metern noch vArr m/s hat (Rollmodell wie oben)
export function passSpeedFor(P, D, vArr = 3.5) {
  let lo = vArr, hi = 25;
  for (let i = 0; i < 16; i++) {
    const u = (lo + hi) / 2;
    let v = u, x = 0;
    const A = Math.PI * P.ballR * P.ballR, h = 0.02;
    while (v > vArr && x < D + 1) {
      const Re = v * 2 * P.ballR / P.nu;
      const cd = P.cdSuper + (P.cdSub - P.cdSuper) / (1 + Math.exp((Re - P.reMid) / P.reWidth));
      const a = P.turfRoll0 + P.turfRoll1 * v + 0.5 * P.rho * A * cd * v * v / (P.ballM * (1 + P.ballK));
      x += v * h; v -= a * h;
    }
    if (x < D) lo = u; else hi = u;
  }
  return (lo + hi) / 2 * 1.06; // + Gleitphase direkt nach dem Kontakt
}

export function solveRollSpeed(P, D, T) {
  let lo = 0, hi = 20;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (rollDist(P, mid, T) < D) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
