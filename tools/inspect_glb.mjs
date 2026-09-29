import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const a of doc.getRoot().listAnimations()) {
  let maxT = 0, keys = 0, bytes = 0; const paths = {};
  for (const s of a.listSamplers()) { const i = s.getInput(); maxT = Math.max(maxT, i.getMax([0])[0]); keys += i.getCount(); bytes += s.getOutput().getArray().byteLength; }
  for (const c of a.listChannels()) paths[c.getTargetPath()] = (paths[c.getTargetPath()] || 0) + 1;
  console.log(a.getName(), 'dauer', maxT.toFixed(2), 'kanäle', JSON.stringify(paths), 'keys', keys, 'bytes', bytes, 'outType', a.listSamplers()[0]?.getOutput().getComponentType());
}
console.log('nodes', doc.getRoot().listNodes().length, doc.getRoot().listNodes().slice(0,4).map(n=>n.getName()));
