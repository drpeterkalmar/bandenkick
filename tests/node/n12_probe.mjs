// n12-Messwerkzeug (Peter 05.11.2026: „der schöne Laufpass an die Spitze wird vom Passempfänger nicht nach vorn mitgenommen,
// sondern prallt an ihm nach hinten ab“). Szene „Laufpass in die Spitze“: Orange greift Richtung +x an, der Passgeber steht mit dem
// Ball in der eigenen Hälfte, der Empfänger läuft 3–8 m vor ihm mit 4–6 m/s Richtung gegnerisches Tor (±35°), zwei Gegner weit weg
// (hinter dem Passgeber bzw. an der Seite), der Tormann im Tor. Varianten:
//   Passgeber  mensch – echter Tipp auf den Pass-Knopf, Stick in den Laufweg des Empfängers (Daumen-Fehler σ 8°)
//              bot    – Pass wie ein Bot (kickAt lead:true zum Empfänger)
//   Empfänger  los    – nach dem Pass kein Stick (Empfänger-Hilfe, wie ein Bot)
//              vor    – Stick bleibt nach vorn gedrückt (Laufrichtung zum Tor, Peters Daumen)
//   Pass       auto   – wie im Spiel (n11: meist hoch) · flach – ?hochpass=0 (flacher Laufpass)
// Gemessen bei der ersten Berührung des Empfängers (Fuß, Annahme, Luftball, Körper): Lauftempo und -richtung davor, Balltempo in
// Laufrichtung danach (über 3 Takte gemittelt).
// „rückwärts“ = der Ball läuft danach entgegen der Laufrichtung oder liegt 0,5 s später hinter dem Empfänger; „mitgenommen“ = 0,5 s danach liegt der Ball vor dem Empfänger (0,2–2,5 m in Laufrichtung) und kein Gegner war dran.
// Dazu Bot-Selbstspiel: alle angekommenen Pässe, bei denen der Empfänger lief (≥ 1,5 m/s), Anteil rückwärts.
// Aufruf: node tests/node/n12_probe.mjs ["Query"] [Szenen je Variante=60] [Bot-Spiele=0]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { playGame } from './selfplay.mjs';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEG = Math.PI / 180;
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const KONTAKT = ['touch', 'kick', 'control', 'body', 'air', 'catch', 'parry', 'block', 'tackle'];

