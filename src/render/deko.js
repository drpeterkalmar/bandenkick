// Verschönerung (Deko, Peter 05.10.: „mehr Details und Eye Candy“, reine Optik): bündelt Umgebung (umgebung.js),
// Zuschauer (zuschauer.js) und Effekte. Läuft in der vorhandenen Spielschleife (kein eigener Takt; versteckter Tab = keine
// Bilder = alles pausiert). ?deko=0 erzeugt nichts davon.
import { buildUmgebung } from './umgebung.js';
import { spectatorBake, Zuschauer, SPOTS } from './zuschauer.js';

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
    this.timing.gesamt = performance.now() - t0;
  }
  // Spielereignisse (aus der Simulation) → Reaktionen der Zuschauer und Effekte
  onEvent(e) {
    const f = this.fans;
    if (!f) return;
    if (e.type === 'goal') { if (e.challenge) f.applause(0.8, 1.6); else f.goal(); }
    else if (e.type === 'post' && e.speed > 8) f.applause(0.55, 1.3);
    else if (e.type === 'parry') f.applause(0.4, 1.0);
    else if (e.type === 'challengeEnd') f.applause(1, 3);
    else if (e.type === 'end') f.applause(1, 5);
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
  }
}
