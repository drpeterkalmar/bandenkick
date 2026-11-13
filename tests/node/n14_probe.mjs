// n14-Messwerkzeug (Peter 13.11.2026: „Pässe höher und schneller … in den freien Raum … Ballmagnet zum Abschirmen … Fallrückzieher
// und Kopfbälle härter … mehr Effet“): Bot-Selbstspiel Stufe 2 gegen 2 (gleiche Seeds wie n7/n10/n11), in EINEM Spiel gemessen:
//  - n7-Größen: Ballverluste beim Führen/min (davon Zweikampf), Ball am Fuß, Grätschen mit Ballgewinn, Tore je Schuss
//  - n11-Größen: Pässe kommen an / abgefangen, hohe Pässe beim Gemeinten in Körperhöhe, Tore/Schüsse je Spiel, Ball aus dem Käfig
//  - n14: Flug der Pässe (Scheitel gemessen, Abspieltempo, Zeit bis zur ersten Berührung), Raumgewinn Richtung Tor (Treffpunkt
//    ≥ 2 m näher am gegnerischen Tor), Bandenpässe in Randlage (Passgeber oder Empfänger ≤ 3 m an der Längsbande), Luftball-
//    Schüsse und -Tore je Technik (Kopfball, Flugkopf, Fallrückzieher, Seitfallzieher, Salto)
// Aufruf: node tests/node/n14_probe.mjs ["Query"] [Spiele=48] [Prozesse=6]
import { measureGame, emptyStats as n7Empty, merge as n7Merge, summary as n7Summary } from './n7_probe.mjs';
import { n11Hook, summary as n11Summary, physik } from './n11_probe.mjs';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LUFT = ['kopf', 'flugkopf', 'fallrueck', 'seitfall', 'salto', 'volley', 'dropkick'];
function empty() {
  const r = { passN: 0, hochN: 0, apex: [], apexPlan: [], speed: [], tFirst: [], speedHoch: [], tHoch: [], vorN: 0, randN: 0, randBank: 0, bankN: 0, okVor: 0, intVor: 0, n11: null, n7: null, luft: {} };
  for (const k of LUFT) r.luft[k] = { n: 0, tore: 0, miss: 0 };
  return r;
}
function merge(a, b) {
  for (const k of Object.keys(a)) {
    if (k === 'n11') { if (!a.n11) a.n11 = b.n11; else for (const j of Object.keys(a.n11)) { if (Array.isArray(a.n11[j])) a.n11[j].push(...b.n11[j]); else if (j === 'tech') for (const t in b.n11.tech) a.n11.tech[t] = (a.n11.tech[t] || 0) + b.n11.tech[t]; else a.n11[j] += b.n11[j]; } }
    else if (k === 'n7') a.n7 = a.n7 ? n7Merge(a.n7, b.n7) : b.n7;
    else if (k === 'luft') for (const t of LUFT) for (const j in a.luft[t]) a.luft[t][j] += b.luft[t][j];
    else if (Array.isArray(a[k])) a[k].push(...b[k]);
    else a[k] += b[k];
  }
  return a;
}

