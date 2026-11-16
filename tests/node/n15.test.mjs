// n15 (Peter 14.–16.11.2026): ein Kick-Knopf, der immer auslöst, kein Torschuss aus der eigenen Hälfte, Megaferse ohne Einblendung + Schuss-
// Zeitlupe, Skill-Moves, Akrobatik-/Kampfsport-Kontakte, Einfach-Modus, Effet/Flanken, Anspielstation, Ballführung, kluge Grätsche –
// Regler (N15_AUS = 6416fb8) und Wirkung im Kleinen. Die großen Messungen: n15_*_probe.mjs (siehe N15_BERICHT.md). Aufruf: node tests/node/n15.test.mjs
import { makeParams, N15_AUS } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { AKRO2, AIR_TECH, AIR_PROPS, TECH_NAMES } from '../../src/sim/technique.js';
import { einKnopfArt } from '../../src/sim/akro.js';
import { SKILL_KEYS, skillCheck } from '../../src/sim/skills.js';
import { physik } from './n11_probe.mjs';
import { spam } from './n15_kick_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { rows.push({ name, value, lo, hi, unit, target, ok: value >= lo && value <= hi, note }); };
const yes = (name, c, note = '') => check(name, c ? 1 : 0, 1, 1, '', 1, note);
const P = makeParams(''), P0 = makeParams(N15_AUS);

// Regler
yes('Standard: kickimmer 1, graetschKlug 1, eigenhaelfte 1, megafersecut 0, schusscam 1, skills 1, akro2 1, easy 0, effet2 1, flankehoch 1,5, anspiel 1, ballfuehrung 1',
  P.kickimmer === 1 && P.graetschKlug === 1 && P.eigenhaelfte === 1 && P.megafersecut === 0 && P.schusscam === 1 && P.skills === 1 && P.akro2 === 1 && P.easy === 0 && P.effet2 === 1 && P.flankehoch === 1.5 && P.anspiel === 1 && P.ballfuehrung === 1);
yes('N15_AUS = 6416fb8 (alle n15-Regler aus, Ballführung/Effet zurück)', P0.kickimmer === 0 && P0.graetschKlug === 0 && P0.eigenhaelfte === 0 && P0.megafersecut === 1 && P0.schusscam === 0 && P0.skills === 0 && P0.akro2 === 0 && P0.anspiel === 0 && P0.ballfuehrung === 0 && P0.reach === 0.48 && P0.clSteig === 1.7 && P0.flankehoch === 1);
yes('Peters Standardwerte bleiben: magnet 3, luft 1,1', P.magnet === 3 && P.luft === 1.1);

// E1: Knopf-Spam (Kurzfassung, 120 Drücke)
{
  const a = spam('', 120), b = spam('kickimmer=0', 120);
  // (Ziel im Brief 97 %; mit Nachtrag 5 – keine Auto-Grätschen mehr – gemessen 78–81 % auf 600 Drücke, siehe N15_BERICHT.md)
  check('E1: Kick-Druck → Ballaktion binnen 1,5 s (120 Drücke, Rest begründet)', 100 * a.ok / a.presses, 72, 100, '%', 90, `?kickimmer=0: ${(100 * b.ok / b.presses).toFixed(0)} %`);
}
// E2: eigene Hälfte → nie Schuss
{
  const g = new Game(P, 3, { match: true, human: 0, perTeam: [1, 1], bots: false }); g.rules.phase = 'play';
  const [h, o] = g.players; h.place(-6, 0, 0); o.place(8, 6, Math.PI); g.ball.place(-5.6, 0.11, 0); g.lastTouch = h.id;
  yes('E2: Ball in der eigenen Hälfte, kein Mitspieler → kein Schuss (Befreiung)', einKnopfArt(g, h, [1, 0]) === 'shot' && (() => { h.kick({ kind: 'shot', mode: 'auto', power: null, stick: [1, 0], dir: [1, 0], age: 0, tap: true, btn: 'shot' }, g, 0); return g.events.some((e) => e.type === 'befreiung'); })());
}
// E4: Skill-Moves
yes('E4: zehn Skill-Moves', SKILL_KEYS.length === 10);
{
  let n = 0;
  for (let s = 0; s < 40; s++) {
    const g = new Game(P, 'sk' + s, { match: true, human: 0, perTeam: [1, 1], bots: false }); g.rules.phase = 'play';
    const [h, o] = g.players; h.place(0, 0, 0); h.vx = 3; o.place(1.2, 0.1, Math.PI); o.vx = -2; g.ball.place(0.4, 0.11, 0); g.lastTouch = h.id; h.lastTouchT = 0;
    if (skillCheck(g, h)) n++;
  }
  check('E4: frontal angegriffen → Skill-Move versucht (Chance skillChance 0,7)', n / 40, 0.45, 0.95, '', 0.7);
}
// E5: 22 neue Kontakte
yes('E5: ≥ 20 neue Kontakte mit Fenster, Tempo und Namen', Object.keys(AKRO2).length >= 20 && Object.keys(AKRO2).every((k) => AIR_TECH[k] && AIR_PROPS[k] && TECH_NAMES[k]), Object.keys(AKRO2).length + ' Techniken');
yes('E5: kein Kontakt mit Hand/Arm', Object.values(AKRO2).every((t) => !/hand|arm/i.test(t.teil)));
// E7: Effet
{ const a = physik('effet2=0'), b = physik(''); check('E7: Kurve Innenseit-Schuss über 20 m', b.kurve20, 12, 13.5, 'm', 12.5, `n14 ${a.kurve20.toFixed(1)} m (+${(100 * (b.kurve20 / a.kurve20 - 1)).toFixed(0)} %)`); }
// E9: Anspielstation
{
  const g = new Game(P, 9, { match: true, human: -1 }); g.rules.phase = 'play';
  const kp = g.players[g.rules.keeper[0]]; g.ball.held = kp.id; kp.hand.mode = 'hold'; g.lastTouchT = 1;
  const A = g.bots.anspielPlan(0);
  yes('E9: Tormann hält → ein Vorstürmer mit Ziel ab der Mittellinie', A && A.runner >= 0 && A.x > 0, A ? `Ziel ${A.x.toFixed(1)} / ${A.z.toFixed(1)}` : '');
}
// E10: Ballführung
yes('E10: Reichweite 0,72 m, reachH 0,6 m, Magnet lässt bei Wende weniger los', P.reach === 0.72 && P.reachH === 0.6 && P.magnetTurnMin === 0.75);

process.exit(report('n15 Kick-Knopf, Skills, Akrobatik', rows, 'n15') ? 0 : 1);
