// Wucht und Hechten (Nacht 2d, Peter: „jeweils 1,5x härterer Vollspannschuss und Effetschuss … Torwart soll viel mehr
// hechten“): Tabelle vorher (?wucht=1) / nachher je 8, 12, 16 m – Tempo, Flugzeit, Kurve, Treffer ins leere Tor; Pässe,
// Chips, Flanken und Kopfbälle unverändert; Ziel-Löser trifft; harter Ball über der Fang-Grenze wird nur abgewehrt
// (plausibler Abpraller); Selbstspiel (Stufe 2 gegen 2): kein Ball draußen, keine Zahlenfehler, Hechtsprünge je Spiel,
// Tore im Fenster. Aufruf: node tests/node/wucht.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planShot } from '../../src/sim/shot.js';
import { planPass } from '../../src/sim/pass.js';
import { setKick } from '../../src/sim/kickplan.js';
import { shotTable, selfplay } from './wucht_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams('');
const idle = { ...EMPTY_INPUT, passDown: false, shotDown: false };

// 1) Tabelle vorher/nachher
const t0 = shotTable('wucht=1'), t1 = shotTable('');
const table = [];
for (let i = 0; i < t1.length; i++) {
  const a = t0[i], b = t1[i], curved = b.tech !== 'vollspann';
  check(`${b.D} m ${curved ? 'angeschnitten' : 'Vollspann'}: Tempo × ${P.wucht}`, b.speed / a.speed, P.wucht - 0.02, P.wucht + 0.02, '×', P.wucht, `${a.speed.toFixed(1)} → ${b.speed.toFixed(1)} m/s (${(a.speed * 3.6).toFixed(0)} → ${(b.speed * 3.6).toFixed(0)} km/h), Flugzeit ${a.t.toFixed(2)} → ${b.t.toFixed(2)} s`);
  if (curved) check(`${b.D} m angeschnitten: Kurve ≥ 90 % von vorher`, b.dev / a.dev, 0.9, 9, '×', 1, `${a.dev.toFixed(2)} → ${b.dev.toFixed(2)} m, Drall ${Math.abs(a.spin).toFixed(1)} → ${Math.abs(b.spin).toFixed(1)} U/s`);
  check(`${b.D} m ${curved ? 'angeschnitten' : 'Vollspann'}: Treffer ins leere Tor nicht schlechter`, 100 * b.hit, 100 * a.hit - 10, 100, '%', null, `vorher ${(100 * a.hit).toFixed(0)} % (40 Schüsse, Ball bis 3 m seitlich, mit Streuung)`);
  table.push(`| ${b.D} m | ${curved ? b.tech : 'Vollspann'} | ${a.speed.toFixed(1)} m/s / ${a.t.toFixed(2)} s / ${a.dev.toFixed(2)} m / ${(100 * a.hit).toFixed(0)} % | ${b.speed.toFixed(1)} m/s / ${b.t.toFixed(2)} s / ${b.dev.toFixed(2)} m / ${(100 * b.hit).toFixed(0)} % |`);
}

// 2) Pässe, Chips, Flanken unverändert; Luftbälle: nur Volley/Dropkick (Vollspann aus der Luft) × wucht
{
  const same = (qs) => {
    const g = new Game(makeParams(qs), 3, { match: true, perTeam: [2, 0], human: 0, bots: false }); g.rules.phase = 'play';
    const pl = g.players[0], m = g.players[1];
    pl.place(-2.4, 0, 0); g.ball.place(-2, 0.11, 0); m.place(6, 3, 0);
    return [planPass(g, pl, { mode: 'std', power: null, stick: [1, 0.4] }).u, planPass(g, pl, { mode: 'var', power: null, stick: [1, 0.4] }).u,
      planShot(g, pl, { tech: 'kopf', from: [-2, 1.8, 0], speed: 14 }).speed];
  };
  const a = same('wucht=1'), b = same('');
  check('Pass flach, Pass hoch (Flanke), Kopfball: Tempo unverändert', Math.max(...a.map((x, i) => Math.abs(b[i] - x))), 0, 0.01, 'm/s', 0, `${a.map((x) => x.toFixed(1)).join(' / ')} m/s`);
}

