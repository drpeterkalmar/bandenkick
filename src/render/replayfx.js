// Effekte der Tor-Wiederholung (Nacht 2d), bewusst billig (Leistungs-Gate): Ballspur als leuchtendes Band hinter dem
// Ball (Speed-Lines, 1 Draw-Call) und Druckwellen-Ring am Ballkontakt (1 Draw-Call). Kinobalken, Vignette und Blitz macht
// das HUD per CSS. Nur sichtbar, solange die Wiederholung läuft.
import * as THREE from 'three';

const N = 28; // Punkte der Ballspur

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
    scene.add(this.trail, this.ring);
    this._v = new THREE.Vector3(); this._c = new THREE.Vector3();
  }
  hide() { this.trail.visible = false; this.ring.visible = false; }
  // pts: Ballbahn (alt → neu), cam: Kamera (Band zeigt zur Kamera), strength 0…1 (je Tempo)
  setTrail(pts, cam, strength) {
    if (!pts || pts.length < 2 || strength <= 0.01) { this.trail.visible = false; return; }
    const n = Math.min(N, pts.length), P = this.pos, A = this.alpha, cp = cam.position;
    for (let i = 0; i < N; i++) {
      const k = Math.min(n - 1, i), p = pts[k], q = pts[Math.min(n - 1, k + 1)], o = pts[Math.max(0, k - 1)];
      // Breite quer zu Blick und Flugrichtung
      const dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2];
      const vx = p[0] - cp.x, vy = p[1] - cp.y, vz = p[2] - cp.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
      const sl = Math.hypot(sx, sy, sz) || 1, u = k / (n - 1), w = 0.11 * (0.15 + 0.85 * u);
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
