// Menschen (Microsoft Rocketbox, MIT): 6 Avatare + Rocketbox-Bewegungen (Skelett „Bip01“, siehe tools/rb_to_glb.py).
// Laufen/Sprint als Blend nach Tempo, alle Laufzyklen phasengleich (linker Fuß vorn = Phase 0) und mit dem
// gemessenen Schrittweg abgespielt → kein Fußgleiten. Darüber prozedurale Schichten: Stemmschritt (Körper
// stemmt sich gegen die alte Laufrichtung), Schuss/Pass (Bein schwingt), Tormann (Bereitschaft, Ball halten,
// Hechtsprung, am Boden), Jubel/Klatschen. Trainingsleibchen in Teamfarbe wird aus dem Körpermesh erzeugt
// (Torso-Dreiecke, 2 cm nach außen, gleiche Knochen) → sitzt auf jeder Figur und bewegt sich mit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { AIR_POSE } from '../sim/technique.js';
import { figureShadowTexture, figureShadowGeometry } from './stimmung.js';
import { KTX2_AVATARE } from './avatar_ktx2.js';
import { zweiKnochen, bodenHub, kickGewicht, kickZiel, KICK_AN } from './ik.js';
import { federKrit, federKritVek } from './glatt.js';

export const TEAM_COLORS = [0xff6a13, 0x1f6fff];   // Leibchen: Orange / Blau (auch farbfehlsichtig gut trennbar)
export const TEAM_NAMES = ['Orange', 'Blau'];
// Aufstellung: je Mannschaft drei Figuren (Mannschaft 0 = links, Mensch)
export const ROSTER = [['Sports_Male_02', 'Sports_Female_02', 'Male_Adult_10'], ['Sports_Male_03', 'Female_Adult_12', 'Sports_Male_04']];
const LOCO = ['walk', 'jog', 'run', 'sprint'];
export const BOUND_R = 1.25; // m: Begrenzungskugel der Figuren um die Hüfte (Node-Test: schlimmste Pose füllt ~84 %)
const TORSO = new Set(['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_L_Clavicle', 'Bip01_R_Clavicle', 'Bip01_Pelvis']);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
// Fuß-IK (n4): Hilfswerte ohne Neuanlage je Bild
const IK = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), z: new THREE.Vector3(), p: new THREE.Vector3(), s: new THREE.Vector3(),
  qT: new THREE.Quaternion(), qC: new THREE.Quaternion(), qF: new THREE.Quaternion(), qP: new THREE.Quaternion(), qH: new THREE.Quaternion(), qK: new THREE.Quaternion(),
  hip: new THREE.Quaternion(), knee: new THREE.Quaternion() };
const BALL_R = 0.11;
// n5 (Peter: „Figurenbewegungen sehr abgehackt“): Lauf-Tempo für die Clip-Gewichte über eine kritisch gedämpfte Feder
// (Eigenkreisfrequenz W_LAUF 1/s: halber Weg nach ~0,09 s, kein Überschwingen) statt hart aus dem momentanen Tempo
const W_LAUF = 18;
const W_DREH = 30;   // Blickrichtung: Feder 1/s (halber Weg ~0,06 s) – Bots kehren die Drehung teils von Takt zu Takt um
const K_TECH = 20;   // Technik-Pose: Werte folgen dem Ziel mit 1/s (Wechsel Luftball → Schuss → am Boden ohne Sprung)
const W_IK = 25;     // Fuß-IK beim Ballkontakt: Versatz zum Ball über eine Feder (Dribbel-Kontakte folgen im 0,3-s-Takt) …
const IK_MAX = 0.3;  // … und höchstens 0,3 m weit: weiter in 2–3 Bildern zum Ball zu greifen ist selbst ein Sprung
const IKZ = [0, 0, 0];
// Sicherheitsnetz (Inertialisierung): springt ein Knochen (lokale Drehung) in einem Bild weiter als TR_GRENZE rad je 1/60 s
// bzw. der Körperschwerpunkt (Neigungs-Gruppe) weiter als TR_WEG m, hält die Figur die alte Pose als Versatz und baut ihn mit TR_TAU s ab – egal, welche
// Schicht gesprungen ist (Clip-Wechsel, Technik, Tormann-Rolle, IK an/aus). Echte schnelle Bewegungen bleiben darunter.
const TR_KNOCHEN = ['Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine2', 'Bip01_Head', 'Bip01_L_Thigh', 'Bip01_L_Calf', 'Bip01_L_Foot', 'Bip01_R_Thigh',
  'Bip01_R_Calf', 'Bip01_R_Foot', 'Bip01_L_UpperArm', 'Bip01_L_Forearm', 'Bip01_R_UpperArm', 'Bip01_R_Forearm'];
const TR_GRENZE = 0.25, TR_GRENZE_ARM = 0.5, TR_WEG = 0.06, TR_TAU = 0.05;
const _qi = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _va = new THREE.Vector3();
const TECH_WERTE = ['pitch', 'roll', 'drop', 'thigh', 'calf', 'twist', 'thigh2', 'arms', 'nod'];
const KERN = new Set([...LOCO, 'idle', 'crouch']);

