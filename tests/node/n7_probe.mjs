// n7-Messwerkzeug (Etappe 0 + Vorlagen-Etappen): Bot-Selbstspiel mit allen Messgrößen in einem Lauf, parallel auf mehreren
// Prozessen. Zählt Tore je Schuss, Schüsse/Pässe je Spiel, Hänger, Numerik-Fehler, Fangquote des ersten Torwartkontakts
// nach einem Schuss (je Schusstempo, Klassen wie keeper_catch_probe.mjs), Fangquote langsamer Bälle (< 45 km/h an den
// Händen), Nachschuss-Tore (Tor ≤ 2 s nach einer Parade), Ballverluste beim Führen (Zweikampf/verspringt, Logik wie
// dribble_probe.mjs), Ballbesitz am Fuß, Grätschen (Treffer, Ballgewinn), lange Dribblings, Ball in den Ecken.
// Aufruf: node tests/node/n7_probe.mjs [Spiele=12] [Query] [Mix: alle | st2 | 13] [Prozesse=6]
//   alle = Stufen reihum wie keeper_catch_probe.mjs (Seeds 1001 …), st2 = Stufe 2 gegen 2 (Seeds 1 …), 13 = Stufe 1 gegen 3
import { playGame } from './selfplay.mjs';
import { DT, Game } from '../../src/sim/step.js';
import { makeParams } from '../../src/sim/params.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SHOT_BINS = [[0, 13], [13, 16], [16, 20], [20, 25], [25, 99]]; // m/s Schusstempo (47 / 58 / 72 / 90 km/h)

export function gameSetup(mix, s) {
  if (mix === 'st2') return { seed: s, levels: [2, 2] };
  if (mix === '13') return { seed: 100 + s, levels: s % 2 ? [1, 3] : [3, 1] };
  return { seed: 1000 + s, levels: [[1, 1], [2, 2], [3, 3], [2, 3]][s % 4] };
}

export function emptyStats() {
  return {
    games: 0, minutes: 0, goals: 0, shots: 0, passes: 0, stuck: 0, faults: 0, nan: 0,
    bins: SHOT_BINS.map(() => ({ catch: 0, parry: 0, goal: 0 })), binsD: SHOT_BINS.map(() => ({ catch: 0, parry: 0, goal: 0 })), shotSp: [],
    slowCatch: 0, slowAll: 0, catches: 0, parries: 0, dives: 0, rebound: 0, afterParry: 0,
    losses: 0, duel: 0, free: 0, dribbleT: 0, touches: 0, tackles: 0, tackleBall: 0, tackleStart: 0,
    longDrib: 0, maxDrib: 0, cornerT: 0, energyMin: [], lowT: 0,
    // Datenblatt-Messgrößen (Abschnitt 5)
    acuteGoals: 0, acuteShots: 0, air: 0, airGoals: 0, doubles: 0, gg: 0, ggN: 0, passOk: 0, passInt: 0, passN: 0,
    cornerTouches: 0, cornerStuck: 0, perfekt: 0, perfektGoals: 0, perfektShot: 0, nachdrall: 0, stumble: 0, rausBlock: 0,
  };
}

