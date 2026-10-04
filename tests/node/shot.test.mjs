// Schuss (Nacht 2b): Ziel automatisch im Tor, Qualität q aus der Lage (monoton), Trefferquote aus guter Lage,
// schlechte Lage langsamer und zentraler, Ecke nach Tormann und Stick, Vollspann/Innenrist/Außenrist, Kurve um den
// Tormann. Aufruf: node tests/node/shot.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { planShot, Q_TABLE, speedFactor, aimFactor, noiseFactor } from '../../src/sim/shot.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
// Lage-Tabellen mit festen Koordinaten des DFB-Minispielfelds (Tor bei x = ±10): Nacht 2c läuft dieser Test auf
// ?feld=20x13 – die Qualität q hängt nur von der Lage zum Tor ab, nicht von der Feldgröße
const P = makeParams('feld=20x13');
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
// Spiel ohne Bots, Orange (Mannschaft 0) spielt aufs rechte Tor (x = +10); per = [Orange, Blau]
const mk = (per = [1, 0], seed = 1) => { const g = new Game(P, seed, { match: true, perTeam: per, human: 0, bots: false }); g.rules.phase = 'play'; return g; };
const setup = (g, x, z, face, { ahead = 0.35, side = 0, y = 0.11, vy = 0, speed = 0, sprint = false } = {}) => {
  const pl = g.players[0];
  pl.place(x, z, face);
  const fx = Math.cos(face), fz = Math.sin(face);
  g.ball.place(x + fx * ahead - fz * side, y, z + fz * ahead + fx * side);
  if (y > 0.12) { g.ball.contact = false; g.ball.v.set(0, vy, 0); }
  if (speed) { pl.vx = fx * speed; pl.vz = fz * speed; pl.speed = speed; }
  pl.sprinting = sprint;
  return pl;
};
const toGoal = (x, z) => Math.atan2(-z, 10 - x);
const aimOff = (p) => Math.hypot(p.aim[2], p.aim[1] - 1.0); // Abstand Zielpunkt ↔ Tormitte (z = 0, Höhe 1 m)

