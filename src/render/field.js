// Käfig-Grafik aus denselben Maßen wie die Kollision (sim/world.js): Kunstrasen (ambientCG Grass005,
// umgefärbt, eigene Faser-Normalmap), Linien als Decal, Naturrasen außen, Bande RAL 6005, Pfosten,
// Netze als Alpha-Textur mit Ausbeulung am Ball, Tore.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchTurf, outerGroundMaterial, paintTurfWear, wearLines } from './stimmung.js';

export const RAL6005 = 0x0f4336;   // Moosgrün (Bande, Gestell)
const NET_MESH = 0.10;              // m Maschenweite Ballfangnetz
const GOALNET_MESH = 0.07;

function netTexture(px = 64, line = 3) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d');
  g.clearRect(0, 0, px, px);
  g.strokeStyle = '#fff'; g.lineWidth = line;
  g.beginPath();
  g.moveTo(0, 0.5); g.lineTo(px, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, px);
  g.moveTo(0, px - 0.5); g.lineTo(px, px - 0.5); g.moveTo(px - 0.5, 0); g.lineTo(px - 0.5, px);
  g.stroke();
  // Knoten etwas dicker
  g.fillStyle = '#fff';
  for (const [x, y] of [[0, 0], [px, 0], [0, px], [px, px]]) { g.beginPath(); g.arc(x, y, line * 0.9, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function boardTexture() {
  // Kunststoff-Hohlkammerprofile: waagrechte Fugen alle 1/6 m, leichte Glanzkante darüber
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 8, 256);
  for (let i = 0; i < 6; i++) {
    const y = Math.round(i * 256 / 6);
    g.fillStyle = '#6a6a6a'; g.fillRect(0, y, 8, 3);
    g.fillStyle = '#f7f7f7'; g.fillRect(0, y + 3, 8, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Linien + dezente Streifen als Decal-Textur über dem Feld (Maße aus den Parametern → passt zu ?feld=). Deko: Streifen
// macht der Rasen-Shader (je Blickrichtung), dafür Abnutzung und leicht abgenutzte Linien (stimmung.js)
function linesTexture(P, pad, deko = false) {
  const L = P.fieldL + 2 * pad, W = P.fieldW + 2 * pad;
  const ppm = Math.min(64, 2048 / L);           // Pixel je Meter
  const c = document.createElement('canvas');
  c.width = Math.round(L * ppm); c.height = Math.round(W * ppm);
  let g = c.getContext('2d');
  const X = (x) => (x + L / 2) * ppm, Z = (z) => (z + W / 2) * ppm;
  g.clearRect(0, 0, c.width, c.height);
  // Streifen (zwei Rasentöne) quer zur Spielrichtung, 2 m breit
  g.fillStyle = 'rgba(0,0,0,0.075)';
  if (!deko) for (let x = -P.fieldL / 2, i = 0; x < P.fieldL / 2; x += 2, i++) if (i % 2) g.fillRect(X(x), Z(-P.fieldW / 2), 2 * ppm, P.fieldW * ppm);
  const hx = P.fieldL / 2, hz = P.fieldW / 2;
  // Verschattung an der Bande (diffuses Himmelslicht wird von der Bande abgeschirmt)
  const ao = 0.7 * ppm;
  for (const [x0, z0, x1, z1] of [[-hx, -hz, hx, -hz + 0.7], [-hx, hz - 0.7, hx, hz], [-hx, -hz, -hx + 0.7, hz], [hx - 0.7, -hz, hx, hz]]) {
    const gr = x1 - x0 < 1 ? g.createLinearGradient(X(x0 < 0 ? -hx : hx), 0, X(x0 < 0 ? -hx + 0.7 : hx - 0.7), 0) : g.createLinearGradient(0, Z(z0 < 0 ? -hz : hz), 0, Z(z0 < 0 ? -hz + 0.7 : hz - 0.7));
    gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(X(x0), Z(z0), (x1 - x0) * ppm, (z1 - z0) * ppm);
  }
  const out = g;
  if (deko) paintTurfWear(g, X, Z, ppm, P);
  let lc = c;
  if (deko) { lc = document.createElement('canvas'); lc.width = c.width; lc.height = c.height; g = lc.getContext('2d'); }
  g.strokeStyle = 'rgba(245,245,240,0.92)';
  g.lineWidth = 0.08 * ppm;
  g.beginPath(); g.moveTo(X(0), Z(-hz)); g.lineTo(X(0), Z(hz)); g.stroke();                 // Mittellinie
  g.beginPath(); g.arc(X(0), Z(0), 2.0 * ppm, 0, Math.PI * 2); g.stroke();                   // Mittelkreis
  g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(X(0), Z(0), 0.11 * ppm, 0, Math.PI * 2); g.fill();
  for (const s of [1, -1]) {
    // Torraum: Halbkreis um die Tormitte (Regel „letzte Hand“, ab Nacht 2 aktiv)
    g.beginPath(); g.arc(X(s * hx), Z(0), P.torraum * ppm, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2); g.stroke();
    // Torlinie zwischen den Pfosten
    g.beginPath(); g.moveTo(X(s * (hx - 0.04)), Z(-P.goalW / 2)); g.lineTo(X(s * (hx - 0.04)), Z(P.goalW / 2)); g.stroke();
  }
  if (deko) { wearLines(g, lc); out.drawImage(lc, 0, 0); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NET_VS = `
attribute vec3 pn;
attribute float side;
uniform vec4 uHit;
uniform vec3 uHitN;
uniform float uFade[8];
varying vec2 vUv;
varying float vFade;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  float bulge = 0.0;
  if (uHit.w > 0.0 && dot(pn, uHitN) > 0.9) {
    vec3 d = p - uHit.xyz;
    float dn = dot(d, pn);
    if (abs(dn) < 0.05) {
      float r2 = dot(d, d);
      bulge = uHit.w * exp(-r2 / (2.0 * 0.34 * 0.34));
      p -= pn * bulge;
    }
  }
  vUv = uv;
  // ausgeblendete Netze werden an der Beule sichtbar (Treffer im Dach-/Seitennetz)
  vFade = max(uFade[int(side + 0.5)], min(1.0, bulge * 5.0));
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const NET_FS = `
uniform sampler2D map;
uniform vec3 color;
uniform float opacity;
varying vec2 vUv;
varying float vFade;
#include <fog_pars_fragment>
void main() {
  float a = texture2D(map, vUv).a * opacity * vFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(color, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function netMaterial(tex, color, opacity) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    map: { value: null }, color: { value: new THREE.Color(color) }, opacity: { value: opacity },
    uHit: { value: new THREE.Vector4() }, uHitN: { value: new THREE.Vector3(0, 1, 0) },
    uFade: { value: [1, 1, 1, 1, 1, 1, 1, 1] },
  }]);
  u.map.value = tex;
  return new THREE.ShaderMaterial({ uniforms: u, vertexShader: NET_VS, fragmentShader: NET_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
}

// Netzfläche aus einem Kollisions-Rechteck, unterteilt für die Ausbeulung, UV in Maschen
function netPanel(R, mesh, side) {
  const nu = Math.max(1, Math.round(2 * R.hu / 0.4)), nv = Math.max(1, Math.round(2 * R.hv / 0.4));
  const pos = [], uv = [], pn = [], sd = [], idx = [];
  const [ox, oy, oz] = R.o, [ux, uy, uz] = R.u, [vx, vy, vz] = R.v;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const a = -R.hu + 2 * R.hu * i / nu, b = -R.hv + 2 * R.hv * j / nv;
      pos.push(ox + a * ux + b * vx, oy + a * uy + b * vy, oz + a * uz + b * vz);
      uv.push((a + R.hu) / mesh, (b + R.hv) / mesh);
      pn.push(...R.n); sd.push(side);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('pn', new THREE.Float32BufferAttribute(pn, 3));
  g.setAttribute('side', new THREE.Float32BufferAttribute(sd, 1));
  g.setIndex(idx);
  return g;
}

function sideSlot(R) {
  const [nx, ny, nz] = R.n;
  if (R.kind === 'goalnet') return R.o[0] > 0 ? 5 : 6;
  if (ny < -0.5) return 4;
  if (nz < -0.5) return 0; // Netz bei z = +hz (Normale zeigt nach −z)
  if (nz > 0.5) return 1;
  if (nx < -0.5) return 2;
  return 3;
}

export function buildField(P, cage, tex, renderer, opts = {}) {
  const deko = !!opts.deko;
  const group = new THREE.Group();
  group.name = 'field';
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const hx = cage.hx, hz = cage.hz;

  // --- Naturrasen außen ---
  const gc = tex.grassColor, gn = tex.grassNormal;
  for (const t of [gc, gn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160 / 3, 160 / 3); t.anisotropy = aniso; }
  gc.colorSpace = THREE.SRGBColorSpace;
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2),
    deko ? outerGroundMaterial(gc, opts.groundAmb || new THREE.Color(0.62, 0.64, 0.62))
      : new THREE.MeshStandardMaterial({ map: gc, normalMap: gn, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, color: 0xd8dccf }));
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  outer.name = 'grass';
  group.add(outer);

  // --- Kunstrasen (Feld + Torräume + Rand unter der Bande) ---
  const tc = tex.turfColor, tn = tex.turfNormal;
  const TL = 2 * (hx + cage.gD + 0.3), TW = 2 * (hz + 0.3);
  for (const t of [tc, tn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
  tc.colorSpace = THREE.SRGBColorSpace;
  tc.repeat.set(TL / 2.2, TW / 2.2);
  tn.repeat.set(TL / 0.8, TW / 0.8);
  const turfMat = new THREE.MeshStandardMaterial({ map: tc, normalMap: tn, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.86, metalness: 0.0, color: 0xb4beb0 });
  // Großflächige Unruhe (Abnutzung, Granulat-Verteilung): dieselbe Textur 6× größer, schwach eingemischt
  // (Deko: dazu Mähstreifen je Blickrichtung und Faserglanz, stimmung.js)
  if (deko) patchTurf(turfMat);
  else turfMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 mac = texture2D(map, vMapUv * 0.163 + vec2(0.37, 0.11)).rgb;
        float l = dot(mac, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(0.84, 1.12, smoothstep(0.12, 0.34, l)); }`);
  };
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(TL, TW).rotateX(-Math.PI / 2), turfMat);
  turf.receiveShadow = true;
  turf.name = 'turf';
  group.add(turf);

  // --- Linien als Decal ---
  const pad = 0.15;
  const lt = linesTexture(P, pad, deko);
  lt.anisotropy = aniso;
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(P.fieldL + 2 * pad, P.fieldW + 2 * pad).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: lt, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  lines.position.y = 0.002;
  lines.receiveShadow = true;
  lines.renderOrder = 1;
  lines.name = 'lines';
  group.add(lines);

  // --- Bande (alle Segmente in einem Mesh) ---
  const bt = boardTexture(); bt.anisotropy = aniso;
  const T = 0.07; // Dicke
  const boardGeos = [];
  for (const R of cage.rects) {
    if (R.kind !== 'board') continue;
    const g = new THREE.BoxGeometry(2 * R.hu, 2 * R.hv, T);
    // UV in Metern (Fugen waagrecht)
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + R.hu, (p.getY(i) + R.hv) * 1.0);
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...R.u), new THREE.Vector3(...R.v), new THREE.Vector3(...R.n).negate());
    m.setPosition(new THREE.Vector3(...R.o).addScaledVector(new THREE.Vector3(...R.n), -T / 2));
    g.applyMatrix4(m);
    boardGeos.push(g);
  }
  const boards = new THREE.Mesh(mergeGeometries(boardGeos), new THREE.MeshStandardMaterial({ color: RAL6005, map: bt, roughness: 0.5, metalness: 0.0 }));
  boards.castShadow = true; boards.receiveShadow = true;
  boards.name = 'boards';
  group.add(boards);

  // --- Gestell: Pfosten rundum + Oberrahmen (Stahlrohr, RAL 6005), je Seite ein Mesh (Seite zur Kamera ausblendbar) ---
  const frameMat = new THREE.MeshStandardMaterial({ color: RAL6005, roughness: 0.45, metalness: 0.35 });
  const top = cage.top;
  const off = T + 0.05;
  const nL = Math.max(2, Math.round(P.fieldL / 2.5)), nW = Math.max(2, Math.round(P.fieldW / 2.6));
  const sideGeos = [[], [], [], [], []]; // 0: z = +hz, 1: z = −hz, 2: x = +hx, 3: x = −hx, 4: Dach
  const tube = (list, a, b, r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    list.push(g);
  };
  for (let i = 0; i <= nL; i++) {
    const x = -hx + (2 * hx) * i / nL;
    tube(sideGeos[0], [x, 0, hz + off], [x, top, hz + off], 0.038);
    tube(sideGeos[1], [x, 0, -hz - off], [x, top, -hz - off], 0.038);
  }
  for (let j = 1; j < nW; j++) {
    const z = -hz + (2 * hz) * j / nW;
    if (Math.abs(z) < cage.gw + 0.3) continue; // nicht im Tor
    tube(sideGeos[2], [hx + off, 0, z], [hx + off, top, z], 0.038);
    tube(sideGeos[3], [-hx - off, 0, z], [-hx - off, top, z], 0.038);
  }
  tube(sideGeos[0], [-hx - off, top, hz + off], [hx + off, top, hz + off], 0.03);
  tube(sideGeos[1], [-hx - off, top, -hz - off], [hx + off, top, -hz - off], 0.03);
  tube(sideGeos[2], [hx + off, top, -hz - off], [hx + off, top, hz + off], 0.03);
  tube(sideGeos[3], [-hx - off, top, -hz - off], [-hx - off, top, hz + off], 0.03);
  tube(sideGeos[0], [-hx, P.boardH + 0.02, hz + T / 2], [hx, P.boardH + 0.02, hz + T / 2], 0.03);
  tube(sideGeos[1], [-hx, P.boardH + 0.02, -hz - T / 2], [hx, P.boardH + 0.02, -hz - T / 2], 0.03);
  if (cage.roof) for (let i = 1; i < 4; i++) { const x = -hx + 2 * hx * i / 4; tube(sideGeos[4], [x, top, -hz - off], [x, top, hz + off], 0.015); }
  const frames = sideGeos.map((list, i) => {
    if (!list.length) return null;
    const m = new THREE.Mesh(mergeGeometries(list), frameMat);
    m.castShadow = true; m.name = 'frame' + i;
    group.add(m);
    return m;
  });

  // --- Tore: Pfosten + Latte weiß, Torraum-Rahmen ---
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35, metalness: 0.1 });
  const goalGeos = [];
  const bar = (a, b, r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 12, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    goalGeos.push(g);
  };
  for (const B of cage.bars) bar(B.a, B.b, B.r);
  for (const s of [1, -1]) {
    const xb = s * (hx + cage.gD);
    for (const t of [1, -1]) {
      bar([xb, 0, t * cage.gw], [xb, cage.gH, t * cage.gw], 0.022);
      bar([s * hx, cage.gH, t * cage.gw], [xb, cage.gH, t * cage.gw], 0.022);
      bar([s * hx, 0.01, t * cage.gw], [xb, 0.01, t * cage.gw], 0.018);
    }
    bar([xb, cage.gH, -cage.gw], [xb, cage.gH, cage.gw], 0.022);
    bar([xb, 0.01, -cage.gw], [xb, 0.01, cage.gw], 0.018);
  }
  const goals = new THREE.Mesh(mergeGeometries(goalGeos), goalMat);
  goals.castShadow = true;
  goals.name = 'goals';
  group.add(goals);

  // --- Netze ---
  const nt = netTexture(64, 3); nt.anisotropy = aniso;
  const gt = netTexture(64, 4); gt.anisotropy = aniso;
  const netGeos = [], goalNetGeos = [];
  for (const R of cage.rects) {
    if (R.kind === 'net') netGeos.push(netPanel(R, NET_MESH, sideSlot(R)));
    else if (R.kind === 'goalnet') goalNetGeos.push(netPanel(R, GOALNET_MESH, sideSlot(R)));
  }
  const netMat = netMaterial(nt, 0x1d2a22, 0.95);
  const nets = new THREE.Mesh(mergeGeometries(netGeos), netMat);
  nets.name = 'nets';
  nets.renderOrder = 3;
  nets.frustumCulled = false;
  group.add(nets);
  const goalNetMat = netMaterial(gt, 0xf2f2ee, 0.9);
  const goalNets = new THREE.Mesh(mergeGeometries(goalNetGeos), goalNetMat);
  goalNets.name = 'goalnets';
  goalNets.renderOrder = 2;
  goalNets.frustumCulled = false;
  group.add(goalNets);

  // Laufzeit-Update: Ausbeulung am Ball, Netze zwischen Kamera und Feld ausblenden
  const fadeFor = (cam) => {
    const f = [1, 1, 1, 1, 1, 1, 1, 1];
    const c = cam.position;
    if (c.z > hz) f[0] = 0.22; if (c.z < -hz) f[1] = 0.22;
    if (c.x > hx) f[2] = 0.22; if (c.x < -hx) f[3] = 0.22;
    if (c.y > top) f[4] = 0.16;
    if (c.x > hx + cage.gD) f[5] = 0.35; if (c.x < -hx - cage.gD) f[6] = 0.35;
    return f;
  };
  function update(ballNet, cam, noFade = false) {
    const f = noFade ? [1, 1, 1, 1, 1, 1, 1, 1] : fadeFor(cam); // Fan-Cam (Nacht 2d): durch Zaun und Netz, nichts ausblenden
    // Gestell zwischen Kamera und Feld ausblenden (Schnittansicht wie im TV-Bild)
    for (let i = 0; i < 5; i++) if (frames[i]) frames[i].visible = f[i] > 0.9;
    for (const m of [netMat, goalNetMat]) {
      m.uniforms.uFade.value = f;
      if (ballNet && ballNet.depth > 0.005) {
        m.uniforms.uHit.value.set(ballNet.x, ballNet.y, ballNet.z, ballNet.depth);
        m.uniforms.uHitN.value.set(...ballNet.n);
      } else m.uniforms.uHit.value.w = 0;
    }
  }
  return { group, update, turf, boards, nets, goalNets, frames, outer, lines };
}
