// n4 enge Schattenkamera (Audit #10) ohne Browser: Achsen wie three.js, Abdeckung des sichtbaren Käfig-Ausschnitts
// (Spielkamera hoch und quer, Tag-Sonne und Abend-Flutlicht), Kante kleiner als der ganze Käfig, Texel-Raster beim
// Mitbewegen (kein Flimmern), Hysterese. Geprüft gegen die echte three.js-Schattenmatrix (DirectionalLight.shadow).
// Das Bild (Schärfe, Akne, Kanten am Rand) prüft der Heavy-Job. Aufruf: node tests/node/schatten.test.mjs
import { report } from './report.mjs';
import { lichtAchsen, bildFlaeche, schattenAusschnitt, imAusschnitt, randPunkte } from '../../src/render/schatten.js';
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';

await import('./three_hook.mjs');
const THREE = await import('three');
const { GameCamera } = await import('../../src/render/camera.js');

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);

const P = makeParams('');
const cage = new Game(P, 's1', { match: true, human: 1 }).cage;
const altExt = Math.max(cage.hx + cage.gD, cage.hz) + 2.5;   // bisher (scene.js makeSun)
const box = [-(cage.hx + cage.gD + 2.5), cage.hx + cage.gD + 2.5, -(cage.hz + 2.5), cage.hz + 2.5];
const fromUV = (u, v) => { const phi = (u - 0.5) * 2 * Math.PI, th = v * Math.PI; return [Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)]; };
const SONNE = fromUV(0.7060546875, 0.216796875);                       // assets/hdri/sky.json
const FLUT = (() => { const v = [25, 16.3, 14.5], l = Math.hypot(...v); return v.map((x) => x / l); })();   // Abend: Mast 0

// ---- Achsen wie three.js ----
for (const [n, d] of [['Sonne', SONNE], ['Flutlicht', FLUT]]) {
  const { X, Y, Z } = lichtAchsen(d);
  const cam = new THREE.OrthographicCamera(); cam.position.set(...d.map((x) => x * 40)); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements, err = Math.max(...[0, 1, 2].map((i) => Math.abs(e[i] - X[i]) + Math.abs(e[4 + i] - Y[i]) + Math.abs(e[8 + i] - Z[i])));
  check(`Lichtachsen = three.js-Kamera (${n})`, err, 0, 1e-9);
}

// Spielkamera wie im Spiel stellen, Strahlen (Ecken + Randmitten) und ein feines Raster sichtbarer Bodenpunkte
function spielKamera(mode, ball) {
  const aspect = mode === 'hoch' ? 412 / 915 : 915 / 412;
  const g = new GameCamera(aspect, cage); g.setAspect(aspect);
  for (let i = 0; i < 200; i++) g.update(1 / 60, { x: ball[0], z: ball[1], vx: 0, vz: 0 }, { x: ball[0] - 1, z: ball[1] }, 'play');
  g.cam.updateMatrixWorld(); g.cam.updateProjectionMatrix();
  return g.cam;
}
const strahl = (cam, x, y) => { const v = new THREE.Vector3(x, y, 0.5).unproject(cam).sub(cam.position).normalize(); return [v.x, v.y, v.z]; };
const RAND = randPunkte(3);
const vpOf = (cam) => new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
function sichtbar(cam, n = 24) {   // Bodenpunkte und Kopfhöhe im Bild, im Käfig + Rand
  const out = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const d = strahl(cam, -1 + 2 * i / n, -1 + 2 * j / n);
    for (const y of [0, 2.2]) {
      const t = d[1] < -1e-6 ? (y - cam.position.y) / d[1] : -1;
      if (!(t > 0) || t > 60) continue;
      const p = [cam.position.x + d[0] * t, y, cam.position.z + d[2] * t];
      if (p[0] >= box[0] && p[0] <= box[1] && p[2] >= box[2] && p[2] <= box[3]) out.push(p);
    }
  }
  return out;
}
// echte three.js-Schattenmatrix: liegt der Punkt in der Karte?
function inKarte(aus, dir, pts) {
  const L = new THREE.DirectionalLight(); L.position.set(...aus.pos); L.target.position.set(...aus.target);
  L.updateMatrixWorld(); L.target.updateMatrixWorld();
  const c = L.shadow.camera; c.left = -aus.ext; c.right = aus.ext; c.top = aus.ext; c.bottom = -aus.ext; c.near = 5; c.far = 90; c.updateProjectionMatrix();
  L.shadow.updateMatrices(L);
  let drin = 0;
  for (const p of pts) { const v = new THREE.Vector3(...p).applyMatrix4(L.shadow.matrix); if (v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1 && v.z >= 0 && v.z <= 1) drin++; }
  return drin / Math.max(1, pts.length);
}

