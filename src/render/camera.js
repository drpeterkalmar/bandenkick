// Kameras je Format: quer = Tribünenblick von der Längsseite (Tore links/rechts), hoch = hinter dem
// linken Tor mit Blick über das Feld (Tore unten/oben). Folgt Ball und Spieler weich; Menü: langsamer Rundflug.
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class GameCamera {
  constructor(aspect, cage) {
    this.cam = new THREE.PerspectiveCamera(44, aspect, 0.1, 1200);
    this.cage = cage;
    this.mode = aspect < 0.95 ? 'hoch' : 'quer';
    this.tx = 0; this.tz = 0;   // geglätteter Blickpunkt
    this.menuT = 0;
    this.override = null;       // Test/Debug: feste Kamera
    this.shake = 0;
    this.zoom = 0;              // 0…1 Kurz-Zoom (Zeitlupe bei spektakulären Luftbällen)
    this.fokus = null;          // n6 Action-Moment: { p: [x, y, z], k: 0…1 } – Zoom-Punch: Kamera fährt auf die Szene zu
    this.baseFov = 44;
  }

  setAspect(aspect, force) {
    this.cam.aspect = aspect;
    const m = force || (aspect < 0.95 ? 'hoch' : 'quer');
    this.mode = m;
    this.cam.fov = this.baseFov = m === 'hoch' ? 56 : aspect > 1.9 ? 40 : 46;
    this.cam.updateProjectionMatrix();
  }

  // Neigung β und Kamera-z so, dass die Strahlen am unteren/oberen Bildrand den Boden bei zNear/zFar treffen
  fit(H, zNear, zFar) {
    const a = this.cam.fov * Math.PI / 360, span = zNear - zFar;
    let lo = a + 0.02, hi = Math.PI / 2 - 0.02;
    const f = (b) => H / Math.tan(b - a) - H / Math.tan(b + a) - span;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    const beta = (lo + hi) / 2;
    return { beta, zc: zNear + H / Math.tan(beta + a) };
  }

  // Bodenachsen für den Stick: rechts und vorwärts (Bildschirm oben) in Weltkoordinaten
  groundAxes() {
    const e = this.cam.matrixWorld.elements;
    let rx = e[0], rz = e[2];
    let fx = -e[8], fz = -e[10];
    const lr = Math.hypot(rx, rz) || 1, lf = Math.hypot(fx, fz) || 1;
    return { rx: rx / lr, rz: rz / lr, fx: fx / lf, fz: fz / lf };
  }

  update(dt, ball, player, state) {
    const c = this.cam, cage = this.cage;
    if (this.override) {
      c.position.set(...this.override.pos); c.lookAt(...this.override.look); c.updateMatrixWorld();
      return;
    }
    if (state === 'menu') {
      this.menuT += dt;
      const a = -0.6 + this.menuT * 0.06;
      const R = Math.max(cage.hx, cage.hz) + 11;
      c.position.set(Math.cos(a) * R, 3.2, Math.sin(a) * R);
      c.lookAt(0, 1.6, 0);
      c.updateMatrixWorld();
      return;
    }
    // Blickpunkt: Mischung aus Ball und Spieler, Ball etwas vorausgesagt
    const bx = ball.x + ball.vx * 0.25, bz = ball.z + ball.vz * 0.25;
    let gx = 0.7 * bx + 0.3 * player.x, gz = 0.7 * bz + 0.3 * player.z;
    const k = 3.2;
    if (this.mode === 'quer') {
      const hx = cage.hx, hz = cage.hz;
      const lim = Math.max(0, hx + cage.gD - 7.0);
      gx = Math.max(-lim, Math.min(lim, gx));
      this.tx = damp(this.tx, gx, k, dt);
      this.tz = damp(this.tz, Math.max(-1.5, Math.min(1.5, gz * 0.2)), k, dt);
      // Zwei-Strahlen-Einpassung: unterer Bildrand trifft den Boden knapp vor der nahen Bande,
      // oberer Rand knapp hinter der fernen Bande (Netz sichtbar). Höhe fest, Neigung/Abstand gerechnet.
      // Nacht 2c (Feld 24 × 15): mit dem breiteren Feld etwas höher und weiter weg → Figuren ≈ 17 % kleiner im Bild,
      // bei 20 × 13 wie bisher
      const ex = Math.max(0, hz - 6.5);
      const H = 8.6 + ex * 1.3;
      const fit = this.fit(H, hz + 0.45 + ex * 0.2 + this.tz, -hz - 2.2 - ex * 0.9 + this.tz);
      c.position.set(this.tx, H, fit.zc);
      this._l = [this.tx, 0, fit.zc - H / Math.tan(fit.beta)];
    } else {
      const hx = cage.hx, hz = cage.hz;
      const limX = Math.max(0, hx - 3.2), limZ = Math.max(0, hz - 4.6);
      // Spieler nie tiefer als 3 m unter dem Blickpunkt (unten rechts liegen die Knöpfe)
      gx = Math.min(gx, player.x + 3.0);
      gx = Math.max(-limX, Math.min(limX, gx));
      gz = Math.max(-limZ, Math.min(limZ, gz));
      this.tx = damp(this.tx, gx, k, dt);
      this.tz = damp(this.tz, gz, k * 0.8, dt);
      // Blickpunkt 2,6 m vor dem Geschehen → Ball/Spieler sitzen im oberen Bilddrittel, frei von den Knöpfen unten
      // Nacht 2c: Abstand wächst mit der Feldbreite (24 × 15: × 1,2 → Figuren ≈ 17 % kleiner; 20 × 13 wie bisher)
      const D = 17.5 * (1 + 0.2 * Math.max(0, hz - 6.5)), pitch = 56 * Math.PI / 180, lead = 2.6;
      c.position.set(this.tx - lead - Math.cos(pitch) * D, Math.sin(pitch) * D, this.tz * 0.85);
      this._l = [this.tx - lead, 0, this.tz];
    }
    // n6 Zoom-Punch: Kamera fährt aus ihrer Richtung tief an die Szene heran (≈ 5 m, 2,4 m hoch), Blick auf den Fokus
    const F = this.fokus, l = this._l;
    if (F && F.k > 0.001) {
      const k = Math.min(1, F.k), p = F.p;
      let dx = c.position.x - p[0], dz = c.position.z - p[2]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      // Richtung der Szene (quer zum Schuss / vor dem Torwart), auf der Seite der Spielkamera
      // (Torwart: immer vom Feld her, nie von hinter dem Tor)
      if (F.dir) {
        let ex = F.dir[0], ez = F.dir[1]; if (!F.nah && ex * dx + ez * dz < 0) { ex = -ex; ez = -ez; }
        if (F.vor) { ex += 0.4 * F.vor[0]; ez += 0.4 * F.vor[1]; } // Schuss: seitlich leicht von vorn (Gesicht, Fuß und Ball; der Ball fliegt nicht sofort auf die Kamera zu)
        const el = Math.hypot(ex, ez) || 1; dx = ex / el; dz = ez / el;
      }
      // langsame Fahrt heran und leichtes Kreisen während der Zeitlupe
      const dr = F.drift || 0, a = 0.3 * dr, ca = Math.cos(a), sa = Math.sin(a), rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
      const D = (F.nah ? 3.8 - 0.6 * dr : 4.5 - 1.0 * dr) * (this.mode === 'hoch' ? 1 : 0.85), cage = this.cage;
      const zx = Math.max(-cage.hx - 1, Math.min(cage.hx + 1, p[0] + rx * D)), zy = Math.max(1.1, p[1] + (F.nah ? 0.6 : 0.9)), zz = Math.max(-cage.hz + 0.3, Math.min(cage.hz - 0.3, p[2] + rz * D));
      c.position.x += (zx - c.position.x) * k; c.position.y += (zy - c.position.y) * k; c.position.z += (zz - c.position.z) * k;
      // Hochformat: Szene etwas nach oben links (unten rechts liegen die Knöpfe)
      // Blick zwischen Szene und Ball (der Ball bleibt im Bild); Torwart: ganze Figur (Kopf nicht anschneiden)
      const hy = this.mode === 'hoch' && !F.nah ? -0.35 : 0, hs = this.mode === 'hoch' ? 0.4 : 0, bw = F.ball && !F.nah && !F.mitte ? 0.55 : 0;
      const px = p[0] + (F.ball ? (F.ball[0] - p[0]) * bw : 0), pz = p[2] + (F.ball ? (F.ball[2] - p[2]) * bw : 0);
      l[0] += (px - rz * hs - l[0]) * k; l[1] += (p[1] + hy - l[1]) * k; l[2] += (pz + rx * hs - l[2]) * k;
    }
    c.lookAt(l[0], l[1], l[2]);
    const fov = this.baseFov * (1 - 0.16 * this.zoom);
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.05;
      c.position.x += (Math.random() - 0.5) * s; c.position.y += (Math.random() - 0.5) * s;
    }
    c.updateMatrixWorld();
  }
}
