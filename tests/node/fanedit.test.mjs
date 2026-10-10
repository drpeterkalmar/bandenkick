// n6 Fan-Edit der Tor-Wiederholung (TikTok-Stil): an echten Bot-Toren (deterministisch) prüfen, dass
//  - jeder Schnitt genau auf dem Taktraster liegt (Einstellungsgrenzen = Vielfache eines Schlags; beim Abspielen mit
//    schwankender Bildrate landet der Schnitt im ersten Bild nach dem Schlag → Abweichung < 1 Bild),
//  - der Ball am Kontakt (Schlag 3, Makro-Kamera) im Bild ist – hoch, quer und als 9:16-Ausschnitt auf Querformat,
//  - höchstens 3 Weiß-Flashes je Clip, jeder < 120 ms; „Blitze reduzieren“: kein Flash, kein RGB-Versatz, nur sanftes
//    Aufhellen,
//  - Spielzeit innerhalb einer Einstellung nie rückwärts läuft, am Kontakt fast Standbild (≤ 0,1 ×), Standbild am
//    Netzeinschlag, Clip 6–10 s,
//  - Kameras endlich sind und der Spielzustand unverändert bleibt.
// Aufruf: node tests/node/fanedit.test.mjs
import { createHash } from 'node:crypto';
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { ReplayRecorder } from '../../src/sim/replay.js';
import { FanEdit, editCamera, editCameraFx, BEAT, EDIT_DELAY, FLASH_MAX } from '../../src/sim/fanedit.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit = '', target = null, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');
const hash = (g) => createHash('sha1').update(JSON.stringify({ s: g.snapshot(), ev: g.events.length, tick: g.tick })).digest('hex').slice(0, 12);

function untilGoal(seed) {
  const g = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] });
  const rec = new ReplayRecorder(g.players.length);
  let goal = null;
  while (!goal && g.t < 600) {
    const ev = g.step([]);
    rec.record(g, ev);
    for (const e of ev) if (e.type === 'goal') goal = { ...e, t: g.t - DT };
  }
  for (let i = 0; i < EDIT_DELAY / DT && goal; i++) rec.record(g, g.step([])); // Live-Jubel wie im Spiel
  return { g, rec, goal };
}
// Punkt → Bildkoordinaten (−1…1) einer Kamera {pos, look, fov} mit Seitenverhältnis asp (three.js lookAt, oben = +y)
function proj(cam, p, asp) {
  const f = cam.look.map((v, i) => v - cam.pos[i]), fl = Math.hypot(...f); const F = f.map((v) => v / fl);
  let R = [F[1] * 0 - F[2] * 1, F[2] * 0 - F[0] * 0, F[0] * 1 - F[1] * 0]; // F × up
  const rl = Math.hypot(...R); R = R.map((v) => v / rl);
  const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
  const d = p.map((v, i) => v - cam.pos[i]), z = d[0] * F[0] + d[1] * F[1] + d[2] * F[2];
  if (z <= 0.05) return null;
  const th = Math.tan(cam.fov * Math.PI / 360);
  return [(d[0] * R[0] + d[1] * R[1] + d[2] * R[2]) / z / (th * asp), (d[0] * U[0] + d[1] * U[1] + d[2] * U[2]) / z / th];
}
const ASP = { quer: 915 / 412, hoch: 412 / 915, clip: 9 / 16 };

