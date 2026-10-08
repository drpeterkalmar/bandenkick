// n4 Figuren ohne Browser, an den echten Rocketbox-Skeletten (tests/node/avatar_node.mjs lädt die GLBs ohne Texturen):
// Audit #8 – Begrenzungskugel reicht in allen Posen (jede Ecke der Figur liegt in der Kugel, mit der three.js je Bild prüft),
// Figuren außerhalb des Bildes animieren nur jedes 2. Bild (Zeit sammelt sich, Lage jedes Bild).
// Aufruf: node tests/node/avatar.test.mjs
import { report } from './report.mjs';

const { ladeAvatare } = await import('./avatar_node.mjs');
const { A, THREE } = await ladeAvatare();
const { Avatar, ROSTER, BOUND_R } = await import('../../src/render/avatars.js');

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);

export function spieler(o = {}) {
  return { face: 0, speed: 0, vx: 0, vz: 0, plant: 0, kickT: 9, kickFoot: 1, techT: 9, tech: '', hand: { mode: 'none', dx: 0, dz: 0, t: 0, T: 0.38 }, jumpY: 0, air: null, fall: null, slide: null, P: { slideGroundT: 0.6 }, ...o };
}
// Figur n Bilder lang in einer Pose stellen
function stelle(av, pl, n = 40, st = {}) { for (let i = 0; i < n; i++) av.update(1 / 60, pl, { x: 0, z: 0, keeper: false, t: st.t ?? 0, ...st }); av.root.updateMatrixWorld(true); }
// größter Abstand einer Ecke (jede 5.) vom Kugelmittelpunkt, relativ zum Radius (≤ 1 = drin)
const _v = new THREE.Vector3(), _c = new THREE.Vector3();
function fuellung(av) {
  let worst = 0;
  for (const m of av.meshes) {
    const s = m.boundingSphere, sc = m.matrixWorld.getMaxScaleOnAxis();
    _c.copy(s.center).applyMatrix4(m.matrixWorld);
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 5) { m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld); worst = Math.max(worst, _v.distanceTo(_c) / (s.radius * sc)); }
  }
  return worst;
}

const POSEN = {
  stehen: [spieler(), {}],
  sprint: [spieler({ speed: 7, vx: 7 }), {}],
  stemmschritt: [spieler({ speed: 5, vx: 5, plant: 1 }), {}],
  hechtsprung: [spieler({ hand: { mode: 'dive', dx: 0, dz: 1, t: 0.19, T: 0.38 } }), {}],
  am_boden: [spieler({ hand: { mode: 'ground', dx: 0, dz: -1, t: 0.1, T: 0.38 } }), {}],
  graetsche: [spieler({ slide: { phase: 'slide', t: 0.2 } }), {}],
  fallrueck: [spieler({ jumpY: 0.4, air: { go: true, tech: 'fallrueck', t0: 0, tc: 0.4, cy: 1.7 } }), { t: 0.4 }],
  flugkopf: [spieler({ jumpY: 0.3, air: { go: true, tech: 'flugkopf', t0: 0, tc: 0.4, cy: 0.9 } }), { t: 0.4 }],
  vollspann: [spieler({ speed: 3, vx: 3, kickT: 0.18, techT: 0.2, tech: 'vollspann' }), {}],
  ball_halten: [spieler(), { holding: true, keeper: true }],
};
let schlimmst = 0, wo = '';
for (const name of [...new Set(ROSTER.flat())]) {
  const av = new Avatar(A, name, 0, { shadows: false });
  if (name === 'Sports_Male_02') yes('Figur: alle Teil-Meshes mit Sichtbarkeitsprüfung und Kugel ≥ BOUND_R', av.meshes.every((m) => m.frustumCulled && m.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis() >= BOUND_R - 1e-6));
  for (const [pose, [pl, st]] of Object.entries(POSEN)) {
    stelle(av, pl, 40, st);
    const f = fuellung(av);
    if (f > schlimmst) { schlimmst = f; wo = `${name} ${pose}`; }
  }
}
check('Begrenzungskugel: größte Füllung über 6 Figuren × 10 Posen (≤ 1 = ganz drin)', schlimmst, 0, 1, '', wo);

// ohne cull: wie bisher
const av0 = new Avatar(A, 'Sports_Male_04', 1, { shadows: false, cull: false });
yes('?cull=0: Figuren wie bisher immer gezeichnet', av0.meshes.every((m) => !m.frustumCulled));

// Halbtakt außerhalb des Bildes
const av = new Avatar(A, 'Sports_Female_02', 1, { shadows: false });
let mix = 0; const orig = av.mixer.update.bind(av.mixer); av.mixer.update = (dt) => { mix++; return orig(dt); };
const pl = spieler({ speed: 4, vx: 4 });
for (let i = 0; i < 60; i++) av.update(1 / 60, pl, { x: i * 0.06, z: 0, sparen: true, t: 0 });
check('nicht im Bild: Mischer-Aufrufe in 60 Bildern', mix, 30, 30);
check('nicht im Bild: Lage trotzdem jedes Bild (x nach 60 Bildern)', av.root.position.x, 3.54, 3.54, 'm');
const ph0 = av.phase; mix = 0;
for (let i = 0; i < 60; i++) av.update(1 / 60, pl, { x: 0, z: 0, sparen: false, t: 0 });
check('im Bild: Mischer jedes Bild', mix, 60, 60);
// Phase läuft mit der gesammelten Zeit gleich schnell: 60 Bilder Halbtakt ≈ 60 Bilder Volltakt
const av2 = new Avatar(A, 'Sports_Female_02', 1, { shadows: false }), av3 = new Avatar(A, 'Sports_Female_02', 1, { shadows: false });
av2.phase = av3.phase = 0;
for (let i = 0; i < 60; i++) { av2.update(1 / 60, pl, { x: 0, z: 0, sparen: true, t: 0 }); av3.update(1 / 60, pl, { x: 0, z: 0, sparen: false, t: 0 }); }
check('Halbtakt: Laufphase gleich weit wie im Volltakt', Math.abs(av2.phase - av3.phase), 0, 1e-9, '', `Phase ${av3.phase.toFixed(3)}`);
void ph0;

const ok = report('n4 Figuren (Culling, Halbtakt)', rows, 'avatar');
process.exit(ok ? 0 : 1);
