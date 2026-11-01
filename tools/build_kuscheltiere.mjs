// n9 Kuscheltiere bauen (Peter 01.11.2026: „ersetze alle menschen (auch spieler) durch kuscheltiere“). Eigene Arbeit, MIT.
// Aufruf: node tools/build_kuscheltiere.mjs [Name …]   → assets/kuscheltiere/<Name>.glb (+ kuscheltiere.json mit Maßen)
// Ablauf je Tier (Formen und Farben: tools/kuscheltiere_formen.mjs):
//  1. Vorlage = Rocketbox-Mensch aus assets/avatars (Skelett „Bip01“ + Hautgewichte), Gelenke in der Ruhepose (A-Pose).
//  2. Jedes Stück (Rumpf, Kopf, Arme, Beine, Ohren, Schwanz, Augen, Nase, Mund) ist ein Abstandsfeld; daraus ein Gitter
//     („Surface Nets“), Punkte genau auf die Oberfläche gezogen, mit meshoptimizer auf das Dreiecks-Budget vereinfacht.
//     Normalen aus dem Feld (glatt), Umgebungsverdeckung aus dem Feld aller Stücke (Achseln, Hals, Schritt dunkler).
//  3. Farbe: COLOR_0 = Stoff-Farbe außen (rgb) + Plüsch-Anteil/Naht (a); _INNEN = Farbe des aufgenähten Flecks (rgb) +
//     Abstand zur Fleck-Kante (a, ±5 cm) – der Shader schneidet daran scharf und zeichnet die Naht (avatars.js).
//  4. Hautgewichte: Rumpf/Arme/Beine vom nächsten Punkt des Menschen derselben Körpergegend (Finger → Hand), danach
//     über die Nachbarn geglättet; Kopf, Augen, Nase, Mund starr am Kopf; Ohren an eigenen Knochen „Ohr_L/R“ (Kind des
//     Kopfs), der Schwanz an „Schwanz“ (Kind des Beckens) – die wackeln im Spiel leicht, ohne neue Animationen.
//  5. Ausgabe: Skelett der Vorlage unverändert (Gesichtsknochen raus – die bewegt keine Animation), neue inverse
//     Bind-Matrizen, ein Mesh, ein Material „plush_body“, quantisiert + meshopt wie die Menschen.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { TIERE, bauplan, male, grad, add, mul } from './kuscheltiere_formen.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'assets', 'kuscheltiere');
await import('../tests/node/three_hook.mjs');
const THREE = await import('three');
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const FACE = /^(REye|LEye|MJaw|MBottomLip|MTongue|LMouthBottom|RMouthBottom|RMasseter|LMasseter|MUpperLip|RCaninus|LCaninus|REyeBlinkBottom|LEyeBlinkBottom|REyeBlinkTop|LEyeBlinkTop|RUpperlip|LUpperlip|RMouthCorner|LMouthCorner|RCheek|LCheek|RInnerEyebrow|LInnerEyebrow|MMiddleEyebrow|ROuterEyebrow|LOuterEyebrow|MNose)$/;
const kurz = (n) => n.replace(/^Bip01[ _]/, '').replace(/ /g, '_');
const D_MAX = 0.05; // m: Abstand zur Fleck-Kante, in _INNEN.a auf 0…1 gelegt