export function laufpass(qs, seed, { geber = 'mensch', empf = 'los', spur = null, steh = false } = {}) {
  const P = makeParams(qs);
  const R = new Rng('n12' + seed);
  const g = new Game(P, 'n12' + seed, { match: true, human: 1, botLevel: 2 });
  g.rules.phase = 'play'; g.rules.phaseT = 5;
  const hx = g.cage.hx, hz = g.cage.hz;
  const me = g.players[1], rc = g.players[2], opps = g.players.slice(3);
  const px = R.range(-7, -3), pz = R.range(-3, 3);
  const a = R.range(-35, 35) * DEG, v0 = steh ? 0 : R.range(4, 6); // (steh: Empfänger steht – Annahme wie bisher)
  const rx = px + R.range(3, 8), rz = Math.max(-hz + 1.5, Math.min(hz - 1.5, pz + R.range(-4, 4)));
  me.place(px, pz, Math.atan2(rz - pz, rx - px));
  rc.place(rx, rz, a); rc.vx = Math.cos(a) * v0; rc.vz = Math.sin(a) * v0; rc.speed = v0; rc.hx = Math.cos(a); rc.hz = Math.sin(a);
  g.players[0].place(-hx + 1, 0, 0);
  opps[0].place(hx - 0.8, 0, Math.PI);                       // Tormann
  opps[1].place(px - 3, pz + R.range(-2, 2), 0);             // hinter dem Passgeber
  opps[2].place(R.range(0, 6), R.next() < 0.5 ? -hz + 1 : hz - 1, Math.PI); // an der Seite
  g.ball.place(px + Math.cos(me.face) * 0.4, 0.11, pz + Math.sin(me.face) * 0.4);
  g.lastTouch = me.id; g.lastTouchT = 0; me.lastTouchT = 0; g.rules.lastTouchTeam = 0;
  g.rules.updateKeepers(0, true);
  const thumb = R.gauss() * 8 * DEG;
  let kick = null, res = null, tPress = -1, ruck = null, ruck7 = null;
  while (g.t < 5.3 && !(res && g.t > res.t + 0.7)) {
    const t = g.t;
    let inp = H();
    const lead = 0.9; // Stick in den Laufweg: wo der Empfänger in ~0,9 s ist
    if (!kick) {
      if (geber === 'mensch') {
        if (tPress < 0) tPress = t;
        const sa = Math.atan2(rc.z + rc.vz * lead - g.ball.p.z, rc.x + rc.vx * lead - g.ball.p.x) + thumb;
        inp = H({ passDown: t - tPress < 0.07, mx: Math.cos(sa) * 0.6, mz: Math.sin(sa) * 0.6 });
      } else if (t === 0) me.kickAt({ kind: 'pass', lead: true, to: rc.id, noise: 0 });
    } else if (empf === 'vor' && g.human === rc.id) {
      const s = Math.hypot(rc.vx, rc.vz), ax = s > 0.5 ? rc.vx / s : 1, az = s > 0.5 ? rc.vz / s : 0;
      inp = H({ mx: ax, mz: az });
    }
    const vor = { vx: rc.vx, vz: rc.vz, s: Math.hypot(rc.vx, rc.vz) };
    const ins = []; ins[g.human] = inp;
    const ev = g.step(ins);
    for (const e of ev) {
      if (!kick && e.type === 'kick' && e.player === me.id) { kick = { t: g.t, to: me.lastKick ? me.lastKick.to : -1, hoch: !!(me.lastKick && me.lastKick.hoch), tech: e.tech }; continue; }
      if (kick && !res && KONTAKT.includes(e.type) && e.player != null && (e.player !== me.id || g.t > kick.t + 0.05)) {
        // (Art der Berührung: Annahme/Luftball/Kick vor dem allgemeinen „touch“ desselben Takts)
        const art = ev.find((x) => x.player === e.player && ['control', 'air', 'kick'].includes(x.type)) || e;
        res = { t: g.t, wer: e.player === rc.id ? 'empf' : g.players[e.player].team === me.team ? 'mit' : 'geg', type: art.type, part: art.part || art.tech || null, y: e.y ?? g.ball.p.y,
          s: vor.s, hx: vor.s > 0.3 ? vor.vx / vor.s : 1, hz: vor.s > 0.3 ? vor.vz / vor.s : 0, samples: [], gegner: false, zuGeg: kick.to !== rc.id };
      } else if (res && e.player != null && g.players[e.player].team !== me.team && KONTAKT.includes(e.type)) res.gegner = true;
    }
    if (spur && res && g.t < res.t + 0.6) spur.push({ t: +(g.t - res.t).toFixed(3), bx: +(((g.ball.p.x - rc.x) * res.hx + (g.ball.p.z - rc.z) * res.hz)).toFixed(2), by: +g.ball.p.y.toFixed(2), bv: +((g.ball.v.x * res.hx + g.ball.v.z * res.hz)).toFixed(2), ps: +Math.hypot(rc.vx, rc.vz).toFixed(2), ev: ev.filter((e) => e.player != null).map((e) => e.type + e.player).join(' ') });
    if (res && res.wer === 'empf' && res.samples.length < 3) res.samples.push(g.ball.v.x * res.hx + g.ball.v.z * res.hz);
    if (res && res.wer === 'empf' && ruck == null && g.t >= res.t + 0.5) ruck = (g.ball.p.x - rc.x) * res.hx + (g.ball.p.z - rc.z) * res.hz;
    if (res && res.wer === 'empf' && ruck7 == null && g.t >= res.t + 0.7 && !res.gegner) ruck7 = (g.ball.p.x - rc.x) * res.hx + (g.ball.p.z - rc.z) * res.hz;
  }
  if (!kick) return { geber, empf, ok: false, grund: 'kein Pass' };
  if (!res) return { geber, empf, ok: false, grund: 'niemand', hoch: kick.hoch };
  const vAlong = res.samples.length ? res.samples.reduce((x, y) => x + y, 0) / res.samples.length : 0;
  return { geber, empf, ok: res.wer === 'empf', wer: res.wer, hoch: kick.hoch, tech: kick.tech, type: res.type, part: res.part, y: res.y, s: res.s,
    // rückwärts: der Ball läuft nach der Berührung gegen die Laufrichtung ODER liegt 0,5 s später hinter dem Empfänger (er ist am
    // langsameren Ball vorbeigelaufen – so sieht Peters „prallt nach hinten ab“ aus)
    vAlong, rueck: vAlong < 0 || (ruck != null && ruck < 0 && !res.gegner), vor: ruck, vor7: ruck7, ende: [g.ball.p.x, g.ball.p.y, g.ball.p.z], mit: res.wer === 'empf' && !res.gegner && ruck != null && ruck > 0.2 && ruck < 2.5 };
}

export function szenen(qs = '', N = 60) {
  const out = [];
  for (const geber of ['mensch', 'bot']) for (const empf of ['los', 'vor']) for (let s = 1; s <= N; s++) out.push(laufpass(qs, `${geber}${empf}${s}`, { geber, empf }));
  return out;
}

