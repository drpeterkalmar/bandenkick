// n13 (Peter 07.11.2026): Schusswinkel-Regel und Spektakel-Alternativen. Wörtlich: „Vollspann und Innenrist Außenrist können nur
// max 120 Grad vom Tor abgefeuert werden. Alles andere kann zum Beispiel eine ‚Megaferse' oder ein skripted lofted pass zu einem
// besser postierten Mitspieler sein der dann spektakulär abzieht.“ Dazu (Nachtrag 4): „wenn man verkehrt zum Tor steht und Schuss
// drückt … jongliertrick zum Ball vertikal hochbringen und danach Fallrückzieher (Rivaldo mäßig)“.
// Ohne DOM, geprüft in tests/node/n13.test.mjs.
//
// Auslegung: Winkel zwischen Lauf- (ab 1,5 m/s) bzw. Blickrichtung und der Richtung Ball → Tormitte. Liegt das Tor im Kegel ±schusskegel
// (60° = 120°-Kegel) vor dem Schützen, bleibt alles wie bisher (Vollspann/Innen-/Außenrist automatisch). Außerhalb wählt der eine Tipp:
//  - Lupfer-Pass zu einem besser postierten Mitspieler (frei vor dem Tor, sicherer hoher Passweg), der den Ball direkt aus der Luft nimmt;
//  - Rücken zum Tor (≥ 120°) und kein Gegner rechtzeitig da (gemessene Laufzeit gegen die Dauer des Tricks): Jonglier-Fallrückzieher
//    – Ball mit der Fußspitze senkrecht hochlupfen (Scheitel ≈ 2,3 m), dann Fallrückzieher über den Kopf aufs Tor;
//  - Rücken zum Tor, Gegner zu nah: Megaferse – übertriebener Fersenschuss rückwärts aufs Tor, viel härter als die Hacke;
//  - sonst (Tor seitlich, niemand besser postiert): blitzschnelle Drehung zum Tor, dann der normale Schuss.
// Unter ähnlich guten Lösungen die spektakulärste (Rang: Fallrückzieher > Megaferse > Lupfer-Direktabnahme).
import { planShot, attackGoalX } from './shot.js';
import { planPass } from './pass.js';
import { predictBall } from './kickplan.js';
import { airFrame } from './air.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;

// Winkel (°) zwischen Lauf-/Blickrichtung und Richtung Ball → Tormitte
export function kegelWinkel(game, pl) {
  const b = game.ball, gx = attackGoalX(game, pl);
  const lauf = pl.speed > 1.5;
  const ax = lauf ? pl.vx / pl.speed : Math.cos(pl.face), az = lauf ? pl.vz / pl.speed : Math.sin(pl.face);
  const tx = gx - b.p.x, tz = -b.p.z, tl = Math.hypot(tx, tz) || 1;
  return Math.acos(clamp((ax * tx + az * tz) / tl, -1, 1)) / DEG;
}

// Dauer des Jonglier-Fallrückziehers bis zum Treffpunkt (s): hoch bis apex, herunter bis zur Treffhöhe
export function fallrueckDauer(P, y0 = 0.11) {
  const ta = Math.sqrt(2 * (P.jonglApex - y0) / P.g), td = Math.sqrt(2 * (P.jonglApex - P.jonglTreff) / P.g);
  return ta + td;
}

// Kommt ein Gegner vor dem Treffpunkt (in T s) an den Schützen heran (≤ 0,9 m)? Gemessen mit seiner echten Antrittskurve (Player.travel,
// Tempo zum Schützen hin), 0,25 s Reaktion. Der Tormann im eigenen Torraum zählt nicht (er bleibt im Tor und wartet auf den Schuss).
export function gegnerRechtzeitig(game, pl, T) {
  const R = game.rules;
  for (const o of game.players) {
    if (o.team === pl.team || o.fall || o.hand.mode === 'ground') continue;
    if (R && R.keeper[o.team] === o.id && R.inBox(o.team, o.x, o.z)) continue;
    const dx = pl.x - o.x, dz = pl.z - o.z, d = Math.hypot(dx, dz);
    const vh = d > 0.01 ? (o.vx * dx + o.vz * dz) / d : 0;
    if (d - 0.9 <= o.travel(vh, game.P.vTop, Math.max(0, T - 0.25))) return true;
  }
  return false;
}

