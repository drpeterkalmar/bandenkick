// Dribbel-Probe (Nacht 2c, Ballmagnet): Ballverluste beim Führen im Selbstspiel und Dribbel-Parcours mit Skript-Spieler.
// Ballverlust beim Führen: ein Spieler hat den Ball zuletzt mit einem Führ-Kontakt (touch, kein Pass/Schuss) berührt,
// und als Nächstes kommt ein Gegner an den Ball (Kontakt, Kick, Fangen, Grätsche) – ohne dass er ihn vorher abspielt.
// Aufruf: node tests/node/dribble_probe.mjs [Spiele=20] [Query, z. B. "magnet=0"]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { playChallenge, makeScript } from './scripts.mjs';
import { EMPTY_INPUT } from '../../src/sim/player.js';

export function dribbleLosses(qs = '', n = 20, seed0 = 500) {
  const r = { games: 0, minutes: 0, losses: 0, duel: 0, free: 0, keeps: 0, touches: 0, dribbleT: 0, tackles: 0, tackleBall: 0 };
  for (let s = 1; s <= n; s++) {
    const g = new Game(makeParams(qs), seed0 + s, { match: true, human: -1, botLevels: [((s - 1) % 3) + 1, (Math.floor((s - 1) / 3) % 3) + 1] });
    let dr = -1, drT = 0, duel = false;
    const lose = () => { r.losses++; if (duel) r.duel++; else r.free++; };
    const oppDist = (p) => { let m = 9; for (const o of g.players) if (o.team !== p.team) m = Math.min(m, Math.hypot(o.x - g.ball.p.x, o.z - g.ball.p.z)); return m; };
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 300) {
      for (const e of g.step([])) {
        if (e.type === 'tackle' && e.phase === 'hit') { r.tackles++; if (e.result === 'ball') r.tackleBall++; } // Nacht 2d
        const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
        if (!p) { if (e.type === 'goal' || e.type === 'restart') dr = -1; continue; }
        if (e.type === 'touch') {
          if (dr >= 0 && p.team !== g.players[dr].team) { lose(); dr = -1; }
          if (dr !== p.id) drT = g.t;
          dr = p.id; r.touches++; duel = oppDist(p) < 1.5; // Zweikampf: Gegner beim eigenen Kontakt ≤ 1,5 m am Ball
        } else if (e.type === 'kick' || e.type === 'throw' || e.type === 'punt') {
          if (dr >= 0) { if (p.team !== g.players[dr].team) lose(); else if (p.id === dr) r.keeps++; }
          dr = -1;
        } else if (e.type === 'catch' || e.type === 'parry' || e.type === 'control' || (e.type === 'tackle' && e.phase === 'hit')) {
          if (dr >= 0 && p.team !== g.players[dr].team) lose();
          dr = -1;
        }
      }
      if (dr >= 0) r.dribbleT += DT;
      void drT;
    }
    r.games++; r.minutes += g.rules.clock / 60;
  }
  return r;
}

// Dribbel-Parcours mit dem Skript-Spieler: Zeit und Ballverluste (Ball > 1,5 m vom Spieler, bevor alle Tore durch sind)
export function parcours(qs = '', seeds = [1, 2, 3, 4, 5, 6], naive = false, sprint = false) {
  const out = [];
  for (const seed of seeds) {
    let lost = 0, far = false;
    const { res } = playChallenge(Game, makeParams(qs), 'dribbel', { seed, script: makeScript('dribbel', { naive, sprint }), onEvent: (e, g, C) => {
      const me = g.players[0], b = g.ball, d = Math.hypot(b.p.x - me.x, b.p.z - me.z);
      if (C.next < C.gates.length && C.t0 != null) { if (d > 1.5 && !far) { lost++; far = true; } else if (d < 0.9) far = false; }
    } });
    out.push({ seed, time: res.score, lost, pen: res.log.length ? (res.log.at(-1).text.match(/(\d+) s Strafe/) || [0, 0])[1] : null });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 20), qs = process.argv[3] || '';
  for (const naive of [false, true]) {
    const pc = parcours(qs, [1, 2, 3, 4, 5, 6], naive);
    const tm = pc.map((x) => x.time).filter((x) => x != null);
    console.log(`Parcours ${naive ? '„Kinderhand“' : 'Skript'} (${qs || 'Standard'}): Zeit Ø ${(tm.reduce((a, b) => a + b, 0) / Math.max(1, tm.length)).toFixed(2)} s, Ballverluste ${pc.reduce((a, x) => a + x.lost, 0)} in ${pc.length} Läufen | ${pc.map((x) => `${x.time}/${x.lost}${+x.pen ? '(+' + x.pen + ')' : ''}`).join(' ')}`);
  }
  const r = dribbleLosses(qs, n);
  console.log(`Selbstspiel (${n} Spiele): Ballverluste beim Führen ${r.losses} = ${(r.losses / r.minutes).toFixed(2)} je Minute (Zweikampf ${(r.duel / r.minutes).toFixed(2)}, verspringt ${(r.free / r.minutes).toFixed(2)}), Führ-Kontakte ${(r.touches / r.minutes).toFixed(1)} je Minute, Führen bis zum eigenen Abspiel ${r.keeps}, Ballbesitz am Fuß ${(r.dribbleT / r.minutes).toFixed(1)} s je Minute`);
}