// n4 (Audit #7): KTX2-Texturen, wenn tools/build_ktx2_avatars.mjs sie erzeugt hat (avatar_ktx2.js) und nicht ?ktx=0 –
// KTX2Loader mit detectSupport (ETC2/ASTC/BC je Gerät), bei Fehlern je Figur Rückfall auf die WebP-Fassung.
async function ktx2Lader(renderer) {
  const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
  return new KTX2Loader().setTranscoderPath('lib/three/addons/libs/basis/').detectSupport(renderer);
}
export async function loadAvatarAssets(onProgress = () => {}, opts = {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const names = [...new Set(ROSTER.flat())];
  let ktx = null;
  if (KTX2_AVATARE && opts.ktx !== false && opts.renderer) { try { ktx = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(await ktx2Lader(opts.renderer)); } catch (e) { ktx = null; } }
  const ladeFigur = (n) => (ktx && KTX2_AVATARE[n] ? ktx.loadAsync(KTX2_AVATARE[n]).then((g) => ((g.userData.ktx2 = true), g)).catch(() => loader.loadAsync(`assets/avatars/${n}.glb`)) : loader.loadAsync(`assets/avatars/${n}.glb`));
  let done = 0;
  const tick = () => onProgress(++done / (names.length + 2));
  const [anims, meta, avatars] = await Promise.all([
    Promise.all(['m', 'f'].map((s) => loader.loadAsync(`assets/anims/${s}.glb`).then((g) => (tick(), g)))),
    Promise.all(['m', 'f'].map((s) => fetch(`assets/anims/${s}.json`).then((r) => r.json()))),
    Promise.all(names.map((n) => ladeFigur(n).then((g) => (tick(), [n, g])))),
  ]);
  const A = { avatars: Object.fromEntries(avatars), clips: {}, meta: { m: meta[0], f: meta[1] }, phase: {} };
  A.ktx2 = avatars.filter(([, g]) => g.userData.ktx2).length;
  ['m', 'f'].forEach((s, i) => { A.clips[s] = Object.fromEntries(anims[i].animations.map((c) => [c.name, c])); });
  // Phase der Laufzyklen einmal je Geschlecht messen: Zeitpunkt, an dem der linke Fuß am weitesten vorn ist
  for (const s of ['m', 'f']) {
    const name = names.find((n) => sexOf(n) === s);
    const model = SkeletonUtils.clone(A.avatars[name].scene);
    const mixer = new THREE.AnimationMixer(model);
    const bones = boneMap(model);
    A.phase[s] = {};
    for (const c of LOCO) {
      const clip = A.clips[s][c];
      const act = mixer.clipAction(clip); act.play();
      let best = -1e9, bt = 0;
      for (let k = 0; k < 40; k++) {
        const t = clip.duration * k / 40;
        mixer.setTime(t); model.updateMatrixWorld(true);
        bones.Bip01_L_Foot.getWorldPosition(_v); bones.Bip01_Pelvis.getWorldPosition(_w);
        const fwd = _v.z - _w.z; // Modell blickt in +z
        if (fwd > best) { best = fwd; bt = k / 40; }
      }
      A.phase[s][c] = bt;
      act.stop();
    }
  }
  return A;
}

export function sexOf(name) { return /Female/.test(name) ? 'f' : 'm'; }
function boneMap(root) { const b = {}; root.traverse((o) => { if (o.isBone) b[o.name] = o; }); return b; }

// Trainingsleibchen aus dem Körpermesh: Dreiecke mit überwiegend Rumpf-Gewichten, 2 cm entlang der Normalen.
// Deko: num = Rückennummer (zylindrische Koordinaten um den Rumpf, Rücken = −z in der Ruhepose)
function makeBib(body, color, num = 0) {
  const geo = body.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, bones = body.skeleton.bones;
  const n = pos.count;
  // Ruhepose (frischer Klon, noch nicht animiert): Welt-Positionen für Maßstab und Zuschnitt. Achtung: nicht
  // skeleton.pose() aufrufen – die Entquantisierung steckt in den inversen Bind-Matrizen und landete sonst als
  // Skalierung in den Knochen (Figur schrumpft auf Zentimeter).
  let top = body; while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  const world = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, _v).applyMatrix4(body.matrixWorld); world[i * 3] = _v.x; world[i * 3 + 1] = _v.y; world[i * 3 + 2] = _v.z; }
  let ia = 0, ib = 0, far = 0;
  for (let i = 1; i < n; i += 7) { const d = Math.hypot(world[i * 3] - world[0], world[i * 3 + 1] - world[1], world[i * 3 + 2] - world[2]); if (d > far) { far = d; ib = i; } }
  const qd = Math.hypot(pos.getX(ib) - pos.getX(ia), pos.getY(ib) - pos.getY(ia), pos.getZ(ib) - pos.getZ(ia));
  const S = far / Math.max(qd, 1e-6); // Meter je quantisierter Einheit
  const pelvisY = bones.find((b) => b.name === 'Bip01_Pelvis').getWorldPosition(_w).y;
  const neckY = bones.find((b) => b.name === 'Bip01_Neck').getWorldPosition(_w).y;
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let torso = 0, arm = 0, leg = 0, head = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k); if (!w) continue;
      const nm = bones[si.getComponent(i, k)].name;
      if (TORSO.has(nm)) torso += w;
      else if (/UpperArm|Forearm|Hand|Finger/.test(nm)) arm += w;
      else if (/Thigh|Calf|Foot|Toe/.test(nm)) leg += w;
      else if (/Neck|Head/.test(nm)) head += w;
    }
    const y = world[i * 3 + 1];
    keep[i] = torso >= 0.62 && arm <= 0.22 && leg <= 0.3 && head <= 0.25 && y > pelvisY - 0.1 && y < neckY - 0.02 ? 1 : 0;
  }
  const idx = geo.index ? geo.index.array : null;
  const tri = [];
  const T = idx ? idx.length : n;
  for (let t = 0; t < T; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    if (keep[a] && keep[b] && keep[c]) tri.push(a, b, c);
  }
  const used = [...new Set(tri)], map = new Map(used.map((v, i) => [v, i]));
  const m = used.length;
  let cxm = 0, czm = 0; for (const i of used) { cxm += world[i * 3]; czm += world[i * 3 + 2]; } cxm /= m || 1; czm /= m || 1;
  const NUM = num ? new Float32Array(m * 2) : null, yNum = (pelvisY + neckY) / 2 + 0.03;
  const P = new Float32Array(m * 3), N = new Float32Array(m * 3), UV = new Float32Array(m * 2), SI = new Uint16Array(m * 4), SW = new Float32Array(m * 4);
  const off = 0.021 / S;
  for (let j = 0; j < m; j++) {
    const i = used[j];
    _v.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).normalize();
    const y = world[i * 3 + 1];
    const flare = y < pelvisY + 0.06 ? 1.6 : 1; // unten etwas weiter (lose Stoff-Kante)
    P[j * 3] = pos.getX(i) + _v.x * off * flare; P[j * 3 + 1] = pos.getY(i) + _v.y * off * flare; P[j * 3 + 2] = pos.getZ(i) + _v.z * off * flare;
    N[j * 3] = _v.x; N[j * 3 + 1] = _v.y; N[j * 3 + 2] = _v.z;
    // Stoff-Muster zylindrisch um den Rumpf (Weltmaß, 1 Kachel ≈ 12 cm)
    UV[j * 2] = Math.atan2(world[i * 3], world[i * 3 + 2]) / (2 * Math.PI) * 5.5; UV[j * 2 + 1] = y / 0.12;
    if (NUM) { // Rückennummer: ±0,45 rad um die Rückenmitte, 24 cm hoch
      let th = Math.atan2(world[i * 3] - cxm, world[i * 3 + 2] - czm) - Math.PI; while (th < -Math.PI) th += 2 * Math.PI;
      NUM[j * 2] = 0.5 + th / 0.9; NUM[j * 2 + 1] = (y - (yNum - 0.12)) / 0.24;
    }
    for (let k = 0; k < 4; k++) { SI[j * 4 + k] = si.getComponent(i, k); SW[j * 4 + k] = sw.getComponent(i, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setIndex(tri.map((v) => map.get(v)));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, map: bibTexture(), side: THREE.DoubleSide });
  if (NUM) {
    g.setAttribute('aNum', new THREE.BufferAttribute(NUM, 2));
    const numTex = numberTexture(num);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNum = { value: numTex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aNum; varying vec2 vNum;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvNum = aNum;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uNum; varying vec2 vNum;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (vNum.x > 0.0 && vNum.x < 1.0 && vNum.y > 0.0 && vNum.y < 1.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), texture2D(uNum, vNum).a * 0.95);`);
    };
    mat.customProgramCacheKey = () => 'bibNum';
  }
  const bib = new THREE.SkinnedMesh(g, mat);
  bib.name = 'bib';
  bib.position.copy(body.position); bib.quaternion.copy(body.quaternion); bib.scale.copy(body.scale);
  bib.bind(body.skeleton, body.bindMatrix);
  bib.frustumCulled = false;
  return bib;
}

// Rückennummer als kleine Textur (weiß, Rest durchsichtig)
function numberTexture(num) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const two = num > 9;
  g.font = `900 ${two ? 74 : 86}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  g.save(); g.translate(32, 50); if (two) g.scale(0.62, 1); g.fillText(String(num), 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

let _bibTex = null;
function bibTexture() { // Netzstoff: helle Grundfarbe mit feinen Löchern (Farbe kommt aus material.color)
  if (_bibTex) return _bibTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#9a9a9a';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 8 + 4 + (y % 2) * 4, y * 8 + 4, 1.6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, 64, 4);
  _bibTex = new THREE.CanvasTexture(c);
  _bibTex.wrapS = _bibTex.wrapT = THREE.RepeatWrapping; _bibTex.colorSpace = THREE.SRGBColorSpace; _bibTex.anisotropy = 4;
  return _bibTex;
}

// Blob-Schatten (Stufe mittel/niedrig) und Tormann-Bodenring
let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _blobTex = new THREE.CanvasTexture(c);
  return _blobTex;
}

export class Avatar {
  constructor(A, name, team, opts = {}) {
    this.name = name; this.team = team; this.sex = sexOf(name);
    this.model = SkeletonUtils.clone(A.avatars[name].scene);
    this.root = new THREE.Group(); this.root.name = 'avatar_' + name;
    this.tilt = new THREE.Group(); // Neigung (Hechtsprung, Stemmschritt) um den Körperschwerpunkt
    this.tilt.position.y = 0.95; this.model.position.y = -0.95 + 0.015; // Sohle liegt in der Ruhepose 1,5 cm tief
    this.tilt.add(this.model); this.root.add(this.tilt);
    this.bones = boneMap(this.model);
    this.meshes = [];
    this.model.traverse((o) => { if (o.isSkinnedMesh) { this.meshes.push(o); o.frustumCulled = false; } });
    this.cull = opts.cull !== false; // n4 (Audit #8): Sichtbarkeitsprüfung wieder an, ?cull=0 = aus wie bisher
    const body = this.meshes.find((m) => /body/.test(m.material.name)) || this.meshes[0];
    this.bib = makeBib(body, TEAM_COLORS[team], opts.deko && opts.deko.num);
    body.parent.add(this.bib);
    this.meshes.push(this.bib);
    // Tormann: leuchtende Handschuhe + Bodenring
    const gm = new THREE.MeshStandardMaterial({ color: 0xe8ff6a, emissive: 0xa8f000, emissiveIntensity: 1.25, roughness: 0.6 });
    this.gloves = ['Bip01_L_Hand', 'Bip01_R_Hand'].map((b) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8), gm); // Knochen-Raum ist in cm (Skalierung 0,01)
      s.scale.set(1.55, 0.7, 1.15); s.position.set(6.5, 0, 0); // flach wie eine Hand mit Handschuh
      this.bones[b].add(s); s.visible = false; return s;
    });
    const rm = new THREE.MeshBasicMaterial({ color: 0xd9ff3a, transparent: true, opacity: 0.75, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40).rotateX(-Math.PI / 2), rm);
    this.ring.position.y = 0.014; this.ring.renderOrder = 3; this.ring.visible = false;
    this.root.add(this.ring);
    // Deko: weicher Schatten in Lichtrichtung (dunkler Kern an den Füßen, Schweif vom Licht weg) statt runder Fleck
    const dk = opts.deko;
    this.blob = new THREE.Mesh(dk ? figureShadowGeometry() : new THREE.PlaneGeometry(1.05, 1.05).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: dk ? figureShadowTexture() : blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.blob.position.y = 0.006; this.blob.renderOrder = 1;
    this.shadowYaw = dk ? Math.atan2(dk.sunDir.z, -dk.sunDir.x) : null; // +x der Schattenebene zeigt vom Licht weg
    this.extShadow = !!(dk && dk.extShadow); // Deko: Schatten aller Spieler zeichnet abend.js in einem Draw-Call
    this.root.add(this.blob);
    // Animation
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = A.clips[this.sex]; this.meta = A.meta[this.sex]; this.phase0 = A.phase[this.sex];
    this.act = {};
    for (const [n, c] of Object.entries(this.clips)) { const a = this.mixer.clipAction(c); a.enabled = true; a.setEffectiveWeight(0); a.play(); this.act[n] = a; }
    for (const c of LOCO) this.act[c].timeScale = 0; // Zeit wird von Hand geführt (Phase)
    this.phase = Math.random();
    this.special = null; this.specialW = 0; this.specialName = '';
    this.ready = 0; this.lean = 0; this.leanSide = 0; this.dive = 0;
    this.prevFace = 0; this.turnRate = 0;
    // n5: glatt = geglättete Lauf-Gewichte, je Sonderbewegung eigenes Gewicht, geglättete Stemm-Neigung; ?glatt=0 = wie n4
    this.glatt = opts.glatt !== false;
    this.vGl = null; this.vGlV = 0; this.sonderW = {}; this.leanP = 0; this.leanR = 0; this.sofort = false;
    this.yawGl = null; this.yawV = 0; this.tpGl = null;
    this.ikOff = { L: [0, 0, 0], R: [0, 0, 0] }; this.ikVel = { L: [0, 0, 0], R: [0, 0, 0] };
    this.tr = null; this.trN = 0; this.diveSeite = null; this.traeg = opts.traeg !== false;
    this.touched = new Map(); // Knochen mit prozeduraler Zusatzdrehung → Mischer-Wert davor
    this.setShadows(!!opts.shadows);
    this.sparDt = 0; this.sparN = 0;
    if (this.cull) this.setBounds();
    // n4 Fuß-IK (Audit #5): Ruhehöhen von Knöchel und Zehen (Sohle auf dem Rasen) einmal messen; ?ik=0 = aus
    const beine = ['L', 'R'].every((s) => this.bones[`Bip01_${s}_Thigh`] && this.bones[`Bip01_${s}_Calf`] && this.bones[`Bip01_${s}_Foot`] && this.bones[`Bip01_${s}_Toe0`]);
    this.ik = opts.ik !== false && beine;
    if (beine) {
      this.root.updateMatrixWorld(true);
      const h = (n) => (this.bones[`Bip01_L_${n}`].getWorldPosition(_v).y + this.bones[`Bip01_R_${n}`].getWorldPosition(_w).y) / 2;
      this.ruhe = { knoechel: h('Foot'), zeh: h('Toe0') };
    }
    this.kickPunkt = null; this.ktPrev = 9; this.ikZeit = 0; this.ikN = 0;
  }

  // n4 (Audit #8): Begrenzungskugel je Teil-Mesh aus der Ruhepose, auf mindestens BOUND_R Meter (Welt) vergrößert, damit
  // Hechtsprung, Fallrückzieher und ausgestreckte Beine nicht abgeschnitten werden; danach prüft three.js je Bild (auch
  // für die Schattenkarte) per Kugel statt die Figur immer zu zeichnen. Die Kugel dreht und springt mit der Figur mit.
  setBounds(R = BOUND_R) {
    this.root.updateMatrixWorld(true);
    for (const m of this.meshes) {
      m.computeBoundingSphere();
      const sc = m.matrixWorld.getMaxScaleOnAxis() || 1;
      m.boundingSphere.radius = Math.max(m.boundingSphere.radius, R / sc);
      m.frustumCulled = true;
    }
  }
  setShadows(on) { this.shadowsOn = on; for (const m of this.meshes) m.castShadow = on; this.blob.visible = !on && !this.night && !this.extShadow && !this.contact; }
  // n4 Kino-Look: Kontaktschatten aller Figuren in einem Draw-Call (kino.js) statt des eigenen runden Flecks
  setContact(on) { this.contact = !!on; this.setShadows(!!this.shadowsOn); }
  // Deko-Abend: eigene Flutlicht-Schatten (abend.js) statt Fleck/Schattenkarte
  setNight(on, shadows) { this.night = on; this.setShadows(on ? false : shadows); }

  // Figur für den Sim-Zustand stellen. st: {x, z, face, speed, vx, vz, plant, plantX, plantZ, kickT, kickFoot,
  // hand, handT, holding, keeper, ready, cheer, human}
  // n5: Schnitt (Wiederholung beginnt/endet) – Glättungen springen im nächsten Bild direkt auf den neuen Zustand, statt
  // aus der alten Szene herüberzublenden (z. B. Jubel-Pose in den Anlauf der Wiederholung)
  schnitt() { this.sofort = true; this.vGl = null; this.yawGl = null; this.tpGl = null; this.ikNull(); this.tr = null; this.diveSeite = null; this.vGlV = 0; this.sonderW = {}; this.prevFace = null; this.turnRate = 0; this.kickPunkt = null; this.ktPrev = 9; }
  ikNull() { for (const s of ['L', 'R']) { this.ikOff[s].fill(0); this.ikVel[s].fill(0); } }
  update(dt, pl, st) {
    let face = st.face ?? pl.face; // n5: zwischen den Spieltakten interpoliert (main.js), sonst Stand des letzten Takts
    if (this.glatt) {
      if (this.yawGl === null) { this.yawGl = face; this.yawV = 0; }
      const ziel = this.yawGl + wrap(face - this.yawGl);
      const f = federKrit(this.yawGl, this.yawV, ziel, dt, W_DREH); this.yawGl = f[0]; this.yawV = f[1];
      face = this.yawGl;
    }
    // n4 (Audit #8): nicht im Bild (st.sparen) → Mischer und prozedurale Schichten nur jedes 2. Bild, die Zeit sammelt sich
    // (Phase, Drehrate und Überblendungen laufen mit der Summe weiter); Lage und Blickrichtung jedes Bild
    if (st.sparen) {
      this.sparDt += dt;
      this.sparN = (this.sparN + 1) % 2;
      if (this.sparN === 1) {
        this.root.position.set(st.x, pl.jumpY || 0, st.z); this.root.rotation.y = Math.PI / 2 - face;
        this.gespart = (this.gespart || 0) + 1;
        return;
      }
      dt = this.sparDt;
    }
    this.sparDt = 0;
    // Prozedurale Drehungen vom letzten Bild zurücknehmen: der Mischer schreibt einen Knochen nur, wenn sich sein
    // Animationswert ändert – bei statischen Spuren würde sich die Zusatzdrehung sonst Bild für Bild aufaddieren.
    for (const [b, q] of this.touched) b.quaternion.copy(q);
    this.touched.clear();
    this.root.position.set(st.x, 0, st.z);
    this.root.rotation.y = Math.PI / 2 - face;
    const sofort = this.sofort; this.sofort = false;
    const ds = sofort ? 1 : dt; // Glättungen: nach einem Schnitt sofort am Ziel
    const turn = this.prevFace === null ? 0 : wrap(face - this.prevFace) / Math.max(dt, 1e-3); this.prevFace = face;
    this.turnRate += (turn - this.turnRate) * Math.min(1, ds * 8);
    // ---- Lauf-Blend nach Tempo ----
    const v = pl.speed, M = this.meta;
    const sp = { walk: M.walk.speed, jog: M.jog.speed, run: M.run.speed, sprint: M.sprint.speed };
    const w = { idle: 0, walk: 0, jog: 0, run: 0, sprint: 0 };
    const vRoh = Math.max(v, Math.min(1.2, Math.abs(this.turnRate) * 0.35)); // auf der Stelle drehen = Trippeln
    let vEff = vRoh;
    if (this.glatt) {
      if (this.vGl === null) { this.vGl = vRoh; this.vGlV = 0; }
      const f = federKrit(this.vGl, this.vGlV, vRoh, dt, W_LAUF); this.vGl = Math.max(0, f[0]); this.vGlV = f[1];
      vEff = this.vGl;
    }
    if (vEff < 0.15) w.idle = 1;
    else if (vEff < sp.walk) { const k = vEff / sp.walk; w.idle = 1 - k; w.walk = k; }
    else if (vEff < sp.jog) { const k = (vEff - sp.walk) / (sp.jog - sp.walk); w.walk = 1 - k; w.jog = k; }
    else if (vEff < sp.run) { const k = (vEff - sp.jog) / (sp.run - sp.jog); w.jog = 1 - k; w.run = k; }
    else if (vEff < sp.sprint) { const k = (vEff - sp.run) / (sp.sprint - sp.run); w.run = 1 - k; w.sprint = k; }
    else w.sprint = 1;
    // Schrittweg je Zyklus (gemessenes Clip-Tempo × Dauer) → Phase so, dass die Füße nicht gleiten
    let cyc = 0, ws = 0;
    for (const c of LOCO) { cyc += w[c] * sp[c] * M[c].duration; ws += w[c]; }
    // Phase mit demselben (geglätteten) Tempo wie die Schrittlänge – mit dem rohen Tempo zappelten die Beine beim Antritt
    if (ws > 0.01) { cyc /= ws; this.phase = (this.phase + vEff * dt / Math.max(0.3, cyc)) % 1; }
    // Sonderbewegung (Jubel, Klatschen, Warten, Tormann bereit) überblendet alles
    const want = st.special || null;
    if (want !== this.specialName) {
      if (want && this.act[want]) { this.act[want].reset(); this.act[want].setLoop(THREE.LoopRepeat); }
      this.prevSpecial = this.specialName; this.specialName = want;
    }
    let sw;
    if (this.glatt) {
      // n5: je Sonderbewegung ein eigenes Gewicht – die alte blendet mit aus, statt sofort auf 0 zu fallen (vorher war die
      // Summe aller Gewichte beim Ende von Jubel/Klatschen kurz < 1 → Figur zog Richtung Ruhepose)
      let sum = 0;
      for (const n of Object.keys(this.act)) {
        if (KERN.has(n)) continue;
        const w0 = this.sonderW[n] || 0, ziel = n === want ? 1 : 0;
        const w1 = w0 + (ziel - w0) * Math.min(1, ds * 6);
        this.sonderW[n] = !ziel && w1 < 1e-3 ? 0 : w1; sum += this.sonderW[n];
      }
      if (sum > 1) { for (const n in this.sonderW) this.sonderW[n] /= sum; sum = 1; }
      this.specialW = sw = sum;
    } else {
      const target = want ? 1 : 0;
      this.specialW += (target - this.specialW) * Math.min(1, dt * 6);
      sw = this.specialW;
    }
    const lw = 1 - sw;
    for (const c of LOCO) { const a = this.act[c]; a.time = ((this.phase + this.phase0[c]) % 1) * this.clips[c].duration; a.setEffectiveWeight(w[c] * lw); }
    // Tormann-Bereitschaft: etwas in die Hocke (crouch-Clip leicht beigemischt)
    this.ready += ((st.ready ? 1 : 0) - this.ready) * Math.min(1, ds * 5);
    this.act.idle.setEffectiveWeight(w.idle * lw * (1 - this.ready * 0.4));
    this.act.crouch.setEffectiveWeight(w.idle * lw * this.ready * 0.4);
    for (const [n, a] of Object.entries(this.act)) {
      if (LOCO.includes(n) || n === 'idle' || n === 'crouch') continue;
      a.setEffectiveWeight(this.glatt ? this.sonderW[n] || 0 : n === this.specialName ? sw : 0);
    }
    this.mixer.update(dt);
    // ---- prozedurale Schichten (nach dem Mischer, im Weltraum der Figur) – nur wenn aktiv (spart Matrix-Updates) ----
    // Stemmschritt: Körper lehnt sich gegen die alte Laufrichtung (bis 22°), Hechtsprung: Rolle
    const plantK = Math.min(1, pl.plant || 0);
    this.lean += (plantK * 0.45 - this.lean) * Math.min(1, ds * 12);
    const diveMode = pl.hand && (pl.hand.mode === 'dive' || pl.hand.mode === 'ground');
    this.dive += ((diveMode ? 1 : 0) - this.dive) * Math.min(1, ds * (diveMode ? 9 : 4));
    const hold = st.holding ? 1 : 0;
    this.holdW = (this.holdW || 0) + (hold - (this.holdW || 0)) * Math.min(1, ds * 8);
    const kt = pl.kickT ?? 9;
    // n4: Ballkontakt merken (kickT springt auf ~0) → Ziel für die Fuß-IK des Schussbeins
    if (kt < this.ktPrev - 1e-4 && kt < 0.05 && st.ball && !sofort) { this.kickPunkt = [st.ball[0], st.ball[1], st.ball[2]]; this.kickVon = [st.x, 0, st.z]; }
    this.ktPrev = kt;
    // Technik-Pose (Nacht 2b, prozedural bis zu den Mixamo-Clips): Luftball im Anflug, am Boden danach, Kick-Arten
    const tp = techPose(pl, st.t ?? 0);
    this.tpW = (this.tpW || 0) + ((tp ? 1 : 0) - (this.tpW || 0)) * Math.min(1, ds * (tp ? 14 : 5));
    if (tp && this.glatt) {
      // n5: Ziel-Pose glätten – beim Ballkontakt wechselt z. B. die Luftball-Pose (Bein oben) in die Schuss-Pose (Bein
      // unten), vorher in einem Bild
      if (!this.tpGl || ds === 1 || this.tpW < 0.05) this.tpGl = { ...tp };
      const k = Math.min(1, ds * K_TECH), g = this.tpGl;
      for (const n of TECH_WERTE) g[n] = (g[n] || 0) + ((tp[n] || 0) - (g[n] || 0)) * k;
      g.legs = tp.legs; this.tp = g;
    } else if (tp) this.tp = tp;
    this.root.position.y = pl.jumpY || 0;
    const proc = plantK > 0.01 || this.lean > 0.01 || (this.schwung || 0) > 1e-3 || Math.abs(this.leanP) + Math.abs(this.leanR) > 0.01 || this.dive > 0.01 || kt < 0.4 || this.holdW > 0.01 || this.ready > 0.05 || this.tpW > 0.01;
    this.gloves[0].visible = this.gloves[1].visible = !!st.keeper;
    this.ring.visible = !!st.keeper;
    if (st.keeper) this.ring.material.opacity = 0.55 + 0.25 * Math.sin(performance.now() / 180);
    this.blob.scale.setScalar(1 + this.dive * 0.8);
    if (this.shadowYaw !== null) { this.blob.rotation.y = this.shadowYaw - this.root.rotation.y; this.blob.position.y = 0.006 - this.root.position.y; }
    if (!proc) { this.tilt.rotation.set(0, 0, 0); this.tilt.position.y = 0.95; if (this.glatt) { this.ikNull(); if (this.traeg) this.traegheit(dt, ds === 1); } return; }
    let roll = 0, pitch = 0;
    if (plantK > 0.01 || this.lean > 0.01) {
      // Neigung: nach hinten gegen die alte Bewegung (Körper-Koordinaten)
      const f = pl.face, vx = pl.vx, vz = pl.vz;
      const along = vx * Math.cos(f) + vz * Math.sin(f), side = -vx * Math.sin(f) + vz * Math.cos(f);
      const l = Math.hypot(along, side) || 1;
      // Oberkörper gegen die (alte) Geschwindigkeit: Füße stemmen vor dem Schwerpunkt (bis 26°)
      pitch = -this.lean * (along / l); roll = -this.lean * (side / l);
    }
    if (this.glatt) {
      // n5: Neigung als Vektor glätten – beim Stemmschritt kehrt sich die Bewegung um (Tempo geht durch 0), die Richtung
      // sprang dann in einem Bild von „nach hinten“ auf „nach vorn“
      const k = Math.min(1, ds * 12);
      this.leanP += (pitch - this.leanP) * k; this.leanR += (roll - this.leanR) * k;
      pitch = this.leanP; roll = this.leanR;
    }
    if (this.dive > 0.01) {
      const dx = pl.hand.dx, dz = pl.hand.dz;
      const side = -dx * Math.sin(pl.face) + dz * Math.cos(pl.face); // + = links der Blickrichtung
      // Nacht 2d: ausgestreckt – im Flug hebt der Körper im Bogen ab und liegt waagrecht (Rolle bis ~88°), danach flach
      // am Boden; Flugdauer je Hechtsprung (hand.T)
      const h = pl.hand, fl = h.mode === 'dive' ? Math.sin(Math.PI * Math.min(1, h.t / (h.T || 0.38))) : 0;
      // n5: Seite beim Absprung merken – beim Aufstehen dreht der Tormann sich, die Seite kippte dann in einem Bild um
      let seite = side >= 0 ? -1 : 1;
      if (this.glatt) { if (this.diveSeite === null || (this.dive < 0.05 && diveMode)) this.diveSeite = seite; seite = this.diveSeite; }
      roll = seite * (1.25 + 0.28 * fl) * this.dive;
      this.tilt.position.y = 0.95 - 0.55 * this.dive + 0.32 * fl;
    } else this.tilt.position.y = 0.95 - 0.08 * this.lean / 0.45; // im Stemmschritt leicht in die Knie
    // Technik-Pose überblendet Neigung/Absenken
    const T = this.tp, tw = this.tpW;
    if (T && tw > 0.01) {
      pitch = pitch * (1 - tw) + T.pitch * tw; roll = roll * (1 - tw) + T.roll * tw;
      this.tilt.position.y = this.tilt.position.y * (1 - tw) + (0.95 + T.drop) * tw;
    }
    this.tilt.rotation.set(pitch, 0, roll, 'YXZ');
    this.root.updateMatrixWorld(true);
    const leg = pl.kickFoot > 0 ? 'R' : 'L', other = leg === 'R' ? 'L' : 'R';
    if (this.glatt) {
      // n5: Technik-Beine und Schuss-Schwung mischen statt umschalten – vorher setzte der Schwung schlagartig ein, sobald
      // die Technik-Pose unter 1 % ausgeblendet war (und verschwand schlagartig, wenn eine Technik einsetzte)
      const tl = T && T.legs && tw > 0.001 ? tw : 0;
      if (tl) {
        this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'side', T.thigh * tl);
        if (T.calf) this.rotBoneWorld(`Bip01_${leg}_Calf`, 'side', T.calf * tl);
        if (T.twist) this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'up', T.twist * (leg === 'R' ? 1 : -1) * tl);
        if (T.thigh2) this.rotBoneWorld(`Bip01_${other}_Thigh`, 'side', T.thigh2 * tl);
        if (T.arms) for (const sd of ['L', 'R']) this.rotBoneWorld(`Bip01_${sd}_UpperArm`, 'side', -T.arms * tl);
        if (T.nod) this.rotBoneWorld('Bip01_Head', 'side', T.nod * tl);
      }
      // Schwung geglättet: beim Dribbeln setzt der nächste Kontakt ein, bevor der alte Schwung zu Ende ist (Bein schnappte zurück)
      const kZiel = kt < 0.4 ? Math.sin(Math.min(1, kt / 0.4) * Math.PI) * (1 - tl) : 0, cZiel = kt < 0.4 ? kZiel * (1 - kt / 0.4) : 0;
      const kk = Math.min(1, ds * 30);
      this.schwung = (this.schwung || 0) + (kZiel - (this.schwung || 0)) * kk; this.schwungC = (this.schwungC || 0) + (cZiel - (this.schwungC || 0)) * kk;
      if (this.schwung > 1e-3) {
        this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'side', -0.95 * this.schwung);
        this.rotBoneWorld(`Bip01_${leg}_Calf`, 'side', 0.5 * this.schwungC);
      }
    } else if (T && tw > 0.01 && T.legs) {
      // Beine/Arme der Technik (Schussbein hoch, Hacke nach hinten, Arme zum Ausgleich)
      this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'side', T.thigh * tw);
      if (T.calf) this.rotBoneWorld(`Bip01_${leg}_Calf`, 'side', T.calf * tw);
      if (T.twist) this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'up', T.twist * (leg === 'R' ? 1 : -1) * tw);
      if (T.thigh2) this.rotBoneWorld(`Bip01_${other}_Thigh`, 'side', T.thigh2 * tw);
      if (T.arms) for (const sd of ['L', 'R']) this.rotBoneWorld(`Bip01_${sd}_UpperArm`, 'side', -T.arms * tw);
      if (T.nod) this.rotBoneWorld('Bip01_Head', 'side', T.nod * tw);
    } else if (kt < 0.4) {
      // Schuss/Pass: Schussbein schwingt nach vorn
      const k = Math.sin(Math.min(1, kt / 0.4) * Math.PI);
      this.rotBoneWorld(`Bip01_${leg}_Thigh`, 'side', -0.95 * k);
      this.rotBoneWorld(`Bip01_${leg}_Calf`, 'side', 0.5 * k * (1 - kt / 0.4));
    }
    // Arme: Ball halten (vor der Brust), Hechtsprung (gestreckt über dem Kopf), bereit (leicht geöffnet)
    if (this.holdW > 0.01 || this.dive > 0.01 || this.ready > 0.05) {
      for (const s of ['L', 'R']) {
        const sg = s === 'L' ? 1 : -1;
        const up = this.dive * 2.4 + this.holdW * 0.72 + this.ready * 0.45 * (1 - this.dive);
        this.rotBoneWorld(`Bip01_${s}_UpperArm`, 'side', -up);
        this.rotBoneWorld(`Bip01_${s}_UpperArm`, 'fwd', sg * (this.holdW * 0.12 + this.ready * 0.35));
        if (this.holdW > 0.01) { this.rotBoneWorld(`Bip01_${s}_Forearm`, 'side', -0.55 * this.holdW); this.rotBoneWorld(`Bip01_${s}_Forearm`, 'up', sg * -0.38 * this.holdW); }
      }
    }
    if (this.ik) this.fussIK(pl, kt, dt);
    if (this.glatt && this.traeg) this.traegheit(dt, ds === 1);
  }

  // n5 Sicherheitsnetz (siehe TR_GRENZE): Eingang = fertige Pose dieses Bildes, Ausgang = Pose mit abklingendem Versatz
  traegheit(dt, neu) {
    const ziele = this._trZiele || (this._trZiele = [...TR_KNOCHEN.map((n) => this.bones[n]).filter(Boolean), this.tilt]);
    if (!this.tr || neu) {
      this.tr = ziele.map((b) => ({ ein: b.quaternion.clone(), aus: b.quaternion.clone(), ausV: b.quaternion.clone(), off: new THREE.Quaternion(), pEin: b.position.clone(), pOff: new THREE.Vector3(), pAus: b.position.clone(), pAusV: b.position.clone() }));
      return;
    }
    const f60 = Math.max(1, dt * 60), grenze = TR_GRENZE * f60, grenzeArm = TR_GRENZE_ARM * f60, weg = TR_WEG * f60, abkl = Math.exp(-dt / TR_TAU);
    for (let i = 0; i < ziele.length; i++) {
      const b = ziele[i], z = this.tr[i];
      const sprung = z.ein.angleTo(b.quaternion) > (i >= 10 && i < 14 ? grenzeArm : grenze); // Arme schwingen im Sprint schneller
      const pSprung = b === this.tilt && z.pEin.distanceTo(b.position) > weg; // Höhe/Absenken des Körpers (Hechtsprung, Technik)
      z.ein.copy(b.quaternion);
      // Versatz = die alte Bewegung ein Bild weitergeführt (Ausgabe + letzte Änderung) relativ zur neuen Pose – so bleibt die
      // Geschwindigkeit stetig, die Figur hält nicht kurz an
      if (sprung) { _qa.copy(z.aus).multiply(_qi.copy(z.ausV).invert()).multiply(z.aus); z.off.copy(_qa).multiply(_qi.copy(b.quaternion).invert()); this.trN++; }
      if (pSprung) { z.pOff.copy(z.pAus).multiplyScalar(2).sub(z.pAusV).sub(b.position); this.trN++; }
      z.pEin.copy(b.position);
      z.off.slerp(_qa.identity(), 1 - abkl); z.pOff.multiplyScalar(abkl);
      const aktiv = z.off.w < 0.99999 || z.pOff.lengthSq() > 1e-8;
      if (aktiv && b !== this.tilt && !this.touched.has(b)) this.touched.set(b, b.quaternion.clone());
      if (aktiv) {
        b.quaternion.premultiply(z.off);
        if (b === this.tilt) b.position.add(z.pOff);
      }
      z.ausV.copy(z.aus); z.aus.copy(b.quaternion); z.pAusV.copy(z.pAus); z.pAus.copy(b.position);
    }
  }

  // n4 Fuß-IK (Audit #5), nur wenn prozedurale Schichten aktiv sind (sonst stehen die Clips von selbst auf dem Boden):
  //  • Boden: aufrecht (kein Hechtsprung/Grätsche/Luftball/Liegen) dürfen Knöchel und Zehen nicht unter ihre Ruhehöhe –
  //    Stemmschritt und Rücklage drückten die Füße bisher in den Rasen. Nur anheben, nie herunterziehen.
  //  • Ballkontakt: das Schussbein (wie die Schwung-Schicht: kickFoot) greift beim Kontakt zum Kontaktpunkt aus der Simulation
  //    (Ball beim Sprung von kickT auf 0) und blendet in KICK_T = 0,12 s aus – der Fuß trifft den Ball sichtbar.
  fussIK(pl, kt, dt = 1 / 60) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const aufrecht = this.dive < 0.2 && !pl.slide && !pl.fall && !(pl.air && pl.air.go);
    const kw = this.kickPunkt ? kickGewicht(kt, this.glatt ? KICK_AN : 0) : 0;
    const rest = this.glatt && (Math.abs(this.ikOff.L[0]) + Math.abs(this.ikOff.L[1]) + Math.abs(this.ikOff.L[2]) + Math.abs(this.ikOff.R[0]) + Math.abs(this.ikOff.R[1]) + Math.abs(this.ikOff.R[2]) > 0.002);
    if (!aufrecht && kw <= 0 && !rest) return;
    const R = this.ruhe, yaw = this.root.rotation.y, pol = [Math.sin(yaw), 0, Math.cos(yaw)];
    const kickSeite = pl.kickFoot > 0 ? 'R' : 'L';
    for (const s of ['L', 'R']) {
      const T = this.bones[`Bip01_${s}_Thigh`], C = this.bones[`Bip01_${s}_Calf`], F = this.bones[`Bip01_${s}_Foot`], Z = this.bones[`Bip01_${s}_Toe0`];
      // Matrizen sind aktuell (updateMatrixWorld vor den Schichten, rotBoneWorld/IK aktualisieren ihre Teilbäume) → direkt
      // lesen statt getWorldPosition (das rechnet je Aufruf die ganze Elternkette neu: am Handy ~1 ms für 6 Figuren)
      IK.a.setFromMatrixPosition(T.matrixWorld); IK.b.setFromMatrixPosition(C.matrixWorld); IK.c.setFromMatrixPosition(F.matrixWorld);
      let tx = IK.c.x, ty = IK.c.y, tz = IK.c.z, an = false;
      const kick = kw > 0 && s === kickSeite;
      if (this.glatt) {
        // n5: Versatz zum Ball folgt einer Feder – bei Dribbel-Kontakten im 0,3-s-Takt und weit entferntem Ball sprang
        // der Fuß sonst in 1–2 Bildern bis 1 m
        if (kick) {
          const k = kickZiel(this.kickPunkt, this.kickVon, BALL_R, R.knoechel);
          IKZ[0] = (k[0] - tx) * kw; IKZ[1] = (k[1] - ty) * kw; IKZ[2] = (k[2] - tz) * kw;
          const l = Math.hypot(IKZ[0], IKZ[1], IKZ[2]); if (l > IK_MAX) { IKZ[0] *= IK_MAX / l; IKZ[1] *= IK_MAX / l; IKZ[2] *= IK_MAX / l; }
        } else IKZ[0] = IKZ[1] = IKZ[2] = 0;
        const o = this.ikOff[s];
        federKritVek(o, this.ikVel[s], IKZ, dt, W_IK);
        if (Math.abs(o[0]) + Math.abs(o[1]) + Math.abs(o[2]) > 0.001) { tx += o[0]; ty += o[1]; tz += o[2]; an = true; }
      } else if (kick) {
        const k = kickZiel(this.kickPunkt, this.kickVon, BALL_R, R.knoechel);
        tx += (k[0] - tx) * kw; ty += (k[1] - ty) * kw; tz += (k[2] - tz) * kw; an = true;
      }
      if (aufrecht && !kick && !(this.glatt && an && ty > IK.c.y + 0.02)) {
        IK.z.setFromMatrixPosition(Z.matrixWorld);
        const hub = bodenHub(IK.c.y, IK.z.y, R.knoechel - 0.01, R.zeh - 0.01, 0);
        if (hub > 0.002) { ty += hub; an = true; }
      }
      if (!an) continue;
      const L = zweiKnochen(IK.a.toArray(), IK.b.toArray(), IK.c.toArray(), [tx, ty, tz], pol);
      for (const b of [T, C, F]) if (!this.touched.has(b)) this.touched.set(b, b.quaternion.clone());
      T.matrixWorld.decompose(IK.p, IK.qT, IK.s); C.matrixWorld.decompose(IK.p, IK.qC, IK.s); F.matrixWorld.decompose(IK.p, IK.qF, IK.s);
      T.parent.matrixWorld.decompose(IK.p, IK.qP, IK.s);
      IK.qH.fromArray(L.qHuefte); IK.qK.fromArray(L.qKnie);
      IK.hip.multiplyQuaternions(IK.qH, IK.qT);                        // Oberschenkel neu (Welt)
      IK.knee.multiplyQuaternions(IK.qH, IK.qK).multiply(IK.qC);        // Unterschenkel neu (Welt)
      T.quaternion.copy(IK.qP.invert().multiply(IK.hip));
      C.quaternion.copy(IK.qP.copy(IK.hip).invert().multiply(IK.knee));
      F.quaternion.copy(IK.qP.copy(IK.knee).invert().multiply(IK.qF));  // Fuß behält seine Welt-Ausrichtung
      T.updateMatrixWorld(true);
      this.ikN++;
    }
    if (t0) this.ikZeit += performance.now() - t0;
  }

  // Knochen um eine Achse im Figuren-Raum drehen (unabhängig von den lokalen Achsen des Biped-Skeletts):
  // side = Querachse (Beugen/Strecken nach vorn), fwd = Längsachse, up = Hochachse
  rotBoneWorld(name, axis, ang) {
    const b = this.bones[name]; if (!b || !ang) return;
    if (!this.touched.has(b)) this.touched.set(b, b.quaternion.clone());
    const ax = axis === 'side' ? _v.set(1, 0, 0) : axis === 'fwd' ? _v.set(0, 0, 1) : _v.set(0, 1, 0);
    ax.applyQuaternion(this.root.quaternion); // Figuren-Achse in Welt (root hängt direkt in der Szene)
    b.parent.matrixWorld.decompose(_w, _q, _s); // Matrizen sind aktuell (updateMatrixWorld vor den Schichten)
    const local = ax.applyQuaternion(_q.invert());
    b.quaternion.premultiply(_q2.setFromAxisAngle(local.normalize(), ang));
    b.updateMatrixWorld(true);
  }
}

