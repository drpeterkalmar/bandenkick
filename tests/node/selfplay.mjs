// Selbstspiel: Bots gegen Bots im Zeitraffer (ohne Grafik). Findet Hänger (Ball eingeklemmt/liegt fest,
// Bots laufen im Kreis, Ball zu lange in der Hand) und zählt Tore, Schüsse, Pässe, Paraden.
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';

export function playGame(seed, { qs = '', levels = null, maxT = null } = {}) {
  const P = makeParams(qs);
  const g = new Game(P, seed, { match: true, human: -1, botLevels: levels });
  const cage = g.cage;
  const st = { seed, goals: [0, 0], events: {}, stuck: [], faults: 0, holdMax: 0, t: 0, keeperSwitches: 0, touches: 0, kicks: {}, air: {}, airGoals: {}, tech: {} };
  let lastAir = null;
  // Spielzeit + Unterbrechungen (Jubel und Anstoß je Tor ≈ 4 s; Nacht 2d: bis 32 Tore in Stufe 3 gegen 1 → 300 s Puffer)
  const limit = maxT ?? (g.rules.halfLen * 2 + 300);
  // Hänger-Erkennung
  let ballRef = { x: 0, z: 0, t: 0 }, cornerT = 0;
  const track = g.players.map((p) => ({ x0: p.x, z0: p.z, path: 0, px: p.x, pz: p.z, t0: 0, minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z, touchT: 0 }));
  while (g.rules.phase !== 'end' && g.t < limit) {
    const ev = g.step([]);
    for (const e of ev) {
      st.events[e.type] = (st.events[e.type] || 0) + 1;
      if (e.type === 'goal') st.goals[e.team]++;
      if (e.type === 'keeper') st.keeperSwitches++;
      if (e.type === 'kick') { st.kicks[e.kind] = (st.kicks[e.kind] || 0) + 1; if (e.tech) st.tech[e.tech] = (st.tech[e.tech] || 0) + 1; lastAir = null; }
      if (e.type === 'air') { st.air[e.tech] = (st.air[e.tech] || 0) + 1; lastAir = { tech: e.tech, t: g.t, team: g.players[e.player].team }; }
      if (e.type === 'goal' && lastAir && lastAir.team === e.team && g.t - lastAir.t < 2.5) st.airGoals[lastAir.tech] = (st.airGoals[lastAir.tech] || 0) + 1;
      if (e.type === 'touch' || e.type === 'kick') { st.touches++; if (e.player != null) track[e.player].touchT = g.t; }
    }
    const b = g.ball, live = g.rules.phase === 'play';
    for (const p of g.players) st.holdMax = Math.max(st.holdMax, b.held === p.id ? p.holdT : 0);
    if (!live || b.held >= 0) { ballRef = { x: b.p.x, z: b.p.z, t: g.t }; cornerT = 0; }
    else {
      if (Math.hypot(b.p.x - ballRef.x, b.p.z - ballRef.z) > 0.6) ballRef = { x: b.p.x, z: b.p.z, t: g.t };
      else if (g.t - ballRef.t > 8) { st.stuck.push({ kind: 'Ball liegt fest', t: +g.t.toFixed(1), x: +b.p.x.toFixed(1), z: +b.p.z.toFixed(1) }); ballRef.t = g.t; }
      const corner = Math.abs(b.p.x) > cage.hx - 1 && Math.abs(b.p.z) > cage.hz - 1;
      cornerT = corner ? cornerT + DT : 0;
      if (cornerT > 6) { st.stuck.push({ kind: 'Ball in der Ecke eingeklemmt', t: +g.t.toFixed(1) }); cornerT = 0; }
    }
    if (g.tick % 12 === 0) {
      for (const p of g.players) {
        const tr = track[p.id];
        tr.path += Math.hypot(p.x - tr.px, p.z - tr.pz); tr.px = p.x; tr.pz = p.z;
        tr.minX = Math.min(tr.minX, p.x); tr.maxX = Math.max(tr.maxX, p.x); tr.minZ = Math.min(tr.minZ, p.z); tr.maxZ = Math.max(tr.maxZ, p.z);
        if (g.t - tr.t0 > 6) {
          const box = Math.max(tr.maxX - tr.minX, tr.maxZ - tr.minZ);
          if (tr.path > 22 && box < 3.0 && g.t - tr.touchT > 6 && live) st.stuck.push({ kind: 'Bot läuft im Kreis', player: p.id, t: +g.t.toFixed(1), path: +tr.path.toFixed(1), box: +box.toFixed(1) });
          Object.assign(tr, { path: 0, t0: g.t, minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z });
        }
      }
    }
  }
  st.faults = g.faults; st.t = g.t; st.score = [...g.score]; st.phase = g.rules.phase;
  st.bot = g.bots.stats;
  return st;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 4), qs = process.argv[3] || 'dauer=1';
  const t0 = performance.now();
  let steps = 0;
  const all = [];
  for (let s = 1; s <= n; s++) {
    const r = playGame(s, { qs });
    steps += r.t / DT; all.push(r);
    console.log(`Spiel ${s}: ${r.score.join(':')} nach ${r.t.toFixed(0)} s, Hänger ${r.stuck.length}${r.stuck.length ? ' ' + JSON.stringify(r.stuck.slice(0, 3)) : ''}, Fehler ${r.faults}, Halten max ${r.holdMax.toFixed(1)} s, Kicks ${JSON.stringify(r.kicks)}, Ereignisse ${JSON.stringify(r.events)}, Bots ${JSON.stringify(r.bot)}`);
  }
  const ms = performance.now() - t0;
  console.log(`${n} Spiele, ${(ms / 1000).toFixed(1)} s Rechenzeit, ${(ms * 1000 / steps).toFixed(1)} µs je Takt, Zeitraffer ${(steps * DT * 1000 / ms).toFixed(0)}×`);
}
