// Der Ball: Flug mit Luftwiderstand (Drag-Crisis), Magnus, Flatterball; Aufprall nach dem Grip-Slip-Modell
// (Cross 2002: Normal-Stoßzahl e, tangentiale Stoßzahl e_x, Reibungsgrenze μ); Gleiten/Rollen am Rasen;
// harte Bande/Pfosten, weiche Netze (Feder-Dämpfer). Fester Takt mit Unterschritten (≤ 3 cm Weg je Schritt).
import { V3 } from './v3.js';
import { reynolds, cdOf, clOf, knuckleSD, KNUCKLE_PARTS, KNUCKLE_NORM } from './aero.js';

const TAU = Math.PI * 2;
const _a = new V3(), _t = new V3(), _u = new V3(), _n = new V3(), _J = new V3(), _rc = new V3(), _d = new V3();
const _side = new V3(), _lift = new V3(), _wp = new V3(), _F = new V3(), _q = new V3();
const UP = new V3(0, 1, 0);

export class Ball {
  constructor(P) {
    this.P = P;
    this.r = P.ballR; this.m = P.ballM; this.k = P.ballK; this.I = P.ballK * P.ballM * P.ballR * P.ballR;
    this.p = new V3(0, this.r, 0);
    this.v = new V3();
    this.w = new V3();              // Winkelgeschwindigkeit rad/s
    this.q = [1, 0, 0, 0];          // Orientierung (w, x, y, z) – nur für die Grafik
    this.contact = true;            // liegt/rollt am Boden
    this.ground = 'turf';           // 'turf' | 'concrete' (Kalibrier-Test)
    this.kph = new Float64Array(8); // Flatterball-Phasen (4 Seite, 4 Auftrieb)
    this.kfr = new Float64Array(8).fill(1);
    this.net = { depth: 0, x: 0, y: 0, z: 0, tag: '', n: [0, 1, 0] }; // tiefste Netz-Eindellung (Grafik)
    this.events = null;             // Array für Ereignisse (Aufprall), von der Welt gesetzt
    this.restT = 0;
    this.netWas = false;
  }

  place(x, y, z) {
    this.p.set(x, y, z); this.v.set(0, 0, 0); this.w.set(0, 0, 0);
    this.contact = y <= this.r + 1e-6;
    if (this.contact) this.p.y = this.r;
  }

  // Neuer Schuss/Kontakt: Flatter-Phasen aus dem Seed
  reseedKnuckle(rng) {
    for (let i = 0; i < 8; i++) {
      this.kph[i] = rng.next() * TAU;
      this.kfr[i] = KNUCKLE_PARTS[i & 3][0] * (1 + 0.12 * rng.gauss());
    }
  }

  // Aerodynamische Beschleunigung + Schwerkraft → out
  aero(out, h) {
    const P = this.P, v = this.v;
    const sp = v.len();
    out.set(0, -P.g, 0);
    if (sp < 1e-6) return 0;
    // Spin-Anteil senkrecht zur Bewegung erzeugt Magnus-Kraft
    const wv = this.w.dot(v) / sp;
    _wp.copy(this.w).addScaled(v, -wv / sp);
    const wperp = _wp.len();
    const Sp = this.r * wperp / sp;
    const Re = reynolds(sp, P);
    const qA = 0.5 * P.rho * Math.PI * this.r * this.r * sp * sp; // q·A
    const cd = cdOf(Re, Sp, P);
    out.addScaled(v, -qA * cd / (this.m * sp));
    if (wperp > 1e-9) {
      const cl = clOf(Sp);
      _F.cross(_wp, v).scale(1 / (wperp * sp)); // Richtung ω × v
      out.addScaled(_F, qA * cl / this.m);
    }
    // Flatterball
    const sd = this.contact ? 0 : knuckleSD(sp, Sp, P);
    if (sd > 0) {
      _side.cross(v, UP);
      if (_side.len2() < 1e-9) _side.set(1, 0, 0);
      _side.normalize();
      _lift.cross(_side, v).normalize();
      let ns = 0, nl = 0;
      for (let i = 0; i < 4; i++) { ns += KNUCKLE_PARTS[i][1] * Math.sin(this.kph[i]); nl += KNUCKLE_PARTS[i][1] * Math.sin(this.kph[i + 4]); }
      const f = sd * KNUCKLE_NORM / this.m;
      out.addScaled(_side, f * ns).addScaled(_lift, f * nl);
    }
    // Phasen laufen mit dem Weg (f = St·v/d)
    const dph = TAU * P.knuckleSt * sp / (2 * this.r) * h;
    for (let i = 0; i < 8; i++) this.kph[i] += dph * this.kfr[i];
    return Sp;
  }

