// Verschönerung „Abend“ (Deko, Peter 05.10.): Flutlicht-Stimmung. Dämmerungshimmel (stimmung.js), eigenes Umgebungslicht
// aus einer kleinen gerechneten Panorama-Textur (dunkler Himmel, vier helle Strahler-Gruppen, Abglanz des beleuchteten
// Rasens) → Glanzlichter und Aufhellung von allen vier Ecken ohne zusätzliche Lichtquellen; Lichtkegel und Leuchtpunkte an
// den Strahlern (nur Menü und Wiederholung), Lichtfeld auf dem Kunstrasen, je Spieler vier lange, weiche Flutlicht-
// Schatten (1 Draw-Call für alle statt sechs runden Flecken).
import * as THREE from 'three';
import { figureShadowTexture, figureShadowGeometry } from './stimmung.js';

export const MAST_H = 16.3;

// Umgebungslicht Abend: Panorama 128 × 64 (three.js-Equirect: u = atan(z, x)/2π + 0,5, v = asin(y)/π + 0,5) → PMREM
export function nightEnvironment(renderer, masts) {
  const W = 128, H = 64, data = new Float32Array(W * H * 4);
  const L = masts.map(([x, z]) => new THREE.Vector3(x, MAST_H - 1.5, z).normalize());
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const phi = ((i + 0.5) / W - 0.5) * 2 * Math.PI, lat = ((j + 0.5) / H - 0.5) * Math.PI;
    d.set(Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
    let r, g, b;
    if (d.y > 0) { // Dämmerung: Horizont warm, Zenit tiefblau
      const t = Math.pow(d.y, 0.5);
      r = 0.05 * (1 - t) + 0.006 * t; g = 0.038 * (1 - t) + 0.011 * t; b = 0.034 * (1 - t) + 0.03 * t;
    } else { // beleuchteter Rasen und Umgebung: grünlicher Abglanz, zum Horizont dunkler
      const t = Math.pow(-d.y, 0.6);
      r = 0.03 + 0.07 * t; g = 0.045 + 0.13 * t; b = 0.03 + 0.06 * t;
    }
    for (const l of L) { // Strahler-Gruppe: heller, eng begrenzter Fleck
      const c = d.dot(l), a = Math.acos(Math.min(1, c));
      const s = 46 * Math.exp(-(a * a) / (2 * 0.05 * 0.05));
      r += s; g += s * 0.97; b += s * 0.9;
    }
    const o = (j * W + i) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace; tex.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose(); tex.dispose();
  return env;
}

// Lichtfeld auf dem Kunstrasen (Faktor × 2 im Shader): Mitte und Bereiche vor den Masten etwas heller, Ränder dunkler
export function poolTexture(masts) {
  const W = 128, H = 80, box = [-16, -10, 32, 20];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  let mx = 0; const vals = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box[0] + (i + 0.5) / W * box[2], z = box[1] + (j + 0.5) / H * box[3];
    let s = 0;
    for (const [mxp, mzp] of masts) { const dx = x - mxp * 0.42, dz = z - mzp * 0.42; s += Math.exp(-(dx * dx + dz * dz) / (2 * 9 * 9)); }
    s *= 1 - 0.35 * Math.max(0, Math.hypot(x / 13, z / 8.5) - 0.8);
    vals[j * W + i] = s; mx = Math.max(mx, s);
  }
  for (let k = 0; k < W * H; k++) {
    const m = 0.8 + 0.3 * (vals[k] / mx); // 0,8 … 1,1
    const v = Math.round(Math.min(255, m * 0.5 * 255));
    img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.NoColorSpace;
  return { tex: t, box: new THREE.Vector4(...box) };
}

// Lichtkegel (eine Geometrie für alle Strahler, additiv, zur Spitze hin heller) und Leuchtpunkte (Punkte, additiv)
export class Flutlicht {
  constructor(lamps) {
    // ein Kegel je Mast (vom mittleren Strahler), 70 % der Strecke zum Feld – sie verblassen ohnehin (spart Füllrate)
    const cones = [];
    lamps.filter((l, i) => i % 3 === 1).forEach((l) => {
      const ax = -Math.sign(l.x) * 4, az = -Math.sign(l.z) * 2.5;
      const from = new THREE.Vector3(l.x, l.y, l.z), full = from.distanceTo(new THREE.Vector3(ax, 0, az));
      const to = from.clone().lerp(new THREE.Vector3(ax, 0, az), 0.7), len = full * 0.7;
      const g = new THREE.CylinderGeometry(0.6, len * 0.24, len, 12, 3, true);
      g.translate(0, -len / 2, 0); // Spitze im Ursprung, Kegel nach −y
      const t = new Float32Array(g.attributes.position.count);
      for (let k = 0; k < t.length; k++) t[k] = -g.attributes.position.getY(k) / len; // 0 an der Lampe … 1 am Boden
      g.setAttribute('t', new THREE.BufferAttribute(t, 1));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
      g.applyMatrix4(new THREE.Matrix4().compose(from, q, new THREE.Vector3(1, 1, 1)));
      g.deleteAttribute('uv');
      cones.push(g);
    });
    const merged = mergeAll(cones);
    this.coneMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(0.85, 0.9, 1.0) } },
      vertexShader: `attribute float t; varying float vT; varying vec3 vN, vV;
        void main() { vT = t; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uK; uniform vec3 uCol; varying float vT; varying vec3 vN, vV;
        void main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = uK * 0.85 * f * pow(1.0 - vT, 1.5) * smoothstep(0.0, 0.04, vT);
          gl_FragColor = vec4(uCol * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.cones = new THREE.Mesh(merged, this.coneMat);
    this.cones.name = 'lichtkegel'; this.cones.frustumCulled = false; this.cones.renderOrder = 6;
    // Leuchtpunkte
    const pos = new Float32Array(lamps.length * 3);
    lamps.forEach((l, i) => pos.set([l.x, l.y, l.z], i * 3));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uScale: { value: 300 } },
      vertexShader: `uniform float uScale; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * 4.5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uK; void main() { vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d);
        float a = uK * (exp(-r2 * 300.0) * 1.4 + exp(-r2 * 45.0) * 0.55 + (exp(-r2 * 14.0) - 0.03) * 0.3); if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glows = new THREE.Points(pg, this.glowMat);
    this.glows.name = 'flutlicht_glanz'; this.glows.frustumCulled = false; this.glows.renderOrder = 7;
    this.group = new THREE.Group(); this.group.name = 'flutlicht'; this.group.add(this.cones, this.glows);
    this.group.visible = false;
  }
  set(k, pxScale) {
    this.group.visible = k > 0.01;
    this.coneMat.uniforms.uK.value = k; this.glowMat.uniforms.uK.value = k; this.glowMat.uniforms.uScale.value = pxScale;
  }
}
function mergeAll(geos) {
  // kleine eigene Verschmelzung (gleiche Attribute: position, normal, t; ohne Index)
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), t = new Float32Array(n);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); t.set(g.attributes.t.array, o); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('t', new THREE.BufferAttribute(t, 1));
  return m;
}

