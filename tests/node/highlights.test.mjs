// Highlights (Peter 13.11.): Bestenliste (je Halbzeit die besten 3, Eigentore nur ohne genug andere), Ablauf zur Halbzeit
// (max. 2, bestes zuerst) und nach dem Abpfiff (max. 3, das beste zuletzt als „Tor des Spiels“), und ein Bot-Spiel mit kurzen
// Halbzeiten: Kopie der Aufzeichnung je Tor wie im Spiel (EDIT_DELAY s nach dem Tor), jeder Highlight-Clip läuft als Fan-Edit
// aus seiner Kopie durch. Aufruf: node tests/node/highlights.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { ReplayRecorder, findContact } from '../../src/sim/replay.js';
import { FanEdit, EDIT_DELAY } from '../../src/sim/fanedit.js';
import { merkeTor, besteTore, highlightFolge, torWert } from '../../src/sim/highlights.js';

let bad = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) bad++; };

// 1) Bestenliste
const L = [];
for (const [w, h, own] of [[50, 1], [80, 1], [30, 1], [90, 1, true], [60, 1], [70, 2], [40, 2]]) merkeTor(L, { wert: w, halbzeit: h, own: !!own });
const h1 = L.filter((x) => x.halbzeit === 1).map((x) => x.wert).sort((a, b) => b - a);
ok(h1.join() === '80,60,50', `je Halbzeit die besten 3, Eigentor raus bei ≥ 3 anderen (1. HZ: ${h1})`);
const L2 = []; for (const [w, own] of [[50], [99, true]]) merkeTor(L2, { wert: w, halbzeit: 1, own: !!own });
ok(besteTore(L2, 3).length === 2, 'Eigentor bleibt, wenn zu wenige andere da sind');
const fH = highlightFolge(L, 'halbzeit');
ok(fH.length === 2 && fH[0].x.wert === 80 && fH[1].x.wert === 60 && fH[0].titel.includes('1/2'), `Halbzeit: ${fH.map((f) => f.titel + ' ' + f.x.wert).join(' | ')}`);
const fE = highlightFolge(L, 'ende');
ok(fE.length === 3 && fE[2].x.wert === 80 && fE[2].titel.includes('TOR DES SPIELS') && fE[0].x.wert === 60, `Abpfiff: ${fE.map((f) => f.titel + ' ' + f.x.wert).join(' | ')}`);
ok(highlightFolge([], 'halbzeit').length === 0 && highlightFolge([{ wert: 5, halbzeit: 2 }], 'halbzeit').length === 0, 'keine Tore der 1. HZ → keine Halbzeit-Highlights');
ok(torWert(100, 'fallrueck') === 160 && torWert(0, '') === 0, 'Wert = km/h + Technik-Bonus');

// 2) Bot-Spiel mit kurzen Halbzeiten (wie im Spiel aufgezeichnet)
const recKopie = (r) => Object.assign(Object.create(Object.getPrototypeOf(r)), r, { buf: r.buf.slice(), tAbs: r.tAbs.slice(), events: r.events.map((x) => ({ ...x })) });
let fertig = null;
for (const seed of [3, 7, 11, 19, 23, 5]) {
  const P = makeParams('dauer=0.6');
  const g = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] });
  const rec = new ReplayRecorder(g.players.length), liste = [];
  let fang = null, halbzeit = null, ende = null;
  while (g.t < 300 && !(ende && !fang)) {
    const ev = g.step([]);
    rec.record(g, ev);
    for (const e of ev) {
      if (e.type === 'goal') fang = { goal: { ...e, t: g.t - DT }, t: g.t + EDIT_DELAY, halbzeit: g.rules.half };
      if (e.type === 'halftime') halbzeit = highlightFolge(liste, 'halbzeit');
      if (e.type === 'end') ende = true;
    }
    if (fang && g.t >= fang.t) {
      const k = recKopie(rec), c = findContact(k, fang.goal);
      merkeTor(liste, { rec: k, goal: fang.goal, wert: torWert(Math.round((c ? c.speed || fang.goal.speed : fang.goal.speed || 0) * 3.6), c && c.tech), halbzeit: fang.halbzeit, own: !!fang.goal.own });
      fang = null;
    }
  }
  if (ende && halbzeit && halbzeit.length) { fertig = { seed, liste, halbzeit, ende: highlightFolge(liste, 'ende'), g }; break; }
}
ok(!!fertig, `Bot-Spiel mit Tor in der 1. Halbzeit erreicht Abpfiff${fertig ? ` (seed ${fertig.seed}, ${fertig.g.score.join(':')}, ${fertig.liste.length} Clips gemerkt)` : ''}`);
if (fertig) {
  ok(fertig.liste.filter((x) => x.halbzeit === 1).length <= 3 && fertig.liste.filter((x) => x.halbzeit === 2).length <= 3, 'höchstens 3 Clips je Halbzeit');
  for (const [art, folge] of [['Halbzeit', fertig.halbzeit], ['Abpfiff', fertig.ende]]) {
    let alle = folge.length > 0;
    for (const f of folge) {
      const D = new FanEdit(f.x.rec, f.x.goal, { seed: Math.round(f.x.goal.t * 997) + 5 });
      D.pov = f.titel;
      let n = 0; while (!D.done && n < 2000) { D.update(1 / 60); n++; }
      alle = alle && D.done && n > 60;
    }
    ok(alle, `${art}: ${folge.length} Clip(s) laufen aus ihrer Kopie durch (${folge.map((f) => f.titel).join(' | ')})`);
  }
}
console.log(bad ? `\n${bad} rot` : '\nHighlights grün');
process.exit(bad ? 1 : 0);
