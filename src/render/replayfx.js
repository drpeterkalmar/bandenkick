// Effekte der Tor-Wiederholung (Nacht 2d), bewusst billig (Leistungs-Gate): Ballspur als leuchtendes Band hinter dem
// Ball (Speed-Lines, 1 Draw-Call) und Druckwellen-Ring am Ballkontakt (1 Draw-Call). Kinobalken, Vignette und Blitz macht
// das HUD per CSS. Nur sichtbar, solange die Wiederholung läuft.
// n6 Fan-Edit: breitere Ball-Leuchtspur (Kometenschweif) und Leuchten (Glow) um Ball und Schuhe des Schützen – drei
// additive Sprites, 1 Draw-Call je Sprite.
import * as THREE from 'three';

const N = 28; // Punkte der Ballspur

// weicher, heller Fleck (radial) für das Leuchten
function glowTextur() {
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.hypot((i + 0.5) / n * 2 - 1, (j + 0.5) / n * 2 - 1)), a = (1 - r) ** 2.2;
    const o = (j * n + i) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * a);
  }
  const t = new THREE.DataTexture(d, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export class ReplayFx {
  constructor(scene) {
    // Ballspur: Dreiecksband (2 Ecken je Punkt), additiv, nach hinten ausgeblendet
    this.pos = new Float32Array(N * 2 * 3);
    this.alpha = new Float32Array(N * 2);
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(1.0, 0.86, 0.35) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.trail = new THREE.Mesh(g, mat);
    this.trail.frustumCulled = false; this.trail.visible = false; this.trail.renderOrder = 5;
    // Druckwelle: Ring, wächst und verblasst
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.ring.visible = false; this.ring.renderOrder = 6;
    const gt = glowTextur();
    this.glows = [0xfff1b0, 0x3ef0ff, 0x3ef0ff].map((col) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.visible = false; sp.renderOrder = 7; scene.add(sp); return sp;
    });
    scene.add(this.trail, this.ring);
    this._v = new THREE.Vector3(); this._c = new THREE.Vector3();
  }
  hide() { this.trail.visible = false; this.ring.visible = false; for (const g of this.glows) g.visible = false; this.setTrailFarbe(null); }
  // n6: Leuchten – k = 0 (Ball) / 1, 2 (Schuhe), p = [x, y, z] oder null, size m, a Deckkraft
  setGlow(k, p, size, a) {
    const g = this.glows[k];
    if (!p || a <= 0.01) { g.visible = false; return; }
    g.position.set(p[0], p[1], p[2]); g.scale.setScalar(size); g.material.opacity = Math.min(1, a); g.visible = true;
  }
  // n6: Farbe der Spur (Kometenschweif heiß-orange), null = wie Nacht 2d
  setTrailFarbe(rgb) { this.trail.material.uniforms.color.value.setRGB(...(rgb || [1.0, 0.86, 0.35])); }
  // pts: Ballbahn (alt → neu), cam: Kamera (Band zeigt zur Kamera), strength 0…1 (je Tempo), breite m (n6 Komet: breiter)
  setTrail(pts, cam, strength, breite = 0.11) {
    if (!pts || pts.length < 2 || strength <= 0.01) { this.trail.visible = false; return; }
    const n = Math.min(N, pts.length), P = this.pos, A = this.alpha, cp = cam.position;
    for (let i = 0; i < N; i++) {
      const k = Math.min(n - 1, i), p = pts[k], q = pts[Math.min(n - 1, k + 1)], o = pts[Math.max(0, k - 1)];
      // Breite quer zu Blick und Flugrichtung
      const dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2];
      const vx = p[0] - cp.x, vy = p[1] - cp.y, vz = p[2] - cp.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
      const sl = Math.hypot(sx, sy, sz) || 1, u = k / (n - 1), w = breite * (0.15 + 0.85 * u);
      sx *= w / sl; sy *= w / sl; sz *= w / sl;
      P.set([p[0] + sx, p[1] + sy, p[2] + sz, p[0] - sx, p[1] - sy, p[2] - sz], i * 6);
      A[i * 2] = A[i * 2 + 1] = strength * u * u * 0.9;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.alpha.needsUpdate = true;
    this.trail.visible = true;
  }
  // Druckwelle am Kontaktpunkt c, senkrecht zur Schussrichtung; k = Zeit seit dem Kontakt (s Spielzeit)
  setRing(c, k) {
    if (!c || k < 0 || k > 0.3) { this.ring.visible = false; return; }
    const u = k / 0.3;
    this.ring.position.set(c.x, Math.max(0.12, c.y), c.z);
    this._v.set(c.dx || 1, 0, c.dz || 0).normalize();
    this.ring.lookAt(this._c.copy(this.ring.position).add(this._v));
    this.ring.scale.setScalar(0.15 + 1.1 * u);
    this.ring.material.opacity = 0.85 * (1 - u) * (1 - u);
    this.ring.visible = true;
  }
}
