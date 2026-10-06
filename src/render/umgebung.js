// Verschönerung „Umgebung“ (Deko, Peter 05.10.): Bolzplatz-Anlage um den Käfig – Betonsockel und Kieswege (eingebacken in
// den Außenboden), Flutlichtmasten mit Lampen, Bänke mit Taschen und Flaschen, Ballnetz, Mülleimer, kleines Vereinsheim,
// Geländer um die Anlage, gemalte Bäume und Büsche (Herbst) als Billboards. Alles prozedural (keine Fremd-Assets), wenige
// Draw-Calls: Bauten 1 (Vertexfarben), Lampengläser 1, Bäume/Büsche 1 (Instancing). Wirft keine Echtzeit-Schatten – die
// Schatten am Boden sind in die Detail-Textur gemalt. Kameras: Menü-Rundflug (R ≈ 23 m) und Fan-Cam bleiben frei.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './stimmung.js';

const C = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const COL = {
  galv: C(0.62, 0.64, 0.66), dark: C(0.13, 0.14, 0.15), concrete: C(0.62, 0.61, 0.58), wood: C(0.55, 0.38, 0.22),
  woodDark: C(0.38, 0.26, 0.15), green: C(0.06, 0.26, 0.21), bin: C(0.15, 0.38, 0.22), white: C(0.92, 0.92, 0.9),
  house: C(0.86, 0.80, 0.68), roof: C(0.42, 0.18, 0.13), door: C(0.24, 0.32, 0.42), window: C(0.16, 0.2, 0.24),
  orange: C(1.0, 0.42, 0.08), blue: C(0.12, 0.36, 0.95), red: C(0.78, 0.12, 0.1), black: C(0.05, 0.05, 0.06), sign: C(0.95, 0.85, 0.2),
};

