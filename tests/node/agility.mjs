// Agilitäts-Messung (gleiches Verfahren wie Peters Probe ~/.hermes/claude-jobs/briefs/bandenkick-n2/agility_probe.mjs):
// Spieler läuft mit v0 geradeaus, der Stick springt auf eine neue Richtung (Winkel), gemessen wird
// – „Richtung erreicht“: Laufrichtung weicht < 10° von der neuen Richtung ab,
// – 80 % Tempo in neuer Richtung, Tiefpunkt des Tempos,
// – Überschießen: größter Weg in der alten Richtung, bevor die Richtung erreicht ist.
// Feld 60 × 40 m (Bande weit weg). Optional mit Ball am Fuß (Ballführung).
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';

const inp = (o = {}) => ({ mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, shootRelease: false, cx: 0, cy: 0, ...o });

export function cut(P, v0, sprint, angDeg, { withBall = false, seed = 1 } = {}) {
  const g = new Game(P, seed); const pl = g.players[0];
  for (let i = 1; i < g.players.length; i++) g.players[i].place(-25 + 3 * i, 18, 0); // Mitspieler weit weg
  pl.place(0, 0, 0); pl.speed = v0; pl.vx = v0;
  if (withBall) {
    // Ball knapp vor dem Fuß, rollt mit (wie beim Führen)
    g.ball.place(P.footAhead + 0.25, P.ballR, 0); g.ball.v.set(v0 * 1.05, 0, 0); g.ball.w.set(0, 0, -v0 * 1.05 / P.ballR);
    pl.lastTouchT = 0; pl.dribbling = true;
  } else g.ball.place(25, P.ballR, 18);
  const a = angDeg * Math.PI / 180, tx = Math.cos(a), tz = Math.sin(a);
  let tHead = -1, tVel = -1, minV = v0, drift = 0, ballD = 0, touches = 0, ballClosest = 99;
  const x0 = pl.x;
  for (let i = 0; i < 4 / DT; i++) {
    const ev = g.step([inp({ mx: tx, mz: tz, sprint })]);
    touches += ev.filter((e) => e.type === 'touch' && e.player === 0).length;
    if (withBall && g.t > 0.8 && g.t <= 1.6) ballClosest = Math.min(ballClosest, Math.hypot(g.ball.p.x - pl.x, g.ball.p.z - pl.z));
    const hd = Math.acos(Math.max(-1, Math.min(1, pl.hx * tx + pl.hz * tz))) * 180 / Math.PI;
    if (tHead < 0 && hd < 10) tHead = g.t;
    const vAlong = pl.vx * tx + pl.vz * tz;
    if (tHead >= 0 && tVel < 0 && vAlong >= 0.8 * v0) tVel = g.t;
    minV = Math.min(minV, pl.speed);
    if (tHead < 0) drift = Math.max(drift, pl.x - x0);
    if (tVel >= 0 && (!withBall || g.t >= 1.6 - 1e-9)) break;
    if (withBall && g.t >= 1.6 - 1e-9) break;
  }
  let ballAhead = 0, ballSide = 0;
  if (withBall) {
    // Ball danach bei ihm? Lage des Balls zur neuen Richtung (vorn/seitlich), Abstand
    const bx = g.ball.p.x - pl.x, bz = g.ball.p.z - pl.z;
    ballD = Math.hypot(bx, bz); ballAhead = bx * tx + bz * tz; ballSide = Math.abs(-bx * tz + bz * tx);
  }
  return { tHead, tVel, minV, drift, ballD, ballAhead, ballSide, ballClosest, touches };
}

// Zieltabelle aus dem Nachtrag (Peter, 28.09.): Zeit bis „Richtung erreicht“ und Überschießen
export const TARGETS = [
  { lbl: 'Laufen', v0: 5.2, sprint: false, ang: 90, t: 0.35, drift: 1.0 },
  { lbl: 'Laufen', v0: 5.2, sprint: false, ang: 180, t: 0.6, drift: 1.0 },
  { lbl: 'Sprint', v0: 7.5, sprint: true, ang: 90, t: 0.5, drift: 1.8 },
  { lbl: 'Sprint', v0: 7.5, sprint: true, ang: 180, t: 0.8, drift: 1.8 },
];

export function table(P) {
  const rows = [];
  for (const [lbl, v0, sprint] of [['Laufen', 5.2, false], ['Sprint', 7.5, true]]) {
    for (const ang of [45, 90, 135, 180]) rows.push({ lbl, v0, ang, ...cut(P, v0, sprint, ang) });
  }
  return rows;
}

// Direkt aufrufbar: node tests/node/agility.mjs [querystring]
if (import.meta.url === `file://${process.argv[1]}`) {
  const qs = 'feld=60x40' + (process.argv[2] ? '&' + process.argv[2] : '');
  const P = makeParams(qs);
  const f = (x) => (x < 0 ? '—' : x.toFixed(2));
  console.log('Parameter:', qs, `zack=${P.zack} aLat=${P.aLat} aPlant=${P.aPlant} aBrake=${P.aBrake} kurve=${P.curveDeg}–${P.plantDeg}°`);
  for (const r of table(P)) console.log(`${r.lbl} ${r.v0} m/s, ${r.ang}°: Richtung nach ${f(r.tHead)} s, 80 % Tempo nach ${f(r.tVel)} s, Tiefpunkt ${r.minV.toFixed(1)} m/s, Überschießen ${r.drift.toFixed(2)} m`);
}
