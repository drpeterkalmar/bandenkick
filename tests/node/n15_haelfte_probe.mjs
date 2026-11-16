// n15 E2: Torschüsse aus der eigenen Hälfte im Bot-Selbstspiel (alle Spieler) und Fänge des Tormanns aus Distanz (Schuss ≥ 12 m vor
// dem Tor). Zusätzlich Tore, Befreiungsschläge, Ecken-Schüsse. Aufruf: node tests/node/n15_haelfte_probe.mjs [Spiele=12] ["qs"]
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

export function haelfte(qs = '', games = 12, seed0 = 500) {
  const r = { games, schuesse: 0, eigen: 0, fernFang: 0, tore: 0, befreiung: 0, ecke: 0 };
  for (let s = 0; s < games; s++) {
    let last = null;
    playGame(seed0 + s, { qs, onStep: (g, ev) => {
      for (const e of ev) {
        if (e.type === 'kick' && e.kind === 'shot') {
          const pl = g.players[e.player], gx = pl.team === 0 ? g.cage.hx : -g.cage.hx;
          r.schuesse++;
          const own = Math.sign(gx) * e.x < 0;
          if (own) r.eigen++;
          last = { D: Math.hypot(gx - e.x, e.z), team: pl.team, t: g.t };
        }
        if (e.type === 'catch' && last && g.t - last.t < 3 && g.players[e.player].team !== last.team && last.D >= 12) { r.fernFang++; last = null; }
        if (e.type === 'goal') r.tore++;
        if (e.type === 'befreiung') { r.befreiung++; if (e.ecke) r.ecke++; }
      }
    } });
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 12), qs = process.argv[3] || '';
  for (const q of ['eigenhaelfte=0' + (qs ? '&' + qs : ''), qs]) {
    const r = haelfte(q, G);
    console.log(`${q || 'Standard'} | Schüsse ${r.schuesse} · aus der eigenen Hälfte ${r.eigen} · Fänge nach Schuss aus ≥ 12 m ${r.fernFang} · Tore ${r.tore} · Befreiungen ${r.befreiung} (davon Ecke ${r.ecke}) · je Spiel ${(r.tore / G).toFixed(1)} Tore`);
  }
}