function n14Hook() {
  const r = empty();
  let pend = null, lastAir = null;
  const onStep = (g, ev) => {
    const b = g.ball;
    if (pend) pend.apex = Math.max(pend.apex, b.p.y);
    for (const e of ev) {
      const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
      if (pend && p && e.player !== pend.from && g.t > pend.t && (e.type === 'touch' || e.type === 'kick' || e.type === 'control' || e.type === 'catch' || e.type === 'parry' || (e.type === 'tackle' && e.phase === 'hit'))) {
        r.tFirst.push(g.t - pend.t);
        if (pend.hoch) { r.apex.push(pend.apex); r.tHoch.push(g.t - pend.t); }
        if (pend.vor) { if (e.player === pend.to) r.okVor++; else if (p.team !== pend.team) r.intVor++; }
        pend = null;
      }
      if (e.type === 'kick' && p && e.kind === 'pass' && e.to >= 0 && e.to !== e.player && g.players[e.to].team === p.team) {
        const lk = p.lastKick || {}, hz = g.cage.hz, m = g.players[e.to];
        const att = g.rules.goalX(p.team) > 0 ? -1 : 1; // Angriffsrichtung (x)
        const hoch = !!(lk.chip || lk.hoch || lk.elevDeg > 8);
        const meet = lk.meet || [m.x, m.z];
        const vor = (meet[0] - e.x) * att >= 2;
        r.passN++; r.speed.push(e.speed); if (vor) r.vorN++;
        if (lk.bank) r.bankN++;
        if (Math.abs(e.z) >= hz - 3 || Math.abs(m.z) >= hz - 3) { r.randN++; if (lk.bank) r.randBank++; }
        if (hoch) { r.hochN++; r.speedHoch.push(e.speed); if (lk.apex != null) r.apexPlan.push(lk.apex); }
        pend = { to: e.to, from: e.player, team: p.team, t: g.t, hoch, vor, apex: b.p.y };
      }
      if (e.type === 'goal' || e.type === 'restart' || e.type === 'out') pend = null;
      if (e.type === 'air' && !e.pass && r.luft[e.tech]) { r.luft[e.tech].n++; lastAir = { tech: e.tech, t: g.t, team: p ? p.team : -1 }; }
      if (e.type === 'airmiss' && r.luft[e.tech]) r.luft[e.tech].miss++;
      if (e.type === 'goal' && lastAir && lastAir.team === e.team && g.t - lastAir.t < 2.5) { r.luft[lastAir.tech].tore++; lastAir = null; }
      if (e.type === 'kick' && e.kind !== 'shot') lastAir = null;
    }
  };
  return { r, onStep };
}

export function measure(qs, seed) {
  const a = n11Hook(), c = n14Hook();
  const st = { t: 0 };
  globalThis.BK_EXTRA_STEP = (g, ev) => { st.t = g.t; a.onStep(g, ev); c.onStep(g, ev); };
  const r7 = measureGame(qs, 'st2', seed);
  globalThis.BK_EXTRA_STEP = null;
  c.r.n11 = a.finish(st); c.r.n7 = r7;
  return c.r;
}

