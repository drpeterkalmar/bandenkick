// n8 Etappe 2 (Peter 26.10.: „Pässe gehen irgendwohin“): Stick bildschirmtreu, Reaktionszeit (Gegner treten einen eben gespielten
// Ball nicht im selben Takt weg), Bots lesen Pässe mit Reaktionszeit, Empfänger-Treue (Steuerung springt nach dem Pass nicht zum
// Passgeber zurück), Richtungstreue (Rückpass-/Banden-Umweg ohne Mitspieler höchstens passTreue° neben dem Stick). Gemessen gegen
// den Stand n8 Etappe 1 (alle Regler aus). Aufruf: node tests/node/n8_paesse.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planPass } from '../../src/sim/pass.js';
import { messen } from './stickbild.mjs';
import { spielPaesse, auswerten } from './passspiel_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const f = (v) => v.toFixed(1).replace('.', ',');
const E1 = 'stickBild=0&empfTreue=0&reaktion=0&passLesen=0&passTreue=0';
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });

// 1) Stick im Bild ↔ auf dem Feld (echte Spielkamera hoch/quer): bildschirmtreu = kein Fehler, Bodenachsen (alt) quer bis > 15°
for (const form of ['hoch', 'quer']) {
  const r = messen(form, 300);
  check(`Stick bildschirmtreu (${form}): Fehler zur Richtung im Bild p90`, r.neu.p90, 0, 0.5, '°', 0, `alt (Bodenachsen): p50 ${f(r.alt.p50)}°, p90 ${f(r.alt.p90)}°, max ${f(r.alt.max)}°, > 15° in ${f(r.alt.ueber15)} % der Fälle`);
}
// 2) Reaktionszeit: Gegner presst 0,7 m neben dem Ball, Pass an ihm vorbei – im selben Takt kein Wegtreten
function press(qs) {
  const g = new Game(makeParams(qs), 7, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play';
  const [a, m, o] = g.players;
  a.place(-2, 0, 0); m.place(6, 0, Math.PI); o.place(-0.9, 0.65, -Math.PI / 2); g.ball.place(-1.6, g.ball.r, 0);
  g.lastTouch = a.id; a.lastTouchT = 0; g.rules.updateKeepers(0, true);
  let first = null;
  for (let i = 0; i < 2 / DT && first == null; i++) {
    // (der Gegner hat einen Kick scharf gestellt – Tipp schon vor dem Pass, wie ein Bot, der auf den Ball wartet)
    const ins = []; ins[g.human] = H(g.t < 0.07 ? { passDown: true, mx: 1 } : {}); ins[o.id] = H({ passDown: g.t < 0.03, mx: 0, mz: -0.05 });
    for (const e of g.step(ins)) if (e.player != null && e.player !== a.id && ['touch', 'kick', 'control', 'body', 'tackle'].includes(e.type) && a.kickT < 5) first = e.player;
  }
  return first;
}
{
  const n = press(''), alt = press('reaktion=0');
  check('Reaktionszeit: Pass am pressenden Gegner (Fuß 0,3 m neben der Bahn) vorbei kommt beim Mitspieler an', n === 1 ? 1 : 0, 1, 1, '', 1, `Erster am Ball: Spieler ${n} · ?reaktion=0: Spieler ${alt} (2 = Gegner)`);
}
// 3) Empfänger-Treue: nach dem Pass bleibt die Steuerung beim Empfänger, auch wenn der Passgeber dem Ball näher ist
function treue(qs) {
  const g = new Game(makeParams(qs), 8, { match: true, human: 0, perTeam: [2, 1], bots: false });
  g.rules.phase = 'play'; g.switchT = 5;
  const [a, m, o] = g.players;
  a.place(-6, 0, 0); m.place(8, 4, Math.PI); o.place(9, -6, Math.PI); g.ball.place(-5.6, g.ball.r, 0);
  g.lastTouch = a.id; a.lastTouchT = 0;
  let back = false, kicked = false;
  for (let i = 0; i < 1.6 / DT; i++) {
    // Daumen danach Richtung Ball (wer gesteuert wird, läuft dem Ball nach – wie ein Kind)
    const me = g.players[g.human], dx = g.ball.p.x - me.x, dz = g.ball.p.z - me.z, l = Math.hypot(dx, dz) || 1;
    const ins = []; ins[g.human] = H(g.t < 0.07 ? { passDown: true, mx: 1, mz: 0.3 } : { mx: dx / l, mz: dz / l });
    // (der Passgeber läuft hinterher – Geben und Gehen –, so ist er dem rollenden Ball bald näher als der Empfänger)
    if (g.human !== a.id) { const ex = g.ball.p.x - a.x, ez = g.ball.p.z - a.z, el = Math.hypot(ex, ez) || 1; ins[a.id] = H({ mx: ex / el, mz: ez / el }); }
    for (const e of g.step(ins)) if (e.type === 'kick' && e.player === a.id) kicked = true;
    if (kicked && g.human === a.id && g.lastTouch === a.id) back = true;
  }
  return { back, kicked };
}
{
  const n = treue(''), alt = treue('empfTreue=0');
  check('Empfänger-Treue: Steuerung springt während des Passes nicht zum Passgeber zurück', n.kicked && !n.back ? 1 : 0, 1, 1, '', 1, `?empfTreue=0: ${alt.back ? 'springt zurück' : 'bleibt hier auch'} (Absicherung; im Spiel selten, siehe N8_BERICHT.md)`);
}
// 4) Richtungstreue: Stick aufs eigene Tor, kein Mitspieler dort → Pass bleibt in Stick-Richtung (kürzer), nicht 90° zur Seite
{
  const P = makeParams(''), P0 = makeParams('passTreue=0');
  const dev = (PP) => {
    const g = new Game(PP, 9, { match: true, human: 0, perTeam: [3, 1], bots: false }); g.rules.phase = 'play';
    const [a, k, m, o] = g.players; const gx = g.rules.goalX(0);
    k.place(gx + Math.sign(-gx) * 1, 0, 0); a.place(gx + Math.sign(-gx) * 9, 3, 0); m.place(-gx * 0.4, -5, 0); o.place(0, 6, 0);
    g.ball.place(a.x + 0.4, g.ball.r, a.z); g.rules.updateKeepers(0, true);
    const st = [Math.sign(gx), -0.25], l = Math.hypot(...st), s = [st[0] / l, st[1] / l];
    const p = planPass(g, a, { mode: 'std', power: null, stick: s });
    return { ang: Math.acos(Math.max(-1, Math.min(1, p.dir[0] * s[0] + p.dir[1] * s[1]))) * 180 / Math.PI, to: p.to };
  };
  const n = dev(P), alt = dev(P0);
  check('Richtungstreue: Stick Richtung eigenes Tor ohne Mitspieler → Abspielrichtung ↔ Stick', n.ang, 0, P.passTreue, '°', null, `?passTreue=0: ${f(alt.ang)}° (Rückpass-Umweg zur Seite)`);
}
// 5) Ganze Spiele wie am Handy (Skript-Mensch zielt im Bild, Bots Stufe 2): gezielte Pässe, zum Gegner, > 30° ohne Mitspieler
{
  const G = +(process.env.N8_SPIELE || 8);
  for (const form of ['quer', 'hoch']) {
    const a = auswerten(spielPaesse('', G, form)), b = auswerten(spielPaesse(E1, G, form));
    check(`Spiel ${form} (${G} Spiele): gezielte Pässe kommen beim Gemeinten an, besser als n8 E1`, a.gemeintAn - b.gemeintAn, 12, 100, 'Punkte', null, `${f(a.gemeintAn)} % statt ${f(b.gemeintAn)} %; zum Gegner ${f(a.gemeintGegner)} % statt ${f(b.gemeintGegner)} % (${a.nZiel} gezielte Pässe)`);
    check(`… ${form}: Pässe > 30° neben dem Stick ohne Mitspieler dort`, a.ueber30ohne, 0, 4, '%', null, `n8 E1 ${f(b.ueber30ohne)} %; Stick ↔ Abspielrichtung p50 ${f(a.err50)}° (Vorhalt in den Laufweg)`);
  }
}
process.exit(report('Pässe (n8 Etappe 2)', rows, 'n8_paesse') ? 0 : 1);
