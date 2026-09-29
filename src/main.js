// Bandenkick – Start, Spielschleife (Physik fest 120 Hz, Grafik interpoliert), Debug-API window.__game.
// Standard: 3 gegen 3 mit Bots (Mensch = Orange, Mannschaft 0). „Training (allein)“ bzw. ?solo=1: Nacht-1-Modus.
import * as THREE from 'three';
import { makeParams } from './sim/params.js';
import { Game, DT } from './sim/step.js';
import { EMPTY_INPUT } from './sim/player.js';
import { createRenderer, loadEnvironment, makeSky, makeSun } from './render/scene.js';
import { buildField } from './render/field.js';
import { makeBall, makeBlob, poseBlob, makePlayer, posePlayer, Granulate } from './render/actors.js';
import { loadAvatarAssets, Avatar, ROSTER, TEAM_NAMES } from './render/avatars.js';
import { GameCamera } from './render/camera.js';
import { Input } from './input/input.js';
import { buildHud } from './ui/hud.js';
import { Sound } from './audio/sound.js';
import { BUILD } from './build.js';

const qs = new URLSearchParams(location.search);
const P = makeParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const qLevel = qs.has('q') ? +qs.get('q') : (isTouch ? 1 : 2);
// Stufen: 0 niedrig (DPR 1, keine Schattenkarte), 1 mittel (Handy: Blob-Schatten unter den Menschen, Schattenkarte
// nur für Ball/Käfig), 2 hoch (Desktop: Echtzeit-Schatten auch für die Menschen, 2048²)
const quality = {
  level: qLevel,
  dpr: Math.min(devicePixelRatio || 1, qLevel >= 2 ? 2 : qLevel === 1 ? 1.5 : 1),
  aa: qLevel >= 1,
  shadows: qLevel >= 1,
  shadowSize: qLevel >= 2 ? 2048 : 1024,
  avatarShadows: qLevel >= 2,
};
if (isTouch) document.body.classList.add('touch');
if (qs.has('debug')) document.body.classList.add('debug');
const urlSolo = qs.has('solo') || qs.get('modus') === 'training';
let solo = urlSolo;
document.body.classList.toggle('solo', solo);

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
// Mensch = Mitte der Mannschaft Orange (stößt an); danach automatischer Wechsel zum ballnächsten Mitspieler
const newGame = () => (solo ? new Game(P, seed) : new Game(P, seed, { match: true, human: 1, botLevel: P.botLevel }));
let game = newGame();
const gcam = new GameCamera(innerWidth / innerHeight, game.cage);
const input = new Input(hud);
const sound = new Sound(qs.get('ton') !== '0' && localStorage.getItem('bk_ton') !== '0');

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
const soundBtn = hud.menu.querySelector('[data-act="sound"]');
const soundLabel = () => { soundBtn.textContent = 'Ton: ' + (sound.on ? 'an' : 'aus'); };
soundLabel();
hud.root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  sound.unlock();
  if (a === 'play') { setSolo(urlSolo); startPlay(true); }
  if (a === 'training') { setSolo(true); startPlay(true); }
  if (a === 'resume') setMode('play');
  if (a === 'credits') { creditsBack = mode; setMode('credits'); }
  if (a === 'back') setMode(creditsBack);
  if (a === 'title') setMode('menu');
  if (a === 'newgame') startPlay(true);
  if (a === 'sound') { sound.toggle(); localStorage.setItem('bk_ton', sound.on ? '1' : '0'); soundLabel(); }
  if (a === 'kickoff') { game.kickoff(); setMode('play'); }
  if (a === 'fetch') { const pl = me(); game.ball.place(pl.x + Math.cos(pl.face) * 0.6, game.ball.r, pl.z + Math.sin(pl.face) * 0.6); game.state = 'play'; setMode('play'); }
});
hud.menuBtn.addEventListener('click', () => setMode(mode === 'play' ? 'pause' : 'play'));
addEventListener('keydown', (e) => { if (e.code === 'Escape') setMode(mode === 'play' ? 'pause' : mode === 'pause' ? 'play' : mode); });
function setSolo(s) {
  if (s === solo) return;
  solo = s; document.body.classList.toggle('solo', solo);
}
function startPlay(fresh = false) {
  if (fresh || game.match === solo) { game = newGame(); resetPrev(); }
  setMode('play');
  if (!game.match && (game.state !== 'play' || game.t < 0.01)) game.kickoff();
}
const me = () => game.players[Math.max(0, game.human)];
{
  const f = (v, d = 2) => v.toFixed(d).replace('.', ',');
  hud.menu.querySelector('.physics').innerHTML =
    `Feld ${f(P.fieldL, 0)} × ${f(P.fieldW, 0)} m · Bande ${f(P.boardH, 1)} m · ${P.roof ? `Dachnetz ${f(P.roofH, 1)} m` : `ohne Dach, Netz bis ${f(P.netTop, 1)} m`} · Torraum ${f(P.torraum, 1)} m<br>` +
    `Kunstrasen nach FIFA Quality Pro: Abprall 0,72 m · schräg 52 % · Rollen 6,0 m<br>` +
    `Sprint ${f(P.vSprint, 1)} m/s · Wende: Kurve ${f(P.aLat, 0)} m/s², Stemmschritt ${f(P.aPlant, 0)} m/s²${P.zack ? '' : ' (altes Modell)'} · Schuss bis ${Math.round(P.shotMax * 3.6)} km/h · Bots Stufe ${P.botLevel} · ${f(P.dauer, 0)} min je Halbzeit · Version ${BUILD}`;
}

