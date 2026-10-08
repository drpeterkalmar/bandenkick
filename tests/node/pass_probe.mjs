// Messprobe Passsystem (Nacht 2e, Peter 03.10.: „repariere das Passsystem, die Pässe gehen irgendwo hin“).
// Echtes 3 gegen 3 mit Bots (Stufe 2): der Mensch (Orange) hat den Ball, zwei Bot-Mitspieler, drei Bot-Gegner. Gesten
// wie am Handy über den echten Gesten-Parser (Tipp 0,07 s bzw. Halten 0,4 s), Eingabe geht immer an den gerade
// gesteuerten Spieler (nach dem Pass: der Empfänger, wie in main.js). Varianten:
//   steh  – steht, Stick kurz Richtung Mitspieler (Daumen-Fehler σ 8°)      ohne – steht, kein Stick, Blick zum Mitspieler (σ 10°)
//   lauf  – führt 0,8–1,4 s den Ball (Lauftempo), dann Stick zum Mitspieler  sprint – dasselbe im Sprint
//   Daumen danach: „los“ (Stick nach 0,25 s los) oder „halten“ (bleibt 1,5 s in Pass-Richtung gedrückt)
// Gemeint = Mitspieler, auf den der Stick (ohne Stick: der Blick) beim Druck zeigt. Gemessen je Pass: kommt beim
// Gemeinten an (er berührt den Ball als Erster), abgefangen (Gegner zuerst), falscher Mitspieler, niemand (4 s),
// gewählter Empfänger = gemeint, Winkel Vorschau ↔ Abflug (mit und ohne Streuung), kleinster Abstand Ball ↔ Gemeinter,
// Bandenpass, Freiraum-Pass, Passweg frei (kein Gegner ≤ 1,5 m am Weg, Empfänger ≥ 1,5 m frei).
// Aufruf: node tests/node/pass_probe.mjs [N je Variante] ["qs"]   z. B. node tests/node/pass_probe.mjs 200 "passfix=0"
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { planPass } from '../../src/sim/pass.js';
import { pathToFileURL } from 'node:url';

const DEG = Math.PI / 180;
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
const segDist = (px, pz, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1; const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L2)); return Math.hypot(px - ax - ex * t, pz - az - ez * t); };

