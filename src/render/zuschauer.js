// Verschönerung „Zuschauer“ (Deko, Peter 05.10.): Zuschauer als Bildtafeln (Impostors). Beim Start werden die schon
// geladenen Rocketbox-Menschen (ohne Leibchen) einmal in einen Atlas gerendert – 6 Personen × 6 Posen (vorn: stehen,
// klatschen A/B, jubeln; hinten: stehen, jubeln). Keine Downloads, kein Dauer-Rechnen: alle Zuschauer sind 1 Draw-Call,
// Haltung und Hüpfen wählt der Vertex-Shader aus Zeit, Phase und „Aufregung“ (Tor, Pfostenschuss, Abpfiff).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mulberry32 } from './stimmung.js';

export const FANS = ['Sports_Male_02', 'Female_Adult_12', 'Male_Adult_10', 'Sports_Female_02', 'Sports_Male_04', 'Sports_Male_03'];
// Posen je Geschlecht: [Clip, Zeit-Anteil], Blick (1 vorn, −1 hinten) – Zeitpunkte aus Prüfbildern gewählt
// (tests/deko_atlas.py): Hände zusammen/auseinander, Jubel mit erhobenem Arm bzw. Fäusten oben
export const POSES = [
  { m: ['wait', 0.12], f: ['wait', 0.12], view: 1 },    // 0 stehen
  { m: ['clap', 0.125], f: ['clap', 0.31], view: 1 },   // 1 klatschen: Hände zusammen
  { m: ['clap', 0.5], f: ['clap', 0.19], view: 1 },     // 2 klatschen: Hände auseinander
  { m: ['wave', 0.5], f: ['cheer', 0.44], view: 1 },    // 3 Jubel A
  { m: ['cheer', 0.44], f: ['cheer', 0.56], view: 1 },  // 4 Jubel B
  { m: ['wait', 0.12], f: ['wait', 0.12], view: -1 },   // 5 von hinten: stehen
  { m: ['wave', 0.5], f: ['cheer', 0.44], view: -1 },   // 6 von hinten: Jubel
];
const CW_M = 0.95, CH_M = 1.95, CPX = 96; // Zelle in Metern / Pixel je Zellbreite

// Atlas rendern (einmal, kurz nach dem Start). A = loadAvatarAssets(). Gerendert wird in der Hauptszene (alles andere kurz
// ausgeblendet) mit deren Sonne und Umgebungslicht. Je Person eine Kopie; je Pose ein Durchgang (alle Personen
// gleichzeitig in ihrer Zeile). Zweistufig: prepare() übersetzt die Shader – wenn möglich parallel im Hintergrund
// (compileAsync) –, render() zeichnet danach in wenigen Millisekunden.
export function spectatorBake(A, renderer, scene, poses = POSES, fans = FANS) {
  const cols = poses.length, rows = fans.length;
  const W = cols * CPX, H = Math.round(rows * CPX * CH_M / CW_M);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, depthBuffer: true });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const root = new THREE.Group(); root.name = 'zuschauer_atelier';
  const figs = [];
  fans.forEach((name, r) => {
    const src = A.avatars[name]; if (!src) return;
    const sex = /Female/.test(name) ? 'f' : 'm';
    const model = SkeletonUtils.clone(src.scene);
    model.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = false; } });
    model.position.y = 0.015;
    const holder = new THREE.Group(); holder.add(model); root.add(holder);
    figs.push({ model, holder, sex, r, mixer: new THREE.AnimationMixer(model), act: null });
  });
  const cam = new THREE.OrthographicCamera(0, cols * CW_M, rows * CH_M, 0, 0.1, 50);
  cam.position.set(0, 0, 10); cam.updateMatrixWorld(true);
  const withRT = (fn) => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); try { return fn(); } finally { renderer.setRenderTarget(prev); } };
  return {
    prepare() {
      root.updateMatrixWorld(true);
      return withRT(() => (renderer.compileAsync ? renderer.compileAsync(root, cam, scene) : Promise.resolve(renderer.compile(root, cam, scene)))).catch(() => {});
    },
    // eine Pose (Spalte) zeichnen; c = 0 leert vorher den Atlas
    pose(c) {
      const hidden = [];
      for (const o of scene.children) if (o.visible && !o.isLight) { hidden.push(o); o.visible = false; }
      scene.add(root);
      const prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevAuto = renderer.autoClear;
      withRT(() => {
        if (c === 0) { renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); }
        renderer.autoClear = false;
        const pz = poses[c], view = Array.isArray(pz) ? pz[2] : pz.view;
        for (const f of figs) {
          const [clip, frac] = Array.isArray(pz) ? pz : pz[f.sex];
          const cl = A.clips[f.sex][clip];
          if (f.act) f.act.stop();
          if (cl) { f.act = f.mixer.clipAction(cl); f.act.reset().play(); f.mixer.setTime(cl.duration * frac); }
          f.holder.rotation.y = view > 0 ? 0 : Math.PI;
          f.holder.position.set((c + 0.5) * CW_M, (rows - 1 - f.r) * CH_M, 0);
        }
        root.updateMatrixWorld(true);
        renderer.clearDepth();
        renderer.render(scene, cam);
      });
      renderer.autoClear = prevAuto; renderer.setClearColor(prevClear, prevA);
      scene.remove(root);
      for (const o of hidden) o.visible = true;
    },
    count: poses.length,
    finish() {
      for (const f of figs) { f.mixer.stopAllAction(); f.model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); }); }
      return { tex: rt.texture, rt, cols, rows, W, H };
    },
    render() { for (let c = 0; c < poses.length; c++) this.pose(c); return this.finish(); },
  };
}
// Einfacher Aufruf (Tests/Prüfbilder): sofort übersetzen und rendern
export function bakeSpectators(A, renderer, scene, poses = POSES, fans = FANS) { return spectatorBake(A, renderer, scene, poses, fans).render(); }

