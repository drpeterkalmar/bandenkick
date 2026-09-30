// Pass (Nacht 2b): in den Laufweg (500 Zufallslagen flach + 500 hoch, über die echte Geste und die echte Physik),
// Empfänger im Kegel ±35°, Bandenpass, freier Raum, Stärke aus der Haltedauer. Aufruf: node tests/node/pass.test.mjs
// (PASS_N=100 für kurze Läufe)
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Ball } from '../../src/sim/ball.js';
import { Rng } from '../../src/sim/rng.js';
import { planPass } from '../../src/sim/pass.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams({});
const N = +(process.env.PASS_N || 500);
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const mk = (per = [2, 0], seed = 1) => { const g = new Game(P, seed, { match: true, perTeam: per, human: 0, bots: false }); g.rules.phase = 'play'; return g; };

// ---------------- 1) Pass in den Laufweg: Zufallslagen ----------------
// Passgeber mit Ball am Fuß, Empfänger 4–13 m entfernt, 80 % laufen (2–7 m/s, Laufweg 2,5 s im Feld), 20 % stehen.
// Geste: Einzeltipp (flach) bzw. Tipp + kurz halten (hoch), Stick grob zum Empfänger (±9°). Danach läuft der Empfänger
// ohne Stick mit der Empfänger-Hilfe. Erfolg: Empfänger nimmt den Ball an (Fuß, Brust, Oberschenkel), ohne dass er
// (wenn er lief) unter 1 m/s fällt. Fehlerabstand: Geister-Ball ohne Spieler ↔ Empfänger, der geradeaus weiterläuft.
function situation(R, k, chip) {
  const g = mk([2, 0], 1000 + k + (chip ? 5000 : 0));
  const [ps, rc] = g.players;
  const hx = g.cage.hx - 1.2, hz = g.cage.hz - 1.2;
  const px = R.range(-hx, hx), pz = R.range(-hz, hz);
  let rx, rz, vx, vz, ok = false, tries = 0;
  while (!ok && tries++ < 300) {
    const D = R.range(4, 13), a = R.range(0, 2 * Math.PI);
    rx = px + Math.cos(a) * D; rz = pz + Math.sin(a) * D;
    const v = R.next() < 0.2 ? 0 : R.range(2, 7), b = R.range(0, 2 * Math.PI);
    vx = Math.cos(b) * v; vz = Math.sin(b) * v;
    ok = Math.abs(rx) < hx && Math.abs(rz) < hz && Math.abs(rx + vx * 2.5) < hx && Math.abs(rz + vz * 2.5) < hz;
  }
  const face = Math.atan2(rz - pz, rx - px) + R.range(-1.2, 1.2);
  ps.place(px, pz, face); g.ball.place(px + Math.cos(face) * 0.35, 0.11, pz + Math.sin(face) * 0.35);
  rc.place(rx, rz, Math.atan2(vz, vx)); rc.vx = vx; rc.vz = vz; rc.speed = Math.hypot(vx, vz);
  const v0 = rc.speed, m = v0 / (v0 > P.vRun ? P.vSprint : P.vRun);
  const stickA = Math.atan2(rz - pz, rx - px) + R.range(-0.15, 0.15);
  const seq = chip ? [[0, 0.06], [0.14, 0.2]] : [[0, 0.06]];
  let kick = null, got = false, minV = 99, err = 99, plan = null;
  for (let i = 0; i < 5 / DT && !got; i++) {
    const t = i * DT;
    const ins = [];
    ins[0] = H({ passDown: seq.some(([a, b]) => t >= a && t < b), ...(t < 0.5 ? { mx: Math.cos(stickA) * 0.15, mz: Math.sin(stickA) * 0.15 } : {}) });
    ins[1] = !kick ? { ...EMPTY_INPUT, mx: v0 ? vx / v0 * Math.min(1, m) : 0, mz: v0 ? vz / v0 * Math.min(1, m) : 0, sprint: v0 > P.vRun } : EMPTY_INPUT;
    for (const e of g.step(ins)) {
      if (e.type === 'kick' && e.player === 0 && !kick) {
        kick = { t: g.t, x: rc.x, z: rc.z, vx: rc.vx, vz: rc.vz }; plan = ps.lastKick;
        const gb = new Ball(P); gb.p.copy(g.ball.p); gb.v.copy(g.ball.v); gb.w.copy(g.ball.w); gb.contact = g.ball.contact;
        for (let j = 1; j < 3.5 * 120; j++) {
          gb.step(DT, g.cage); const tt = j * DT;
          const ix = kick.x + kick.vx * Math.min(tt, 2.2), iz = kick.z + kick.vz * Math.min(tt, 2.2);
          if (gb.p.y < (chip ? 1.6 : 0.6)) err = Math.min(err, Math.hypot(gb.p.x - ix, gb.p.z - iz));
        }
      }
      if ((e.type === 'touch' || e.type === 'kick' || e.type === 'control') && e.player === 1 && kick) got = true;
    }
    if (kick && !got) minV = Math.min(minV, rc.speed);
  }
  return { got, stop: v0 >= 2 && minV < 1.0, err, tech: plan && plan.tech, to: plan ? plan.to : -9, el: plan ? plan.planElDeg : 0 };
}
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
for (const chip of [false, true]) {
  const R = new Rng(chip ? 77 : 42);
  let got = 0, stop = 0, toR = 0, elOk = 0; const errs = [], tech = {};
  for (let k = 0; k < N; k++) {
    const r = situation(R, k, chip);
    if (r.got && !r.stop) got++;
    if (r.stop) stop++;
    if (r.to === 1) toR++;
    // Nacht 2c: feste Flanke – weit 14°, kurz bis 45° (?flanke=0: 25–45°)
    if (chip ? r.el >= Math.min(P.chipElevMin, P.flanke ? P.flankeMin : 99) - 1 && r.el <= P.chipElevMax + 1 : r.el < 3) elOk++;
    errs.push(r.err); tech[r.tech] = (tech[r.tech] || 0) + 1;
  }
  errs.sort((a, b) => a - b);
  const nm = chip ? 'hoch (Tipp + halten, Chip)' : 'flach (Einzeltipp)';
  check(`Pass ${nm}: Empfänger erreicht den Ball ohne Stehenbleiben`, got / N * 100, chip ? 75 : 90, 100, '%', chip ? 75 : 90,
    `${N} Lagen; ${stop}× unter 1 m/s; Fehlerabstand p50 ${pct(errs, 0.5).toFixed(2)} m, p95 ${pct(errs, 0.95).toFixed(2)} m; Techniken ${JSON.stringify(tech)}`);
  check(`Pass ${nm}: richtiger Empfänger gewählt (Stick ±9°)`, toR / N * 100, 99, 100, '%', 100);
  check(`Pass ${nm}: Abflugwinkel ${chip ? `${P.flanke ? P.flankeMin : P.chipElevMin}–${P.chipElevMax}° (Flanke weit flach, Chip kurz steil)` : 'flach (1,5°)'}`, elOk / N * 100, 99, 100, '%', 100);
  rows[rows.length - 3].p50 = pct(errs, 0.5); rows[rows.length - 3].p95 = pct(errs, 0.95);
}

