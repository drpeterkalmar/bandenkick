// n15 E10: Ballannahme aus der Luft und Führen mit Richtungswechseln. Luftbälle: ein hoher Ball kommt aus 8–12 m auf den gesteuerten
// Spieler zu (Ankunft 0,4–1,55 m Höhe, Spieler steht oder läuft, Stick zum Ball bzw. los); sauber angenommen = binnen 1,2 s eigener
// Kontakt und 1 s danach liegt der Ball ≤ 1,2 m vor ihm. Führen: kidDribble (Richtungswechsel bis ±70°, mit Bot-Gegner), Parcours-Zeit.
// Aufruf: node tests/node/n15_annahme_probe.mjs ["qs"]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { kidDribble, parcours } from './dribble_probe.mjs';
import { pathToFileURL } from 'node:url';

export function luftAnnahme(qs = '', n = 120) {
  const P = makeParams(qs), R = new Rng('ann');
  let ok = 0, tot = 0;
  for (let k = 0; k < n; k++) {
    const g = new Game(P, 'a' + k, { match: true, human: 0, perTeam: [1, 0], bots: false });
    g.rules.phase = 'play'; g.rules.handsOffTeam = 0;
    const pl = g.players[0], b = g.ball;
    const run = R.next() < 0.5, h = 0.4 + R.next() * 1.15, D = 8 + R.next() * 4, a = R.range(-0.8, 0.8);
    pl.place(0, 0, Math.PI + a); if (run) { pl.vx = 3 * Math.cos(Math.PI + a); pl.vz = 3 * Math.sin(Math.PI + a); }
    // Ball: von (D·cos a, D·sin a) auf den Spieler, Flugzeit T, Ankunftshöhe h (ohne Luftwiderstand grob, Rest erledigt die Physik)
    const T = 0.9 + R.next() * 0.4, sx = D * Math.cos(a), sz = D * Math.sin(a), ex = run ? pl.vx * T * 0.5 : 0, ez = run ? pl.vz * T * 0.5 : 0;
    b.place(sx, 0.3, sz); const vy = (h - 0.3 + 0.5 * P.g * T * T) / T;
    b.v.set((ex - sx) / T * 1.08, vy, (ez - sz) / T * 1.08); b.w.set(0, 0, 0); b.contact = false;
    g.lastTouch = -1;
    let touchT = -1; tot++;
    for (let i = 0; i < (T + 2.2) / DT; i++) {
      const dx = b.p.x - pl.x, dz = b.p.z - pl.z, l = Math.hypot(dx, dz) || 1;
      const stick = i % 2 === 0 && k % 3 !== 0 ? { mx: dx / l * 0.6, mz: dz / l * 0.6 } : {};
      const ev = g.step([{ ...EMPTY_INPUT, passDown: false, shotDown: false, ...stick }]);
      for (const e of ev) if ((e.type === 'touch' || e.type === 'control') && e.player === 0 && touchT < 0) touchT = g.t;
      if (touchT > 0 && g.t - touchT > 1.0) break;
    }
    if (touchT > 0 && Math.hypot(b.p.x - pl.x, b.p.z - pl.z) <= 1.2) ok++;
  }
  return { ok, tot, quote: ok / tot };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const qs = process.argv[2] || '';
  for (const q of ['ballfuehrung=0' + (qs ? '&' + qs : ''), qs]) {
    const L = luftAnnahme(q);
    let lost = 0, rev = 0, opp = 0; for (let s = 1; s <= 6; s++) { const r = kidDribble(q, { seed: s, opp: true }); lost += r.lost; rev += r.lostRev; opp += r.oppGot; }
    const pc = parcours(q), tm = pc.map((x) => x.time).filter((x) => x != null);
    console.log(`${q || 'Standard'} | Luftbälle sauber angenommen ${L.ok}/${L.tot} = ${(100 * L.quote).toFixed(0)} % | Führen mit Wenden: Ball weg ${(lost / 6).toFixed(2)}/min (bei Kehrtwende ${(rev / 6).toFixed(2)}), Gegner am Ball ${(opp / 6).toFixed(2)}/min | Parcours Ø ${(tm.reduce((x, y) => x + y, 0) / Math.max(1, tm.length)).toFixed(2)} s, Ballverluste ${pc.reduce((x, y) => x + y.lost, 0)}`);
  }
}
