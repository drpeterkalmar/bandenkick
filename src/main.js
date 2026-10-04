// Bandenkick – Start, Spielschleife (Physik fest 120 Hz, Grafik interpoliert), Debug-API window.__game.
// Standard: 3 gegen 3 mit Bots (Mensch = Orange, Mannschaft 0). „Training (allein)“ bzw. ?solo=1: Nacht-1-Modus.
import * as THREE from 'three';
import { makeParams } from './sim/params.js';
import { Game, DT } from './sim/step.js';
import { EMPTY_INPUT } from './sim/player.js';
import { previewShot, autoShotPower, attackGoalX } from './sim/shot.js';
import { planPass } from './sim/pass.js';
import { techName, CHALLENGES, challengeDef } from './sim/challenges.js';
import { TrainingProps, AimMarkers } from './render/training.js';
import { createRenderer, loadEnvironment, makeSky, makeSun } from './render/scene.js';
import { buildField } from './render/field.js';
import { makeBall, makeBlob, poseBlob, makePlayer, posePlayer, Granulate } from './render/actors.js';
import { loadAvatarAssets, Avatar, ROSTER, TEAM_NAMES } from './render/avatars.js';
import { GameCamera } from './render/camera.js';
import { Input } from './input/input.js';
import { buildHud } from './ui/hud.js';
import { Sound } from './audio/sound.js';
import { ReplayRecorder, ReplayDirector, replayCamera } from './sim/replay.js';
import { ReplayFx } from './render/replayfx.js';
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
if (P.treffpunkt) document.body.classList.add('treffpunkt');
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
// Challenge (Training): eigene Spielwelt aus src/sim/challenges.js
let challengeId = qs.get('challenge') && challengeDef(qs.get('challenge')) ? qs.get('challenge') : null;
const newGame = () => (challengeId ? new Game(P, seed + '_' + challengeId + '_' + (Date.now() % 1000), { challenge: challengeId })
  : solo ? new Game(P, seed) : new Game(P, seed, { match: true, human: 1, botLevel: P.botLevel }));
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
  const card = { menu: hud.start, pause: hud.menu, credits: hud.credits, train: hud.train, hint: hud.hint, result: hud.result, help: hud.help }[m];
  hud.show(card || null);
  if (m === 'pause') lastShotLine();
}
// Bestwerte der Challenges (localStorage bk_ch_<id> = {best, stars})
const records = {};
for (const c of CHALLENGES) { try { records[c.id] = JSON.parse(localStorage.getItem('bk_ch_' + c.id) || '{}'); } catch (_) { records[c.id] = {}; } }
const fmtScore = (def, v) => (v == null ? '–' : def.unit === 's' ? `${Number(v).toFixed(1).replace('.', ',')} s` : `${v} ${def.unit}`);
let slowmoOn = !!P.zeitlupe && localStorage.getItem('bk_zeitlupe') !== '0';
const slowBtn = hud.menu.querySelector('[data-act="slowmo"]');
const slowLabel = () => { slowBtn.textContent = 'Zeitlupe: ' + (slowmoOn ? 'an' : 'aus'); };
slowLabel();
// Tor-Wiederholung (Nacht 2d): an/aus im Pause-Menü (localStorage bk_replay), ?replay=0
let replayOn = !!P.replay && localStorage.getItem('bk_replay') !== '0';
const replayBtn = hud.menu.querySelector('[data-act="replay"]');
const replayLabel = () => { replayBtn.textContent = 'Wiederholung: ' + (replayOn ? 'an' : 'aus'); };
replayLabel();
let helpBack = 'menu', helpThen = null;
// Steuerungskarte beim ersten Start (danach über ☰ / Startbildschirm)
function withHelp(then) {
  if (localStorage.getItem('bk_hilfe') === '1' || qs.has('play') || qs.has('nohelp')) { then(); return; }
  helpThen = then; helpBack = mode; setMode('help');
}
function startChallenge(id) {
  challengeId = id; setSolo(false);
  if (rp.dir) endReplay();
  rp.wait = -1;
  document.body.classList.add('challenge');
  game = newGame(); resetPrev(); challengeDone = false;
  if (props) props.dispose();
  props = new TrainingProps(scene);
  setMode('play');
}
function leaveChallenge() {
  if (!challengeId) return;
  challengeId = null; document.body.classList.remove('challenge');
  if (props) { props.dispose(); props = null; }
}
function lastShotLine() {
  const k = me() && me().lastKick;
  const el = hud.menu.querySelector('.lastshot');
  if (!k || k.kind === 'pass') { el.textContent = ''; return; }
  const q = k.q != null ? ` · Lage q ${k.q.toFixed(2).replace('.', ',')} (${k.q > 0.75 ? 'gut' : k.q > 0.45 ? 'mittel' : 'schlecht'})` : '';
  el.textContent = `Letzter Schuss: ${techName(k.tech)} · ${Math.round(k.speed * 3.6)} km/h${q}${k.timing != null ? ` · Timing ${Math.round(k.timing * 100)} %` : ''}`;
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
  if (a === 'play') { leaveChallenge(); setSolo(urlSolo); withHelp(() => startPlay(true)); }
  if (a === 'training' || a === 'free') { leaveChallenge(); setSolo(true); withHelp(() => startPlay(true)); }
  if (a === 'trainmenu') { hud.buildTraining(CHALLENGES, records, fmtScore); setMode('train'); }
  if (a === 'challenge') { pendingCh = b.dataset.id; hud.showHint(challengeDef(pendingCh), records[pendingCh], fmtScore); setMode('hint'); }
  if (a === 'chgo') { const id = pendingCh; withHelp(() => startChallenge(id)); }
  if (a === 'chagain') startChallenge(challengeId || pendingCh);
  if (a === 'help') { helpBack = mode; helpThen = null; setMode('help'); }
  if (a === 'helpok') { localStorage.setItem('bk_hilfe', '1'); if (helpThen) { const f = helpThen; helpThen = null; f(); } else setMode(helpBack); }
  if (a === 'slowmo') { slowmoOn = !slowmoOn; localStorage.setItem('bk_zeitlupe', slowmoOn ? '1' : '0'); slowLabel(); }
  if (a === 'replay') { replayOn = !replayOn; localStorage.setItem('bk_replay', replayOn ? '1' : '0'); replayLabel(); }
  if (a === 'resume') setMode('play');
  if (a === 'credits') { creditsBack = mode; setMode('credits'); }
  if (a === 'back') setMode(creditsBack);
  if (a === 'title') { leaveChallenge(); setMode('menu'); }
  if (a === 'newgame') { if (challengeId) startChallenge(challengeId); else startPlay(true); }
  if (a === 'sound') { sound.toggle(); localStorage.setItem('bk_ton', sound.on ? '1' : '0'); soundLabel(); }
  if (a === 'kickoff') { game.kickoff(); setMode('play'); }
  if (a === 'fetch') { const pl = me(); game.ball.place(pl.x + Math.cos(pl.face) * 0.6, game.ball.r, pl.z + Math.sin(pl.face) * 0.6); game.state = 'play'; setMode('play'); }
});
let pendingCh = null, challengeDone = false, props = null, markers = null;
hud.menuBtn.addEventListener('click', () => setMode(mode === 'play' ? 'pause' : mode === 'pause' ? 'play' : mode));
addEventListener('keydown', (e) => { if (e.code === 'Escape') setMode(mode === 'play' ? 'pause' : mode === 'pause' ? 'play' : mode); });
function setSolo(s) {
  if (s === solo) return;
  solo = s; document.body.classList.toggle('solo', solo);
}
function startPlay(fresh = false) {
  if (rp.dir) endReplay();
  rp.wait = -1;
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
    `Sprint ${f(P.vSprint, 1)} m/s · Wende: Kurve ${f(P.aLat, 0)} m/s², Stemmschritt ${f(P.aPlant, 0)} m/s²${P.zack ? '' : ' (altes Modell)'} · Schuss bis ${Math.round(P.shotMax * P.wucht * 3.6)} km/h (Wucht ${f(P.wucht, 1)}) · Bots Stufe ${P.botLevel} · ${f(P.dauer, 0)} min je Halbzeit · Version ${BUILD}`;
}

