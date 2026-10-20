// n7 Vorlagen E3 #6 (Vorlage B, angepasst): Traumpass → Direktabnahme. Beim Pass zu einem Mitspieler wertet das Spiel den
// Treffpunkt (Pass in den Laufweg) bzw. die Lage des Empfängers: höchstens perfektD m vor der Tormitte, Pass ≥ perfektMin m,
// kein Gegner ≤ perfektFrei m am Treffpunkt und ≤ perfektPass m am Passweg (auch nicht der Tormann), Schussweg zum Tor frei (Feldspieler des Gegners, der Tormann zählt nicht). Wertung =
// 0,67 · „Schussweg frei“ + 0,33 · „Empfänger frei“; ab perfektSchwelle ist es ein Traumpass: Ereignis `perfektpass`
// (goldener Ring unter dem Empfänger, goldene Ballspur). Schießt der Empfänger direkt (ohne vorher den Ball anzunehmen),
// steigt die Schuss-Qualität um perfektQ (höchstens 1) und die Wucht um × perfektWucht. Keine eigene Zeitlupe – die
// Action-Momente (n6) entscheiden selbst über das Schuss-Ereignis.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Abstand des Punkts (px, pz) zur Strecke (ax, az) → (bx, bz)
function segDist(px, pz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
  const t = clamp(((px - ax) * ex + (pz - az) * ez) / L2, 0, 1);
  return Math.hypot(px - ax - ex * t, pz - az - ez * t);
}

// Wertung eines Passes von `from` (Ballposition bx, bz) zu `to` mit Treffpunkt (mx, mz) → { w, ok, D, frei, weg }
export function perfektWertung(game, from, to, bx, bz, mx, mz) {
  const P = game.P, R = game.rules;
  if (!game.match || !R || !to || to.team !== from.team || to.id === from.id) return { w: 0, ok: false };
  const gx = to.team === 0 ? game.cage.hx : -game.cage.hx;
  const D = Math.hypot(gx - mx, mz), len = Math.hypot(mx - bx, mz - bz);
  let frei = 9, weg = 9, pass = 9;
  const kp = R.keeper[1 - to.team];
  for (const o of game.players) {
    if (o.team === to.team) continue;
    frei = Math.min(frei, Math.hypot(o.x - mx, o.z - mz));
    pass = Math.min(pass, segDist(o.x, o.z, bx, bz, mx, mz)); // Passweg (auch der Tormann darf nicht dazwischen)
    if (o.id !== kp) weg = Math.min(weg, segDist(o.x, o.z, mx, mz, gx, clamp(mz, -game.cage.gw * 0.6, game.cage.gw * 0.6)));
  }
  const w = 0.67 * clamp(weg / P.perfektWeg, 0, 1) + 0.33 * clamp(frei / (2 * P.perfektFrei), 0, 1);
  const ok = D <= P.perfektD && len >= P.perfektMin && frei > P.perfektFrei && pass > P.perfektPass && w >= P.perfektSchwelle;
  return { w, ok, D, frei, weg, len, pass };
}

// Nach einem Pass (Player.applyPlan): Traumpass? → game.perfekt + Ereignis
export function perfektPass(game, pl, plan, bx, bz) {
  const P = game.P;
  game.perfekt = null;
  if (!P.perfekt || plan.kind !== 'pass' || !(plan.to >= 0)) return;
  const to = game.players[plan.to];
  if (!to) return;
  const m = plan.meet || [to.x, to.z];
  const r = perfektWertung(game, pl, to, bx, bz, m[0], m[1]);
  if (!r.ok) return;
  game.perfekt = { from: pl.id, to: to.id, t: game.t, T: (plan.T || 1) + 1.0, x: m[0], z: m[1], w: r.w, used: false };
  game.events.push({ type: 'perfektpass', player: pl.id, team: pl.team, to: to.id, x: m[0], z: m[1], w: r.w, human: game.human === pl.id || game.human === to.id });
}

// Läuft der Traumpass noch (Ball unterwegs zum Empfänger, noch nicht angenommen)?
export function perfektAktiv(game) {
  const pf = game.perfekt;
  if (!pf || pf.used) return false;
  if (game.t > pf.t + pf.T || game.lastTouch !== pf.from || game.ball.held >= 0) { game.perfekt = null; return false; }
  return true;
}

// Direktabnahme des Empfängers? → Bonus { dq, wucht } (und der Traumpass ist verbraucht), sonst null
export function perfektAbnahme(game, pl) {
  if (!perfektAktiv(game) || game.perfekt.to !== pl.id) return null;
  game.perfekt.used = true;
  return { dq: game.P.perfektQ, wucht: game.P.perfektWucht };
}