// ---------------- Szene aufbauen ----------------
let field, ballMesh, blob, gran, marker, figs = [], capsule = null;
async function boot() {
  const texLoader = new THREE.TextureLoader();
  const tl = (u) => texLoader.loadAsync(u);
  const avatarsP = qs.get('figur') === 'kapsel' ? Promise.resolve(null) : loadAvatarAssets((p) => { loadMsg.textContent = `Bandenkick lädt … Spieler ${Math.round(p * 100)} %`; }).catch((e) => { window.__errors.push('Avatare: ' + e.message); return null; });
  const [env, skyTex, skyInfo, turfColor, turfNormal, grassColor, grassNormal, A] = await Promise.all([
    loadEnvironment(renderer), tl('assets/hdri/sky.jpg'), fetch('assets/hdri/sky.json').then((r) => r.json()),
    tl('assets/tex/turf_color.jpg'), tl('assets/tex/turf_normal.jpg'), tl('assets/tex/grass_color.jpg'), tl('assets/tex/grass_normal.jpg'), avatarsP,
  ]);
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  const sky = makeSky(skyTex, skyInfo);
  scene.add(sky);
  const fogCol = new THREE.Color().setRGB(...skyInfo.ground, THREE.SRGBColorSpace).lerp(new THREE.Color().setRGB(...skyInfo.horizon, THREE.SRGBColorSpace), 0.35);
  scene.fog = new THREE.Fog(fogCol, 45, 140);
  const { sun } = makeSun(skyInfo, quality, game.cage);
  scene.add(sun, sun.target);
  field = buildField(P, game.cage, { turfColor, turfNormal, grassColor, grassNormal }, renderer);
  scene.add(field.group);
  ballMesh = makeBall(P.ballR);
  blob = makeBlob();
  scene.add(ballMesh, blob);
  // Menschen: 6 Rocketbox-Avatare (Rückfall: Kapsel-Figuren aus Nacht 1)
  capsule = makePlayer(0xff7a1a);
  marker = capsule.marker;
  scene.add(marker);
  if (A) {
    for (let team = 0; team < 2; team++) for (let i = 0; i < 3; i++) {
      const av = new Avatar(A, ROSTER[team][i % ROSTER[team].length], team, { shadows: quality.avatarShadows });
      figs.push(av); scene.add(av.root);
    }
  } else {
    for (let i = 0; i < 6; i++) { const c = i ? makePlayer(i < 3 ? 0xff6a13 : 0x1f6fff) : capsule; figs.push({ capsule: c }); scene.add(c.group); }
  }
  G.avatars = !!A;
  gran = new Granulate();
  scene.add(gran.points);
  await sound.init().catch((e) => window.__errors.push('Ton: ' + e.message));
  resize();
  input.resetStick();
  loadMsg.remove();
  setMode(qs.has('play') ? 'play' : 'menu');
  if (qs.has('play')) startPlay(true);
  G.ready = true;
}