export function auswerten(rs) {
  const an = rs.filter((r) => r.ok), lauf = an.filter((r) => r.s >= 1.5);
  const pct = (a, b) => (b ? (100 * a) / b : NaN);
  const typen = {};
  for (const r of lauf) { const k = r.type + (r.part ? '/' + r.part : '') + (r.rueck ? ' ↩' : ''); typen[k] = (typen[k] || 0) + 1; }
  return {
    n: rs.length, an: an.length, lauf: lauf.length,
    rueck: pct(lauf.filter((r) => r.rueck).length, lauf.length),
    mit: pct(lauf.filter((r) => r.mit).length, lauf.length),
    vAlong: lauf.length ? lauf.reduce((a, r) => a + r.vAlong, 0) / lauf.length : NaN,
    vLauf: lauf.length ? lauf.reduce((a, r) => a + r.s, 0) / lauf.length : NaN,
    vorlage: (() => { const m = lauf.filter((r) => r.mit); return m.length ? m.reduce((a, r) => a + r.vor, 0) / m.length - 0.36 : NaN; })(), // m vor dem Fuß (0,36 m vor der Körpermitte), 0,5 s …
    vorlage7: (() => { const m = lauf.filter((r) => r.mit && r.vor7 != null); return m.length ? m.reduce((a, r) => a + r.vor7, 0) / m.length - 0.36 : NaN; })(), // … und 0,7 s danach
    geg: pct(rs.filter((r) => r.wer === 'geg').length, rs.length),
    hoch: pct(rs.filter((r) => r.hoch).length, rs.length), typen,
  };
}

// Bot-Selbstspiel Stufe 2 gegen 2: angekommene Pässe, Empfänger läuft (≥ 1,5 m/s) → Ballrichtung nach der ersten Berührung
// (rückwärts wie oben), dazu Ballverlust: ein Gegner berührt den Ball binnen 1,5 s nach der Annahme (alle angekommenen Pässe bzw. im Lauf)
export function botSpiele(qs = '', seeds = [1, 2, 3, 4]) {
  const r = { n: 0, rueck: 0, sofort: 0, hinten25: 0, hintenLauf: 0, mit: 0, an: 0, verlust: 0, laufVerlust: 0, typ: {} };
  for (const seed of seeds) {
    let pend = null, chk = null; const vor = new Map(), wach = [];
    playGame(seed, { qs, levels: [2, 2], onStep: (g, ev) => {
      const b = g.ball;
      for (const w of wach) if (!w.fertig) {
        if (g.t - w.t > 1.5) w.fertig = true;
        else for (const e of ev) if (e.player != null && e.player >= 0 && g.players[e.player].team !== w.team && KONTAKT.includes(e.type)) { w.fertig = true; r.verlust++; if (w.lauf) r.laufVerlust++; break; }
      }
      if (chk) {
        chk.k++;
        if (chk.k <= 3) chk.v += b.v.x * chk.hx + b.v.z * chk.hz;
        if (chk.k === 3 && chk.v / 3 < 0) chk.r = true;
        if (chk.k === 30) { const pl = g.players[chk.id]; chk.h25 = (b.p.x - pl.x) * chk.hx + (b.p.z - pl.z) * chk.hz < 0 && !chk.geg; }
        for (const e of ev) if (e.player != null && e.player >= 0 && g.players[e.player].team !== g.players[chk.id].team && KONTAKT.includes(e.type)) chk.geg = true;
        if (chk.k === 60) { // 0,5 s
          const pl = g.players[chk.id], d = (b.p.x - pl.x) * chk.hx + (b.p.z - pl.z) * chk.hz;
          const rk = chk.r || (d < 0 && !chk.geg), t = r.typ[chk.typ] || (r.typ[chk.typ] = [0, 0]);
          t[0]++; if (rk) t[1]++;
          r.n++; if (rk) r.rueck++;
          if (chk.r) r.sofort++;
          if (chk.r || chk.h25) r.hinten25++;
          if (rk && pl.vx * chk.hx + pl.vz * chk.hz >= 1) r.hintenLauf++; // (läuft weiter vorwärts – nicht selbst gebremst/gedreht)
          if (d > 0.2 && d < 2.5 && !chk.geg) r.mit++;
          chk = null;
        }
      }
      for (const e of ev) {
        const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
        if (p && pend && KONTAKT.includes(e.type) && e.player !== pend.from && g.t > pend.t) {
          const v = vor.get(e.player), lauf = !!(v && v.s >= 1.5);
          if (e.player === pend.to) {
            r.an++; wach.push({ t: g.t, team: p.team, lauf, fertig: false });
            const art = ev.find((x) => x.player === e.player && ['control', 'air', 'kick'].includes(x.type)) || e;
            if (lauf && !chk) chk = { id: e.player, hx: v.vx / v.s, hz: v.vz / v.s, v: 0, k: 0, r: false, geg: false, typ: art.type };
          }
          pend = null;
        }
        if (e.type === 'kick' && p && e.kind === 'pass' && e.to >= 0 && e.to !== e.player && g.players[e.to].team === p.team) pend = { to: e.to, from: e.player, t: g.t };
        if (e.type === 'goal' || e.type === 'restart' || e.type === 'out') pend = null;
      }
      for (const pl of g.players) vor.set(pl.id, { vx: pl.vx, vz: pl.vz, s: Math.hypot(pl.vx, pl.vz) });
    } });
  }
  return r;
}