// ---------------- Bauteile mit Vertexfarbe (werden zu einem Mesh verschmolzen) ----------------
class Builder {
  constructor() { this.geos = []; this.glass = []; }
  add(g, color, m) {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.geos.push(g);
    return g;
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
  cyl(r0, r1, h, x, y, z, color, seg = 8, rx = 0, rz = 0, ry = 0) {
    return this.add(new THREE.CylinderGeometry(r0, r1, h, seg, 1), color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
  // Rohr von a nach b
  tube(a, b, r, color, seg = 6) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), seg, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return this.add(g, color, new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  }
  mesh(mat) { const m = new THREE.Mesh(mergeGeometries(this.geos), mat); this.geos = []; return m; }
}

// Flutlichtmast: verjüngtes Rohr 16 m, Querträger, drei Strahler zur Feldmitte geneigt, Kabelkasten. Gläser getrennt
// (leuchten am Abend, Etappe 4). Gibt die Lampen-Positionen zurück.
function floodMast(B, x, z) {
  const H = 16, yaw = Math.atan2(-x, -z); // Blick zur Feldmitte
  B.box(0.9, 0.3, 0.9, x, 0.15, z, COL.concrete);
  B.cyl(0.11, 0.2, H, x, H / 2 + 0.3, z, COL.galv, 10);
  B.box(0.22, 0.34, 0.14, x + Math.sin(yaw) * 0.18, 1.3, z + Math.cos(yaw) * 0.18, COL.dark, yaw);
  const top = H + 0.3, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  B.box(3.2, 0.12, 0.12, x, top - 0.25, z, COL.galv, yaw);
  const lamps = [];
  for (const s of [-1.35, 0, 1.35]) {
    const lx = x + rx * s * 0.75 + Math.sin(yaw) * 0.25, lz = z + rz * s * 0.75 + Math.cos(yaw) * 0.25, ly = top - 0.05;
    B.box(0.7, 0.52, 0.24, lx, ly, lz, COL.dark, yaw, -0.5);
    B.box(0.06, 0.4, 0.06, x + rx * s * 0.75, top - 0.3, z + rz * s * 0.75, COL.galv, yaw);
    lamps.push({ x: lx + Math.sin(yaw) * 0.12, y: ly - 0.07, z: lz + Math.cos(yaw) * 0.12, yaw });
  }
  return lamps;
}

// Parkbank (Holzlatten auf Betonfüßen), Blick in Richtung yaw
function bench(B, x, z, yaw, len = 1.9) {
  const f = (dx, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  for (const s of [-1, 1]) { const [px, pz] = f(s * len * 0.38, 0.05); B.box(0.12, 0.42, 0.5, px, 0.21, pz, COL.concrete, yaw); }
  for (let i = 0; i < 3; i++) { const [px, pz] = f(0, -0.16 + i * 0.13); B.box(len, 0.04, 0.1, px, 0.44, pz, i % 2 ? COL.woodDark : COL.wood, yaw); }
  for (let i = 0; i < 2; i++) { const [px, pz] = f(0, -0.27); B.box(len, 0.1, 0.035, px, 0.62 + i * 0.16, pz, COL.wood, yaw, 0.18); }
}

// Sporttasche (Rolle) in Farbe
function bag(B, x, z, yaw, color) {
  B.cyl(0.15, 0.15, 0.55, x, 0.15, z, color, 8, 0, Math.PI / 2, yaw);
  B.box(0.3, 0.02, 0.06, x, 0.31, z, COL.black, yaw);
}
function bottle(B, x, z, color) { B.cyl(0.035, 0.035, 0.2, x, 0.1, z, color, 6); B.cyl(0.015, 0.02, 0.04, x, 0.22, z, COL.white, 5); }
function ballNet(B, x, z) {
  for (let i = 0; i < 6; i++) { const a = i * 1.1; B.add(new THREE.IcosahedronGeometry(0.11, 0), i % 2 ? COL.white : COL.dark, new THREE.Matrix4().makeTranslation(x + Math.cos(a) * 0.12 * (i > 2), 0.11 + (i > 2) * 0.17 + (i === 5) * 0.15, z + Math.sin(a) * 0.12)); }
}
function bin(B, x, z) { B.cyl(0.22, 0.2, 0.75, x, 0.45, z, COL.bin, 10); B.cyl(0.04, 0.04, 0.5, x, 0.25, z - 0.25, COL.galv, 5); }

// Kleines Vereinsheim (Container mit Pultdach, Tür, Fenster, Vordach, Schild)
function clubhouse(B, x, z, yaw) {
  const f = (dx, dz) => [x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz];
  B.box(7, 2.7, 3, x, 1.35, z, COL.house, yaw);
  const [rfx, rfz] = f(0, 0.15); B.box(7.4, 0.18, 3.5, rfx, 2.8, rfz, COL.roof, yaw, 0.05);
  const [dx, dz] = f(-1.8, 1.52); B.box(0.95, 2.05, 0.06, dx, 1.03, dz, COL.door, yaw);
  for (const off of [0.4, 2.2]) { const [wx, wz] = f(off, 1.52); B.box(1.2, 0.9, 0.06, wx, 1.6, wz, COL.window, yaw); }
  const [sx, sz] = f(1.3, 1.53); B.box(2.2, 0.38, 0.04, sx, 2.35, sz, COL.sign, yaw);
  const [cx, cz] = f(-1.8, 2.1); B.box(1.6, 0.06, 1.2, cx, 2.35, cz, COL.galv, yaw, -0.12);
  return [f(0.4, 1.56), f(2.2, 1.56), f(-1.8, 1.56)].map(([px, pz], i) => ({ x: px, y: i < 2 ? 1.6 : 1.03, z: pz, w: i < 2 ? 1.1 : 0.85, h: i < 2 ? 0.8 : 1.95, yaw }));
}

// Geländer (2 Holme auf Pfosten) entlang eines Rechtecks, mit Lücke für den Weg
function railing(B, x0, z0, x1, z1, gaps) {
  const runs = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
  for (const [ax, az, bx, bz] of runs) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 2.5);
    const inGap = (px, pz) => gaps.some(([gx, gz, r]) => Math.hypot(px - gx, pz - gz) < r);
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (!inGap(px, pz)) B.box(0.07, 1.05, 0.07, px, 0.52, pz, COL.green);
      if (i > 0) {
        const t0 = (i - 1) / n, qx = ax + (bx - ax) * t0, qz = az + (bz - az) * t0;
        if (!inGap(px, pz) && !inGap(qx, qz)) for (const h of [0.5, 1.0]) B.tube([qx, h, qz], [px, h, pz], 0.025, COL.green, 5);
      }
    }
  }
}

