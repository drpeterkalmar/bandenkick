// n10 Kindchenschema (Peter 02.11.2026: „tiere haben größere köpfe und kürzere ärmchen und beinchen“): neue Kuscheltiere
// (assets/kuscheltiere) gegen die Proportionen von 0.7.0 (assets/kuscheltiere_n9, ?tierform=0). Prüft Kopf-Volumen, Arm- und
// Beinlänge, Sohle, liegend nicht tiefer im Rasen, Tatzen gleiten beim Laufen nicht mehr als vorher, Kopfball erreicht den
// Ball (Hüpfer), Ball in den Pfoten des Tormanns, Regler. Aufruf: node tests/node/tierform.test.mjs
import { report } from './report.mjs';
import { spieler } from './avatar_spieler.mjs';

const { ladeAvatare } = await import('./avatar_node.mjs');
const { SAETZE, Avatar, ORDNER_TIERFORM0 } = await import('../../src/render/avatars.js');
const NAMEN = [...new Set(SAETZE.kuscheltiere.roster.flat())];
const NEU = (await ladeAvatare(NAMEN)).A, { A: ALT, THREE } = await ladeAvatare(NAMEN, { tierform: 0 });

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);
const f = (x, d = 2) => x.toFixed(d).replace('.', ',');
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

yes('?tierform=0 lädt die Figuren von 0.7.0', ORDNER_TIERFORM0 === 'assets/kuscheltiere_n9');

// Ruhepose: Kopf-Volumen (Punkte ganz am Kopf-Knochen, Hüllquader), Arm- und Beinlänge (Gelenkabstände), Sohle
function ruhe(A, n) {
  const sc = A.avatars[n].scene; sc.updateMatrixWorld(true);
  const box = new THREE.Box3(), J = {}; let sohle = 9;
  sc.traverse((o) => { if (o.isBone) J[o.name] = o.getWorldPosition(new THREE.Vector3()); });
  sc.traverse((o) => {
    if (!o.isSkinnedMesh || o.material.name === 'leibchen') return;
    const g = o.geometry, ji = g.attributes.skinIndex, wi = g.attributes.skinWeight, kopf = o.skeleton.bones.findIndex((b) => b.name === 'Bip01_Head');
    for (let i = 0; i < g.attributes.position.count; i++) {
      o.getVertexPosition(i, _v).applyMatrix4(o.matrixWorld); sohle = Math.min(sohle, _v.y);
      if (ji.getX(i) === kopf && wi.getX(i) > 0.99) box.expandByPoint(_v);
    }
  });
  const s = box.getSize(new THREE.Vector3()), d = (a, b) => J[a].distanceTo(J[b]);
  return { kopf: s.x * s.y * s.z, arm: d('Bip01_L_UpperArm', 'Bip01_L_Forearm') + d('Bip01_L_Forearm', 'Bip01_L_Hand'), bein: d('Bip01_L_Thigh', 'Bip01_L_Calf') + d('Bip01_L_Calf', 'Bip01_L_Foot'), sohle };
}
const R = NAMEN.map((n) => [n, ruhe(ALT, n), ruhe(NEU, n)]);
const q = (k) => R.map(([, a, b]) => b[k] / a[k]);
// n13 (Peter 07.11.: „noch niedlicher“): zweite Stufe – Kopf × 1,3 (n10: 1,11), Ärmchen/Beinchen × 0,62 (n10: 0,75); ?tierform=1 = n10
check('Kopf-Volumen neu ÷ 0.7.0 (alle 6 Tiere, kleinster Wert; n13 Kopf × 1,3 → ≈ × 2)', Math.min(...q('kopf')), 1.8, 2.3, '×', R.map(([n], i) => `${n} ${f(q('kopf')[i])}`).join(', '));
check('Arme (Ober- + Unterarm) neu ÷ 0.7.0 (größter Wert)', Math.max(...q('arm')), 0.58, 0.66, '×', `alle ${f(Math.min(...q('arm')))}–${f(Math.max(...q('arm')))}`);
check('Beine (Ober- + Unterschenkel) neu ÷ 0.7.0 (größter Wert)', Math.max(...q('bein')), 0.58, 0.66, '×', `alle ${f(Math.min(...q('bein')))}–${f(Math.max(...q('bein')))}`);
check('Sohle in der Ruhepose (tiefster Punkt, wie 0.7.0 ≈ −1,2 cm)', Math.min(...R.map(([, , b]) => b.sohle)) * 100, -2.5, -0.5, 'cm');

