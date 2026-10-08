// n4 Fuß-IK (Audit #5), Teil 1 ohne Figur: Zwei-Knochen-Löser (Ziel erreicht, Knochenlängen bleiben, Knie in der
// Beugeebene bzw. zum Pol, unerreichbar → gestreckt in Zielrichtung), Quaternion-Helfer gegen three.js, Regeln für Boden
// und Ballkontakt. Teil 2 (echte Skelette) steht in avatar.test.mjs. Aufruf: node tests/node/ik.test.mjs
import { report } from './report.mjs';
import { zweiKnochen, knoechelNach, knieNach, quatAchse, quatMul, quatDreh, bodenHub, kickGewicht, kickZiel, KICK_T } from '../../src/render/ik.js';
await import('./three_hook.mjs');
const THREE = await import('three');

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

// Quaternion-Helfer = three.js
{
  let err = 0;
  for (let i = 0; i < 200; i++) {
    const ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), ang = (rnd() - 0.5) * 6;
    const ax2 = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), ang2 = (rnd() - 0.5) * 6;
    const q1 = new THREE.Quaternion().setFromAxisAngle(ax, ang), q2 = new THREE.Quaternion().setFromAxisAngle(ax2, ang2);
    const m = new THREE.Quaternion().multiplyQuaternions(q1, q2), v = new THREE.Vector3(rnd(), rnd(), rnd());
    const r = v.clone().applyQuaternion(m);
    const qm = quatMul(quatAchse(ax.toArray(), ang), quatAchse(ax2.toArray(), ang2)), rv = quatDreh(qm, v.toArray());
    err = Math.max(err, Math.abs(qm[0] - m.x) + Math.abs(qm[1] - m.y) + Math.abs(qm[2] - m.z) + Math.abs(qm[3] - m.w), d3(rv, r.toArray()));
  }
  check('Quaternion-Helfer = three.js (200 Zufallsfälle)', err, 0, 1e-9);
}
// Bein: Hüfte (0, 0.95, 0), Knie leicht vorn gebeugt, Knöchel
const a = [0, 0.95, 0], b = [0, 0.52, 0.04], c = [0, 0.1, 0];
const lab = d3(a, b), lcb = d3(b, c);
let maxErr = 0, maxLen = 0, n = 0, knieVorn = 0;
for (let i = 0; i < 500; i++) {
  const t = [(rnd() - 0.5) * 0.9, 0.1 + rnd() * 0.75, (rnd() - 0.5) * 0.9];
  if (d3(t, a) > lab + lcb - 0.01 || d3(t, a) < Math.abs(lab - lcb) + 0.05) continue;
  const L = zweiKnochen(a, b, c, t, [0, 0, 1]);
  const c2 = knoechelNach(a, b, c, L), b2 = knieNach(a, b, L);
  maxErr = Math.max(maxErr, d3(c2, t)); maxLen = Math.max(maxLen, Math.abs(d3(a, b2) - lab), Math.abs(d3(b2, c2) - lcb)); n++;
  // Knie vor der Mitte von Hüfte und Knöchel (gleiche Beugerichtung wie vorher)
  if (b2[2] - (a[2] + c2[2]) / 2 > -0.02) knieVorn++;
}
check(`erreichbare Ziele: Abstand Knöchel → Ziel (${n} Fälle)`, maxErr, 0, 1e-6, 'm');
check('Knochenlängen bleiben', maxLen, 0, 1e-9, 'm');
check('Knie bleibt vorn (Anteil)', knieVorn / n, 0.97, 1);
// unerreichbar: gestreckt Richtung Ziel
{
  const t = [0.3, -0.6, 0.5], L = zweiKnochen(a, b, c, t), c2 = knoechelNach(a, b, c, L);
  const dir = (p) => { const v = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], l = Math.hypot(...v); return v.map((x) => x / l); };
  const u = dir(c2), w = dir(t);
  check('unerreichbar: Bein zeigt zum Ziel (Winkelfehler °)', Math.acos(Math.min(1, u[0] * w[0] + u[1] * w[1] + u[2] * w[2])) * 180 / Math.PI, 0, 0.01, '°');
  check('unerreichbar: Bein (fast) gestreckt', d3(a, c2), lab + lcb - 0.001, lab + lcb, 'm');
  yes('unerreichbar wird gemeldet', L.erreicht === false);
}
// gestrecktes Bein → Pol bestimmt die Beugerichtung
{
  const cs = [0, 0.95 - lab - lcb + 0.0001, 0], bs = [0, 0.95 - lab, 0], t = [0, 0.3, 0];
  const L = zweiKnochen(a, bs, cs, t, [0, 0, 1]), b2 = knieNach(a, bs, L), c2 = knoechelNach(a, bs, cs, L);
  check('gestrecktes Bein: Knie beugt zum Pol (+z)', b2[2], 0.05, 1, 'm', `Knöchel-Fehler ${d3(c2, t).toExponential(1)}`);
}
// Ziel = jetzige Lage → keine Drehung
{
  const L = zweiKnochen(a, b, c, c);
  check('Ziel = Knöchel: Drehung (Winkel °)', Math.max(2 * Math.acos(Math.min(1, Math.abs(L.qHuefte[3]))), 2 * Math.acos(Math.min(1, Math.abs(L.qKnie[3])))) * 180 / Math.PI, 0, 0.01, '°');
}
// Regeln
check('Boden: Knöchel 3 cm zu tief → 3 cm anheben', bodenHub(0.087, 0.05, 0.117, 0.03), 0.0299, 0.0301, 'm');
check('Boden: Zehen 2 cm im Rasen → 2 cm anheben', bodenHub(0.2, 0.01, 0.117, 0.03), 0.0199, 0.0201, 'm');
check('Boden: Fuß in der Luft → nichts', bodenHub(0.4, 0.3, 0.117, 0.03), 0, 0, 'm');
yes('Ballkontakt: Gewicht voll beim Kontakt, weg nach KICK_T, nie bei kt < 0', kickGewicht(0) === 0.85 && kickGewicht(KICK_T) === 0 && kickGewicht(-0.1) === 0 && kickGewicht(0.06) < 0.85 && kickGewicht(0.06) > 0);
{
  const z = kickZiel([1, 0.11, 0], [0.4, 0, 0], 0.11, 0.117);
  yes('Ballkontakt: Knöchel-Ziel hinter dem Ball, in Ruhehöhe', Math.abs(z[0] - (1 - 0.19)) < 1e-9 && z[1] === 0.117 && z[2] === 0);
}
const ok = report('n4 Fuß-IK (Löser und Regeln)', rows, 'ik');
process.exit(ok ? 0 : 1);
