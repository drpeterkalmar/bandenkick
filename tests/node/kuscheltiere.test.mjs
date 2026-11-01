// n9 Kuscheltiere ohne Browser: sechs Stofftiere (assets/kuscheltiere, tools/build_kuscheltiere.mjs) an den echten Rocketbox-
// Bewegungen. Prüft: Skelett passt zu allen Animationen (jede Spur findet ihren Knochen), Gewichte sauber, Sohle auf dem Rasen,
// Begrenzungskugel reicht in allen Posen, liegend nicht im Rasen, Ohren/Schwanz wackeln ohne Aufsummieren, Leibchen mit
// Rückennummer, Ladegröße höchstens +30 % gegenüber den Menschen, Menschen-Satz unverändert ladbar.
// Aufruf: node tests/node/kuscheltiere.test.mjs
import { statSync, readdirSync } from 'node:fs';
import { report } from './report.mjs';
import { spieler } from './avatar_spieler.mjs';

const { ladeAvatare } = await import('./avatar_node.mjs');
const { SAETZE, Avatar, KUSCHELTIERE, figurenSatz, sexOf } = await import('../../src/render/avatars.js');
const NAMEN = [...new Set(SAETZE.kuscheltiere.roster.flat())];
const { A, THREE } = await ladeAvatare(NAMEN);

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);

yes('Standard-Satz = Kuscheltiere, ?figuren=menschen = Menschen', figurenSatz(null) === 'kuscheltiere' && figurenSatz('menschen') === 'menschen' && figurenSatz('kuscheltiere') === 'kuscheltiere');
check('verschiedene Tiere', NAMEN.length, 6, 99, '', NAMEN.join(', '));
yes('Bewegungs-Satz je Tier wie die Rocketbox-Vorlage (m/f)', NAMEN.every((n) => sexOf(n) === KUSCHELTIERE[n]));

// Jede Animationsspur muss einen Knochen finden (sonst bliebe ein Körperteil in der Ruhepose stehen)
let fehlend = 0, spuren = 0;
for (const n of NAMEN) {
  const bones = new Set(); A.avatars[n].scene.traverse((o) => { if (o.isBone) bones.add(o.name); });
  for (const c of Object.values(A.clips[sexOf(n)])) for (const t of c.tracks) { spuren++; if (!bones.has(t.name.split('.')[0])) fehlend++; }
}
check('Animationsspuren ohne Knochen (alle Tiere × alle Clips)', fehlend, 0, 0, '', `${spuren} Spuren`);

// Gewichte und Sohle in der Ruhepose
let wFehler = 0, sohleMin = 9, sohleMax = -9, dreiecke = 0;
for (const n of NAMEN) {
  A.avatars[n].scene.updateMatrixWorld(true);
  A.avatars[n].scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, w = g.attributes.skinWeight, v = new THREE.Vector3();
    dreiecke += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (let i = 0; i < w.count; i++) { const s = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i); if (Math.abs(s - 1) > 0.02) wFehler++; }
    if (o.material.name === 'leibchen') return;
    let lo = 9; for (let i = 0; i < g.attributes.position.count; i++) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); }
    sohleMin = Math.min(sohleMin, lo); sohleMax = Math.max(sohleMax, lo);
  });
}
check('Hautgewichte nicht normiert (Punkte)', wFehler, 0, 0);
check('Sohle in der Ruhepose: tiefster Punkt (wie Menschen −1,5 cm)', sohleMin * 100, -2.5, -0.5, 'cm', `bis ${(sohleMax * 100).toFixed(1)} cm`);
check('Dreiecke je Tier (Mittel, Menschen: 8146)', dreiecke / NAMEN.length, 5000, 9000);