// ---------------- Bäume und Büsche: einmal in eine Leinwand gemalt (Atlas 1024 × 640) ----------------
// Zeile oben (256 × 512): Linde (Sommer), Ahorn (Herbst), Fichte, Birke; Zeile unten (256 × 128): vier Büsche.
// Licht von links oben, dunkle Tupfer zuerst, helle obenauf → plastische Krone ohne Echtzeit-Licht.
const PAL = {
  linde: [[20, 36, 18], [34, 56, 27], [56, 84, 40], [88, 116, 60], [128, 150, 90]],
  herbst: [[60, 36, 16], [108, 62, 24], [152, 98, 36], [186, 138, 58], [206, 174, 108]],
  birke: [[34, 54, 26], [58, 84, 40], [92, 120, 60], [130, 154, 88], [168, 182, 122]],
  fichte: [[10, 26, 19], [18, 42, 30], [32, 64, 44], [56, 94, 62], [86, 122, 82]],
};
function palColor(p, t, j = 0) {
  t = Math.max(0, Math.min(0.999, t)) * (p.length - 1);
  const i = Math.floor(t), f = t - i, a = p[i], b = p[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f + j)},${Math.round(a[1] + (b[1] - a[1]) * f + j)},${Math.round(a[2] + (b[2] - a[2]) * f + j * 0.6)})`;
}
function paintCrown(g, cx, cy, rx, ry, pal, rnd, n, dab, alt = null) {
  const lobes = [{ x: cx, y: cy, rx: rx * 0.72, ry: ry * 0.78 }];
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, r = 0.5 * Math.sqrt(rnd());
    lobes.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r * 0.85, rx: rx * (0.38 + 0.3 * rnd()), ry: ry * (0.38 + 0.3 * rnd()) });
  }
  const dabs = [];
  for (let i = 0; i < n; i++) {
    const L = lobes[Math.floor(rnd() * lobes.length)], a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    const x = L.x + Math.cos(a) * L.rx * r, y = L.y + Math.sin(a) * L.ry * r;
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const lit = 0.42 + 0.42 * (-0.5 * nx - 0.75 * ny) + 0.22 * r * (L === lobes[0] ? 0.4 : 1) - 0.18 * Math.max(0, ny) + (rnd() - 0.5) * 0.3;
    dabs.push([x, y, lit, alt && rnd() < 0.16 ? alt : pal]);
  }
  dabs.sort((a, b) => a[2] - b[2]);
  for (const [x, y, lit, p] of dabs) {
    g.fillStyle = palColor(p, lit, (rnd() - 0.5) * 10);
    g.beginPath(); g.ellipse(x, y, dab * (0.55 + rnd() * 0.75), dab * (0.38 + rnd() * 0.45), rnd() * Math.PI, 0, Math.PI * 2); g.fill();
  }
}
function paintTrunk(g, cx, yb, yt, w0, col, rnd, branches = 6, h = 0, bcol = col) {
  g.fillStyle = col; g.strokeStyle = bcol; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - w0, yb); g.quadraticCurveTo(cx - w0 * 0.55, (yb + yt) / 2, cx - w0 * 0.28, yt);
  g.lineTo(cx + w0 * 0.28, yt); g.quadraticCurveTo(cx + w0 * 0.6, (yb + yt) / 2, cx + w0, yb); g.fill();
  for (let i = 0; i < branches; i++) {
    const y = yt + (yb - yt) * (0.02 + 0.22 * rnd()), s = i % 2 ? 1 : -1, len = (h || (yb - yt)) * (0.1 + 0.12 * rnd());
    g.lineWidth = w0 * (0.35 + 0.3 * rnd());
    g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + s * len * 0.5, y - len * 0.25, cx + s * len, y - len * (0.45 + 0.3 * rnd())); g.stroke();
  }
}
function paintSpruce(g, x0, y0, w, h, rnd) {
  const cx = x0 + w / 2, P = PAL.fichte;
  g.fillStyle = '#3a2b1f'; g.fillRect(cx - 4, y0 + h * 0.84, 8, h * 0.16);
  const rows = 24;
  for (let i = 0; i < rows; i++) {
    const t = (i + 1) / rows, y = y0 + h * (0.02 + 0.84 * t), half = w * 0.45 * Math.pow(t, 0.92) + 4, sag = h * 0.028;
    g.fillStyle = palColor(P, 0.15 + 0.1 * rnd());
    g.beginPath(); g.moveTo(cx, y - sag * 1.6); g.quadraticCurveTo(cx - half * 0.55, y - sag * 0.4, cx - half, y + sag); g.lineTo(cx + half, y + sag);
    g.quadraticCurveTo(cx + half * 0.55, y - sag * 0.4, cx, y - sag * 1.6); g.fill();
    const nd = Math.round(18 + 70 * t);
    for (let k = 0; k < nd; k++) {
      const u = rnd() * 2 - 1, px = cx + u * half * 0.95, py = y - sag * 1.2 * (1 - Math.abs(u)) + sag * 1.3 * Math.abs(u) * Math.abs(u) + (rnd() - 0.6) * sag;
      g.fillStyle = palColor(P, 0.35 + 0.45 * (0.5 - 0.5 * u) + (rnd() - 0.5) * 0.3);
      g.beginPath(); g.ellipse(px, py, 2.2 + rnd() * 2.4, 1.2 + rnd(), (u * 0.5) + (rnd() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
    }
  }
}
let _treeAtlas = null;
export function treeAtlas() {
  if (_treeAtlas) return _treeAtlas;
  // gemalt in Koordinaten 1024 × 640, gespeichert in 75 % (768 × 480): halber Speicher, kürzere Malzeit beim Start
  const c = document.createElement('canvas'); c.width = 768; c.height = 480;
  const g = c.getContext('2d'), rnd = mulberry32(4242);
  g.setTransform(0.75, 0, 0, 0.75, 0, 0);
  // Linde: breite runde Krone
  paintTrunk(g, 128, 512, 250, 13, '#47382b', rnd, 7, 300);
  paintCrown(g, 128, 205, 112, 190, PAL.linde, rnd, 2600, 5.8);
  // Ahorn im Herbst: gelb-orange, ein paar grüne Reste
  paintTrunk(g, 384, 512, 270, 12, '#4a3a2d', rnd, 7, 280);
  paintCrown(g, 384, 225, 108, 180, PAL.herbst, rnd, 2500, 5.8, PAL.linde);
  // Fichte
  paintSpruce(g, 512, 8, 256, 504, rnd);
  // Birke: schlank, heller Stamm mit dunklen Flecken, lockere Krone
  paintTrunk(g, 896, 512, 150, 7, '#e9e6dc', rnd, 8, 240, '#5a5048');
  g.fillStyle = '#2b2b2b';
  for (let i = 0; i < 26; i++) { const y = 150 + rnd() * 350; g.fillRect(890 + rnd() * 8, y, 3 + rnd() * 6, 2 + rnd() * 3); }
  paintCrown(g, 896, 200, 88, 172, PAL.birke, rnd, 1800, 5.2);
  // Büsche (256 × 128): rund, breit, Hecke, Herbst
  const bush = (cx, pal, rx, ry, alt) => paintCrown(g, cx, 640 - ry - 6, rx, ry, pal, rnd, 1200, 5.4, alt);
  bush(128, PAL.linde, 110, 54);
  bush(384, PAL.birke, 116, 50);
  bush(640, PAL.fichte, 118, 46);
  bush(896, PAL.herbst, 104, 52, PAL.linde);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _treeAtlas = { tex: t, canvas: c, cells: { linde: [0, 0], herbst: [1, 0], fichte: [2, 0], birke: [3, 0], busch: [0, 1], busch2: [1, 1], hecke: [2, 1], buschHerbst: [3, 1] } };
  return _treeAtlas;
}
// Atlas-Rechteck (u0, v0, du, dv) einer Zelle; Zeile 0 = oben 512 px, Zeile 1 = unten 128 px (Leinwand y nach unten)
function cellRect(col, row) {
  return row === 0 ? [col * 0.25, 128 / 640, 0.25, 512 / 640] : [col * 0.25, 0, 0.25, 128 / 640];
}

// Billboards (Achse senkrecht, drehen sich zur Kamera): Instanz = Position, Größe, Atlas-Zelle, Phase/Spiegel/Helligkeit/Wind.
// Alpha-to-Coverage bei Kantenglättung (weiche Ränder), sonst harter Schnitt. Nebel wie die Szene.
export function billboardMaterial(map, aa) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) }, uHideX: { value: -1e4 }, uDesat: { value: 0 } }]);
  u.uMap.value = map;
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true, alphaToCoverage: !!aa, transparent: false,
    defines: aa ? { A2C: 1 } : {},
    vertexShader: `attribute vec3 iPos; attribute vec2 iSize; attribute vec4 iCell; attribute vec4 iMisc;
      uniform float uTime, uHideX; varying vec2 vUv; varying float vTint;
      #include <fog_pars_vertex>
      void main() {
        if (iPos.x < uHideX) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        vec3 tc = cameraPosition - iPos; tc.y = 0.0; tc = normalize(tc + vec3(1e-4, 0.0, 0.0));
        vec3 right = vec3(tc.z, 0.0, -tc.x);
        float sway = sin(uTime * 1.1 + iMisc.x) * iMisc.w * position.y * position.y;
        vec3 p = iPos + right * (position.x * iSize.x + sway) + vec3(0.0, position.y * iSize.y, 0.0);
        vUv = vec2(iCell.x + (iMisc.y > 0.0 ? uv.x : 1.0 - uv.x) * iCell.z, iCell.y + uv.y * iCell.w);
        vTint = iMisc.z;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uLight; uniform float uDesat; varying vec2 vUv; varying float vTint;
      #include <fog_pars_fragment>
      void main() {
        vec4 c = texture2D(uMap, vUv);
        c.rgb = mix(c.rgb, vec3(dot(c.rgb, vec3(0.3, 0.55, 0.15))), uDesat);
        #ifdef A2C
          float a = (c.a - 0.5) / max(fwidth(c.a), 1e-4) + 0.5;
          if (a < 0.02) discard;
          gl_FragColor = vec4(c.rgb * uLight * vTint, clamp(a, 0.0, 1.0));
        #else
          if (c.a < 0.5) discard;
          gl_FragColor = vec4(c.rgb * uLight * vTint, 1.0);
        #endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
// Instanzierte Billboard-Geometrie: items = [{x, y?, z, w, h, cell: [u0, v0, du, dv], phase, mirror, tint, sway}]
export function billboardMesh(items, mat) {
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const n = items.length, pos = new Float32Array(n * 3), size = new Float32Array(n * 2), cell = new Float32Array(n * 4), misc = new Float32Array(n * 4);
  items.forEach((it, i) => {
    pos.set([it.x, it.y || 0, it.z], i * 3); size.set([it.w, it.h], i * 2); cell.set(it.cell, i * 4);
    misc.set([it.phase || 0, it.mirror || 1, it.tint || 1, it.sway || 0], i * 4);
  });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2));
  g.setAttribute('iCell', new THREE.InstancedBufferAttribute(cell, 4));
  g.setAttribute('iMisc', new THREE.InstancedBufferAttribute(misc, 4));
  g.instanceCount = n;
  // Hüllkugel über alle Instanzen (für das Frustum-Culling)
  const box = new THREE.Box3();
  for (const it of items) box.expandByPoint(new THREE.Vector3(it.x, (it.y || 0) + it.h, it.z)).expandByPoint(new THREE.Vector3(it.x, it.y || 0, it.z));
  g.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); g.boundingSphere.radius += 8;
  g.boundingBox = box;
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = true;
  return m;
}

