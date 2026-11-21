// n16 Nachtrag 1 B (Peter 21.11.: „aus der Ecke eher flanken als schießen“): Schüsse im Bot-Selbstspiel nach sichtbarem Torwinkel
// (Öffnung zwischen den Pfosten vom Ball aus) und Abstand zur Grundlinie, Tor binnen 3 s; Pässe aus der Eckzone und was danach kommt.
// Aufruf: node tests/node/n16_ecke_probe.mjs [Spiele=8] ["qs"]
import { playGame } from './selfplay.mjs';
import { eckZone, torWinkel } from '../../src/sim/akro.js';
import { pathToFileURL } from 'node:url';

export function ecke(qs = '', games = 8, seed0 = 700) {
  const B = [0, 8, 12, 16, 20, 25, 181], r = { games, tore: 0, buckets: B.slice(1).map(() => ({ n: 0, tor: 0 })), eckSchuss: 0, eckSchussTor: 0, eckPass: 0, eckPassTor: 0 };
  for (let s = 0; s < games; s++) {
    let last = null; const eckP = [-9, -9];
    playGame(seed0 + s, { qs, onStep: (g, ev) => {
      for (const e of ev) {
        if (e.type === 'kick' && (e.kind === 'shot' || e.kind === 'pass')) {
          const pl = g.players[e.player], gx = pl.team === 0 ? g.cage.hx : -g.cage.hx;
          if (Math.sign(gx) * e.x < 0) continue;
          const w = torWinkel(g.P, gx, e.x, e.z), ez = eckZone(g.P, gx, e.x, e.z);
          if (e.kind === 'shot') {
            const i = B.findIndex((b, k) => k > 0 && w < b) - 1;
            r.buckets[i].n++; if (ez) r.eckSchuss++;
            last = { i, ez, team: pl.team, t: g.t, kind: 'shot' };
          } else if (ez) { r.eckPass++; eckP[pl.team] = g.t; }
        }
        if (e.type === 'goal') {
          r.tore++;
          if (last && last.team === e.team && g.t - last.t < 3.5) { r.buckets[last.i].tor++; if (last.ez) r.eckSchussTor++; }
          if (g.t - eckP[e.team] < 3.5) r.eckPassTor++;
          eckP[0] = eckP[1] = -9;
          last = null;
        }
      }
    } });
  }
  r.B = B; return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8), qs = process.argv[3] || '';
  for (const q of ['eckflanke=0' + (qs ? '&' + qs : ''), qs]) {
    const r = ecke(q, G);
    console.log(`${q || 'Standard'} | Tore ${r.tore} (${(r.tore / G).toFixed(1)}/Spiel) · Schüsse nach Torwinkel: ` + r.buckets.map((b, i) => `${r.B[i]}–${r.B[i + 1]}°: ${b.tor}/${b.n}`).join(' · ') +
      ` · Eckzone: Schüsse ${r.eckSchussTor}/${r.eckSchuss} Tore, Pässe ${r.eckPass} (Tor binnen 3,5 s: ${r.eckPassTor})`);
  }
}
