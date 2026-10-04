// Tor-Wiederholung (Nacht 2d): Ringpuffer (Länge, Zustand je Takt), Kontakt-Takt (letztes Schuss-Ereignis des
// Torschützen vor dem Tor), Ablauf (Zeitlupe am Kontakt und in der Fan-Cam, ≤ 7 s), Überspringen, und vor allem: die
// Wiederholung ändert den Spielzustand nicht (Hash davor = danach, das Spiel läuft danach genauso weiter wie ohne).
// Aufruf: node tests/node/replay.test.mjs
import { createHash } from 'node:crypto';
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { ReplayRecorder, ReplayDirector, findContact, replayCamera, REC_SECS, REC_HZ } from '../../src/sim/replay.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');
const hash = (g) => createHash('sha1').update(JSON.stringify({ s: g.snapshot(), rng: g.rng.s ?? g.rng.state ?? null, ev: g.events.length, tick: g.tick })).digest('hex').slice(0, 12);

// Spiel bis zum n-ten Tor, Aufzeichnung jeden Takt; gibt Spiel, Recorder, Tor (mit Zeit) und den Zustand eines Takts
function untilGoal(seed, nth = 1) {
  const g = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] });
  const rec = new ReplayRecorder(g.players.length);
  let goal = null, k = 0, probe = null;
  while (!goal && g.t < 600) {
    const ev = g.step([]);
    rec.record(g, ev);
    if (g.tick === 1500) probe = { t: g.t, p: g.players.map((p) => [p.x, p.z, p.face]), b: [g.ball.p.x, g.ball.p.y, g.ball.p.z] };
    for (const e of ev) if (e.type === 'goal' && ++k === nth) goal = { ...e, t: g.t - DT };
  }
  // wie im Spiel: 1 s Live-Jubel läuft weiter in die Aufzeichnung, dann startet die Wiederholung
  for (let i = 0; i < 1 / DT && goal; i++) rec.record(g, g.step([]));
  return { g, rec, goal, probe };
}

