// n13 (Peter 07.11.2026): Gummiwände ohne Dach, Spielgefühl (Replay-Zoom, Fan-Cam/Action aus, Magnet, Schwerkraft),
// Zufallsteams + Tiernamen. Aufruf: node tests/node/n13.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { Rng } from '../../src/sim/rng.js';
import { report } from './report.mjs';
import { replayCamera } from '../../src/sim/replay.js';
import { editCamera } from '../../src/sim/fanedit.js';
import { runProbe as botProbe, summary as botSummary } from './n7_probe.mjs';
import { runProbe as luftProbe, summary as luftSummary } from './n11_probe.mjs';
import { parcours } from './dribble_probe.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };

function flug(P, from, v, w = [0, 0, 0], T = 6, seed = 1) {
  const g = new Game(P, seed);
  g.players.length = 0; // nur der Ball
  const b = g.ball;
  b.place(from[0], from[1], from[2]); b.contact = false;
  b.v.set(...v); b.w.set(...w); b.reseedKnuckle(g.rng);
  const ev = [];
  let out = false, maxY = 0;
  for (let i = 0; i < T / DT; i++) {
    for (const e of g.step()) ev.push({ ...e });
    maxY = Math.max(maxY, b.p.y);
    if (g.state === 'out') { out = true; break; }
    if (g.state !== 'play') break;
  }
  return { g, b, ev, out, maxY };
}

// ---------- 1) Gummiwände (Nachtrag 07.11. abends) ----------
{
  const P1 = makeParams(''), P0 = makeParams('gummi=0');
  check('Gummi: Standard an, ohne Dach', P1.gummi && !P1.roof ? 1 : 0, 1, 1, '', 1);
  // 600 Zufallsbälle: irgendwo im Feld, schräg nach oben, 12–40 m/s, mit Effet (wie Abwürfe/Abschläge/Befreiungen)
  const rng = new Rng(13);
  let out1 = 0, out0 = 0, gummi = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const x = (rng.next() * 2 - 1) * 10, z = (rng.next() * 2 - 1) * 6, a = rng.next() * 2 * Math.PI;
    const el = (15 + rng.next() * 60) * Math.PI / 180, sp = 12 + rng.next() * 28;
    const v = [Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp];
    const w = [(rng.next() - 0.5) * 60, (rng.next() - 0.5) * 80, (rng.next() - 0.5) * 60];
    const s1 = flug(P1, [x, 0.5, z], v, w, 5, i), s0 = flug(P0, [x, 0.5, z], v, w, 5, i);
    if (s1.out) out1++;
    if (s0.out) out0++;
    gummi += s1.ev.filter((e) => e.type === 'gummi').length;
  }
  check('Gummi: Zufallsbälle raus (mit Gummiwänden)', out1, 0, 0, `von ${N}`, 0, `ohne Gummi ${out0}, Gummi-Abpraller ${gummi}`);
  check('Gummi: ohne (?gummi=0) gehen Bälle raus wie cac623e', out0, 50, N, `von ${N}`, null);
  // Decke: senkrecht nach oben, 22 m/s → steigt ohne Luft ~24 m, trifft die Decke bei 12 m und kommt elastisch zurück
  {
    const g = new Game(P1, 3); g.players.length = 0; const b = g.ball;
    b.place(0, 0.5, 0); b.contact = false; b.v.set(0, 22, 0); b.w.set(0, 0, 0);
    let vin = 0, vout = 0, maxY = 0;
    for (let i = 0; i < 4 / DT; i++) { const vy = b.v.y; g.step(); maxY = Math.max(maxY, b.p.y); if (vy > 0 && b.v.y < 0 && b.p.y > 11) { vin = vy; vout = -b.v.y; break; } }
    check('Gummi: Decke bei 12 m', maxY, 11.7, 12.0, 'm', 12);
    check('Gummi: Decke elastisch (Stoßzahl)', vin ? vout / vin : 0, 0.6, 0.7, '', 0.65, `${vin.toFixed(1)} → ${vout.toFixed(1)} m/s`);
  }
  // Seitenwand über dem Netz: 20 m/s schräg aufwärts, Effet um die Hochachse bleibt teilweise
  {
    const g = new Game(P1, 4); g.players.length = 0; const b = g.ball;
    b.place(0, 4, P1.fieldW / 2 - 1); b.contact = false; b.v.set(4, 3, 20); b.w.set(0, 60, 0);
    let vin = 0, vout = 0, w0 = 60, w1 = 0;
    for (let i = 0; i < 1 / DT; i++) { const vz = b.v.z; g.step(); if (vz > 0 && b.v.z < 0) { vin = vz; vout = -b.v.z; w1 = b.w.y; break; } }
    check('Gummi: Seitenwand elastisch (Stoßzahl)', vin ? vout / vin : 0, 0.6, 0.7, '', 0.65);
    check('Gummi: Effet bleibt teilweise', w1 / w0, 0.4, 1.0, '', null, `${w0} → ${w1.toFixed(1)} rad/s`);
  }
  // Mit Dach (?dach=1) keine Gummiwände (Dachnetz wie bisher)
  check('Gummi: mit Dach keine Gummiwände', new Game(makeParams('dach=1'), 1).cage.gummi ? 1 : 0, 0, 0, '', 0);
}