// Eine Pass-Situation → Ergebnis-Objekt
export function onePass(P, seed, { move = 'steh', gest = 'tipp', thumb = 'los' } = {}) {
  const R = new Rng('lage' + seed);
  const g = new Game(P, 'pp' + seed, { match: true, human: 1, botLevel: 2 });
  g.rules.phase = 'play'; g.rules.phaseT = 5;
  const hx = g.cage.hx, hz = g.cage.hz;
  const me = g.players[1], mates = [g.players[0], g.players[2]], opps = g.players.slice(3);
  // Lage: Passgeber, zwei Mitspieler 5–12 m (nicht im eigenen Torraum, ≥ 30° auseinander), Gegner ≥ 3 m entfernt
  let ok = false, tries = 0, px, pz;
  const pos = [];
  while (!ok && tries++ < 500) {
    px = R.range(-hx + 4, hx - 3); pz = R.range(-hz + 1.2, hz - 1.2);
    pos.length = 0; ok = true;
    for (let k = 0; k < 2 && ok; k++) {
      let placed = false;
      for (let j = 0; j < 60 && !placed; j++) {
        const D = R.range(5, 12), a = R.range(-110, 110) * DEG;
        const x = px + Math.cos(a) * D, z = pz + Math.sin(a) * D;
        if (Math.abs(x) > hx - 1 || Math.abs(z) > hz - 0.8 || g.rules.inBox(0, x, z, 1)) continue;
        if (k === 1 && angDiff(Math.atan2(z - pz, x - px), Math.atan2(pos[0][1] - pz, pos[0][0] - px)) < 30 * DEG) continue;
        pos.push([x, z]); placed = true;
      }
      ok = placed;
    }
    for (let k = 0; k < 3 && ok; k++) {
      let placed = false;
      for (let j = 0; j < 60 && !placed; j++) {
        const x = R.range(-hx + 1, hx - 1), z = R.range(-hz + 0.8, hz - 0.8);
        if (Math.hypot(x - px, z - pz) < 3 || pos.some(([a, b]) => Math.hypot(a - x, b - z) < 1.2)) continue;
        pos.push([x, z]); placed = true;
      }
      ok = placed;
    }
  }
  const want = R.next() < 0.5 ? 0 : 1; // gemeinter Mitspieler (Index in mates)
  const aimAt = () => Math.atan2(mates[want].z - g.ball.p.z, mates[want].x - g.ball.p.x);
  mates[0].place(pos[0][0], pos[0][1], 0); mates[1].place(pos[1][0], pos[1][1], 0);
  opps.forEach((o, i) => o.place(pos[2 + i][0], pos[2 + i][1], Math.PI));
  const a0 = Math.atan2(pos[want][1] - pz, pos[want][0] - px);
  const runA = move === 'lauf' || move === 'sprint' ? a0 + R.range(-70, 70) * DEG : a0 + (move === 'ohne' ? R.gauss() * 10 * DEG : 0);
  me.place(px, pz, runA);
  g.ball.place(px + Math.cos(runA) * 0.4, 0.11, pz + Math.sin(runA) * 0.4);
  g.lastTouch = me.id; g.lastTouchT = 0; me.lastTouchT = 0; g.rules.lastTouchTeam = 0;
  g.rules.updateKeepers(0, true);
  const mag = move === 'sprint' ? 1 : move === 'lauf' ? 0.75 : 0.5;
  const tRun = move === 'lauf' || move === 'sprint' ? R.range(0.8, 1.4) : 0.1;
  const thumbErr = R.gauss() * 8 * DEG;
  const press = gest === 'tipp' ? 0.07 : 0.4;
  let rueck = false, tPress = -1, stickA = null, kick = null, res = null, preview = null, intended = null, freeLane = null, minD = 99, steps = 0;
  const T = tRun + 5;
  while (g.t < T && !res) {
    const t = g.t;
    let inp;
    if (t < tRun) inp = move === 'lauf' || move === 'sprint' ? H({ mx: Math.cos(runA) * mag, mz: Math.sin(runA) * mag, sprint: move === 'sprint' }) : H();
    else {
      if (tPress < 0) {
        tPress = t;
        // Gemeint: Stick (bzw. ohne Stick der Blick) zeigt zum Mitspieler – gemessen ab dem Ball
        stickA = move === 'ohne' ? null : aimAt() + thumbErr;
        const dirA = stickA ?? me.face;
        let best = 99; for (const m of mates) { const d = angDiff(Math.atan2(m.z - g.ball.p.z, m.x - g.ball.p.x), dirA); if (d < best) { best = d; intended = m.id; } }
        const im = g.players[intended];
        rueck = g.rules.isBackPassTarget(im); // gemeint ist der eigene Tormann im Torraum (Rückpass – seit Nacht 2e tabu)
        let lane = 9, open = 9;
        for (const o of opps) { lane = Math.min(lane, segDist(o.x, o.z, g.ball.p.x, g.ball.p.z, im.x, im.z)); open = Math.min(open, Math.hypot(o.x - im.x, o.z - im.z)); }
        freeLane = lane >= 1.5 && open >= 1.5;
      }
      const tt = t - tPress;
      const stickOn = stickA != null && (tt < 0.25 || (thumb === 'halten' && tt < 1.5));
      inp = H({ passDown: tt < press, ...(stickOn ? { mx: Math.cos(stickA) * mag, mz: Math.sin(stickA) * mag, sprint: move === 'sprint' } : {}) });
    }
    // Vorschau wie main.js aimFrame (Stick des Bildes, sonst der beim Tipp gemerkte)
    const pd = me.pending && me.pending.tap ? me.pending : null;
    if (!kick && pd && pd.kind === 'pass') {
      const st = Math.hypot(inp.mx, inp.mz) > 0.12 ? [inp.mx, inp.mz] : pd.stick;
      preview = planPass(g, me, { mode: pd.mode, power: null, stick: st, prefer: pd.lock || null });
    }
    const ins = []; ins[g.human] = inp;
    const ev = g.step(ins); steps++;
    for (const e of ev) {
      if (!kick && e.type === 'kick' && e.player === me.id && intended != null) {
        const lk = me.lastKick;
        let laneK = 9, openK = 9; const im = g.players[intended];
        for (const o of opps) { laneK = Math.min(laneK, segDist(o.x, o.z, e.x, e.z, im.x, im.z)); openK = Math.min(openK, Math.hypot(o.x - im.x, o.z - im.z)); }
        kick = { freeKick: laneK >= 1.5 && openK >= 1.5, t: g.t, dx: e.dx, dz: e.dz, to: lk.to, bank: lk.bank, chip: lk.chip, planDir: lk.planDir, prev: preview, tech: lk.tech, bx: e.x, bz: e.z, mx: lk.meet ? lk.meet[0] : e.x, mz: lk.meet ? lk.meet[1] : e.z, T: lk.T, speed: lk.speed };
        continue;
      }
      if (kick && !res && ['touch', 'kick', 'control', 'catch', 'parry'].includes(e.type) && e.player != null && g.t > kick.t + 0.02) {
        if (e.player === me.id) res = 'selbst';
        else if (e.player === intended) res = 'ok';
        else if (g.players[e.player].team === me.team) res = 'falsch';
        else { res = 'abgefangen'; const dx = g.ball.p.x - kick.bx, dz = g.ball.p.z - kick.bz, L = Math.hypot(kick.mx - kick.bx, kick.mz - kick.bz) || 1; kick.interFrac = (dx * (kick.mx - kick.bx) + dz * (kick.mz - kick.bz)) / (L * L); kick.interT = g.t - kick.t; kick.interRecvD = Math.hypot(g.ball.p.x - g.players[intended].x, g.ball.p.z - g.players[intended].z); kick.passT = kick.T; }
      }
    }
    if (kick && intended != null && g.ball.p.y < 1.2) minD = Math.min(minD, Math.hypot(g.ball.p.x - g.players[intended].x, g.ball.p.z - g.players[intended].z));
    if (kick && g.t > kick.t + 4) break;
  }
  if (rueck) return { move, gest, thumb, kicked: false, rueck: true, res: 'Rückpass gemeint', freeLane };
  if (!kick) return { move, gest, thumb, kicked: false, res: 'kein Pass', freeLane };
  const la = Math.atan2(kick.dz, kick.dx);
  const prevA = kick.prev ? Math.atan2(kick.prev.dir[1], kick.prev.dir[0]) : la;
  const planA = kick.planDir ? Math.atan2(kick.planDir[1], kick.planDir[0]) : la;
  return {
    move, gest, thumb, kicked: true, res: res || 'niemand', freeLane, freeKick: kick.freeKick, cands: kick.cands, intended, to: kick.to, bank: !!kick.bank, free: kick.to < 0,
    selOk: kick.to === intended, prevOk: kick.prev ? kick.prev.to === kick.to : true,
    interFrac: kick.interFrac, interT: kick.interT, interRecvD: kick.interRecvD, passT: kick.T, speed: kick.speed,
    errPrev: angDiff(la, prevA) / DEG, errPlan: angDiff(planA, prevA) / DEG, errNoise: angDiff(la, planA) / DEG, minD, tech: kick.tech,
  };
}

