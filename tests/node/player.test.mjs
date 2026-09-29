// Platzhalter-Spieler: Laufwerte, Wendekreis, Ballführung ohne Klebeball, Hilfe gibt deutliche Eingaben
// sofort frei, Pass und Schuss. Aufruf: node tests/node/player.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { report } from './report.mjs';
import { cut, TARGETS } from './agility.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams({});
const inp = (o = {}) => ({ mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, ...o });

// 1) Antritt und Höchsttempo (ohne Ball)
{
  const g = new Game(P, 1); const pl = g.players[0];
  g.ball.place(0, 0.11, 6); // Ball aus dem Weg
  pl.place(-9, -5, 0);
  let t7 = -1, vmax = 0;
  for (let i = 0; i < 5 / DT; i++) {
    g.step([inp({ mx: 1, sprint: true })]);
    // Bande nicht erreichen: zurücksetzen, Tempo behalten
    if (pl.x > 8) pl.x -= 16;
    if (t7 < 0 && pl.speed >= 7) t7 = g.t;
    vmax = Math.max(vmax, pl.speed);
  }
  check('Antritt 0 → 7 m/s', t7, 2.2, 2.8, 's', 2.5);
  check('Höchsttempo Sprint', vmax, 7.4, 7.55, 'm/s', 7.5);
  const g2 = new Game(P, 1); const p2 = g2.players[0]; g2.ball.place(0, 0.11, 6); p2.place(-9, -5, 0);
  let v2 = 0; for (let i = 0; i < 3 / DT; i++) { g2.step([inp({ mx: 1 })]); v2 = Math.max(v2, p2.speed); }
  check('Lauftempo ohne Sprint', v2, 5.0, 5.3, 'm/s', 5.2);
}
// 2) Kurve tempoabhängig: Stick 15° neben der Laufrichtung (unter der Kurven-Grenze) → r = v²/aLat
function turnRadius(v, sprint) {
  const g = new Game(makeParams('?feld=60x40'), 1); const pl = g.players[0];
  g.ball.place(25, 0.11, 18);
  pl.place(0, 0, 0); pl.speed = v; pl.vx = v;
  const pts = [];
  for (let i = 0; i < 1.2 / DT; i++) {
    const a = Math.atan2(pl.hz, pl.hx) + 15 * Math.PI / 180;
    const m = v / (sprint ? P.vSprint : P.vRun);
    g.step([inp({ mx: Math.cos(a) * m, mz: Math.sin(a) * m, sprint })]);
    pts.push([pl.x, pl.z, pl.speed]);
  }
  const n = pts.length;
  const [x0, z0] = pts[n - 30], [x1, z1] = pts[n - 15], [x2, z2] = pts[n - 1];
  const a0 = Math.atan2(z1 - z0, x1 - x0), a1 = Math.atan2(z2 - z1, x2 - x1);
  let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const s = Math.hypot(x2 - x0, z2 - z0) / 2;
  return { r: s / Math.abs(da), v: pts[n - 1][2] };
}
{
  const r75 = turnRadius(7.5, true), r4 = turnRadius(4, false), r2 = turnRadius(2, false);
  check('Kurve: Radius bei 7,5 m/s (Tempo bleibt)', r75.r, 3.8, 4.9, 'm', 7.5 * 7.5 / P.aLat, `Tempo danach ${r75.v.toFixed(2)} m/s; Nacht 1: 9,4 m`);
  check('Kurve: Radius bei 4 m/s', r4.r, 1.0, 1.5, 'm', 16 / P.aLat, 'Nacht 1: 2,7 m');
  check('Kurve: Radius bei 2 m/s', r2.r, 0.2, 0.45, 'm', 4 / P.aLat, 'Nacht 1: 0,65 m');
}
// 2b) Richtungswechsel „zack“ (Nachtrag Peter 28.09.): Zieltabelle als Gate, gemessen wie seine Probe
{
  const PB = makeParams('?feld=60x40');
  for (const T of TARGETS) {
    const r = cut(PB, T.v0, T.sprint, T.ang);
    check(`${T.lbl} ${String(T.v0).replace('.', ',')} m/s, ${T.ang}°: Richtung erreicht`, r.tHead, 0, T.t, 's', T.t, `80 % Tempo in neuer Richtung nach ${r.tVel.toFixed(2)} s, Tiefpunkt ${r.minV.toFixed(1)} m/s`);
    check(`${T.lbl} ${String(T.v0).replace('.', ',')} m/s, ${T.ang}°: Überschießen`, r.drift, 0, T.drift, 'm', T.drift);
  }
  // Mit Ball etwas träger (Ballführung), aber nie „Auto“: höchstens 25 % über den Zielen, Ball kommt mit
  for (const T of TARGETS) {
    const v0 = T.v0 * P.dribbleSlow;
    let tH = 0, dr = 0, carried = 0; const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const r = cut(PB, v0, T.sprint, T.ang, { withBall: true, seed });
      tH = Math.max(tH, r.tHead); dr = Math.max(dr, r.drift);
      if (r.ballAhead > -0.3 && r.ballSide < 1.2 && r.ballClosest < 1.5) carried++;
    }
    const nm = `${T.lbl} mit Ball, ${T.ang}°`;
    check(`${nm}: Richtung erreicht (schlechtester von ${N})`, tH, 0, T.t * 1.25, 's', T.t, 'mit Ball ≤ 125 % des Ziels');
    check(`${nm}: Überschießen (schlechtester von ${N})`, dr, 0, T.drift * 1.25, 'm', T.drift);
    check(`${nm}: Ball mitgenommen (Sohle/Außenseite)`, carried, 18, N, `/${N}`, N, 'Ball danach vorn in neuer Richtung, ≤ 1,5 m am Fuß');
  }
  // Eingabe ohne Verzögerung: Reaktion (0,3 m/s quer zur alten Richtung) innerhalb von 50 ms
  {
    const g = new Game(PB, 1); const pl = g.players[0];
    g.ball.place(25, 0.11, 18); pl.place(0, 0, 0); pl.speed = 5.2; pl.vx = 5.2;
    let tR = -1;
    for (let i = 0; i < 0.3 / DT && tR < 0; i++) { g.step([inp({ mz: 1 })]); if (pl.vz > 0.3) tR = g.t; }
    check('Reaktion auf den Stick (0,3 m/s in neuer Richtung)', tR, 0, 0.05, 's', DT, 'keine Glättung am Stick');
  }
  // Antritt spritziger: 0 → 4 m/s
  {
    const g = new Game(P, 1); const pl = g.players[0];
    g.ball.place(0, 0.11, 6); pl.place(-9, -5, 0);
    let t4 = -1;
    for (let i = 0; i < 2 / DT && t4 < 0; i++) { g.step([inp({ mx: 1, sprint: true })]); if (pl.speed >= 4) t4 = g.t; }
    check('Antritt 0 → 4 m/s (erste Schritte)', t4, 0.5, 0.7, 's', 0.6, 'Nacht 1: 0,70 s');
  }
  // A/B: ?zack=0 = altes Modell aus Nacht 1 (Peters Probe: Sprint 90° nach 1,75 s)
  {
    const P0 = makeParams('?feld=60x40&zack=0');
    const r = cut(P0, 7.5, true, 90);
    check('?zack=0 (altes Modell): Sprint 90° wie Nacht 1', r.tHead, 1.7, 1.8, 's', 1.75, `Überschießen ${r.drift.toFixed(1)} m (Nacht 1: 9,2 m)`);
  }
}
// 3) Ballführung: 6 s geradeaus laufen/sprinten – echte Kontakte, Ball nie „angeklebt“, bleibt nah
const PBIG = makeParams('?feld=60x40'); // langes Feld: eingeschwungener Zustand messen
function dribble(sprint, seconds = 6) {
  const g = new Game(PBIG, 7); const pl = g.players[0];
  const v0 = (sprint ? P.vSprint : P.vRun) * P.dribbleSlow;
  pl.place(-28, 0, 0); pl.speed = v0; pl.vx = v0; // schon in Fahrt
  g.ball.place(-28 + P.footAhead + 0.05, 0.11, 0); g.ball.v.set(v0, 0, 0); g.ball.w.set(0, 0, -v0 / 0.11);
  let touches = 0, maxD = 0, dists = [], lastTouchX = null, gaps = [];
  for (let i = 0; i < seconds / DT; i++) {
    const ev = g.step([inp({ mx: 1, sprint })]);
    for (const e of ev) if (e.type === 'touch') { touches++; if (lastTouchX != null) gaps.push(e.x - lastTouchX); lastTouchX = e.x; }
    const [fx, fz] = pl.footPoint();
    const d = Math.hypot(g.ball.p.x - fx, g.ball.p.z - fz);
    maxD = Math.max(maxD, d); dists.push(d);
    if (pl.x > 28) break;
  }
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const sd = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length);
  const gap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  return { touches, maxD, mean, sd, gap, speed: pl.speed, x: pl.x };
}
{
  const d = dribble(false);
  check('Führen (Laufen): Ballkontakte', d.touches, 5, 60, '×', null, `Abstand Fuß–Ball Mittel ${d.mean.toFixed(2)} m, SD ${d.sd.toFixed(2)} m`);
  check('Führen (Laufen): Ball entfernt sich zwischen Kontakten (kein Klebeball)', d.maxD, 0.45, 3.0, 'm', null, 'max. Abstand Fuß–Ball');
  check('Führen (Laufen): Tempo mit Ball', d.speed, 4.0, 5.3, 'm/s', null, `Vorlage ${d.gap.toFixed(2)} m je Kontakt`);
  const s = dribble(true);
  check('Führen (Sprint): längere Vorlagen als im Laufen', s.gap / Math.max(d.gap, 0.01), 1.3, 10, '×', null, `Sprint ${s.gap.toFixed(2)} m vs. ${d.gap.toFixed(2)} m je Kontakt, ${s.touches} Kontakte`);
  check('Führen (Sprint): Tempo mit Ball', s.speed, 5.8, 7.5, 'm/s', null);
}
// 4) Hilfe gibt eine deutliche Eingabe sofort frei (≤ 0,3 s): beim Führen Stick um 90° drehen
{
  const g = new Game(P, 11); const pl = g.players[0];
  pl.place(-8, 0, 0); g.ball.place(-8 + P.footAhead + 0.1, 0.11, 0);
  for (let i = 0; i < 1.5 / DT; i++) g.step([inp({ mx: 1 })]);
  // Ball liegt gerade vorgelegt 1,5 m voraus (nicht erreichbar) → nur die Hilfe entscheidet
  g.ball.p.x = pl.x + 1.5 + P.footAhead; g.ball.p.z = pl.z; g.ball.v.set(pl.vx + 0.3, 0, 0);
  const w0 = pl.assistW;
  let tRel = -1;
  for (let i = 0; i < 1.0 / DT; i++) {
    g.step([inp({ mz: 1 })]);
    if (tRel < 0 && pl.assistW < 0.05 * Math.max(w0, 1e-6)) tRel = (i + 1) * DT;
  }
  check('Hilfe vor dem Richtungswechsel aktiv', w0, 0.5, 1, '', null);
  check('Hilfe frei nach deutlicher Eingabe (< 5 %)', tRel, 0, 0.3, 's', null, 'Stick 90° gedreht');
  // Loslassen: sanft zurück (nicht schlagartig)
  const g2 = new Game(P, 12); const p2 = g2.players[0];
  p2.place(-8, 0, 0); g2.ball.place(-8 + P.footAhead + 0.1, 0.11, 0);
  let tBack = -1;
  for (let i = 0; i < 2 / DT; i++) { g2.step([inp({ mx: 1 })]); if (tBack < 0 && p2.assistW > 0.6) tBack = (i + 1) * DT; }
  check('Hilfe kehrt sanft zurück (bis 60 %)', tBack, 0.3, 1.5, 's', null);
}
// 5) Pass und Schuss
{
  const kickTest = (setup) => {
    const g = new Game(P, 21); const pl = g.players[0];
    pl.place(-3, 0, 0); g.ball.place(-3 + P.footAhead, 0.11, 0);
    let kick = null;
    for (let i = 0; i < 2 / DT && !kick; i++) {
      const ev = g.step([setup(i * DT)]);
      kick = ev.find((e) => e.type === 'kick') || null;
    }
    return { kick, lk: pl.lastKick, ball: g.ball };
  };
  const p = kickTest(() => inp({ pass: true }));
  check('Pass (Tippen): Ballgeschwindigkeit', p.kick ? p.kick.speed : 0, P.passSpeed * 0.9, P.passSpeed * 1.1, 'm/s', P.passSpeed);
  const s = kickTest((t) => (t < 1.1 ? inp({ shootHeld: true }) : inp({ shootRelease: true })));
  check('Schuss voll aufgeladen', s.kick ? s.kick.speed : 0, 29, 30.5, 'm/s', 30, s.lk ? `${(s.lk.speed * 3.6).toFixed(0)} km/h, Drall ${s.lk.spinRps.toFixed(2)} U/s` : '');
  check('Vollspann (Treffpunkt Mitte): kaum Drall → Flatterball', s.lk ? s.lk.spinRps : 9, 0, 0.3, 'U/s', 0);
  const h = kickTest((t) => (t < 0.5 ? inp({ shootHeld: true }) : inp({ shootRelease: true })));
  check('Schuss halb aufgeladen', h.kick ? h.kick.speed : 0, 16, 20, 'm/s', 18);
  const c = kickTest((t) => (t < 1.1 ? inp({ shootHeld: true, cx: 1 }) : inp({ shootRelease: true, cx: 1 })));
  check('Innenseite (Treffpunkt ganz rechts): Effet', c.lk ? c.lk.sideRps : 0, 9, 10.5, 'U/s', 10, c.lk ? `${c.lk.speed.toFixed(1)} m/s` : '');
  const ch = kickTest((t) => (t < 0.6 ? inp({ shootHeld: true, cy: -1 }) : inp({ shootRelease: true, cy: -1 })));
  check('Heber (Treffpunkt unten): Abflugwinkel', ch.lk ? ch.lk.elevDeg : 0, 18, 28, '°', 23);
}
// 5b) Aufladen im Lauf: Ball bleibt am Fuß, Schuss kommt beim Loslassen (20 Seeds, Laufen und Sprint)
{
  let n = 0, late = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = new Game(P, seed); const pl = g.players[0];
    pl.place(-6, 0, 0); g.ball.place(-5.6, 0.11, 0);
    for (let i = 0; i < 3 / DT; i++) {
      const t = i * DT, held = t < 0.8;
      const ev = g.step([inp({ mx: 1, sprint: seed % 2 === 0, shootHeld: held, shootRelease: !held && t < 0.8 + 1.5 * DT })]);
      if (ev.some((e) => e.type === 'kick' && e.kind === 'shot')) { n++; if (t > 0.9) late++; break; }
    }
  }
  check('Schuss nach Aufladen im Lauf ausgelöst', n, 20, 20, '/20', 20, `${late}× später als 0,1 s nach dem Loslassen`);
}
// 6) Determinismus des ganzen Spiels: gleiche Eingaben + Seed → gleicher Zustand
{
  const run = () => {
    const g = new Game(P, 99);
    for (let i = 0; i < 6 / DT; i++) {
      const t = i * DT;
      g.step([inp({ mx: Math.cos(t * 0.7), mz: Math.sin(t * 1.3), sprint: t > 2, shootHeld: t > 3 && t < 3.8, shootRelease: t >= 3.8 && t < 3.81, cx: 0.4 })]);
    }
    return JSON.stringify(g.snapshot());
  };
  check('Gleicher Seed + Eingaben → identischer Zustand', run() === run() ? 1 : 0, 1, 1, '', 1);
}

process.exit(report('Spieler (Laufwerte, Ballführung, Hilfe, Pass, Schuss)', rows) ? 0 : 1);
