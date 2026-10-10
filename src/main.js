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
import { createRenderer, loadEnvironment, makeSky, makeSun, dirFromUV, sonnenSchatten, schattenExt } from './render/scene.js';
import { makeSkyDeko } from './render/stimmung.js';
import { Deko } from './render/deko.js';
import { buildField } from './render/field.js';
import { makeBall, makeBlob, poseBlob, makePlayer, posePlayer, Granulate } from './render/actors.js';
import { loadAvatarAssets, Avatar, ROSTER, TEAM_NAMES } from './render/avatars.js';
import { GameCamera } from './render/camera.js';
import { Input } from './input/input.js';
import { buildHud } from './ui/hud.js';
import { Sound } from './audio/sound.js';
import { ReplayRecorder, ReplayDirector, ReplayKamera } from './sim/replay.js';
import { FanEdit, editCamera, editCameraFx, jubelRichtung, EDIT_DELAY } from './sim/fanedit.js';
import { ActionRegie } from './sim/action.js';
import { ReplayFx } from './render/replayfx.js';
import { BUILD } from './build.js';
import { makeKino, kinoLicht, kinoStufeSetzen, KontaktSchatten } from './render/kino.js';
import { kinoOptionen, replayDof } from './render/kino_logik.js';
import { GrafikSteuerung, stufenWerte, skalaBereich, startStufe, startSkala, ladeStufe, merkeStufe } from './render/grafik.js';
import { geraeteSchluessel, ladeGeraet, merkeGeraet, messeBilder } from './render/kern/startprobe.js';
import { bildFlaeche, schattenAusschnitt, randPunkte } from './render/schatten.js';
import { RuckMessung } from './render/ruckmess.js';

const qs = new URLSearchParams(location.search);
const P = makeParams(location.search);
// Verschönerung (Deko, ab 06.10.): ?deko=0 = Aussehen wie Nacht 2e (A/B)
const DEKO = !!P.deko;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let deko = null;
// Deko-Licht: Tag oder Abend mit Flutlicht. 'auto' = nach Uhrzeit (ab kurz vor Sonnenuntergang, Mitteleuropa, bis 6:30),
// im Pause-Menü umschaltbar (localStorage bk_licht), ?licht=tag|abend|auto
const SUNSET_H = [16.6, 17.4, 18.1, 19.9, 20.6, 21.0, 20.9, 20.3, 19.3, 18.3, 16.6, 16.2];
let lichtPref = ['tag', 'abend', 'auto'].includes(qs.get('licht')) ? qs.get('licht') : (localStorage.getItem('bk_licht') || 'auto');
const autoLicht = () => { const d = new Date(), h = d.getHours() + d.getMinutes() / 60; return h >= SUNSET_H[d.getMonth()] - 0.4 || h < 6.5 ? 'abend' : 'tag'; };
const lichtMode = () => (lichtPref === 'auto' ? autoLicht() : lichtPref);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// n4 Qualitäts-Autopilot (Audit #2, render/grafik.js): ?autopilot=0 = alte Automatik (nur abwärts), ?q= = feste Stufe.
// Startstufe: ?q= > zuletzt gefahrene Stufe dieses Geräts > Touch 1 / Desktop 2. ?schattenkam=0 = Schattenkarte über den
// ganzen Käfig wie bisher (sonst folgt sie dem Bildausschnitt, render/schatten.js), ?schatten2=1024 = kleinere Karte auf Stufe 2.
const AUTOPILOT = qs.get('autopilot') !== '0';
// n4 (Audit #8): Figuren außerhalb des Bildes nicht zeichnen und nur jedes 2. Bild animieren; ?cull=0 = wie bisher
const AV_CULL = qs.get('cull') !== '0';
// n4 (Audit #5): Fuß-IK (Boden + Ballkontakt), ?ik=0 = aus
const AV_IK = qs.get('ik') !== '0';
// n5: flüssige Figuren (geglättete Lauf-Gewichte, Sonderbewegungen ohne Gewichtsloch, Blickrichtung zwischen den Takten
// interpoliert, Schnitt beim Wechsel Spiel ↔ Wiederholung); ?glatt=0 = wie n4
const GLATT = qs.get('glatt') !== '0';
// n5: Wiederholung als TV-Regie (Tempo-Rampen, geglättete Kamera, keine Mini-Abschnitte); ?rcam=alt = wie Nacht 2d
const RCAM_ALT = qs.get('rcam') === 'alt';
const VORGRIFF = qs.get('vorgriff') !== '0'; // n5: Fuß greift in der Wiederholung schon vor dem Kontakt zum Ball
const SCHATTENKAM = qs.get('schattenkam') !== '0';
const SCHATTEN2 = qs.get('schatten2') === '1024' ? 1024 : 2048;
const START = startStufe({ q: qs.has('q') ? qs.get('q') : null, gemerkt: AUTOPILOT && !qs.has('q') ? ladeStufe(localStorage) : null, touch: isTouch, autopilot: AUTOPILOT });
const qLevel = START.stufe;
// Stufen: 0 niedrig (DPR 1, keine Schattenkarte), 1 mittel (Handy: Blob-Schatten unter den Menschen, Schattenkarte
// nur für Ball/Käfig), 2 hoch (Desktop: Echtzeit-Schatten auch für die Menschen, 2048²)
const quality = stufenWerte(qLevel, { dpr: devicePixelRatio || 1, schatten2: SCHATTEN2 });
if (isTouch) document.body.classList.add('touch');
if (DEKO) document.body.classList.add('deko');
if (P.treffpunkt) document.body.classList.add('treffpunkt');
if (qs.has('debug')) document.body.classList.add('debug');
Avatar.ikMessen = qs.has('debug'); // n5: IK-Zeitmessung nur im Debug (kostet je Bild)
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

// n4 Kino-Look (Audit #1): Endbild mit Renderskala + Hochskalieren/Nachschärfen, Bloom, TV-Farbkorrektur, Vignette,
// Kontaktschatten; Tiefenschärfe nur in der Wiederholung. ?kino=0 = direktes Zeichnen wie bis n3.
const KO = kinoOptionen(qs);
// Mit Kino-Look glätten Stufe 1/2 im Endbild (FXAA-Art bzw. MSAA im Render-Target) → Canvas ohne MSAA (spart am Handy das
// Auflösen eines 4-fach-Bildschirmpuffers); Stufe 0 glättete schon bisher nicht.
const renderer = createRenderer(canvas, { ...quality, aa: quality.aa && !(KO.on && KO.look !== 0) });
const kino = KO.on ? makeKino(renderer, quality.level, KO) : null;
if (kino) renderer.info.autoReset = false; // mehrere Durchgänge je Bild → Zähler je Bild selbst zurücksetzen
// ?skala=0.7…1: feste Renderskala des Kino-Looks (Vergleiche/Tests; der Autopilot regelt sonst selbst)
const SKALA_FEST = qs.has('skala') ? Math.max(0.5, Math.min(1, +qs.get('skala') || 1)) : null;
if (kino && SKALA_FEST) kino.renderScale = SKALA_FEST;
let kontakt = null;
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
const sound = new Sound(); // Nacht 2e: stumm (Stub), kein AudioContext

const BIB_NUMS = [[7, 10, 4], [9, 11, 5]]; // Deko: Rückennummern der Leibchen (Mensch = Orange Mitte → 10)
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
// n6 Action-Momente (ersetzt die Zeitlupe aus Nacht 2): Aus / Selten (Standard) / Oft – localStorage bk_action,
// ?action=0|1|2 (aus/selten/oft); ?zeitlupe=0 bzw. die alte Einstellung „Zeitlupe: aus“ = Aus
const ACTION_STUFEN = ['aus', 'selten', 'oft'];
const qa = qs.get('action');
let actionStufe = !P.zeitlupe ? 'aus' : qa != null ? (qa === '0' || qa === 'aus' ? 'aus' : qa === '2' || qa === 'oft' ? 'oft' : 'selten')
  : ACTION_STUFEN.includes(localStorage.getItem('bk_action')) ? localStorage.getItem('bk_action') : localStorage.getItem('bk_zeitlupe') === '0' ? 'aus' : 'selten';
const aktion = new ActionRegie(actionStufe);
const slowBtn = hud.menu.querySelector('[data-act="slowmo"]');
const slowLabel = () => { slowBtn.textContent = '🎬 Action-Momente: ' + { aus: 'Aus', selten: 'Selten', oft: 'Oft' }[actionStufe]; };
slowLabel();
// Tor-Wiederholung (Nacht 2d): im Pause-Menü (localStorage bk_replay), ?replay=0. n6: Art Fan-Edit (Standard) / Klassisch
// (ruhige TV-Wiederholung wie n5) / Aus (localStorage bk_replay_art), ?edit=0 = Klassisch
const REPLAY_ARTEN = ['edit', 'klassisch', 'aus'];
let replayArt = !P.replay ? 'aus' : qs.get('edit') === '0' ? 'klassisch' : qs.get('edit') === '1' ? 'edit'
  : REPLAY_ARTEN.includes(localStorage.getItem('bk_replay_art')) ? localStorage.getItem('bk_replay_art') : localStorage.getItem('bk_replay') === '0' ? 'aus' : 'edit';