for (const mode of ['hoch', 'quer']) for (const [ln, dir] of [['Tag', SONNE], ['Abend', FLUT]]) for (const ball of [[0, 0], [9, 4], [-10, -5]]) {
  const cam = spielKamera(mode, ball);
  const pts = bildFlaeche([cam.position.x, cam.position.y, cam.position.z], RAND.map(([x, y]) => strahl(cam, x, y)), { box, vp: vpOf(cam) });
  const aus = schattenAusschnitt(pts, dir, { mapSize: 1024, maxExt: altExt });
  const vis = sichtbar(cam), anteil = inKarte(aus, dir, vis);
  // bisher: Ziel im Ursprung, ±altExt (scene.js makeSun) – gleiche Prüfung
  const alt = inKarte({ ext: altExt, target: [0, 0, 0], pos: dir.map((x) => x * 40) }, dir, vis);
  check(`${mode} ${ln} Ball (${ball}): sichtbarer Käfig in der Karte (mind. wie bisher)`, anteil, Math.min(0.999, alt), 1, '', `${vis.length} Punkte, bisher ${(alt * 100).toFixed(1)} %, Kante ±${aus.ext} m (bisher ±${altExt.toFixed(1)})`);
  if (ln === 'Tag' && ball[0] === 9) check(`${mode} Tag: halbe Kante (m)`, aus.ext, 4, altExt, 'm', `Texel ${(aus.texel * 100).toFixed(1)} cm bei 1024 (bisher ${(2 * altExt / 1024 * 100).toFixed(1)} cm bei 1024, ${(2 * altExt / 2048 * 100).toFixed(1)} cm bei 2048)`);
}

// ---- Texel-Raster: kleine Kamerabewegung → Karte verschiebt sich nur um ganze Texel ----
{
  const cam = spielKamera('quer', [3, 1]);
  const base = bildFlaeche([cam.position.x, cam.position.y, cam.position.z], RAND.map(([x, y]) => strahl(cam, x, y)), { box, vp: vpOf(cam) });
  const a0 = schattenAusschnitt(base, SONNE, { mapSize: 1024, maxExt: altExt });
  let maxPhase = 0;
  for (let k = 1; k <= 20; k++) {
    const sh = base.map((p) => [p[0] + k * 0.013, p[1], p[2] + k * 0.007]);
    const a = schattenAusschnitt(sh, SONNE, { mapSize: 1024, maxExt: altExt, prevExt: a0.ext });
    if (a.ext !== a0.ext) continue;
    const { X, Y } = lichtAchsen(SONNE);
    // Lage des Weltursprungs in Texeln relativ zum Kartenrand: Nachkommastelle muss gleich bleiben
    const u = ((0 - (a.target[0] * X[0] + a.target[1] * X[1] + a.target[2] * X[2])) + a.ext) / a.texel;
    const v = ((0 - (a.target[0] * Y[0] + a.target[1] * Y[1] + a.target[2] * Y[2])) + a.ext) / a.texel;
    const ph = (x) => Math.abs(x - Math.round(x));
    maxPhase = Math.max(maxPhase, ph(u), ph(v));
  }
  check('Mitbewegen: Karte nur um ganze Texel verschoben (Abweichung in Texeln)', maxPhase, 0, 1e-6);
}
// ---- Hysterese ----
{
  const p = (h) => [[-h, 0, -h], [h, 0, h], [-h, 0, h], [h, 0, -h]];
  const a = schattenAusschnitt(p(6), [0, 1, 0.0001], { maxExt: 20 });
  const b = schattenAusschnitt(p(5.7), [0, 1, 0.0001], { maxExt: 20, prevExt: a.ext });
  const c = schattenAusschnitt(p(4.5), [0, 1, 0.0001], { maxExt: 20, prevExt: a.ext });
  const d = schattenAusschnitt(p(7), [0, 1, 0.0001], { maxExt: 20, prevExt: a.ext });
  yes('Hysterese: etwas kleiner → Kante bleibt, deutlich kleiner → schrumpft, größer → wächst sofort', b.ext === a.ext && c.ext < a.ext && d.ext > a.ext, `${a.ext} / ${b.ext} / ${c.ext} / ${d.ext}`);
  const e = schattenAusschnitt(p(40), [0, 1, 0.0001], { maxExt: 15.5 });
  yes('höchstens maxExt (ganzer Käfig wie bisher)', e.ext === 15.5);
}

const ok = report('n4 enge Schattenkamera', rows, 'schatten');
process.exit(ok ? 0 : 1);