export function measureGame(qs, mix, s) {
  const { seed, levels } = gameSetup(mix, s);
  const r = emptyStats();
  let last = null;                              // letzter Schuss {v, t, team}
  let reb = null;                               // letzte Parade {t, team = Mannschaft des Tormanns, again = Angreifer danach am Ball}
  let dr = -1, duel = false, drStart = 0;
  let clock = 0;
  let lastPass = null, pendPass = null, lastAir = null, lastPerf = null;
  const runs = [];                              // Geben und Gehen: Passgeber nach dem Pass beobachten
  const fwd = (team, x) => (team === 0 ? x : -x);
  const oppDist = (g, p) => { let m = 9; for (const o of g.players) if (o.team !== p.team) m = Math.min(m, Math.hypot(o.x - g.ball.p.x, o.z - g.ball.p.z)); return m; };
  const endDrib = (g) => { if (dr >= 0) { const d = g.t - drStart; if (d > 8) r.longDrib++; r.maxDrib = Math.max(r.maxDrib, d); } dr = -1; };
  const lose = () => { r.losses++; if (duel) r.duel++; else r.free++; };
  const st = playGame(seed, { qs, levels, onStep: (g, ev) => {
    const b = g.ball;
    if (!Number.isFinite(b.p.x + b.p.y + b.p.z)) r.nan++;
    for (const e of ev) {
      const p = e.player != null && e.player >= 0 ? g.players[e.player] : null;
      // Schüsse und erster Torwartkontakt
      if (e.type === 'kick') {
        if (e.kind === 'shot') {
          r.shots++; r.shotSp.push(e.speed); last = { v: e.speed, t: g.t, team: p ? p.team : -1, defl: false, x: e.x, z: e.z };
          if (p) { const gx = p.team === 0 ? g.cage.hx : -g.cage.hx; last.acute = Math.abs(e.z) > 3 && Math.hypot(gx - e.x, e.z) < 6; if (last.acute) r.acuteShots++; }
        } else last = null;
        if (p && e.kind === 'pass' && e.to >= 0 && e.to !== e.player && g.players[e.to].team === p.team) {
          if (lastPass && lastPass.from === e.to && lastPass.to === e.player && g.t - lastPass.t < 4) r.doubles++;   // Doppelpass
          lastPass = { from: e.player, to: e.to, t: g.t };
          pendPass = { to: e.to, team: p.team }; r.passN++;
          const D = Math.hypot(g.players[e.to].x - e.x, g.players[e.to].z - e.z);
          if (D >= 4) { r.ggN++; runs.push({ id: e.player, team: p.team, x0: p.x, t0: g.t, done: false }); }
        }
        if (e.kind === 'pass' && e.to >= 0 && e.to !== e.player) r.passes++;   // Pass zum Mitspieler (kein Mitnehmen zu sich selbst)
        if (reb && p && p.team !== reb.team && g.t - reb.t <= 2) reb.again = true;     // Angreifer spielt den Abpraller
      } else if (last && (e.type === 'board' || e.type === 'post' || e.type === 'net' || e.type === 'body')) last.defl = true; // abgefälscht
      else if (e.type === 'touch' || e.type === 'control') { last = null; if (reb && p && p.team !== reb.team && g.t - reb.t <= 2) reb.again = true; }
      if ((e.type === 'catch' || e.type === 'parry') && p) {
        if (e.type === 'catch') { r.catches++; reb = null; } else { r.parries++; reb = { t: g.t, team: p.team, again: false }; }
        if (e.speed < 12.5) { r.slowAll++; if (e.type === 'catch') r.slowCatch++; }
        if (last && g.t - last.t <= 2 && last.team !== p.team) {
          const i = SHOT_BINS.findIndex(([a, c]) => last.v >= a && last.v < c);
          r.bins[i][e.type]++;
          if (!last.defl) r.binsD[i][e.type]++;
        }
        last = null;
      }
      if (e.type === 'goal') {
        r.goals++;
        if (last && g.t - last.t <= 2) { const i = SHOT_BINS.findIndex(([a, c]) => last.v >= a && last.v < c); r.bins[i].goal++; if (last.acute) r.acuteGoals++; }
        if (reb && reb.team !== e.team && g.t - reb.t <= 2) { r.afterParry++; if (reb.again) r.rebound++; }
        reb = null;
        last = null;
      }
      if (e.type === 'dive') r.dives++;
      if (e.type === 'air') { r.air++; lastAir = { t: g.t, team: p ? p.team : -1 }; }
      if (e.type === 'perfektpass') { r.perfekt++; lastPerf = { t: g.t, team: e.team }; }
      if (e.type === 'kick' && e.perfekt) r.perfektShot++;
      if (e.type === 'stolpern') r.stumble++;
      if (e.type === 'block') r.rausBlock++;
      if (e.type === 'nachdrall') r.nachdrall++;
      if (e.type === 'goal') {
        if (lastAir && lastAir.team === e.team && g.t - lastAir.t < 2.5) r.airGoals++;
        if (lastPerf && lastPerf.team === e.team && g.t - lastPerf.t < 4) r.perfektGoals++;
        lastAir = null; lastPerf = null;
      }
      if (p && (e.type === 'touch' || e.type === 'kick' || e.type === 'control' || e.type === 'catch' || e.type === 'parry')) {
        if (pendPass && e.player !== lastPass?.from) { if (e.player === pendPass.to) r.passOk++; else if (p.team !== pendPass.team) r.passInt++; pendPass = null; }
        if (lastPass && p.team !== g.players[lastPass.from].team) lastPass = null;
        if ((e.type === 'touch' || e.type === 'kick') && Math.abs(e.x) > g.cage.hx - 2.5 && Math.abs(e.z) > g.cage.hz - 2.5) r.cornerTouches++;
      }
      if (e.type === 'tackle' && e.phase === 'start') r.tackleStart++;
      if (e.type === 'tackle' && e.phase === 'hit') { r.tackles++; if (e.result === 'ball') r.tackleBall++; }
      // Ballverluste beim Führen (wie dribble_probe.mjs)
      if (!p) { if (e.type === 'goal' || e.type === 'restart') endDrib(g); continue; }
      if (e.type === 'touch') {
        if (dr >= 0 && p.team !== g.players[dr].team) { lose(); endDrib(g); }
        if (dr !== p.id) { endDrib(g); drStart = g.t; }
        dr = p.id; r.touches++; duel = oppDist(g, p) < 1.5;
      } else if (e.type === 'kick' || e.type === 'throw' || e.type === 'punt') {
        if (dr >= 0 && p.team !== g.players[dr].team) lose();
        endDrib(g);
      } else if (e.type === 'catch' || e.type === 'parry' || e.type === 'control' || (e.type === 'tackle' && e.phase === 'hit')) {
        if (dr >= 0 && p.team !== g.players[dr].team) lose();
        endDrib(g);
      }
    }
    for (const ru of runs) if (!ru.done) {
      const pl = g.players[ru.id];
      if (fwd(ru.team, pl.x - ru.x0) >= 4) { ru.done = true; r.gg++; } else if (g.t - ru.t0 > 3) ru.done = true;
    }
    if (dr >= 0) {
      r.dribbleT += DT;
      if (Math.abs(b.p.x) > g.cage.hx - 2 && Math.abs(b.p.z) > g.cage.hz - 2) r.cornerT += DT;
    }
    // Tormann-Energie (E1, falls vorhanden)
    if (g.rules.energy && g.rules.phase === 'play') { for (let t = 0; t < 2; t++) if (g.rules.energy[t] < g.P.muedeFang) r.lowT += DT / 2; }
    clock = g.rules.clock;
    if (g.rules.energy) r._emin = Math.min(r._emin ?? 100, ...g.rules.energy);
  } });
  r.games = 1; r.minutes = clock / 60; r.stuck = st.stuck.length; r.faults = st.faults;
  r.cornerStuck = st.stuck.filter((x) => x.kind === 'Ball in der Ecke eingeklemmt').length;
  if (r._emin != null) r.energyMin.push(r._emin);
  delete r._emin;
  return r;
}

