// Bandenkick – Start, Spielschleife (Physik fest 120 Hz, Grafik interpoliert), Debug-API window.__game.
import * as THREE from 'three';
import { makeParams } from './sim/params.js';
import { Game, DT } from './sim/step.js';
import { createRenderer, loadEnvironment, makeSky, makeSun } from './render/scene.js';
import { buildField } from './render/field.js';
import { makeBall, makePlayer, posePlayer, Granulate } from './render/actors.js';
import { GameCamera } from './render/camera.js';
import { Input } from './input/input.js';
import { buildHud } from './ui/hud.js';
import { BUILD } from './build.js';

const qs = new URLSearchParams(location.search);
const P = makeParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const qLevel = qs.has('q') ? +qs.get('q') : (isTouch ? 1 : 2);
const quality = {
  level: qLevel,
  dpr: Math.min(devicePixelRatio || 1, qLevel >= 2 ? 2 : qLevel === 1 ? 1.5 : 1),
  aa: qLevel >= 1,
  shadows: qLevel >= 1,
  shadowSize: qLevel >= 2 ? 2048 : 1024,
};
if (isTouch) document.body.classList.add('touch');
if (qs.has('debug')) document.body.classList.add('debug');

const canvas = document.getElementById('c');
const hud = buildHud(document.getElementById('ui'), canvas);
hud.setHowto(isTouch);
const loadMsg = document.createElement('div');
loadMsg.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;font:600 18px system-ui;color:#fff;background:#10251a';
loadMsg.textContent = 'Bandenkick lädt …';
document.body.append(loadMsg);

const renderer = createRenderer(canvas, quality);
const scene = new THREE.Scene();
const seed = qs.get('seed') || String(Date.now() % 100000);
let game = new Game(P, seed);
const gcam = new GameCamera(innerWidth / innerHeight, game.cage);
const input = new Input(hud);

const G = window.__game = {
  ready: false, frames: 0, build: BUILD, P, quality, errors: window.__errors,
  get game() { return game; },
};

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  gcam.setAspect(w / h, G.forceMode);
  document.body.classList.toggle('hoch', gcam.mode === 'hoch');
  document.body.classList.toggle('quer', gcam.mode !== 'hoch');
  input.resetStick && input.resetStick();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));

let mode = 'load';
function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  hud.show(m === 'menu' ? hud.start : m === 'pause' ? hud.menu : m === 'credits' ? hud.credits : null);
}
let creditsBack = 'menu';
hud.root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'play') startPlay();
  if (a === 'resume') setMode('play');
  if (a === 'credits') { creditsBack = mode; setMode('credits'); }
  if (a === 'back') setMode(creditsBack);
  if (a === 'title') setMode('menu');
  if (a === 'kickoff') { game.kickoff(); setMode('play'); }
  if (a === 'fetch') { const pl = game.players[0]; game.ball.place(pl.x + Math.cos(pl.face) * 0.6, game.ball.r, pl.z + Math.sin(pl.face) * 0.6); game.state = 'play'; setMode('play'); }
});
hud.menuBtn.addEventListener('click', () => setMode(mode === 'play' ? 'pause' : 'play'));
addEventListener('keydown', (e) => { if (e.code === 'Escape') setMode(mode === 'play' ? 'pause' : mode === 'pause' ? 'play' : mode); });
function startPlay() { setMode('play'); if (game.state !== 'play' || game.t < 0.01) game.kickoff(); }

// ---------------- Szene aufbauen ----------------
let field, ballMesh, pm, gran, sunInfo;
async function boot() {
  const texLoader = new THREE.TextureLoader();
  const tl = (u) => texLoader.loadAsync(u);
  const [env, skyTex, skyInfo, turfColor, turfNormal, grassColor, grassNormal] = await Promise.all([
    loadEnvironment(renderer), tl('assets/hdri/sky.jpg'), fetch('assets/hdri/sky.json').then((r) => r.json()),
    tl('assets/tex/turf_color.jpg'), tl('assets/tex/turf_normal.jpg'), tl('assets/tex/grass_color.jpg'), tl('assets/tex/grass_normal.jpg'),
  ]);
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  const sky = makeSky(skyTex, skyInfo);
  scene.add(sky);
  const fogCol = new THREE.Color().setRGB(...skyInfo.ground, THREE.SRGBColorSpace).lerp(new THREE.Color().setRGB(...skyInfo.horizon, THREE.SRGBColorSpace), 0.35);
  scene.fog = new THREE.Fog(fogCol, 45, 140);
  const { sun } = makeSun(skyInfo, quality, game.cage);
  sunInfo = skyInfo;
  scene.add(sun, sun.target);
  field = buildField(P, game.cage, { turfColor, turfNormal, grassColor, grassNormal }, renderer);
  scene.add(field.group);
  ballMesh = makeBall(P.ballR);
  scene.add(ballMesh);
  pm = makePlayer(0xff7a1a);
  scene.add(pm.group, pm.marker);
  gran = new Granulate();
  scene.add(gran.points);
  resize();
  input.resetStick();
  loadMsg.remove();
  setMode(qs.has('play') ? 'play' : 'menu');
  G.ready = true;
}

