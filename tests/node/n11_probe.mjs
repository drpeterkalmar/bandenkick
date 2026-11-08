// n11-Messwerkzeug (Peter 02./04.11.2026: „Akrobatik-Fußball“): Bot-Selbstspiel Stufe 2 gegen 2 (gleiche Seeds wie n7/n10), dazu
// Ballphysik-Proben. Misst je Variante:
//  - Ballkontakte in der Luft je Minute (Kick/Luftball/Annahme/Berührung mit Ballmitte ≥ 0,5 m), Anteil Akrobatik-Techniken an allen
//    Kicks (Luftbälle, Hacke, Salto-Hacke), Anteil Effet-Kicks (Innen-/Außenrist, Kurvenpass)
//  - Pässe zum Mitspieler: kommen an (erste Berührung beim Gemeinten), abgefangen (erste Berührung Gegner), daraus binnen 8 s ein
//    Gegner-Schuss bzw. Gegentor; Anteil hoher Pässe, Ankunftshöhe
//  - Tore/Spiel, Schüsse/Spiel, Tormann-Paraden/Spiel, Ball außerhalb/NaN
// Aufruf: node tests/node/n11_probe.mjs ["Query"] [Spiele=80] [Prozesse=6]
import { playGame } from './selfplay.mjs';
import { makeParams } from '../../src/sim/params.js';
import { Ball } from '../../src/sim/ball.js';
import { setKick } from '../../src/sim/kickplan.js';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const AKRO_TECH = new Set(['volley', 'dropkick', 'seitfall', 'fallrueck', 'kopf', 'flugkopf', 'ferse', 'salto', 'kopfpass', 'volleypass']);
export const EFFET_TECH = new Set(['innenrist', 'aussenrist', 'aussen', 'kurve']);

function empty() {
  return { games: 0, minutes: 0, goals: 0, shots: 0, kicks: 0, akro: 0, effet: 0, airTouch: 0, parades: 0, out: 0, nan: 0,
    passN: 0, passOk: 0, passInt: 0, passHigh: 0, intShot: 0, intGoal: 0, arrH: [], hochN: 0, hochKoerper: 0, tech: {} };
}
function merge(a, b) {
  for (const k of Object.keys(a)) {
    if (Array.isArray(a[k])) a[k].push(...b[k]);
    else if (k === 'tech') for (const t in b.tech) a.tech[t] = (a.tech[t] || 0) + b.tech[t];
    else a[k] += b[k];
  }
  return a;
}

export function measure(qs, seed) {
  const r = empty();
  let pend = null; const ints = [];
  const st = playGame(seed, { qs, levels: [2, 2], onStep: (g, ev) => {
    const b = g.ball, c = g.cage;
    if (!Number.isFinite(b.p.x + b.p.y + b.p.z)) r.nan++;
    else if (b.held < 0 && (Math.abs(b.p.x) > c.hx + 1.6 || Math.abs(b.p.z) > c.hz + 0.6 || b.p.y < -0.05 || b.p.y > (c.gummi ? c.gummi.h : c.roof ? c.top : 99) + 0.6)) r.out++; // n13: ohne Dach zählt erst über der Gummi-Decke
    for (const e of ev) {
      const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
      if ((e.type === 'kick' || e.type === 'touch' || e.type === 'control') && e.y != null && e.y >= 0.5) r.airTouch++;
      if (e.type === 'kick' && e.to !== e.player) { // (Mitnehmen zu sich selbst zählt nicht als Kick)
        r.kicks++; r.tech[e.tech] = (r.tech[e.tech] || 0) + 1;
        if (AKRO_TECH.has(e.tech)) r.akro++;
        if (EFFET_TECH.has(e.tech) || e.kurve) r.effet++;
        if (e.kind === 'shot') { r.shots++; for (const it of ints) if (!it.shot && p && p.team === it.team && g.t - it.t <= 8) it.shot = true; }
      }
      if (e.type === 'catch' || e.type === 'parry') r.parades++;
      if (e.type === 'goal') { r.goals++; for (const it of ints) if (!it.goal && it.team === e.team && g.t - it.t <= 8) it.goal = true; }
      if (p && (e.type === 'touch' || e.type === 'kick' || e.type === 'control' || e.type === 'catch' || e.type === 'parry' || (e.type === 'tackle' && e.phase === 'hit'))) {
        if (pend && e.player !== pend.from && g.t > pend.t) {
          if (e.player === pend.to) { r.passOk++; r.arrH.push(e.y ?? b.p.y); if (pend.hoch) { const y = e.y ?? b.p.y; if (y >= 0.45 && y <= 2.4) r.hochKoerper++; } } else if (p.team !== pend.team) { r.passInt++; ints.push({ t: g.t, team: p.team, shot: false, goal: false }); }
          pend = null;
        }
      }
      if (e.type === 'kick' && p && e.kind === 'pass' && e.to >= 0 && e.to !== e.player && g.players[e.to].team === p.team) {
        pend = { to: e.to, from: e.player, team: p.team, t: g.t }; r.passN++;
        if (p.lastKick && (p.lastKick.chip || p.lastKick.hoch || p.lastKick.elevDeg > 8)) { r.passHigh++; pend.hoch = true; r.hochN++; } // n13: hohe Pässe zählen
      }
      if (e.type === 'goal' || e.type === 'restart' || e.type === 'out') pend = null;
    }
  } });
  r.games = 1; r.minutes = st.t / 60;
  r.intShot = ints.filter((x) => x.shot).length; r.intGoal = ints.filter((x) => x.goal).length;
  return r;
}

