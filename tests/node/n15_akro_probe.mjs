// n15 E5: Häufigkeit der Luft-/Akrobatik-Kontakte im Bot-Selbstspiel (je Spiel verschiedene neue Techniken, Summe je Technik, Tore danach),
// ?akro2=0 zum Vergleich. Aufruf: node tests/node/n15_akro_probe.mjs [Spiele=6] ["qs"]
import { playGame } from './selfplay.mjs';
import { AKRO2 } from '../../src/sim/technique.js';
import { pathToFileURL } from 'node:url';

export function akroProbe(qs = '', games = 6, seed0 = 1100) {
  const r = { games, tech: {}, neuJeSpiel: [], tore: 0, luft: 0 };
  for (let s = 0; s < games; s++) {
    const st = playGame(seed0 + s, { qs });
    const neu = Object.keys(st.air).filter((k) => AKRO2[k]);
    r.neuJeSpiel.push(neu.length);
    for (const [k, v] of Object.entries(st.air)) { r.tech[k] = (r.tech[k] || 0) + v; r.luft += v; }
    r.tore += st.goals[0] + st.goals[1];
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 6), qs = process.argv[3] || '';
  for (const q of ['akro2=0' + (qs ? '&' + qs : ''), qs]) {
    const r = akroProbe(q, G), fehlt = Object.keys(AKRO2).filter((k) => !r.tech[k]);
    console.log(`${q || 'Standard'} | Luftkontakte ${(r.luft / G).toFixed(1)}/Spiel · neue Techniken je Spiel ${r.neuJeSpiel.join(' ')} · Tore ${(r.tore / G).toFixed(1)}/Spiel · nie: ${fehlt.join(', ') || '–'}`);
    console.log('   ' + Object.entries(r.tech).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  }
}
