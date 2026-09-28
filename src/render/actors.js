// Ball (klassischer 32-Felder-Ball, Textur zur Laufzeit erzeugt – ohne Marken), Platzhalter-Figur
// (Kapsel mit Leibchen, Schuhe mit einfachem Laufzyklus und Tritt), Granulat-Partikel.
import * as THREE from 'three';

// Abgestumpftes Ikosaeder: 12 Fünfecke (Ikosaeder-Ecken) + 20 Sechsecke (Flächenmitten)
function ballCenters() {
  const f = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f], [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1]]
    .map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
  const pent = V;
  const hex = [];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const e = d2(V[0], V[1]) * 1.01;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (d2(V[i], V[j]) < e && d2(V[j], V[k]) < e && d2(V[i], V[k]) < e) {
      const c = [0, 1, 2].map((a) => V[i][a] + V[j][a] + V[k][a]); const l = Math.hypot(...c);
      hex.push(c.map((x) => x / l));
    }
  }
  return { pent, hex };
}

export function ballTexture(w = 512, h = 256) {
  const { pent, hex } = ballCenters();
  const C = pent.map((p) => [...p, 1]).concat(hex.map((p) => [...p, 0]));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const th = (y + 0.5) / h * Math.PI;
    for (let x = 0; x < w; x++) {
      // three.js-UV einer SphereGeometry: phi = u·2π, Punkt (−cos φ sin θ, cos θ, sin φ sin θ)
      const ph = (x + 0.5) / w * 2 * Math.PI;
      const dx = -Math.cos(ph) * Math.sin(th), dy = Math.cos(th), dz = Math.sin(ph) * Math.sin(th);
      let b1 = -2, b2 = -2, i1 = 0;
      for (let i = 0; i < 32; i++) {
        // Fünfecke etwas kleiner gewichten (Voronoi ≈ Flächen des Körpers)
        const d = dx * C[i][0] + dy * C[i][1] + dz * C[i][2] + (C[i][3] ? -0.012 : 0);
        if (d > b1) { b2 = b1; b1 = d; i1 = i; } else if (d > b2) b2 = d;
      }
      const seam = b1 - b2 < 0.012;
      const pentagon = C[i1][3] === 1;
      let r = 246, gg = 246, bb = 242;
      if (pentagon) { r = 22; gg = 24; bb = 28; }
      if (seam) { r = pentagon ? 12 : 120; gg = pentagon ? 12 : 120; bb = pentagon ? 12 : 116; }
      const o = (y * w + x) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Weicher Schattenfleck unter dem Ball (bei bewölktem Licht wirft der Ball kaum Schatten; der Fleck zeigt die Höhe)
export function makeBlob() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  m.renderOrder = 2;
  m.name = 'blob';
  return m;
}
export function poseBlob(m, x, y, z, r) {
  const hgt = Math.max(0, y - r);
  const s = r * 2.3 * (1 + hgt * 0.35);
  m.position.set(x, 0.004, z);
  m.scale.set(s, 1, s);
  m.material.opacity = Math.max(0.12, 1 - hgt * 0.22);
}

export function makeBall(r) {
  const mat = new THREE.MeshPhysicalMaterial({ map: ballTexture(), roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat);
  mesh.castShadow = true;
  mesh.name = 'ball';
  return mesh;
}

// Platzhalter-Figur (1,85 m): Rumpf-Kapsel mit Trainingsleibchen, Kopf, Beine (Hüfte → Schuh, pro Bild
// ausgerichtet), Schuhe mit Laufzyklus und Tritt; Markierungsring am Boden
const HIP_Y = 0.9;
export function makePlayer(color = 0xff7a1a) {
  const g = new THREE.Group();
  g.name = 'player';
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.44, 6, 16), dark);
  body.position.y = 1.23;
  body.castShadow = true;
  g.add(body);
  const bib = new THREE.Mesh(new THREE.CylinderGeometry(0.214, 0.222, 0.5, 16, 1, false), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  bib.position.y = 1.3;
  bib.castShadow = true;
  g.add(bib);
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.2, 14, 1, false), new THREE.MeshStandardMaterial({ color: 0x1c2330, roughness: 0.85 }));
  shorts.position.y = 0.95;
  shorts.castShadow = true;
  g.add(shorts);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc99a7a, roughness: 0.7 }));
  head.position.y = 1.76;
  head.castShadow = true;
  g.add(head);
  // Blickrichtung: kleine Kappe/Schild vorne am Kopf
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.16), new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6 }));
  visor.position.set(0.12, 1.78, 0);
  g.add(visor);
  const legGeo = new THREE.CylinderGeometry(0.075, 0.055, 1, 10, 1);
  legGeo.translate(0, -0.5, 0); // Drehpunkt oben (Hüfte)
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd9b394, roughness: 0.75 });
  const sockMat = new THREE.MeshStandardMaterial({ color: 0x1c2330, roughness: 0.8 });
  const legs = [new THREE.Mesh(legGeo, legMat), new THREE.Mesh(legGeo, legMat)];
  const sockGeo = new THREE.CylinderGeometry(0.068, 0.062, 0.3, 10, 1);
  const socks = [new THREE.Mesh(sockGeo, sockMat), new THREE.Mesh(sockGeo, sockMat)];
  for (const l of legs) { l.castShadow = true; g.add(l); }
  for (const k of socks) { k.castShadow = true; g.add(k); }
  const shoeGeo = new THREE.BoxGeometry(0.27, 0.08, 0.1);
  shoeGeo.translate(0.05, 0.04, 0);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const shoes = [new THREE.Mesh(shoeGeo, shoeMat), new THREE.Mesh(shoeGeo, shoeMat)];
  for (const s of shoes) { s.castShadow = true; g.add(s); }
  // Ring am Boden (gesteuerter Spieler) mit Pfeil
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.012;
  ring.renderOrder = 2;
  const arrow = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.52, 0, -0.1), new THREE.Vector3(0.72, 0, 0), new THREE.Vector3(0.52, 0, 0.1)]), ringMat);
  arrow.geometry.setIndex([0, 1, 2]);
  arrow.position.y = 0.012;
  const marker = new THREE.Group(); marker.add(ring, arrow);
  return { group: g, body, bib, shorts, head, visor, legs, socks, shoes, marker };
}