// 3) Ziel-Löser trifft auch bei 45 m/s: geplanter Punkt im Tor ↔ echter Flug (ohne Streuung, ohne Flatterball)
{
  const PK = makeParams('knuckleF30=0');
  let worst = 0, n = 0;
  for (const D of [5, 8, 12, 16]) for (const z of [-2.5, 0, 2.5]) for (const mode of ['std', 'var']) {
    const g = new Game(PK, 3, { match: true, perTeam: [1, 0], human: 0, bots: false }); g.rules.phase = 'play';
    const pl = g.players[0], gx = g.cage.hx, x = gx - D, f = Math.atan2(-z, gx - x);
    pl.place(x - Math.cos(f) * 0.38, z - Math.sin(f) * 0.38, f); g.ball.place(x, 0.11, z);
    const plan = planShot(g, pl, { mode, power: 1 });
    const b = g.ball; setKick(b, plan.dir[0], plan.dir[1], plan.speed, plan.elRad, plan.back || 0, plan.side || 0);
    g.players.length = 0;
    let hit = null;
    for (let i = 0; i < 2 / DT && !hit; i++) { const px = b.p.x, py = b.p.y, pz = b.p.z; b.step(DT, g.cage); if (b.p.x >= gx) { const k = (gx - px) / (b.p.x - px); hit = [py + (b.p.y - py) * k, pz + (b.p.z - pz) * k]; } }
    const err = hit ? Math.hypot(hit[0] - plan.aim[1], hit[1] - plan.aim[2]) : 9;
    worst = Math.max(worst, err); n++;
  }
  check(`Ziel-Löser bei voller Wucht (${n} Schüsse 5–16 m, bis ${(P.shotMax * P.wucht).toFixed(0)} m/s): größte Abweichung im Tor`, worst, 0, 0.15, 'm', 0);
}

// 4) Tormann: Ball über der Fang-Grenze → nur abwehren, Abpraller plausibel (weg vom Tor, deutlich langsamer)
{
  const g = new Game(makeParams('tormann=3'), 4, { match: true, human: 0, perTeam: [1, 1], botLevels: [2, 2] });
  const gx = g.cage.hx, kp = g.players[1];
  let parry = 0, caught = 0, out = [], n = 0;
  for (let k = 0; k < 12; k++) {
    g.rules.phase = 'play'; kp.place(gx - 1, 0, Math.PI); kp.resetHands(); g.players[0].place(gx - 10, 3, 0);
    g.rules.updateKeepers(0, true);
    for (let i = 0; i < 0.6 / DT; i++) g.step([idle]);
    kp.place(gx - 1, 0, Math.PI);
    g.ball.place(gx - 9, 0.6, (k % 3 - 1) * 0.2); g.ball.held = -1;
    setKick(g.ball, 1, 0, 40, 0.05, 0, 0); g.lastTouch = 0; g.lastTouchT = g.t; n++;
    let first = '';
    for (let i = 0; i < 0.6 / DT && !first; i++) for (const e of g.step([idle])) { // nur die erste Hand am Ball zählt
      if (first) break;
      if (e.type === 'parry' && e.player === 1) { first = 'parry'; parry++; out.push(g.ball.v.x <= 0 ? Math.hypot(g.ball.v.x, g.ball.v.z) / e.speed : 9); }
      if (e.type === 'catch' && e.player === 1) { first = 'catch'; caught++; }
    }
  }
  check('40 m/s auf den Tormann (Stufe 3, Fang-Grenze 22 m/s): gefangen', caught, 0, 0, '×', 0, `${parry} von ${n} abgewehrt`);
  check('… Abpraller weg vom Tor, höchstens halb so schnell', Math.max(...out, 0), 0.05, 0.5, '×', null, `Tempo nach ÷ vor der Abwehr: ${out.map((x) => x.toFixed(2)).join(', ')}`);
}

// 5) Selbstspiel Stufe 2 gegen 2: Physik heil, Hechtsprünge, Tore
{
  const N = +(process.env.WUCHT_N || 16);
  const r = selfplay('', N);
  check(`Selbstspiel (${N} Spiele, Stufe 2): Ball außerhalb des Käfigs`, r.out, 0, 0, 'Takte', 0, `schnellster Schuss ${(r.vmax * 3.6).toFixed(0)} km/h`);
  check('… Zahlenfehler / Numerik-Notbremsen', r.nan + r.faults, 0, 0, '×', 0);
  // Nacht 2c (gleiche 16 Spiele, Stand c395589): 2,2 Hechtsprünge, 11,8 Tore, 32,9 % Tore je Schuss
  check('… Hechtsprünge je Spiel (beide Tormänner; Ziel ≥ 15 und ≥ 3 × Nacht 2c)', r.dives / r.games, Math.max(15, 3 * 2.2), Infinity, '', null, `Nacht 2c 2,2; Paraden ${(r.saves / r.games).toFixed(1)} je Spiel, davon im Hechtsprung ${(r.diveSaves / r.games).toFixed(1)}`);
  check('… Tore je Spiel (Nacht 2c 11,8)', r.goals / r.games, 6, 18, '', null, `${(r.shots / r.games).toFixed(1)} Schüsse, ${(100 * r.goals / Math.max(1, r.shots)).toFixed(1)} % Tore je Schuss (Nacht 2c 32,9 %)`);
}

const ok = report('Wucht und Hechten (Nacht 2d)', rows, 'wucht');
console.log(`\n| Schuss | Technik | vorher (?wucht=1): Tempo / Flugzeit / Kurve / leeres Tor | nachher |\n|---|---|---|---|\n${table.join('\n')}`);
process.exit(ok ? 0 : 1);