let replayOn = replayArt !== 'aus';
const replayBtn = hud.menu.querySelector('[data-act="replay"]');
const replayLabel = () => { replayBtn.textContent = 'Tor-Wiederholung: ' + { edit: 'Fan-Edit', klassisch: 'Klassisch', aus: 'Aus' }[replayArt]; };
replayLabel();
// n6 Verträglichkeit: „Blitze reduzieren“ (localStorage bk_blitze, Standard nach Systemeinstellung „Bewegung reduzieren“,
// ?blitze=sanft|voll): Flashes → sanftes Aufhellen, kein RGB-Zucken, weniger Wackler
let blitzeSanft = qs.has('blitze') ? qs.get('blitze') === 'sanft' : localStorage.getItem('bk_blitze') ? localStorage.getItem('bk_blitze') === '1' : reduceMotion;
const blitzBtn = hud.menu.querySelector('[data-act="blitze"]');
const blitzLabel = () => { blitzBtn.textContent = 'Blitze reduzieren: ' + (blitzeSanft ? 'an' : 'aus'); };
blitzLabel();
// n6 „Clip im Hochformat“: Fan-Edit auf Querformat-Bildschirmen als 9:16-Ausschnitt (localStorage bk_cliphoch, ?clip=hoch|quer)
let clipHoch = qs.has('clip') ? qs.get('clip') === 'hoch' : localStorage.getItem('bk_cliphoch') === '1';
const clipBtn = hud.menu.querySelector('[data-act="cliphoch"]');
const clipLabel = () => { clipBtn.textContent = 'Clip im Hochformat: ' + (clipHoch ? 'an' : 'aus'); };
clipLabel();
const lichtBtn = hud.menu.querySelector('[data-act="licht"]');
function lichtLabel() { if (lichtBtn) lichtBtn.textContent = 'Licht: ' + (lichtPref === 'auto' ? `automatisch (${lichtMode() === 'abend' ? 'Abend' : 'Tag'})` : lichtPref === 'abend' ? 'Abend' : 'Tag'); }
let helpBack = 'menu', helpThen = null;
// Steuerungskarte beim ersten Start (danach über ☰ / Startbildschirm)
function withHelp(then) {
  if (localStorage.getItem('bk_hilfe') === '1' || qs.has('play') || qs.has('nohelp')) { then(); return; }
  helpThen = then; helpBack = mode; setMode('help');
}
function startChallenge(id) {
  challengeId = id; setSolo(false);
  if (rp.dir) endReplay();
  rp.wait = -1; hud.editVorbereiten(false);
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
// Licht Tag/Abend: Deko (Himmel, Flutlicht …) und n4 Kino-Look (Farbkorrektur, Bloom-Schwelle) und Kontaktschatten
function setLicht(m) {
  if (deko) deko.setLicht(m);
  kinoLicht(kino, m);
  if (kontakt) kontakt.night = m === 'abend';
}
hud.root.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'play') { leaveChallenge(); setSolo(urlSolo); withHelp(() => startPlay(true)); }
  if (a === 'training' || a === 'free') { leaveChallenge(); setSolo(true); withHelp(() => startPlay(true)); }
  if (a === 'trainmenu') { hud.buildTraining(CHALLENGES, records, fmtScore); setMode('train'); }
  if (a === 'challenge') { pendingCh = b.dataset.id; hud.showHint(challengeDef(pendingCh), records[pendingCh], fmtScore); setMode('hint'); }
  if (a === 'chgo') { const id = pendingCh; withHelp(() => startChallenge(id)); }
  if (a === 'chagain') startChallenge(challengeId || pendingCh);
  if (a === 'help') { helpBack = mode; helpThen = null; setMode('help'); }
  if (a === 'helpok') { localStorage.setItem('bk_hilfe', '1'); if (helpThen) { const f = helpThen; helpThen = null; f(); } else setMode(helpBack); }
  if (a === 'slowmo') { actionStufe = ACTION_STUFEN[(ACTION_STUFEN.indexOf(actionStufe) + 1) % 3]; aktion.stufe = actionStufe; aktion.abbrechen(); localStorage.setItem('bk_action', actionStufe); slowLabel(); }
  if (a === 'replay') {
    replayArt = REPLAY_ARTEN[(REPLAY_ARTEN.indexOf(replayArt) + 1) % 3]; replayOn = replayArt !== 'aus';
    localStorage.setItem('bk_replay_art', replayArt); localStorage.setItem('bk_replay', replayOn ? '1' : '0'); replayLabel();
  }
  if (a === 'blitze') { blitzeSanft = !blitzeSanft; localStorage.setItem('bk_blitze', blitzeSanft ? '1' : '0'); blitzLabel(); }
  if (a === 'cliphoch') { clipHoch = !clipHoch; localStorage.setItem('bk_cliphoch', clipHoch ? '1' : '0'); clipLabel(); }
  if (a === 'clipnochmal') clipNochmal();
  if (a === 'licht' && deko) {
    lichtPref = { auto: 'tag', tag: 'abend', abend: 'auto' }[lichtPref] || 'auto';
    localStorage.setItem('bk_licht', lichtPref); setLicht(lichtMode()); lichtLabel();
  }
  if (a === 'resume') setMode('play');
  if (a === 'credits') { creditsBack = mode; setMode('credits'); }
  if (a === 'back') setMode(creditsBack);
  if (a === 'title') { leaveChallenge(); setMode('menu'); }
  if (a === 'newgame') { if (challengeId) startChallenge(challengeId); else startPlay(true); }
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
  rp.wait = -1; hud.editVorbereiten(false);
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
  const avatarsP = qs.get('figur') === 'kapsel' ? Promise.resolve(null) : loadAvatarAssets((p) => { loadMsg.textContent = `Bandenkick lädt … Spieler ${Math.round(p * 100)} %`; }, { renderer, ktx: qs.get('ktx') !== '0' }).catch((e) => { window.__errors.push('Avatare: ' + e.message); return null; });
  const [env, skyTex, skyInfo, turfColor, turfNormal, grassColor, grassNormal, A] = await Promise.all([
    loadEnvironment(renderer), tl('assets/hdri/sky.jpg'), fetch('assets/hdri/sky.json').then((r) => r.json()),
    tl('assets/tex/turf_color.jpg'), tl('assets/tex/turf_normal.jpg'), tl('assets/tex/grass_color.jpg'), tl('assets/tex/grass_normal.jpg'), avatarsP,
  ]);
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  const sunDir = dirFromUV(skyInfo.u, skyInfo.v);
  const sky = DEKO ? makeSkyDeko(skyTex, skyInfo, sunDir) : makeSky(skyTex, skyInfo);
  scene.add(sky);
  const fogCol = new THREE.Color().setRGB(...skyInfo.ground, THREE.SRGBColorSpace).lerp(new THREE.Color().setRGB(...skyInfo.horizon, THREE.SRGBColorSpace), 0.35);
  scene.fog = new THREE.Fog(fogCol, 45, 140);
  const { sun } = makeSun(skyInfo, quality, game.cage);
  scene.add(sun, sun.target);
  G.sun = sun; G.sky = sky;
  field = buildField(P, game.cage, { turfColor, turfNormal, grassColor, grassNormal }, renderer, { deko: DEKO });
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
      const av = new Avatar(A, ROSTER[team][i % ROSTER[team].length], team, { shadows: quality.avatarShadows, cull: AV_CULL, ik: AV_IK, glatt: GLATT, traeg: qs.get('traeg') === '1' /* n5: Sicherheitsnetz nur auf Wunsch (Bildrate) */, deko: DEKO ? { sunDir, num: BIB_NUMS[team][i], extShadow: true } : null });
      figs.push(av); scene.add(av.root);
    }
  } else {
    for (let i = 0; i < 6; i++) { const c = i ? makePlayer(i < 3 ? 0xff6a13 : 0x1f6fff) : capsule; figs.push({ capsule: c }); scene.add(c.group); }
  }
  G.avatars = !!A; G.ktx2 = A ? A.ktx2 || 0 : 0; G.figs = figs;
  if (DEKO) {
    deko = new Deko({ scene, renderer, field, sunDir, quality, A, reduceMotion, sun, sky, figs: figs.filter((f) => f.root) });
    setLicht(lichtMode()); lichtLabel(); G.deko = deko;
  }
  // n4: Kontaktschatten unter Ball und Figuren (ein Draw-Call), ersetzt Ball-Blob und runde Figuren-Flecken
  if (kino && kino.stages.contact && A) {
    kontakt = new KontaktSchatten(figs.filter((f) => f.root), P.ballR);
    kontakt.night = !!(deko && deko.night);
    scene.add(kontakt.mesh); blob.visible = false;
    for (const f of figs) if (f.setContact) f.setContact(true);
  }
  gran = new Granulate();
  scene.add(gran.points);
  if (deko) deko.gran = gran;
  markers = new AimMarkers(scene);
  rp.fx = new ReplayFx(scene);
  resize();
  input.resetStick();
  if (AUTOPILOT && !START.fest) await startGrafik();
  // n6: Endbild-Varianten von Fan-Edit, Wiederholung und Action-Momenten (Tiefenschärfe, RGB-Versatz/Zoom-Unschärfe,
  // Wischschwenk) schon beim Laden übersetzen – beim Tor kostete das am Handy-Profil bis über 1 s
  if (kino && kino.vorwaermen) { const d = { k: 1 }, w = { len: 0.05 }; G.vorgewaermt = kino.vorwaermen([{ edit: 1 }, { edit: 1, whip: w }, { edit: 1, dof: d }, { edit: 1, dof: d, whip: w }, { dof: d }]); }
  loadMsg.remove();
  setMode(qs.has('play') ? 'play' : 'menu');
  if (challengeId) startChallenge(challengeId);
  else if (qs.has('play')) startPlay(true);
  G.ready = true;
}