// ---------------- 1) Monotonie ----------------
// a) Tabelle je Merkmal: schlechter → Faktor nie größer; Kurven q → Tempo/Ecke nie größer, Streuung nie kleiner
{
  let bad = 0, n = 0;
  const mono = (f, xs) => { for (let i = 1; i < xs.length; i++) { n++; if (f(xs[i]) > f(xs[i - 1]) + 1e-12) bad++; } };
  const grid = (a, b, k = 60) => Array.from({ length: k }, (_, i) => a + (b - a) * i / (k - 1));
  mono(Q_TABLE.view, grid(0.6, 0.0));                         // Torwinkel kleiner
  mono(Q_TABLE.dist, grid(3, 25));                            // weiter weg
  mono(Q_TABLE.body, grid(0, 180));                           // Körper weiter weggedreht
  mono(Q_TABLE.ahead, grid(0.35, 1.2)); mono(Q_TABLE.ahead, grid(0.3, -0.4)); // Ball zu weit vorn / zu nah
  mono(Q_TABLE.side, grid(0, 0.8));                           // Ball seitlicher
  mono((v) => Q_TABLE.move(v, false), grid(0, 8));            // schneller
  mono((h) => Q_TABLE.bounce(h, 0), grid(0, 1)); mono((v) => Q_TABLE.bounce(0, v), grid(0, 5));
  mono(Q_TABLE.press, grid(3, 0.2));                          // Gegner näher
  const qs = grid(1, 0.02);
  mono(speedFactor, qs); mono(aimFactor, qs); mono((q) => -noiseFactor(q), qs);
  check('q-Tabelle und Kurven monoton (schlechter → nie besser, nie schneller, nie weiter außen)', bad, 0, 0, '×', 0, `${n} Paare`);
  const qBad = 0.15;
  check('Kurve: q 0,15 → Tempo-Faktor ≤ 0,6', speedFactor(qBad), 0, 0.6, '', null, `Ecke ${(aimFactor(qBad) * 100).toFixed(0)} %, Streuung ×${noiseFactor(qBad).toFixed(1)}`);
}
// b) im Spiel: je Zufallslage eine schlechtere Variante (ein Merkmal schlechter) → q, Tempo, Zielabstand nie größer
{
  const R = new Rng(5);
  let pairs = 0, bad = 0; const why = {};
  for (let k = 0; k < 300; k++) {
    const x = R.range(-4, 6), z = R.range(-4, 4), f = toGoal(x, z) + R.range(-0.6, 0.6), pw = R.range(0.3, 1);
    const base = { ahead: R.range(0.2, 0.5), side: R.range(-0.1, 0.1) };
    // Blau: ein Tormann außerhalb seines Torraums (zählt nicht für die Eckenwahl) und ein Gegenspieler für den Druck
    const plan = (mod) => { const g = mk([1, 2], 7); const [, kp, o] = g.players; kp.place(9.9, 6.2, Math.PI); o.place(-9, -6, 0);
      const m = { x, z, f, o: { ...base }, opp: null, ...mod };
      const pl = setup(g, m.x, m.z, m.f, m.o); if (m.opp) o.place(g.ball.p.x + m.opp, g.ball.p.z, Math.PI);
      if (m.turn) { // Spieler dreht sich um den liegenden Ball: Ball zum Fuß gleich, nur die Körperausrichtung ändert sich
        const bx = g.ball.p.x, bz = g.ball.p.z, c = Math.cos(m.turn), s2 = Math.sin(m.turn);
        pl.place(bx - (c * base.ahead - s2 * base.side), bz - (s2 * base.ahead + c * base.side), m.turn);
      }
      g.rules.updateKeepers(0, true); return planShot(g, pl, { mode: 'std', power: pw }); };
    const b0 = plan({});
    const D0 = Math.hypot(10 - x, z), far = { x: 10 - (10 - x) * (1 + 2 / D0), z: z * (1 + 2 / D0) };
    const variants = {
      weiter: { ...far, f: toGoal(far.x, far.z) + (f - toGoal(x, z)) }, gedreht: { turn: f + (f > toGoal(x, z) ? 0.5 : -0.5) }, Druck: { opp: 0.7 }, Sprint: { o: { ...base, speed: 7, sprint: true } },
      'Ball weit': { o: { ...base, ahead: 0.85 } }, springt: { o: { ...base, y: 0.4, vy: -2 } },
    };
    for (const [nm, mod] of Object.entries(variants)) {
      const b1 = plan(mod); pairs++;
      if (b1.q > b0.q + 1e-9 || b1.speed > b0.speed + 1e-6 || Math.abs(b1.aim[2]) > Math.abs(b0.aim[2]) + 1e-6 || Math.abs(b1.aim[1] - 0.6) > Math.abs(b0.aim[1] - 0.6) + 1e-6) { bad++; why[nm] = (why[nm] || 0) + 1; }
    }
  }
  check('Im Spiel: schlechtere Lage → nie höheres q, schnellerer oder weiter außen gezielter Schuss', bad, 0, 0, '×', 0, `${pairs} Paare (2 m weiter weg auf der Linie zur Tormitte, 0,5 rad weiter weggedreht, Gegner 0,7 m, Sprint, Ball 0,85 m vorn, Ball springt)${bad ? ' ' + JSON.stringify(why) : ''}`);
}

