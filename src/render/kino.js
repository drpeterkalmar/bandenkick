// Kino-Look-Anschluss für Bandenkick (n4-Technik, Audit #1): erzeugt den KinoLook aus dem Grafik-Kern
// (kern/kinolook.js, Kopie aus der Stuntbahn) mit den Bandenkick-Stufen (kino_logik.js) und zeichnet Kontaktschatten unter
// Ball und Spielern (ein Draw-Call für alle, ersetzt den Ball-Blob und – ohne Deko – die runden Flecken der Figuren).
// ?kino=0 = alter Weg (direktes Zeichnen, Blob-Schatten), ?look=0|1|2 Stufe erzwingen, ?kl=-bloom,+flare einzelne Stufen.
import * as THREE from 'three';
import { KinoLook, GRADES } from './kern/kinolook.js';
import { BK_PRESETS, BK_GRADES, lichtLook, kinoStufe, kontaktFigur, kontaktBall } from './kino_logik.js';

Object.assign(GRADES, BK_GRADES);

export function makeKino(renderer, level, o) {
  const kino = new KinoLook(renderer, { level: kinoStufe(level, o), grade: 'tv', stages: o.stages, presets: BK_PRESETS, aerial: { density: 0, max: 0 } });
  kino.forced = o.look != null;
  kinoLicht(kino, 'tag');
  return kino;
}
// Grafikstufe des Spiels → Kino-Stufe (außer mit ?look=); Bloom/Farbe passen sich der Stufe an
export function kinoStufeSetzen(kino, level) {
  if (!kino || kino.forced) return;
  kino.setLevel(level);
  kinoLicht(kino, kino.licht || 'tag');
}
export function kinoLicht(kino, licht) {
  if (!kino) return;
  const L = lichtLook(licht, kino.level);
  kino.licht = licht; kino.grade = L.grade; kino.bloomThreshold = L.bloomThreshold; kino.bloomStrength = L.bloomStrength;
}

// Weicher, dunkler Fleck (radial, dichter Kern) – eine kleine Datentextur für alle Kontaktschatten
let _tex = null;
function kontaktTextur() {
  if (_tex) return _tex;
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N * 2 - 1, z = (j + 0.5) / N * 2 - 1, r = Math.min(1, Math.hypot(x, z));
    const a = (1 - r) ** 1.6 * (0.62 + 0.38 * (1 - r));
    d[(j * N + i) * 4 + 3] = Math.round(255 * Math.min(1, a));
  }
  _tex = new THREE.DataTexture(d, N, N);
  _tex.magFilter = _tex.minFilter = THREE.LinearFilter; _tex.needsUpdate = true;
  return _tex;
}

// Kontaktschatten aller Figuren + Ball als InstancedMesh (Deckkraft je Instanz über instanceColor.r)
export class KontaktSchatten {
  constructor(figs, ballR, opacity = 0.6) {
    this.figs = figs; this.ballR = ballR; this.n = figs.length + 1; this.night = false;
    this.mat = new THREE.MeshBasicMaterial({ map: kontaktTextur(), color: 0x000000, transparent: true, opacity, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#ifdef USE_COLOR\n  diffuseColor.a *= vColor.r;\n#endif');
    };
    this.mat.customProgramCacheKey = () => 'kontaktschatten';
    this.base = opacity;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.mat, this.n);
    this.mesh.name = 'kontaktschatten'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 3).fill(1), 3);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._y = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
  }
  _set(k, x, z, yaw, sx, sz, a) {
    this._p.set(x, 0.005, z); this._q.setFromAxisAngle(this._y, yaw); this._s.set(sx, 1, sz);
    this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(k, this._m);
    this.mesh.setColorAt(k, this._c.setRGB(a, a, a));
  }
  // je Bild nach dem Stellen der Figuren: Figuren (root, dive, jumpY über root.position.y) und Ball (x, y, z)
  update(bx, by, bz) {
    this.mat.opacity = this.base * (this.night ? 0.8 : 1);
    let k = 0;
    for (const f of this.figs) {
      const r = f.root;
      if (!r.visible) { this._set(k++, 0, 0, 0, 0, 0, 0); continue; }
      const K = kontaktFigur(r.position.y, f.dive || 0);
      // Figur blickt in +z des Modells (root.rotation.y = π/2 − face) → lange Achse auf z
      this._set(k++, r.position.x, r.position.z, r.rotation.y, K.quer, K.laengs, K.a);
    }
    const B = kontaktBall(by, this.ballR);
    this._set(k, bx, bz, 0, B.s, B.s, B.a);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