// Skript-Mensch dribbelt gegen einen Verteidiger der Stufe 2 (plus Tormann) aufs Tor: Stick Richtung Tor mit Schlangenlinie,
// Sprint (falls es ihn gibt), wenn kein Gegner ≤ 3 m ist. Ein Versuch endet mit Ballverlust (Gegner am Ball), verspringt
// (Ball > 2,5 m vom Fuß), Erfolg (≤ 5,5 m vor der Torlinie) oder nach 12 s. Haltedauer = Zeit am Ball je Versuch.
export function humanHold(qs = '', seeds = 20, secs = 90) {
  const o = { att: 0, lost: 0, free: 0, ok: 0, timeout: 0, holdT: 0 };
  for (let s = 1; s <= seeds; s++) {
    const g = new Game(makeParams(qs), 300 + s, { match: true, human: 0, perTeam: [1, 2], botLevels: [2, 2], kickoffTeam: 0 });
    const me = g.players[0], kp = g.players[1], df = g.players[2], b = g.ball, hx = g.cage.hx, rng = new Rng(77 + s);
    let t0 = 0, z0 = 0, ph = 0;
    const reset = () => {
      z0 = rng.range(-3, 3); ph = rng.range(0, 6.28);
      me.place(-5, z0, 0); b.place(-4.55, b.r, z0); b.held = -1;
      kp.place(hx - 1.3, 0, Math.PI); df.place(rng.range(2, 5), rng.range(-2.5, 2.5), Math.PI);
      g.lastTouch = 0; g.lastTouchT = g.t; me.lastTouchT = g.t; g.rules.phase = 'play'; g.rules.updateKeepers(0, true); g.passPlan = null;
      t0 = g.t; o.att++;
    };
    reset();
    const end = (k) => { o[k]++; o.holdT += g.t - t0; reset(); };
    for (let i = 0; i < secs / DT; i++) {
      const a = Math.atan2(-me.z * 0.4, hx - me.x) + 0.55 * Math.sin((g.t - t0) * 2.4 + ph);
      const space = Math.min(...[kp, df].map((p) => Math.hypot(p.x - me.x, p.z - me.z)));
      const ev = g.step([{ ...EMPTY_INPUT, mx: Math.cos(a), mz: Math.sin(a), sprint: space > 3, passDown: false, shotDown: false }]);
      if (g.rules.phase !== 'play') { end('timeout'); continue; }
      if (ev.some((e) => e.player > 0 && ['touch', 'kick', 'catch', 'parry', 'control'].includes(e.type)) || ev.some((e) => e.type === 'tackle' && e.phase === 'hit' && e.player > 0)) { end('lost'); continue; }
      const [fx, fz] = me.footPoint();
      if (Math.hypot(b.p.x - fx, b.p.z - fz) > 2.5) { end('free'); continue; }
      if (me.x > hx - 5.5) { end('ok'); continue; }
      if (g.t - t0 > 12) end('timeout');
    }
    o.att--; // der letzte, abgebrochene Versuch zählt nicht
  }
  return { ...o, holdMean: o.holdT / o.att, lostPerMin: o.lost / (o.holdT / 60), okShare: 100 * o.ok / o.att, lostShare: 100 * o.lost / o.att, freeShare: 100 * o.free / o.att };
}

