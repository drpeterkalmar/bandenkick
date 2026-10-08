// n4 (Audit #7): Rocketbox-Avatare mit KTX2-Texturen (Basis Universal) – Vorlage stuntbahn/tools/build_ktx2.mjs (Grafik-Kern).
// Liest die fertigen Avatare assets/avatars/<Name>.glb (WebP), kodiert jede Textur neu und schreibt
// assets/avatars/ktx2/<Name>.glb (KHR_texture_basisu, meshopt bleibt) + src/render/avatar_ktx2.js (Liste für den Lader).
//   Gesicht (head) und Normalen: UASTC (scharf, Normalen ohne Blockfehler), mit zstd-Superkompression und RDO
//   Körper/Kleidung (body) und Haare (opacity): ETC1S (klein); Körper optional in 2048 statt 1024 (--koerper 2048,
//   nur wenn die Quelle in assets_src/work/avatars größer ist)
// Die Bilder werden vor dem Kodieren nicht gespiegelt: glTF-Texturen haben flipY = false (anders als stuntbahn/build_ktx2).
//
// Aufruf:  node tools/build_ktx2_avatars.mjs [--messen] [--nur-etc1s] [--koerper 1024|2048] [Name …]
//   --messen     nur Größen ausgeben (eine Figur reicht), nichts schreiben
//   --nur-etc1s  alles ETC1S (kleinste Dateien, Gesichter/Normalen etwas gröber)
// Braucht das npm-Paket ktx2-encoder (devDependency, wie in der Stuntbahn: npm i -D ktx2-encoder). Ohne Paket kann der Pfad
// zum Modul in KTX2_ENCODER stehen (z. B. ../stuntbahn/node_modules/ktx2-encoder/dist/node/index.js).
// ACHTUNG Budget (Ladegröße ≤ vorher + 1 MB): die WebP-Texturen aller sechs Figuren wiegen heute nur 1,04 MB; dazu kämen
// ~0,6 MB Transcoder (wasm, wird erst bei KTX2 geladen). Vorher mit --messen schätzen (Zahlen in VORBAU_bandenkick-n4-technik.md).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const MESSEN = flag('--messen'), NUR_ETC1S = flag('--nur-etc1s'), KOERPER = +opt('--koerper', 1024);
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--koerper');

let encodeToKTX2;
try { ({ encodeToKTX2 } = await import(process.env.KTX2_ENCODER || 'ktx2-encoder')); } catch (e) {
  console.error('ktx2-encoder fehlt: npm i -D ktx2-encoder (oder KTX2_ENCODER=<Pfad zu dist/node/index.js>)'); process.exit(2);
}
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// Art einer Textur nach Material und Platz
export function art(matName, slot) {
  if (slot === 'normal') return 'normal';
  if (/head/i.test(matName)) return 'gesicht';
  if (/opacity/i.test(matName)) return 'haare';
  return 'koerper';
}
// Kodier-Einstellungen je Art (UASTC: Gesicht, Normalen; ETC1S: Rest)
export function einstellung(a, nurEtc1s = false) {
  const uastc = !nurEtc1s && (a === 'gesicht' || a === 'normal');
  return uastc
    ? { isUASTC: true, needSupercompression: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: a === 'normal' ? 0.75 : 1.25, isNormalMap: a === 'normal', isSetKTX2SRGBTransferFunc: a !== 'normal', generateMipmap: true }
    : { isUASTC: false, qualityLevel: a === 'normal' ? 220 : 160, compressionLevel: 2, isNormalMap: a === 'normal', isSetKTX2SRGBTransferFunc: a !== 'normal', generateMipmap: true };
}

