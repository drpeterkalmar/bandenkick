// Technik-Wahl-Tabellen (src/sim/technique.js) inkl. Grenzfälle, dazu die Wahl im echten Spiel (Pass-/Schuss-Planer):
// Pass Innenseite/Außenrist/Hacke, Schuss Innen-/Außenrist je Lage links/rechts vom Tor und Bein, Luftball
// Volley/Dropkick/Seitfallzieher/Fallrückzieher/Kopfball je Höhe und Lage. Aufruf: node tests/node/technique.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { passTechnique, shotTechnique, airTechnique, airScores } from '../../src/sim/technique.js';
import { planPass } from '../../src/sim/pass.js';
import { planShot } from '../../src/sim/shot.js';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const is = (name, got, want, note = '') => check(name, got === want ? 1 : 0, 1, 1, '', 1, `${got}${note ? ' · ' + note : ''}`);
const P = makeParams({});

// ---------------- Pass: Winkel Blickrichtung ↔ Passrichtung, Ball am Standbein ----------------
is('Pass 0° (vor dem Körper) → Innenseite/Vorfuß', passTechnique(0, 0.4, P), 'innen');
is('Pass 59,9° → Innenseite (Grenze 60°)', passTechnique(59.9, 0.4, P), 'innen');
is('Pass 60,1° → Außenrist', passTechnique(60.1, 0.4, P), 'aussen');
is('Pass 119,9° → Außenrist (Grenze 120°)', passTechnique(119.9, 0.4, P), 'aussen');
is('Pass 150°, Ball am Standbein (0,4 m) → Hacke', passTechnique(150, 0.4, P), 'ferse');
is('Pass 120,1°, Ball 0,59 m → Hacke (Grenze 0,6 m)', passTechnique(120.1, 0.59, P), 'ferse');
is('Pass 150°, Ball weiter weg (0,8 m) → Außenrist mit Drehung', passTechnique(150, 0.8, P), 'aussen');
is('Regler ?innen=45: 50° → Außenrist', passTechnique(50, 0.4, makeParams('?innen=45')), 'aussen');
is('Regler ?hacke=150: 140° → Außenrist', passTechnique(140, 0.4, makeParams('?hacke=150')), 'aussen');

// Pass im Spiel: Blickrichtung +x, Mitspieler vorn / seitlich / hinten
{
  const mk = (mx, mz, face = 0) => {
    const g = new Game(P, 3, { match: true, perTeam: [2, 0], human: 0, bots: false });
    const [a, m] = g.players; a.place(0, 0, face); g.ball.place(Math.cos(face) * 0.35, 0.11, Math.sin(face) * 0.35); m.place(mx, mz, 0);
    return planPass(g, a, { stick: [mx, mz] });
  };
  const f = mk(8, 1), s = mk(1.5, 7), b = mk(-6, 0.5);
  is('Pass im Spiel: Mitspieler vorn → Innenseite', f.tech, 'innen', `${f.ang.toFixed(0)}°, ${f.u.toFixed(1)} m/s`);
  is('Pass im Spiel: Mitspieler seitlich (78°) → Außenrist', s.tech, 'aussen', `${s.ang.toFixed(0)}°`);
  is('Pass im Spiel: Mitspieler hinten, Ball am Fuß → Hacke', b.tech, 'ferse', `${b.ang.toFixed(0)}°`);
  check('Hackenpass: kürzer (Tempo ≤ 8,5 m/s)', b.u, 0, 8.5, 'm/s', 8.5, 'Mitspieler 6 m hinter dem Spieler');
  const g = new Game(P, 3, { match: true, perTeam: [2, 0], human: 0, bots: false });
  const [a, m] = g.players; a.place(0, 0, 0); g.ball.place(0.35, 0.11, 0); m.place(9, 0, 0);
  const c = planPass(g, a, { mode: 'var', stick: [1, 0] });
  // Nacht 2c: feste Flanke – auf 9 m flach (14–28°, ?flanke=0: 25–45°)
  check('Pass hoch 9 m (feste Flanke): Abflugwinkel 14–28°', c.el, 14, 28, '°', null, `${c.u.toFixed(1)} m/s, Scheitel ${c.apex.toFixed(2)} m`);
  check('Chip: Scheitel unter dem Dachnetz (−0,5 m)', c.apex, 0, P.roofH - 0.5, 'm', null);
  const cs = planPass(g, a, { mode: 'var', stick: [1, 0], to: 1 });
  m.place(4.5, 0, 0);
  const cn = planPass(g, a, { mode: 'var', stick: [1, 0] });
  check('Chip kurz (4,5 m) steiler als weit (9 m)', cn.el - cs.el, 1, 30, '°', null, `${cn.el.toFixed(0)}° / ${cs.el.toFixed(0)}°`);
}