// Flutlicht-Schatten: je Spieler vier lange, weiche Schatten (einer je Mast), Länge aus Masthöhe und Abstand
export class NachtSchatten {
  constructor(masts, nFigs = 6) {
    this.masts = masts; this.n = nFigs * masts.length;
    const mat = new THREE.MeshBasicMaterial({ map: figureShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.InstancedMesh(figureShadowGeometry(2.0, 0.8), mat, this.n);
    this.mesh.name = 'flutlicht_schatten'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.visible = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._y = new THREE.Vector3(0, 1, 0);
  }
  // figs: Avatar-Wurzeln (position, visible), lift: Sprunghöhe ignorieren (Schatten bleibt am Boden)
  update(roots) {
    let k = 0;
    for (const r of roots) {
      for (const [mx, mz] of this.masts) {
        if (!r || !r.visible) { this._m.makeScale(0, 0, 0); this.mesh.setMatrixAt(k++, this._m); continue; }
        const dx = r.position.x - mx, dz = r.position.z - mz, d = Math.hypot(dx, dz) || 1;
        const len = Math.min(2.6, 1.8 * d / MAST_H / 1.5); // Textur-Schatten ≈ 1,5 m bei Maßstab 1
        this._p.set(r.position.x, 0.007, r.position.z);
        this._q.setFromAxisAngle(this._y, Math.atan2(-dz, dx));
        this._s.set(len, 1, 1);
        this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(k++, this._m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