// ---------------- Schleife ----------------
let acc = 0, last = performance.now() / 1000;
const prev = { bx: 0, by: 0, bz: 0, px: new Float64Array(8), pz: new Float64Array(8), pf: new Float64Array(8) };
function resetPrev() { const b = game.ball; prev.bx = b.p.x; prev.by = b.p.y; prev.bz = b.p.z; game.players.forEach((p, i) => { prev.px[i] = p.x; prev.pz[i] = p.z; prev.pf[i] = p.face; }); }
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
    if (deko) deko.onEvent(e, game);
    if (e.type === 'kick') {
      const k = game.players[e.player].lastKick;
      if (k && (e.player === game.human || e.human)) hud.kickInfo(k); // e.human: nach dem Pass wechselt die Steuerung sofort
      gran.emit(e.x, e.z, e.dx, e.dz, Math.min(1, e.speed / 26), rnd);
    } else if (e.type === 'ground' && e.speed > 4) {
      gran.emit(e.x, e.z, game.ball.v.x, game.ball.v.z, Math.min(0.5, e.speed / 20), rnd);
    } else if ((e.type === 'board' || e.type === 'post') && e.speed > 11) {
      if (!(DEKO && reduceMotion)) gcam.shake = Math.min(1, e.speed / 25); // Deko: „Bewegung reduzieren“ → kein Wackeln
    } else if (e.type === 'goal' && e.challenge) {
      // Challenge meldet selbst (Treffer/gehalten)
    } else if (e.type === 'goal') {
      if (R && replayOn && rp.rec && rp.recGame === game && game.players.length === rp.rec.n) {
        rp.goal = { ...e, t: game.t - DT }; rp.wait = replayArt === 'edit' ? Math.max(P.replayDelay, EDIT_DELAY) : P.replayDelay;
        // n6: Endbild-Varianten der Wiederholung jetzt übersetzen (im Live-Jubel), nicht mitten im Clip
        if (kino && kino.vorwaermen) { const d = { k: 1 }, w = { len: 0.05 }; G.vorgewaermt = kino.vorwaermen(replayArt === 'edit' ? [{ edit: 1 }, { edit: 1, dof: d }, { edit: 1, whip: w }, { edit: 1, dof: d, whip: w }] : [{ dof: d }]); }
        // (n6-Messung: die ganze Szene in ein eigenes Ziel zu zeichnen übersetzte alle Materialien neu – 1,7 s Hänger am
        // Handy-Profil; deshalb nur die Endbild-Varianten und das Overlay)
        if (replayArt === 'edit') hud.editVorbereiten(true);
      }
      if (R) {
        const mine = e.team === me().team;
        hud.flash(mine ? 'TOR!' : 'Gegentor', `${TEAM_NAMES[e.team]} · ${Math.round(e.speed * 3.6)} km/h${e.own ? ' · Eigentor' : e.saved ? ' · Tormann war noch dran' : ''}`, 2.4, DEKO ? `tor t${e.team}` : '');
      } else { hud.flash('TOR!', `${Math.round(e.speed * 3.6)} km/h`, 2.2, DEKO ? 'tor t0' : ''); hud.setScore(game.score); }
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
    } else if (e.type === 'rueckpass' && R && e.team === me().team && !game.bpToast) {
      game.bpToast = true; // Nacht 2e: einmal je Spiel, kein Freistoß
      hud.flash('Rückpass – keine Hände', 'Torwart spielt mit dem Fuß', 1.8);
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

// n6 Action-Momente (aus der Zeitlupe von Nacht 2 entstanden): Tempo der Simulation je Bild (Speed-Ramp, Bullet-Time
// = 0), Zoom-Punch der Spielkamera auf die Szene, Kreisfahrt in der Bullet-Time, Effekte. Die Simulation läuft mit
// festen Takten weiter – nur weniger/mehr Takte je Bild bzw. keine (pausiert, setzt exakt fort).
const am = { an: false, orbit: null, v: null, kmax: 0, halt: null };
function slowScale(dt) {
  const m = aktion.moment;
  const gehalten = am.halt != null && m && !(m.real + dt < am.halt);
  if (gehalten) dt = Math.max(0, am.halt - m.real); // Tests: genau anhalten (Simulation steht dann auch)
  const v = m ? aktion.bild(dt, blitzeSanft) : null;
  am.v = v;
  if (!v) { if (am.an) amEnde(); return 1; }
  if (!am.an) { am.an = true; hud.aktion(true); if (kino && kino.grade !== 'edit') { am.gradeVor = kino.grade; } }
  const M = aktion.moment;
  // Rückblick aus der Aufzeichnung (Simulation steht): Spielzeit läuft von tSpiel − rueck bis tSpiel
  am.rf = null;
  if (v.rueck >= 0 && M.rueck > 0 && rp.rec && rp.recGame === game && rp.rec.tFirst < M.tSpiel - M.rueck) {
    const tR = M.tSpiel - M.rueck * (1 - v.rueck);
    am.rate = dt > 0 && am.tR != null ? Math.max(0, (tR - am.tR) / dt) : 0.3; am.tR = tR;
    am.rf = rp.rec.frameAt(tR, am.frame || (am.frame = {}), P);
  } else am.tR = null;
  const bb = am.rf ? am.rf.ball.p : game.ball.p;
  gcam.fokus = { p: M.fokus, k: v.punch, dir: M.dir, nah: M.nah, drift: v.drift, ball: [bb.x, bb.y, bb.z] };
  gcam.zoom = (gcam.mode === 'hoch' ? 0.6 : 1) * v.punch; // quer: enger (mehr Tele)
  if (v.shake > gcam.shake) gcam.shake = v.shake;
  if (v.orbit >= 0) {
    // Bullet-Time: Halbkreis um den Moment (Start: Richtung der Spielkamera), Blick auf den Fokus
    if (!am.orbit) am.orbit = bulletBahn(M);
    const B = am.orbit, a = B.a0 + B.dir * Math.PI * (0.15 * v.orbit + 0.85 * v.orbitLin), R = B.R(a);
    gcam.override = { pos: [B.z[0] + Math.cos(a) * R, 1.35 + 0.35 * Math.sin(Math.PI * v.orbit), B.z[2] + Math.sin(a) * R], look: [B.z[0], 0.85, B.z[2]] };
    if (Math.abs(gcam.cam.fov - 46) > 0.01) { gcam.cam.fov = 46; gcam.cam.updateProjectionMatrix(); }
  } else if (am.orbit) { am.orbit = null; gcam.override = null; gcam.setAspect(gcam.cam.aspect, G.forceMode); } // ruckartig zurück
  if (kino) kino.grade = v.sat > 0.4 ? 'aktion' : am.gradeVor || kino.grade;
  hud.aktionBild(v, !(kino && kino.pipeline));
  return gehalten || am.rf ? 0 : v.rate;
}
// Bullet-Time-Bahn: Mitte zwischen Ball und nächstem Spieler, Halbkreis ab der Richtung der Spielkamera in die Richtung,
// die im Käfig bleibt; Radius schrumpft an der Bande (höchstens 4,4 m, mindestens 2 m) – ganze Figuren im Bild
function bulletBahn(M) {
  const b = game.ball.p, f = M.fokus;
  let q = null, dq = 9;
  for (const p of game.players) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < dq) { dq = d; q = p; } }
  const z = q && dq < 3 ? [b.x * 0.7 + q.x * 0.3, 0.75, b.z * 0.7 + q.z * 0.3] : [f[0], 0.85, f[2]]; // nah am Ball
  const c = gcam.cam.position, a0 = Math.atan2(c.z - z[2], c.x - z[0]), cg = game.cage;
  const R = (a) => { let r = 3.7; const cx = Math.cos(a), cz = Math.sin(a); if (cx) r = Math.min(r, ((cx > 0 ? cg.hx : -cg.hx) - 0.35 * Math.sign(cx) - z[0]) / cx); if (cz) r = Math.min(r, ((cz > 0 ? cg.hz : -cg.hz) - 0.35 * Math.sign(cz) - z[2]) / cz); return Math.max(2, r); };
  const guete = (d) => { let s = 0; for (let i = 0; i <= 8; i++) s += R(a0 + d * Math.PI * i / 8); return s; };
  return { z, a0, dir: guete(1) >= guete(-1) ? 1 : -1, R };
}
function amEnde() {
  am.rf = null; am.tR = null;
  am.an = false; am.v = null; gcam.fokus = null; gcam.zoom = 0;
  if (am.orbit) { am.orbit = null; gcam.override = null; gcam.setAspect(gcam.cam.aspect, G.forceMode); }
  if (kino && am.gradeVor) { kino.grade = am.gradeVor; am.gradeVor = null; }
  hud.aktion(false);
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
    setTimeout(() => { setMode('result'); if (deko) deko.celebrate(res.stars); }, 900);
  }
}
// Anzeigehilfen beim Aufladen: Pass → Empfänger + Treffpunkt im Laufweg, Schuss → Zielpunkt im Tor mit Streuung
function aimFrame(pl, raw, km) {
  if (!markers) return;
  const tap = !P.laden && pl.pending && pl.pending.tap ? pl.pending : null;
  if (mode !== 'play' || km || game.human < 0 || P.treffpunkt) { markers.hide(); return; }
  if (!(pl.charging || pl.armed || tap)) {
    // Nacht 2e (passfix): Pass unterwegs → Ring am Empfänger (pulsierend), bis er den Ball hat; eigener Ball am Fuß → schwacher
    // Ring an dem Mitspieler, der den Pass jetzt bekäme (wohin der Pass geht, sieht man vor dem Tippen)
    const b = game.ball, pp = game.passPlan;
    if (P.passfix && game.match && !rp.dir) {
      if (pp && pp.to >= 0 && game.players[pp.to] && b.held < 0 && game.t < pp.t + 0.6) {
        const r = game.players[pp.to];
        markers.show({ pass: { recv: [r.x, r.z], meet: pp.chip || pp.bank ? null : [pp.x, pp.z], color: pp.chip ? 0x7dff6a : 0xffffff, pulse: true } });
        return;
      }
      if (game.lastTouch === pl.id && b.held < 0 && b.p.y < 0.5 && Math.hypot(b.p.x - pl.x, b.p.z - pl.z) < 1.2) {
        const w = worldInput(raw), st = Math.hypot(w.mx, w.mz) > 0.12 ? [w.mx, w.mz] : null;
        const pv = planPass(game, pl, { mode: 'std', power: null, stick: st });
        if (pv.to >= 0) { const r = game.players[pv.to]; markers.show({ pass: { recv: [r.x, r.z], dim: true, color: 0xffffff } }); return; }
      }
    }
    markers.hide(); return;
  }
  const w = worldInput(raw), st = Math.hypot(w.mx, w.mz) > 0.12 ? [w.mx, w.mz] : tap ? tap.stick : null;
  const kind = tap ? tap.kind : pl.charging ? pl.chargeKind : pl.armed;
  const md = tap ? tap.mode : pl.charging ? pl.chargeMode : 'std';
  if (kind === 'pass') {
    const pp = planPass(game, pl, { mode: md, power: null, stick: st, prefer: tap && tap.lock ? tap.lock : null });
    const recv = pp.to >= 0 ? [game.players[pp.to].x, game.players[pp.to].z] : pp.to < -1 ? pp.meet : null;
    markers.show({ pass: { recv, meet: pp.meet, bank: pp.bank ? pp.target : null, color: md === 'var' ? 0x7dff6a : 0xffffff } });
  } else {
    const p = tap ? tapPower(pl) : Math.min(1, pl.charge / P.chargeT);
    const pv = previewShot(game, pl, md, st, p);
    markers.show({ shot: { aim: pv.aim, sigma: 0.12 + pv.dist * Math.tan(pv.noiseDeg * Math.PI / 180), color: (MODE_LOOK[pv.tech] || MODE_LOOK.vollspann)[1] } });
  }
}

