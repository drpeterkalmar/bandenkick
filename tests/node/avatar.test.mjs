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

// ---- Fuß-IK (Audit #5) an den echten Skeletten ----
const { kickZiel } = await import('../../src/render/ik.js');
const tiefe = (av) => { // wie weit Knöchel/Zehen unter ihrer Ruhehöhe liegen (m, > 0 = im Rasen)
  let t = 0;
  for (const s of ['L', 'R']) { const k = av.bones[`Bip01_${s}_Foot`].getWorldPosition(new THREE.Vector3()).y, z = av.bones[`Bip01_${s}_Toe0`].getWorldPosition(new THREE.Vector3()).y; t = Math.max(t, av.ruhe.knoechel - k, av.ruhe.zeh - z); }
  return t;
};
const BODEN = { stemmschritt: [spieler({ speed: 5, vx: 5, plant: 1 }), {}], stemm_seitlich: [spieler({ speed: 5, vz: 5, plant: 1 }), {}], torwart_bereit: [spieler(), { keeper: true, ready: true }],
  vollspann: POSEN.vollspann, innenseite: [spieler({ speed: 2, vx: 2, kickT: 0.2, techT: 0.2, tech: 'innen' }), {}], ball_halten: POSEN.ball_halten };
let vorher = 0, nachher = 0, wo2 = '';
for (const name of [...new Set(ROSTER.flat())]) {
  for (const [pose, [pl, st]] of Object.entries(BODEN)) {
    const a0 = new Avatar(A, name, 0, { shadows: false, ik: false }), a1 = new Avatar(A, name, 0, { shadows: false });
    a0.phase = a1.phase = 0;   // Konstruktor würfelt die Phase
    // über einen Laufzyklus die tiefste Stelle suchen
    for (let i = 0; i < 50; i++) {
      a0.update(1 / 60, pl, { x: 0, z: 0, t: 0, ...st }); a1.update(1 / 60, pl, { x: 0, z: 0, t: 0, ...st });
      a0.root.updateMatrixWorld(true); a1.root.updateMatrixWorld(true);
      if (i < 10) continue;
      const t0 = tiefe(a0), t1 = tiefe(a1);
      if (t0 > vorher) { vorher = t0; wo2 = `${name} ${pose}`; }
      nachher = Math.max(nachher, t1);
    }
  }
}
check('Fuß-IK: Füße im Rasen ohne IK (größte Tiefe, Info)', vorher * 100, -Infinity, Infinity, 'cm', wo2);
check('Fuß-IK: Füße im Rasen mit IK (Toleranz 1 cm + 2 mm Schwelle)', nachher * 100, 0, 1.25, 'cm');
// Ballkontakt: Spieler läuft in +x, Ball 0,55 m vor ihm; Kontakt im 21. Bild. n5: mit Glättung (Standard) greift der Fuß
// in ~0,1 s weich zum Ball statt im Kontaktbild hinzuspringen; ?glatt=0 = n4 (sofort am Ball)
for (const glatt of [false, true]) {
  const av = new Avatar(A, 'Sports_Male_03', 0, { shadows: false, glatt }), ball = [0.55, 0.11, 0.1];
  av.phase = 0;
  const lauf = (kt) => spieler({ speed: 3, vx: 3, kickT: kt, kickFoot: 1, techT: kt, tech: 'vollspann' });
  for (let i = 0; i < 20; i++) av.update(1 / 60, lauf(9), { x: 0, z: 0, t: 0, ball });
  const ziel = kickZiel(ball, [0, 0, 0], 0.11, av.ruhe.knoechel);
  const mitIK = [], ohne = new Avatar(A, 'Sports_Male_03', 0, { shadows: false, ik: false, glatt }); const ohneD = [], lage = [], lageO = [];
  ohne.phase = 0;
  for (let i = 0; i < 20; i++) ohne.update(1 / 60, lauf(9), { x: 0, z: 0, t: 0, ball });
  for (let k = 0; k < 30; k++) {
    const kt = k / 60;
    av.update(1 / 60, lauf(kt), { x: 0, z: 0, t: 0, ball }); ohne.update(1 / 60, lauf(kt), { x: 0, z: 0, t: 0, ball });
    av.root.updateMatrixWorld(true); ohne.root.updateMatrixWorld(true);
    const p = av.bones.Bip01_R_Foot.getWorldPosition(new THREE.Vector3()), q = ohne.bones.Bip01_R_Foot.getWorldPosition(new THREE.Vector3());
    mitIK.push(p.distanceTo(new THREE.Vector3(...ziel))); ohneD.push(q.distanceTo(new THREE.Vector3(...ziel))); lage.push(p); lageO.push(q);
  }
  // größter Ruck des Fußes (zweite Differenz je Bild) mit IK minus ohne IK
  const ruckMax = (L) => Math.max(...L.slice(1, -1).map((p, i) => new THREE.Vector3().copy(L[i + 2]).addScaledVector(p, -2).add(L[i]).length()));
  const tag = glatt ? '' : ' (?glatt=0)';
  if (!glatt) {
    // Ziel teils außer Reichweite (Bein dann gestreckt in Richtung Ball) → mindestens 70 % näher als ohne IK
    check('Ballkontakt' + tag + ': Schussfuß beim Kontakt am Ball (Abstand Knöchel → Ziel)', mitIK[0] * 100, 0, 0.3 * ohneD[0] * 100, 'cm', `ohne IK ${(ohneD[0] * 100).toFixed(1)} cm; nach 0,05 s ${(mitIK[3] * 100).toFixed(1)} / ${(ohneD[3] * 100).toFixed(1)} cm`);
    check('Ballkontakt' + tag + ': nach 0,12 s kein Zug mehr zum Ball (Differenz zu ohne IK)', Math.max(Math.abs(mitIK[8] - ohneD[8]), Math.abs(mitIK[9] - ohneD[9])) * 100, 0, 3, 'cm');
  } else {
    const best = Math.min(...mitIK.slice(0, 9)), iB = mitIK.indexOf(best);
    check('Ballkontakt' + tag + ': Schussfuß greift in ≤ 0,15 s zum Ball (nächster Abstand Knöchel → Ziel)', best * 100, 0, 0.5 * ohneD[iB] * 100, 'cm', `nach ${(iB / 60).toFixed(3)} s, ohne IK dort ${(ohneD[iB] * 100).toFixed(1)} cm`);
    check('Ballkontakt' + tag + ': nach 0,4 s kein Zug mehr zum Ball (Differenz zu ohne IK)', Math.max(...[24, 25, 26, 27, 28, 29].map((k) => Math.abs(mitIK[k] - ohneD[k]))) * 100, 0, 3, 'cm');
    check('Ballkontakt' + tag + ': kein Sprung – Fuß-Ruck mit IK höchstens 4 cm/Bild² über ohne IK', (ruckMax(lage) - ruckMax(lageO)) * 100, -Infinity, 4, 'cm', `mit ${(ruckMax(lage) * 100).toFixed(1)}, ohne ${(ruckMax(lageO) * 100).toFixed(1)}`);
  }
}
// Ohne prozedurale Schicht (reiner Clip) ändert die IK nichts
{
  const a0 = new Avatar(A, 'Sports_Female_02', 0, { shadows: false, ik: false }), a1 = new Avatar(A, 'Sports_Female_02', 0, { shadows: false });
  a0.phase = a1.phase = 0.3;
  const pl = spieler({ speed: 4, vx: 4 });
  for (let i = 0; i < 30; i++) { a0.update(1 / 60, pl, { x: 0, z: 0, t: 0 }); a1.update(1 / 60, pl, { x: 0, z: 0, t: 0 }); }
  a0.root.updateMatrixWorld(true); a1.root.updateMatrixWorld(true);
  const d = a0.bones.Bip01_L_Foot.getWorldPosition(new THREE.Vector3()).distanceTo(a1.bones.Bip01_L_Foot.getWorldPosition(new THREE.Vector3()));
  check('reiner Laufzyklus: IK greift nicht ein', d, 0, 1e-9, 'm', `IK-Läufe ${a1.ikN}`);
}
// CPU: 6 Figuren im Stemmschritt (IK an beiden Beinen) gegen ohne IK, je 600 Bilder (Node am Mac, ohne Drosselung)
{
  const zeit = (ik) => {
    const figs = [...new Set(ROSTER.flat())].map((n) => new Avatar(A, n, 0, { shadows: false, ik }));
    const pl = spieler({ speed: 5, vx: 5, plant: 1 });
    for (let i = 0; i < 60; i++) for (const f of figs) f.update(1 / 60, pl, { x: 0, z: 0, t: 0 });
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) for (const f of figs) f.update(1 / 60, pl, { x: 0, z: 0, t: 0 });
    return { ms: (performance.now() - t0) / 600, ik: figs.reduce((s, f) => s + f.ikZeit, 0) / 660, n: figs.reduce((s, f) => s + f.ikN, 0) };
  };
  zeit(true); zeit(false);
  const a = zeit(false), b = zeit(true);
  check('CPU je Bild, 6 Figuren mit Stemmschritt: Mehrzeit durch IK (Node, ungedrosselt)', b.ms - a.ms, -Infinity, 0.25, 'ms', `ohne ${a.ms.toFixed(3)} ms, mit ${b.ms.toFixed(3)} ms, IK selbst ${b.ik.toFixed(3)} ms, ${b.n} Bein-Lösungen; Budget am Handy (CPU ×4): +0,5 ms → hier ≤ 0,125 ms anstreben`);
}

const ok = report('n4 Figuren (Culling, Halbtakt, Fuß-IK)', rows, 'avatar');
process.exit(ok ? 0 : 1);
