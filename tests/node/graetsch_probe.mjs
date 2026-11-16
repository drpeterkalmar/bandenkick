// Peter 16.11. („keine ständigen Auto-Grätschen“): Skript-Mensch (Bots Stufe 2) jagt den Ball bzw. führt ihn zum Tor und drückt den
// Kick-Knopf alle 0,4–2,5 s (wie n15_kick_probe). Gezählt je Spielminute: Grätschen des gesteuerten Spielers (davon „sinnvoll“ = Gegner
// führt den Ball ≤ 1 m am Fuß, Angriff von vorn/seitlich), Ballgewinne durch seine Grätsche (eigenes Team berührt binnen 1,5 s als
// Nächstes), Grätschen der Mitspieler-Bots und der Gegner-Bots.
// Aufruf: node tests/node/graetsch_probe.mjs [Spiele=12] ["qs"]
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { pathToFileURL } from 'node:url';

const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
export function probe(qs = '', spiele = 12, seed0 = 1) {
  const P = makeParams('dauer=3&' + qs);
  const r = { min: 0, drueck: 0, mensch: 0, sinnvoll: 0, gewinn: 0, mit: 0, geg: 0, hinten: 0, frei: 0, tore: [0, 0] };
  for (let s = 0; s < spiele; s++) {
    const g = new Game(P, 'gp' + (seed0 + s), { match: true, human: 1, botLevel: 2 });
    const R = new Rng('gpr' + (seed0 + s));
    let next = 1 + R.range(0.4, 2.5), downT = -1, offen = [];
    const t0 = g.t;
    while (g.rules.phase !== 'end') {
      const me = g.players[g.human], b = g.ball, gx = me.team === 0 ? g.cage.hx : -g.cage.hx;
      const mine = g.lastTouch === me.id && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 1.5 && b.held < 0;
      let mx = 0, mz = 0;
      if (mine) { const l = Math.hypot(gx - me.x, -me.z * 0.5) || 1; mx = (gx - me.x) / l * 0.8; mz = -me.z * 0.5 / l * 0.8; }
      else { const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1; if (l > 0.3) { mx = dx / l; mz = dz / l; } }
      if (g.t >= next) { next = g.t + R.range(0.4, 2.5); downT = g.t; if (g.rules.phase === 'play') r.drueck++; }
      const down = downT >= 0 && g.t - downT < 0.07;
      const ins = []; ins[g.human] = H({ mx, mz, shotDown: down });
      const ev = g.step(ins);
      for (const e of ev) {
        if (e.type === 'tackle' && e.phase === 'start') {
          const pl = g.players[e.player];
          if (e.player === g.human) {
            r.mensch++;
            // Lage beim Start: führt ein Gegner den Ball (zuletzt berührt ≤ 1 s, Ball ≤ 1 m vom Fuß)? Von hinten = hinter seiner Laufrichtung
            const lt = g.lastTouch >= 0 ? g.players[g.lastTouch] : null;
            let fuehrt = false, hinten = false;
            if (lt && lt.team !== pl.team && g.t - lt.lastTouchT < 1.0) {
              const [fx, fz] = lt.footPoint();
              fuehrt = Math.hypot(b.p.x - fx, b.p.z - fz) < 1.0;
              const ox = Math.cos(lt.face), oz = Math.sin(lt.face), dx = pl.x - lt.x, dz = pl.z - lt.z, d = Math.hypot(dx, dz) || 1;
              hinten = (dx * ox + dz * oz) / d < -0.5; // mehr als 120° hinter seiner Blickrichtung
            }
            if (!fuehrt) r.frei++; else if (hinten) r.hinten++; else r.sinnvoll++;
            offen.push({ t: g.t, team: pl.team });
          } else if (pl.team === g.players[g.human].team) r.mit++; else r.geg++;
        }
        if (e.type === 'goal') r.tore[e.team ?? 0]++;
      }
      // Ballgewinn: nach der Grätsche des Menschen berührt binnen 1,5 s zuerst das eigene Team den Ball, vorher hatte der Gegner ihn
      if (offen.length) {
        const o = offen[0];
        if (g.lastTouch >= 0 && g.lastTouchT > o.t) { if (g.players[g.lastTouch].team === o.team) r.gewinn++; offen.shift(); }
        else if (g.t - o.t > 1.5) offen.shift();
      }
    }
    r.min += (g.t - t0) / 60;
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const N = +(process.argv[2] || 12), qs = process.argv[3] || '';
  const r = probe(qs, N);
  const pm = (x) => (x / r.min).toFixed(2);
  console.log(`${qs || 'Standard'} · ${N} Spiele · ${r.min.toFixed(1)} min · Drücke ${r.drueck}`);
  console.log(`  Mensch Grätschen ${r.mensch} (${pm(r.mensch)}/min): sinnvoll ${r.sinnvoll}, freier Ball/Gegner ohne Ball ${r.frei}, von hinten ${r.hinten} · Ballgewinne ${r.gewinn} (${pm(r.gewinn)}/min)`);
  console.log(`  Mitspieler-Bots ${r.mit} (${pm(r.mit)}/min) · Gegner-Bots ${r.geg} (${pm(r.geg)}/min)`);
}