export function merge(a, b) {
  for (const k of Object.keys(a)) {
    if (k === 'bins' || k === 'binsD') a[k].forEach((x, i) => { for (const j in x) x[j] += b[k][i][j]; });
    else if (Array.isArray(a[k])) a[k].push(...b[k]);
    else if (k === 'maxDrib') a[k] = Math.max(a[k], b[k]);
    else a[k] += b[k];
  }
  return a;
}

// Mehrere Prozesse: Spiele 1…N reihum verteilt, Ergebnis zusammengeführt
export function runProbe(qs = '', N = 12, mix = 'alle', W = 6) {
  const here = fileURLToPath(import.meta.url);
  W = Math.max(1, Math.min(W, N));
  return Promise.all(Array.from({ length: W }, (_, w) => new Promise((res, rej) => {
    const seeds = []; for (let s = 1 + w; s <= N; s += W) seeds.push(s);
    const ch = fork(here, ['--worker', qs, mix, seeds.join(',')], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    ch.on('message', (m) => res(m)); ch.on('error', rej);
    ch.on('exit', (c) => { if (c) rej(new Error(`Prozess ${w}: Exit ${c}`)); });
  }))).then((parts) => parts.reduce((a, b) => merge(a, b), emptyStats()));
}

export function summary(r) {
  const pc = (a, b) => (b ? 100 * a / b : NaN);
  const sp = [...r.shotSp].sort((a, b) => a - b), q = (p) => (sp.length ? sp[Math.floor(p * (sp.length - 1))] * 3.6 : NaN);
  const fq = r.bins.map((x) => pc(x.catch, x.catch + x.parry)), fqD = r.binsD.map((x) => pc(x.catch, x.catch + x.parry));
  return {
    games: r.games, goalsPerShot: pc(r.goals, r.shots), goalsPerGame: r.goals / r.games, shotsPerGame: r.shots / r.games, passesPerGame: r.passes / r.games,
    stuck: r.stuck, faults: r.faults + r.nan, shotKmh: [q(0.1), q(0.5), q(0.9)],
    catchBins: fq, binN: r.bins.map((x) => x.catch + x.parry), catchBinsD: fqD, binND: r.binsD.map((x) => x.catch + x.parry), slowCatch: pc(r.slowCatch, r.slowAll), slowN: r.slowAll,
    catchesPerGame: r.catches / r.games, parriesPerGame: r.parries / r.games, divesPerGame: r.dives / r.games,
    rebound: r.rebound, reboundShare: pc(r.rebound, r.goals), afterParry: r.afterParry, afterParryShare: pc(r.afterParry, r.goals),
    lossMin: r.losses / r.minutes, duelMin: r.duel / r.minutes, freeMin: r.free / r.minutes, footSMin: r.dribbleT / r.minutes,
    tacklesPerGame: r.tackles / r.games, tackleBallPerGame: r.tackleBall / r.games, tackleBallShare: pc(r.tackleBall, r.tackleStart), tackleStartPerGame: r.tackleStart / r.games,
    longDrib: r.longDrib, maxDrib: r.maxDrib, cornerSMin: r.cornerT / r.minutes,
    acuteShare: pc(r.acuteGoals, r.goals), acuteGoals: r.acuteGoals, acuteShots: r.acuteShots, airPerGame: r.air / r.games, airGoals: r.airGoals,
    doublesPerGame: r.doubles / r.games, ggShare: pc(r.gg, r.ggN), passOkShare: pc(r.passOk, r.passN), passIntShare: pc(r.passInt, r.passN),
    cornerTouchesPerGame: r.cornerTouches / r.games, cornerStuck: r.cornerStuck, perfektPerGame: r.perfekt / r.games, perfektGoalShare: pc(r.perfektGoals, r.perfekt), perfektShotShare: pc(r.perfektShot, r.perfekt),
    nachdrallPerGame: r.nachdrall / r.games, stumblePerGame: r.stumble / r.games, blockPerGame: r.rausBlock / r.games,
    energyMin: r.energyMin.length ? r.energyMin.reduce((a, b) => a + b, 0) / r.energyMin.length : null, lowShare: pc(r.lowT, r.minutes * 60),
  };
}

export function printSummary(label, s) {
  const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  const names = ['0–47', '47–58', '58–72', '72–90', '≥ 90'];
  console.log(`== ${label}: ${s.games} Spiele`);
  console.log(`  Tore je Schuss ${f(s.goalsPerShot)} % · Tore/Spiel ${f(s.goalsPerGame)} · Schüsse/Spiel ${f(s.shotsPerGame)} · Pässe/Spiel ${f(s.passesPerGame)} · Hänger ${s.stuck} · Numerik ${s.faults}`);
  console.log(`  Schusstempo p10/p50/p90 ${s.shotKmh.map((x) => f(x, 0)).join('/')} km/h · Fangquote erster Kontakt: ${names.map((n, i) => `${n} km/h ${f(s.catchBins[i], 0)} % (${s.binN[i]})`).join(', ')}`);
  console.log(`  … nur direkte Schüsse (nicht von Bande/Pfosten/Netz/Spieler abgefälscht): ${names.map((n, i) => `${n} ${f(s.catchBinsD[i], 0)} % (${s.binND[i]})`).join(', ')}`);
  console.log(`  langsame Bälle (< 45 km/h an den Händen) gefangen ${f(s.slowCatch, 0)} % (${s.slowN}) · Fangen/Abwehren/Hechten je Spiel ${f(s.catchesPerGame)}/${f(s.parriesPerGame)}/${f(s.divesPerGame)} · Tore ≤ 2 s nach Parade ${s.afterParry} = ${f(s.afterParryShare)} %, davon Nachschuss ${s.rebound} = ${f(s.reboundShare)} % der Tore`);
  console.log(`  Ballverluste beim Führen ${f(s.lossMin, 2)}/min (Zweikampf ${f(s.duelMin, 2)}, verspringt ${f(s.freeMin, 2)}) · Ball am Fuß ${f(s.footSMin)} s/min · Grätschen je Spiel ${f(s.tackleStartPerGame)} (Treffer ${f(s.tacklesPerGame)}, Ballgewinn ${f(s.tackleBallPerGame)} = ${f(s.tackleBallShare, 0)} %)`);
  console.log(`  Datenblatt: Tore aus spitzem Winkel ${s.acuteGoals} = ${f(s.acuteShare)} % der Tore (${s.acuteShots} Schüsse) · Luftbälle/Spiel ${f(s.airPerGame)} (${s.airGoals} Tore) · Doppelpässe/Spiel ${f(s.doublesPerGame)} · Geben und Gehen ${f(s.ggShare, 0)} % der Pässe ≥ 4 m · Pässe kommen an ${f(s.passOkShare, 0)} %, abgefangen ${f(s.passIntShare, 0)} % · Ballkontakte in den Ecken/Spiel ${f(s.cornerTouchesPerGame)}, eingeklemmt ${s.cornerStuck}`);
  if (s.perfektPerGame || s.nachdrallPerGame || s.stumblePerGame || s.blockPerGame) console.log(`  Traumpässe/Spiel ${f(s.perfektPerGame)} (direkt abgenommen ${f(s.perfektShotShare, 0)} %, Tore danach ${f(s.perfektGoalShare, 0)} %) · Nachdrall/Spiel ${f(s.nachdrallPerGame)} · Heber-Stolpern/Spiel ${f(s.stumblePerGame)} · Blocken/Spiel ${f(s.blockPerGame)}`);
  console.log(`  Dribblings > 8 s: ${s.longDrib}, längstes ${f(s.maxDrib)} s · Ball am Fuß in den Ecken ${f(s.cornerSMin, 2)} s/min${s.energyMin != null ? ` · Tormann-Energie Minimum Ø ${f(s.energyMin, 0)}, unter der Fanggrenze ${f(s.lowShare)} % der Spielzeit` : ''}`);
}

const self = pathToFileURL(process.argv[1] || '').href === import.meta.url;
if (self && process.argv[2] === '--worker') {
  const [, , , qs, mix, list] = process.argv;
  const acc = emptyStats();
  for (const s of list.split(',').map(Number)) merge(acc, measureGame(qs, mix, s));
  process.send(acc, () => process.exit(0));
} else if (self) {
  const N = +(process.argv[2] || 12), qs = process.argv[3] || '', mix = process.argv[4] || 'alle', W = +(process.argv[5] || 6);
  const t0 = performance.now();
  const r = await runProbe(qs, N, mix, W);
  const s = summary(r);
  printSummary(`n7-Probe „${qs || 'Standard'}“, Mix ${mix}`, s);
  console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s Rechenzeit)`);
  if (process.env.JSON) console.log(JSON.stringify(s));
}

// n7 E1: 1 gegen 1 – ein Bot-Stürmer (Stufe lv) startet mit dem Ball 6,5–9,5 m vor dem Tor, gegen ihn nur der Bot-Tormann
// (Stufe lv); sein eigener Tormann und ein Verteidiger stehen weit weg. Vereitelt = kein Tor innerhalb von 6 s.
export function oneOnOne(qs = '', n = 60, lv = 2) {
  const o = { n: 0, saved: 0, goals: 0, block: 0, parry: 0, catch: 0, shots: 0 };
  for (let s = 1; s <= n; s++) {
    const g = new Game(makeParams(qs), 700 + s, { match: true, human: -1, perTeam: [2, 2], botLevels: [lv, lv], kickoffTeam: 0 });
    const rng = new Rng(900 + s), hx = g.cage.hx;
    const att = g.players[0], own = g.players[1], kp = g.players[2], df = g.players[3], b = g.ball;
    const d0 = rng.range(6.5, 9.5), z0 = rng.range(-2.5, 2.5);
    att.place(hx - d0, z0, 0); b.place(hx - d0 + 0.45, b.r, z0); own.place(-hx + 1.2, 0, 0); kp.place(hx - 1.1, 0, Math.PI); df.place(-4, -z0, 0);
    g.rules.phase = 'play'; g.rules.updateKeepers(0, true); g.lastTouch = 0; g.lastTouchT = 0; att.lastTouchT = 0;
    o.n++;
    let goal = false;
    for (let i = 0; i < 6 / DT && !goal; i++) {
      for (const e of g.step([])) {
        if (e.type === 'goal') goal = e.team === 0;
        else if (e.player === kp.id && (e.type === 'catch' || e.type === 'parry' || e.type === 'block')) o[e.type]++;
        else if (e.type === 'kick' && e.kind === 'shot' && e.player === att.id) o.shots++;
      }
      if (g.rules.phase !== 'play') break;
    }
    if (goal) o.goals++; else o.saved++;
  }
  return { ...o, savedShare: 100 * o.saved / o.n };
}