// Plätze: Gruppen mittig hinter den Toren (hinter der Fan-Cam; hochkant nicht hinter Spielstand und Menüknopf), an den
// Längsseiten außerhalb des Spielbilds (nur Menü und Wiederholung). Kinder kleiner.
export const SPOTS = [
  [16.8, -1.7, 0], [17.4, -0.7, 1], [16.9, 0.5, 0], [17.6, 1.6, 0], [18.4, -1.2, 0],
  [-16.8, 1.7, 0], [-17.4, 0.7, 1], [-16.9, -0.5, 0], [-17.6, -1.6, 0], [-18.4, 1.2, 0],
  [-9.2, 12.3, 0], [-8.4, 12.9, 1], [2.4, 12.2, 0], [3.2, 12.8, 0], [9.6, 12.4, 0],
  [-6.2, -12.9, 0], [-5.4, -13.4, 1], [4.0, -12.9, 0], [4.8, -13.5, 0], [11.2, -12.8, 0],
].map(([x, z, kid]) => ({ x, z, kid }));

export class Zuschauer {
  constructor(atlas, opts = {}) {
    const rnd = mulberry32(31337), n = SPOTS.length;
    const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const pos = new Float32Array(n * 3), a = new Float32Array(n * 4), b = new Float32Array(n * 4);
    SPOTS.forEach((s, i) => {
      pos.set([s.x, 0, s.z], i * 3);
      const face = Math.atan2(-s.x * 0.8, -s.z); // Blick ungefähr zur Feldmitte
      const who = Math.floor(rnd() * FANS.length);
      a.set([face, who, rnd() * 10, rnd() < 0.55 ? 1 : 0], i * 4);   // Blick, Person, Phase, Jubler (1) oder Klatscher (0)
      b.set([s.kid ? 0.66 : 0.93 + rnd() * 0.12, rnd() < 0.5 ? 1 : -1, 0.86 + rnd() * 0.22, rnd() * 0.35], i * 4); // Größe, Spiegel, Helligkeit, Reaktionszeit
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(b, 4));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 24);
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uMap: { value: null }, uTime: { value: 0 }, uEx: { value: 0 }, uExT: { value: 99 }, uClap: { value: 0 },
      uGrid: { value: new THREE.Vector2(atlas.cols, atlas.rows) }, uSize: { value: new THREE.Vector2(CW_M, CH_M) },
      uLight: { value: new THREE.Color(1, 1, 1) }, uCalm: { value: opts.calm ? 1 : 0 }, uAppear: { value: 0 }, uHideX: { value: -1e4 },
    }]);
    u.uMap.value = atlas.tex;
    const aa = !!opts.aa;
    this.mat = new THREE.ShaderMaterial({
      uniforms: u, fog: true, alphaToCoverage: aa, defines: aa ? { A2C: 1 } : {},
      vertexShader: `attribute vec3 iPos; attribute vec4 iA; attribute vec4 iB;
        uniform float uTime, uEx, uExT, uClap, uCalm, uHideX; uniform vec2 uGrid, uSize;
        varying vec2 vUv; varying float vTint;
        #include <fog_pars_vertex>
        void main() {
          if (iPos.x < uHideX) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          vec3 tc = cameraPosition - iPos; tc.y = 0.0; tc = normalize(tc + vec3(1e-4, 0.0, 0.0));
          vec2 face = vec2(sin(iA.x), cos(iA.x));
          bool front = dot(face, tc.xz) > -0.25;
          float ph = iA.z;
          bool react = uExT > iB.w;                                  // Reaktionszeit nach dem Tor
          float ex = react ? uEx : 0.0;
          bool cheer = ex > 0.05 && iA.w > 0.5;
          bool clap = (ex > 0.05 && iA.w < 0.5) || (uClap > 0.05 && fract(ph * 0.71) < uClap)
            || (uCalm < 0.5 && fract(uTime * 0.045 + ph * 0.37) > 0.93);    // ab und zu klatscht jemand
          float pose = front ? 0.0 : 5.0;
          if (front && clap) pose = fract(uTime * 2.6 + ph) < 0.5 ? 1.0 : 2.0;
          if (cheer) pose = front ? (fract(uTime * 1.6 + ph) < 0.5 ? 3.0 : 4.0) : 6.0;
          float jump = cheer ? abs(sin(uTime * 6.5 + ph * 3.0)) * 0.24 * ex * (1.0 - 0.75 * uCalm) : 0.0;
          float sway = sin(uTime * 0.9 + ph * 5.0) * 0.012;
          float cell = iA.y * uGrid.x + pose;
          float col = mod(cell, uGrid.x), row = floor(cell / uGrid.x + 0.001);
          vec2 sz = uSize * iB.x;
          vec3 right = vec3(tc.z, 0.0, -tc.x);
          vec3 p = iPos + right * ((position.x + sway) * sz.x) + vec3(0.0, position.y * sz.y + jump, 0.0);
          float ux = iB.y > 0.0 ? uv.x : 1.0 - uv.x;
          vUv = vec2((col + ux) / uGrid.x, (uGrid.y - 1.0 - row + uv.y) / uGrid.y);
          vTint = iB.z;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uLight; uniform float uAppear; varying vec2 vUv; varying float vTint;
        #include <fog_pars_fragment>
        void main() {
          if (uAppear < 1.0 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > uAppear) discard; // sanft einblenden
          vec4 c = texture2D(uMap, vUv);
          c.rgb /= max(c.a, 0.02);                                   // Kanten aus dem Atlas ohne dunklen Saum
          #ifdef A2C
            float a = (c.a - 0.5) / max(fwidth(c.a), 1e-4) + 0.5;
            if (a < 0.02) discard;
            gl_FragColor = vec4(c.rgb * uLight * vTint, clamp(a, 0.0, 1.0));
          #else
            if (c.a < 0.5) discard;
            gl_FragColor = vec4(c.rgb * uLight * vTint, 1.0);
          #endif
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.name = 'zuschauer';
    this.ex = 0; this.exT = 99; this.clap = 0; this.t = 0;
  }
  // Tor: alle jubeln (Jubler hüpfen mit erhobenen Armen, die anderen klatschen), klingt in ~6 s ab
  goal() { this.ex = 1; this.exT = 0; }
  // Pfostenschuss, Parade, Abpfiff: kurzer Beifall
  applause(k = 0.6, dur = 1.6) { this.clap = Math.max(this.clap, k); this.clapDur = dur; }
  update(dt, hideX = -1e4) {
    this.mat.uniforms.uHideX.value = hideX;
    this.t += dt; this.exT += dt;
    if (this.mat.uniforms.uAppear.value < 1) this.mat.uniforms.uAppear.value = Math.min(1, this.mat.uniforms.uAppear.value + dt / 0.7);
    if (this.ex > 0) this.ex = Math.max(0, this.ex - dt / 6);
    if (this.clap > 0) this.clap = Math.max(0, this.clap - dt / (this.clapDur || 1.6) * 0.6);
    const u = this.mat.uniforms;
    u.uTime.value = this.t; u.uEx.value = this.ex; u.uExT.value = this.exT; u.uClap.value = this.clap;
  }
}
