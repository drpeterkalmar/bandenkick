// n13 Gummiwände (Peter 07.11.: „Torwarte pfeffern ständig ins Aus“): Bot-Spiele OHNE Dach, mit und ohne Gummiwände.
// Zählt Aus-Bälle (Torwartball), davon direkt aus einem Abwurf/Abschlag des Tormanns (kein anderer Kontakt dazwischen),
// Unterbrechungen je Minute (Aus + Tore), Gummi-Abpraller, Tore/Schuss und höchste Ballhöhe.
// node tests/node/n13_gummi_probe.mjs [Spiele=8] [Zusatz-Query]
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

export function probe(n, qs) {
  const A = { spiele: n, min: 0, aus: 0, ausTormann: 0, abwuerfe: 0, tore: 0, schuesse: 0, gummi: 0, hoch: 0, ueber12: 0, faults: 0 };
  for (let s = 1; s <= n; s++) {
    let letzter = null; // 'keeper' | 'feld'
    const r = playGame(s, {
      qs: 'dach=0&' + qs,
      onStep(g, ev) {
        for (const e of ev) {
          if (e.type === 'throw' || e.type === 'punt') { letzter = 'keeper'; A.abwuerfe++; }
          else if (e.type === 'kick' || e.type === 'touch') letzter = 'feld';
          else if (e.type === 'out') { A.aus++; if (letzter === 'keeper') A.ausTormann++; letzter = null; }
          else if (e.type === 'goal') A.tore++;
          else if (e.type === 'gummi') A.gummi++;
        }
        if (g.ball.p.y > A.hoch) A.hoch = g.ball.p.y;
        if (g.ball.p.y > 12.05) A.ueber12++;
      },
    });
    A.min += r.t / 60; A.faults += r.faults;
    A.schuesse += r.kicks.shot || 0;
  }
  A.ausJeSpiel = A.aus / n; A.unterbrechungenJeMin = (A.aus + A.tore) / A.min; A.toreJeSchuss = A.tore / Math.max(1, A.schuesse);
  A.anteilTormannAus = A.ausTormann / Math.max(1, A.abwuerfe);
  return A;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] || 8), extra = process.argv[3] || '';
  for (const [name, q] of [['ohne Gummi (cac623e)', 'gummi=0'], ['mit Gummi (n13)', 'gummi=1']]) {
    const A = probe(n, q + (extra ? '&' + extra : ''));
    console.log(`${name}: Aus/Spiel ${A.ausJeSpiel.toFixed(2)}, davon Tormann ${A.ausTormann} von ${A.abwuerfe} Abwürfen/Abschlägen (${(100 * A.anteilTormannAus).toFixed(1)} %),` +
      ` Unterbrechungen/min ${A.unterbrechungenJeMin.toFixed(2)}, Tore/Spiel ${(A.tore / n).toFixed(2)}, Tore/Schuss ${(100 * A.toreJeSchuss).toFixed(1)} %,` +
      ` Gummi-Abpraller ${A.gummi}, höchster Ball ${A.hoch.toFixed(1)} m, Fehler ${A.faults}`);
  }
}
