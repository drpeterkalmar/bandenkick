// Packt die Blender-Ausgabe (assets_src/work, siehe tools/rb_to_glb.py) handytauglich nach assets/:
//  – Avatare: Körper-Farbe 1024² WebP, Kopf-Farbe 512², Körper-Normalmap 512² (Kopf ohne: am Handy ~10 px Gesicht),
//    Geometrie quantisiert + meshopt.  → assets/avatars/<Name>.glb
//  – Animationen: nur Rotationen der Körperknochen + Beckenposition (Gesichtsknochen, Skalierung, konstante
//    Knochenlängen raus), redundante Schlüssel entfernt (resample), meshopt. → assets/anims/<m|f>.glb + .json
// Aufruf: node tools/pack_avatars.mjs [--anims] [--avatars] [Name …]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORK = path.join(ROOT, 'assets_src', 'work');
const OUT = path.join(ROOT, 'assets');
const FACE = new Set(['REye', 'LEye', 'MJaw', 'MBottomLip', 'MTongue', 'LMouthBottom', 'RMouthBottom', 'RMasseter', 'LMasseter',
  'MUpperLip', 'RCaninus', 'LCaninus', 'REyeBlinkBottom', 'LEyeBlinkBottom', 'RUpperlip', 'LUpperlip', 'RMouthCorner',
  'LMouthCorner', 'RCheek', 'LCheek', 'REyeBlinkTop', 'LEyeBlinkTop', 'RInnerEyebrow', 'LInnerEyebrow', 'MMiddleEyebrow',
  'ROuterEyebrow', 'LOuterEyebrow', 'MNose']);

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const names = args.filter((a) => !a.startsWith('--'));
const all = !flags.has('--anims') && !flags.has('--avatars');

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';

async function recode(tex, size, q) {
  const buf = await sharp(Buffer.from(tex.getImage())).resize(size, size, { kernel: 'lanczos3' }).webp({ quality: q, effort: 6 }).toBuffer();
  tex.setImage(new Uint8Array(buf)).setMimeType('image/webp').setURI(tex.getURI().replace(/\.\w+$/, '.webp'));
}

if (all || flags.has('--avatars')) {
  fs.mkdirSync(path.join(OUT, 'avatars'), { recursive: true });
  const list = names.length ? names : fs.readdirSync(path.join(WORK, 'avatars')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));
  for (const name of list) {
    const doc = await io.read(path.join(WORK, 'avatars', name + '.glb'));
    const root = doc.getRoot();
    doc.createExtension(EXTTextureWebP).setRequired(true);
    for (const mat of root.listMaterials()) {
      const head = /head/i.test(mat.getName()), hair = /opacity/i.test(mat.getName());
      const bc = mat.getBaseColorTexture(), nm = mat.getNormalTexture();
      if (bc) await recode(bc, head || hair ? 512 : 1024, hair ? 90 : 84);
      if (nm) { if (head || hair) mat.setNormalTexture(null); else await recode(nm, 512, 88); }
      mat.setMetallicFactor(0).setRoughnessFactor(hair ? 0.6 : 0.72);
      if (hair) mat.setAlphaMode('MASK').setAlphaCutoff(0.45).setDoubleSided(true);
      else mat.setAlphaMode('OPAQUE');
    }
    await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = path.join(OUT, 'avatars', name + '.glb');
    await io.write(out, doc);
    let tris = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3;
    console.log('Avatar', name, kb(out), tris, 'Dreiecke');
  }
}

if (all || flags.has('--anims')) {
  fs.mkdirSync(path.join(OUT, 'anims'), { recursive: true });
  for (const sex of ['m', 'f']) {
    const src = path.join(WORK, `anims_${sex}.glb`);
    if (!fs.existsSync(src)) continue;
    const doc = await io.read(src);
    const root = doc.getRoot();
    let kept = 0, dropped = 0;
    for (const anim of root.listAnimations()) {
      for (const ch of anim.listChannels()) {
        const node = ch.getTargetNode(), p = ch.getTargetPath();
        const nm = node ? node.getName() : '';
        const bone = nm.replace(/^Bip01[ _]/, '');
        const keep = node && nm !== 'Bip01' && ((p === 'rotation' && !FACE.has(bone)) || (p === 'translation' && bone === 'Pelvis'));
        if (keep) { kept++; continue; }
        const s = ch.getSampler();
        ch.dispose(); dropped++;
        if (s && !s.listParents().some((x) => x.propertyType === 'AnimationChannel')) s.dispose();
      }
    }
    await doc.transform(resample({ tolerance: 2e-4 }), dedup(), prune({ keepLeaves: true }));
    // Rotationen als normalisiertes Int16 (glTF erlaubt das für Rotations-Ausgaben; three.js dequantisiert)
    for (const anim of root.listAnimations()) {
      for (const ch of anim.listChannels()) {
        if (ch.getTargetPath() !== 'rotation') continue;
        const acc = ch.getSampler().getOutput();
        if (acc.getComponentType() !== 5126) continue;
        const a = acc.getArray(), q = new Int16Array(a.length);
        for (let i = 0; i < a.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, a[i])) * 32767);
        acc.setArray(q).setNormalized(true);
      }
    }
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const out = path.join(OUT, 'anims', `${sex}.glb`);
    await io.write(out, doc);
    const meta = JSON.parse(fs.readFileSync(path.join(WORK, `anims_${sex}.json`), 'utf8'));
    fs.writeFileSync(path.join(OUT, 'anims', `${sex}.json`), JSON.stringify(meta));
    console.log('Animationen', sex, kb(out), `${root.listAnimations().length} Clips, Kanäle ${kept} behalten, ${dropped} entfernt`);
  }
}