// Besser postierter Mitspieler für den Lupfer: nah vor dem Tor, frei, Schussweg offen, sicherer hoher Passweg → {to, wert} | null
export function lupferZiel(game, pl) {
  const P = game.P, R = game.rules, gx = attackGoalX(game, pl);
  let best = null;
  for (const m of game.players) {
    if (m.team !== pl.team || m.id === pl.id || (R && R.keeper[pl.team] === m.id) || m.fall || m.hand.mode !== 'none') continue;
    const D = Math.hypot(gx - m.x, m.z);
    if (D > P.lupferD) continue;
    let frei = 9;
    for (const o of game.players) if (o.team !== pl.team && (!R || R.keeper[o.team] !== o.id)) frei = Math.min(frei, Math.hypot(o.x - m.x, o.z - m.z));
    if (frei < P.lupferFrei) continue;
    const wert = clamp(1 - D / (P.lupferD + 4), 0, 1) * clamp(frei / 4, 0.4, 1);
    if (!best || wert > best.wert) best = { to: m.id, wert };
  }
  if (!best) return null;
  const plan = planPass(game, pl, { to: best.to });
  if (!plan || plan.to !== best.to || plan.unsicher || (plan.hoch && (plan.slack ?? -1) < P.hochSicher)) return null;
  return { ...best, plan };
}

// Entscheidung beim Schuss-Tipp: null = im Kegel (normaler Schuss), sonst { art: 'lupfer' | 'fallrueck' | 'megaferse' | 'drehen', … }
export function schussWahl(game, pl) {
  const P = game.P;
  if (!(P.schusskegel > 0) || !game.match || game.challenge) return null;
  const ang = kegelWinkel(game, pl);
  if (ang <= P.schusskegel) return null;
  const b = game.ball, gx = attackGoalX(game, pl), D = Math.hypot(gx - b.p.x, b.p.z);
  const opts = [];
  const lu = lupferZiel(game, pl);
  if (lu) opts.push({ art: 'lupfer', chance: 0.25 + 0.35 * lu.wert, rang: 4, to: lu.to, plan: lu.plan });
  const hinten = ang >= 180 - P.schusskegel;
  const bot = game.human !== pl.id;
  if (hinten && P.fallrueck && D <= P.fallrueckD && (!bot || game.rng.next() < P.fallrueckBot)) {
    const frei = !gegnerRechtzeitig(game, pl, fallrueckDauer(P, b.p.y));
    if (frei && b.p.y < 0.5) opts.push({ art: 'fallrueck', chance: 0.3, rang: 6 });
  }
  if (hinten && D <= P.megaferseD) opts.push({ art: 'megaferse', chance: clamp(0.32 - D * 0.012, 0.08, 0.3), rang: 5 });
  if (!opts.length) return { art: 'drehen', ang };
  let best = opts[0];
  for (const o of opts) if (o.chance > best.chance) best = o;
  const lim = (1 - (P.spektakel || 0)) * best.chance;
  for (const o of opts) if (o.chance >= lim && o.rang > best.rang) best = o;
  return { ...best, ang };
}

// Megaferse: Fersenschuss rückwärts aufs Tor, Tempo megaferseV (statt ≤ 19 m/s der Hacke), etwas mehr Streuung
export function planMegaferse(game, pl) {
  const P = game.P;
  const plan = planShot(game, pl, { tech: 'ferse', speed: P.megaferseV, noiseBase: 2.6, qMul: 0.85 });
  plan.tech = 'megaferse';
  return plan;
}