// ---------------- Anlage: feste Aufstellung (Kameras bleiben frei: Rundflug R ≈ 19,5–26,5 m ohne hohe Teile,
// Fan-Cam hinter dem Tor x ≈ ±15,6, |z| < 4,5 frei) ----------------
export const LAYOUT = {
  // Flutlicht an den Ecken der Anlage außerhalb der Menü-Kamerabahn (nie im Vordergrund, nie im Spielbild)
  masts: [[25, 14.5], [25, -14.5], [-25, 14.5], [-25, -14.5]],
  trees: [
    [-31, -36, 12.5, 'linde'], [-14, -39, 11, 'herbst'], [9, -37, 13.5, 'linde'], [27, -35, 10.5, 'birke'], [36, -33, 14, 'fichte'],
    [-36, 31, 15, 'fichte'], [-24, 35, 12, 'linde'], [-9, 33, 13, 'herbst'], [5, 36, 11.5, 'birke'], [18, 32, 14.5, 'linde'], [31, 35, 12, 'herbst'], [42, 30, 16, 'fichte'],
    [-40, -18, 13, 'herbst'], [-44, -4, 15.5, 'fichte'], [-41, 9, 12.5, 'linde'], [-38, 21, 11, 'birke'],
    [39, -19, 12, 'linde'], [43, -5, 14.5, 'fichte'], [40, 9, 13, 'herbst'], [37, 20, 11.5, 'birke'],
    [-20, -52, 16, 'fichte'], [16, -55, 17, 'fichte'], [-50, 26, 17, 'fichte'], [52, 18, 16, 'fichte'], [0, 50, 15, 'linde'], [-58, -10, 18, 'fichte'], [58, -24, 17, 'linde'],
  ],
  bushes: [
    [17.4, -7.6, 1.3, 'busch'], [17.6, 7.4, 1.15, 'hecke'], [-17.5, 7.5, 1.3, 'busch2'], [-17.4, -7.7, 1.25, 'buschHerbst'],
    [-30, -24, 1.6, 'hecke'], [-24, -24.8, 1.4, 'busch'], [21, -25, 1.5, 'buschHerbst'], [30, -24, 1.7, 'hecke'], [-33, 4, 1.5, 'busch2'],
    [33, -8, 1.4, 'busch'], [33, 12, 1.6, 'hecke'], [-16, 25, 1.5, 'buschHerbst'], [-28, 25, 1.4, 'busch'], [20, 25, 1.5, 'busch2'], [-22, -12.5, 1.2, 'busch'],
  ],
  benches: [[16.7, -5.6, -Math.PI / 2], [-16.7, 5.6, Math.PI / 2], [-5, 12.6, Math.PI], [6, -12.8, 0]],
  clubhouse: [-29, -7.5, Math.atan2(29, 7.5)],
  rail: [-34, -26, 34, 26],
  pathExit: [[4, 9.1], [6, 18], [8, 26.5], [9, 31]],
  pathClub: [[-14.9, -7.5], [-20, -7.8], [-25.4, -6.7]],
  desire: [[14.9, 6.5], [23, 13], [32, 21.5]],
};