// ---------------------------------------------------------------- Gitter aus einem Abstandsfeld (Surface Nets)
function netz(sdf, h) {
  const [lo, hi] = sdf.bb.map((v, k) => v.map((x) => x + (k ? 2 : -2) * h));
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = sdf.f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  const V = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    V[id(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  const I = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if (f0 !== (F[id(i + 1, j, k)] < 0)) quad(V[id(i, j - 1, k - 1)], V[id(i, j, k - 1)], V[id(i, j, k)], V[id(i, j - 1, k)], !f0);
    if (f0 !== (F[id(i, j + 1, k)] < 0)) quad(V[id(i - 1, j, k - 1)], V[id(i - 1, j, k)], V[id(i, j, k)], V[id(i, j, k - 1)], !f0);
    if (f0 !== (F[id(i, j, k + 1)] < 0)) quad(V[id(i - 1, j - 1, k)], V[id(i, j - 1, k)], V[id(i, j, k)], V[id(i - 1, j, k)], !f0);
  }
  // Punkte genau auf die Fläche (Newton längs des Gradienten, höchstens eine Zelle weit)
  for (let q = 0; q < P.length; q += 3) {
    let p = [P[q], P[q + 1], P[q + 2]];
    const p0 = p.slice();
    for (let it = 0; it < 4; it++) { const d = sdf.f(...p); if (Math.abs(d) < 1e-6) break; p = add(p, mul(grad(sdf.f, p), -d)); }
    if (Math.hypot(p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]) < h) { P[q] = p[0]; P[q + 1] = p[1]; P[q + 2] = p[2]; }
  }
  const pos = new Float32Array(P), idx = new Uint32Array(I);
  // Umlaufsinn: Dreiecksnormale soll mit dem Feld-Gradienten nach außen zeigen (Mehrheit entscheidet)
  let pro = 0;
  for (let t = 0; t < idx.length; t += 3 * 7) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const g = grad(sdf.f, [(pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3]);
    pro += n[0] * g[0] + n[1] * g[1] + n[2] * g[2] > 0 ? 1 : -1;
  }
  if (pro < 0) for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
  return { pos, idx };
}

function vereinfache(m, tris) {
  if (m.idx.length / 3 <= tris) return m;
  const [idx] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, tris * 3, 0.02, []);
  const map = new Map(), P = [];
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) { let k = map.get(idx[i]); if (k === undefined) { k = P.length / 3; map.set(idx[i], k); P.push(m.pos[idx[i] * 3], m.pos[idx[i] * 3 + 1], m.pos[idx[i] * 3 + 2]); } out[i] = k; }
  return { pos: new Float32Array(P), idx: out };
}

// Dreiecke an der Nullinie eines Feldes g schneiden (g > 0 fällt weg); neue Punkte auf die Fläche gezogen
function schneide(m, g, sdf) {
  const P = Array.from(m.pos), G = [];
  for (let i = 0; i < P.length; i += 3) G.push(g([P[i], P[i + 1], P[i + 2]]));
  const kante = new Map(), I = [];
  const auf = (a, b) => {
    const key = a < b ? a + ',' + b : b + ',' + a; let k = kante.get(key); if (k !== undefined) return k;
    const t = G[a] / (G[a] - G[b]);
    let p = [P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t];
    for (let it = 0; it < 3; it++) p = add(p, mul(grad(sdf.f, p), -sdf.f(...p)));
    k = P.length / 3; P.push(...p); G.push(0); kante.set(key, k); return k;
  };
  for (let t = 0; t < m.idx.length; t += 3) {
    const v = [m.idx[t], m.idx[t + 1], m.idx[t + 2]], drin = v.map((i) => G[i] <= 0), n = drin.filter(Boolean).length;
    if (n === 3) { I.push(...v); continue; }
    if (n === 0) continue;
    // Dreieck so drehen, dass v[0] die „Einzelne“ ist (allein drin bzw. allein draußen)
    let r = 0; for (let k = 0; k < 3; k++) if (drin[k] === (n === 1)) r = k;
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
    const ab = auf(a, b), ac = auf(a, c);
    if (n === 1) I.push(a, ab, ac); else I.push(ab, b, c, ab, c, ac);
  }
  // unbenutzte Punkte raus
  const map = new Map(), Q = [], out = [];
  for (const i of I) { let k = map.get(i); if (k === undefined) { k = Q.length / 3; map.set(i, k); Q.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } out.push(k); }
  return { pos: new Float32Array(Q), idx: new Uint32Array(out) };
}

// ---------------------------------------------------------------- Vorlage lesen
async function vorlage(ref) {
  const doc = await io.read(path.join(ROOT, 'assets', 'avatars', ref + '.glb'));
  const root = doc.getRoot();
  const skin = root.listSkins()[0], joints = skin.listJoints(), ibm = skin.getInverseBindMatrices();
  const W = joints.map((n) => new THREE.Matrix4().fromArray(n.getWorldMatrix()));
  const G = {};
  joints.forEach((n, i) => { G[kurz(n.getName())] = [W[i].elements[12], W[i].elements[13], W[i].elements[14]]; });
  // Haut des Menschen in Welt-Koordinaten (Ruhepose) mit Gewichten
  const B = joints.map((n, i) => W[i].clone().multiply(new THREE.Matrix4().fromArray(ibm.getElement(i, []))));
  const haut = { p: [], j: [], w: [] };
  const v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0');
    const pe = [], je = [], we = [];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, pe); J.getElement(i, je); Wt.getElement(i, we);
      v.fromArray(pe); acc.set(0, 0, 0);
      let ws = 0; for (let k = 0; k < 4; k++) if (we[k] > 0) { acc.addScaledVector(tmp.copy(v).applyMatrix4(B[je[k]]), we[k]); ws += we[k]; }
      acc.multiplyScalar(1 / ws);
      haut.p.push(acc.x, acc.y, acc.z); haut.j.push([...je]); haut.w.push(we.map((x) => x / ws));
    }
  }
  return { doc, root, skin, joints, G, haut, namen: joints.map((n) => kurz(n.getName())) };
}