// ---------- 2) Replay-Zoom weiter weg, Fan-Cam/Action-Standard (Nachtrag 1, Punkte 1–3) ----------
{
  const P = makeParams('');
  check('Replay: replayweit Standard 2, Fan-Cam aus', P.replayweit === 2 && P.fancam === 0 ? 1 : 0, 1, 1, '', 1);
  const cage = new Game(P, 1).cage;
  const c = { t: 1, x: 3, y: 0.11, z: 1, dx: 1, dz: 0.2 };
  const f = { t: 1.05, ball: { p: { x: 3.6, y: 0.3, z: 1.1 }, v: { x: 20, y: 2, z: 4 } } };
  const dist = (cam) => Math.hypot(cam.pos[0] - cam.look[0], cam.pos[1] - cam.look[1], cam.pos[2] - cam.look[2]);
  for (const mode of ['quer', 'hoch']) {
    const ctx = { cage, mode, contact: c, goal: { side: 1 }, time: 0, frac: 0.5, side: 1 };
    const a = replayCamera('zoom', f, { ...ctx, weit: 1 }), b = replayCamera('zoom', f, { ...ctx, weit: 2 });
    check(`Replay-Zoom (${mode}): Abstand weit 2 ÷ 0.9.1`, dist(b) / dist(a), 1.5, 2.4, '×', 2, `${dist(a).toFixed(2)} → ${dist(b).toFixed(2)} m`);
    const e1 = editCamera('makro', f, { cage, hoch: mode === 'hoch', contact: c, goal: { side: 1 }, u: 0.2, dur: 1, side: 1, weit: 1 });
    const e2 = editCamera('makro', f, { cage, hoch: mode === 'hoch', contact: c, goal: { side: 1 }, u: 0.2, dur: 1, side: 1, weit: 2 });
    const dp = (e) => Math.hypot(e.pos[0] - c.x, e.pos[2] - c.z);
    check(`Fan-Edit-Makro (${mode}): Abstand zum Kontakt weit 2 ÷ 0.9.1`, dp(e2) / dp(e1), 1.7, 2.3, '×', 2, `${dp(e1).toFixed(2)} → ${dp(e2).toFixed(2)} m`);
  }
}