let halfRate = false;
function frame() {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  const rafDt = perf.lastRaf ? (t0 - perf.lastRaf) / 1000 : 0;
  // Tests (tests/test_autopilot.py): künstliche Arbeit je Bild in ms, zählt zur CPU-Zeit des Bildes
  if (G.testLast > 0) { const tE = t0 + G.testLast; while (performance.now() < tE); }
  if (perf.lastRaf) { perf.raf.push(t0 - perf.lastRaf); if (perf.raf.length > 240) perf.raf.shift(); }
  perf.lastRaf = t0;
  if (!G.ready) return;
  // Deko: Menüs und Karten (Szene läuft nur als Hintergrund) mit halber Bildrate – spart Akku und Wärme
  if (DEKO && mode !== 'play' && !rp.dir) { halfRate = !halfRate; if (halfRate) { G.frames++; return; } }
  if (kino) renderer.info.reset();
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
      if (!rp.dir && rp.wait < 0) aktion.pruefe(evs, game); // n6 Action-Moment? (nicht nach einem Tor)
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
  const rdt = mode === 'play' && !((rp.hold || rp.haltBei != null) && rp.held) ? dt : 0;
  let rf = rp.dir && (mode === 'play' || mode === 'pause') ? replayFrame(rdt, raw) : null;
  if (!rf && am.rf && mode === 'play') { rf = am.rf; rp.rate = am.rate; } // n6 Action-Moment: Rückblick
  let bx = prev.bx + (b.p.x - prev.bx) * a, by = prev.by + (b.p.y - prev.by) * a, bz = prev.bz + (b.p.z - prev.bz) * a;
  if (rf) { bx = rf.ball.p.x; by = rf.ball.p.y; bz = rf.ball.p.z; ballMesh.quaternion.set(rf.ball.q[1], rf.ball.q[2], rf.ball.q[3], rf.ball.q[0]); }
  else ballMesh.quaternion.set(b.q[1], b.q[2], b.q[3], b.q[0]);
  ballMesh.position.set(bx, by, bz);
  poseBlob(blob, bx, by, bz, P.ballR);
  if (kontakt) blob.visible = false;
  const tA = performance.now();
  drawPlayers(rf ? rdt * rp.rate : dt, a, rf);
  if (rf && rp.dir && rp.dir.edit) editNachFiguren();
  else if (am.an) { // n6 Action-Moment: Figuren direkt vor der Linse ausblenden (Zoom-Punch, Bullet-Time), Ringe weg
    const cp = gcam.cam.position;
    // (auch wer auf der Sichtlinie dicht vor der Linse steht)
    const lk = gcam.override ? gcam.override.look : gcam.fokus ? gcam.fokus.p : null;
    for (const f of figs) {
      if (f.ring) f.ring.visible = false;
      if (!f.root || !f.root.visible) continue;
      const fx = f.root.position.x - cp.x, fz = f.root.position.z - cp.z, d = Math.hypot(fx, fz);
      let weg = d < 1.3;
      if (!weg && lk && d < 2.6) { const lx = lk[0] - cp.x, lz = lk[2] - cp.z, L = Math.hypot(lx, lz) || 1, u = (fx * lx + fz * lz) / L; weg = u > 0 && u < L - 0.8 && Math.abs(fx * lz - fz * lx) / L < 0.45; }
      if (weg) f.root.visible = false;
    }
    marker.visible = false;
  }
  if (kontakt) kontakt.update(bx, by, bz);
  perf.av.push(performance.now() - tA); if (perf.av.length > 240) perf.av.shift();
  const pl = me();
  const px = prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, pz = prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
  gcam.update(dt, { x: bx, z: bz, vx: b.v.x, vz: b.v.z }, { x: px, z: pz }, mode === 'play' || mode === 'pause' ? 'play' : 'menu');
  field.update(rf ? rf.ball.net : b.net, gcam.cam, !!(rf && rp.dir && (rp.dir.cur.cam === 'fan' || (rp.dir.edit && ED_NAHFADE.has(rp.dir.cur.cam)))));
  gran.update(dt);
  // n4: Punkt-Größen in Pixeln gelten für den Bildschirm – im verkleinerten Render-Target des Kino-Looks mitskalieren
  const pxK = kino && kino.pipeline && kino.stages.scale ? kino.renderScale : 1;
  gran.points.material.size = 0.05 * pxK;
  if (deko) deko.update(dt, { pxK, inGame: (mode === 'play' || mode === 'pause') && !rf && !gcam.override, hoch: gcam.mode === 'hoch',
    live: mode === 'play' && !rf, paused: mode === 'pause', still: frozen || mode === 'pause', game, cam: gcam.cam, ball: { p: ballMesh.position, v: b.v } });
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
  let q = null;
  if (gpuExt && !(grafik && grafik.gpu && grafik.gpu.ok)) { gpuPoll(); q = gl.createQuery(); gl.beginQuery(gpuExt.TIME_ELAPSED_EXT, q); }
  const tR = performance.now();
  schattenFolgen();
  const gz = grafik && grafik.gpu && grafik.gpu.ok ? grafik.gpu : null;
  if (gz) gz.anfang();
  zeichne(dt, rf);
  if (gz) { gz.ende(); if (gpuExt && gz.ms != null && gz.ms !== gpuLast) { gpuLast = gz.ms; gpuMs.push(gz.ms); if (gpuMs.length > 240) gpuMs.shift(); } }
  perf.rd.push(performance.now() - tR); if (perf.rd.length > 240) perf.rd.shift();
  if (q) { gl.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuQ.push(q); }
  if (G.ruck) G.ruck.bild(t0, rafDt, gcam.cam, figs, rf ? 'r_' + rp.dir.phase : mode === 'play' ? 'live' : mode, rf ? rp.rate : 1, rf ? rf.t : game.t, figSlot || []); // n5: Ruckel-Messung (Tests)
  G.frames++;
  const ft = performance.now() - t0;
  perf.ft.push(ft); if (perf.ft.length > 240) perf.ft.shift();
  // n4 Autopilot: nur Bilder im Spiel (auch Wiederholung) zählen – Menüs laufen mit halber Bildrate; nach dem Wechsel ins
  // Spiel 1,5 s Schonzeit
  if (grafik) {
    if (mode === 'play') { if (apMode !== 'play') grafik.schonen(1.5); grafik.bild(rafDt, ft); }
    apMode = mode;
  }
  if (document.body.classList.contains('debug') && (G.frames % 15 === 0)) {
    const i = renderer.info.render;
    hud.dbg.textContent = `${(1000 / avg(perf.raf)).toFixed(0)} fps · CPU ${avg(perf.ft).toFixed(1)} ms · ${i.calls} DC · ${(i.triangles / 1000).toFixed(0)}k △ · ${gcam.mode} · v ${b.v.len().toFixed(1)} m/s`;
  }
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const winkelDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// ---------------- Tor-Wiederholung (Nacht 2d) ----------------
// Aufzeichnung je Spieltakt (nur im Spiel), nach einem Tor P.replayDelay s Live-Jubel, dann Wiederholung: die Simulation
// steht so lange still (sie wird nicht verändert), die Grafik zeigt den aufgezeichneten Zustand mit eigener Kamera.
// Tippen, Taste oder Knopf überspringt; danach läuft der Jubel weiter und es folgt der Anstoß wie gewohnt.
const rp = { rec: null, recGame: null, dir: null, wait: -1, goal: null, frame: {}, rate: 1, trail: [], hold: null, held: false, fx: null, label: '', ctx: null, dof: null, kinoFx: null, edit: null, letzterEdit: null };
function recordReplay(evs) {
  if (!game.match || game.challenge) { rp.recGame = null; return; } // n6: auch ohne Wiederholung (Rückblick der Action-Momente)
  if (rp.recGame !== game || !rp.rec || rp.rec.n !== game.players.length) { rp.rec = new ReplayRecorder(game.players.length); rp.recGame = game; rp.wait = -1; }
  rp.rec.record(game, evs);
}
function startReplay() {
  rp.wait = -1;
  hud.editVorbereiten(false);
  if (aktion.moment) { aktion.abbrechen(); amEnde(); }
  if (!rp.rec || !rp.goal || rp.recGame !== game || mode !== 'play') return;
  if (replayArt === 'edit') { startEdit(); return; }
  const D = new ReplayDirector(rp.rec, rp.goal, { regie: !RCAM_ALT });
  rp.kam = new ReplayKamera(rp.rec, !RCAM_ALT);
  if (D.done) return;
  rp.dir = D; rp.held = false;
  const c = D.contact, g = rp.goal;
  // Kamera beim Kontakt auf der Feldseite (nicht hinter dem Zaun), Text: Schütze · Technik · km/h
  let side = 1;
  if (c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; side = nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
  rp.ctx = { cage: game.cage, mode: gcam.mode, contact: c, goal: { side: g.side }, time: 0, frac: 0, side, calm: DEKO && reduceMotion };
  const sc = g.scorer >= 0 ? game.players[g.scorer] : null;
  const idx = sc ? game.players.filter((p) => p.team === sc.team).indexOf(sc) + 1 : 0;
  const who = g.own ? 'Eigentor' : sc ? `${TEAM_NAMES[sc.team]} ${idx}${sc.id === game.human ? ' (du)' : ''}` : TEAM_NAMES[g.team];
  const tech = c && c.tech ? techName(c.tech) : '';
  rp.label = [who, tech ? tech + (c.tech === 'fallrueck' || c.tech === 'seitfall' || c.tech === 'flugkopf' ? '!' : '') : '', c && c.speed ? `${Math.round(c.speed * 3.6)} km/h` : ''].filter(Boolean).join(' · ');
  hud.replayShow(true, rp.label);
  markers && markers.hide();
  if (GLATT) for (const f of figs) if (f.schnitt) f.schnitt(); // n5: harter Schnitt, nicht aus dem Jubel herüberblenden
  if (deko) deko.replay(true);
}
// ---------------- n6 Fan-Edit (TikTok-Stil) ----------------
// Spitznamen je Platz (Mannschaft × Platz wie die Figuren), der Mensch heißt „DU“
const EDIT_NAMEN = [['MIKA', 'LENI', 'JONAS'], ['TIM', 'ELIF', 'NOAH']];
const ED_BALL = { x: 0, y: 0, z: 0 }, ED_SCH = { x: 0, z: 0, face: 0 }, ED_V = new THREE.Vector3();
const ED_NAHFADE = new Set(['keeper', 'netz', 'ecke', 'pfosten']); // Kameras am Netz: Netz nicht ausblenden
const ED_KNOCHEN = ['Bip01_Head', 'Bip01_Pelvis', 'Bip01_L_Hand', 'Bip01_R_Hand', 'Bip01_L_Foot', 'Bip01_R_Foot'];
function startEdit(D0 = null) {
  const g = rp.goal;
  const D = D0 || new FanEdit(rp.rec, g, { reduce: blitzeSanft, cage: game.cage, seed: Math.round(g.t * 997) + game.score[0] * 7 + game.score[1] * 13 });
  if (D.done) return;
  rp.dir = D; rp.held = false; rp.kam = null;
  const c = D.contact;
  let side = 1;
  if (c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; side = nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
  const hochClip = clipHoch && gcam.mode !== 'hoch';
  const fI = rp.rec.frameAt(D.ti, {}, P);
  const nJ = D.shots.length, hochJ = gcam.mode === 'hoch' || hochClip;
  const jub = D.schuetze >= 0 ? jubelRichtung(rp.rec, D.schuetze, D.shots[nJ - 2].keys, hochJ ? 3.0 : 2.4, 0, game.cage) : null;
  const jub2 = D.schuetze >= 0 ? jubelRichtung(rp.rec, D.schuetze, D.shots[nJ - 1].keys, hochJ ? 1.7 : 1.9, 0.45, game.cage) : null;
  // Standbild: Nahaufnahme von vorn-seitlich (Richtung zum Tor ± frei von Verdeckung)
  const sF = D.shots.find((s) => s.freeze), Sf = D.schuetze >= 0 && sF ? rp.rec.spielerGlatt(D.schuetze, D.ti, 0.05) : null;
  const freezeDir = Sf ? jubelRichtung(rp.rec, D.schuetze, sF.keys, hochJ ? 3.0 : 2.7, Math.atan2(fI.ball.p.z - Sf.z, fI.ball.p.x - Sf.x) - Sf.face + 0.6, game.cage) : null;
  rp.ctx = { cage: game.cage, hoch: gcam.mode === 'hoch' || hochClip, contact: c, goal: { side: g.side }, side, makroDir: D.makroDir, impact: [fI.ball.p.x, fI.ball.p.y, fI.ball.p.z],
    jubelDir: jub != null ? jub : 0, jubel2Dir: jub2, freezeDir, kopfY: null, u: 0, dur: 1, ball: null, schuetze: null };
  const sc = D.schuetze >= 0 ? game.players[D.schuetze] : null;
  const idx = sc ? game.players.filter((p) => p.team === sc.team).indexOf(sc) : 0;
  const name = sc ? (sc.id === game.human ? 'DU' : EDIT_NAMEN[sc.team][idx] || 'NR. ' + BIB_NUMS[sc.team][idx]) : TEAM_NAMES[g.team].toUpperCase();
  rp.edit = { hochClip, name };
  rp.letzterEdit = { D, goal: g, recGame: game };
  hud.editStart({ events: D.events, total: D.realTotal, seed: D.seed, dist: D.dist, wort: D.wort, pov: D.pov, tech: D.tech, kmh: D.kmh || Math.round((g.speed || 0) * 3.6),
    name: sc ? `${name} #${BIB_NUMS[sc.team][idx]}` : name, team: TEAM_NAMES[sc ? sc.team : g.team].toUpperCase(), gag: D.gag, own: !!g.own,
    hoch: hochClip, reduce: blitzeSanft, cssFlash: !(kino && kino.pipeline) });
  hud.replayShow(true, '');
  markers && markers.hide();
  if (GLATT) for (const f of figs) if (f.schnitt) f.schnitt();
  if (deko) deko.replay(true);
  if (kino && kino.grade !== 'edit') { rp.gradeVor = kino.grade; kino.grade = 'edit'; }
}
// „Clip nochmal“: läuft der Clip, von vorn; kurz danach den letzten Clip neu starten (solange die Aufzeichnung reicht)
function clipNochmal() {
  if (rp.dir && rp.dir.edit) { rp.dir.nochmal(); return; }
  const L = rp.letzterEdit;
  if (!L || rp.dir || mode !== 'play' || L.recGame !== game || !rp.rec || rp.rec.tFirst > L.D.shots[0].keys[0][1]) return;
  L.D.nochmal(); rp.goal = L.goal; startEdit(L.D);
}
// Ein Bild des Fan-Edits: Clip-Zeit weiter, Spielzeit über die Tempo-Kurve der Einstellung, Kamera mit Effekten
function editFrame(dt, raw) {
  const D = rp.dir;
  if (raw && (raw.passDown || raw.shotDown) && D.real > 0.3) D.skip();
  if (rp.haltBei != null && !rp.held && D.real + dt >= rp.haltBei) { dt = Math.max(0, rp.haltBei - D.real); rp.held = true; } // Tests: genau anhalten
  if (rp.hold && !D.done && D.phase === rp.hold.phase && D.segFrac() >= rp.hold.frac) rp.held = true; // Tests (perf_gate): wie Klassisch
  const i0 = D.i, tVor = D.t;
  const t = D.update(dt);
  if (D.done) { endReplay(); return null; }
  const schnitt = D.i !== i0;
  rp.rate = schnitt || dt <= 0 ? D.rateAt() : Math.max(0, (t - tVor) / dt);
  if (schnitt && GLATT) for (const f of figs) if (f.schnitt) f.schnitt(); // harter Schnitt: Figuren nicht herüberblenden
  if (G.editMess) G.editMess.push([D.real, D.i, t, performance.now()]);
  const f = rp.rec.frameAt(t, rp.frame, P);
  const s = D.shots[D.i], ctx = rp.ctx;
  ctx.u = D.real - s.t0; ctx.dur = s.t1 - s.t0; ctx.hoch = gcam.mode === 'hoch' || rp.edit.hochClip;
  ctx.ball = rp.rec.ballGlatt(t, 0.06, ED_BALL);
  ctx.schuetze = D.schuetze >= 0 ? rp.rec.spielerGlatt(D.schuetze, t, s.cam === 'jubel' || s.cam === 'tief' ? 0.25 : 0.08, ED_SCH) : null;
  const fx = rp.edit.fx = D.fx();
  const cam = editCameraFx(editCamera(s.cam, f, ctx), fx, D.real, D.seed);
  gcam.override = { pos: cam.pos, look: cam.look };
  if (Math.abs(gcam.cam.fov - cam.fov) > 0.01) { gcam.cam.fov = cam.fov; gcam.cam.updateProjectionMatrix(); }
  // Tiefenschärfe: Makro (Fuß + Ball), hinter dem Tor (Ball scharf, Netz davor weich), Jubel (Schütze scharf)
  const bp = [f.ball.p.x, f.ball.p.y, f.ball.p.z];
  rp.dof = s.cam === 'makro' ? replayDof('zoom', cam.pos, cam.look, bp) : s.cam === 'netz' || s.cam === 'pfosten' ? replayDof('fan', cam.pos, cam.look, bp) : s.cam === 'jubel' || s.cam === 'jubel2' ? replayDof('fan', cam.pos, cam.look, null) : null;
  rp.kinoFx = { white: fx.white, whip: fx.whip > 0.01 ? { len: 0.08 * fx.whip, ang: 0 } : null,
    edit: { ca: 1.4 * fx.ca, grain: blitzeSanft ? 0.035 : fx.grain, zoom: 0.07 * fx.punch, mono: 0.35 * fx.freeze } };
  const c = D.contact, k = c ? t - c.t : -1;
  if (rp.fx) {
    // Druckwelle am Kontakt, Kometenschweif vom Kontakt bis kurz nach dem Einschlag, Leuchten um den Ball
    rp.fx.setRing(c, k);
    const komet = k > 0 && t < D.ti + 0.3;
    rp.fx.setTrailFarbe([1.0, 0.5, 0.12]);
    const dCam = Math.hypot(f.ball.p.x - cam.pos[0], f.ball.p.y - cam.pos[1], f.ball.p.z - cam.pos[2]);
    rp.fx.setTrail(komet ? rp.rec.trail(t, Math.min(0.35, k), 24, rp.trail) : null, gcam.cam, komet ? 1 : 0, Math.max(0.24, dCam * 0.028));
    rp.fx.setGlow(0, fx.glow ? [f.ball.p.x, f.ball.p.y, f.ball.p.z] : null, Math.max(0.8, dCam * 0.13) * (1 + 0.3 * fx.puls), 0.8);
  }
  return f;
}
// nach dem Stellen der Figuren: Schuhe des Schützen leuchten, Kontur um den Schützen (Standbild), HUD
function editNachFiguren() {
  const D = rp.dir, fx = rp.edit.fx;
  if (!fx) return;
  let fig = null;
  if (figSlot) for (let i = 0; i < figSlot.length; i++) if (figSlot[i] && figSlot[i].id === D.schuetze) fig = figs[i];
  if (fig && fig.bones && fig.bones.Bip01_Head) { fig.bones.Bip01_Head.getWorldPosition(ED_V); rp.ctx.kopfY = ED_V.y; } // für die Jubel-Kamera
  // andere Figuren direkt vor der Linse ausblenden (sonst füllt ein unscharfer Rücken das Bild)
  const cp = gcam.override && gcam.override.pos;
  if (cp) for (const f of figs) { if (f.ring) f.ring.visible = false; if (f !== fig && f.root && f.root.visible && Math.hypot(f.root.position.x - cp[0], f.root.position.z - cp[2]) < 1.25) f.root.visible = false; } // Torwart-Ringe aus
  for (let k = 0; k < 2; k++) {
    const bn = fig && fig.bones ? fig.bones[k ? 'Bip01_R_Foot' : 'Bip01_L_Foot'] : null;
    if (bn && rp.fx) { bn.getWorldPosition(ED_V); rp.fx.setGlow(1 + k, [ED_V.x, ED_V.y, ED_V.z], 0.42 + 0.12 * fx.puls, fx.freeze ? 0.9 : 0.6); }
    else if (rp.fx) rp.fx.setGlow(1 + k, null, 0, 0);
  }
  let ring = null;
  if (fx.freeze && fig && fig.root) {
    // Kontur um die ganze Figur (auch liegend): Rechteck um Kopf, Becken, Hände, Füße im Bild
    const cam = gcam.cam, R = hud.editRahmen(), W = innerWidth, H = innerHeight;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of ED_KNOCHEN) {
      const bn = fig.bones && fig.bones[n];
      if (bn) bn.getWorldPosition(ED_V); else ED_V.set(fig.root.position.x, n === 'Bip01_Head' ? 1.8 : 0.1, fig.root.position.z);
      ED_V.project(cam);
      const x = (ED_V.x + 1) / 2 * W - R.left, y = (1 - ED_V.y) / 2 * H - R.top;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    ring = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  hud.editFrame(D.real, fx, ring);
}
function endReplay() {
  const warEdit = !!(rp.dir && rp.dir.edit);
  rp.dir = null; rp.goal = null; rp.held = false; rp.dof = null; rp.kinoFx = null;
  if (warEdit) { hud.editEnd(3); rp.edit = null; if (kino && rp.gradeVor) { kino.grade = rp.gradeVor; rp.gradeVor = null; } }
  if (deko) deko.replay(false);
  gcam.override = null;
  if (GLATT) for (const f of figs) if (f.schnitt) f.schnitt();
  hud.replayShow(false); hud.replayState(false, 0);
  if (rp.fx) rp.fx.hide();
  resetPrev(); acc = 0;
}
function skipReplay() { if (rp.dir) { rp.dir.skip(); } }
// Ein Bild der Wiederholung: Zeit weiter, Zustand, Kamera, Effekte → Zustand (oder null, wenn zu Ende)
function replayFrame(dt, raw) {
  const D = rp.dir;
  if (D.edit) return editFrame(dt, raw);
  if (raw && (raw.passDown || raw.shotDown) && D.real > 0.3) D.skip();
  const s0 = D.cur, tVor = D.t;
  const t = D.update(dt);
  // Abspieltempo dieses Bildes (Figuren laufen mit): n5 tatsächlich vergangene Spielzeit je Echtzeit (Rampen)
  rp.rate = D.done ? 1 : RCAM_ALT ? s0.rate : dt > 0 ? (t - tVor) / dt : D.rateAt(t);
  if (rp.hold && !D.done && D.phase === rp.hold.phase && D.segFrac() >= rp.hold.frac) { rp.held = true; }
  if (D.done) { endReplay(); return null; }
  const f = rp.rec.frameAt(t, rp.frame, P);
  const ctx = rp.ctx; ctx.time = D.real; ctx.frac = D.segFrac(); ctx.mode = gcam.mode;
  const cam = rp.kam.bild(D.cur.cam, f, ctx, dt, rp.rate);
  gcam.override = { pos: cam.pos, look: cam.look };
  rp.dof = replayDof(D.cur.cam, cam.pos, cam.look, [f.ball.p.x, f.ball.p.y, f.ball.p.z]); // n4: Tiefenschärfe nur im Replay (Zoom, Fan-Cam)
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
addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('[data-act="clipnochmal"]')) return; // n6: „Clip nochmal“ statt überspringen
  if (rp.dir && mode === 'play' && rp.dir.real > 0.3) skipReplay();
}, true);
addEventListener('keydown', (e) => { if (rp.dir && mode === 'play' && e.code !== 'Escape' && rp.dir.real > 0.3) skipReplay(); });

const CULL = { f: new THREE.Frustum(), m: new THREE.Matrix4(), s: new THREE.Sphere(new THREE.Vector3(), 1.5) };
const BALLPOS = [0, 0, 0]; // n4: Ball (wie gezeichnet) für die Fuß-IK beim Kontakt
const KICKBALD = [];
// Menschen zeichnen: Position interpoliert, Pose aus dem Sim-Zustand (Blend nach Tempo, Tormann, Jubel)
function drawPlayers(dt, a, rf = null) {
  const R = game.match ? game.rules : null, b = rf ? rf.ball : game.ball;
  const n = game.players.length;
  BALLPOS[0] = ballMesh.position.x; BALLPOS[1] = ballMesh.position.y; BALLPOS[2] = ballMesh.position.z;
  // Figur je Spieler: Mannschaft × Platz (Challenges haben weniger Spieler, Farbe muss passen); Wiederholung: Geister
  const slot = figSlot || (figSlot = []), cnt = [0, 0];
  // n4: Sichtbarkeit je Figur mit der Kamera des letzten Bildes (Kugel 1,5 m um die Hüfte – etwas größer als die Zeichen-Kugel, damit am Bildrand nichts im Halbtakt zuckt); nicht in der Wiederholung
  const sparen = AV_CULL && !rf && G.ready;
  if (sparen) { CULL.m.multiplyMatrices(gcam.cam.projectionMatrix, gcam.cam.matrixWorldInverse); CULL.f.setFromProjectionMatrix(CULL.m); }
  slot.length = 0;
  for (const p of game.players) slot[p.team * 3 + cnt[p.team]++] = rf ? Object.assign(rf.players[p.id], { team: p.team }) : p;
  for (let i = 0; i < figs.length; i++) {
    const f = figs[i], pl = slot[i];
    const vis = !!pl;
    if (f.capsule) { f.capsule.group.visible = vis; } else f.root.visible = vis;
    if (!vis) continue;
    const x = rf ? pl.x : prev.px[pl.id] + (pl.x - prev.px[pl.id]) * a, z = rf ? pl.z : prev.pz[pl.id] + (pl.z - prev.pz[pl.id]) * a;
    let face = rf || !GLATT ? pl.face : prev.pf[pl.id] + winkelDiff(pl.face, prev.pf[pl.id]) * a; // n5: wie die Lage interpoliert
    // n6 Fan-Edit: im Jubel dreht sich der Schütze zur Kamera
    if (rf && rp.dir && rp.dir.edit && (rp.dir.cur.cam === 'jubel' || rp.dir.cur.cam === 'jubel2') && pl.id === rp.dir.schuetze && gcam.override) face = Math.atan2(gcam.override.pos[2] - z, gcam.override.pos[0] - x);
    if (f.capsule) { posePlayer(f.capsule, pl, x, z); continue; }
    const keeper = rf ? pl.keeper : R ? R.keeper[pl.team] === pl.id && R.phase !== 'end' && R.handsOffTeam !== pl.team : false;
    let special = null, specialZeit = null, armeHoch = 0;
    if (R && !rf) {
      if (R.phase === 'goal' && pl.speed < 0.8) special = R.scoredTeam === pl.team ? ((R.goals.length ? R.goals[R.goals.length - 1].scorer : game.lastTouch) === pl.id ? 'cheer' : 'clap') : 'wait';
      else if (R.phase === 'end' && pl.speed < 0.8) special = R.winner < 0 ? 'clap' : R.winner === pl.team ? 'cheer2' : 'wait';
      else if (R.phase === 'halftime' && pl.speed < 0.8) special = 'wait';
    } else if (rf && rp.dir && rp.dir.edit && rf.t > rp.dir.goal.t + 0.15 && pl.speed < (pl.id === rp.dir.schuetze ? 2.5 : 1.2)) {
      // n6 Fan-Edit: im Jubel jubelt der Schütze, die Mitspieler klatschen (wie live nach dem Tor)
      // erste Jubel-Einstellung: Arme hoch (V), zweite: Faust ballen/küssen
      const v = pl.id === rp.dir.schuetze && rp.dir.cur.cam !== 'jubel2';
      special = pl.id === rp.dir.schuetze ? (v ? 'wait' : G.jubelClip || rp.dir.jubelClip) : pl.team === rp.dir.goal.team ? 'clap' : 'wait';
      specialZeit = rf.t - rp.dir.goal.t + (G.jubelVersatz ?? rp.dir.jubelVersatz);
      if (v) armeHoch = 0.9 + 0.1 * Math.sin(rp.dir.real * Math.PI * 2 / 0.46875);
    }
    const ownGoalX = R ? R.goalX(pl.team) : -99;
    const ready = keeper && b.held < 0 && Math.hypot(b.p.x - ownGoalX, b.p.z) < 9 && pl.speed < 2.5 && pl.hand.mode === 'none';
    if (sparen) CULL.s.center.set(x, 1.0 + (pl.jumpY || 0), z);
    // n5: Wiederholung – nächster Ballkontakt dieses Spielers (≤ 0,12 s), damit der Fuß schon vorher zum Ball greift
    const kickBald = rf && GLATT && VORGRIFF && rp.rec ? rp.rec.naechsterKick(pl.id, rf.t, 0.12, KICKBALD[i] || (KICKBALD[i] = {})) : null;
    if (kickBald) kickBald.rate = rp.rate;
    f.update(dt, pl, { x, z, keeper, holding: b.held === pl.id, ready, special, specialZeit, armeHoch, t: rf ? rf.t : game.t, face, kickBald, sparen: sparen && !CULL.f.intersectsSphere(CULL.s), ball: BALLPOS });
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
// Auflösung in 0,25er-Schritten bis 1,0 senken, dann Echtzeit-Schatten der Menschen aus (Blob), dann (Deko) weniger
// Effekte, dann alle Schatten aus.
const autoQ = { on: !qs.has('q') && !AUTOPILOT, t: 0, sum: 0, n: 0, steps: [] };
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
  else if (deko && !deko.lite) { deko.setLite(); autoQ.steps.push('deko einfach'); }
  else if (renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    autoQ.steps.push('schatten aus');
  } else autoQ.on = false;
}

// ---------------- n4: Zeichnen, Qualitäts-Autopilot, enge Schattenkamera ----------------
let grafik = null, grafikKey = null, apMode = 'load', gpuLast = null;
function zeichne(dt, rf = null) {
  const av = (!rf || rf === am.rf) && am.v ? am.v : null; // n6 Action-Moment: Weißblitz, RGB-Versatz, Zoom-Unschärfe
  if (kino) kino.render(scene, gcam.cam, rf && rp.kinoFx ? { dt, dof: rp.dof, ...rp.kinoFx } : av ? { dt, white: av.flash, whip: av.whip > 0.01 ? { len: 0.07 * av.whip, ang: 0 } : null, edit: { ca: av.ca, grain: 0.03, zoom: 0.05 * av.lines, mono: 0 } } : { dt, dof: rf ? rp.dof : null });
  else renderer.render(scene, gcam.cam);
}
// Kurzmessung (Ladebildschirm): Startszene zeichnen wie im Menü
function zeichneProbe() {
  if (kino) renderer.info.reset();
  drawPlayers(1 / 60, 1, null);
  gcam.update(1 / 60, { x: 0, z: 0, vx: 0, vz: 0 }, { x: 0, z: 0 }, 'menu');
  schattenFolgen();
  zeichne(1 / 60, null);
}
// Pixeldichte: Stufe × (ohne Kino-Render-Target) Renderskala des Autopiloten
const kinoSkaliert = () => !!(kino && kino.pipeline && kino.stages.scale);
function pixelDichte() { renderer.setPixelRatio(quality.dpr * (grafik && !kinoSkaliert() ? grafik.skala : 1)); }
function skalaAnwenden(s) { if (kinoSkaliert()) kino.renderScale = s; pixelDichte(); }
function menschenAnwenden() {
  quality.avatarShadows = quality.level >= 2 && (!grafik || grafik.menschenAn);
  for (const f of figs) if (f.setShadows) f.setShadows(quality.avatarShadows && !f.night);
}
function dekoAnwenden() { if (!deko) return; if (quality.level < 1 || (grafik && !grafik.dekoAn)) deko.setLite(); else deko.setFull(); }
// Grafikstufe zur Laufzeit wechseln (Autopilot): Pixeldichte, Kino-Stufe, Schattenkarte (an/aus = Shader neu), Menschen-
// Schatten, Deko-Effekte. Die Kantenglättung des Canvas bleibt wie beim Start (Stufe 1/2 glätten im Kino-Look selbst).
function stufeAnwenden(l) {
  const w = stufenWerte(l, { dpr: devicePixelRatio || 1, schatten2: SCHATTEN2 });
  const wechsel = w.shadows !== renderer.shadowMap.enabled;
  Object.assign(quality, w, { aa: quality.aa });
  kinoStufeSetzen(kino, l);
  pixelDichte();
  if (G.sun) sonnenSchatten(G.sun, quality, game.cage);
  if (wechsel) { renderer.shadowMap.enabled = quality.shadows; scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
  menschenAnwenden(); dekoAnwenden();
}
async function startGrafik() {
  const gl = renderer.getContext();
  grafikKey = geraeteSchluessel(gl, { w: screen.width, h: screen.height, dpr: devicePixelRatio });
  grafik = new GrafikSteuerung({ level: quality.level, kino, gl, wirkung: {
    stufe: stufeAnwenden, skala: skalaAnwenden, deko: dekoAnwenden, menschenschatten: menschenAnwenden,
    merke: (z) => { merkeStufe(localStorage, z.level); merkeGeraet(localStorage, grafikKey, { skala: z.skala, stufe: z.level }); },
  } });
  G.grafik = grafik;
  const [lo, hi, st] = skalaBereich(quality.level, kino);
  const mem = ladeGeraet(localStorage, grafikKey);
  let skala = null;
  if (mem && (mem.stufe ?? quality.level) === quality.level) { skala = mem.skala; G.startProbe = { gespeichert: true, skala }; }
  else if (qs.get('startprobe') !== '0') {
    loadMsg.textContent = 'Bandenkick lädt … Grafik einstellen';
    grafik.start(st);
    const r = await messeBilder(() => zeichneProbe(), gl, { bilder: 20, vorlauf: 4 });
    skala = startSkala(r.median, [lo, hi], st);
    G.startProbe = { ...r, skala };
  }
  grafik.start(skala ?? st);
  merkeGeraet(localStorage, grafikKey, { skala: grafik.skala, stufe: grafik.level }); merkeStufe(localStorage, grafik.level);
}
// Schattenkamera folgt dem Bildausschnitt (render/schatten.js). Richtung zur Sonne: wie makeSun/Deko-Abend sie setzen
// (Ziel im Ursprung) – ändert jemand die Sonne von außen, wird die Richtung neu übernommen.
const SCH = { prev: null, dirs: randPunkte(3), vp: new THREE.Matrix4(), d: new THREE.Vector3(), gesetzt: new THREE.Vector3(NaN, 0, 0), v: new THREE.Vector3() };
function schattenFolgen() {
  const sun = G.sun;
  if (!SCHATTENKAM || !sun || !sun.castShadow || !renderer.shadowMap.enabled) return;
  if (!sun.position.equals(SCH.gesetzt)) SCH.d.copy(sun.position).normalize();
  const cam = gcam.cam, cage = game.cage, d = SCH.d;
  sun.userData.schattenkam = true;
  const m = cage.hx + cage.gD + 2.5, box = [-m, m, -(cage.hz + 2.5), cage.hz + 2.5];
  cam.updateMatrixWorld();
  SCH.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const dirs = SCH.dirs.map(([x, y]) => { SCH.v.set(x, y, 0.5).unproject(cam).sub(cam.position).normalize(); return [SCH.v.x, SCH.v.y, SCH.v.z]; });
  const pts = bildFlaeche([cam.position.x, cam.position.y, cam.position.z], dirs, { box, vp: SCH.vp.elements });
  const a = schattenAusschnitt(pts, [d.x, d.y, d.z], { mapSize: sun.shadow.mapSize.x, maxExt: schattenExt(cage), prevExt: SCH.prev });
  SCH.prev = a.ext;
  const sc = sun.shadow.camera;
  if (sc.right !== a.ext) { sc.left = -a.ext; sc.right = a.ext; sc.top = a.ext; sc.bottom = -a.ext; sc.updateProjectionMatrix(); }
  sun.target.position.set(a.target[0], a.target[1], a.target[2]);
  sun.position.set(a.pos[0], a.pos[1], a.pos[2]);
  SCH.gesetzt.copy(sun.position);
  G.schatten = { ext: a.ext, texel: +a.texel.toFixed(4), karte: sun.shadow.mapSize.x };
}

// ---------------- Debug-API für Tests ----------------
Object.assign(G, {
  scene, renderer, gcam, inputs: input, sound, kino,
  start() { startPlay(); },
  mode: () => mode,
  setMode(m) { G.forceMode = m || null; resize(); },
  // opts.bots: Bot gegen Bot (kein Mensch) mit opts.seed (Zahl wie in den Node-Tests) – n6 Fan-Edit-Bildfolgen
  newGame(opts = {}) {
    if (opts.solo !== undefined) setSolo(opts.solo);
    game = opts.bots ? new Game(P, opts.seed ?? seed, { match: true, human: -1, botLevels: opts.botLevels || [2, 2] }) : newGame();
    resetPrev(); setMode('play'); if (!game.match) game.kickoff();
  },
  // n6: Simulation synchron bis zum Ereignis typ (mit Aufzeichnung für die Wiederholung), höchstens maxSec Spielzeit
  simBis(maxSec, typ = 'goal') {
    const n = Math.round(maxSec / DT);
    for (let i = 0; i < n; i++) { const e = game.step([]); handleEvents(e); recordReplay(e); if (e.some((x) => x.type === typ)) break; }
    resetPrev();
    return { t: game.t, score: [...game.score] };
  },
  // n6: Fan-Edit bei Clip-Zeit r (s) anhalten (Bildfolgen), null = weiter
  editHalt(r = null) { rp.haltBei = r; rp.held = false; },
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
      dpr: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], quality, shadows: renderer.shadowMap.enabled,
      auto: grafik ? { on: true, autopilot: grafik.zustand(), steps: grafik.schritte(), log: grafik.log.slice(-20), startProbe: G.startProbe || null } : { on: autoQ.on, steps: [...autoQ.steps] },
      shadow: G.schatten || null, figuren: { cull: AV_CULL, gespart: figs.reduce((n, f) => n + (f.gespart || 0), 0), ik: AV_IK, ikN: figs.reduce((n, f) => n + (f.ikN || 0), 0), ikMs: +figs.reduce((n, f) => n + (f.ikZeit || 0), 0).toFixed(2), proc: +(figs.reduce((n, f) => n + (f.procN || 0), 0) / Math.max(1, figs.reduce((n, f) => n + (f.bildN || 0), 0))).toFixed(3), traeg: figs.reduce((n, f) => n + (f.trN || 0), 0) },
      kino: kino ? { ...kino.describe(), licht: kino.licht, bloom: [kino.bloomThreshold, kino.bloomStrength], dof: rp.dof, kontakt: !!kontakt } : null };
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
  replay() { const D = rp.dir; return { art: replayArt, edit: D && D.edit ? { i: D.i, beat: +D.beat.toFixed(3), schnitte: D.schnitte, cam: D.cur.cam, tech: D.tech, kmh: D.kmh, schuetze: D.schuetze, tc: D.tc, ti: D.ti, t: D.t } : null, active: !!D, wait: rp.wait, phase: D ? D.phase : null, frac: D ? D.segFrac() : 0, real: D ? D.real : 0, total: D ? D.realTotal : 0, label: rp.label, held: rp.held, contact: D && D.contact ? { ...D.contact } : null, recCount: rp.rec ? rp.rec.count : 0, segs: D ? D.segs.map((x) => x.name) : [] }; },
  replayHold(phase = null, frac = 0.5) { rp.hold = phase ? { phase, frac } : null; rp.held = false; },
  replaySkip() { skipReplay(); },
  // n6: Art der Wiederholung setzen ('edit' | 'klassisch' | 'aus'), Fan-Edit-Messung (je Bild Clip-Zeit, Einstellung,
  // Spielzeit, Zeitstempel), Clip nochmal, Einstellungen
  replayArt(a) { if (REPLAY_ARTEN.includes(a)) { replayArt = a; replayOn = a !== 'aus'; replayLabel(); } return replayArt; },
  editMessStart() { G.editMess = []; },
  editMessDaten() { const d = G.editMess; G.editMess = null; return d; },
  clipNochmal() { clipNochmal(); },
  // n6 Action-Momente (Tests): Zustand/Zähler, Stufe, Zufall festlegen, Moment bei Echtzeit r anhalten
  aktion() { const m = aktion.moment; return { stufe: aktion.stufe, zahl: aktion.zahl, log: aktion.log.slice(-30), aktiv: !!m, art: m ? m.art : null, grund: m ? m.grund : null, real: m ? m.real : 0, v: am.v ? { ...am.v } : null }; },
  aktionStufe(s) { if (ACTION_STUFEN.includes(s)) { actionStufe = s; aktion.stufe = s; slowLabel(); } return actionStufe; },
  aktionZufall(p = null) { aktion.rnd = p == null ? Math.random : () => p; },
  aktionHalt(r = null) { am.halt = r; },
  // Moment sofort starten (Tests: Eingabe während der Zeitlupe), fokus = [x, y, z]
  aktionStart(art = 'ramp', fokus = null) { const b = game.ball; aktion.moment = { w: 1, art, fokus: fokus || [b.p.x, b.p.y, b.p.z], spieler: -1, grund: 'test', t: 0, tSpiel: game.t, real: 0 }; aktion.zahl++; },
  editOpts(o = {}) { if ('blitze' in o) { blitzeSanft = !!o.blitze; blitzLabel(); } if ('hoch' in o) { clipHoch = !!o.hoch; clipLabel(); } return { blitzeSanft, clipHoch }; },
  // n5 Ruckel-Messung (tests/ruckel.py): Aufzeichnung je Bild starten/abholen
  ruckStart(max = 9000) { G.ruck = new RuckMessung(figs.length, max); },
  ruckDaten() { const d = G.ruck ? G.ruck.daten() : null; G.ruck = null; return d; },
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
