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

export const TEAM_COLORS = [0xff6a13, 0x1f6fff];   // Leibchen: Orange / Blau (auch farbfehlsichtig gut trennbar)
export const TEAM_NAMES = ['Orange', 'Blau'];
// Aufstellung: je Mannschaft drei Figuren (Mannschaft 0 = links, Mensch)
export const ROSTER = [['Sports_Male_02', 'Sports_Female_02', 'Male_Adult_10'], ['Sports_Male_03', 'Female_Adult_12', 'Sports_Male_04']];
const LOCO = ['walk', 'jog', 'run', 'sprint'];
const TORSO = new Set(['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_L_Clavicle', 'Bip01_R_Clavicle', 'Bip01_Pelvis']);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

export async function loadAvatarAssets(onProgress = () => {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const names = [...new Set(ROSTER.flat())];
  let done = 0;
  const tick = () => onProgress(++done / (names.length + 2));
  const [anims, meta, avatars] = await Promise.all([
    Promise.all(['m', 'f'].map((s) => loader.loadAsync(`assets/anims/${s}.glb`).then((g) => (tick(), g)))),
    Promise.all(['m', 'f'].map((s) => fetch(`assets/anims/${s}.json`).then((r) => r.json()))),
    Promise.all(names.map((n) => loader.loadAsync(`assets/avatars/${n}.glb`).then((g) => (tick(), [n, g])))),
  ]);
  const A = { avatars: Object.fromEntries(avatars), clips: {}, meta: { m: meta[0], f: meta[1] }, phase: {} };
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

// Trainingsleibchen aus dem Körpermesh: Dreiecke mit überwiegend Rumpf-Gewichten, 2 cm entlang der Normalen
function makeBib(body, color) {
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
  const bib = new THREE.SkinnedMesh(g, mat);
  bib.name = 'bib';
  bib.position.copy(body.position); bib.quaternion.copy(body.quaternion); bib.scale.copy(body.scale);
  bib.bind(body.skeleton, body.bindMatrix);
  bib.frustumCulled = false;
  return bib;
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
    const body = this.meshes.find((m) => /body/.test(m.material.name)) || this.meshes[0];
    this.bib = makeBib(body, TEAM_COLORS[team]);
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
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.blob.position.y = 0.006; this.blob.renderOrder = 1;
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
    this.touched = new Map(); // Knochen mit prozeduraler Zusatzdrehung → Mischer-Wert davor
    this.setShadows(!!opts.shadows);
  }

  setShadows(on) { for (const m of this.meshes) m.castShadow = on; this.blob.visible = !on; }

  // Figur für den Sim-Zustand stellen. st: {x, z, face, speed, vx, vz, plant, plantX, plantZ, kickT, kickFoot,
  // hand, handT, holding, keeper, ready, cheer, human}
  update(dt, pl, st) {
    // Prozedurale Drehungen vom letzten Bild zurücknehmen: der Mischer schreibt einen Knochen nur, wenn sich sein
    // Animationswert ändert – bei statischen Spuren würde sich die Zusatzdrehung sonst Bild für Bild aufaddieren.
    for (const [b, q] of this.touched) b.quaternion.copy(q);
    this.touched.clear();
    this.root.position.set(st.x, 0, st.z);
    this.root.rotation.y = Math.PI / 2 - pl.face;
    const turn = wrap(pl.face - this.prevFace) / Math.max(dt, 1e-3); this.prevFace = pl.face;
    this.turnRate += (turn - this.turnRate) * Math.min(1, dt * 8);
    // ---- Lauf-Blend nach Tempo ----
    const v = pl.speed, M = this.meta;
    const sp = { walk: M.walk.speed, jog: M.jog.speed, run: M.run.speed, sprint: M.sprint.speed };
    const w = { idle: 0, walk: 0, jog: 0, run: 0, sprint: 0 };
    const vEff = Math.max(v, Math.min(1.2, Math.abs(this.turnRate) * 0.35)); // auf der Stelle drehen = Trippeln
    if (vEff < 0.15) w.idle = 1;
    else if (vEff < sp.walk) { const k = vEff / sp.walk; w.idle = 1 - k; w.walk = k; }
    else if (vEff < sp.jog) { const k = (vEff - sp.walk) / (sp.jog - sp.walk); w.walk = 1 - k; w.jog = k; }
    else if (vEff < sp.run) { const k = (vEff - sp.jog) / (sp.run - sp.jog); w.jog = 1 - k; w.run = k; }
    else if (vEff < sp.sprint) { const k = (vEff - sp.run) / (sp.sprint - sp.run); w.run = 1 - k; w.sprint = k; }
    else w.sprint = 1;
    // Schrittweg je Zyklus (gemessenes Clip-Tempo × Dauer) → Phase so, dass die Füße nicht gleiten
    let cyc = 0, ws = 0;
    for (const c of LOCO) { cyc += w[c] * sp[c] * M[c].duration; ws += w[c]; }
    if (ws > 0.01) { cyc /= ws; this.phase = (this.phase + vEff * dt / Math.max(0.3, cyc)) % 1; }
    // Sonderbewegung (Jubel, Klatschen, Warten, Tormann bereit) überblendet alles
    const want = st.special || null;
    if (want !== this.specialName) {
      if (want && this.act[want]) { this.act[want].reset(); this.act[want].setLoop(THREE.LoopRepeat); }
      this.prevSpecial = this.specialName; this.specialName = want;
    }
    const target = want ? 1 : 0;
    this.specialW += (target - this.specialW) * Math.min(1, dt * 6);
    const sw = this.specialW, lw = 1 - sw;
    for (const c of LOCO) { const a = this.act[c]; a.time = ((this.phase + this.phase0[c]) % 1) * this.clips[c].duration; a.setEffectiveWeight(w[c] * lw); }
    // Tormann-Bereitschaft: etwas in die Hocke (crouch-Clip leicht beigemischt)
    this.ready += ((st.ready ? 1 : 0) - this.ready) * Math.min(1, dt * 5);
    this.act.idle.setEffectiveWeight(w.idle * lw * (1 - this.ready * 0.4));
    this.act.crouch.setEffectiveWeight(w.idle * lw * this.ready * 0.4);
    for (const [n, a] of Object.entries(this.act)) {
      if (LOCO.includes(n) || n === 'idle' || n === 'crouch') continue;
      a.setEffectiveWeight(n === this.specialName ? sw : n === this.prevSpecial ? 0 : 0);
    }
    this.mixer.update(dt);
    // ---- prozedurale Schichten (nach dem Mischer, im Weltraum der Figur) – nur wenn aktiv (spart Matrix-Updates) ----
    // Stemmschritt: Körper lehnt sich gegen die alte Laufrichtung (bis 22°), Hechtsprung: Rolle
    const plantK = Math.min(1, pl.plant || 0);
    this.lean += (plantK * 0.38 - this.lean) * Math.min(1, dt * 12);
    const diveMode = pl.hand && (pl.hand.mode === 'dive' || pl.hand.mode === 'ground');
    this.dive += ((diveMode ? 1 : 0) - this.dive) * Math.min(1, dt * (diveMode ? 9 : 4));
    const hold = st.holding ? 1 : 0;
    this.holdW = (this.holdW || 0) + (hold - (this.holdW || 0)) * Math.min(1, dt * 8);
    const kt = pl.kickT ?? 9;
    const proc = plantK > 0.01 || this.lean > 0.01 || this.dive > 0.01 || kt < 0.4 || this.holdW > 0.01 || this.ready > 0.05;
    this.gloves[0].visible = this.gloves[1].visible = !!st.keeper;
    this.ring.visible = !!st.keeper;
    if (st.keeper) this.ring.material.opacity = 0.55 + 0.25 * Math.sin(performance.now() / 180);
    this.blob.scale.setScalar(1 + this.dive * 0.8);
    if (!proc) { this.tilt.rotation.set(0, 0, 0); this.tilt.position.y = 0.95; return; }
    let roll = 0, pitch = 0;
    if (plantK > 0.01 || this.lean > 0.01) {
      // Neigung: nach hinten gegen die alte Bewegung (Körper-Koordinaten)
      const f = pl.face, vx = pl.vx, vz = pl.vz;
      const along = vx * Math.cos(f) + vz * Math.sin(f), side = -vx * Math.sin(f) + vz * Math.cos(f);
      const l = Math.hypot(along, side) || 1;
      pitch = -this.lean * (along / l); roll = this.lean * (side / l) * 0.8;
    }
    if (this.dive > 0.01) {
      const dx = pl.hand.dx, dz = pl.hand.dz;
      const side = -dx * Math.sin(pl.face) + dz * Math.cos(pl.face); // + = links der Blickrichtung
      roll = (side >= 0 ? -1 : 1) * 1.25 * this.dive;
      this.tilt.position.y = 0.95 - 0.55 * this.dive;
    } else this.tilt.position.y = 0.95;
    this.tilt.rotation.set(pitch, 0, roll, 'YXZ');
    this.root.updateMatrixWorld(true);
    // Schuss/Pass: Schussbein schwingt nach vorn
    if (kt < 0.4) {
      const k = Math.sin(Math.min(1, kt / 0.4) * Math.PI);
      const leg = pl.kickFoot > 0 ? 'R' : 'L';
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

function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
void _m;