// ---------------- Schleife ----------------
let acc = 0, last = performance.now() / 1000;
const prev = { bx: 0, by: 0, bz: 0, px: new Float64Array(8), pz: new Float64Array(8) };
function resetPrev() { const b = game.ball; prev.bx = b.p.x; prev.by = b.p.y; prev.bz = b.p.z; game.players.forEach((p, i) => { prev.px[i] = p.x; prev.pz[i] = p.z; }); }
let testInput = null, testUntil = 0, frozen = false, heldPrev = false, lastContact = [0, 0], chargeHold = 0;
const gl = renderer.getContext();
const gpuExt = qs.has('gpu') ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
const gpuQ = [], gpuMs = [];
function gpuPoll() {
  while (gpuQ.length) {
    const q = gpuQ[0];
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    if (!gl.getParameter(gpuExt.GPU_DISJOINT_EXT)) gpuMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q); gpuQ.shift();
  }
  if (gpuMs.length > 240) gpuMs.splice(0, gpuMs.length - 240);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
const rnd = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
const perf = { ft: [], raf: [], lastRaf: 0, av: [], rd: [], sim: [] };

// Ist der gesteuerte Spieler gerade die letzte Hand im eigenen Torraum? → '' | 'box' | 'hold'
function keeperMode() {
  if (!game.match || game.human < 0) return '';
  const pl = me(), R = game.rules;
  if (game.ball.held === pl.id) return 'hold';
  if (R.keeper[pl.team] === pl.id && R.inBox(pl.team, pl.x, pl.z)) return 'box';
  return '';
}

