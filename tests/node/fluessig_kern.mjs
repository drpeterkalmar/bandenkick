// n5 Hilfen für tests/node/fluessig.test.mjs: Figur Bild für Bild stellen und Knochen-Lagen im Figuren-Raum mitschreiben
// (wie src/render/ruckmess.js im Browser), zweite Ableitung je Knochen (cm je Bild² bei 60 Hz), Summe der Clip-Gewichte.
const { ladeAvatare } = await import('./avatar_node.mjs');
export const { A, THREE } = await ladeAvatare(['Sports_Male_02', 'Sports_Female_02']);
export const { Avatar } = await import('../../src/render/avatars.js');
export const KNOCHEN = ['Bip01_Pelvis', 'Bip01_L_Foot', 'Bip01_R_Foot', 'Bip01_L_Hand', 'Bip01_R_Hand', 'Bip01_Head'];

export function spieler(o = {}) {
  return { face: 0, speed: 0, vx: 0, vz: 0, plant: 0, kickT: 9, kickFoot: 1, techT: 9, tech: '', hand: { mode: 'none', dx: 0, dz: 0, t: 0, T: 0.38 }, jumpY: 0, air: null, fall: null, slide: null, P: { slideGroundT: 0.6 }, ...o };
}
const _v = new THREE.Vector3();
// Ablauf: fn(i, t) → [pl, st] je Bild; liefert Lagen (cm) je Knochen und Gewichtssummen
export function spiele(av, n, fn, dt = 1 / 60) {
  const lagen = KNOCHEN.map(() => []), wsum = [], tempo = [];
  for (let i = 0; i < n; i++) {
    const [pl, st] = fn(i, i * dt);
    tempo.push(Math.abs(pl.speed || 0));
    av.update(dt, pl, { x: pl.x || 0, z: pl.z || 0, keeper: false, t: i * dt, ball: [0.4, 0.11, 0], ...st });
    av.root.updateMatrixWorld(true);
    const r = av.root, c = Math.cos(-r.rotation.y), s = Math.sin(-r.rotation.y);
    KNOCHEN.forEach((k, j) => { _v.setFromMatrixPosition(av.bones[k].matrixWorld).sub(r.position); lagen[j].push([(_v.x * c + _v.z * s) * 100, _v.y * 100, (-_v.x * s + _v.z * c) * 100]); });
    let w = 0; for (const a of Object.values(av.act)) w += a.getEffectiveWeight();
    wsum.push(w);
  }
  return { lagen, wsum, dt, tempo };
}
// zweite Ableitung (cm/Bild², auf 60 Hz normiert) je Knochen und Bild
export function ruck({ lagen, dt }) {
  const k = (dt * 60) ** 2;
  return lagen.map((L) => L.map((p, i) => (i === 0 || i === L.length - 1 ? 0 : Math.hypot(...[0, 1, 2].map((a) => L[i + 1][a] - 2 * p[a] + L[i - 1][a])) / k)));
}
export const maxJe = (R, von = 0) => R.map((r) => Math.max(...r.slice(von)));
// Pose-Sprünge wie tests/ruckel.py: über der Hülle der sauberen Lauf-Clips bei diesem Tempo (a + b·v je Knochen, ×1,25)
// UND eine Spitze (> 3× Median der Nachbarn ±6 Bilder); gross = zusätzlich > 8 cm/Bild²
export const HUELLE = [[0.6, 0.4], [1.0, 1.8], [1.0, 1.8], [0.6, 1.0], [0.6, 1.0], [0.6, 0.45]];
export function spruenge(R, tempo, von = 2, gross = 8) {
  const n = R[0].length, out = [];
  for (let i = von; i < n - 1; i++) {
    const v = Math.max(...tempo.slice(Math.max(0, i - 3), i + 4));
    let ist = false, m = 0;
    for (let k = 0; k < R.length; k++) {
      const r = R[k], h = (HUELLE[k][0] + HUELLE[k][1] * v) * 1.25;
      if (r[i] <= h) continue;
      const um = [...r.slice(Math.max(0, i - 6), Math.max(0, i - 1)), ...r.slice(i + 2, i + 7)].sort((a, b) => a - b);
      const med = um.length ? um[Math.floor(um.length / 2)] : 0;
      if (r[i] > 3 * Math.max(med, 1e-6)) { ist = true; m = Math.max(m, r[i]); }
    }
    if (ist) out.push({ i, m, gross: m > gross });
  }
  return out;
}