// ---------------- Szene aufbauen ----------------
let field, ballMesh, blob, gran, marker, figs = [], capsule = null, figSlot = null;
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
  markers = new AimMarkers(scene);
  rp.fx = new ReplayFx(scene);
  await sound.init().catch((e) => window.__errors.push('Ton: ' + e.message));
  resize();
  input.resetStick();
  loadMsg.remove();
  setMode(qs.has('play') ? 'play' : 'menu');
  if (challengeId) startChallenge(challengeId);
  else if (qs.has('play')) startPlay(true);
  G.ready = true;
}

// ---------------- Schleife ----------------
let acc = 0, last = performance.now() / 1000;
const prev = { bx: 0, by: 0, bz: 0, px: new Float64Array(8), pz: new Float64Array(8) };
function resetPrev() { const b = game.ball; prev.bx = b.p.x; prev.by = b.p.y; prev.bz = b.p.z; game.players.forEach((p, i) => { prev.px[i] = p.x; prev.pz[i] = p.z; }); }
const edgeQ = [], btnLvl = { pass: false, shot: false };
// Gesten-Folge der Tests je Spieltakt auswerten (nicht je Bild: ein Bild kann 0,1 s Spielzeit umfassen)
const seqDown = (btn) => { if (!pressSeq) return false; const tt = game.t - pressSeq.t0; return pressSeq.seq.some(([a, b, k]) => k === btn && tt >= a && tt < b); };
let lastFrameT = performance.now() / 1000;
let testInput = null, testUntil = 0, frozen = false, heldPrev = false, passPrev = false, lastContact = [0, 0], chargeHold = 0, pressSeq = null;
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
  // Nacht 2c: im Spiel fängt und hechtet der Auto-Torwart selbst (keine grünen Knöpfe); Training-Torwart und
  // ?autotorwart=0 behalten Fangen/Hechten auf den Knöpfen
  if (R.keeper[pl.team] === pl.id && R.inBox(pl.team, pl.x, pl.z) && R.handsOffTeam !== pl.team && (!P.autoTorwart || game.challenge)) return 'box';
  return '';
}