function worldInput(inp) {
  const ax = gcam.groundAxes();
  let mx = inp.sx * ax.rx + inp.sy * ax.fx, mz = inp.sx * ax.rz + inp.sy * ax.fz;
  if (inp.wx !== undefined) { mx = inp.wx; mz = inp.wz; } // Tests: Richtung direkt in Weltkoordinaten
  const o = { mx, mz, sprint: inp.sprint, pass: inp.pass, shootHeld: inp.shootHeld, shootRelease: inp.shootRelease, cx: inp.cx, cy: inp.cy, aim: false, aimX: 0, aimZ: 0, switch: !!inp.switch };
  const pl = me();
  if (inp.mouseAim) {
    ndc.set(input.mouse.x / innerWidth * 2 - 1, -(input.mouse.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, gcam.cam);
    if (ray.ray.intersectPlane(ground, hit)) {
      const dx = hit.x - pl.x, dz = hit.z - pl.z;
      if (Math.hypot(dx, dz) > 0.5) { o.aim = true; o.aimX = dx; o.aimZ = dz; }
    }
  }
  // Letzte Hand im Torraum: Knöpfe werden zu Fangen/Hechten bzw. mit Ball zu Abwurf/Abschlag
  const km = keeperMode();
  if (km) {
    const st = Math.hypot(mx, mz) > 0.3;
    const dirX = o.aim ? o.aimX : mx, dirZ = o.aim ? o.aimZ : mz, dl = Math.hypot(dirX, dirZ) || 1;
    if (km === 'hold') {
      o.throw = inp.pass;
      o.punt = inp.shootRelease;
      o.power = Math.min(1.15, 0.45 + chargeHold);
      if (st || o.aim) { o.aimX = pl.x + dirX / dl * 9; o.aimZ = pl.z + dirZ / dl * 9; } else { o.aimX = undefined; o.aimZ = undefined; }
    } else {
      o.dive = inp.pass; o.diveX = st ? mx : 0; o.diveZ = st ? mz : 0;
      o.hand = inp.shootHeld || inp.shootRelease;
    }
    o.pass = false; o.shootHeld = false; o.shootRelease = false;
  }
  return o;
}

function handleEvents(ev) {
  const R = game.match ? game.rules : null;
  for (const e of ev) {
    sound.event(e, game);
    if (e.type === 'kick') {
      const k = game.players[e.player].lastKick;
      if (k && e.player === game.human) hud.kickInfo(k);
      gran.emit(e.x, e.z, e.dx, e.dz, Math.min(1, e.speed / 26), rnd);
    } else if (e.type === 'ground' && e.speed > 4) {
      gran.emit(e.x, e.z, game.ball.v.x, game.ball.v.z, Math.min(0.5, e.speed / 20), rnd);
    } else if ((e.type === 'board' || e.type === 'post') && e.speed > 11) {
      gcam.shake = Math.min(1, e.speed / 25);
    } else if (e.type === 'goal') {
      if (R) {
        const mine = e.team === me().team;
        hud.flash(mine ? 'TOR!' : 'Gegentor', `${TEAM_NAMES[e.team]} · ${Math.round(e.speed * 3.6)} km/h${e.own ? ' · Eigentor' : ''}`, 2.4);
      } else { hud.flash('TOR!', `${Math.round(e.speed * 3.6)} km/h`, 2.2); hud.setScore(game.score); }
    } else if (e.type === 'out') {
      hud.flash('Aus', R ? 'Abwurf' : 'Ball kommt zurück', 1.2);
    } else if (e.type === 'halftime') {
      hud.flash('Halbzeit', `${TEAM_NAMES[0]} ${e.score[0]} : ${e.score[1]} ${TEAM_NAMES[1]}`, 2.8);
    } else if (e.type === 'golden') {
      hud.flash('Golden Goal', 'Das nächste Tor entscheidet', 2.5);
    } else if (e.type === 'end') {
      hud.flash('Abpfiff', e.winner < 0 ? `Unentschieden ${e.score[0]} : ${e.score[1]}` : `${TEAM_NAMES[e.winner]} gewinnt ${e.score[0]} : ${e.score[1]}`, 6);
    } else if (e.type === 'catch' && e.player === game.human) {
      hud.flash('Gefangen', 'Abwurf oder Abschlag', 1.0);
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
  if (testInput && game.t < testUntil) raw = { ...raw, ...testInput };
  else if (testInput) { testInput = null; }
  // Loslass-Flanke und Treffpunkt beim Loslassen einheitlich für echte und Test-Eingaben
  raw.shootRelease = heldPrev && !raw.shootHeld;
  if (raw.shootHeld) { lastContact = [raw.cx, raw.cy]; chargeHold += dt; }
  else if (raw.shootRelease) { raw.cx = lastContact[0]; raw.cy = lastContact[1]; }
  heldPrev = raw.shootHeld;
  const b = game.ball;
  const tS = performance.now();
  if (mode === 'play' && !frozen) {
    acc += dt;
    let first = true, steps = 0;
    while (acc >= DT && steps < 24) {
      resetPrev();
      const wi = worldInput(raw);
      if (!first) { wi.pass = false; wi.shootRelease = false; wi.switch = false; wi.throw = false; wi.punt = false; wi.dive = false; }
      const ins = [];
      ins[Math.max(0, game.human)] = wi;
      handleEvents(game.step(ins));
      first = false;
      acc -= DT; steps++;
    }
    if (steps >= 24) acc = 0;
  } else { resetPrev(); acc = 0; }
  perf.sim.push(performance.now() - tS); if (perf.sim.length > 240) perf.sim.shift();
  if (!raw.shootHeld && !raw.shootRelease) chargeHold = 0;
  autoQuality(dt);
  const a = mode === 'play' ? Math.min(1, acc / DT) : 1;
  const bx = prev.bx + (b.p.x - prev.bx) * a, by = prev.by + (b.p.y - prev.by) * a, bz = prev.bz + (b.p.z - prev.bz) * a;
  ballMesh.position.set(bx, by, bz);
  ballMesh.quaternion.set(b.q[1], b.q[2], b.q[3], b.q[0]);
  poseBlob(blob, bx, by, bz, P.ballR);
  const tA = performance.now();
  drawPlayers(dt, a);
  perf.av.push(performance.now() - tA); if (perf.av.length > 240) perf.av.shift();
  const pl = me();
  const px = prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, pz = prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
  gcam.update(dt, { x: bx, z: bz, vx: b.v.x, vz: b.v.z }, { x: px, z: pz }, mode === 'play' || mode === 'pause' ? 'play' : 'menu');
  field.update(b.net, gcam.cam);
  gran.update(dt);
  hud.tick(dt);
  const touchUI = document.body.classList.contains('touch');
  const km = keeperMode();
  hud.setKeeperMode(km);
  hud.setCharge(pl.charging ? Math.min(1, pl.charge / P.chargeT) : km === 'hold' && raw.shootHeld ? Math.min(1, chargeHold / 0.7) : 0, touchUI);
  if (touchUI) hud.setContact(raw.shootHeld ? raw.cx : 0, raw.shootHeld ? raw.cy : 0);
  if (game.match) {
    const R = game.rules;
    const rest = R.half === 1 ? R.halfLen - R.clock : 2 * R.halfLen - R.clock;
    hud.setMatch(game.score, rest, R.half, R.golden, R.phase === 'end');
    const holder = b.held >= 0 ? game.players[b.held] : null;
    hud.setHold(holder && holder.team === pl.team && holder.id === game.human ? holder.holdT / P.holdMax : -1, holder ? P.holdMax - holder.holdT : 0);
  }
  sound.tick(dt, game, mode === 'play');
  let q = null;
  if (gpuExt) { gpuPoll(); q = gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, q); }
  const tR = performance.now();
  renderer.render(scene, gcam.cam);
  perf.rd.push(performance.now() - tR); if (perf.rd.length > 240) perf.rd.shift();
  if (q) { gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuQ.push(q); }
  G.frames++;
  const ft = performance.now() - t0;
  perf.ft.push(ft); if (perf.ft.length > 240) perf.ft.shift();
  if (document.body.classList.contains('debug') && (G.frames % 15 === 0)) {
    const i = renderer.info.render;
    hud.dbg.textContent = `${(1000 / avg(perf.raf)).toFixed(0)} fps · CPU ${avg(perf.ft).toFixed(1)} ms · ${i.calls} DC · ${(i.triangles / 1000).toFixed(0)}k △ · ${gcam.mode} · v ${b.v.len().toFixed(1)} m/s`;
  }
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// Menschen zeichnen: Position interpoliert, Pose aus dem Sim-Zustand (Blend nach Tempo, Tormann, Jubel)
function drawPlayers(dt, a) {
  const R = game.match ? game.rules : null, b = game.ball;
  const n = game.players.length;
  for (let i = 0; i < figs.length; i++) {
    const f = figs[i], pl = game.players[i];
    const vis = !!pl;
    if (f.capsule) { f.capsule.group.visible = vis; } else f.root.visible = vis;
    if (!vis) continue;
    const x = prev.px[i] + (pl.x - prev.px[i]) * a, z = prev.pz[i] + (pl.z - prev.pz[i]) * a;
    if (f.capsule) { posePlayer(f.capsule, pl, x, z); continue; }
    const keeper = R ? R.keeper[pl.team] === pl.id && R.phase !== 'end' : false;
    let special = null;
    if (R) {
      if (R.phase === 'goal' && pl.speed < 0.8) special = R.scoredTeam === pl.team ? (game.lastTouch === pl.id ? 'cheer' : 'clap') : 'wait';
      else if (R.phase === 'end' && pl.speed < 0.8) special = R.winner < 0 ? 'clap' : R.winner === pl.team ? 'cheer2' : 'wait';
      else if (R.phase === 'halftime' && pl.speed < 0.8) special = 'wait';
    }
    const ownGoalX = R ? R.goalX(pl.team) : -99;
    const ready = keeper && b.held < 0 && Math.hypot(b.p.x - ownGoalX, b.p.z) < 9 && pl.speed < 2.5 && pl.hand.mode === 'none';
    f.update(dt, pl, { x, z, keeper, holding: b.held === pl.id, ready, special });
  }
  void n;
  const pl = me();
  const mx = prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, mz = prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
  marker.position.set(mx, 0, mz);
  marker.rotation.y = -pl.face;
  marker.visible = mode === 'play' && game.human >= 0;
}

// Qualitäts-Automatik (nur ohne ?q=): liegt der Bildabstand im Spiel 3 s lang über 24 ms (< ~42 fps), erst die
// Auflösung in 0,25er-Schritten bis 1,0 senken, dann Echtzeit-Schatten der Menschen aus (Blob), dann alle Schatten aus.
const autoQ = { on: !qs.has('q'), t: 0, sum: 0, n: 0, steps: [] };
function autoQuality(dt) {
  if (!autoQ.on || mode !== 'play') return;
  autoQ.t += dt; autoQ.sum += dt; autoQ.n++;
  if (autoQ.t < 3) return;
  const ms = autoQ.sum / autoQ.n * 1000;
  autoQ.t = autoQ.sum = autoQ.n = 0;
  if (ms <= 24) return;
  const d = renderer.getPixelRatio();
  if (d > 1.01) { renderer.setPixelRatio(Math.max(1, d - 0.25)); resize(); autoQ.steps.push('dpr ' + renderer.getPixelRatio()); }
  else if (quality.avatarShadows) { quality.avatarShadows = false; for (const f of figs) if (f.setShadows) f.setShadows(false); autoQ.steps.push('menschen blob'); }
  else if (renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    autoQ.steps.push('schatten aus');
  } else autoQ.on = false;
}

// ---------------- Debug-API für Tests ----------------
Object.assign(G, {
  scene, renderer, gcam, inputs: input, sound,
  start() { startPlay(); },
  mode: () => mode,
  setMode(m) { G.forceMode = m || null; resize(); },
  newGame(opts = {}) { if (opts.solo !== undefined) setSolo(opts.solo); game = newGame(); resetPrev(); setMode('play'); if (!game.match) game.kickoff(); },
  state() {
    const b = game.ball, pl = me();
    const R = game.match ? game.rules : null;
    return { mode, cam: gcam.mode, t: game.t, state: game.state, score: [...game.score], match: game.match, human: game.human,
      ball: { p: b.p.toArray(), v: b.v.toArray(), w: b.w.toArray(), contact: b.contact, net: b.net.depth, held: b.held },
      player: { x: pl.x, z: pl.z, speed: pl.speed, face: pl.face, charging: pl.charging, assistW: pl.assistW, hand: pl.hand.mode, team: pl.team },
      players: game.players.map((p) => ({ x: p.x, z: p.z, face: p.face, speed: p.speed, team: p.team, hand: p.hand.mode, role: game.bots ? game.bots.brain[p.id].role : '' })),
      rules: R ? R.snapshot() : null, keeperMode: keeperMode(),
      lastKick: pl.lastKick, faults: game.faults, build: BUILD, avatars: !!G.avatars };
  },
  info() {
    const i = renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, points: i.render.points, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : null,
      dpr: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], quality, shadows: renderer.shadowMap.enabled, auto: { on: autoQ.on, steps: [...autoQ.steps] } };
  },
  perf() {
    const p95 = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.95)]; };
    return { frameCpuMs: avg(perf.ft), frameCpuP95: p95(perf.ft), rafMs: avg(perf.raf), rafP95: p95(perf.raf), gpuMs: gpuMs.length ? avg(gpuMs) : null, gpuP95: p95(gpuMs), gpuExt: !!gpuExt, n: perf.ft.length,
      avatarMs: avg(perf.av), renderMs: avg(perf.rd), simMs: avg(perf.sim) };
  },
  perfReset() { perf.ft.length = 0; perf.raf.length = 0; gpuMs.length = 0; perf.av.length = 0; perf.rd.length = 0; perf.sim.length = 0; },
  // Eingabe für Tests: {sx, sy, sprint, pass, shootHeld, cx, cy, wx, wz, switch} für `sec` Sekunden (Spielzeit)
  input(o, sec = 0.5) { testInput = { sx: 0, sy: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, mouseAim: false, ...o }; testUntil = game.t + sec; },
  // Ball direkt anstoßen (Tests/Fotos): from [x,y,z], v [vx,vy,vz], w [rad/s]
  kick({ from, v, w = [0, 0, 0] }) {
    const b = game.ball;
    if (from) b.place(from[0], from[1], from[2]);
    b.held = -1; b.contact = false; b.v.set(...v); b.w.set(...w); b.reseedKnuckle(game.rng);
    if (game.match) { if (game.rules.phase !== 'end') game.rules.phase = 'play'; } else game.state = 'play';
  },
  placePlayer(x, z, face = 0, i = -1) { const p = i >= 0 ? game.players[i] : me(); p.place(x, z, face); resetPrev(); },
  placeBall(x, y, z) { game.ball.place(x, y, z); game.ball.held = -1; resetPrev(); },
  human(i) { game.setHuman(i); },
  bots(on) { if (game.match) game.bots = on ? (game._bots || game.bots) : ((game._bots = game.bots), null); },
  freeze(f = true) { frozen = f; },
  cam(pos, look) { gcam.override = pos ? { pos, look } : null; },
  // Simulation synchron vorspulen (ohne Grafik), z. B. für Schuss-Tests; o = Eingabe des Menschen
  sim(sec, o = null) {
    const n = Math.round(sec / DT); const ev = [];
    for (let i = 0; i < n; i++) {
      const wi = o ? { ...EMPTY_INPUT, mx: 0, mz: 0, ...o } : undefined;
      const ins = []; if (wi) ins[Math.max(0, game.human)] = wi;
      const e = game.step(ins); handleEvents(e); for (const x of e) ev.push({ ...x });
      if (o) { o.pass = false; o.shootRelease = false; o.dive = false; o.throw = false; o.punt = false; o.switch = false; }
    }
    resetPrev();
    return { state: G.state(), events: ev };
  },
});

boot().then(() => requestAnimationFrame(frame)).catch((e) => {
  window.__errors.push('Boot: ' + (e && e.message || e));
  loadMsg.textContent = 'Fehler beim Laden: ' + (e && e.message || e);
  console.error(e);
});
