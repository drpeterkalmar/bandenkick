// n12 (Peter 05.11.2026: „der schöne Laufpass an die Spitze wird vom Passempfänger nicht nach vorn mitgenommen, sondern prallt an
// ihm nach hinten ab“): Der laufende Empfänger legt den Ball mit der ersten Berührung in seine Laufrichtung vor. Gleiche Szenen und
// Seeds mit ?mitnahme=0 (Annahme wie 0.9.0). Aufruf: node tests/node/n12.test.mjs
import { makeParams, AKRO0 } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { szenen, auswerten, laufpass, botProbe } from './n12_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit = '', target = null, note = '') => { rows.push({ name, value, lo, hi, unit, target, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', 1, note);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');

// 1) Regler
{
  const P = makeParams(''), A = makeParams('mitnahme=0'), K = makeParams('akro=0');
  yes('Standard: Mitnahme an, ab 1,5 m/s, Vorlage 0,8 m nach 0,7 s', P.mitnahme === 1 && P.mitnahmeV === 1.5 && P.mitnahmeVor === 0.8 && P.mitnahmeZeit === 0.7);
  yes('?mitnahme=0 = Annahme wie 0.9.0, ?akro=0 schaltet sie mit aus (0.8.0)', A.mitnahme === 0 && K.mitnahme === 0 && AKRO0.mitnahme === 0);
}

// 2) Szene „Laufpass in die Spitze“ (Mensch- und Bot-Passgeber, Stick los / nach vorn), hoch (Standard) und flach
for (const [name, q] of [['hoch', ''], ['flach', 'hochpass=0']]) {
  const n = auswerten(szenen(q, 12)), a = auswerten(szenen(q + (q ? '&' : '') + 'mitnahme=0', 12));
  check(`Laufpass ${name}: Ball nach der Annahme hinter dem Empfänger (0.9.0: ${f(a.rueck)} %)`, n.rueck, 0, 5, '%', 0, `${a.lauf} → ${n.lauf} Annahmen im Lauf`);
  check(`… ${name}: mitgenommen (0,5 s danach 0,2–2,5 m vor ihm, kein Gegner dran)`, n.mit, 85, 100, '%', null, `0.9.0: ${f(a.mit)} %`);
  check(`… ${name}: Vorlage vor dem Fuß 0,7 s nach der Annahme`, n.vorlage7, 0.15, 1.2, 'm', 0.8, `nach 0,5 s ${f(n.vorlage, 2)} m`);
  check(`… ${name}: Ball etwas schneller als der Läufer (m/s mehr)`, n.vAlong - n.vLauf, 0.3, 3, 'm/s', null, `Ball ${f(n.vAlong)} / Lauf ${f(n.vLauf)} (0.9.0: ${f(a.vAlong)} / ${f(a.vLauf)})`);
  check(`… ${name}: Pass kommt an (nicht schlechter)`, n.an - a.an, -1, 99, 'Szenen', 0, `${a.an} → ${n.an} von ${n.n}`);
}

// 3) Steht der Empfänger (< 1,5 m/s bei der Berührung), bleibt alles wie bisher
{
  let n = 0, gleich = 0;
  for (let s = 1; s <= 16; s++) {
    const o = { geber: 'bot', empf: 'los', steh: true };
    const r1 = laufpass('', 'steh' + s, o), r0 = laufpass('mitnahme=0', 'steh' + s, o);
    if (!r1.ok || !r0.ok || r1.s >= 1.5 || r0.s >= 1.5) continue;
    n++; if (Math.hypot(r1.ende[0] - r0.ende[0], r1.ende[1] - r0.ende[1], r1.ende[2] - r0.ende[2]) < 1e-9) gleich++;
  }
  check('Empfänger steht: Ballweg gleich wie 0.9.0', n ? gleich / n : 0, 1, 1, '×', 1, `${gleich} von ${n} Szenen`);
}

// 4) Ball vom Gegner (auch als „Pass“ zu mir geplant) und Pass ohne Plan prallen weiter ab – gleicher Ballweg wie 0.9.0
{
  const flug = (qs, wer, plan = wer === 4) => {
    const g = new Game(makeParams(qs), 'geg', { match: true, human: -1, botLevel: 2 });
    g.rules.phase = 'play'; g.rules.phaseT = 5;
    const pl = g.players[2];
    for (const p of g.players) if (p !== pl) p.place(p.team ? 10 : -10, p.id - 3, 0);
    pl.place(0, 0, 0); pl.vx = 5; pl.speed = 5;
    g.ball.place(-2, 1.2, 0); g.ball.v.set(9, 0.5, 0);
    g.lastTouch = wer; g.lastTouchT = 0;
    g.passPlan = plan ? { to: pl.id, from: wer, x: 0.5, z: 0, t: 0.3, hoch: true } : null;
    const out = [];
    for (let i = 0; i < 60; i++) { g.step([]); out.push(g.ball.p.x, g.ball.p.y, g.ball.p.z); }
    return out;
  };
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  yes('Ball vom Gegner (Plan zu mir): gleicher Ballweg wie 0.9.0', same(flug('', 4), flug('mitnahme=0', 4)));
  yes('Ball vom Mitspieler ohne Pass-Plan: gleicher Ballweg wie 0.9.0', same(flug('', 1), flug('mitnahme=0', 1)));
  const m = flug('', 1, true), m0 = flug('mitnahme=0', 1, true);
  yes('Gegenprobe: dieselbe Szene als Pass vom Mitspieler wird mitgenommen (Ball danach weiter vorn als 0.9.0)', m[m.length - 3] > m0[m0.length - 3] + 0.3, `x ${f(m0[m0.length - 3], 2)} → ${f(m[m.length - 3], 2)} m`);
}

// 5) Bot-Selbstspiel Stufe 2 gegen 2 (16 Spiele, gleiche Seeds): kein Rückschritt
{
  const a = await botProbe('mitnahme=0', 16), n = await botProbe('', 16);
  const p = (x, m) => (m ? (100 * x) / m : NaN);
  check('Bots: Ball 0,25 s nach der Annahme im Lauf hinter dem Empfänger', p(n.hinten25, n.n), 0, 8, '%', null, `0.9.0: ${f(p(a.hinten25, a.n))} %`);
  check('Bots: angekommene Pässe ÷ 0.9.0', n.an / a.an, 0.95, 9, '×', null, `${a.an} → ${n.an}`);
  check('Bots: Ballverlust ≤ 1,5 s nach der Annahme (Punkte gegen 0.9.0)', p(n.verlust, n.an) - p(a.verlust, a.an), -99, 2, 'Punkte', null, `${f(p(a.verlust, a.an))} → ${f(p(n.verlust, n.an))} %`);
}

process.exit(report('n12 Mitnahme: Laufpass im Lauf nach vorn mitnehmen', rows) ? 0 : 1);
