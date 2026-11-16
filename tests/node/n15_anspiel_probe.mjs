// n15 E9: Tormann-Bälle im Bot-Selbstspiel. Je gehaltenem Ball (Tormann hat ihn in der Hand, bis zum Abwurf/Abschlag): stand beim
// Abwurf ein Mitspieler vorn (jenseits der Mittellinie)? Erreicht der Abwurf einen Mitspieler (nächste Berührung eigenes Team)?
// Konter-Tore (Tor des Teams ≤ 8 s nach dem Abwurf). Aufruf: node tests/node/n15_anspiel_probe.mjs [Spiele=8] ["qs"]
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

export function anspiel(qs = '', games = 8, seed0 = 700) {
  const r = { games, lauf: 0, ansp: 0, anspOk: 0, haelt: 0, vorn: 0, mitspieler: 0, gegner: 0, konter: 0, tore: 0 };
  for (let s = 0; s < games; s++) {
    let held = -1, open = null, konter = null;
    playGame(seed0 + s, { qs, onStep: (g, ev) => {
      const b = g.ball;
      if (held >= 0 && b.held < 0) { // Abwurf
        const kp = g.players[held], sd = kp.team === 0 ? 1 : -1;
        r.haelt++;
        if (g.players.some((m) => m.team === kp.team && m.id !== kp.id && m.x * sd > 0)) r.vorn++;
        // Anspielstation läuft: ein Mitspieler sprintet nach vorn (≥ 2,5 m/s Richtung gegnerisches Tor) oder ist schon über der Mittellinie
        if (g.players.some((m) => m.team === kp.team && m.id !== kp.id && (m.x * sd > 0 || m.vx * sd > 2.5))) r.lauf++;
        open = { team: kp.team, from: kp.id, ansp: ev.some((e) => e.type === 'anspiel') || g._ansp, art: (g.ball.v.y > 0 ? 'hoch' : 'flach') + (ev.some((e) => e.type === 'sixsec') ? '-zwang' : '') + ':' + g.players[held].holdT.toFixed(1) }; g._ansp = false; if (open.ansp) r.ansp++; konter = { team: kp.team, t: g.t };
      }
      held = b.held;
      for (const e of ev) if (e.type === 'anspiel') g._ansp = true;
      for (const e of ev) {
        if (open && e.player != null && e.player !== open.from && ['touch', 'kick', 'control', 'catch', 'air'].includes(e.type)) {
          if (g.players[e.player].team === open.team) { r.mitspieler++; if (open.ansp) r.anspOk++; } else { r.gegner++; (r.ab || (r.ab = [])).push(open.art + (open.ansp ? '-lauf' : '')); }
          open = null;
        }
        if (e.type === 'goal') { r.tore++; if (konter && konter.team === e.team && g.t - konter.t <= 8) r.konter++; konter = null; }
      }
    } });
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8), qs = process.argv[3] || '';
  for (const q of ['anspiel=0' + (qs ? '&' + qs : ''), qs]) {
    const r = anspiel(q, G);
    if (process.env.AB) console.log(r.ab);
    console.log(`${q || 'Standard'} | Tormann-Bälle ${r.haelt} · Anspielstation läuft vorn ${(100 * r.lauf / Math.max(1, r.haelt)).toFixed(0)} % · schon über der Mittellinie ${(100 * r.vorn / Math.max(1, r.haelt)).toFixed(0)} % · Abwurf erreicht Mitspieler ${(100 * r.mitspieler / Math.max(1, r.mitspieler + r.gegner)).toFixed(0)} % (Gegner ${r.gegner}) · davon in den Lauf ${r.ansp}, angekommen ${r.anspOk} · Konter-Tore ${(r.konter / G).toFixed(2)}/Spiel · Tore ${(r.tore / G).toFixed(1)}/Spiel`);
  }
}
