// Wucht und Hechten (Nacht 2d, Peter: „jeweils 1,5x härterer Vollspannschuss und Effetschuss … Torwart soll viel mehr
// hechten“). Messwerkzeug:
//  - shotTable(qs): Schuss aus guter Lage aus 8 / 12 / 16 m, Vollspann und angeschnitten: Tempo, Flugzeit, Kurve
//    (curve_probe.mjs) und Treffer ins leere Tor (echte Ausführung mit Streuung, 40 Schüsse je Zeile, Ball 0–3 m seitlich)
//  - selfplay(qs, n): Bots Stufe 2 gegen 2: Schüsse, Tore, Tore je Schuss, Hechtsprünge je Spiel, schnellster Schuss,
//    Ball außerhalb des Käfigs (Tunneln), Zahlenfehler – wie Hermes' vorschau_probe.mjs (briefs/bandenkick-n2d)
// Aufruf: node tests/node/wucht_probe.mjs [table|selfplay] [Query] [Spiele=4]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { curveTable } from './curve_probe.mjs';
import { pathToFileURL } from 'node:url';

const idle = { ...EMPTY_INPUT, passDown: false, shotDown: false };

// Treffer ins leere Tor: Spieler am Ball, zum Tor gedreht, Schuss per API (wie Bots/Mensch: Ecke, Qualität, Streuung)
export function emptyGoal(qs, D, mode, n = 40, seed = 5) {
  const g = new Game(makeParams(qs), seed, { match: true, perTeam: [1, 0], human: 0, bots: false });
  const rng = new Rng(seed * 7 + D), gx = g.cage.hx, pl = g.players[0];
  let goals = 0, vSum = 0;
  for (let k = 0; k < n; k++) {
    g.rules.phase = 'play';
    const z = rng.range(-3, 3), x = gx - Math.sqrt(Math.max(1, D * D - z * z));
    const f = Math.atan2(-z, gx - x);
    pl.place(x - Math.cos(f) * 0.38, z - Math.sin(f) * 0.38, f); pl.resetHands();
    g.ball.place(x, 0.11, z); g.ball.held = -1;
    pl.kickAt({ kind: 'shot', auto: true, mode, power: null });
    let res = '', kicked = false;
    for (let i = 0; i < 2.5 / DT && !res; i++) {
      for (const e of g.step([idle])) {
        if (e.type === 'kick') { kicked = true; vSum += e.speed; }
        if (e.type === 'goal') res = 'goal';
      }
      if (kicked && g.ball.v.len() < 1) res = 'miss';
    }
    if (res === 'goal') goals++;
  }
  return { rate: goals / n, speed: vSum / n };
}

export function shotTable(qs = '') {
  const rows = curveTable(qs);
  for (const r of rows) {
    const e = emptyGoal(qs, r.D, r.tech === 'vollspann' ? 'std' : 'var');
    r.hit = e.rate; r.playSpeed = e.speed;
  }
  return rows;
}

export function selfplay(qs = '', n = 4, seed0 = 300) {
  const r = { games: n, shots: 0, goals: 0, dives: 0, vmax: 0, out: 0, nan: 0, faults: 0, minutes: 0, saves: 0, diveSaves: 0 };
  for (let s = 1; s <= n; s++) {
    const g = new Game(makeParams(qs), seed0 + s, { match: true, human: -1, botLevels: [2, 2] });
    const hx = g.cage.hx + 0.6, hz = g.cage.hz + 0.6;
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 300) {
      for (const e of g.step([])) {
        if (e.type === 'kick' && e.kind === 'shot') { r.shots++; if (e.speed > r.vmax) r.vmax = e.speed; }
        if (e.type === 'goal') r.goals++;
        if (e.type === 'dive') r.dives++;
        if (e.type === 'catch' || e.type === 'parry') { r.saves++; const k = g.players[e.player]; if (k.hand.mode === 'dive' || k.hand.mode === 'ground') r.diveSaves++; }
      }
      const b = g.ball.p;
      if (!Number.isFinite(b.x + b.y + b.z)) { r.nan++; break; }
      if (Math.abs(b.x) > hx + 1.5 || Math.abs(b.z) > hz) r.out++; // hinter dem Tor liegt das Netz (≈ 1 m tief)
    }
    r.faults += g.faults || 0;
    r.minutes += g.t / 60;
  }
  return r;
}
export const fmtSelf = (name, r) => `${name.padEnd(24)} ${r.games} Spiele | Schüsse ${(r.shots / r.games).toFixed(1)} | Tore ${(r.goals / r.games).toFixed(1)} | ` +
  `Tore je Schuss ${(100 * r.goals / Math.max(1, r.shots)).toFixed(1)} % | Hechten ${(r.dives / r.games).toFixed(1)} | Paraden ${(r.saves / r.games).toFixed(1)} (im Hechten ${(r.diveSaves / r.games).toFixed(1)}) | ` +
  `max ${(r.vmax * 3.6).toFixed(0)} km/h | draußen ${r.out} | NaN ${r.nan} | Notbremsen ${r.faults}`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) { // Windows-tauglich (file:///C:/…)
  const what = process.argv[2] || 'table', qs = process.argv[3] || '', n = +(process.argv[4] || 4);
  if (what === 'table') {
    console.log(`Schuss (${qs || 'Standard'}): Entfernung | Technik | Abflug m/s | Flugzeit s | Kurve m | Drall U/s | leeres Tor`);
    for (const r of shotTable(qs)) console.log(`  ${r.D} m | ${r.tech} | ${r.speed.toFixed(1)} | ${r.t.toFixed(2)} | ${r.dev.toFixed(2)} | ${Math.abs(r.spin).toFixed(1)} | ${(100 * r.hit).toFixed(0)} %`);
  } else console.log(fmtSelf(qs || 'Standard', selfplay(qs, n)));
}