// „Kinderhand“-Führen (Nacht 2c): ein Spieler führt 60 s frei über das Feld, der Stick wechselt alle 0,5–1,2 s die
// Richtung (bis ±70°) und zittert (±15°), an der Bande dreht er zur Mitte; optional ein Bot-Gegner (Stufe 2), der den
// Ball jagt. Gezählt: Ball weg (> 1,5 m vom Fuß, erst < 0,8 m wieder „am Fuß“) bzw. Gegner am Ball, je Minute.
export function kidDribble(qs = '', { seed = 1, secs = 60, sprint = 0.3, opp = false } = {}) {
  const P = makeParams(qs);
  const g = new Game(P, seed, { match: true, human: 0, perTeam: opp ? [1, 1] : [1, 0], botLevels: [2, 2] });
  g.rules.phase = 'play'; g.rules.handsOffTeam = 0;
  const pl = g.players[0], b = g.ball, R = g.rng;
  pl.place(-6, 0, 0); b.place(-5.6, b.r, 0);
  if (opp) g.players[1].place(6, 0, Math.PI);
  let head = 0, next = 0, far = false, lost = 0, oppGot = 0, dist = 0, sp = false, t = 0;
  let jit = 0, inWall = false, lostRev = 0, lastRevT = -9;
  for (let i = 0; i < secs / DT; i++) {
    t += DT;
    if (t >= next) { head += (R.next() * 2 - 1) * 70 * Math.PI / 180; next = t + 0.5 + R.next() * 0.7; sp = R.next() < sprint; }
    if (i % 6 === 0) jit = (R.next() * 2 - 1) * 15 * Math.PI / 180;
    // an der Bande: Richtung zur Mitte
    const wall = Math.abs(pl.x) > g.cage.hx - 2.5 || Math.abs(pl.z) > g.cage.hz - 2;
    if (wall && !inWall) { head = Math.atan2(-pl.z, -pl.x) + (R.next() - 0.5); next = t + 0.8; }
    inWall = wall;
    const [fx, fz] = pl.footPoint(), d = Math.hypot(b.p.x - fx, b.p.z - fz);
    let a = head + jit;
    if (far) { a = Math.atan2(b.p.z - pl.z, b.p.x - pl.x); head = a; next = Math.max(next, t + 0.4); } // Ball weg: hinlaufen, dann weiter in diese Richtung
    // Nacht 2d: Kehrtwende (Stick > 150° gegen die Laufrichtung) – dort lässt der Magnet den Ball absichtlich los
    if (!far && pl.speed > 1 && Math.cos(a) * pl.hx + Math.sin(a) * pl.hz < Math.cos(150 * Math.PI / 180)) lastRevT = t;
    const ev = g.step([{ ...EMPTY_INPUT, mx: Math.cos(a), mz: Math.sin(a), sprint: sp && !far, passDown: false, shotDown: false }]);
    for (const e of ev) if (opp && e.player === 1 && (e.type === 'touch' || e.type === 'kick')) { oppGot++; b.place(pl.x + Math.cos(pl.face) * 0.5, b.r, pl.z + Math.sin(pl.face) * 0.5); g.players[1].place(pl.x + 6 * Math.sign(-pl.x || 1), 0, 0); g.lastTouch = 0; }
    if (!far && d > 1.5) { far = true; lost++; if (t - lastRevT < 1) lostRev++; } else if (far && d < 0.8) far = false;
    if (!far) dist += pl.speed * DT;
    if (g.rules.phase !== 'play') { g.rules.phase = 'play'; b.place(pl.x + 0.5, b.r, pl.z); }
  }
  return { lost: lost / (secs / 60), lostRev: lostRev / (secs / 60), oppGot: oppGot / (secs / 60), speed: dist / secs };
}