// Jonglier-Fallrückzieher, Schritt 1: Ball senkrecht hochlupfen (Scheitel jonglApex), Treffpunkt jonglTreff über dem Schützen,
// leicht zur Torseite (damit der Rücken-Fallrückzieher ihn über den Kopf aufs Tor schlägt). Setzt den Luftball-Plan pl.air (stepAir
// führt Absprung, Schere und Treffpunkt aus, airKick schießt aufs Tor). Gibt true zurück.
export function jongliere(game, pl) {
  const P = game.P, b = game.ball, gx = attackGoalX(game, pl);
  const tx = gx - pl.x, tz = -pl.z, tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl; // Richtung Tor
  // Treffpunkt: 0,25 m vom Körper Richtung Tor (über dem Kopf, leicht dahinter), Höhe jonglTreff
  const C = [pl.x + ux * 0.25, P.jonglTreff, pl.z + uz * 0.25];
  const y0 = Math.max(b.r, b.p.y), vy = Math.sqrt(2 * P.g * (P.jonglApex - y0));
  const T = fallrueckDauer(P, y0);
  b.v.set((C[0] - b.p.x) / T, vy, (C[2] - b.p.z) / T); b.w.set(0, 0, 0); b.contact = false;
  if (b.p.y < b.r + 0.02) b.p.y = b.r + 0.02;
  b.reseedKnuckle(game.rng);
  // genaue Bahn (Luftwiderstand) → Treffpunkt, wenn er absteigend die Treffhöhe kreuzt
  const pr = predictBall(P, game.cage, b, T + 0.4, 1, []);
  let s = pr.find((q) => q.t > 0.2 && q.vy < 0 && q.y <= P.jonglTreff) || pr[pr.length - 1];
  const sx = -ux, sz = -uz; // Fallrückzieher: Blick vom Tor weg, Rücken zum Tor
  const fr = airFrame('fallrueck', sx, sz, ux, uz, 0.18);
  pl.air = {
    tech: 'fallrueck', jongl: true, rivaldo: game.rng.next() < P.rivaldo, total: 1, score: 1, tq: 1, t: s.t, tc: game.t + s.t,
    bx: s.x + fr.ox, bz: s.z + fr.oz, cx: s.x, cy: s.y, cz: s.z, sx, sz, fx: fr.fx, fz: fr.fz, foot: 0, theta: 180, h: s.y, bounced: false,
    lead: s.t, vin: Math.hypot(s.vx, s.vy, s.vz), purpose: 'shot', goalX: gx, takeoff: 0.3, aim: null, from: pl.id,
  };
  pl.pending = null; pl.charging = false;
  pl.touchCd = 0.35; pl.lastTouchT = game.t; pl.kickT = 0; pl.touchT = 0; pl.selfKick = true;
  pl.tech = 'jongl'; pl.techT = 0;
  pl.lastKick = { kind: 'shot', tech: 'jongl', mode: 'air', speed: vy, q: null, t: game.t, spinRps: 0, sideRps: 0, elevDeg: 90 };
  if (game.match) { game.passTo = -1; game.rules.touch(pl); }
  game.passPlan = null;
  game.events.push({ type: 'jongl', player: pl.id, x: b.p.x, y: b.p.y, z: b.p.z, T: s.t, human: game.human === pl.id });
  game.events.push({ type: 'touch', player: pl.id, rel: 0, x: b.p.x, y: b.p.y, z: b.p.z });
  return true;
}

// Lupfer-Pass gespielt: der Empfänger nimmt den Ball direkt aus der Luft (Player.direktAuf), Direktabnahme mit Traumpass-Bonus
export function lupferGespielt(game, pl, plan) {
  const to = game.players[plan.to];
  if (!to) return;
  to.direktAuf = { from: pl.id, until: game.t + (plan.T || 1.2) + 0.6 };
  game.perfekt = { from: pl.id, to: to.id, t: game.t, T: (plan.T || 1) + 1.0, x: plan.meet ? plan.meet[0] : to.x, z: plan.meet ? plan.meet[1] : to.z, w: 1, used: false, lupfer: true };
  game.events.push({ type: 'lupfer', player: pl.id, to: to.id, human: game.human === pl.id || game.human === to.id });
}
