// n10-Messwerkzeug (Peter 02.11.2026: „mehr ballmagnet, schärfere Pässe“): alle Vorher/Nachher-Größen in einem Lauf.
// Bot-Selbstspiel Stufe 2 gegen 2 (n7_probe, gleiche Seeds): Ballverluste beim Führen/min (davon Zweikampf), Grätschen mit
// Ballgewinn, Tore/Spiel, Bot-Pässe kommen an/abgefangen. Dribbel-Parcours (Skript, Kinderhand), Kinderhand-Führen gegen einen
// Bot. Pass-Probe (echte Gesten): kommt an, abgefangen, Abspieltempo, Ballzeit bis zum Mitspieler, Annahme gelingt.
// Aufruf: node tests/node/n10_probe.mjs ["Query"] [Spiele=80] [Pässe je Variante=200] [Prozesse=4]
import { runProbe as botProbe, summary } from './n7_probe.mjs';
import { runProbe as passProbe, summarize } from './pass_probe.mjs';
import { parcours, kidDribble } from './dribble_probe.mjs';

const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

export async function n10(qs = '', games = 80, passes = 200, W = 4) {
  const s = summary(await botProbe(qs, games, 'st2', W));
  const pc = parcours(qs, [1, 2, 3, 4, 5, 6]), pk = parcours(qs, [1, 2, 3, 4, 5, 6], true);
  const kid = []; for (let i = 1; i <= 20; i++) kid.push(kidDribble(qs, { seed: i, opp: true }));
  const pp = passProbe(qs, passes);
  const all = summarize(pp.flatMap((o) => o.rs));
  return {
    qs, games,
    verlusteMin: s.lossMin, zweikampfMin: s.duelMin, verspringtMin: s.freeMin, ballAmFuss: s.footSMin,
    graetschenBall: s.tackleBallPerGame, graetschenBallAnteil: s.tackleBallShare, toreSpiel: s.goalsPerGame, toreSchuss: s.goalsPerShot,
    passeSpiel: s.passesPerGame, botPassAn: s.passOkShare, botPassAb: s.passIntShare, doppelpaesse: s.doublesPerGame, haenger: s.stuck, numerik: s.faults,
    parcours: avg(pc.map((x) => x.time)), parcoursVerl: pc.reduce((a, x) => a + x.lost, 0), parcoursKind: avg(pk.map((x) => x.time)),
    kindGegenBot: avg(kid.map((x) => x.lost)),
    passAn: all.ok, passAnFrei: all.okFreeK, passAb: all.abgefangen, passTempo: all.speed50, passZeit: all.tArr50, annahme: all.annOk, empfGemeint: all.sel,
  };
}

const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(d));
export function zeile(r) {
  return `| ${r.qs || 'Standard'} | ${f(r.verlusteMin, 2)} (${f(r.zweikampfMin, 2)}) | ${f(r.graetschenBall)} (${f(r.graetschenBallAnteil, 0)} %) | ${f(r.toreSpiel)} | ${f(r.botPassAn, 0)} / ${f(r.botPassAb, 0)} % | ${f(r.parcours, 2)} s (${r.parcoursVerl}) / ${f(r.parcoursKind, 2)} s | ${f(r.kindGegenBot)} | ${f(r.passAn)} / ${f(r.passAnFrei)} % | ${f(r.passAb)} % | ${f(r.passTempo)} m/s | ${f(r.passZeit, 2)} s | ${f(r.annahme)} % |`;
}
export const KOPF = '| Variante | Ballverluste beim Führen/min (Zweikampf) | Grätschen mit Ballgewinn/Spiel | Tore/Spiel | Bot-Pässe an/abgefangen | Parcours Skript (Verluste) / Kinderhand | Kinderhand gegen Bot: weg/min | Pass-Probe kommt an (alle / Weg frei) | abgefangen | Abspieltempo p50 | Ballzeit bis Mitspieler p50 | Annahme gelingt |\n|---|---|---|---|---|---|---|---|---|---|---|---|';

if (import.meta.url === `file://${process.argv[1]}`) {
  const qs = process.argv[2] || '', G = +(process.argv[3] || 80), N = +(process.argv[4] || 200), W = +(process.argv[5] || 4);
  const t0 = Date.now();
  const r = await n10(qs, G, N, W);
  console.log(KOPF); console.log(zeile(r));
  console.log(JSON.stringify(r));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