const pctl = (a, q) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * q))]; };
export function summarize(rs0) {
  const rs = rs0.filter((r) => !r.rueck); // gemeint war der eigene Tormann im Torraum: zählt nicht (Rückpass-Regel)
  const n = rs.length, kicked = rs.filter((r) => r.kicked);
  const fr = kicked.filter((r) => r.freeLane), fk = kicked.filter((r) => r.freeKick);
  const share = (a, f) => (a.length ? (a.filter(f).length / a.length) * 100 : NaN);
  return {
    n, kicked: kicked.length,
    ok: share(kicked, (r) => r.res === 'ok'), okFree: share(fr, (r) => r.res === 'ok'), nFree: fr.length,
    okFreeK: share(fk, (r) => r.res === 'ok'), nFreeK: fk.length, okFreeKSel: share(fk.filter((r) => r.selOk), (r) => r.res === 'ok'),
    noKick: n ? (n - kicked.length) / n * 100 : NaN,
    sel: share(kicked, (r) => r.selOk), prevSame: share(kicked, (r) => r.prevOk),
    abgefangen: share(kicked, (r) => r.res === 'abgefangen'), falsch: share(kicked, (r) => r.res === 'falsch'), niemand: share(kicked, (r) => r.res === 'niemand'), selbst: share(kicked, (r) => r.res === 'selbst'),
    bank: share(kicked, (r) => r.bank), free: share(kicked, (r) => r.free),
    errPrev50: pctl(kicked.map((r) => r.errPrev), 0.5), errPrev90: pctl(kicked.map((r) => r.errPrev), 0.9),
    errPlan50: pctl(kicked.map((r) => r.errPlan), 0.5), errPlan90: pctl(kicked.map((r) => r.errPlan), 0.9),
    noise50: pctl(kicked.map((r) => r.errNoise), 0.5), noise90: pctl(kicked.map((r) => r.errNoise), 0.9),
    minD50: pctl(kicked.map((r) => r.minD), 0.5), minD90: pctl(kicked.map((r) => r.minD), 0.9),
  };
}