const imageDecoder = async (buf) => { const r = await sharp(Buffer.from(buf)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { width: r.info.width, height: r.info.height, data: new Uint8Array(r.data) }; };
const quelle = (name) => path.join(ROOT, 'assets_src', 'work', 'avatars', name + '.glb');

const liste = names.length ? names : fs.readdirSync(path.join(ROOT, 'assets', 'avatars')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));
if (MESSEN && !names.length) liste.splice(1);
const out = path.join(ROOT, 'assets', 'avatars', 'ktx2');
if (!MESSEN) fs.mkdirSync(out, { recursive: true });
let sumWebp = 0, sumKtx = 0, sumGlb = 0;
const manifest = {};
for (const name of liste) {
  const doc = await io.read(path.join(ROOT, 'assets', 'avatars', name + '.glb'));
  const root = doc.getRoot();
  // große Körper-Textur aus der Blender-Ausgabe (vor pack_avatars), falls gewünscht und vorhanden
  let gross = null;
  if (KOERPER > 1024 && fs.existsSync(quelle(name))) gross = await io.read(quelle(name));
  const t0 = Date.now();
  for (const mat of root.listMaterials()) {
    for (const [slot, tex] of [['basecolor', mat.getBaseColorTexture()], ['normal', mat.getNormalTexture()]]) {
      if (!tex) continue;
      const a = art(mat.getName(), slot);
      let img = tex.getImage();
      if (a === 'koerper' && gross) {
        const gm = gross.getRoot().listMaterials().find((m) => m.getName() === mat.getName());
        const gt = gm && gm.getBaseColorTexture();
        if (gt) img = await sharp(Buffer.from(gt.getImage())).resize(KOERPER, KOERPER, { kernel: 'lanczos3' }).png().toBuffer();
      }
      const ktx = await encodeToKTX2(new Uint8Array(img), { imageDecoder, isKTX2File: true, enableDebug: false, ...einstellung(a, NUR_ETC1S) });
      sumWebp += tex.getImage().length; sumKtx += ktx.length;
      console.log(`${name.padEnd(18)} ${mat.getName().padEnd(14)} ${slot.padEnd(9)} ${a.padEnd(8)} ${(tex.getImage().length / 1024).toFixed(0).padStart(4)} KB WebP → ${(ktx.length / 1024).toFixed(0).padStart(4)} KB KTX2 (${einstellung(a, NUR_ETC1S).isUASTC ? 'UASTC' : 'ETC1S'})`);
      if (!MESSEN) tex.setImage(new Uint8Array(ktx)).setMimeType('image/ktx2').setURI(tex.getURI().replace(/\.\w+$/, '.ktx2'));
    }
  }
  console.log(`  ${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (MESSEN) continue;
  for (const e of root.listExtensionsUsed()) if (e.extensionName === 'EXT_texture_webp') e.dispose();
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  const file = path.join(out, name + '.glb');
  await io.write(file, doc);
  sumGlb += fs.statSync(file).size;
  manifest[name] = `assets/avatars/ktx2/${name}.glb`;
}
console.log(`Texturen: WebP ${(sumWebp / 1e6).toFixed(2)} MB → KTX2 ${(sumKtx / 1e6).toFixed(2)} MB${MESSEN ? ' (Stichprobe)' : `; GLBs ${(sumGlb / 1e6).toFixed(2)} MB`}`);
if (!MESSEN) {
  // Lader-Dateien (KTX2Loader + Basis-Transcoder) aus der Stuntbahn kopieren, falls sie hier noch fehlen (gleiche three-Version r186)
  const SB = path.join(ROOT, '..', 'stuntbahn', 'lib', 'addons'), LB = path.join(ROOT, 'lib', 'three', 'addons');
  for (const f of ['loaders/KTX2Loader.js', 'libs/ktx-parse.module.js', 'libs/zstddec.module.js', 'libs/basis/basis_transcoder.js', 'libs/basis/basis_transcoder.wasm']) {
    const z = path.join(LB, f);
    if (!fs.existsSync(z) && fs.existsSync(path.join(SB, f))) { fs.mkdirSync(path.dirname(z), { recursive: true }); fs.copyFileSync(path.join(SB, f), z); console.log('kopiert', f); }
  }
  fs.writeFileSync(path.join(ROOT, 'src', 'render', 'avatar_ktx2.js'),
    `// Erzeugt von tools/build_ktx2_avatars.mjs – Avatare mit KTX2-Texturen (null = keine, Lader nimmt die WebP-Fassung)\nexport const KTX2_AVATARE = ${JSON.stringify(manifest, null, 1)};\n`);
  console.log('src/render/avatar_ktx2.js geschrieben – danach python3 tools/update_sw.py (WebP- und KTX2-Fassung nicht beide vorab laden!)');
}
