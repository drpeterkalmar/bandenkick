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
      const H = 8.6 + (hz - 6.5) * 0.8;
      const fit = this.fit(H, hz + 0.45 + this.tz, -hz - 2.2 + this.tz);
      c.position.set(this.tx, H, fit.zc);
      c.lookAt(this.tx, 0, fit.zc - H / Math.tan(fit.beta));
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
      const D = 17.5, pitch = 56 * Math.PI / 180, lead = 2.6;
      c.position.set(this.tx - lead - Math.cos(pitch) * D, Math.sin(pitch) * D, this.tz * 0.85);
      c.lookAt(this.tx - lead, 0, this.tz);
    }
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