// ---------------- 2) Trefferquote aus guter Lage (echte Geste, echte Physik, ohne Tormann) ----------------
function play(g, seq, stick = null, T = 3) {
  const pl = g.players[0];
  let kick = null, goal = false;
  for (let i = 0; i < T / DT; i++) {
    const t = i * DT;
    const ev = g.step([H({ shotDown: seq.some(([a, b]) => t >= a && t < b), ...(stick && t < 0.3 ? { mx: stick[0] * 0.14, mz: stick[1] * 0.14 } : {}) })]);
    for (const e of ev) { if (e.type === 'kick' && !kick) kick = pl.lastKick; if (e.type === 'goal') goal = true; }
    if (goal) break;
  }
  return { kick, goal };
}
{
  const R = new Rng(11);
  const res = { std: [0, 0], var: [0, 0] }, qs = [];
  for (let k = 0; k < 300; k++) {
    const g = mk([1, 0], 300 + k);
    const x = R.range(0, 4), z = R.range(-2, 2), f = toGoal(x, z) + R.range(-0.35, 0.35);
    setup(g, x, z, f, { ahead: R.range(0.25, 0.45), side: R.range(-0.06, 0.06), speed: R.range(0, 3) });
    const mode = k % 2 ? 'var' : 'std', hold = R.range(0.4, 1.0);
    const seq = mode === 'var' ? [[0, 0.07], [0.17, 0.17 + hold]] : [[0, hold]];
    const r = play(g, seq);
    res[mode][0]++; if (r.goal) res[mode][1]++;
    if (r.kick) qs.push(r.kick.q);
  }
  const all = (res.std[1] + res.var[1]) / (res.std[0] + res.var[0]) * 100;
  qs.sort((a, b) => a - b);
  check('Trefferquote aufs Tor aus guter Lage (6–10 m, ±2 m, zum Tor gedreht, Ball am Fuß)', all, 85, 100, '%', 85,
    `Vollspann ${res.std[1]}/${res.std[0]}, angeschnitten ${res.var[1]}/${res.var[0]}; q Median ${qs[qs.length >> 1].toFixed(2)}`);
}

// ---------------- 3) Schlechte Lage: langsamer (≤ 60 %) und zentraler (≤ 0,6 m von der Mitte) ----------------
{
  const good = (() => { const g = mk([1, 0]); const pl = setup(g, 2, 0, 0); return planShot(g, pl, { mode: 'std', power: 1 }); })();
  const bads = [
    ['spitzer Winkel an der Grundlinie, Körper zur Bande, Sprint', (g) => setup(g, 9.0, 5.6, 0.2, { speed: 7, sprint: true })],
    ['17 m, Rücken zum Tor, Ball zu weit vorn', (g) => setup(g, -7, 1, Math.PI, { ahead: 0.8 })],
    ['12 m, Gegner 0,5 m dran, Ball springt, quer zum Tor, Sprint', (g) => { const pl = setup(g, -2, 3, Math.PI / 2 + 0.2, { y: 0.45, vy: -2.5, speed: 7, sprint: true }); g.players[1].place(g.ball.p.x + 0.5, g.ball.p.z, 0); return pl; }],
  ];
  for (const [nm, f] of bads) {
    const g = mk([1, 1]); g.players[1].place(-9, -6, 0);
    const pl = f(g);
    const p = planShot(g, pl, { mode: 'std', power: 1 });
    check(`Schlechte Lage (${nm}): Tempo ≤ 60 % der guten Lage`, p.speed / good.speed * 100, 0, 60, '%', null, `q ${p.q.toFixed(2)}, ${p.speed.toFixed(1)} von ${good.speed.toFixed(1)} m/s`);
    check(`Schlechte Lage (${nm}): Ziel ≤ 0,6 m von der Tormitte`, aimOff(p), 0, 0.6, 'm', null, `Ziel z ${p.aim[2].toFixed(2)} m, Höhe ${p.aim[1].toFixed(2)} m (gute Lage: z ${good.aim[2].toFixed(2)})`);
  }
  check('Gute Lage (8 m frontal, voll): q und Tempo', good.q, 0.95, 1, '', 1, `${good.speed.toFixed(1)} m/s, Ecke z ${good.aim[2].toFixed(2)}, Höhe ${good.aim[1].toFixed(2)}`);
}

