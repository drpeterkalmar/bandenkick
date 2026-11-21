// n16 Nachtrag 1 C (Peter 21.11.: Torabstoß/Abwurf/Abschlag darf nicht abgefangen werden): im Bot-Selbstspiel jeden Abwurf/Abschlag
// des Tormanns verfolgen – wer berührt den Ball als Nächster (Mitspieler = angekommen, Gegner = abgefangen)? Dazu: Ballverlust binnen 3 s
// nach der Annahme, Tore. Aufruf: node tests/node/n16_abstoss_probe.mjs [Spiele=4] ["qs"]
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

export function abstoss(qs = '', games = 4, seed0 = 900) {
  const r = { games, n: 0, throw: 0, punt: 0, mit: 0, weg: 0, offen: 0, verlust3: 0, tore: 0 };
  for (let s = 0; s < games; s++) {
    let a = null;
    playGame(seed0 + s, { qs, onStep: (g, ev) => {
      for (const e of ev) {
        if (e.type === 'throw' || e.type === 'punt') { r.n++; r[e.type]++; a = { team: g.players[e.player].team, kp: e.player, t: g.t, an: -1 }; }
        if (e.type === 'goal') { r.tore++; if (a && a.an < 0) r.offen++; a = null; }
      }
      if (!a) return;
      if (a.an < 0 && g.lastTouch >= 0 && g.lastTouch !== a.kp) {
        if (g.players[g.lastTouch].team === a.team) { r.mit++; a.an = g.t; } else { r.weg++; a = null; }
      } else if (a.an < 0 && (g.rules.phase !== 'play' || g.t - a.t > 8)) { r.offen++; a = null; }
      else if (a && a.an >= 0) {
        if (g.lastTouch >= 0 && g.players[g.lastTouch].team !== a.team) { if (g.t - a.an < 3) r.verlust3++; a = null; }
        else if (g.t - a.an > 3) a = null;
      }
    } });
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 4), qs = process.argv[3] || '';
  for (const q of ['abstoss=0' + (qs ? '&' + qs : ''), qs]) {
    const r = abstoss(q, G);
    console.log(`${q || 'Standard'} | Abstöße ${r.n} (Abwurf ${r.throw}, Abschlag ${r.punt}) · beim Mitspieler ${r.mit} · abgefangen ${r.weg} · ohne Berührung/tot ${r.offen} · Ballverlust ≤ 3 s nach Annahme ${r.verlust3} · Tore ${r.tore} (${(r.tore / G).toFixed(1)}/Spiel)`);
  }
}