export const VARIANTS = [
  ['steh', 'tipp', 'los'], ['steh', 'halten', 'halten'], ['ohne', 'tipp', 'los'], ['ohne', 'halten', 'los'],
  ['lauf', 'tipp', 'los'], ['lauf', 'tipp', 'halten'], ['lauf', 'halten', 'halten'],
  ['sprint', 'tipp', 'los'], ['sprint', 'tipp', 'halten'], ['sprint', 'halten', 'halten'],
];
export function runProbe(qs = '', n = 200, seed0 = 1, variants = VARIANTS) {
  const P = makeParams(qs);
  const out = [];
  for (const [move, gest, thumb] of variants) {
    const rs = [];
    for (let k = 0; k < n; k++) rs.push(onePass(P, `${seed0}_${move}_${gest}_${thumb}_${k}`, { move, gest, thumb }));
    out.push({ move, gest, thumb, rs, s: summarize(rs) });
  }
  return out;
}

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
export function table(out) {
  const lines = ['| Variante | Pässe | kommt an (Weg frei beim Abspiel) | kommt an (Weg frei beim Tipp) | kommt an (alle) | Empfänger = gemeint | abgefangen | falscher | niemand | Bande | Freiraum | Vorschau ↔ Abflug p50/p90 | ohne Streuung p50/p90 | Abstand Ball ↔ Gemeinter p50 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const o of out) {
    const s = o.s;
    lines.push(`| ${o.move} · ${o.gest} · Daumen ${o.thumb} | ${s.kicked}/${s.n} | ${f(s.okFreeK)} % (${s.nFreeK}) | ${f(s.okFree)} % (${s.nFree}) | ${f(s.ok)} % | ${f(s.sel)} % | ${f(s.abgefangen)} % | ${f(s.falsch)} % | ${f(s.niemand)} % | ${f(s.bank)} % | ${f(s.free)} % | ${f(s.errPrev50, 1)}° / ${f(s.errPrev90, 1)}° | ${f(s.errPlan50, 1)}° / ${f(s.errPlan90, 1)}° | ${f(s.minD50, 2)} m |`);
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) { // Windows-tauglich (file:///C:/…)
  const n = +(process.argv[2] || 200), qs = process.argv[3] || '';
  const t0 = Date.now();
  const out = runProbe(qs, n);
  console.log(`\n### Pass-Probe ${qs || '(Standard)'} – ${n} je Variante\n`);
  console.log(table(out));
  const all = summarize(out.flatMap((o) => o.rs));
  console.log(`\nGesamt: kommt an ${f(all.ok)} % (Weg frei beim Abspiel: ${f(all.okFreeK)} %, ${all.nFreeK} Pässe; beim Tipp: ${f(all.okFree)} %), kein Pass ${f(all.noKick)} %, abgefangen ${f(all.abgefangen)} %, falscher Mitspieler ${f(all.falsch)} %, niemand ${f(all.niemand)} %, selbst ${f(all.selbst)} %, Empfänger = gemeint ${f(all.sel)} %, Bande ${f(all.bank)} %, Freiraum ${f(all.free)} %`);
  if (process.env.DETAIL) for (const o of out) console.log(o.move, o.gest, o.thumb, JSON.stringify(o.rs.filter((r) => r.res !== 'ok').slice(0, 6).map((r) => ({ res: r.res, sel: r.selOk, to: r.to, int: r.intended, bank: r.bank, d: +r.minD.toFixed(2), e: +r.errPrev.toFixed(1), free: r.freeLane }))));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
