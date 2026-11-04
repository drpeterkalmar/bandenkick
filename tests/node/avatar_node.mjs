// Node-Tests (n4): Rocketbox-Avatare und -Bewegungen ohne Browser laden – GLB per gltf-transform einlesen, Texturen und
// meshopt-Kompression entfernen (Node hat keine Bilder), dann mit dem GLTFLoader aus lib/three parsen. Liefert dasselbe
// A wie loadAvatarAssets() in src/render/avatars.js (avatars, clips, meta, phase). Canvas-Texturen (Leibchen, Rückennummer)
// bekommen eine stumme Canvas-Attrappe. Nutzung: const { ladeAvatare } = await import('./avatar_node.mjs');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await import('./three_hook.mjs');
const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

if (!globalThis.document) {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.document = { createElement: () => ({ width: 64, height: 64, getContext: () => ctx, style: {} }), createElementNS: () => ({ style: {} }) };
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ROOT = new URL('../../', import.meta.url);

async function ohneTexturen(file) {
  const doc = await io.read(fileURLToPath(new URL(file, ROOT))) // fileURLToPath: Windows-tauglich;
  const root = doc.getRoot();
  for (const t of root.listTextures()) t.dispose();
  for (const e of root.listExtensionsUsed()) if (/meshopt|webp|basisu/i.test(e.extensionName)) e.dispose();
  const bin = await io.writeBinary(doc);
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}
const parse = (buf) => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));

// n10: opts.tierform === 0 → Kuscheltiere mit den Proportionen von 0.7.0 (assets/kuscheltiere_n9)
export async function ladeAvatare(names, opts = {}) {
  const { ROSTER, sexOf, istKuscheltier, plueschMaterial, SAETZE } = await import('../../src/render/avatars.js');
  names = names || [...new Set(ROSTER.flat())];
  const kt = names.every(istKuscheltier); // n9: Kuscheltiere aus assets/kuscheltiere, mit Plüsch-Material wie im Spiel
  const A = { avatars: {}, clips: {}, meta: {}, phase: {}, satz: kt ? 'kuscheltiere' : 'menschen', roster: SAETZE[kt ? 'kuscheltiere' : 'menschen'].roster };
  const ordnerKt = opts.tierform === 0 ? 'assets/kuscheltiere_n9' : 'assets/kuscheltiere';
  for (const n of names) A.avatars[n] = await parse(await ohneTexturen(`${istKuscheltier(n) ? ordnerKt : 'assets/avatars'}/${n}.glb`));
  if (kt) for (const g of Object.values(A.avatars)) plueschMaterial(g.scene);
  for (const s of ['m', 'f']) {
    const g = await parse(await ohneTexturen(`assets/anims/${s}.glb`));
    A.clips[s] = Object.fromEntries(g.animations.map((c) => [c.name, c]));
    A.meta[s] = JSON.parse(readFileSync(new URL(`assets/anims/${s}.json`, ROOT), 'utf8'));
    A.phase[s] = { walk: 0, jog: 0, run: 0, sprint: 0 };
  }
  void sexOf;
  return { A, THREE };
}