// ---------------- 2) Kegel ±35°, Passweg, freier Raum, Bande ----------------
{
  const g = mk([3, 1]);
  const [a, m1, m2, o] = g.players;
  a.place(0, 0, 0); g.ball.place(0.35, 0.11, 0);
  m1.place(8, 3, 0); m2.place(6, -4, 0); o.place(-8, 5, 0);
  const at = (deg) => planPass(g, a, { stick: [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)] });
  const a1 = Math.atan2(3, 7.65) * 180 / Math.PI, a2 = Math.atan2(-4, 5.65) * 180 / Math.PI;
  check('Kegel: Stick auf Mitspieler 1 → Mitspieler 1', at(a1).to === 1 ? 1 : 0, 1, 1, '', 1, `Winkel ${a1.toFixed(0)}°`);
  check('Kegel: Stick auf Mitspieler 2 → Mitspieler 2', at(a2).to === 2 ? 1 : 0, 1, 1, '', 1, `Winkel ${a2.toFixed(0)}°`);
  check('Kegel: 30° neben Mitspieler 1 → noch Mitspieler 1', at(a1 + 30).to === 1 ? 1 : 0, 1, 1, '', 1);
  const bk = at(a1 + 60);
  check('Kegel: Spiegelbild eines Mitspielers an der Bande im Kegel → Bandenpass', bk.bank !== 0 && bk.to === 2 ? 1 : 0, 1, 1, '', 1, `Stick ${(a1 + 60).toFixed(0)}°, Mitspieler 2 über die Bande`);
  const free = at(200);
  check('Kegel: kein Mitspieler (auch nicht über die Bande) im Kegel → freier Raum', free.to === -1 ? 1 : 0, 1, 1, '', 1, `Ziel (${free.target.map((v) => v.toFixed(1)).join(', ')}), ${free.u.toFixed(1)} m/s, ${free.tech}`);
  const fd = Math.hypot(free.target[0] - 0.35, free.target[1]);
  check('Freier Raum (Tipp): Weite', fd, 6.5, 7.5, 'm', P.passFree);
  // Passweg zu: zwei Mitspieler im Kegel, der näher an der Stick-Richtung ist verdeckt → der freie gewinnt
  m1.place(8, 2, 0); m2.place(7, -2, 0);
  const free1 = at(3);
  o.place(4, 1.0, Math.PI);
  const blocked = at(3);
  check('Passweg frei → Mitspieler näher an der Stick-Richtung', free1.to === 1 ? 1 : 0, 1, 1, '', 1, `gewählt ${free1.to}`);
  check('Passweg zu (Gegner in der Linie) → freier Mitspieler im Kegel', blocked.to === 2 ? 1 : 0, 1, 1, '', 1, `gewählt ${blocked.to}`);
  // Halten = Stärke: länger gehalten → härter
  o.place(-8, 5, 0); m1.place(8, 3, 0); m2.place(6, -4, 0);
  const soft = planPass(g, a, { stick: [7.65, 3], power: 0 }), hard = planPass(g, a, { stick: [7.65, 3], power: 1 }), auto = planPass(g, a, { stick: [7.65, 3] });
  check('Halten: Stärke aus der Haltedauer (voll härter als kurz)', hard.u - soft.u, 3, 20, 'm/s', null, `kurz ${soft.u.toFixed(1)}, Tipp ${auto.u.toFixed(1)}, voll ${hard.u.toFixed(1)} m/s`);
}
// Bandenpass: Mitspieler hinter einem Gegner, Stick zur Bande (Spiegelbild) → Pass über die Bande, Ball kommt an
{
  const g = mk([2, 1], 9);
  const [a, m, o] = g.players;
  a.place(-4, 4.2, 0); g.ball.place(-3.65, 0.11, 4.2);
  m.place(4, 4.0, 0); o.place(0, 4.1, Math.PI);
  const mz = 2 * g.cage.hz - m.z;
  const stick = [m.x + 3.65, mz - 4.2];
  const pl = planPass(g, a, { stick });
  check('Bandenpass: Stick aufs Spiegelbild an der Bande → über die Bande', pl.bank ? 1 : 0, 1, 1, '', 1, `Bande ${pl.bank}, Zielpunkt (${pl.target.map((v) => v.toFixed(1)).join(', ')}), ${pl.u.toFixed(1)} m/s`);
  // im Spiel ausführen: Ball kommt beim Mitspieler an
  const ins = []; let near = 99;
  for (let i = 0; i < 3 / DT; i++) {
    const t = i * DT;
    ins[0] = H({ passDown: t < 0.06, ...(t < 0.4 ? { mx: stick[0] / Math.hypot(...stick) * 0.12, mz: stick[1] / Math.hypot(...stick) * 0.12 } : {}) });
    ins[1] = EMPTY_INPUT; ins[2] = EMPTY_INPUT;
    const ev = g.step(ins);
    near = Math.min(near, Math.hypot(g.ball.p.x - m.x, g.ball.p.z - m.z));
    if (ev.some((e) => (e.type === 'touch' || e.type === 'control') && e.player === 1)) { near = 0; break; }
  }
  check('Bandenpass im Spiel: Ball erreicht den Mitspieler', near, 0, 0.9, 'm', 0, 'kleinster Abstand bzw. Annahme');
}
// Einzeltipp: gespielt spätestens ein Takt nach dem Doppeltipp-Fenster (Ball am Fuß)
{
  const g = mk([2, 0], 4);
  const [a, m] = g.players; a.place(0, 0, 0); g.ball.place(0.35, 0.11, 0); m.place(8, 0, 0);
  let tk = -1;
  for (let i = 0; i < 1 / DT && tk < 0; i++) { const t = i * DT; if (g.step([H({ passDown: t < 0.06 }), EMPTY_INPUT]).some((e) => e.type === 'kick')) tk = g.t; }
  check('Einzeltipp mit Ball am Fuß: Pass nach dem Fenster', tk, 0.06 + P.doppel, 0.06 + P.doppel + 3 * DT, 's', 0.06 + P.doppel, `Tipp 0,06 s + Fenster ${P.doppel} s`);
}

const ok = report('Pass in den Laufweg (flach/hoch), Kegel, Bande', rows, 'pass');
process.exit(ok ? 0 : 1);