// ---------- 3) Ballmagnet stärker + Schwerkraft 8,8 (Nachtrag 1, Punkte 4–5), gemeinsam gemessen ----------
{
  const P = makeParams(''), P0 = makeParams('g=9.81&magnet=2.4&botSicher=-0.03');
  check('Schwerkraft: Standard 8,8 m/s², ?g=9.81 = 0.9.1', P.g === 8.8 && P0.g === 9.81 ? 1 : 0, 1, 1, '', 1);
  check('Magnet: ?magnet=2.4 = Abschirmen wie 0.9.1', P0.schirmNah === 0.9 && P0.schirmHand === 0 && P0.schirmVor === 0.6 ? 1 : 0, 1, 1, '', 1);
  // freier Fall aus 3 m ohne Luft-Einfluss nennenswert: Fallzeit ∝ 1/√g
  const fall = (Pq) => { const g = new Game(Pq, 1); const b = g.ball; b.place(0, 3, 0); b.contact = false; b.v.set(0, 0, 0); b.w.set(0, 0, 0); let t = 0; while (b.v.y <= 0 && t < 3) { b.step(DT, g.cage); t += DT; } return t; }; // bis zum ersten Aufsetzer
  check('Schwerkraft: Fallzeit aus 3 m ÷ 0.9.1', fall(P) / fall(P0), 1.03, 1.08, '×', Math.sqrt(9.81 / 8.8));
  const N = +(process.env.N13_N || 32);
  const a = botSummary(await botProbe('g=9.81&magnet=2.4&botSicher=-0.03', N, 'st2', 6)), n = botSummary(await botProbe('', N, 'st2', 6));
  const f2 = (x) => x.toFixed(2);
  check('Magnet: Ballverluste beim Führen je Spielminute ÷ 0.9.2', n.lossMin / a.lossMin, 0, 0.85, '×', 0.75, `${f2(a.lossMin)} → ${f2(n.lossMin)} (Zweikampf ${f2(a.duelMin)} → ${f2(n.duelMin)}), ${N} Bot-Spiele; gemessen mit 48 Spielen −21 %`);
  check('Magnet: Ballverluste je Minute Ball am Fuß ÷ 0.9.2', (n.lossMin / n.footSMin) / (a.lossMin / a.footSMin), 0, 0.8, '×', 0.67, `Ball am Fuß ${f2(a.footSMin)} → ${f2(n.footSMin)} s je Spielminute; gemessen −33 %`);
  check('Magnet: Grätschen mit Ballgewinn ÷ 0.9.2', n.tackleBallPerGame / a.tackleBallPerGame, 0.9, 9, '×', 1, `${a.tackleBallPerGame.toFixed(1)} → ${n.tackleBallPerGame.toFixed(1)} je Spiel`);
  check('Tore je Schuss: Unterschied zu 0.9.2', n.goalsPerShot - a.goalsPerShot, -4, 4, 'Punkte', 0, `${a.goalsPerShot.toFixed(1)} → ${n.goalsPerShot.toFixed(1)} %`);
  check('Bot-Spiele: Hänger/Numerik', n.stuck + n.faults, 0, 0, '×', 0);
  const pt = (q) => { const pc = parcours(q, [1, 2, 3, 4, 5, 6]); return { t: pc.reduce((s, x) => s + x.time, 0) / pc.length, lost: pc.reduce((s, x) => s + x.lost, 0) }; };
  const p0 = pt('g=9.81&magnet=2.4'), p1 = pt('');
  check('Slalom-Parcours (Skript): nicht langsamer', p1.t - p0.t, -9, 0.2, 's', 0, `${p0.t.toFixed(2)} → ${p1.t.toFixed(2)} s, verpasst ${p0.lost} → ${p1.lost}`);
  check('Slalom-Parcours: keine Ballverluste mehr als vorher', p1.lost - p0.lost, -9, 0, '×', 0);
  const la = luftSummary(await luftProbe('g=9.81&magnet=2.4&botSicher=-0.03', N, 6)), ln = luftSummary(await luftProbe('', N, 6));
  check('Hochpässe: beim Mitspieler in Volley-/Brust-/Kopfhöhe ÷ 0.9.2', ln.hochKoerper / la.hochKoerper, 0.9, 9, '×', 1, `${la.hochKoerper.toFixed(1)} → ${ln.hochKoerper.toFixed(1)} % der hohen Pässe (0,45–2,4 m beim Gemeinten)`);
  check('Bot-Pässe kommen an: Unterschied zu 0.9.2', ln.passAn - la.passAn, -3, 99, 'Punkte', null, `${la.passAn.toFixed(1)} → ${ln.passAn.toFixed(1)} %, abgefangen ${la.passAb.toFixed(1)} → ${ln.passAb.toFixed(1)} %, Pässe/Spiel ${la.passeSpiel.toFixed(1)} → ${ln.passeSpiel.toFixed(1)}`);
  check('Ball über der Gummi-Decke/außerhalb (Bilder)', ln.aus, 0, 0, '×', 0);
}

process.exit(report('n13 – Gummiwände, Spielgefühl, Zufallsteams', rows) ? 0 : 1);
