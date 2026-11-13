// n14 Etappe 3 (Peter 13.11.: „Ballmagnet zum ballabschirmen verstärken“): Mensch führt den Ball gegen Verteidiger + Tormann (wie n7_probe
// humanHold, 30 Seeds × 90 s) und zählt, WIE er ihn verliert (Grätsche Ball/Körper, Tormann, Kontakt). Aufruf: node tests/node/n14_halten_probe.mjs ["Query"]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
export function humanHold2(qs = '', seeds = 20, secs = 90) {
  const o = { k: {}, att: 0, lost: 0, free: 0, ok: 0, timeout: 0, holdT: 0 };
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
      if (ev.some((e) => e.player > 0 && ['touch', 'kick', 'catch', 'parry', 'control'].includes(e.type)) || ev.some((e) => e.type === 'tackle' && e.phase === 'hit' && e.result !== 'schirm' && e.player > 0)) { const e = ev.find((e) => e.player > 0 && (['touch', 'kick', 'catch', 'parry', 'control'].includes(e.type) || (e.type === 'tackle' && e.phase === 'hit' && e.result !== 'schirm'))); const p = g.players[e.player]; const [fx2, fz2] = me.footPoint(); const k = (p === kp ? 'TW ' : 'Vt ') + e.type + (e.kind ? ':' + e.kind : '') + (e.result ? ':' + e.result : '') + ' d' + (Math.hypot(b.p.x - fx2, b.p.z - fz2) < 0.6 ? '<0.6' : '>0.6'); o.k[k] = (o.k[k] || 0) + 1; end('lost'); continue; }
      const [fx, fz] = me.footPoint();
      if (Math.hypot(b.p.x - fx, b.p.z - fz) > 2.5) { end('free'); continue; }
      if (me.x > hx - 5.5) { end('ok'); continue; }
      if (g.t - t0 > 12) end('timeout');
    }
    o.att--; // der letzte, abgebrochene Versuch zählt nicht
  }
  return { ...o, holdMean: o.holdT / o.att, lostPerMin: o.lost / (o.holdT / 60), okShare: 100 * o.ok / o.att, lostShare: 100 * o.lost / o.att, freeShare: 100 * o.free / o.att };
}


const r = humanHold2(process.argv[2] || '', 30, 90); console.log(process.argv[2] || 'std', r.lostPerMin.toFixed(2), JSON.stringify(r.k));
