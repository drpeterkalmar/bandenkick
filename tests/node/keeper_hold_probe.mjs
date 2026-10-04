// Messprobe Tormann mit Ball (Nacht 2e, Peter 03.10.: „lass den Torwart nicht den Ball so lange in die Hand nehmen und
// erlaube keinen Rückpass“). Bot-Spiele (alle Bots, Stufe 2): Haltezeit je Ballbesitz des Tormanns (Median/90 %/max),
// Abwurf/Abschlag/Zwangsabwurf, abgefangene Abwürfe (Gegner berührt zuerst), Gegentor ≤ 6 s nach einem abgefangenen
// Abwurf, dazu Rückpässe: Pässe der Feldspieler zum eigenen Tormann (letzte Hand im Torraum) und Bälle, die der Tormann
// nach einem Rückpass des eigenen Mitspielers (Kick Richtung eigenes Tor, zum Tormann oder nah am Torraum, ohne Kopfball,
// ohne Berührung/Abpraller am Gegner dazwischen) mit den Händen nimmt.
// Aufruf: node tests/node/keeper_hold_probe.mjs [Spiele] ["qs"]   z. B. node tests/node/keeper_hold_probe.mjs 8 "halten=0&rueckpass=1"
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';

export function holdProbe(qs = '', games = 6, seed0 = 1) {
  const holds = [], kinds = { throw: 0, punt: 0, sixsec: 0 };
  let rel = 0, inter = 0, interGoal = 0, backPass = 0, backCatch = 0, passes = 0, catches = 0, goals = 0, faults = 0;
  for (let s = 0; s < games; s++) {
    const g = new Game(makeParams(qs), 'halten' + (seed0 + s), { match: true, human: -1 });
    const R = g.rules;
    let t0 = -1, holder = -1, watch = null, lastKick = null;
    while (R.phase !== 'end' && g.t < R.halfLen * 2 + 300) {
      const keeperBefore = [...R.keeper];
      const ev = g.step([]);
      for (const e of ev) {
        if (e.type === 'goal') { goals++; if (watch && watch.inter && e.team !== g.players[watch.k].team && g.t - watch.t < 6) { interGoal++; watch = null; } }
        if (e.type === 'kick') {
          const pl = g.players[e.player];
          if (e.kind === 'pass') {
            passes++;
            const kp = keeperBefore[pl.team];
            if (e.to === kp && e.to !== pl.id && R.inBox(pl.team, g.players[kp].x, g.players[kp].z, 1)) backPass++;
          }
          // Rückpass im Sinn der Regel: Kick (kein Kopfball, nicht zu sich selbst vorgelegt) Richtung eigenes Tor, zum Tormann
          // oder nah am eigenen Torraum; ein Feldspieler, nicht der Tormann selbst
          const side = pl.team === 0 ? 1 : -1, gx = R.goalX(pl.team);
          const back = e.to !== e.player && e.tech !== 'kopf' && e.tech !== 'flugkopf' && keeperBefore[pl.team] !== pl.id &&
            (e.to === keeperBefore[pl.team] || e.dx * side < -0.2 || Math.hypot(e.x - gx, e.z) < g.P.torraum + 3);
          lastKick = back ? { player: e.player, team: pl.team, t: g.t } : null;
        }
        if (e.type === 'touch') lastKick = null; // ein Ballkontakt dazwischen (Annahme, Abpraller) – kein Rückpass mehr
        if (e.type === 'body' && lastKick && g.players[e.player].team !== lastKick.team) lastKick = null; // am Gegner abgeprallt
        if (e.type === 'catch') {
          catches++;
          const pl = g.players[e.player];
          if (lastKick && lastKick.team === pl.team && lastKick.player !== pl.id) backCatch++;
        }
        if ((e.type === 'throw' || e.type === 'punt') && e.player === holder && t0 >= 0) {
          holds.push(g.t - t0); kinds[e.type]++; rel++;
          watch = { k: holder, t: g.t, inter: false, done: false };
          t0 = -1; holder = -1;
        }
        if (e.type === 'sixsec') kinds.sixsec++;
        if (watch && !watch.done && ['touch', 'kick', 'control', 'catch', 'parry'].includes(e.type) && e.player != null && e.player !== watch.k) {
          watch.done = true;
          if (g.players[e.player].team !== g.players[watch.k].team) { watch.inter = true; inter++; }
        }
        if (e.type === 'catch' || e.type === 'restart') lastKick = null;
      }
      const b = g.ball;
      if (b.held >= 0 && holder !== b.held) { holder = b.held; t0 = g.t - g.players[b.held].holdT; }
      if (b.held < 0 && holder >= 0 && t0 >= 0 && R.phase !== 'play') { holder = -1; t0 = -1; } // Tor/Ende während des Haltens
    }
    faults += g.faults;
  }
  holds.sort((a, b) => a - b);
  const q = (p) => (holds.length ? holds[Math.min(holds.length - 1, Math.floor(holds.length * p))] : NaN);
  return { games, n: holds.length, med: q(0.5), p90: q(0.9), max: holds.length ? holds[holds.length - 1] : NaN, mean: holds.reduce((a, b) => a + b, 0) / Math.max(1, holds.length),
    kinds, interPct: rel ? inter / rel * 100 : NaN, inter, interGoal, backPass, backCatch, passes, catches, goals, faults };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 6), qs = process.argv[3] || '';
  const t0 = Date.now();
  const r = holdProbe(qs, n);
  const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  console.log(`Tormann mit Ball ${qs || '(Standard)'} – ${n} Bot-Spiele: ${r.n} Ballbesitze, Haltezeit Median ${f(r.med)} s, 90 % ${f(r.p90)} s, max ${f(r.max)} s, Mittel ${f(r.mean)} s`);
  console.log(`  Abwurf ${r.kinds.throw}, Abschlag ${r.kinds.punt}, Zwangsabwurf ${r.kinds.sixsec}; abgefangen ${r.inter} (${f(r.interPct, 1)} %), daraus Gegentor ≤ 6 s ${r.interGoal}`);
  console.log(`  Rückpässe zum Tormann ${r.backPass} von ${r.passes} Pässen, Hand nach Rückpass ${r.backCatch} von ${r.catches} Fängen; Tore ${r.goals}, Fehler ${r.faults} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
