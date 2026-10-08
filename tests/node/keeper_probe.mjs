// Torwart-Probe (Nacht 2c, nach Hermes' briefs/bandenkick-n2c/torwart_probe.mjs): Wie oft wird ein Schuss zum Tor,
// je nach Stufe des gegnerischen Teams bzw. Tormanns? Mannschaft 0 schießt immer mit Stufe 2, Mannschaft 1 spielt mit
// Stufe K (inkl. „letzte Hand“). Je Schuss von Mannschaft 0 wird der Ausgang verfolgt (Tor, gefangen, abgewehrt,
// sonst) und ob es ein „harmloser Roller aufs Tor“ war (vom Boden, ≥ 5 m vor dem Tor, ≤ 12 m/s, flach bis 12°, Richtung ins Tor).
// Aufruf: node tests/node/keeper_probe.mjs [Spiele je Stufe=20] [Query, z. B. "tormann=2"] [Stufen=1,2,3]
// Mit KEEPER_ONLY=1 spielt Mannschaft 1 mit Feldspielern auf Stufe 2 und nur ihr Tormann hat Stufe K.
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { keeperLevel } from '../../src/sim/bots.js';
import { pathToFileURL } from 'node:url';

export function probe(K, n, qs = '', keeperOnly = false, seed0 = 100) {
  const r = { K, shots: 0, goals: 0, goalsAll: 0, catch: 0, parry: 0, dive: 0, rollers: 0, rollerGoals: 0, onTarget: 0, onGoals: 0, games: 0, bySpeed: {} };
  for (let s = 1; s <= n; s++) {
    const g = new Game(makeParams(qs), seed0 + s, { match: true, human: -1, botLevels: keeperOnly ? [2, 2] : [2, K] });
    if (keeperOnly) g.bots.K[1] = keeperLevel(g.P, K); // nur der Tormann von Blau wechselt die Stufe
    let open = null; // laufender Schuss von Mannschaft 0
    const close = (res) => {
      if (!open) return;
      if (open.on) (r.detail || (r.detail = [])).push({ off: open.off, speed: open.speed, D: open.D, q: open.q, res });
      if (open.roller) { r.rollers++; if (res === 'goal') r.rollerGoals++; }
      if (open.on) { r.onTarget++; if (res === 'goal') r.onGoals++; }
      const b = open.speed < 12 ? '<12' : open.speed < 18 ? '12-18' : open.speed < 24 ? '18-24' : '≥24';
      const e = r.bySpeed[b] || (r.bySpeed[b] = { n: 0, goals: 0 });
      e.n++; if (res === 'goal') e.goals++;
      open = null;
    };
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 300) {
      for (const e of g.step([])) {
        if (e.type === 'kick' && e.player != null) {
          const pl = g.players[e.player];
          if (open && pl.team === 1) close('keeper-or-def');
          else if (open && pl.team === 0 && g.t - open.t > 0.05) close('other');
          if (e.kind === 'shot' && pl.team === 0) {
            r.shots++;
            const gx = g.cage.hx, b = g.ball;
            const tx = (gx - e.x) / (e.dx || 1e-6), zc = e.z + e.dz * tx;
            const on = e.dx > 0 && Math.abs(zc) < g.cage.gw - 0.1;
            const elev = Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)) * 180 / Math.PI;
            const kp = g.players[g.rules.keeper[1]];
            const tk = kp ? (kp.x - e.x) / (e.dx || 1e-6) : 0, off = kp ? Math.abs(e.z + e.dz * tk - kp.z) : 9;
            open = { t: g.t, speed: e.speed, on, roller: on && e.speed <= 12 && elev < 12 && e.y < 0.3 && Math.hypot(gx - e.x, e.z) >= 5, off, D: Math.hypot(gx - e.x, e.z), q: e.q };
          }
        }
        if (e.type === 'goal') { if (e.team === 0) { r.goalsAll++; if (open) { r.goals++; close('goal'); } } else close('other'); }
        if (e.type === 'catch' && g.players[e.player].team === 1) { r.catch++; close('catch'); }
        if (e.type === 'parry' && g.players[e.player].team === 1) { r.parry++; if (e.tip) r.tip = (r.tip || 0) + 1; if (open) open.parryT = g.t; }
        if (e.type === 'dive' && g.players[e.player].team === 1) r.dive++;
        if (e.type === 'touch' && open && g.players[e.player].team === 1) close('def');
      }
      if (open && (g.t - open.t > 3 || (open.parryT && g.t - open.parryT > 1.2))) close(open.parryT ? 'parry' : 'other');
    }
    close('other');
    r.games++;
  }
  return r;
}

export const fmtProbe = (r) => `Stufe ${r.K}: ${r.goalsAll}/${r.shots} Tore je Schuss = ${(100 * r.goalsAll / Math.max(1, r.shots)).toFixed(1)} % ` +
  `(direkt ${(100 * r.goals / Math.max(1, r.shots)).toFixed(1)} %, aufs Tor ${r.onGoals}/${r.onTarget} = ${(100 * r.onGoals / Math.max(1, r.onTarget)).toFixed(0)} %), ` +
  `Roller ${r.rollerGoals}/${r.rollers}, je Spiel: Schüsse ${(r.shots / r.games).toFixed(1)}, Fangen ${(r.catch / r.games).toFixed(1)}, Abwehr ${(r.parry / r.games).toFixed(1)} (Fingerspitzen ${((r.tip || 0) / r.games).toFixed(1)}), Hechten ${(r.dive / r.games).toFixed(1)} | ` +
  Object.entries(r.bySpeed).sort().map(([k, v]) => `${k} m/s ${v.goals}/${v.n}`).join(', ');

if (import.meta.url === pathToFileURL(process.argv[1]).href) { // Windows-tauglich (file:///C:/…)
  const n = +(process.argv[2] || 20), qs = process.argv[3] || '', lv = (process.argv[4] || '1,2,3').split(',').map(Number);
  for (const K of lv) {
    const r = probe(K, n, qs, !!process.env.KEEPER_ONLY, +(process.env.PROBE_SEED || 100));
    if (process.env.PROBE_JSON) { delete r.detail; console.log(JSON.stringify(r)); continue; }
    console.log(fmtProbe(r));
    if (process.env.DETAIL) { // aufs Tor: Ausgang nach seitlichem Abstand Ball ↔ Tormann beim Schuss
      const bins = [0, 0.5, 1, 1.5, 2, 9];
      for (let i = 0; i < bins.length - 1; i++) {
        const d = r.detail.filter((x) => x.off >= bins[i] && x.off < bins[i + 1]);
        const c = {}; for (const x of d) c[x.res] = (c[x.res] || 0) + 1;
        console.log(`  Abstand ${bins[i]}–${bins[i + 1]} m: ${d.length} Schüsse, Ø ${(d.reduce((a, x) => a + x.speed, 0) / (d.length || 1)).toFixed(1)} m/s, ${JSON.stringify(c)}`);
      }
    }
  }
}