// Pose je Technik (Winkel in rad: pitch + = vorn über, roll + = zur rechten Seite; drop = Absenken des Schwerpunkts;
// thigh − = Oberschenkel nach vorn/oben, + = nach hinten; calf + = Unterschenkel beugen). null = keine Sonderpose.
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function techPose(pl, t) {
  const side = pl.kickFoot > 0 ? 1 : -1; // Schussbein rechts → Körper kippt nach links
  const sl = pl.slide;
  if (sl) { // Grätsche (Nacht 2c): zurückgelehnt, tief, führendes Bein gestreckt voraus, danach liegen und aufstehen
    if (sl.phase === 'slide') { const u = ease(sl.t / 0.12); return { pitch: -0.95 * u, roll: -side * 0.2 * u, drop: -0.62 * u, legs: true, thigh: -1.4 * u, calf: 0.05, thigh2: -0.45 * u, arms: 0.7 * u }; }
    const lie = 1 - ease((sl.t - ((pl.P && pl.P.slideGroundT) || 0.6) + 0.3) / 0.3);
    return { pitch: -0.95 * lie, roll: -side * 0.2 * lie, drop: -0.62 * lie, legs: true, thigh: -1.2 * lie, thigh2: -0.4 * lie, arms: 0.55 * lie };
  }
  const a = pl.air;
  if (a && a.go) {
    const u = ease((t - a.t0) / Math.max(0.05, a.tc - a.t0)); // 0 Absprung … 1 Treffpunkt
    switch (a.tech) {
      case 'fallrueck': { // Hüfte so tief, dass der Fuß des über den Kopf schwingenden Beins den Ball trifft
        const A = AIR_POSE.fallrueck, drop = (a.cy ?? 1.4) - A.hipBelow - 0.95 - (pl.jumpY || 0);
        return { pitch: A.pitch * u, roll: 0, drop: drop * u, legs: true, thigh: -2.12 * u, thigh2: -0.6 * u, calf: 0.1, arms: 0.9 * u };
      }
      case 'seitfall': { const A = AIR_POSE.seitfall; return { pitch: A.pitch * u, roll: -side * A.roll * u, drop: A.drop * u, legs: true, thigh: -0.5 - 1.3 * u, thigh2: -0.3 * u, arms: 0.7 * u }; }
      case 'flugkopf': { const A = AIR_POSE.flugkopf; return { pitch: A.pitch * u, roll: 0, drop: A.drop * u, legs: true, thigh: 0.35 * u, thigh2: 0.35 * u, arms: -0.4 * u, nod: -0.3 * u }; }
      case 'kopf': return { pitch: -0.25 * (1 - u) + 0.35 * u, roll: 0, drop: 0, legs: true, thigh: -0.3 * u, arms: 0.8 * (1 - u) + 0.3, nod: 0.45 * u };
      default: return { pitch: -0.3 * u, roll: -side * 0.15 * u, drop: -0.05 * u, legs: true, thigh: 0.4 - 1.7 * u, calf: 0.9 * (1 - u), arms: 0.5 * u }; // Volley/Dropkick: ausholen, durchziehen
    }
  }
  const f = pl.fall;
  if (f) { // am Boden nach dem Luftball, zum Schluss aufstehen
    const up = ease((f.t - (f.dur - 0.35)) / 0.35), lie = 1 - up;
    if (f.tech === 'fallrueck') return { pitch: -1.5 * lie, roll: 0, drop: -0.72 * lie, legs: true, thigh: -0.9 * lie, thigh2: -0.5 * lie, arms: 0.5 * lie };
    if (f.tech === 'seitfall') return { pitch: 0, roll: -side * 1.45 * lie, drop: -0.72 * lie, legs: true, thigh: -0.6 * lie, arms: 0.4 * lie };
    return { pitch: 1.5 * lie, roll: 0, drop: -0.74 * lie, legs: true, thigh: 0.2 * lie, arms: -0.6 * lie }; // Flugkopfball: bäuchlings
  }
  const k = pl.techT ?? 9;
  if (k < 0.45) {
    const u = Math.sin(Math.min(1, k / 0.45) * Math.PI);
    switch (pl.tech) {
      case 'ferse': return { pitch: 0.1 * u, roll: 0, drop: 0, legs: true, thigh: 0.75 * u, calf: 1.3 * u };
      case 'chip': return { pitch: -0.12 * u, roll: 0, drop: -0.03 * u, legs: true, thigh: -0.75 * u, calf: 0.25 * u };
      case 'aussen': case 'aussenrist': return { pitch: -0.05 * u, roll: side * 0.12 * u, drop: 0, legs: true, thigh: -0.9 * u, twist: 0.55 * u, calf: 0.3 * u };
      case 'innen': case 'innenrist': return { pitch: -0.05 * u, roll: -side * 0.12 * u, drop: 0, legs: true, thigh: -0.9 * u, twist: -0.6 * u, calf: 0.3 * u };
      case 'vollspann': return { pitch: -0.12 * u, roll: 0, drop: -0.03 * u, legs: true, thigh: -1.15 * u, calf: 0.5 * u * (1 - k / 0.45), arms: 0.35 * u };
      case 'brust': return { pitch: -0.32 * u, roll: 0, drop: -0.04 * u, legs: true, thigh: 0, arms: 0.6 * u };
      case 'oberschenkel': return { pitch: -0.08 * u, roll: 0, drop: 0, legs: true, thigh: -1.0 * u, calf: 0.9 * u };
      case 'kopf': return { pitch: 0.3 * u, roll: 0, drop: 0, legs: true, thigh: 0, nod: 0.4 * u, arms: 0.3 * u };
      case 'volley': case 'dropkick': return { pitch: -0.3 * u, roll: -side * 0.15 * u, drop: -0.05 * u, legs: true, thigh: -1.3 * u, arms: 0.5 * u };
      case 'stolpern': return { pitch: 0.5 * u, roll: side * 0.15 * u, drop: -0.12 * u, legs: true, thigh: 0.35 * u, calf: 0.6 * u, arms: 0.9 * u }; // nach Grätsche des Gegners
      default: return null;
    }
  }
  return null;
}

function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
void _m;