  // Ein Takt dt mit Unterschritten
  step(dt, cage) {
    const sp = this.v.len();
    let n = Math.max(1, Math.ceil(sp * dt / 0.03));
    if (this.nearNet(cage)) n = Math.max(n, 4);
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h, cage);
    this.integrateOrientation(dt);
  }

  nearNet(cage) {
    const p = this.p;
    return this.net.depth > 0 || Math.abs(p.x) > cage.hx - 1.2 || Math.abs(p.z) > cage.hz - 1.2 || p.y > cage.top - 1.2 || p.y > cage.bH;
  }

  substep(h, cage) {
    const P = this.P, v = this.v, w = this.w, p = this.p, r = this.r, m = this.m;
    const a = _a;
    this.aero(a, h);
    // Netze (weich): Kräfte zur Beschleunigung addieren
    this.netForces(a, cage, h);

    if (this.contact) {
      // --- Rollen/Gleiten am Boden ---
      if (a.y > 0.5 || v.y > 0.05) { this.contact = false; }
      else {
        const N = -m * a.y; // Normalkraft
        a.y = 0; v.y = 0;
        // horizontale Außenkraft (Luft, Netz) wirkt im Schwerpunkt
        const ux = v.x + r * w.z, uz = v.z - r * w.x; // Schlupf am Kontaktpunkt
        const us = Math.hypot(ux, uz);
        if (us > 0.02) {
          // Gleiten: Reibung μN gegen den Schlupf, höchstens bis zum reinen Rollen
          const mu = this.ground === 'concrete' ? 0.6 : P.turfMuSlide;
          let J = mu * N * h;
          const Jroll = m * us * this.k / (1 + this.k);
          if (J > Jroll) J = Jroll;
          const Fx = -J * ux / us, Fz = -J * uz / us; // Impuls
          v.x += Fx / m + a.x * h; v.z += Fz / m + a.z * h;
          // Drehimpuls: rc × J mit rc = (0, −r, 0) → (−r·Jz, 0, r·Jx)
          w.x += (-r * Fz) / this.I; w.z += (r * Fx) / this.I;
          w.y -= Math.sign(w.y) * Math.min(Math.abs(w.y), P.turfSpinY * h); // Bohrreibung (Coulomb)
        } else {
          // Rollen: Außenkraft teilt sich auf Translation und Rotation auf (a/(1+k)), dazu Rollwiderstand
          v.x += a.x * h / (1 + this.k); v.z += a.z * h / (1 + this.k);
          const s = Math.hypot(v.x, v.z);
          if (s > 1e-9) {
            const dec = (this.ground === 'concrete' ? 0.05 : P.turfRoll0 + P.turfRoll1 * s) * h;
            const f = s > dec ? (s - dec) / s : 0;
            v.x *= f; v.z *= f;
          }
          w.x = v.z / r; w.z = -v.x / r;
          w.y -= Math.sign(w.y) * Math.min(Math.abs(w.y), P.turfSpinY * h); // Bohrreibung (Coulomb)
          if (Math.hypot(v.x, v.z) < 0.01 && Math.abs(a.x) + Math.abs(a.z) < 0.3) { v.x = 0; v.z = 0; w.set(0, w.y * 0.9, 0); }
        }
        p.x += v.x * h; p.z += v.z * h; p.y = r;
      }
    }
    if (!this.contact) {
      v.addScaled(a, h);
      // Spin klingt in der Luft ab
      const sp = v.len();
      w.scale(Math.exp(-sp * h / P.spinDecayL));
      p.addScaled(v, h);
    }

    // --- harte Kontakte: Bande, Pfosten/Latte ---
    for (const R of cage.rects) if (R.kind === 'board') this.hitBoard(R);
    for (const B of cage.bars) this.hitBar(B);

    // --- Boden ---
    if (p.y < r) {
      p.y = r;
      if (!this.contact) {
        if (v.y < -P.vRest) {
          const en = this.ground === 'concrete' ? P.concreteEn : P.turfEn;
          _n.set(0, 1, 0);
          const vin = -v.y;
          this.impact(_n, en, P.turfEx, this.ground === 'concrete' ? 0.6 : P.turfMuImp);
          this.emit('ground', vin);
          if (v.y < P.vRest) { v.y = 0; this.contact = true; }
        } else {
          v.y = 0; this.contact = true;
        }
      }
    }
  }

  emit(type, speed, tag = '') {
    if (this.events && speed > 0.4) this.events.push({ type, speed, tag, x: this.p.x, y: this.p.y, z: this.p.z });
  }

  // Grip-Slip-Stoß (Cross 2002): Normal-Impuls (1+e)·m·vn, Tangential-Impuls kehrt den Schlupf um (e_x),
  // begrenzt durch μ·Jn. n = Flächennormale zum Ball hin.
  impact(n, en, ex, mu) {
    const v = this.v, w = this.w, r = this.r, m = this.m;
    const vn = v.dot(n);
    if (vn >= 0) return false;
    const Jn = m * (1 + en) * (-vn);
    // Kontaktpunkt rc = −r·n; Geschwindigkeit dort: v + ω × rc
    _rc.copy(n).scale(-r);
    _u.cross(w, _rc).add(v);
    const un = _u.dot(n);
    _t.copy(_u).addScaled(n, -un); // tangentialer Schlupf
    const ut = _t.len();
    _J.copy(n).scale(Jn);
    if (ut > 1e-9) {
      let Jt = m * (1 + ex) * ut * this.k / (1 + this.k);
      if (Jt > mu * Jn) Jt = mu * Jn;
      _J.addScaled(_t, -Jt / ut);
    }
    v.addScaled(_J, 1 / m);
    _d.cross(_rc, _J);
    w.addScaled(_d, 1 / this.I);
    return true;
  }

  // Bande: einseitiges Rechteck mit Kanten (Oberkante der Bande lenkt ab)
  hitBoard(R) {
    const P = this.P, p = this.p, r = this.r;
    const dx = p.x - R.o[0], dy = p.y - R.o[1], dz = p.z - R.o[2];
    const d = dx * R.n[0] + dy * R.n[1] + dz * R.n[2];
    if (d > r || d < -r) return;
    const a = dx * R.u[0] + dy * R.u[1] + dz * R.u[2];
    const b = dx * R.v[0] + dy * R.v[1] + dz * R.v[2];
    const ac = a < -R.hu ? -R.hu : a > R.hu ? R.hu : a;
    const bc = b < -R.hv ? -R.hv : b > R.hv ? R.hv : b;
    let pen;
    if (ac === a && bc === b) {
      _n.set(R.n[0], R.n[1], R.n[2]);
      pen = r - d;
    } else {
      if (d < 0) return; // hinter der Fläche und neben ihr: gehört nicht dazu
      const qx = R.o[0] + ac * R.u[0] + bc * R.v[0], qy = R.o[1] + ac * R.u[1] + bc * R.v[1], qz = R.o[2] + ac * R.u[2] + bc * R.v[2];
      _n.set(p.x - qx, p.y - qy, p.z - qz);
      const dist = _n.len();
      if (dist >= r || dist < 1e-9) return;
      _n.scale(1 / dist);
      pen = r - dist;
    }
    p.addScaled(_n, pen);
    const vn = this.v.dot(_n);
    if (vn < -P.vRest) {
      this.impact(_n, P.boardEn, P.boardEx, P.boardMu);
      this.emit('board', -vn, R.tag);
    } else if (vn < 0) this.v.addScaled(_n, -vn);
  }

  hitBar(B) {
    const P = this.P, p = this.p;
    const ax = B.a[0], ay = B.a[1], az = B.a[2];
    const ex = B.b[0] - ax, ey = B.b[1] - ay, ez = B.b[2] - az;
    const L2 = ex * ex + ey * ey + ez * ez;
    let t = ((p.x - ax) * ex + (p.y - ay) * ey + (p.z - az) * ez) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    _n.set(p.x - (ax + t * ex), p.y - (ay + t * ey), p.z - (az + t * ez));
    const dist = _n.len(), rr = this.r + B.r;
    if (dist >= rr || dist < 1e-9) return;
    _n.scale(1 / dist);
    p.addScaled(_n, rr - dist);
    const vn = this.v.dot(_n);
    if (vn < -P.vRest) {
      this.impact(_n, P.postEn, P.postEx, P.postMu);
      this.emit('post', -vn, B.tag);
    } else if (vn < 0) this.v.addScaled(_n, -vn);
  }

  // Netze: Feder-Dämpfer senkrecht, Haftung tangential; ab netMaxDepth hart.
  netForces(a, cage, h) {
    const P = this.P, p = this.p, v = this.v, r = this.r, m = this.m;
    const net = this.net;
    net.depth = 0;
    for (const R of cage.rects) {
      if (R.kind === 'board') continue;
      const dx = p.x - R.o[0], dy = p.y - R.o[1], dz = p.z - R.o[2];
      const d = dx * R.n[0] + dy * R.n[1] + dz * R.n[2];
      if (d >= r || d < r - P.netMaxDepth - 0.3) continue;
      const au = dx * R.u[0] + dy * R.u[1] + dz * R.u[2];
      const bv = dx * R.v[0] + dy * R.v[1] + dz * R.v[2];
      if (au < -R.hu || au > R.hu || bv < -R.hv || bv > R.hv) continue;
      const k = R.kind === 'goalnet' ? P.goalNetK : P.netK;
      const c = 2 * P.netZeta * Math.sqrt(k * m);
      let depth = r - d;
      _n.set(R.n[0], R.n[1], R.n[2]);
      const vn = v.dot(_n);
      if (depth > P.netMaxDepth) { // Sicherheitsgrenze: hart zurück
        p.addScaled(_n, depth - P.netMaxDepth);
        depth = P.netMaxDepth;
        if (vn < 0) v.addScaled(_n, -vn);
      }
      let Fn = k * depth - c * vn;
      if (Fn < 0) Fn = 0;
      a.addScaled(_n, Fn / m);
      // tangential: Netz nimmt Tempo und Spin
      _q.copy(v).addScaled(_n, -vn);
      const vt = _q.len();
      if (vt > 1e-6) {
        let Ft = c * vt;
        if (Ft > P.netMu * Fn + 0.5) Ft = P.netMu * Fn + 0.5;
        a.addScaled(_q, -Ft / (m * vt));
      }
      this.w.scale(Math.exp(-12 * h));
      if (depth > net.depth) {
        if (net.depth === 0 && !this.netWas && vn < -2) this.emit('net', -vn, R.tag); // nur beim Eintauchen
        // Mitte der Eindellung = Lot des Ballmittelpunkts auf die (unverformte) Netzebene
        const dd = r - depth;
        net.depth = depth; net.x = p.x - _n.x * dd; net.y = p.y - _n.y * dd; net.z = p.z - _n.z * dd; net.tag = R.tag; net.n = R.n;
      }
      if (this.contact && R.n[1] !== 0) this.contact = false;
    }
    this.netWas = net.depth > 0;
  }

  integrateOrientation(dt) {
    const q = this.q, w = this.w;
    const wx = w.x, wy = w.y, wz = w.z;
    const [qw, qx, qy, qz] = q;
    const hdt = 0.5 * dt;
    q[0] = qw + hdt * (-wx * qx - wy * qy - wz * qz);
    q[1] = qx + hdt * (wx * qw + wy * qz - wz * qy);
    q[2] = qy + hdt * (wy * qw + wz * qx - wx * qz);
    q[3] = qz + hdt * (wz * qw + wx * qy - wy * qx);
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    for (let i = 0; i < 4; i++) q[i] /= l;
  }

  // Zustand für Tests/Netz/Replay
  snapshot() {
    return { p: this.p.toArray(), v: this.v.toArray(), w: this.w.toArray(), contact: this.contact };
  }
}