const _hip = new THREE.Vector3(), _ank = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(0, -1, 0), _q = new THREE.Quaternion();
// Pose aus dem Sim-Zustand: Position, Blickrichtung, Laufzyklus, Tritt
export function posePlayer(pm, pl, x, z) {
  pm.group.position.set(x, 0, z);
  pm.group.rotation.y = -pl.face;
  pm.marker.position.set(x, 0, z);
  pm.marker.rotation.y = -pl.face;
  const s = pl.speed;
  const amp = Math.min(0.32, s * 0.07);
  const ph = pl.gait * Math.PI * 2;
  const lean = Math.min(0.12, s * 0.016);
  const bob = Math.abs(Math.sin(ph)) * Math.min(0.04, s * 0.006);
  for (const m of [pm.body, pm.bib, pm.shorts]) m.rotation.z = -lean;
  pm.body.position.y = 1.23 - bob; pm.bib.position.y = 1.3 - bob; pm.shorts.position.y = 0.95 - bob;
  pm.head.position.set(lean * 1.5, 1.76 - bob, 0); pm.visor.position.set(0.12 + lean * 1.5, 1.78 - bob, 0);
  pm.bib.position.x = lean * 0.7; pm.body.position.x = lean * 0.5;
  for (let i = 0; i < 2; i++) {
    const sh = pm.shoes[i];
    const sgn = i ? -1 : 1;
    let fx = Math.sin(ph + (i ? Math.PI : 0)) * amp;
    let fy = Math.max(0, Math.cos(ph + (i ? Math.PI : 0))) * amp * 0.35;
    // Tritt (Pass/Schuss/Kontakt): Fuß des Schussbeins schwingt nach vorn
    const kickSide = pl.kickFoot > 0 ? 0 : 1;
    const tk = Math.min(pl.kickT, pl.touchT);
    if (i === kickSide && tk < 0.35) {
      const k = Math.sin(Math.min(1, tk / 0.35) * Math.PI);
      const big = pl.kickT < 0.35 ? 1 : 0.5;
      fx = fx * (1 - k) + (0.45 * big + 0.1) * k; fy += 0.12 * k * big;
    }
    sh.position.set(fx, fy, 0.1 * sgn);
    sh.rotation.z = -fx * 0.6;
    // Bein: Hüfte → Knöchel (lokal im Figuren-Raum)
    _hip.set(lean * 0.4, HIP_Y - bob, 0.1 * sgn);
    _ank.set(fx, fy + 0.07, 0.1 * sgn);
    _dir.subVectors(_ank, _hip);
    const len = _dir.length();
    _q.setFromUnitVectors(_up, _dir.normalize());
    const leg = pm.legs[i];
    leg.position.copy(_hip); leg.quaternion.copy(_q); leg.scale.set(1, len, 1);
    const sock = pm.socks[i];
    sock.position.copy(_ank).addScaledVector(_dir, -0.13); sock.quaternion.copy(_q);
  }
}

// Granulat (schwarzes SBR + ein paar Faserstücke) beim Schuss und bei harten Aufprallen
export class Granulate {
  constructor(n = 480) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const cg = c.getContext('2d'); cg.fillStyle = '#fff'; cg.beginPath(); cg.arc(8, 8, 7, 0, Math.PI * 2); cg.fill();
    const m = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, sizeAttenuation: true, map: new THREE.CanvasTexture(c), alphaTest: 0.5, transparent: false });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.name = 'granulate';
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -10;
  }
  emit(x, z, dirX, dirZ, strength, rnd) {
    const count = Math.round(8 + 42 * Math.min(1, strength));
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      const a = Math.atan2(dirZ, dirX) + (rnd() - 0.5) * 1.6;
      const sp = (0.6 + 2.6 * rnd()) * (0.4 + strength);
      this.pos[i * 3] = x + (rnd() - 0.5) * 0.15; this.pos[i * 3 + 1] = 0.01; this.pos[i * 3 + 2] = z + (rnd() - 0.5) * 0.15;
      this.vel[i * 3] = Math.cos(a) * sp * 0.6; this.vel[i * 3 + 1] = (1.2 + 2.4 * rnd()) * (0.5 + strength * 0.8); this.vel[i * 3 + 2] = Math.sin(a) * sp * 0.6;
      this.life[i] = 1.2 + rnd();
      const fiber = rnd() < 0.18;
      const c = fiber ? [0.09, 0.3, 0.06] : [0.035, 0.035, 0.035];
      this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    }
    this.geo.attributes.color.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const o = i * 3;
      this.vel[o + 1] -= 9.81 * dt;
      this.vel[o] *= 1 - 1.5 * dt; this.vel[o + 2] *= 1 - 1.5 * dt;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.pos[o + 1] < 0.004) { this.pos[o + 1] = 0.004; this.vel[o] *= 0.3; this.vel[o + 2] *= 0.3; this.vel[o + 1] = 0; }
      if (this.life[i] <= 0) this.pos[o + 1] = -10;
    }
    if (any) this.geo.attributes.position.needsUpdate = true;
  }
}
