// Mitspieler-Stellung (Peter 13.11.: „Teamspieler sollen nicht nebeneinander herlaufen, sondern Manndeckung machen bzw. im Angriff
// seitlich versetzt vorstürmen“). Bot gegen Bot (Stufe 2, feste Seeds), gemessen im laufenden Spiel:
//   nebeneinander  Anteil der Zeit (je Mannschaft), in der zwei Feldspieler < 2,5 m voneinander auf ähnlicher Höhe (|Δx| < 1,5 m) laufen
//   Tore/Spiel, Passquote (Pass zu einem Mitspieler → nächste Berührung durch einen Mitspieler)
//   torseitig      Anteil der Zeit mit Gegner am Ball, in der der Decker näher am eigenen Tor steht als sein nächster freier Gegner
// Aufruf: node tests/node/deckung_probe.mjs [Spiele=3] [dauer=1] ["qs"]  (vergleichen mit qs "deckung=0")
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

const TOUCH = ['touch', 'kick', 'control', 'catch', 'parry', 'tackle', 'body', 'block', 'air'];

export function messeDeckung(games = 3, dauer = 1, qs = '') {
  const m = { ticks: 0, neben: 0, goals: 0, games: 0, pass: 0, passOk: 0, defT: 0, torseitig: 0, t: 0 };
  for (let s = 1; s <= games; s++) {
    let open = null;
    const r = playGame('deckung' + s, {
      qs: `dauer=${dauer}&${qs}`,
      onStep(g, ev) {
        for (const e of ev) {
          if (open && e.player != null && e.player !== open.from && TOUCH.includes(e.type)) {
            m.pass++; if (g.players[e.player].team === open.team) m.passOk++; open = null;
          }
          if (open && (e.type === 'goal' || e.type === 'restart')) open = null;
          if (!open && e.type === 'kick' && e.kind === 'pass' && e.to >= 0 && e.to !== e.player) open = { from: e.player, team: g.players[e.player].team, t: g.t };
        }
        if (open && g.t > open.t + 3) { m.pass++; open = null; }
        if (g.rules.phase !== 'play') return;
        const b = g.bots;
        for (let team = 0; team < 2; team++) {
          const kp = g.rules.keeper[team];
          const f = g.players.filter((p) => p.team === team && p.id !== kp);
          m.ticks++;
          let nb = false;
          for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
            const a = f[i], c = f[j];
            if (Math.hypot(a.x - c.x, a.z - c.z) < 2.5 && Math.abs(a.x - c.x) < 1.5) nb = true;
          }
          if (nb) m.neben++;
          // Gegner am Ball: steht der zweite Verteidiger torseitig zum freien Gegner?
          if (b && b.ownerTeam === 1 - team && b.owner !== g.rules.keeper[1 - team]) {
            const gx = g.rules.goalX(team);
            const free = g.players.filter((o) => o.team !== team && o.id !== b.owner && o.id !== g.rules.keeper[o.team]);
            const def = f.filter((p) => b.brain[p.id].role === 'cover');
            for (const d of def) {
              let o = null, od = 1e9; for (const q of free) { const dd = Math.hypot(q.x - d.x, q.z - d.z); if (dd < od) { od = dd; o = q; } }
              if (!o) continue;
              m.defT++;
              if (Math.hypot(gx - d.x, d.z) < Math.hypot(gx - o.x, o.z) - 0.3) m.torseitig++;
            }
          }
        }
      },
    });
    m.goals += r.score[0] + r.score[1]; m.games++; m.t += r.t;
  }
  return {
    spiele: m.games, nebeneinander: 100 * m.neben / m.ticks, toreJeSpiel: m.goals / m.games,
    passquote: m.pass ? 100 * m.passOk / m.pass : NaN, paesse: m.pass, torseitig: m.defT ? 100 * m.torseitig / m.defT : NaN,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 3), d = +(process.argv[3] || 1), qs = process.argv[4] || '';
  const r = messeDeckung(G, d, qs), f = (x) => x.toFixed(1);
  console.log(`${qs || '(Standard)'}: ${r.spiele} Spiele à ${2 * d} min · nebeneinander ${f(r.nebeneinander)} % · Tore/Spiel ${f(r.toreJeSpiel)} · Passquote ${f(r.passquote)} % (${r.paesse} Pässe) · Decker torseitig ${f(r.torseitig)} %`);
}
