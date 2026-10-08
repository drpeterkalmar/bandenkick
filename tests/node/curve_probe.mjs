// Banane und Flanke (Nacht 2c): Messtabelle vorher/nachher mit echter Ballphysik (ohne Tormann, ohne Gegner).
//  - Schuss aus guter Lage (Ball am Fuß, zum Tor gedreht) aus 8 / 12 / 16 m: Vollspann vs. angeschnitten (Innenrist) –
//    Abfluggeschwindigkeit, Flugzeit bis zur Torlinie, Scheitel, seitliche Kurve (größter Abstand zur Geraden).
//  - Pass hoch (Doppeltipp) zu einem Mitspieler in 6 / 9 / 12 / 15 m (steht, Flanke in den Torraum bzw. Chip): Abflug,
//    Abflugwinkel, Flugzeit bis zur Landung, Scheitel.
// Aufruf: node tests/node/curve_probe.mjs ["banane=0&flanke=0"]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { planShot } from '../../src/sim/shot.js';
import { planPass } from '../../src/sim/pass.js';
import { Ball } from '../../src/sim/ball.js';
import { setKick } from '../../src/sim/kickplan.js';
import { pathToFileURL } from 'node:url';

// Flug nachrechnen: Ball ab from mit Plan (dir, speed, el, back, side) bis Torlinie x = gx bzw. Landung
function fly(g, plan, from, stopX = null) {
  const b = new Ball({ ...g.P, knuckleF30: 0 });
  b.place(from[0], Math.max(b.r + 0.002, from[1]), from[2]);
  setKick(b, plan.dir[0], plan.dir[1], plan.speed, plan.elRad, plan.back || 0, plan.side || 0);
  let apex = b.p.y, dev = 0, t = 0, vy0 = b.v.y;
  const ux = plan.dir[0], uz = plan.dir[1];
  for (let i = 0; i < 4 / DT; i++) {
    b.step(DT, g.cage); t += DT;
    if (stopX == null && vy0 < -0.5 && b.v.y > vy0 + 0.5 && b.p.y < 0.3) break; // erster Aufsetzer
    vy0 = b.v.y;
    apex = Math.max(apex, b.p.y);
    const rx = b.p.x - from[0], rz = b.p.z - from[2];
    dev = Math.max(dev, Math.abs(-rx * uz + rz * ux));
    if (stopX != null ? b.p.x >= stopX : (t > 0.1 && b.p.y <= b.r + 0.01)) break;
  }
  return { t, apex, dev, land: [b.p.x, b.p.z] };
}

export function curveTable(qs = '') {
  const P = makeParams(qs), rows = [];
  for (const D of [8, 12, 16]) {
    for (const mode of ['std', 'var']) {
      const g = new Game(P, 3, { match: true, perTeam: [1, 0], human: 0, bots: false }); g.rules.phase = 'play';
      const pl = g.players[0], gx = g.cage.hx, x = gx - D, z = 1.2;
      const f = Math.atan2(-z, gx - x);
      pl.place(x - Math.cos(f) * 0.38, z - Math.sin(f) * 0.38, f); g.ball.place(x, 0.11, z);
      const plan = planShot(g, pl, { mode, power: null });
      const fl = fly(g, plan, [x, 0.11, z], gx);
      rows.push({ D, tech: plan.tech, speed: plan.speed, t: fl.t, apex: fl.apex, dev: fl.dev, spin: (plan.side || 0) / (2 * Math.PI) });
    }
  }
  return rows;
}
export function crossTable(qs = '') {
  const P = makeParams(qs), rows = [];
  for (const D of [6, 9, 12, 15]) {
    const g = new Game(P, 3, { match: true, perTeam: [2, 0], human: 0, bots: false }); g.rules.phase = 'play';
    const pl = g.players[0], m = g.players[1];
    const x0 = 9 - D * 0.8, z0 = 5.5 - D * 0.6; // Mitspieler im Torraum bei (9, 0) … Flanke von außen
    void z0;
    pl.place(9 - D * 0.6 - 0.4, D * 0.8, -Math.atan2(D * 0.8, D * 0.6 + 0.4) + 0.0); g.ball.place(9 - D * 0.6, 0.11, Math.min(D * 0.8, 6));
    const from = [g.ball.p.x, 0.11, g.ball.p.z];
    m.place(from[0] + D * 0.6, from[2] - D * 0.8, 0);
    const dx = m.x - from[0], dz = m.z - from[2];
    pl.face = Math.atan2(dz, dx); pl.place(from[0] - Math.cos(pl.face) * 0.38, from[2] - Math.sin(pl.face) * 0.38, pl.face);
    const plan = planPass(g, pl, { mode: 'var', power: null, stick: [dx, dz] });
    const fl = fly(g, { ...plan, speed: plan.u }, from);
    rows.push({ D: Math.hypot(dx, dz), el: plan.el, speed: plan.u, t: fl.t, apex: fl.apex, err: Math.hypot(fl.land[0] - m.x, fl.land[1] - m.z) });
    void x0;
  }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) { // Windows-tauglich (file:///C:/…)
  const qs = process.argv[2] || '';
  console.log(`Schuss (${qs || 'Standard'}): Entfernung | Technik | Abflug m/s | Flugzeit s | Scheitel m | Kurve m | Drall U/s`);
  for (const r of curveTable(qs)) console.log(`  ${r.D} m | ${r.tech} | ${r.speed.toFixed(1)} | ${r.t.toFixed(2)} | ${r.apex.toFixed(2)} | ${r.dev.toFixed(2)} | ${r.spin.toFixed(1)}`);
  console.log(`Pass hoch (${qs || 'Standard'}): Weite | Abflugwinkel ° | Abflug m/s | Flugzeit s | Scheitel m | Landung ↔ Mitspieler m`);
  for (const r of crossTable(qs)) console.log(`  ${r.D.toFixed(1)} m | ${r.el.toFixed(0)} | ${r.speed.toFixed(1)} | ${r.t.toFixed(2)} | ${r.apex.toFixed(2)} | ${r.err.toFixed(2)}`);
}