// Körpergegend eines Knochens (für die Gewichts-Übernahme)
function gegend(n) {
  if (/^(L|R)_(Clavicle)$/.test(n)) return 'rumpf';
  const m = /^(L|R)_(UpperArm|Forearm|Hand|Finger\d*)$/.exec(n); if (m) return 'arm' + m[1];
  const b = /^(L|R)_(Thigh|Calf|Foot|Toe\d*)$/.exec(n); if (b) return 'bein' + b[1];
  if (/^(Pelvis|Spine\d?|Neck)$/.test(n)) return 'rumpf';
  return 'kopf';
}

// ---------------------------------------------------------------- ein Tier bauen
async function baue(name) {
  const t0 = Date.now();
  const def = TIERE[name];
  const V = await vorlage(def.ref);
  const plan = bauplan(name, V.G);
  const koerper = plan.familien.filter((f) => !/augen|nase|mund/.test(f.name));
  const alle = (x, y, z) => { let d = 9; for (const f of koerper) { const q = f.sdf.f(x, y, z); if (q < d) d = q; } return d; };
  // Knochen: Vorlage ohne Gesicht + Ohr/Schwanz
  const neu = Object.keys(plan.knochen);
  const jn = V.namen.filter((n) => !FACE.test(n)).concat(neu);
  const ji = Object.fromEntries(jn.map((n, i) => [n, i]));
  const kopfJ = ji.Head, beckenJ = ji.Pelvis, handJ = { L: ji.L_Hand, R: ji.R_Hand };
  const mapJ = (vi) => { // Knochen-Index der Vorlage → neuer Index (Finger → Hand, Gesicht → Kopf)
    const n = V.namen[vi];
    const f = /^(L|R)_Finger/.exec(n); if (f) return handJ[f[1]];
    return ji[n] ?? kopfJ;
  };
  // Haut-Punkte der Vorlage je Gegend (nach dem stärksten Knochen)
  const proGegend = {};
  for (let i = 0; i < V.haut.w.length; i++) {
    let bk = 0; for (let k = 1; k < 4; k++) if (V.haut.w[i][k] > V.haut.w[i][bk]) bk = k;
    const g = gegend(V.namen[V.haut.j[i][bk]]);
    (proGegend[g] = proGegend[g] || []).push(i);
  }
  const Z = { P: [], N: [], C0: [], C1: [], JJ: [], WW: [], IDX: [] }, ZL = { P: [], N: [], JJ: [], WW: [], IDX: [] };
  const stat = [];
  const teil = (fam, m, Z, farbig) => {
    const nv = m.pos.length / 3, basis = Z.P.length / 3;
    // Nachbarn (für die Gewichts-Glättung)
    const nb = Array.from({ length: nv }, () => new Set());
    for (let t = 0; t < m.idx.length; t += 3) { const [a, b, c] = [m.idx[t], m.idx[t + 1], m.idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
    const w = Array.from({ length: nv }, () => new Map());
    for (let i = 0; i < nv; i++) {
      const p = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
      const n = grad(fam.sdf.f, p);
      Z.P.push(...p); Z.N.push(...n);
      if (farbig) {
        // Umgebungsverdeckung aus dem Feld aller Körperstücke (5 Schritte längs der Normalen)
        let occ = 0;
        for (let s = 1; s <= 5; s++) { const hh = 0.018 * s; occ += (hh - Math.min(hh, alle(p[0] + n[0] * hh, p[1] + n[1] * hh, p[2] + n[2] * hh))) / 2 ** s; }
        const ao = Math.max(0.5, 1 - occ * 9);
        const mal = male(fam.farbe(p, n), p);
        const fell = mal.fell * 0.45 + (mal.naht ? 0.5 : 0);
        Z.C0.push(mal.aussen[0] * ao, mal.aussen[1] * ao, mal.aussen[2] * ao, fell);
        const d = Math.max(-1, Math.min(1, mal.d / D_MAX));
        Z.C1.push(...[mal.innen[0] * ao, mal.innen[1] * ao, mal.innen[2] * ao].map((x) => Math.round(Math.sqrt(Math.max(0, Math.min(1, x))) * 255)), Math.round((0.5 + 0.5 * d) * 255));
      }
      // Gewichte
      const k = fam.klasse;
      if (k === 'kopf') w[i].set(kopfJ, 1);
      else if (k === 'ohrL' || k === 'ohrR' || k === 'schwanz') {
        const bn = k === 'schwanz' ? 'Schwanz' : 'Ohr_' + k.slice(3), b = plan.knochen[bn];
        const dist = Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]);
        const a = Math.min(1, Math.max(0, (dist - 0.015) / 0.05));
        w[i].set(ji[bn], a); if (a < 1) w[i].set(k === 'schwanz' ? beckenJ : kopfJ, 1 - a);
      } else {
        const liste = proGegend[k] || [];
        let best = -1, bd = 1e9;
        for (const q of liste) { const dx = V.haut.p[q * 3] - p[0], dy = V.haut.p[q * 3 + 1] - p[1], dz = V.haut.p[q * 3 + 2] - p[2]; const dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; best = q; } }
        for (let s = 0; s < 4; s++) { const ww = V.haut.w[best][s]; if (ww > 0) { const j = mapJ(V.haut.j[best][s]); w[i].set(j, (w[i].get(j) || 0) + ww); } }
      }
    }
    // Glätten (nur Rumpf, Arme, Beine – sonst sind die Gewichte schon glatt)
    if (/rumpf|arm|bein/.test(fam.klasse)) {
      for (let it = 0; it < 6; it++) {
        const nw = w.map((wi, i) => { const r = new Map(); for (const [j, x] of wi) r.set(j, x * 0.5); const ns = nb[i]; const f = 0.5 / (ns.size || 1); for (const q of ns) for (const [j, x] of w[q]) r.set(j, (r.get(j) || 0) + x * f); if (!ns.size) for (const [j, x] of wi) r.set(j, x); return r; });
        for (let i = 0; i < nv; i++) w[i] = nw[i];
      }
    }
    for (let i = 0; i < nv; i++) {
      const top = [...w[i]].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const s = top.reduce((a, b) => a + b[1], 0) || 1;
      for (let k = 0; k < 4; k++) { Z.JJ.push(top[k] ? top[k][0] : 0); Z.WW.push(top[k] ? top[k][1] / s : 0); }
    }
    for (let t = 0; t < m.idx.length; t++) Z.IDX.push(m.idx[t] + basis);
  };
  for (const fam of plan.familien) {
    let m = netz(fam.sdf, fam.h);
    const roh = m.idx.length / 3;
    m = vereinfache(m, fam.tris);
    stat.push(`${fam.name} ${roh}→${m.idx.length / 3}`);
    teil(fam, m, Z, true);
  }
  // Leibchen: Hülle über dem Rumpf, Saum/Hals/Armlöcher exakt geschnitten (Dreiecke an der Schnittlinie geteilt)
  const lb = plan.familien.leibchen;
  if (lb) {
    const m = schneide(vereinfache(netz(lb.sdf, 0.009), 1100), lb.schnitt, lb.sdf);
    stat.push(`leibchen ${m.idx.length / 3}`);
    teil({ sdf: lb.sdf, klasse: 'rumpf' }, m, ZL, false);
  }
  const { P, N, C0, C1, JJ, WW, IDX } = Z;
  // ---- Ausgabe: Dokument der Vorlage umbauen
  const { doc, root, skin } = V;
  const nodeByName = Object.fromEntries(root.listNodes().map((n) => [kurz(n.getName()), n]));
  // Gesichtsknochen raus (aus dem Skin und aus der Szene)
  for (const j of skin.listJoints()) if (!(kurz(j.getName()) in ji)) skin.removeJoint(j);
  for (const n of root.listNodes()) if (FACE.test(kurz(n.getName()))) n.dispose();
  // neue Knochen (Ohren am Kopf, Schwanz am Becken), Ruhelage = Basis des Teils
  for (const bn of neu) {
    const parent = nodeByName[bn === 'Schwanz' ? 'Pelvis' : 'Head'];
    const pw = new THREE.Matrix4().fromArray(parent.getWorldMatrix());
    const lp = new THREE.Vector3(...plan.knochen[bn]).applyMatrix4(pw.clone().invert());
    const node = doc.createNode(bn).setTranslation([lp.x, lp.y, lp.z]);
    parent.addChild(node); skin.addJoint(node); nodeByName[bn] = node;
  }
  const order = skin.listJoints().map((n) => kurz(n.getName()));
  if (order.join() !== jn.join()) {
    // Reihenfolge der Gelenke im Skin = Indizes in JOINTS_0 → umrechnen
    const re = jn.map((n) => order.indexOf(n));
    if (re.some((x) => x < 0)) throw new Error('Knochen fehlt: ' + jn.filter((n, i) => re[i] < 0));
    for (let i = 0; i < JJ.length; i++) JJ[i] = re[JJ[i]];
    for (let i = 0; i < ZL.JJ.length; i++) ZL.JJ[i] = re[ZL.JJ[i]];
  }
  const ib = new Float32Array(order.length * 16);
  order.forEach((n, i) => ib.set(new THREE.Matrix4().fromArray(nodeByName[n].getWorldMatrix()).invert().elements, i * 16));
  const buf = root.listBuffers()[0];
  skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ib).setBuffer(buf));
  const meshNode = root.listNodes().find((n) => n.getSkin() && n.getMesh());
  for (const n of root.listNodes()) if (n.getMesh() && n !== meshNode) n.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const mt of root.listMaterials()) mt.dispose();
  const old = meshNode.getMesh();
  const mat = doc.createMaterial('plush_body').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const acc = (type, arr, norm = false) => doc.createAccessor().setType(type).setArray(arr).setNormalized(norm).setBuffer(buf);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(P)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(N)))
    .setAttribute('COLOR_0', acc('VEC4', new Float32Array(C0)))
    .setAttribute('_INNEN', acc('VEC4', new Uint8Array(C1), true))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(JJ)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(WW)))
    .setIndices(acc('SCALAR', new Uint16Array(IDX)))
    .setMaterial(mat);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  if (ZL.IDX.length) {
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array(ZL.P)))
      .setAttribute('NORMAL', acc('VEC3', new Float32Array(ZL.N)))
      .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(ZL.JJ)))
      .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(ZL.WW)))
      .setIndices(acc('SCALAR', new Uint16Array(ZL.IDX)))
      .setMaterial(doc.createMaterial('leibchen').setRoughnessFactor(0.82).setMetallicFactor(0).setDoubleSided(true)));
  }
  meshNode.setMesh(mesh).setName(name);
  old.dispose();
  for (const e of root.listExtensionsUsed()) if (/webp|basisu|texture/i.test(e.extensionName)) e.dispose();
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizeGeneric: 8 }));
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, name + '.glb');
  await io.write(out, doc);
  if (P.length / 3 > 65535) throw new Error('zu viele Punkte');
  const hoehe = Math.max(...P.filter((_, i) => i % 3 === 1)), tief = Math.min(...P.filter((_, i) => i % 3 === 1));
  const kb = fs.statSync(out).size / 1024;
  console.log(`${name.padEnd(8)} ${(IDX.length / 3).toString().padStart(5)} Dreiecke, ${(P.length / 3)} Punkte, ${kb.toFixed(0)} KB, Höhe ${hoehe.toFixed(2)} m, Sohle ${tief.toFixed(3)} m, ${order.length} Knochen, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log('   ', stat.join(' · '));
  return { name, sex: def.sex, ref: def.ref, tris: IDX.length / 3, kb: +kb.toFixed(1), hoehe: +hoehe.toFixed(3), knochen: neu };
}

const namen = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TIERE);
const info = fs.existsSync(path.join(OUT, 'kuscheltiere.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'kuscheltiere.json'), 'utf8')) : {};
for (const n of namen) info[n] = await baue(n);
fs.writeFileSync(path.join(OUT, 'kuscheltiere.json'), JSON.stringify(info, null, 1) + '\n');