let n = 0, gridOk = 0, cutDevMax = 0, cutDevFrames = 0, kontaktIn = 0, kontaktFaelle = 0, flashOk = 0, sanftOk = 0, monoOk = 0, freezeOk = 0, slowOk = 0, camOk = 0, hashOk = 0;
let lenMin = 99, lenMax = 0, flashMaxN = 0, flashMaxMs = 0, slowMax = 0;
const techs = {}, inView = {};
for (const seed of [3, 7, 11, 19, 23, 31, 37, 41]) {
  const { g, rec, goal } = untilGoal(seed);
  if (!goal) continue;
  n++;
  const h0 = hash(g);
  const D = new FanEdit(rec, goal, { seed });
  techs[D.tech] = (techs[D.tech] || 0) + 1;
  lenMin = Math.min(lenMin, D.realTotal); lenMax = Math.max(lenMax, D.realTotal);
  // Raster: jede Einstellung beginnt auf einem ganzen Schlag
  if (D.shots.every((s) => Math.abs(s.t0 / BEAT - Math.round(s.t0 / BEAT)) < 1e-9)) gridOk++;
  // Abspielen mit schwankender Bildrate (30–75 fps): Schnitt-Bild ≤ 1 Bild nach dem Schlag
  let r = 0, i = 0, rnd = seed * 7919 % 1000 / 1000;
  while (!D.done) {
    rnd = (rnd * 9301 + 49297) % 233280 / 233280;
    const dt = 1 / (30 + 45 * rnd);
    D.update(dt);
    if (!D.done && D.i !== i) {
      const dev = D.real - D.shots[D.i].t0;
      cutDevMax = Math.max(cutDevMax, dev); cutDevFrames = Math.max(cutDevFrames, dev / dt);
      i = D.i;
    }
    r += dt;
  }
  void r;
  // Spielzeit je Einstellung monoton, Kontakt fast Standbild, Standbild am Einschlag
  let mono = true;
  for (const s of D.shots) { let last = -1e9; for (let u = 0; u <= s.t1 - s.t0; u += 0.002) { const t = s.k.at(u); if (t < last - 1e-9) mono = false; last = t; } }
  if (mono) monoOk++;
  const sk = D.shots.find((s) => s.name === 'kontakt'), kr = Math.max(sk.k.rate(BEAT - 0.1), sk.k.rate(BEAT), sk.k.rate(BEAT + 0.1));
  slowMax = Math.max(slowMax, kr); if (kr <= 0.1) slowOk++;
  const sf = D.shots.find((s) => s.freeze);
  if (sf && Math.abs(sf.k.at(0) - D.ti) < 1e-9 && Math.abs(sf.k.at(BEAT * 0.9) - D.ti) < 1e-9) freezeOk++;
  // Flashes: Anzahl und Dauer (1-ms-Raster)
  const flashes = []; let on = -1;
  for (let rr = 0; rr <= D.realTotal; rr += 0.001) { const w = D.fx(rr).white > 0.001; if (w && on < 0) on = rr; if (!w && on >= 0) { flashes.push(rr - on); on = -1; } }
  flashMaxN = Math.max(flashMaxN, flashes.length); flashMaxMs = Math.max(flashMaxMs, ...flashes.map((x) => x * 1000), 0);
  if (flashes.length <= FLASH_MAX && flashes.every((x) => x < 0.12)) flashOk++;
  const Ds = new FanEdit(rec, goal, { seed, reduce: true });
  let sanft = true; for (let rr = 0; rr <= Ds.realTotal; rr += 0.002) { const fx = Ds.fx(rr); if (fx.flash || fx.ca > 0 || fx.white > 0.25) sanft = false; }
  if (sanft) sanftOk++;
  // Kameras: alle Einstellungen, hoch/quer/9:16; Ball am Kontakt (Schlag 3) im Bild
  const c = D.contact;
  let side = 1;
  if (c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; side = nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
  const fI = rec.frameAt(D.ti, {}, P), impact = [fI.ball.p.x, fI.ball.p.y, fI.ball.p.z];
  let fin = true;
  for (const fmt of ['quer', 'hoch', 'clip']) {
    const ctx = { cage: g.cage, hoch: fmt !== 'quer', contact: c, goal: { side: goal.side }, side, makroDir: D.makroDir, impact, jubelDir: 0, u: 0, dur: 1 };
    for (let rr = 0; rr < D.realTotal; rr += 1 / 60) {
      const si = D.shotAt(rr), s = D.shots[si], t = D.spielzeit(rr), f = rec.frameAt(t, {}, P);
      ctx.u = rr - s.t0; ctx.dur = s.t1 - s.t0; ctx.ball = rec.ballGlatt(t, 0.06); ctx.schuetze = D.schuetze >= 0 ? rec.spielerGlatt(D.schuetze, t, 0.08) : null;
      const cam = editCameraFx(editCamera(s.cam, f, ctx), D.fx(rr), rr, seed);
      if (![...cam.pos, ...cam.look, cam.fov].every(Number.isFinite)) fin = false;
      const q = proj(cam, [f.ball.p.x, f.ball.p.y, f.ball.p.z], ASP[fmt]), drin = q && Math.abs(q[0]) < 1 && Math.abs(q[1]) < 1;
      const key = `${s.cam}`; inView[key] = inView[key] || [0, 0]; inView[key][0] += drin ? 1 : 0; inView[key][1]++;
      if (s.name === 'kontakt' && c && Math.abs(t - c.t) < 0.004) { kontaktFaelle++; if (q && Math.abs(q[0]) < 0.85 && Math.abs(q[1]) < 0.85) kontaktIn++; }
    }
  }
  if (fin) camOk++;
  if (hash(g) === h0) hashOk++;
}
check('Tore untersucht', n, 6, 99, '', null, Object.entries(techs).map(([k, v]) => `${k} ${v}`).join(', '));
check('Schnitte auf dem Taktraster (128 BPM, Einstellung beginnt auf ganzem Schlag)', gridOk, n, n, `/${n}`, n);
check('… beim Abspielen (30–75 fps schwankend): Schnitt höchstens 1 Bild nach dem Schlag', cutDevFrames, 0, 1, 'Bild', '< 1', `max ${(cutDevMax * 1000).toFixed(1)} ms`);
check('Clip-Länge', lenMax, 6, 10, 's', '6–10', `${lenMin.toFixed(2)}–${lenMax.toFixed(2)} s`);
check('Spielzeit je Einstellung nie rückwärts', monoOk, n, n, `/${n}`, n);
check('Kontakt fast Standbild (Tempo am Kontakt)', slowOk, n, n, `/${n}`, n, `max ${slowMax.toFixed(3)} ×`);
check('Standbild am Netzeinschlag', freezeOk, n, n, `/${n}`, n);
check(`Flashes ≤ ${FLASH_MAX} je Clip, jeder < 120 ms`, flashOk, n, n, `/${n}`, n, `max ${flashMaxN} Flashes, längster ${flashMaxMs.toFixed(0)} ms`);
check('„Blitze reduzieren“: kein Flash, kein RGB-Versatz, Aufhellen ≤ 0,25', sanftOk, n, n, `/${n}`, n);
check('Ball am Kontakt im Bild (Makro, hoch/quer/9:16, |x|,|y| < 0,85)', kontaktIn, kontaktFaelle, kontaktFaelle, `/${kontaktFaelle}`, kontaktFaelle);
check('Kameras: alle Werte endlich', camOk, n, n, `/${n}`, n, 'Ball im Bild je Kamera: ' + Object.entries(inView).map(([k, [a, b]]) => `${k} ${Math.round(100 * a / b)} %`).join(', '));
check('Spielzustand unverändert (Hash davor = danach)', hashOk, n, n, `/${n}`, n);

process.exit(report('Fan-Edit der Tor-Wiederholung (n6)', rows, 'fanedit') ? 0 : 1);