// ---------------- Schuss: Vollspann / Innenrist / Außenrist ----------------
is('Schuss Standard → Vollspann', shotTechnique('std', true, 0, 1).tech, 'vollspann');
is('Angeschnitten, Kurve links, Rechtsfuß, Ball mittig → Innenrist rechts', JSON.stringify(shotTechnique('var', true, 0, 1)), JSON.stringify({ tech: 'innenrist', foot: 1 }));
is('Angeschnitten, Kurve rechts, Ball rechts (0,1 m) → Außenrist rechts (Innenrist-Bein links steht unpassend)', JSON.stringify(shotTechnique('var', false, 0.1, 1)), JSON.stringify({ tech: 'aussenrist', foot: 1 }));
is('Angeschnitten, Kurve rechts, Ball links (−0,1 m) → Innenrist links', JSON.stringify(shotTechnique('var', false, -0.1, 1)), JSON.stringify({ tech: 'innenrist', foot: -1 }));
is('Linksfuß, Kurve rechts, Ball mittig → Innenrist links', JSON.stringify(shotTechnique('var', false, 0, -1)), JSON.stringify({ tech: 'innenrist', foot: -1 }));
is('Linksfuß, Kurve links, Ball links → Außenrist links', JSON.stringify(shotTechnique('var', true, -0.1, -1)), JSON.stringify({ tech: 'aussenrist', foot: -1 }));

// Schuss im Spiel (Mannschaft 0 spielt nach rechts, Tor bei x = +10): Lage links/rechts vom Tor
{
  const shot = (z, strong, side = 0, face = null) => {
    const g = new Game(P, 5, { match: true, perTeam: [1, 0], human: 0, bots: false });
    const pl = g.players[0]; pl.strong = strong;
    const f = face ?? Math.atan2(-z, 10 - 4);
    pl.place(4, z, f);
    g.ball.place(4 + Math.cos(f) * 0.35 - Math.sin(f) * side, 0.11, z + Math.sin(f) * 0.35 + Math.cos(f) * side);
    return planShot(g, pl, { mode: 'var', power: 0.7 });
  };
  const L = shot(-3.5, 1), R = shot(3.5, 1), Rb = shot(3.5, 1, 0.12), Ll = shot(-3.5, -1, -0.12);
  const lr = (p) => `${p.tech} ${p.foot > 0 ? 'rechts' : 'links'}, Ecke z = ${p.corner.z.toFixed(1)}, Drall ${(p.side / 6.283).toFixed(1)} U/s`;
  is('Links vom Tor, Rechtsfuß: langes Eck mit Innenrist rechts (Kurve nach innen)', `${L.tech}/${L.foot}/${Math.sign(L.corner.z)}/${Math.sign(L.side)}`, 'innenrist/1/1/1', lr(L));
  is('Rechts vom Tor, Rechtsfuß, Ball mittig: langes Eck, Kurve nach rechts → Innenrist links', `${R.tech}/${R.foot}/${Math.sign(R.corner.z)}/${Math.sign(R.side)}`, 'innenrist/-1/-1/-1', lr(R));
  is('Rechts vom Tor, Rechtsfuß, Ball rechts: Außenrist rechts', `${Rb.tech}/${Rb.foot}/${Math.sign(Rb.side)}`, 'aussenrist/1/-1', lr(Rb));
  is('Links vom Tor, Linksfuß, Ball links: Außenrist links', `${Ll.tech}/${Ll.foot}/${Math.sign(Ll.side)}`, 'aussenrist/-1/1', lr(Ll));
}

