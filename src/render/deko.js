// Verschönerung (Deko, Peter 05.10.: „mehr Details und Eye Candy“, reine Optik): bündelt Umgebung (umgebung.js),
// Zuschauer (zuschauer.js) und Effekte. Läuft in der vorhandenen Spielschleife (kein eigener Takt; versteckter Tab = keine
// Bilder = alles pausiert). ?deko=0 erzeugt nichts davon.
import { buildUmgebung } from './umgebung.js';
import * as THREE from 'three';
import { spectatorBake, Zuschauer, SPOTS } from './zuschauer.js';
import { Konfetti, BallSpur, Rutschspuren, Blitzlichter } from './effekte.js';

const C = (hex) => new THREE.Color(hex);
const TEAM = [[C(0xff6a13), C(0xff9a3c)], [C(0x1f6fff), C(0x5d9bff)]];
const WHITE = C(0xf4f4f0), GOLD = C(0xffd84a);
const TURF = [C(0x0d0d0c), C(0x2f6a22), C(0x5f9a3a)]; // Gummigranulat, Faser dunkel, Faser hell

export class Deko {
  constructor({ scene, renderer, field, sunDir, quality, A, reduceMotion }) {
    this.scene = scene; this.quality = quality; this.reduce = !!reduceMotion; this.t = 0;
    const t0 = performance.now(); this.timing = {};
    const aa = !!quality.aa;
    this.env = buildUmgebung({ aa, sunDir, spots: SPOTS });
    scene.add(this.env.group);
    this.timing.umgebung = performance.now() - t0;
    // Außenboden: Betonsockel, Wege und Schatten aus der Detail-Textur
    const gu = field.outer.material.userData.u;
    if (gu) { gu.uDetail.value = this.env.detail.tex; gu.uDetailBox.value.copy(this.env.detail.box); gu.uDetailOn.value = 1; }
    // Zuschauer: Atlas erst nach den ersten Bildern (der Start wartet nicht darauf), dann sanft einblenden
    this.fans = null; this._A = A; this._fanJob = A ? { renderer, aa, frames: 0, state: 'wait' } : null;
    // Effekte (Etappe 3): Konfetti, Ballspur, Rutschspuren, Blitzlichter; Mengen nach Qualität und reduzierter Bewegung
    this.amount = (quality.level >= 1 ? 1 : 0.6) * (this.reduce ? 0.3 : 1);
    this.konfetti = new Konfetti(640); this.spur = new BallSpur(); this.spuren = new Rutschspuren(); this.blitze = new Blitzlichter(SPOTS);
    // Rasenfetzen: Gummigranulat (schwarz) und Faserstücke (grün), klein und schwer, nach 1,6 s weg
    this.fetzen = new Konfetti(240, { w: 0.045, h: 0.03, k: 3.2, vt: 3.5, flut: 0.0, life: 1.6 });
    scene.add(this.konfetti.mesh, this.spur.mesh, this.spuren.mesh, this.blitze.points, this.fetzen.mesh);
    this.gran = null; this.prevSlide = []; this.prevHand = []; this.slideTick = 0; this.paused = false;
    this.renderer = renderer;
    this.timing.gesamt = performance.now() - t0;
  }
  // Spielereignisse (aus der Simulation) → Reaktionen der Zuschauer und Effekte; game für Ball/Käfig
  onEvent(e, game) {
    const f = this.fans;
    if (e.type === 'kick' || e.type === 'board' || e.type === 'post' || e.type === 'net' || e.type === 'body' || e.type === 'parry'
      || e.type === 'touch' || e.type === 'control' || e.type === 'catch' || e.type === 'ground' || e.type === 'goal') this.spur.contact();
    if (e.type === 'goal' && !e.challenge && game) this.goalConfetti(e, game);
    if (e.type === 'challenge' && e.ok && game) this.puff(game.ball.p.x, Math.max(0.3, game.ball.p.y), game.ball.p.z, 0);
    if (!f) return;
    if (e.type === 'goal') { if (e.challenge) f.applause(0.8, 1.6); else f.goal(); }
    else if (e.type === 'post' && e.speed > 8) f.applause(0.55, 1.3);
    else if (e.type === 'parry') f.applause(0.4, 1.0);
    else if (e.type === 'challengeEnd') f.applause(1, 3);
    else if (e.type === 'end') f.applause(1, 5);
  }
  // Tor: zwei Konfetti-Kanonen hinter dem Tor (schießen über das Tor ins Feld) und ein Regen über dem Torraum
  goalConfetti(e, game) {
    const s = e.side > 0 ? 1 : -1, hx = game.cage.hx, a = this.amount, team = TEAM[e.team] || TEAM[0];
    const cols = [team[0], team[0], team[1], WHITE, GOLD];
    for (const z of [-2.4, 2.4]) this.konfetti.burst(s * (hx + 1.4), 0.5, z, -s * 6.5, 7.5, -Math.sign(z) * 1.6, Math.round(150 * a), 2.4, cols);
    this.konfetti.burst(s * (hx - 3.2), 5.0, 0, -s * 0.4, 0.3, 0, Math.round(80 * a), 1.0, cols, 5.5);
  }
  // kleiner Erfolg (Training): Schnipsel am Ball
  puff(x, y, z, team) {
    const t = TEAM[team] || TEAM[0];
    this.konfetti.burst(x, y, z, 0, 3.2, 0, Math.round(45 * this.amount), 1.8, [t[0], WHITE, GOLD, GOLD]);
  }
  // Ergebnis mit Sternen (Training): Konfetti vor der Kamera (im nächsten Bild, wenn die Menü-Kamera fährt), je mehr Sterne,
  // desto mehr
  celebrate(stars) { if (stars) this.pendingStars = stars; }
  _celebrateNow(cam) {
    const stars = this.pendingStars; this.pendingStars = 0;
    const d = new THREE.Vector3(); cam.getWorldDirection(d);
    const x = cam.position.x + d.x * 6, z = cam.position.z + d.z * 6, y = cam.position.y + 3.2;
    this.konfetti.burst(x, y, z, 0, 0.8, 0, Math.round((90 + 70 * stars) * this.amount), 1.4, [TEAM[0][0], TEAM[1][0], WHITE, GOLD, GOLD], 6);
  }
  // Wiederholung: Konfetti hält an und ist unsichtbar (es fliegt nach dem Tor, nicht im Rückblick)
  replay(on) { this.paused = on; this.konfetti.mesh.visible = !on && this.konfetti.t < this.konfetti.alive; if (on) this.spur.reset(); }
  // Rasenfetzen: n Teile ab (x, z) in Richtung (dx, dz) mit Tempo v
  spray(x, z, dx, dz, n, v) {
    const l = Math.hypot(dx, dz) || 1, cols = [TURF[0], TURF[0], TURF[1], TURF[2]];
    this.fetzen.burst(x, 0.06, z, dx / l * v, 2.6 + v * 0.25, dz / l * v, Math.max(3, Math.round(n * this.amount)), 1.3, cols, 0.25);
  }
  // Grätschen und Hechtsprünge: Rasenfetzen (Granulat + Fasern) und Rutschspur
  watchPlayers(game) {
    this.slideTick++;
    game.players.forEach((p, i) => {
      const sl = p.slide && p.slide.phase === 'slide' ? p.slide : null, was = this.prevSlide[i];
      if (sl && !was) {
        const l = Math.hypot(sl.dx, sl.dz) || 1;
        this.spuren.add(p.x - sl.dx / l * 0.2, p.z - sl.dz / l * 0.2, sl.dx, sl.dz, 2.2, 0.5, 0.5);
        this.spray(p.x + sl.dx / l * 0.5, p.z + sl.dz / l * 0.5, sl.dx, sl.dz, 34, 3.2);
      } else if (sl && this.slideTick % 3 === 0) {
        const l = Math.hypot(sl.dx, sl.dz) || 1;
        this.spray(p.x + sl.dx / l * 0.7, p.z + sl.dz / l * 0.7, sl.dx, sl.dz, 7, 2.6);
      }
      this.prevSlide[i] = !!sl;
      const hm = p.hand ? p.hand.mode : 'none';
      if (hm === 'ground' && this.prevHand[i] === 'dive') {
        const dx = p.hand.dx || 0, dz = p.hand.dz || 0, l = Math.hypot(dx, dz) || 1;
        this.spuren.add(p.x - dx / l * 0.6, p.z - dz / l * 0.6, dx, dz, 1.3, 0.75, 0.15);
        this.spray(p.x, p.z, dx, dz, 30, 2.4);
      }
      this.prevHand[i] = hm;
    });
  }
  // Tests/Fotos: Atlanten als Bild (Bäume, Zuschauer, Boden-Details)
  debugImages(renderer) {
    const out = { baeume: this.env.treeCanvas.toDataURL('image/png'), boden: this.env.detail.canvas.toDataURL('image/png') };
    if (this.atlas) {
      const { rt, W, H } = this.atlas, px = new Uint8Array(W * H * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'), img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0); out.fans = c.toDataURL('image/png');
    }
    return out;
  }
  // Auto-Drosselung (main.js autoQuality): weniger Konfetti und Rasenfetzen, keine Blitzlichter
  setLite() { this.lite = true; this.amount = Math.min(this.amount, 0.35); this.blitzeOff = true; }
  // fertig: Zuschauer gerendert und ganz eingeblendet (Tests warten darauf)
  get ready() { return !this._fanJob && (!this.fans || this.fans.mat.uniforms.uAppear.value >= 1); }
  _stepFans() {
    const j = this._fanJob;
    if (j.state === 'wait' && ++j.frames >= 3) {
      const t0 = performance.now();
      j.bake = spectatorBake(this._A, j.renderer, this.scene);
      j.state = 'compile';
      j.bake.prepare().then(() => { j.state = 'render'; j.c = 0; });
      this.timing.zuschauerStart = performance.now() - t0;
    } else if (j.state === 'render') {
      // eine Pose je Bild (kein langer Einzelschritt), danach Zuschauer einblenden
      const t0 = performance.now();
      j.bake.pose(j.c++);
      this.timing.zuschauerBild = Math.max(this.timing.zuschauerBild || 0, performance.now() - t0);
      if (j.c >= j.bake.count) {
        this.atlas = j.bake.finish();
        this.fans = new Zuschauer(this.atlas, { aa: j.aa, calm: this.reduce });
        this.scene.add(this.fans.mesh);
        this._fanJob = null;
      }
    }
  }
  // ctx.inGame: Spielkamera im Spiel/Pause (keine Wiederholung, keine Test-Kamera); ctx.hoch: Hochformat-Kamera
  update(dt, ctx = {}) {
    if (this._fanJob) this._stepFans();
    this.t += dt;
    this.env.update(dt, this.t, !!ctx.inGame, !!ctx.hoch);
    if (this.fans) this.fans.update(dt, ctx.inGame && ctx.hoch ? -13 : -1e4);
    if (this.pendingStars && ctx.cam && !ctx.live) this._celebrateNow(ctx.cam);
    if (!this.paused && !ctx.paused) { this.konfetti.update(dt); this.fetzen.update(dt); }
    this.spuren.update(dt);
    if (ctx.game && ctx.live) this.watchPlayers(ctx.game);
    const b = ctx.ball;
    if (b && ctx.cam) this.spur.update(dt, b.p, b.v, ctx.cam, !!ctx.live && !this.paused, !!ctx.still);
    if (ctx.cam) {
      const h = this.renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y;
      this.blitze.update(dt, this.fans && !this.blitzeOff ? Math.min(1, this.fans.ex * 1.4) : 0, h / (2 * Math.tan(ctx.cam.fov * Math.PI / 360)));
    }
  }
}