// ---------------- 4) Ecke: am Tormann vorbei, Stick gibt die Ecke vor ----------------
{
  const g = mk([1, 1], 3);
  const [pl, k] = g.players;
  setup(g, 3, 0, 0);
  k.place(9.1, 0.8, Math.PI); g.rules.updateKeepers(0, true);
  const p1 = planShot(g, pl, { mode: 'std', power: 0.8 });
  k.place(9.1, -0.8, Math.PI);
  const p2 = planShot(g, pl, { mode: 'std', power: 0.8 });
  check('Tormann rechts (z +0,8) → Ecke links', p1.corner.z < 0 ? 1 : 0, 1, 1, '', 1, `Ecke z ${p1.corner.z}`);
  check('Tormann links (z −0,8) → Ecke rechts', p2.corner.z > 0 ? 1 : 0, 1, 1, '', 1, `Ecke z ${p2.corner.z}`);
  k.place(6.5, 0, Math.PI);
  const p3 = planShot(g, pl, { mode: 'std', power: 0.8 });
  check('Tormann weit vor dem Tor → hohe Ecke', p3.corner.high ? 1 : 0, 1, 1, '', 1);
  k.place(9.3, 0, Math.PI);
  const sl = planShot(g, pl, { mode: 'std', power: 0.8, stick: [0.2, -1] }), sr = planShot(g, pl, { mode: 'std', power: 0.8, stick: [0.2, 1] });
  const sh = planShot(g, pl, { mode: 'std', power: 0.8, stick: [1, -0.8] });
  check('Stick seitlich links → flache Ecke links', sl.corner.z < 0 && !sl.corner.high ? 1 : 0, 1, 1, '', 1);
  check('Stick seitlich rechts → flache Ecke rechts', sr.corner.z > 0 && !sr.corner.high ? 1 : 0, 1, 1, '', 1);
  check('Stick schräg nach vorn links → hohe Ecke links', sh.corner.z < 0 && sh.corner.high ? 1 : 0, 1, 1, '', 1);
}

