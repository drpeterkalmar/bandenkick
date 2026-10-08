// Renderer, Umgebungslicht (Poly Haven HDRI „Suburban Football Field“, CC0), Himmel, Sonne, Nebel.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.aa, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

// Sonnenrichtung aus Equirect-Koordinaten (three.js-Konvention: u = atan(z, x)/2π + 0,5; v von oben)
export function dirFromUV(u, v) {
  const phi = (u - 0.5) * 2 * Math.PI, theta = v * Math.PI;
  return new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).normalize();
}

export async function loadEnvironment(renderer) {
  const hdr = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync('assets/hdri/env_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(hdr).texture;
  hdr.dispose(); pm.dispose();
  return env;
}

export function makeSky(tex, info) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.generateMipmaps = false;          // sonst Naht am u-Übergang
  tex.minFilter = THREE.LinearFilter;
  const ground = new THREE.Color().setRGB(...info.ground, THREE.SRGBColorSpace);
  const mat = new THREE.ShaderMaterial({
    uniforms: { sky: { value: tex }, cutV: { value: info.cutV }, ground: { value: ground } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform sampler2D sky; uniform float cutV; uniform vec3 ground; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) / 6.2831853 + 0.5;
        float v = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
        vec3 c = v < cutV - 0.002 ? texture2D(sky, vec2(u, 1.0 - v / cutV)).rgb : ground;
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  m.name = 'sky';
  return m;
}

// Sonne: bei bewölktem HDRI weiches, schwaches Richtungslicht aus dem hellsten Bereich (Form + Schatten)
export function makeSun(info, quality, cage) {
  const dir = dirFromUV(info.u, info.v);
  const sun = new THREE.DirectionalLight(0xfff4e8, 1.25);
  sun.position.copy(dir).multiplyScalar(40);
  sun.target.position.set(0, 0, 0);
  sonnenSchatten(sun, quality, cage);
  return { sun, dir };
}
// Schatten der Sonne nach der Qualität (n4: auch nachträglich, wenn der Autopilot die Stufe wechselt). Ausschnitt: ganzer
// Käfig um den Ursprung (±ext); die enge Schattenkamera (schatten.js) setzt Ausschnitt und Ziel danach je Bild selbst.
export function schattenExt(cage) { return Math.max(cage.hx + cage.gD, cage.hz) + 2.5; }
export function sonnenSchatten(sun, quality, cage) {
  sun.castShadow = !!quality.shadows;
  if (!quality.shadows) return;
  const s = quality.shadowSize;
  if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  const ext = schattenExt(cage);
  const cam = sun.shadow.camera;
  if (!sun.userData.schattenkam) { cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; }
  cam.near = 5; cam.far = 90; cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
}
