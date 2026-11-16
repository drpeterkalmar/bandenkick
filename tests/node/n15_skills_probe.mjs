// n15 E4: Skill-Moves im Bot-Selbstspiel – Versuche je Spiel, Erfolgsquote, behält der Ausweichende den Ball (≥ 1 s keine Gegner-Berührung),
// Ballverluste beim Führen (dribble_probe) und Tore, ?skills=0 zum Vergleich. Aufruf: node tests/node/n15_skills_probe.mjs [Spiele=8]
import { playGame } from './selfplay.mjs';
import { dribbleLosses } from './dribble_probe.mjs';
import { pathToFileURL } from 'node:url';

export function skillsProbe(qs = '', games = 8, seed0 = 900) {
  const r = { games, versuche: 0, ok: 0, behalten: 0, okZaehl: 0, tore: 0, arten: {} };
  for (let s = 0; s < games; s++) {
    let offen = [];
    playGame(seed0 + s, { qs, onStep: (g, ev) => {
      for (const e of ev) {
        if (e.type === 'skill') { r.versuche++; r.arten[e.id] = (r.arten[e.id] || 0) + 1; if (e.ok) { r.ok++; offen.push({ pl: e.player, team: g.players[e.player].team, t: g.t }); } }
        if (e.type === 'goal') r.tore++;
        if (e.player != null && e.player >= 0 && ['touch', 'kick', 'tackle', 'catch'].includes(e.type)) for (const o of offen) if (!o.weg && g.players[e.player].team !== o.team) o.weg = true;
      }
      offen = offen.filter((o) => { if (g.t - o.t < 1) return true; r.okZaehl++; if (!o.weg) r.behalten++; return false; });
    } });
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8);
  for (const q of ['skills=0', '']) {
    const r = skillsProbe(q, G), d = dribbleLosses(q, G);
    console.log(`${q || 'Standard'} | Skill-Versuche ${(r.versuche / G).toFixed(1)}/Spiel, gelungen ${(100 * r.ok / Math.max(1, r.versuche)).toFixed(0)} %, danach Ball behalten ${(100 * r.behalten / Math.max(1, r.okZaehl)).toFixed(0)} % | Ballverluste beim Führen ${(d.losses / d.minutes).toFixed(2)}/min | Tore ${(r.tore / G).toFixed(1)}/Spiel | ${JSON.stringify(r.arten)}`);
  }
}