// Detail-Textur des Außenbodens (80 × 60 m um den Käfig, 6 px/m): R = Betonsockel, G = Kies/abgetretene Erde, B = Schatten
export function paintGroundDetail(L, sunDir, spots) {
  // eine Leinwand, Kanäle getrennt additiv gemalt (reines Rot/Grün/Blau mit „lighter“) – kein Auslesen nötig
  const PPM = 6, W = 80 * PPM, H = 60 * PPM, X = (x) => (x + 40) * PPM, Z = (z) => (z + 30) * PPM;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d'); og.fillStyle = '#000'; og.fillRect(0, 0, W, H); og.globalCompositeOperation = 'lighter';
  const CH = { R: '255,0,0', G: '0,255,0', B: '0,0,255' };
  const gR = { g: og, c: CH.R }, gG = { g: og, c: CH.G }, gB = { g: og, c: CH.B };
  const rrect = ({ g, c }, x0, z0, x1, z1, r) => { g.fillStyle = `rgb(${c})`; g.beginPath(); g.roundRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM, r * PPM); g.fill(); };
  const blob = ({ g, c }, x, z, rx, rz, a, rot = 0) => {
    g.save(); g.translate(X(x), Z(z)); g.rotate(rot); g.scale(1, rz / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * PPM); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(0.6, `rgba(${c},${a * 0.55})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * PPM, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const path = ({ g, c }, pts, w, a) => { g.save(); g.strokeStyle = `rgba(${c},${a})`; g.lineWidth = w * PPM; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); g.restore(); };
  const rect = ({ g, c }, cx, cz, rot, x0, z0, w, h, a = 1) => { g.save(); g.translate(X(cx), Z(cz)); g.rotate(rot); g.fillStyle = `rgba(${c},${a})`; g.fillRect(x0 * PPM, z0 * PPM, w * PPM, h * PPM); g.restore(); };
  // Betonsockel um den Käfig und Platte am Vereinsheim
  rrect(gR, -14.9, -9.1, 14.9, 9.1, 1.2);
  const [hx, hz, hy] = L.clubhouse;
  rect(gR, hx, hz, -hy, -4.1, -2.0, 8.2, 5.6);
  // Kieswege und Trampelpfad, abgetretene Stellen bei Bänken und Zuschauern
  path(gG, L.pathExit, 1.8, 1); path(gG, L.pathClub, 1.7, 1);
  path(gG, L.desire, 0.9, 0.55); path(gG, L.desire, 1.8, 0.25);
  for (const [x, z] of L.benches) blob(gG, x + Math.sign(x) * 0.6 * (Math.abs(x) > 10), z + Math.sign(z) * 0.6 * (Math.abs(x) < 10), 1.3, 1.0, 0.55);
  for (const s of spots) blob(gG, s.x, s.z, 0.9, 0.9, 0.35);
  // Schatten (Sonne aus sunDir): Bäume, Büsche, Masten, Vereinsheim, Bänke, Zuschauer
  const sx = -sunDir.x, sz = -sunDir.z, sl = Math.hypot(sx, sz), cot = sl / sunDir.y, dx = sx / sl, dz = sz / sl, rot = Math.atan2(dz, dx);
  for (const [x, z, h, kind] of L.trees) {
    const r = kind === 'fichte' ? h * 0.2 : h * 0.3, off = h * 0.58 * cot;
    blob(gB, x + dx * off, z + dz * off, r * 1.25 / Math.max(0.5, sunDir.y), r, 0.55, rot);
    path(gB, [[x, z], [x + dx * off * 0.6, z + dz * off * 0.6]], 0.35, 0.4);
  }
  for (const [x, z, h] of L.bushes) blob(gB, x + dx * h * 0.4 * cot, z + dz * h * 0.4 * cot, h * 1.6, h * 1.0, 0.5, rot);
  for (const [x, z] of L.masts) path(gB, [[x, z], [x + dx * 16 * cot, z + dz * 16 * cot]], 0.28, 0.35);
  rect(gB, hx + dx * 1.2, hz + dz * 1.2, -hy, -3.6, -1.6, 7.4, 3.4, 0.5);
  for (const [x, z] of L.benches) blob(gB, x + dx * 0.3, z + dz * 0.3, 1.2, 0.55, 0.45);
  for (const s of spots) blob(gB, s.x + dx * 0.5, s.z + dz * 0.5, 0.8, 0.4, 0.5, rot);
  const t = new THREE.CanvasTexture(out);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, box: new THREE.Vector4(-40, -30, 80, 60), canvas: out };
}

// Aufbau: nah (Bänke, Taschen, Mülleimer – auch im Spielbild an den Enden) und fern (Masten, Vereinsheim, Geländer – nur im
// Menü und in der Wiederholung; im Spiel ausgeblendet, spart Draw-Calls), Lampengläser/Fenster (nur am Abend),
// Bäume (fern) und Büsche an den Käfigenden (nah) als Billboards.
export function buildUmgebung({ aa, sunDir, spots = [] }) {
  const L = LAYOUT, group = new THREE.Group(); group.name = 'umgebung';
  const far = new THREE.Group(); far.name = 'umgebung_fern'; group.add(far);
  // BL: hinter dem linken Tor (hochkant liegt es unter der Kamera → im Spiel ausgeblendet)
  const B = new Builder(), BL = new Builder(), F = new Builder(), lamps = [];
  for (const [x, z] of L.masts) lamps.push(...floodMast(F, x, z));
  for (const [x, z, yaw] of L.benches) bench(x < -13 ? BL : B, x, z, yaw);
  // Taschen, Flaschen, Ballnetz, Mülleimer an den Bänken hinter den Toren und an den Längsseiten
  bag(B, 17.0, -6.9, 0.3, COL.orange); bag(B, 17.3, -6.4, 1.4, COL.blue); bottle(B, 16.3, -4.5, COL.blue); bottle(B, 16.4, -4.3, COL.red);
  bag(BL, -17.0, 6.9, -0.4, COL.blue); ballNet(BL, -16.4, 7.2); bottle(BL, -16.3, 4.5, COL.white);
  bag(B, -6.4, 12.9, 1.2, COL.red); bottle(B, -3.8, 12.3, COL.orange); bag(B, 7.3, -13.1, 0.2, COL.orange);
  bin(B, 17.0, -4.2); bin(BL, -17.0, 4.2); bin(B, -7.2, 12.8);
  const windows = clubhouse(F, ...L.clubhouse);
  railing(F, ...L.rail, [[8, 26, 1.6]]);
  const smat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 });
  const statics = B.mesh(smat); statics.name = 'umgebung_nah';
  const endL = BL.mesh(smat); endL.name = 'umgebung_links';
  const farStatics = F.mesh(smat); farStatics.name = 'umgebung_bauten';
  group.add(statics, endL); far.add(farStatics);
  // Menü und Wiederholung zeigen alles: dort ein gemeinsames Mesh statt drei (weniger Draw-Calls)
  const allStatics = new THREE.Mesh(mergeGeometries([statics.geometry, endL.geometry, farStatics.geometry]), smat);
  allStatics.name = 'umgebung_alles'; allStatics.visible = false; group.add(allStatics);
  // Gläser der Strahler (8) und Fenster des Vereinsheims: getrennt, damit sie am Abend leuchten können
  const G = new Builder();
  for (const l of lamps) G.box(0.58, 0.4, 0.02, l.x, l.y, l.z, COL.white, l.yaw, -0.5);
  for (const w of windows) G.box(w.w, w.h, 0.02, w.x, w.y, w.z, COL.white, w.yaw);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.2, metalness: 0.3, emissive: 0xfff1d6, emissiveIntensity: 0 });
  const glass = G.mesh(glassMat); glass.name = 'umgebung_glas';
  glass.visible = false;
  far.add(glass);
  // Bäume (fern) und Büsche (nah an den Käfigenden auch im Spielbild)
  const A = treeAtlas(), rnd = mulberry32(99), items = [], near = [];
  for (const [x, z, h, kind] of L.trees) items.push({ x, z, w: h * 0.5, h, cell: cellRect(...A.cells[kind]), phase: rnd() * 6.28, mirror: rnd() < 0.5 ? 1 : -1, tint: 0.88 + rnd() * 0.2, sway: kind === 'fichte' ? 0.05 : 0.12 });
  for (const [x, z, h, kind] of L.bushes) (Math.hypot(x, z) < 22 ? near : items).push({ x, y: -0.05, z, w: h * 2, h, cell: cellRect(...A.cells[kind]), phase: rnd() * 6.28, mirror: rnd() < 0.5 ? 1 : -1, tint: 0.86 + rnd() * 0.2, sway: 0.03 });
  const treeMat = billboardMaterial(A.tex, aa);
  const trees = billboardMesh(items, treeMat); trees.name = 'umgebung_baeume';
  const bushes = billboardMesh(near, treeMat); bushes.name = 'umgebung_buesche';
  const allBill = billboardMesh(items.concat(near), treeMat); allBill.name = 'umgebung_alle_baeume'; allBill.visible = false;
  far.add(trees); group.add(bushes, allBill);
  const detail = paintGroundDetail(L, sunDir, spots);
  return {
    group, far, statics, endL, glass, trees, bushes, lamps, detail, treeCanvas: A.canvas,
    // inGame: Spielkamera (Fernes ist dort nie im Bild) → ausblenden; hoch: hinter dem eigenen (linken) Tor nichts zeigen
    update(dt, t, inGame, hoch) {
      treeMat.uniforms.uTime.value = t; far.visible = !inGame;
      const hide = inGame && hoch; treeMat.uniforms.uHideX.value = hide ? -13 : -1e4;
      // im Spiel: nahe Teile einzeln (Fernes aus, hochkant auch hinter dem eigenen Tor); sonst je ein Sammel-Mesh
      statics.visible = bushes.visible = inGame; endL.visible = inGame && !hoch;
      farStatics.visible = trees.visible = false; allStatics.visible = allBill.visible = !inGame;
    },
    // Abend (Etappe 4): 0 = Tag … 1 = Flutlicht
    setNight(k) {
      glass.visible = k > 0.01;
      glassMat.emissiveIntensity = 2.2 * k;
      glassMat.color.setRGB(0.16 + 0.6 * k, 0.19 + 0.55 * k, 0.22 + 0.4 * k);
      treeMat.uniforms.uLight.value.setRGB(1 - 0.8 * k, 1 - 0.78 * k, 1 - 0.7 * k); treeMat.uniforms.uDesat.value = 0.5 * k;
      smat.color.setScalar(1 - 0.45 * k);
    },
  };
}
