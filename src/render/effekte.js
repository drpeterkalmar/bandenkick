// Verschönerung „Effekte“ (Deko, Peter 05.10.): Konfetti bei Toren und Trainingserfolgen, Ballspur bei harten Schüssen,
// Rutschspuren nach Grätschen/Hechtsprüngen, Blitzlichter in der Menge. Alles Pools ohne Speicher-Neuanlage im Spiel:
// Konfetti und Blitze rechnet der Vertex-Shader aus Startwerten und Zeit (kein CPU-Aufwand je Bild), Spur und Rutschspuren
// schreiben feste Puffer. Jedes Teil ist 1 Draw-Call und nur sichtbar, solange es etwas zu zeigen gibt.
import * as THREE from 'three';
import { mulberry32 } from './stimmung.js';

const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

// ---------------- Konfetti ----------------
// Papierschnipsel (9 × 6 cm, im Spielbild sonst unsichtbar klein): Start, Geschwindigkeit, Geburtszeit und Drehung je
// Instanz; Flugbahn mit Luftbremse (k), Sinkgeschwindigkeit, Flattern; am Boden flach liegen, nach `life` s schrumpfen.
// opts: w/h Größe (m), k Luftbremse, vt Sinkgeschwindigkeit, flut Flattern (m), life (s) – Standard = Papier-Konfetti;
// Rasenfetzen (Grätsche/Hechtsprung) nutzen dieselbe Technik mit kleinen, schweren Teilen
export class Konfetti {
  constructor(n = 640, opts = {}) {
    const o = { w: 0.11, h: 0.07, k: 1.15, vt: 0.7, flut: 0.12, life: 9, ...opts };
    this.n = n; this.next = 0; this.t = 0; this.alive = 0;
    const base = new THREE.PlaneGeometry(o.w, o.h);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    this.o = new Float32Array(n * 4); this.v = new Float32Array(n * 3); this.s = new Float32Array(n * 4); this.c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.o[i * 4 + 3] = -999; // Geburt: nie
    this.ao = new THREE.InstancedBufferAttribute(this.o, 4).setUsage(THREE.DynamicDrawUsage);
    this.av = new THREE.InstancedBufferAttribute(this.v, 3).setUsage(THREE.DynamicDrawUsage);
    this.as = new THREE.InstancedBufferAttribute(this.s, 4).setUsage(THREE.DynamicDrawUsage);
    this.ac = new THREE.InstancedBufferAttribute(this.c, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aO', this.ao); g.setAttribute('aV', this.av); g.setAttribute('aS', this.as); g.setAttribute('aC', this.ac);
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    const u = Object.assign(fogU(), { uT: { value: 0 }, uLife: { value: o.life }, uL: { value: new THREE.Vector3(0.3, 0.85, 0.42).normalize() },
      uK: { value: o.k }, uVt: { value: o.vt }, uFlut: { value: o.flut } });
    this.mat = new THREE.ShaderMaterial({
      uniforms: u, fog: true, side: THREE.DoubleSide,
      vertexShader: `attribute vec4 aO; attribute vec3 aV; attribute vec4 aS; attribute vec3 aC;
        uniform float uT, uLife, uK, uVt, uFlut; uniform vec3 uL; varying vec3 vC; varying float vLit;
        #include <fog_pars_vertex>
        mat3 rotAxis(vec3 a, float r) { float s = sin(r), c = cos(r), o = 1.0 - c;
          return mat3(o*a.x*a.x + c, o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s, o*a.x*a.y - a.z*s, o*a.y*a.y + c, o*a.y*a.z + a.x*s, o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c); }
        void main() {
          float age = uT - aO.w;
          if (age < 0.0 || age > uLife + 0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float k = uK * (1.0 + 0.6 * aS.w), e = 1.0 - exp(-k * age), vt = uVt * (1.0 + 0.7 * aS.w);
          vec3 p = aO.xyz + vec3(aV.x, 0.0, aV.z) * (e / k);
          p.y += (aV.y + vt) * e / k - vt * age;
          float fl = smoothstep(0.0, 0.4, p.y) * e;
          p.x += sin(age * (3.0 + 3.0 * aS.w) + aS.z * 6.28) * uFlut * fl;
          p.z += cos(age * (2.5 + 2.0 * aS.w) + aS.z * 4.0) * uFlut * fl;
          float ground = 1.0 - smoothstep(0.004, 0.05, p.y);
          p.y = max(p.y, 0.006 + aS.z * 0.004);
          vec3 axis = normalize(aS.xyz - 0.5 + vec3(0.001));
          mat3 R = rotAxis(axis, age * (6.0 + 9.0 * aS.w) + aS.x * 6.28);
          mat3 flatM = mat3(1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0) * rotAxis(vec3(0.0, 0.0, 1.0), aS.y * 6.28);
          float sc = 1.0 - smoothstep(uLife, uLife + 0.6, age);
          vec3 q = (ground > 0.5 ? flatM : R) * (position * sc);
          vec3 n = (ground > 0.5 ? flatM : R) * vec3(0.0, 0.0, 1.0);
          vLit = 0.5 + 0.5 * abs(dot(n, uL)) + 0.6 * pow(abs(dot(n, normalize(vec3(0.0, 1.0, 0.6)))), 24.0);
          vC = aC;
          vec4 mvPosition = viewMatrix * vec4(p + q, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `varying vec3 vC; varying float vLit;
        #include <fog_pars_fragment>
        void main() { gl_FragColor = vec4(vC * vLit, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'konfetti'; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.rnd = mulberry32(777);
  }
  // count Schnipsel ab (x, y, z) mit Grundgeschwindigkeit (vx, vy, vz) und Streuung spread (m/s); colors: Liste THREE.Color
  burst(x, y, z, vx, vy, vz, count, spread, colors, posJitter = 0.15) {
    const r = this.rnd;
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.n;
      this.o.set([x + (r() - 0.5) * posJitter, y + (r() - 0.5) * posJitter, z + (r() - 0.5) * posJitter, this.t + r() * 0.08], i * 4);
      this.v.set([vx + (r() - 0.5) * 2 * spread, vy + (r() - 0.3) * spread, vz + (r() - 0.5) * 2 * spread], i * 3);
      this.s.set([r(), r(), r(), r()], i * 4);
      const c = colors[Math.floor(r() * colors.length)];
      this.c.set([c.r, c.g, c.b], i * 3);
    }
    for (const a of [this.ao, this.av, this.as, this.ac]) a.needsUpdate = true;
    this.alive = this.t + this.mat.uniforms.uLife.value + 0.8;
    this.mesh.visible = true;
  }
  clear() { this.alive = 0; this.mesh.visible = false; }
  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt; this.mat.uniforms.uT.value = this.t;
    if (this.t > this.alive) this.mesh.visible = false;
  }
}

// ---------------- Ballspur (live, harte Schüsse) ----------------
// Band hinter dem Ball, additiv, zur Kamera gedreht; Stärke wächst mit dem Tempo. Die Punkte werden aus Position und
// Geschwindigkeit zurückgerechnet (mit Schwerkraft) – unabhängig von der Bildrate; nach jedem Kontakt (Schuss, Bande,
// Pfosten …) beginnt die Spur neu, damit sie nie durch Bande oder Netz zeigt.
const NT = 16, TAU = 0.13;
export class BallSpur {
  constructor() {
    this.pos = new Float32Array(NT * 2 * 3); this.alpha = new Float32Array(NT * 2); this.since = 0;
    const idx = []; for (let i = 0; i < NT - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(1.0, 0.93, 0.7) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'ballspur'; this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 4;
  }
  reset() { this.since = 0; this.mesh.visible = false; }
  contact() { this.since = 0; }
  // je Bild: Ball (Position p, Geschwindigkeit v), Kamera; on = Spielansicht ohne Wiederholung; still = angehalten
  update(dt, p, v, cam, on, still = false) {
    if (!on) { this.reset(); return; }
    if (!still) this.since += dt; // angehalten (Pause, Test): Spur bleibt am Ball, Zeit steht
    const speed = Math.hypot(v.x, v.y, v.z), k = Math.max(0, Math.min(1, (speed - 17) / 12)), tau = Math.min(TAU, this.since);
    if (k <= 0.01 || tau < 0.02) { this.mesh.visible = false; return; }
    const P = this.pos, A = this.alpha, cp = cam.position;
    for (let s = 0; s < NT; s++) {
      const u = s / (NT - 1), t = tau * u; // s = 0: am Ball, s = NT − 1: ältester Punkt
      const x = p.x - v.x * t, y = Math.max(0.11, p.y - v.y * t - 4.905 * t * t), z = p.z - v.z * t;
      // Breite quer zu Blick und Flugrichtung
      const dx = v.x, dy = v.y + 9.81 * t, dz = v.z, vx = x - cp.x, vy = y - cp.y, vz = z - cp.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
      const sl = Math.hypot(sx, sy, sz) || 1, w = 0.1 * (1 - 0.8 * u);
      sx *= w / sl; sy *= w / sl; sz *= w / sl;
      P[s * 6] = x + sx; P[s * 6 + 1] = y + sy; P[s * 6 + 2] = z + sz; P[s * 6 + 3] = x - sx; P[s * 6 + 4] = y - sy; P[s * 6 + 5] = z - sz;
      A[s * 2] = A[s * 2 + 1] = k * (1 - u) * (1 - u) * 0.75;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
    this.mesh.visible = true;
  }
}

// ---------------- Rutschspuren (Grätsche, Hechtsprung) ----------------
// Dunkle, weiche Streifen auf dem Rasen (Fasern platt, Granulat freigelegt), wachsen beim Rutschen, verblassen nach ~10 s.
const NM = 10;
let _markTex = null;
function markTexture() {
  if (_markTex) return _markTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d'), img = g.createImageData(128, 32), rnd = mulberry32(5);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, v = (y / 31) * 2 - 1;
    const a = Math.exp(-v * v * 3.2) * Math.min(1, u * 8) * (1 - Math.pow(u, 6)) * (0.75 + 0.25 * rnd());
    const o = (y * 128 + x) * 4; img.data[o] = 18; img.data[o + 1] = 26; img.data[o + 2] = 14; img.data[o + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  _markTex = new THREE.CanvasTexture(c);
  return _markTex;
}
export class Rutschspuren {
  constructor() {
    const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    // Farbe fest (dunkles Grün), Textur liefert die Form, Instanzfarbe (rot) = Deckkraft zum Ausblenden
    const mat = new THREE.MeshBasicMaterial({ color: 0x0c140a, map: markTexture(), transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#ifdef USE_INSTANCING_COLOR\n diffuseColor.a *= vColor.r;\n#endif'); };
    mat.customProgramCacheKey = () => 'rutschspur';
    this.mesh = new THREE.InstancedMesh(base, mat, NM);
    this.mesh.name = 'rutschspuren'; this.mesh.renderOrder = 1; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NM * 3).fill(0), 3);
    this.m = []; for (let i = 0; i < NM; i++) this.m.push({ on: false, x: 0, z: 0, a: 0, len: 0, w: 0.5, age: 0, grow: 0 });
    this.next = 0; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
  }
  // neue Spur bei (x, z) in Richtung (dx, dz); wächst bis len (m) über grow (s)
  add(x, z, dx, dz, len, w, grow) {
    const k = this.m[this.next]; this.next = (this.next + 1) % NM;
    Object.assign(k, { on: true, x, z, a: Math.atan2(dz, dx), len, w, age: 0, grow });
    this.mesh.visible = true;
  }
  update(dt) {
    if (!this.mesh.visible) return;
    let any = false;
    for (let i = 0; i < NM; i++) {
      const k = this.m[i];
      if (k.on) { k.age += dt; if (k.age > 11) k.on = false; }
      const f = k.on ? Math.min(1, k.age / Math.max(0.05, k.grow)) : 0, fade = k.on ? Math.min(1, (11 - k.age) / 3) : 0;
      any = any || k.on;
      this._p.set(k.x, 0.004, k.z); this._q.setFromAxisAngle(this._s.set(0, 1, 0), -k.a); this._s.set(Math.max(0.01, k.len * f), 1, k.w);
      this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.setScalar(fade));
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    if (!any) this.mesh.visible = false;
  }
}

// ---------------- Blitzlichter in der Menge ----------------
// kleine Lichtpunkte vor den Köpfen der Zuschauer, blitzen beim Jubel zufällig kurz auf (Handykameras). Zeit im Shader.
export class Blitzlichter {
  constructor(spots) {
    const n = spots.length, pos = new Float32Array(n * 3), ph = new Float32Array(n), rnd = mulberry32(2024);
    spots.forEach((s, i) => {
      const l = Math.hypot(s.x, s.z) || 1;
      pos.set([s.x - s.x / l * 0.25 + (rnd() - 0.5) * 0.2, (s.kid ? 1.0 : 1.45) + rnd() * 0.15, s.z - s.z / l * 0.25 + (rnd() - 0.5) * 0.2], i * 3);
      ph[i] = rnd() * 100;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uEx: { value: 0 }, uScale: { value: 300 } },
      vertexShader: `attribute float ph; uniform float uT, uEx, uScale; varying float vF;
        void main() {
          float slot = floor(uT * 9.0 + ph);
          float h = fract(sin(slot * 12.9898 + ph * 78.233) * 43758.5453);
          vF = step(1.0 - 0.045 * uEx, h);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = vF > 0.5 ? uScale * 0.55 / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vF;
        void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = (exp(-r * r * 60.0) + 0.35 * exp(-r * r * 9.0)) * vF;
          if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.name = 'blitzlichter'; this.points.frustumCulled = false; this.points.visible = false;
    this.t = 0;
  }
  // ex: Aufregung 0…1 (Zuschauer), pxScale: Pixel je Meter in 1 m Abstand (Bildhöhe / (2·tan(fov/2)))
  update(dt, ex, pxScale) {
    this.t += dt;
    this.points.visible = ex > 0.05;
    if (!this.points.visible) return;
    this.mat.uniforms.uT.value = this.t; this.mat.uniforms.uEx.value = ex; this.mat.uniforms.uScale.value = pxScale;
  }
}
