// Nacht 2e: Pässe im Bot-Spiel (alle Bots, Stufe 2): Anteil der Pässe zu einem Mitspieler, die beim Empfänger ankommen
// (er berührt den Ball als Erster), abgefangen, anderer Mitspieler (auch der Passgeber selbst), niemand (4 s).
// Aufruf: node tests/node/botpass_probe.mjs [Spiele] ["qs"]   z. B. "passfix=0"
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';

export function botPassProbe(qs = '', games = 6, seed0 = 1) {
  const c = { n: 0, ok: 0, inter: 0, other: 0, self: 0, none: 0 };
  for (let s = 0; s < games; s++) {
    const g = new Game(makeParams(qs), 'bp' + (seed0 + s), { match: true, human: -1 });
    let open = null;
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 300) {
      for (const e of g.step([])) {
        if (open && ['touch', 'kick', 'control', 'catch', 'parry'].includes(e.type) && e.player != null && g.t > open.t + 0.02) {
          const pl = g.players[e.player];
          c[e.player === open.to ? 'ok' : e.player === open.from ? 'self' : pl.team === open.team ? 'other' : 'inter']++;
          open = null;
        }
        if (open && (e.type === 'goal' || e.type === 'restart')) { c.none++; open = null; }
        if (!open && e.type === 'kick' && e.kind === 'pass' && e.to >= 0 && e.to !== e.player) { open = { t: g.t, to: e.to, from: e.player, team: g.players[e.player].team }; c.n++; }
      }
      if (open && g.t > open.t + 4) { c.none++; open = null; }
    }
  }
  const p = (k) => (100 * c[k] / Math.max(1, c.n));
  return { ...c, okPct: p('ok'), interPct: p('inter'), otherPct: p('other'), selfPct: p('self'), nonePct: p('none') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = botPassProbe(process.argv[3] || '', +(process.argv[2] || 6));
  const f = (v) => v.toFixed(1);
  console.log(`Bot-Pässe ${process.argv[3] || '(Standard)'}: ${r.n} Pässe – kommt an ${f(r.okPct)} %, abgefangen ${f(r.interPct)} %, anderer Mitspieler ${f(r.otherPct)} %, Passgeber selbst ${f(r.selfPct)} %, niemand ${f(r.nonePct)} %`);
}