export function runProbe(qs = '', N = 80, W = 6) {
  const here = fileURLToPath(import.meta.url);
  W = Math.max(1, Math.min(W, N));
  return Promise.all(Array.from({ length: W }, (_, w) => new Promise((res, rej) => {
    const seeds = []; for (let s = 1 + w; s <= N; s += W) seeds.push(s);
    const ch = fork(here, ['--worker', qs, seeds.join(',')], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', (m) => res(m)); ch.on('error', rej);
    ch.on('exit', (c) => { if (c) rej(new Error(`Prozess ${w}: Exit ${c}`)); });
  }))).then((parts) => parts.reduce((a, b) => merge(a, b), empty()));
}

// Ballphysik: Abprallhöhe aus 2 m (FIFA-Probe) und seitliche Ablenkung eines Innenseit-Schusses (25 m/s, voller Effet) über 20 m
export function physik(qs = '') {
  const P = makeParams(qs), cage = { rects: [], bars: [], hx: 1e4, hz: 1e4, top: 1e4, bH: 1e4 };
  const b = new Ball({ ...P, knuckleF30: 0 });
  b.place(0, 2.0, 0); b.v.set(0, 0, 0); b.w.set(0, 0, 0);
  let up = false, top = 0;
  for (let i = 0; i < 2400; i++) { b.step(1 / 240, cage); if (b.v.y > 0) up = true; if (up) top = Math.max(top, b.p.y); if (up && b.v.y < 0) break; }
  const bounce = top - P.ballR;
  const lat = (side) => {
    const c = new Ball({ ...P, knuckleF30: 0 });
    c.place(0, P.ballR + 0.01, 0); setKick(c, 1, 0, 25, 6 * Math.PI / 180, 0, side);
    for (let i = 0; i < 2400 && c.p.x < 20; i++) c.step(1 / 240, cage);
    return Math.abs(c.p.z);
  };
  // Drall wie im Spiel: Innenrist-Schuss mit 25 m/s Grundtempo (spinK = 1, q = 1)
  const side = P.spinMax * 2 * Math.PI;
  return { bounce, kurve20: lat(side), spinMax: P.spinMax };
}

const pc = (a, b) => (b ? 100 * a / b : NaN);
export function summary(r) {
  const h = [...r.arrH].sort((a, b) => a - b), med = h.length ? h[Math.floor(h.length / 2)] : NaN;
  return {
    luftMin: r.airTouch / r.minutes, akroAnteil: pc(r.akro, r.kicks), effetAnteil: pc(r.effet, r.kicks), toreSpiel: r.goals / r.games,
    schuesseSpiel: r.shots / r.games, paradenSpiel: r.parades / r.games, passeSpiel: r.passN / r.games, passAn: pc(r.passOk, r.passN),
    passAb: pc(r.passInt, r.passN), passHoch: pc(r.passHigh, r.passN), nachAbfangSchuss: pc(r.intShot, r.passInt), nachAbfangTor: pc(r.intGoal, r.passInt),
    gegentoreNachFehlpassSpiel: r.intGoal / r.games, hochKoerper: pc(r.hochKoerper, r.hochN), ankunftHoeheMed: med, aus: r.out, nan: r.nan, tech: r.tech, games: r.games,
  };
}

const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(d));
export const KOPF = '| Variante | Luftkontakte/min | Akrobatik-Anteil | Effet-Anteil | Tore/Spiel | Schüsse/Spiel | Paraden/Spiel | Pässe/Spiel | Pass kommt an | abgefangen | hoch | nach Abfangen Schuss / Tor (8 s) | Ankunftshöhe p50 | aus / NaN |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
export const zeile = (qs, s) => `| ${qs || 'Standard'} | ${f(s.luftMin)} | ${f(s.akroAnteil)} % | ${f(s.effetAnteil)} % | ${f(s.toreSpiel)} | ${f(s.schuesseSpiel)} | ${f(s.paradenSpiel)} | ${f(s.passeSpiel)} | ${f(s.passAn)} % | ${f(s.passAb)} % | ${f(s.passHoch)} % | ${f(s.nachAbfangSchuss)} / ${f(s.nachAbfangTor)} % | ${f(s.ankunftHoeheMed, 2)} m | ${s.aus} / ${s.nan} |`;

const self = import.meta.url === pathToFileURL(process.argv[1]).href;
if (self && process.argv[2] === '--worker') {
  const [, , , qs, list] = process.argv;
  const acc = empty();
  for (const s of list.split(',').map(Number)) merge(acc, measure(qs, s));
  process.send(acc, () => process.exit(0));
} else if (self) {
  const qs = process.argv[2] || '', N = +(process.argv[3] || 80), W = +(process.argv[4] || 6);
  const t0 = Date.now();
  const s = summary(await runProbe(qs, N, W));
  console.log(KOPF); console.log(zeile(qs, s));
  console.log('Physik:', JSON.stringify(physik(qs)));
  console.log(JSON.stringify(s));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