// ---------------- Luftbälle: Höhe am Treffpunkt × Lage (θ = woher der Ball kommt ↔ wo das Tor ist) ----------------
const air = (h, th, b = false) => { const r = airTechnique(h, th, b); return r && r.score >= 0.25 ? r.tech : 'keine'; };
const airCases = [
  [0.6, 60, false, 'volley', 'Hüfthöhe, Flanke schräg'],
  [0.45, 0, false, 'volley', 'Abpraller aus Torrichtung'],
  [0.9, 90, false, 'volley', 'Flanke von der Seite, 0,9 m'],
  [1.04, 30, false, 'volley', 'Grenze 1,05 m, Tor vorn'],
  [0.3, 60, true, 'dropkick', 'Aufsetzer'],
  [0.3, 60, false, 'keine', 'ohne Aufsetzer zu tief (Fuß am Boden)'],
  [1.2, 90, false, 'seitfall', 'Flanke von der Seite, Brusthöhe'],
  [1.4, 110, false, 'seitfall', 'seitlich-hinten'],
  [1.3, 170, false, 'fallrueck', 'Rücken zum Tor'],
  [1.7, 150, false, 'fallrueck', 'hoch, Rücken zum Tor'],
  [1.12, 180, false, 'fallrueck', 'Grenze unten'],
  [1.7, 60, false, 'kopf', 'Kopfhöhe, Tor vorn'],
  [2.3, 90, false, 'kopf', 'Sprunghöhe, Flanke'],
  [2.6, 60, false, 'keine', 'zu hoch (über 2,55 m)'],
  [0.7, 180, false, 'keine', 'Hüfthöhe, Rücken zum Tor'],
  [1.5, 40, false, 'kopf', 'Überschneidung Kopf/Volley-Ende'],
  [0.75, 125, false, 'flugkopf', 'halbhoch, Ball kommt schräg von hinten'],
];
for (const [h, th, b, want, note] of airCases) is(`Luftball ${String(h).replace('.', ',')} m, θ ${th}°${b ? ', Aufsetzer' : ''} → ${want}`, air(h, th, b), want, note);
// Überschneidende Fenster: Punktwert entscheidet (keine if-Kette) – bei 0,9 m seitlich Volley, bei 1,0 m Seitfall
{
  const s09 = airScores(0.9, 90), s10 = airScores(1.0, 90);
  check('Überschneidung 0,9 m seitlich: Volley > Seitfallzieher', s09.volley - s09.seitfall, 0.001, 9, '', null, `Volley ${s09.volley.toFixed(2)}, Seitfall ${s09.seitfall.toFixed(2)}, Flugkopf ${s09.flugkopf.toFixed(2)}`);
  check('Überschneidung 1,0 m seitlich: Seitfallzieher > Volley', s10.seitfall - s10.volley, 0.001, 9, '', null, `Volley ${s10.volley.toFixed(2)}, Seitfall ${s10.seitfall.toFixed(2)}`);
  const s12 = airScores(1.2, 150);
  check('Überschneidung 1,2 m, θ 150°: Fallrückzieher > Seitfallzieher', s12.fallrueck - s12.seitfall, 0.001, 9, '', null, `Fallrück ${s12.fallrueck.toFixed(2)}, Seitfall ${s12.seitfall.toFixed(2)}`);
  is('Regler ?luft=1,2 (alle Fenster höher): 1,0 m seitlich → Volley', airTechnique(1.0, 90, false, 1.2).tech, 'volley');
}

process.exit(report('Technik-Wahl (Pass, Schuss, Luftball)', rows) ? 0 : 1);
