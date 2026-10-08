// Lade-Haken zu three_hook.mjs: 'three' → lib/three/three.module.min.js, 'three/addons/x' → lib/three/addons/x
const LIB = new URL('../../lib/three/', import.meta.url);
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: new URL('three.module.min.js', LIB).href, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: new URL('addons/' + spec.slice(13), LIB).href, shortCircuit: true };
  return next(spec, ctx);
}