// Posen: Begrenzungskugel und „liegend nicht im Rasen“
const POSEN = {
  stehen: [spieler(), {}], sprint: [spieler({ speed: 7, vx: 7 }), {}], stemmschritt: [spieler({ speed: 5, vx: 5, plant: 1 }), {}],
  hechtsprung: [spieler({ hand: { mode: 'dive', dx: 0, dz: 1, t: 0.19, T: 0.38 } }), {}],
  am_boden: [spieler({ hand: { mode: 'ground', dx: 0, dz: -1, t: 0.1, T: 0.38 } }), {}],
  graetsche: [spieler({ slide: { phase: 'slide', t: 0.2 } }), {}],
  fallrueck: [spieler({ jumpY: 0.4, air: { go: true, tech: 'fallrueck', t0: 0, tc: 0.4, cy: 1.7 } }), { t: 0.4 }],
  liegen_fallrueck: [spieler({ fall: { tech: 'fallrueck', t: 0.2, dur: 0.8 } }), {}],
  flugkopf: [spieler({ jumpY: 0.3, air: { go: true, tech: 'flugkopf', t0: 0, tc: 0.4, cy: 0.9 } }), { t: 0.4 }],
  vollspann: [spieler({ speed: 3, vx: 3, kickT: 0.18, techT: 0.2, tech: 'vollspann' }), {}],
  ball_halten: [spieler(), { holding: true, keeper: true }], jubel: [spieler(), { special: 'cheer', armeHoch: 1 }],
};
const LIEGEND = new Set(['am_boden', 'graetsche', 'liegen_fallrueck']);
const _v = new THREE.Vector3(), _c = new THREE.Vector3();
function messen(av) {
  let fill = 0, tief = 9;
  for (const m of av.meshes) {
    const s = m.boundingSphere, sc = m.matrixWorld.getMaxScaleOnAxis();
    _c.copy(s.center).applyMatrix4(m.matrixWorld);
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 3) { m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld); fill = Math.max(fill, _v.distanceTo(_c) / (s.radius * sc)); tief = Math.min(tief, _v.y); }
  }
  return { fill, tief };
}
let schlimmst = 0, wo = '', tiefLiegend = 9, woT = '';
for (const name of NAMEN) {
  const av = new Avatar(A, name, 0, { shadows: false });
  for (const [pose, [pl, st]] of Object.entries(POSEN)) {
    for (let i = 0; i < 40; i++) av.update(1 / 60, pl, { x: 0, z: 0, keeper: false, t: st.t ?? 0, ...st });
    av.root.updateMatrixWorld(true);
    const r = messen(av);
    if (r.fill > schlimmst) { schlimmst = r.fill; wo = `${name} ${pose}`; }
    if (LIEGEND.has(pose) && r.tief < tiefLiegend) { tiefLiegend = r.tief; woT = `${name} ${pose}`; }
  }
}
check('Begrenzungskugel: größte Füllung über 6 Tiere × 12 Posen (≤ 1 = ganz drin)', schlimmst, 0, 1, '', wo);
check('liegend: tiefster Plüsch-Punkt (Rasen = 0, Menschen-Sohle −1,5 cm)', tiefLiegend * 100, -9, 99, 'cm', woT);

// Ohren und Schwanz: wackeln, aber nichts sammelt sich auf (10 s laufen, dann stehen)
const av = new Avatar(A, 'Hase', 1, { shadows: false });
const ohr = av.bones.Ohr_L, ruhe = ohr.quaternion.clone();
let maxW = 0;
for (let i = 0; i < 600; i++) { av.update(1 / 60, spieler({ speed: 5, vx: 5 }), { x: 0, z: 0, t: i / 60 }); maxW = Math.max(maxW, ohr.quaternion.angleTo(ruhe)); }
for (let i = 0; i < 120; i++) av.update(1 / 60, spieler(), { x: 0, z: 0, t: 10 });
check('Ohr wackelt beim Laufen (größter Ausschlag)', maxW, 0.1, 0.6, 'rad');
check('Ohr nach dem Laufen zurück (Abstand zur Ruhe)', ohr.quaternion.angleTo(ruhe), 0, 0.2, 'rad');
yes('Schwanz-Knochen bei allen Tieren', NAMEN.every((n) => { let b = false; A.avatars[n].scene.traverse((o) => { if (o.name === 'Schwanz') b = true; }); return b; }));

// Leibchen: aus dem GLB, mit Rückennummer, Teamfarbe
const t0 = new Avatar(A, 'Teddy', 0, { shadows: false });
yes('Leibchen: fertiges Teil aus dem GLB, Stoff-Muster, Teamfarbe', t0.bib.geometry.attributes.uv && t0.bib.material.color.getHex() === 0xff6a13 && t0.bib.geometry.index.count / 3 > 500);
check('Draw-Calls je Figur (Körper + Leibchen; Menschen: 3)', t0.meshes.length, 2, 2);

// Ladegröße: Figuren-Dateien Kuscheltiere gegen Menschen (Bewegungen sind bei beiden gleich)
const kb = (dir, names) => names.reduce((s, n) => s + statSync(new URL(`../../${dir}/${n}.glb`, import.meta.url)).size, 0) / 1024;
const kt = kb('assets/kuscheltiere', NAMEN), me = kb('assets/avatars', [...new Set(SAETZE.menschen.roster.flat())]);
check('Ladegröße Figuren Kuscheltiere / Menschen (≤ 1,3)', kt / me, 0, 1.3, '', `${kt.toFixed(0)} KB / ${me.toFixed(0)} KB`);
yes('Kuscheltier-Dateien vollständig', NAMEN.every((n) => readdirSync(new URL('../../assets/kuscheltiere/', import.meta.url)).includes(n + '.glb')));

// Menschen-Satz lädt weiter (?figuren=menschen)
const M = await ladeAvatare(['Sports_Male_02']);
const m0 = new Avatar(M.A, 'Sports_Male_02', 0, { shadows: false });
yes('?figuren=menschen: Rocketbox-Mensch mit eigenem Leibchen wie bisher', !m0.kuschel && m0.meshes.length === 3 && m0.wackel.length === 0);

process.exit(report('n9 Kuscheltiere', rows, 'kuscheltiere') ? 0 : 1);