// ---------------- Schleife ----------------
let acc = 0, last = performance.now() / 1000;
const prev = { bx: 0, by: 0, bz: 0, px: 0, pz: 0 };
let testInput = null, testUntil = 0, frozen = false;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let rnd = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
const perf = { ft: [], raf: [], lastRaf: 0 };

function worldInput(inp) {
  const ax = gcam.groundAxes();
  let mx = inp.sx * ax.rx + inp.sy * ax.fx, mz = inp.sx * ax.rz + inp.sy * ax.fz;
  if (inp.wx !== undefined) { mx = inp.wx; mz = inp.wz; } // Tests: Richtung direkt in Weltkoordinaten
  const o = { mx, mz, sprint: inp.sprint, pass: inp.pass, shootHeld: inp.shootHeld, shootRelease: inp.shootRelease, cx: inp.cx, cy: inp.cy, aim: false, aimX: 0, aimZ: 0 };
  if (inp.mouseAim) {
    ndc.set(input.mouse.x / innerWidth * 2 - 1, -(input.mouse.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, gcam.cam);
    if (ray.ray.intersectPlane(ground, hit)) {
      const pl = game.players[0];
      const dx = hit.x - pl.x, dz = hit.z - pl.z;
      if (Math.hypot(dx, dz) > 0.5) { o.aim = true; o.aimX = dx; o.aimZ = dz; }
    }
  }
  return o;
}

function handleEvents(ev) {
  for (const e of ev) {
    if (e.type === 'kick') {
      const k = game.players[e.player].lastKick;
      if (k) hud.kickInfo(k);
      gran.emit(e.x, e.z, e.dx, e.dz, Math.min(1, e.speed / 26), rnd);
    } else if (e.type === 'ground' && e.speed > 4) {
      gran.emit(e.x, e.z, game.ball.v.x, game.ball.v.z, Math.min(0.5, e.speed / 20), rnd);
    } else if ((e.type === 'board' || e.type === 'post') && e.speed > 11) {
      gcam.shake = Math.min(1, e.speed / 25);
    } else if (e.type === 'goal') {
      hud.flash('TOR!', `${Math.round(e.speed * 3.6)} km/h`, 2.2);
      hud.setScore(game.score);
    } else if (e.type === 'out') {
      hud.flash('Aus', 'Ball kommt zurück', 1.2);
    }
  }
}

function frame() {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  if (perf.lastRaf) { perf.raf.push(t0 - perf.lastRaf); if (perf.raf.length > 240) perf.raf.shift(); }
  perf.lastRaf = t0;
  if (!G.ready) return;
  const now = t0 / 1000;
  const dt = Math.min(0.1, now - last); last = now;
  let raw = input.sample(now);
  if (testInput && now < testUntil) raw = { ...raw, ...testInput };
  else if (testInput) { testInput = null; }
  const pl = game.players[0], b = game.ball;
  if (mode === 'play' && !frozen) {
    acc += dt;
    let first = true;
    let steps = 0;
    while (acc >= DT && steps < 24) {
      prev.bx = b.p.x; prev.by = b.p.y; prev.bz = b.p.z; prev.px = pl.x; prev.pz = pl.z;
      const wi = worldInput(raw);
      if (!first) { wi.pass = false; wi.shootRelease = false; }
      handleEvents(game.step([wi]));
      first = false;
      acc -= DT; steps++;
    }
    if (steps >= 24) acc = 0;
  } else {
    prev.bx = b.p.x; prev.by = b.p.y; prev.bz = b.p.z; prev.px = pl.x; prev.pz = pl.z; acc = 0;
  }
  const a = mode === 'play' ? Math.min(1, acc / DT) : 1;
  const bx = prev.bx + (b.p.x - prev.bx) * a, by = prev.by + (b.p.y - prev.by) * a, bz = prev.bz + (b.p.z - prev.bz) * a;
  ballMesh.position.set(bx, by, bz);
  ballMesh.quaternion.set(b.q[1], b.q[2], b.q[3], b.q[0]);
  const px = prev.px + (pl.x - prev.px) * a, pz = prev.pz + (pl.z - prev.pz) * a;
  posePlayer(pm, pl, px, pz);
  pm.marker.visible = mode === 'play';
  gcam.update(dt, { x: bx, z: bz, vx: b.v.x, vz: b.v.z }, { x: px, z: pz }, mode === 'play' || mode === 'pause' ? 'play' : 'menu');
  field.update(b.net, gcam.cam);
  gran.update(dt);
  hud.tick(dt);
  const touchUI = document.body.classList.contains('touch');
  hud.setCharge(pl.charging ? Math.min(1, pl.charge / P.chargeT) : 0, touchUI);
  if (touchUI) hud.setContact(input.touch.shoot ? input.touch.cx : 0, input.touch.shoot ? input.touch.cy : 0);
  renderer.render(scene, gcam.cam);
  G.frames++;
  const ft = performance.now() - t0;
  perf.ft.push(ft); if (perf.ft.length > 240) perf.ft.shift();
  if (document.body.classList.contains('debug') && (G.frames % 15 === 0)) {
    const i = renderer.info.render;
    hud.dbg.textContent = `${(1000 / avg(perf.raf)).toFixed(0)} fps · CPU ${avg(perf.ft).toFixed(1)} ms · ${i.calls} DC · ${(i.triangles / 1000).toFixed(0)}k △ · ${gcam.mode} · v ${b.v.len().toFixed(1)} m/s`;
  }
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// ---------------- Debug-API für Tests ----------------
Object.assign(G, {
  scene, renderer, gcam, input,
  start() { startPlay(); },
  mode: () => mode,
  setMode(m) { G.forceMode = m || null; resize(); },
  state() {
    const b = game.ball, pl = game.players[0];
    return { mode, cam: gcam.mode, t: game.t, state: game.state, score: [...game.score], ball: { p: b.p.toArray(), v: b.v.toArray(), w: b.w.toArray(), contact: b.contact, net: b.net.depth },
      player: { x: pl.x, z: pl.z, speed: pl.speed, face: pl.face, charging: pl.charging, assistW: pl.assistW }, lastKick: pl.lastKick, faults: game.faults, build: BUILD };
  },
  info() {
    const i = renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : null,
      dpr: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], quality };
  },
  perf() { return { frameCpuMs: avg(perf.ft), rafMs: avg(perf.raf), n: perf.ft.length }; },
  // Eingabe für Tests: {sx, sy, sprint, pass, shootHeld, cx, cy} für `sec` Sekunden
  input(o, sec = 0.5) { testInput = { sx: 0, sy: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, mouseAim: false, ...o }; testUntil = performance.now() / 1000 + sec; },
  // Ball direkt anstoßen (Tests/Fotos): from [x,y,z], v [vx,vy,vz], w [rad/s]
  kick({ from, v, w = [0, 0, 0] }) {
    const b = game.ball;
    if (from) b.place(from[0], from[1], from[2]);
    b.contact = false; b.v.set(...v); b.w.set(...w); b.reseedKnuckle(game.rng); game.state = 'play';
  },
  placePlayer(x, z, face = 0) { game.players[0].place(x, z, face); },
  placeBall(x, y, z) { game.ball.place(x, y, z); },
  freeze(f = true) { frozen = f; },
  cam(pos, look) { gcam.override = pos ? { pos, look } : null; },
  // Simulation synchron vorspulen (ohne Grafik), z. B. für Schuss-Tests
  sim(sec, o = null) {
    const n = Math.round(sec / DT); const ev = [];
    for (let i = 0; i < n; i++) {
      const wi = o ? { mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, ...o } : undefined;
      const e = game.step(wi ? [wi] : []); handleEvents(e); for (const x of e) ev.push({ ...x });
      if (o) { o.pass = false; o.shootRelease = false; }
    }
    return { state: G.state(), events: ev };
  },
});

boot().then(() => requestAnimationFrame(frame)).catch((e) => {
  window.__errors.push('Boot: ' + (e && e.message || e));
  loadMsg.textContent = 'Fehler beim Laden: ' + (e && e.message || e);
  console.error(e);
});