// 1) Ringpuffer
{
  const { g, rec, probe } = untilGoal(3, 3);
  check('Ringpuffer: Länge', (rec.tLast - rec.tFirst) + 1 / REC_HZ, REC_SECS - 0.01, REC_SECS + 0.01, 's', REC_SECS, `${rec.count} Takte à ${(rec.stride * 4 / 1024).toFixed(2)} KB, gesamt ${(rec.buf.byteLength / 1024).toFixed(0)} KB; Spielzeit bis zum Tor ${g.t.toFixed(1)} s`);
  check('Ringpuffer: älteste Ereignisse fallen heraus', rec.events.length ? rec.tLast - rec.events[0].t : 0, 0, REC_SECS + 0.01, 's', null, `${rec.events.length} Ereignisse im Puffer`);
  void probe;
}
// 2) Zustand je Takt: frameAt(t) = Simulation zu diesem Takt
{
  const g = new Game(P, 5, { match: true, human: -1, botLevels: [2, 2] });
  const rec = new ReplayRecorder(g.players.length);
  let snap = null;
  for (let i = 0; i < 6 / DT; i++) { const ev = g.step([]); rec.record(g, ev); if (i === 400) snap = { t: g.t, p: g.players.map((p) => ({ x: p.x, z: p.z, face: p.face, hand: p.hand.mode, air: p.air ? p.air.tech : '' })), b: { ...g.ball.p } }; }
  const f = rec.frameAt(snap.t, {}, P);
  let err = Math.hypot(f.ball.p.x - snap.b.x, f.ball.p.y - snap.b.y, f.ball.p.z - snap.b.z);
  for (let k = 0; k < snap.p.length; k++) err = Math.max(err, Math.hypot(f.players[k].x - snap.p[k].x, f.players[k].z - snap.p[k].z));
  check('Aufzeichnung: Positionen zum Takt wie in der Simulation', err, 0, 1e-4, 'm', 0, 'Float32');
}
// 3) Kontakt-Takt, Ablauf, Kameras, Spielzustand unverändert – über mehrere Tore
{
  let n = 0, contactOk = 0, byScorer = 0, posErrMax = 0, realMax = 0, slowOk = 0, hashOk = 0, contOk = 0, camOk = 0;
  const techs = {};
  for (const seed of [3, 7, 11, 19, 23, 31]) {
    const { g, rec, goal } = untilGoal(seed);
    if (!goal) continue;
    n++;
    const h0 = hash(g);
    const D = new ReplayDirector(rec, goal);
    const c = D.contact;
    if (c && c.t <= goal.t && c.t >= goal.t - 5) contactOk++;
    if (c && goal.scorer >= 0 && c.player === goal.scorer) byScorer++;
    if (c) {
      techs[c.tech || c.type] = (techs[c.tech || c.type] || 0) + 1;
      const f = rec.frameAt(c.t, {}, P);
      posErrMax = Math.max(posErrMax, Math.hypot(f.ball.p.x - c.x, f.ball.p.z - c.z));
    }
    realMax = Math.max(realMax, D.realTotal);
    const kon = D.segs.find((s) => s.name === 'kontakt'), fan = D.segs.find((s) => s.name === 'fancam');
    if (kon && fan && kon.rate <= 0.25 && fan.rate <= 0.4 && fan.t0 <= goal.t && fan.t1 >= goal.t) slowOk++;
    // komplett abspielen wie die Grafik: je Bild Zustand + Kamera
    const out = {};
    let camFin = true, frames = 0;
    while (!D.done && frames < 2000) {
      const t = D.update(1 / 60);
      const f = rec.frameAt(t, out, P);
      const cam = replayCamera(D.cur.cam, f, { cage: g.cage, mode: frames % 2 ? 'hoch' : 'quer', contact: c, goal: { side: goal.side }, time: D.real, frac: D.segFrac(), side: 1 });
      if (![...cam.pos, ...cam.look, cam.fov].every(Number.isFinite)) camFin = false;
      frames++;
    }
    if (camFin) camOk++;
    if (hash(g) === h0) hashOk++;
    // danach läuft das Spiel genauso weiter wie ein Zwilling ohne Wiederholung
    const twin = untilGoal(seed).g;
    for (let i = 0; i < 4 / DT; i++) { g.step([]); twin.step([]); }
    if (hash(g) === hash(twin)) contOk++;
  }
  check('Tore untersucht', n, 5, 99, '', null);
  check('Kontakt-Takt gefunden (≤ 5 s vor dem Tor)', contactOk, n, n, `/${n}`, n, Object.entries(techs).map(([k, v]) => `${k} ${v}`).join(', '));
  check('… vom Torschützen', byScorer, n - 1, n, `/${n}`, n, 'Eigentor: letzter Kontakt überhaupt');
  check('… Ball beim Kontakt dort, wo das Ereignis war', posErrMax, 0, 0.05, 'm', 0);
  check('Ablauf: Zeitlupe am Kontakt (≤ 0,25 ×) und in der Fan-Cam über die Torlinie', slowOk, n, n, `/${n}`, n);
  check('Ablauf: Wiederholung höchstens 7 s (mit 1 s Live-Jubel ≤ 8 s)', realMax, 3, 7.01, 's', 7);
  check('Kameras: alle Werte endlich, hoch und quer', camOk, n, n, `/${n}`, n);
  check('Spielzustand nach der Wiederholung unverändert (Hash davor = danach)', hashOk, n, n, `/${n}`, n);
  check('… und das Spiel läuft danach genauso weiter wie ohne Wiederholung', contOk, n, n, `/${n}`, n);
}
// 4) Überspringen
{
  const { rec, goal } = untilGoal(3);
  const D = new ReplayDirector(rec, goal);
  D.update(0.5); const ph = D.phase; D.skip();
  check('Überspringen: sofort zu Ende', D.done && D.phase === 'ende' && D.skipped ? 1 : 0, 1, 1, '', 1, `vorher Abschnitt „${ph}“`);
  const c = findContact(rec, { ...goal, scorer: -1 });
  check('Eigentor (kein Schütze): letzter Kontakt vor dem Tor', c && c.t <= goal.t ? 1 : 0, 1, 1, '', 1);
}

process.exit(report('Tor-Wiederholung (Nacht 2d)', rows, 'replay') ? 0 : 1);