export function runProbe(qs = '', N = 48, W = 6) {
  const here = fileURLToPath(import.meta.url);
  W = Math.max(1, Math.min(W, N));
  return Promise.all(Array.from({ length: W }, (_, w) => new Promise((res, rej) => {
    const seeds = []; for (let s = 1 + w; s <= N; s += W) seeds.push(s);
    const ch = fork(here, ['--worker', qs, seeds.join(',')], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', (m) => res(m)); ch.on('error', rej);
    ch.on('exit', (c) => { if (c) rej(new Error(`Prozess ${w}: Exit ${c}`)); });
  }))).then((parts) => parts.reduce((a, b) => merge(a, b), empty()));
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const pc = (a, b) => (b ? 100 * a / b : NaN);
export function summary(r) {
  const s7 = n7Summary(r.n7), s11 = n11Summary(r.n11);
  const luft = {};
  for (const k of LUFT) luft[k] = { n: r.luft[k].n, tore: r.luft[k].tore, quote: pc(r.luft[k].tore, r.luft[k].n) };
  return {
    games: r.n11.games,
    passeSpiel: s11.passeSpiel, passAn: s11.passAn, passAb: s11.passAb, hochKoerper: s11.hochKoerper, passHoch: s11.passHoch,
    scheitelMittel: mean(r.apex), scheitelMed: med(r.apex), scheitelPlan: mean(r.apexPlan), tempoMed: med(r.speed), tempoMittel: mean(r.speed), zeitMed: med(r.tFirst), tempoHochMittel: mean(r.speedHoch), tempoHochMed: med(r.speedHoch), zeitHochMed: med(r.tHoch), zeitHochMittel: mean(r.tHoch),
    vorAnteil: pc(r.vorN, r.passN), vorAn: pc(r.okVor, r.vorN), vorAb: pc(r.intVor, r.vorN), randAnteil: pc(r.randN, r.passN), randBank: pc(r.randBank, r.randN), bankAnteil: pc(r.bankN, r.passN),
    verlusteMin: s7.lossMin, zweikampfMin: s7.duelMin, ballAmFuss: s7.footSMin, graetschenBall: s7.tackleBallPerGame, toreSchuss: s7.goalsPerShot,
    toreSpiel: s11.toreSpiel, toreMin: s11.toreSpiel / (r.n11.minutes / r.n11.games), schuesseSpiel: s11.schuesseSpiel, luftMin: s11.luftMin, aus: s11.aus, nan: s11.nan,
    gegentoreNachFehlpassSpiel: s11.gegentoreNachFehlpassSpiel, luft,
  };
}
const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(d));
export function bericht(qs, s) {
  const L = s.luft, lq = (k) => `${L[k].tore}/${L[k].n} (${f(L[k].quote, 0)} %)`;
  return [
    `### ${qs || 'Standard'} (${s.games} Spiele)`,
    `Pässe/Spiel ${f(s.passeSpiel)} · kommen an ${f(s.passAn)} % · abgefangen ${f(s.passAb)} % · hoch ${f(s.passHoch)} % · hoch beim Gemeinten in Körperhöhe ${f(s.hochKoerper)} %`,
    `Scheitel hoher Pässe Mittel ${f(s.scheitelMittel, 2)} m (p50 ${f(s.scheitelMed, 2)}, Plan ${f(s.scheitelPlan, 2)}) · Abspieltempo p50 ${f(s.tempoMed)} m/s (Mittel ${f(s.tempoMittel)}) · bis zur 1. Berührung p50 ${f(s.zeitMed, 2)} s`,
    `Hohe Pässe: Abspieltempo Mittel ${f(s.tempoHochMittel)} m/s (p50 ${f(s.tempoHochMed)}) · Flug bis zur 1. Berührung Mittel ${f(s.zeitHochMittel, 2)} s (p50 ${f(s.zeitHochMed, 2)})`,
    `Raumgewinn ≥ 2 m Richtung Tor ${f(s.vorAnteil)} % der Pässe (davon an ${f(s.vorAn)} %, abgefangen ${f(s.vorAb)} %) · Randlage ${f(s.randAnteil)} % → davon über die Bande ${f(s.randBank)} % · Bandenpässe gesamt ${f(s.bankAnteil)} %`,
    `Ballverluste beim Führen ${f(s.verlusteMin, 2)}/min (Zweikampf ${f(s.zweikampfMin, 2)}) · Ball am Fuß ${f(s.ballAmFuss)} s/min · Grätschen mit Ballgewinn ${f(s.graetschenBall)}/Spiel`,
    `Tore/Spiel ${f(s.toreSpiel)} (${f(s.toreMin, 2)}/min) · Schüsse/Spiel ${f(s.schuesseSpiel)} · Tore je Schuss ${f(s.toreSchuss)} % · Luftkontakte/min ${f(s.luftMin)} · Gegentore nach Fehlpass/Spiel ${f(s.gegentoreNachFehlpassSpiel, 2)} · aus/NaN ${s.aus}/${s.nan}`,
    `Luftball-Tore/Versuche: Kopfball ${lq('kopf')} · Flugkopf ${lq('flugkopf')} · Fallrückzieher ${lq('fallrueck')} · Seitfall ${lq('seitfall')} · Salto ${lq('salto')} · Volley ${lq('volley')}`,
  ].join('\n');
}

const self = import.meta.url === pathToFileURL(process.argv[1]).href;
if (self && process.argv[2] === '--worker') {
  const [, , , qs, list] = process.argv;
  const acc = empty();
  for (const s of list.split(',').map(Number)) merge(acc, measure(qs, s));
  process.send(acc, () => process.exit(0));
} else if (self) {
  const qs = process.argv[2] || '', N = +(process.argv[3] || 48), W = +(process.argv[4] || 6);
  const t0 = Date.now();
  const s = summary(await runProbe(qs, N, W));
  console.log(bericht(qs, s));
  console.log('Physik:', JSON.stringify(physik(qs)));
  console.log(JSON.stringify(s));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