// ---------------- 5) Vollspann / angeschnitten: Drall, Tempo, Kurve um den Tormann ----------------
{
  const g = mk([1, 0], 8);
  const pl = setup(g, 3, -3, toGoal(3, -3));
  const vs = planShot(g, pl, { mode: 'std', power: 1 }), cu = planShot(g, pl, { mode: 'var', power: 1 });
  check('Vollspann: kaum Drall (Flatterball) und höchstes Tempo', Math.abs(vs.side) / 6.283, 0, 0.3, 'U/s', 0, `${vs.speed.toFixed(1)} m/s`);
  // Nacht 2c feste Banane: fast so hart wie Vollspann, Drall wächst mit dem Tempo (bis spinMax × bananeSpinMax)
  // Nacht 2d: Drall wächst mit der Wucht mit (× wucht^wuchtDrall, gleiche Kurve trotz kürzerer Flugzeit)
  check('Angeschnitten (feste Banane): Drall bis spinMax × bananeSpinMax × wucht', Math.abs(cu.side) / 6.283, 5, P.spinMax * P.bananeSpinMax * Math.pow(P.wucht, P.wuchtDrall) + 0.01, 'U/s', null, `${cu.tech}, ${cu.speed.toFixed(1)} m/s (${(cu.speed / vs.speed * 100).toFixed(0)} % von Vollspann)`);
  check('Angeschnitten (feste Banane): mindestens 95 % des Vollspann-Tempos', cu.speed / vs.speed, 0.95, 1.0, '', 0.97);
  const g0 = new Game(makeParams('banane=0&feld=20x13'), 8, { match: true, perTeam: [1, 0], human: 0, bots: false }); g0.rules.phase = 'play';
  const p0 = setup(g0, 3, -3, toGoal(3, -3));
  const vs0 = planShot(g0, p0, { mode: 'std', power: 1 }), cu0 = planShot(g0, p0, { mode: 'var', power: 1 });
  check('?banane=0: angeschnitten langsamer wie Nacht 2b, Drall bis spinMax', cu0.speed / vs0.speed, 0.75, 0.95, '', 0.85, `${(Math.abs(cu0.side) / 6.283).toFixed(1)} U/s`);
  // Kurve um den Tormann: Abflug zeigt außen am langen Pfosten vorbei, der Ball dreht ins Tor
  const B = cu.from, dAim = Math.atan2(cu.aim[2] - B[2], cu.aim[0] - B[0]), dLaunch = Math.atan2(cu.dir[1], cu.dir[0]);
  let outward = (dLaunch - dAim) * Math.sign(cu.aim[2]);
  check('Kurve: Abflug zeigt außen am Zielpfosten vorbei', outward * 180 / Math.PI, 1.5, 25, '°', null, `Ziel z ${cu.aim[2].toFixed(2)}, Drall ${(cu.side / 6.283).toFixed(1)} U/s`);
  // im Spiel ausführen (20 Seeds): Ball dreht ins Tor
  let goals = 0, lk = null;
  for (let sd = 0; sd < 20; sd++) { const g2 = mk([1, 0], 8 + sd); setup(g2, 3, -3, toGoal(3, -3)); const r = play(g2, [[0, 0.07], [0.17, 1.2]]); if (r.goal) goals++; lk = r.kick || lk; }
  check('Kurvenschuss im Spiel (Tipp + halten, 20 Seeds): Tore', goals, 17, 20, '/20', 20, lk ? `${lk.tech}, ${lk.speed.toFixed(1)} m/s, ${lk.sideRps.toFixed(1)} U/s` : '');
  // Außenrist: weniger Drall, mehr Streuung als Innenrist
  const g3 = mk([1, 0], 8); const p3 = setup(g3, 3, 3, toGoal(3, 3), { side: 0.12 });
  const au = planShot(g3, p3, { mode: 'var', power: 1 });
  check('Außenrist: weniger Drall als Innenrist', Math.abs(au.side) / Math.abs(cu.side), 0.6, 0.9, '', P.aussenSpin, `${au.tech}, Streuung ${au.noiseDeg.toFixed(1)}° vs. ${cu.noiseDeg.toFixed(1)}°`);
}
// ---------------- 6) Nie ins Nirgendwo: aus jeder Lage zielt der Schuss ins Tor ----------------
{
  const R = new Rng(3);
  let bad = 0, n = 0, solved = 0;
  for (let k = 0; k < 200; k++) {
    const g = mk([1, 0], k);
    const x = R.range(-9, 9), z = R.range(-6, 6), f = R.range(-Math.PI, Math.PI);
    const pl = setup(g, x, z, f);
    const p = planShot(g, pl, { mode: k % 2 ? 'var' : 'std', power: R.next() });
    n++;
    const inGoal = Math.abs(p.aim[2]) <= g.cage.gw - P.ballR && p.aim[1] <= g.cage.gH - P.ballR && p.aim[0] === g.cage.hx;
    // Abflugrichtung: Gerade trifft die Torlinie höchstens 1,5 m neben dem Pfosten (Kurve holt den Rest)
    const k2 = (g.cage.hx - p.from[0]) / (p.dir[0] || 1e-9), zl = p.from[2] + p.dir[1] * k2;
    // gelöste Flugbahn: fliegt durch den Zielpunkt im Tor; sonst (Roller) Abflug direkt aufs Ziel
    if (!inGoal || p.dir[0] <= 0 || (!p.ok && Math.abs(zl) > g.cage.gw)) { bad++; if (process.env.DEBUG) console.log('Richtung', x.toFixed(2), z.toFixed(2), p.tech, p.dir, p.ok, zl); }
    if (p.ok) solved++;
  }
  check('Aus jeder Lage (200 Zufallslagen, jede Blickrichtung): Ziel im Tor, Abflug Richtung Tor', n - bad, n, n, `/${n}`, n, `${solved}× Flugbahn (inkl. Kurve) durch den Zielpunkt gelöst, sonst Roller direkt aufs Ziel`);
}

process.exit(report('Schuss: Ziel automatisch, Qualität q, Techniken', rows, 'shot') ? 0 : 1);