// Bot-Spiele parallel (Prozesse) → Summe
export function botProbe(qs = '', N = 24, W = 4) {
  const here = fileURLToPath(import.meta.url);
  return Promise.all(Array.from({ length: Math.min(W, N) }, (_, w) => new Promise((res, rej) => {
    const seeds = []; for (let s = 1 + w; s <= N; s += W) seeds.push(s);
    const ch = fork(here, ['--worker', qs, seeds.join(',')], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', res); ch.on('error', rej); ch.on('exit', (c) => { if (c) rej(new Error('Exit ' + c)); });
  }))).then((ps) => ps.reduce((a, b) => {
    for (const k in a) if (k === 'typ') { for (const t in b.typ) { const x = a.typ[t] || (a.typ[t] = [0, 0]); x[0] += b.typ[t][0]; x[1] += b.typ[t][1]; } } else a[k] += b[k];
    return a;
  }));
}

if (process.argv[2] === '--worker') {
  process.send(botSpiele(process.argv[3], process.argv[4].split(',').map(Number)));
  process.exit(0);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] !== '--worker') {
  const qs = process.argv[2] || '', N = +(process.argv[3] || 60), B = +(process.argv[4] || 0);
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');
  const all = szenen(qs, N);
  console.log(`Query "${qs}", ${N} Szenen je Variante`);
  for (const geber of ['mensch', 'bot']) for (const empf of ['los', 'vor']) {
    const a = auswerten(all.filter((r) => r.geber === geber && r.empf === empf));
    console.log(`${geber.padEnd(6)} ${empf.padEnd(3)}: angekommen ${a.an}/${a.n}, im Lauf ${a.lauf}, rückwärts ${f(a.rueck)} %, mitgenommen ${f(a.mit)} %, Ball in Laufrichtung ${f(a.vAlong)} m/s (Lauf ${f(a.vLauf)}), Gegner zuerst ${f(a.geg)} %, hoch ${f(a.hoch, 0)} % ${JSON.stringify(a.typen)}`);
  }
  const a = auswerten(all);
  console.log(`GESAMT: angekommen ${a.an}/${a.n}, im Lauf ${a.lauf}, rückwärts ${f(a.rueck)} %, mitgenommen ${f(a.mit)} % (Vorlage vor dem Fuß nach 0,5 s ${f(a.vorlage, 2)} m, nach 0,7 s ${f(a.vorlage7, 2)} m), Ball ${f(a.vAlong)} m/s vs. Lauf ${f(a.vLauf)}, Gegner zuerst ${f(a.geg)} %`);
  if (B > 0) {
    const b = await botProbe(qs, B), p = (x, n) => f(n ? (100 * x) / n : NaN);
    console.log(`Bot-Spiele (${B}): Pässe angekommen ${b.an}, davon im Lauf ${b.n}: rückwärts ${p(b.rueck, b.n)} % (Ball läuft sofort zurück ${p(b.sofort, b.n)} %, hinten schon nach 0,25 s ${p(b.hinten25, b.n)} %, hinten nach 0,5 s obwohl der Empfänger weiter vorwärts läuft ${p(b.hintenLauf, b.n)} %), mitgenommen ${p(b.mit, b.n)} %; Ballverlust ≤ 1,5 s nach Annahme ${p(b.verlust, b.an)} % (im Lauf ${p(b.laufVerlust, b.n)} %)`);
    const an = Object.entries(b.typ).filter(([t]) => t !== 'kick' && t !== 'air').reduce((a, [, v]) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
    console.log(`  je Art [Anzahl, rückwärts]: ${JSON.stringify(b.typ)} → Annahmen (ohne Direktspiel kick/air): rückwärts ${p(an[1], an[0])} % von ${an[0]}`);
  }
}