function worldInput(inp) {
  const ax = gcam.groundAxes();
  let mx = inp.sx * ax.rx + inp.sy * ax.fx, mz = inp.sx * ax.rz + inp.sy * ax.fz;
  if (inp.wx !== undefined) { mx = inp.wx; mz = inp.wz; } // Tests: Richtung direkt in Weltkoordinaten
  // Knopf-Pegel → Gesten im Spieltakt (halten / tipp + halten); cx/cy nur für ?treffpunkt=1
  const o = { mx, mz, sprint: inp.sprint, passDown: !!inp.passDown, shotDown: !!inp.shotDown, cx: inp.cx, cy: inp.cy, aim: false, aimX: 0, aimZ: 0, switch: !!inp.switch };
  const pl = me();
  if (inp.mouseAim) {
    ndc.set(input.mouse.x / innerWidth * 2 - 1, -(input.mouse.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, gcam.cam);
    if (ray.ray.intersectPlane(ground, hit)) {
      const dx = hit.x - pl.x, dz = hit.z - pl.z;
      if (Math.hypot(dx, dz) > 0.5) { o.aim = true; o.aimX = dx; o.aimZ = dz; }
    }
  }
  // Letzte Hand im Torraum: Knöpfe werden zu Fangen/Hechten bzw. mit Ball zu Abwurf/Abschlag – sofort auf den Druck
  // (Flanken, keine Gesten: beim Tormann zählt die Reaktion)
  const km = keeperMode();
  if (km) {
    const st = Math.hypot(mx, mz) > 0.3;
    const dirX = o.aim ? o.aimX : mx, dirZ = o.aim ? o.aimZ : mz, dl = Math.hypot(dirX, dirZ) || 1;
    if (km === 'hold') {
      const manual = !P.autoTorwart || game.challenge; // Nacht 2c: Abschlag auf Druck mit voller Weite, kein Aufladen
      o.throw = inp.passPress;
      o.punt = manual ? inp.shotRelease : inp.shotPress;
      o.power = manual ? Math.min(1.15, 0.45 + chargeHold) : 1;
      if (st || o.aim) { o.aimX = pl.x + dirX / dl * 9; o.aimZ = pl.z + dirZ / dl * 9; } else { o.aimX = undefined; o.aimZ = undefined; }
    } else {
      o.dive = inp.passPress; o.diveX = st ? mx : 0; o.diveZ = st ? mz : 0;
      o.hand = inp.shotDown || inp.shotRelease;
      if (P.fanghilfe) { o.autoCatch = true; o.autoReach = 0.55; } // Ball auf den Körper fängt er von selbst
    }
    delete o.passDown; delete o.shotDown; // keine Gesten, der Feldspieler-Schuss lädt nicht nebenher
  }
  return o;
}

function handleEvents(ev) {
  const R = game.match ? game.rules : null;
  for (const e of ev) {
    sound.event(e, game);
    if (e.type === 'kick') {
      const k = game.players[e.player].lastKick;
      if (k && (e.player === game.human || e.human)) hud.kickInfo(k); // e.human: nach dem Pass wechselt die Steuerung sofort
      gran.emit(e.x, e.z, e.dx, e.dz, Math.min(1, e.speed / 26), rnd);
    } else if (e.type === 'ground' && e.speed > 4) {
      gran.emit(e.x, e.z, game.ball.v.x, game.ball.v.z, Math.min(0.5, e.speed / 20), rnd);
    } else if ((e.type === 'board' || e.type === 'post') && e.speed > 11) {
      gcam.shake = Math.min(1, e.speed / 25);
    } else if (e.type === 'airstart' && slowmoOn && (e.tech === 'fallrueck' || e.tech === 'seitfall' || e.tech === 'flugkopf') && e.player === game.human) {
      slow.t = 0; slow.on = true; // Spektakel: kurze Zeitlupe + Zoom (abschaltbar, Steuerung bleibt)
    } else if (e.type === 'goal' && e.challenge) {
      // Challenge meldet selbst (Treffer/gehalten)
    } else if (e.type === 'goal') {
      if (R && replayOn && rp.rec && game.players.length === rp.rec.n) { rp.goal = { ...e, t: game.t - DT }; rp.wait = P.replayDelay; }
      if (R) {
        const mine = e.team === me().team;
        hud.flash(mine ? 'TOR!' : 'Gegentor', `${TEAM_NAMES[e.team]} · ${Math.round(e.speed * 3.6)} km/h${e.own ? ' · Eigentor' : e.saved ? ' · Tormann war noch dran' : ''}`, 2.4);
      } else { hud.flash('TOR!', `${Math.round(e.speed * 3.6)} km/h`, 2.2); hud.setScore(game.score); }
    } else if (e.type === 'out') {
      hud.flash('Aus', R ? 'Abwurf' : 'Ball kommt zurück', 1.2);
    } else if (e.type === 'halftime') {
      hud.flash('Halbzeit', `${TEAM_NAMES[0]} ${e.score[0]} : ${e.score[1]} ${TEAM_NAMES[1]}`, 2.8);
    } else if (e.type === 'golden') {
      hud.flash('Golden Goal', 'Das nächste Tor entscheidet', 2.5);
    } else if (e.type === 'end') {
      hud.flash('Abpfiff', e.winner < 0 ? `Unentschieden ${e.score[0]} : ${e.score[1]}` : `${TEAM_NAMES[e.winner]} gewinnt ${e.score[0]} : ${e.score[1]}`, 6);
    } else if (e.type === 'tackle' && e.phase === 'hit' && e.human) {
      hud.flash('Grätsche!', e.result === 'ball' ? 'Ball erobert' : 'Ball frei', 0.9);
    } else if (e.type === 'catch' && e.player === game.human) {
      hud.flash('Gefangen', 'Abwurf oder Abschlag', 1.0);
    }
  }
}

// Aufladering: Knopf, Modus (Farbe + Symbol), Stärke, erwartete Technik – fachlich aus denselben Planern wie der Schuss
const MODE_LOOK = {
  vollspann: ['⚡', '#ffc83d', 'Vollspann'], innenrist: ['↪', '#4fd6ff', 'Innenrist'], aussenrist: ['↩', '#ff6fd8', 'Außenrist'],
  flach: ['→', '#ffffff', 'flach'], chip: ['⌒', '#7dff6a', 'hoch (Chip)'],
};
// Tipp-Grammatik (Nacht 2c): nach dem ersten Druck zeigt der Ring den Modus (Standard; nach dem Doppeltipp die
// Zweitfunktion) mit voller Stärke (automatisch) – ohne Aufladen
const tapPower = (pl) => autoShotPower(Math.hypot(attackGoalX(game, pl) - game.ball.p.x, game.ball.p.z));
function chargeView(pl, raw) {
  if (pl.air) return { kind: 'shot', p: 1, sym: '✦', color: '#ffe27a', label: techName(pl.air.tech), air: true };
  if (!P.laden && !P.treffpunkt) {
    const pd = pl.pending && pl.pending.tap ? pl.pending : null;
    if (!pd) return null;
    if (pd.kind === 'pass') { const [sym, color, label] = MODE_LOOK[pd.mode === 'var' ? 'chip' : 'flach']; return { kind: 'pass', p: 1, sym, color, label }; }
    const pv = previewShot(game, pl, pd.mode, pd.stick, tapPower(pl));
    const [sym, color, label] = MODE_LOOK[pv.tech] || MODE_LOOK.vollspann;
    return { kind: 'shot', p: 1, sym, color, label, q: pv.q };
  }
  if (pl.armed) return { kind: pl.armed, p: 0, wait: true };
  if (!pl.charging) return null;
  const p = Math.min(1, pl.charge / P.chargeT);
  if (pl.chargeKind === 'pass') { const [sym, color, label] = MODE_LOOK[pl.chargeMode === 'var' ? 'chip' : 'flach']; return { kind: 'pass', p, sym, color, label }; }
  if (P.treffpunkt) return { kind: 'shot', p, sym: '', color: '#ffd84a', label: 'Schuss' };
  const ms = raw.mx !== undefined ? raw : null; void ms;
  const pv = previewShot(game, pl, pl.chargeMode, null, p);
  const [sym, color, label] = MODE_LOOK[pv.tech] || MODE_LOOK.vollspann;
  return { kind: 'shot', p, sym, color, label, q: pv.q };
}

// Zeitlupe bei Fallrück-/Seitfallzieher/Flugkopfball: 0,9 s echte Zeit, Tempo bis 40 %, sanfte Hüllkurve
const slow = { on: false, t: 0, dur: 0.9 };
function slowScale(dt) {
  if (!slow.on) return 1;
  slow.t += dt;
  if (slow.t >= slow.dur) { slow.on = false; gcam.zoom = 0; return 1; }
  const k = Math.sin(Math.PI * slow.t / slow.dur) ** 2;
  gcam.zoom = k;
  return 1 - 0.6 * k;
}
// Challenge: Status oben, Meldungen, Ende → Ergebnis mit Sternen und Bestwert
let lastChMsg = '';
function challengeFrame() {
  const C = game.challenge;
  if (!C) return;
  hud.setStatus(C.status().replace(' · ', '<small>') + '</small>');
  if (C.msgT > 0 && C.msg && C.msg !== lastChMsg) { hud.flash(C.msg, '', 1.4); }
  lastChMsg = C.msgT > 0 ? C.msg : '';
  if (props) props.update(C, 1 / 60, game.t);
  if (C.done && !challengeDone && mode === 'play') {
    challengeDone = true;
    const def = challengeDef(C.id), res = C.result(), rec = records[C.id] || {};
    const better = res.score != null && (rec.best == null || (def.better === 'lo' ? res.score < rec.best : res.score > rec.best));
    if (better) rec.best = res.score;
    rec.stars = Math.max(rec.stars || 0, res.stars);
    records[C.id] = rec;
    try { localStorage.setItem('bk_ch_' + C.id, JSON.stringify(rec)); } catch (_) { /* privat */ }
    hud.showResult(def, res, rec, better, fmtScore);
    G.lastResult = res;
    setTimeout(() => setMode('result'), 900);
  }
}
// Anzeigehilfen beim Aufladen: Pass → Empfänger + Treffpunkt im Laufweg, Schuss → Zielpunkt im Tor mit Streuung
function aimFrame(pl, raw, km) {
  if (!markers) return;
  const tap = !P.laden && pl.pending && pl.pending.tap ? pl.pending : null;
  if (mode !== 'play' || km || game.human < 0 || P.treffpunkt || !(pl.charging || pl.armed || tap)) { markers.hide(); return; }
  const w = worldInput(raw), st = Math.hypot(w.mx, w.mz) > 0.12 ? [w.mx, w.mz] : tap ? tap.stick : null;
  const kind = tap ? tap.kind : pl.charging ? pl.chargeKind : pl.armed;
  const md = tap ? tap.mode : pl.charging ? pl.chargeMode : 'std';
  if (kind === 'pass') {
    const pp = planPass(game, pl, { mode: md, power: null, stick: st });
    const recv = pp.to >= 0 ? [game.players[pp.to].x, game.players[pp.to].z] : pp.to < -1 ? pp.meet : null;
    markers.show({ pass: { recv, meet: pp.meet, bank: pp.bank ? pp.target : null, color: md === 'var' ? 0x7dff6a : 0xffffff } });
  } else {
    const p = tap ? tapPower(pl) : Math.min(1, pl.charge / P.chargeT);
    const pv = previewShot(game, pl, md, st, p);
    markers.show({ shot: { aim: pv.aim, sigma: 0.12 + pv.dist * Math.tan(pv.noiseDeg * Math.PI / 180), color: (MODE_LOOK[pv.tech] || MODE_LOOK.vollspann)[1] } });
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
  // Tests mit alten Feldern: pass = Tipp, shootHeld = halten → Knopf-Pegel (Spielzeit)
  raw.testPass = !!raw.pass || (testInput && !!testInput.passDown); raw.testShot = !!raw.shootHeld || (testInput && !!testInput.shotDown);
  if (raw.pass) raw.passDown = true;
  if (raw.shootHeld) raw.shotDown = true;
  // Tests: Gesten-Folge (__game.press) in Spielzeit, z. B. Tipp + halten
  if (pressSeq) {
    const tt = game.t - pressSeq.t0;
    for (const [a, b, btn] of pressSeq.seq) if (tt >= a && tt < b) raw[btn === 'pass' ? 'passDown' : 'shotDown'] = true;
    if (pressSeq.stick && tt < pressSeq.stickT) { raw.wx = pressSeq.stick[0]; raw.wz = pressSeq.stick[1]; }
    if (tt > Math.max(...pressSeq.seq.map((x) => x[1])) + 0.5) pressSeq = null;
  }
  // Flanken (Tormann-Knöpfe) und Treffpunkt beim Loslassen (Profi) einheitlich für echte und Test-Eingaben
  raw.passPress = raw.passDown && !passPrev;
  raw.shotRelease = heldPrev && !raw.shotDown;
  raw.shotPress = raw.shotDown && !heldPrev;
  if (raw.shotDown) { lastContact = [raw.cx, raw.cy]; chargeHold += dt; }
  else if (raw.shotRelease) { raw.cx = lastContact[0]; raw.cy = lastContact[1]; }
  heldPrev = raw.shotDown; passPrev = raw.passDown;
  const b = game.ball;
  const tS = performance.now();
  if (mode === 'play' && !frozen && !rp.dir) {
    acc += dt * slowScale(dt);
    let first = true, steps = 0;
    // Knopf-Flanken mit echtem Zeitstempel auf die Takte dieses Bildes verteilen (Tipp-Dauer unabhängig von der
    // Bildrate); Test-Eingaben (Spielzeit) kommen als Pegel dazu
    edgeQ.push(...raw.edges); edgeQ.sort((a, b) => a.t - b.t);
    const nowR = performance.now() / 1000; // Ereignis-Zeitbasis (rAF-Zeit liegt vor den Handlern dieses Bildes)
    const nSteps = Math.min(24, Math.floor(acc / DT)), testPass = !!raw.testPass, testShot = !!raw.testShot;
    while (acc >= DT && steps < 24) {
      resetPrev();
      const tStep = lastFrameT + (steps + 1) / Math.max(1, nSteps) * (nowR - lastFrameT);
      const pulse = { pass: false, shot: false };
      while (edgeQ.length && edgeQ[0].t <= tStep) {
        const e = edgeQ[0];
        if (!e.down && pulse[e.btn]) break; // Druck + Loslassen im selben Takt: mindestens einen Takt gedrückt
        if (e.down) pulse[e.btn] = true;
        btnLvl[e.btn] = e.down; edgeQ.shift();
      }
      raw.passDown = btnLvl.pass || testPass || seqDown('pass'); raw.shotDown = btnLvl.shot || testShot || seqDown('shot');
      const wi = G.scriptFn ? G.scriptFn(game, game.challenge) : worldInput(raw); // Tests: Skript-Spieler (Challenges)
      if (!first) { wi.switch = false; wi.throw = false; wi.punt = false; wi.dive = false; }
      const ins = [];
      ins[Math.max(0, game.human)] = wi;
      const evs = game.step(ins);
      handleEvents(evs);
      recordReplay(evs);
      first = false;
      acc -= DT; steps++;
      if (G.freezeFn && G.freezeFn(game)) { frozen = true; G.freezeFn = null; acc = 0; break; } // Tests: im richtigen Takt anhalten
    }
    if (steps >= 24) acc = 0;
  } else { resetPrev(); acc = 0; edgeQ.length = 0; btnLvl.pass = input.lvl.pass; btnLvl.shot = input.lvl.shot; }
  lastFrameT = performance.now() / 1000;
  perf.sim.push(performance.now() - tS); if (perf.sim.length > 240) perf.sim.shift();
  if (!raw.shotDown && !raw.shotRelease) chargeHold = 0;
  autoQuality(dt);
  const a = mode === 'play' ? Math.min(1, acc / DT) : 1;
  // Tor-Wiederholung: nach dem Live-Jubel starten; läuft sie, zeigt die Grafik den aufgezeichneten Zustand
  if (rp.wait > 0 && mode === 'play' && !frozen) { rp.wait -= dt; if (rp.wait <= 0) startReplay(); }
  const rdt = mode === 'play' && !(rp.hold && rp.held) ? dt : 0;
  const rf = rp.dir && (mode === 'play' || mode === 'pause') ? replayFrame(rdt, raw) : null;
  let bx = prev.bx + (b.p.x - prev.bx) * a, by = prev.by + (b.p.y - prev.by) * a, bz = prev.bz + (b.p.z - prev.bz) * a;
  if (rf) { bx = rf.ball.p.x; by = rf.ball.p.y; bz = rf.ball.p.z; ballMesh.quaternion.set(rf.ball.q[1], rf.ball.q[2], rf.ball.q[3], rf.ball.q[0]); }
  else ballMesh.quaternion.set(b.q[1], b.q[2], b.q[3], b.q[0]);
  ballMesh.position.set(bx, by, bz);
  poseBlob(blob, bx, by, bz, P.ballR);
  const tA = performance.now();
  drawPlayers(rf ? rdt * rp.rate : dt, a, rf);
  perf.av.push(performance.now() - tA); if (perf.av.length > 240) perf.av.shift();
  const pl = me();
  const px = prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, pz = prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
  gcam.update(dt, { x: bx, z: bz, vx: b.v.x, vz: b.v.z }, { x: px, z: pz }, mode === 'play' || mode === 'pause' ? 'play' : 'menu');
  field.update(rf ? rf.ball.net : b.net, gcam.cam, !!(rf && rp.dir && rp.dir.cur.cam === 'fan'));
  gran.update(dt);
  hud.tick(dt);
  const touchUI = document.body.classList.contains('touch');
  const km = keeperMode();
  hud.setKeeperMode(km, !P.autoTorwart || !!game.challenge);
  hud.setCharge(km === 'hold' ? (raw.shotDown && (!P.autoTorwart || game.challenge) ? { kind: 'shot', p: Math.min(1, chargeHold / 0.7), sym: '🦶', color: '#d9ff3a', label: 'Abschlag' } : null) : chargeView(pl, raw), touchUI);
  if (touchUI && P.treffpunkt) hud.setContact(raw.shotDown ? raw.cx : 0, raw.shotDown ? raw.cy : 0);
  challengeFrame();
  aimFrame(pl, raw, km);
  if (game.match && !game.challenge) {
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

// ---------------- Tor-Wiederholung (Nacht 2d) ----------------
// Aufzeichnung je Spieltakt (nur im Spiel), nach einem Tor P.replayDelay s Live-Jubel, dann Wiederholung: die Simulation
// steht so lange still (sie wird nicht verändert), die Grafik zeigt den aufgezeichneten Zustand mit eigener Kamera.
// Tippen, Taste oder Knopf überspringt; danach läuft der Jubel weiter und es folgt der Anstoß wie gewohnt.
const rp = { rec: null, recGame: null, dir: null, wait: -1, goal: null, frame: {}, rate: 1, trail: [], hold: null, held: false, fx: null, label: '', ctx: null };
function recordReplay(evs) {
  if (!game.match || game.challenge || !replayOn) { rp.recGame = null; return; }
  if (rp.recGame !== game || !rp.rec || rp.rec.n !== game.players.length) { rp.rec = new ReplayRecorder(game.players.length); rp.recGame = game; rp.wait = -1; }
  rp.rec.record(game, evs);
}
function startReplay() {
  rp.wait = -1;
  if (!rp.rec || !rp.goal || rp.recGame !== game || mode !== 'play') return;
  const D = new ReplayDirector(rp.rec, rp.goal);
  if (D.done) return;
  rp.dir = D; rp.held = false;
  const c = D.contact, g = rp.goal;
  // Kamera beim Kontakt auf der Feldseite (nicht hinter dem Zaun), Text: Schütze · Technik · km/h
  let side = 1;
  if (c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; side = nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
  rp.ctx = { cage: game.cage, mode: gcam.mode, contact: c, goal: { side: g.side }, time: 0, frac: 0, side };
  const sc = g.scorer >= 0 ? game.players[g.scorer] : null;
  const idx = sc ? game.players.filter((p) => p.team === sc.team).indexOf(sc) + 1 : 0;
  const who = g.own ? 'Eigentor' : sc ? `${TEAM_NAMES[sc.team]} ${idx}${sc.id === game.human ? ' (du)' : ''}` : TEAM_NAMES[g.team];
  const tech = c && c.tech ? techName(c.tech) : '';
  rp.label = [who, tech ? tech + (c.tech === 'fallrueck' || c.tech === 'seitfall' || c.tech === 'flugkopf' ? '!' : '') : '', c && c.speed ? `${Math.round(c.speed * 3.6)} km/h` : ''].filter(Boolean).join(' · ');
  hud.replayShow(true, rp.label);
  markers && markers.hide();
}
function endReplay() {
  rp.dir = null; rp.goal = null; rp.held = false;
  gcam.override = null;
  hud.replayShow(false); hud.replayState(false, 0);
  if (rp.fx) rp.fx.hide();
  resetPrev(); acc = 0;
}
function skipReplay() { if (rp.dir) { rp.dir.skip(); } }
// Ein Bild der Wiederholung: Zeit weiter, Zustand, Kamera, Effekte → Zustand (oder null, wenn zu Ende)
function replayFrame(dt, raw) {
  const D = rp.dir;
  if (raw && (raw.passDown || raw.shotDown) && D.real > 0.3) D.skip();
  const s0 = D.cur;
  rp.rate = D.done ? 1 : s0.rate;
  const t = D.update(dt);
  if (rp.hold && !D.done && D.phase === rp.hold.phase && D.segFrac() >= rp.hold.frac) { rp.held = true; }
  if (D.done) { endReplay(); return null; }
  const f = rp.rec.frameAt(t, rp.frame, P);
  const ctx = rp.ctx; ctx.time = D.real; ctx.frac = D.segFrac(); ctx.mode = gcam.mode;
  const cam = replayCamera(D.cur.cam, f, ctx);
  gcam.override = { pos: cam.pos, look: cam.look };
  if (Math.abs(gcam.cam.fov - cam.fov) > 0.01) { gcam.cam.fov = cam.fov; gcam.cam.updateProjectionMatrix(); }
  const c = D.contact, k = c ? t - c.t : -1;
  // Blitz und Druckwelle beim Kontakt, Ballspur danach (je Tempo), Fan-Cam-Abzeichen
  const flash = c && D.phase === 'kontakt' ? Math.max(0, 1 - Math.abs(k) / 0.05) * 0.75 : 0;
  hud.replayState(D.cur.cam === 'fan', flash);
  if (rp.fx) {
    rp.fx.setRing(c, k);
    const sp = Math.hypot(f.ball.v.x, f.ball.v.y, f.ball.v.z);
    rp.fx.setTrail(k > 0 ? rp.rec.trail(t, Math.min(0.22, k), 20, rp.trail) : null, gcam.cam, Math.min(1, Math.max(0, (sp - 6) / 20)));
  }
  return f;
}
addEventListener('pointerdown', () => { if (rp.dir && mode === 'play' && rp.dir.real > 0.3) skipReplay(); }, true);
addEventListener('keydown', (e) => { if (rp.dir && mode === 'play' && e.code !== 'Escape' && rp.dir.real > 0.3) skipReplay(); });

// Menschen zeichnen: Position interpoliert, Pose aus dem Sim-Zustand (Blend nach Tempo, Tormann, Jubel)
function drawPlayers(dt, a, rf = null) {
  const R = game.match ? game.rules : null, b = rf ? rf.ball : game.ball;
  const n = game.players.length;
  // Figur je Spieler: Mannschaft × Platz (Challenges haben weniger Spieler, Farbe muss passen); Wiederholung: Geister
  const slot = figSlot || (figSlot = []), cnt = [0, 0];
  slot.length = 0;
  for (const p of game.players) slot[p.team * 3 + cnt[p.team]++] = rf ? Object.assign(rf.players[p.id], { team: p.team }) : p;
  for (let i = 0; i < figs.length; i++) {
    const f = figs[i], pl = slot[i];
    const vis = !!pl;
    if (f.capsule) { f.capsule.group.visible = vis; } else f.root.visible = vis;
    if (!vis) continue;
    const x = rf ? pl.x : prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, z = rf ? pl.z : prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
    if (f.capsule) { posePlayer(f.capsule, pl, x, z); continue; }
    const keeper = rf ? pl.keeper : R ? R.keeper[pl.team] === pl.id && R.phase !== 'end' && R.handsOffTeam !== pl.team : false;
    let special = null;
    if (R && !rf) {
      if (R.phase === 'goal' && pl.speed < 0.8) special = R.scoredTeam === pl.team ? ((R.goals.length ? R.goals[R.goals.length - 1].scorer : game.lastTouch) === pl.id ? 'cheer' : 'clap') : 'wait';
      else if (R.phase === 'end' && pl.speed < 0.8) special = R.winner < 0 ? 'clap' : R.winner === pl.team ? 'cheer2' : 'wait';
      else if (R.phase === 'halftime' && pl.speed < 0.8) special = 'wait';
    }
    const ownGoalX = R ? R.goalX(pl.team) : -99;
    const ready = keeper && b.held < 0 && Math.hypot(b.p.x - ownGoalX, b.p.z) < 9 && pl.speed < 2.5 && pl.hand.mode === 'none';
    f.update(dt, pl, { x, z, keeper, holding: b.held === pl.id, ready, special, t: rf ? rf.t : game.t });
  }
  if (rf) { marker.visible = false; return; }
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
  // Challenge starten / Skript-Spieler aus tests/node/scripts.mjs einhängen (nur Tests und Fotos)
  challenge(id) { startChallenge(id); },
  async autoplay(on = true, opts = {}) {
    if (!on) { G.scriptFn = null; return; }
    const m = await import('../tests/node/scripts.mjs');
    G.scriptFn = m.makeScript(challengeId, opts);
  },
  // Gesten-Folge für Tests: [[t0, t1, 'pass'|'shot'], …] in Spielzeit ab jetzt; stick = [x, z] (Welt) für stickT s
  press(seq, stick = null, stickT = 0.4) { pressSeq = { t0: game.t, seq, stick, stickT }; },
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
  frozen() { return frozen; },
  freezeWhen(src) { G.freezeFn = new Function('g', 'return (' + src + ')'); },
  cam(pos, look) { gcam.override = pos ? { pos, look } : null; },
  // Tor-Wiederholung (Tests/Fotos): Zustand, sofort starten (letztes Tor), anhalten in Abschnitt/Anteil, überspringen
  replay() { const D = rp.dir; return { active: !!D, wait: rp.wait, phase: D ? D.phase : null, frac: D ? D.segFrac() : 0, real: D ? D.real : 0, total: D ? D.realTotal : 0, label: rp.label, held: rp.held, contact: D && D.contact ? { ...D.contact } : null, recCount: rp.rec ? rp.rec.count : 0, segs: D ? D.segs.map((x) => x.name) : [] }; },
  replayHold(phase = null, frac = 0.5) { rp.hold = phase ? { phase, frac } : null; rp.held = false; },
  replaySkip() { skipReplay(); },
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