// Bewegungen: liegend nicht tiefer im Rasen, Kopfball, Ball halten
const POSEN = {
  hechtsprung: spieler({ hand: { mode: 'dive', dx: 0, dz: 1, t: 0.19, T: 0.38 } }), am_boden: spieler({ hand: { mode: 'ground', dx: 0, dz: -1, t: 0.1, T: 0.38 } }),
  graetsche: spieler({ slide: { phase: 'slide', t: 0.2 } }), liegen_fallrueck: spieler({ fall: { tech: 'fallrueck', t: 0.2, dur: 0.8 } }),
  liegen_flugkopf: spieler({ fall: { tech: 'flugkopf', t: 0.2, dur: 0.8 } }),
};
const tiefster = (av) => { let t = 9; av.root.updateMatrixWorld(true); for (const m of av.meshes) { const n = m.geometry.attributes.position.count; for (let i = 0; i < n; i += 2) { m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld); t = Math.min(t, _v.y); } } return t; };
let schlechter = -9, wo = '';
for (const n of NAMEN) for (const [pose, pl] of Object.entries(POSEN)) {
  const t = [ALT, NEU].map((A) => { const av = new Avatar(A, n, 0, { shadows: false }); for (let i = 0; i < 40; i++) av.update(1 / 60, pl, { x: 0, z: 0, t: 0 }); return tiefster(av); });
  const d = Math.min(t[0], 0) - t[1]; // nur „tiefer im Rasen“ zählt (über dem Rasen ist egal)
  if (d > schlechter) { schlechter = d; wo = `${n} ${pose}: tiefster Punkt 0.7.0 ${f(t[0] * 100, 1)} cm, neu ${f(t[1] * 100, 1)} cm`; }
}
check('liegend (Hechtsprung, am Boden, Grätsche, nach Fallrückzieher/Flugkopfball): höchstens 2 cm tiefer im Rasen als 0.7.0', schlechter * 100, -99, 2, 'cm', wo);

// Kopfball im Stand: der Kopf kommt (mit Hüpfer) so hoch wie mit langen Beinen – die Sim-Höhe des Balls bleibt
const kopfY = (A, n) => { const av = new Avatar(A, n, 0, { shadows: false }); let m = 0; for (let i = 0; i < 30; i++) { av.update(1 / 60, spieler({ techT: i / 60, tech: 'kopf' }), { x: 0, z: 0, t: i / 60 }); av.root.updateMatrixWorld(true); m = Math.max(m, av.bones.Bip01_Head.getWorldPosition(_v).y); } return m; };
const dK = NAMEN.map((n) => kopfY(NEU, n) - kopfY(ALT, n));
check('Kopfball im Stand: höchster Kopf neu − 0.7.0 (Hüpfer gleicht die kürzeren Beine aus)', Math.min(...dK) * 100, -8, 8, 'cm', `bis ${f(Math.max(...dK) * 100, 1)} cm`);

// Ball halten: Abstand Pfoten ↔ Ball (Ball wie main.js gezeichnet: 0,4 m vor dem Körper in 1,13 m, Kindchenschema tiefer/näher)
const halten = (A, n) => {
  const av = new Avatar(A, n, 0, { shadows: false });
  for (let i = 0; i < 60; i++) av.update(1 / 60, spieler(), { x: 0, z: 0, keeper: true, holding: true, t: i / 60 });
  av.root.updateMatrixWorld(true);
  const b = new THREE.Vector3(0.4 - (av.ballNah || 0), 1.13 - (av.senk ? 0.75 * av.senk : 0), 0);
  return Math.max(...['L', 'R'].map((s) => av.bones[`Bip01_${s}_Hand`].getWorldPosition(_w).distanceTo(b)));
};
const dH = NAMEN.map((n) => [halten(ALT, n), halten(NEU, n)]);
check('Ball halten: weitere Pfote ↔ Ball (m), neu höchstens 3 cm weiter als 0.7.0', Math.max(...dH.map(([a, b]) => b - a)) * 100, -99, 3, 'cm', dH.map(([a, b], i) => `${NAMEN[i]} ${f(a)}→${f(b)}`).join(', '));

// Laufen: Tatze am Boden gleitet nicht (Schrittfrequenz wächst mit den kürzeren Beinen). Geschwindigkeit der tieferen Tatze,
// solange sie den Rasen berührt (≤ 4 cm über der Ruhehöhe), Median über 3 s
function gleiten(A, n, v) {
  const av = new Avatar(A, n, 0, { shadows: false, ik: false }), sp = [];
  let prev = null;
  for (let i = 0; i < 180; i++) {
    const t = i / 60;
    av.update(1 / 60, spieler({ speed: v, vx: v }), { x: v * t, z: 0, t });
    av.root.updateMatrixWorld(true);
    const toes = ['L', 'R'].map((s) => av.bones[`Bip01_${s}_Toe0`].getWorldPosition(new THREE.Vector3()));
    const k = toes[0].y < toes[1].y ? 0 : 1, p = toes[k];
    if (prev && prev.k === k && i > 30 && p.y < av.ruhe.zeh + 0.04) sp.push(Math.hypot(p.x - prev.p.x, p.z - prev.p.z) * 60);
    prev = { k, p };
  }
  return med(sp);
}
for (const v of [2, 4.5, 7]) {
  const g = NAMEN.map((n) => [gleiten(ALT, n, v), gleiten(NEU, n, v)]);
  const a = med(g.map((x) => x[0])), b = med(g.map((x) => x[1]));
  check(`Laufen ${f(v, 1)} m/s: Tatze am Boden gleitet (Median der Tiere) höchstens wie 0.7.0 + 0,3 m/s`, b - a, -99, 0.3, 'm/s', `0.7.0 ${f(a)} m/s, neu ${f(b)} m/s (Läufer ${f(v, 1)} m/s)`);
}

process.exit(report('n10 Tierform (Kindchenschema)', rows, 'tierform') ? 0 : 1);
