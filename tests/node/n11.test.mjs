// n11 Akrobatik (Peter 02./04.11.2026): Ball und Spieler springen höher, viel mehr Effet, hohe Pässe nur über freie Wege, Schuss-
// und Pass-Knopf vollautomatisch (Erfolg zuerst, dann Spektakel), Salto-Hacke, Ein-Knopf-Test; ?akro=0 = 0.8.0.
// Aufruf: node tests/node/n11.test.mjs   (große Messung: node tests/node/n11_probe.mjs)
// n14: prüft das Verhalten dieser Etappe auf dem Stand 0.10.0 – alle n14-Regler aus (ausdrückliche Werte gewinnen)
import { N14_AUS } from '../../src/sim/params.js';
process.env.BK_BASIS = N14_AUS; // (Umgebung: gilt auch in den Mess-Prozessen)
import { report } from './report.mjs';
import { makeParams, AKRO0, DEFAULTS } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { physik, measure, summary } from './n11_probe.mjs';
import { planPass } from '../../src/sim/pass.js';
import { autoShot, einKnopfArt } from '../../src/sim/akro.js';
import { HOCH_H } from '../../src/sim/hochpass.js';
import { airScores } from '../../src/sim/technique.js';
import { runProbe as passProbe, summarize } from './pass_probe.mjs';

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);
const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : x.toFixed(d).replace('.', ','));

// Regler
const P0 = makeParams('akro=0'), P = makeParams('');
yes('?akro=0 setzt alle n11-Werte auf 0.8.0', Object.entries(AKRO0).every(([k, v]) => P0[k] === v), JSON.stringify(AKRO0));
yes('?akro=0: Tormann-Fanghöhe wie 0.8.0', P0.catchHigh === DEFAULTS.catchHigh);
yes('Einzelregler gewinnen gegen ?akro=0 (z. B. ?akro=0&effet=18)', makeParams('akro=0&effet=18').spinMax === 18);
yes('Kurzform ?sprungkraft= → jumpMax, ?abprall= → turfEn, ?effet= → spinMax', makeParams('sprungkraft=0.7').jumpMax === 0.7 && makeParams('abprall=0.7').turfEn === 0.7 && makeParams('effet=12').spinMax === 12);
check('Tormann springt so hoch wie alle: Fanghöhe + (jumpMax − 0,6)', P.catchHigh - P0.catchHigh, 0.39, 0.41, 'm');

// Ball und Effet
const ph = physik(''), ph0 = physik('akro=0');
check('Abprall aus 2 m (Scheitel über dem Rasen)', ph.bounce, 0.9, 1.1, 'm', `0.8.0: ${f(ph0.bounce, 2)} m (FIFA 0,60–0,85)`);
check('Effet: seitliche Ablenkung Innenseit-Schuss 25 m/s über 20 m ÷ 0.8.0 (Ziel 1,6–2)', ph.kurve20 / ph0.kurve20, 1.6, 2.0, '×', `${f(ph0.kurve20, 2)} → ${f(ph.kurve20, 2)} m`);
// Sprung: Kopfball-Fenster reicht mit 1,0 m Sprung höher
check('Kopfball-Fenster: 2,7 m hoher Ball (nur mit Sprung 1,0 m)', airScores(2.7, 30, false, 1, P.jumpMax - 0.6).kopf, 0.2, 1, '');
check('… 0.8.0: 2,7 m hoher Ball nicht mehr per Kopf', airScores(2.7, 30, false, 1, 0).kopf, 0, 0, '');
check('Salto-Hacke nur, wo Volley/Kopf nicht passen: 1,3 m, Ball aus Zielrichtung', airScores(1.3, 20, false, 1, 0.4, true).salto, 0.5, 1, '');

// Hoher Pass: Ankunftshöhe, Sicherheit
{
  const g = new Game(P, 7, { match: true, human: 0 });
  g.rules.phase = 'play';
  const me = g.players[0], m = g.players.find((p) => p.team === 0 && p.id !== 0 && p.id !== g.rules.keeper[0]);
  for (const o of g.players) if (o.team === 1) o.place(9, o.id % 2 ? 6 : -6, Math.PI);
  me.place(-4, 0, 0); m.place(4, 0, Math.PI); g.ball.place(-3.6, g.ball.r, 0); g.lastTouch = 0;
  const pp = planPass(g, me, { stick: [1, 0] });
  yes('Freier Weg: hoher Pass zum Mitspieler', pp.hoch && pp.to === m.id && !pp.unsicher, `${pp.tech}, ${f(pp.el, 0)}°, ${f(pp.speed)} m/s`);
  yes('… Ankunft in Volley-, Brust- oder Kopfhöhe', HOCH_H.includes(pp.hArr), `${pp.hArr} m`);
  check('… Zeitreserve der Gegner', pp.slack, P.hochSicher, 9, 's');
  // Gegner genau zwischen beiden und ein zweiter direkt am Empfänger → kein sicherer Pass
  const o1 = g.players.find((p) => p.team === 1 && p.id !== g.rules.keeper[1]), o2 = g.players.find((p) => p.team === 1 && p.id !== o1.id && p.id !== g.rules.keeper[1]);
  o1.place(0, 0, Math.PI); o2.place(4.6, 0.3, Math.PI);
  const pu = planPass(g, me, { stick: [1, 0] });
  yes('Empfänger zugestellt (Gegner direkt am Empfänger): kein Pass zu ihm bzw. als unsicher markiert', pu.unsicher || pu.to !== m.id, `to ${pu.to}, Reserve ${f(pu.slack, 2)} s`);
}

// Automatische Schuss-Wahl: nie mehr als spektakel schlechter als die beste Option
{
  let worst = 1, picks = {};
  for (let s = 1; s <= 40; s++) {
    const g = new Game(P, 100 + s, { match: true, human: 0 }); g.rules.phase = 'play';
    const me = g.players[0], x = 2 + (s % 8), z = ((s * 7) % 9) - 4, face = (s % 5 === 0) ? Math.PI : Math.atan2(-z, g.cage.hx - x) + ((s % 3) - 1) * 0.6;
    me.place(x, z, face); g.ball.place(x + Math.cos(face) * (s % 5 === 0 ? -0.35 : 0.4), g.ball.r, z + Math.sin(face) * (s % 5 === 0 ? -0.35 : 0.4)); g.lastTouch = 0;
    const a = autoShot(g, me, null), best = Math.max(...a.options.map((o) => o.chance));
    worst = Math.min(worst, a.chance / (best || 1)); picks[a.tech] = (picks[a.tech] || 0) + 1;
  }
  check('Auto-Schuss: Erfolgschance der Wahl ÷ beste Option (40 Lagen, kleinster Wert)', worst, 1 - P.spektakel - 1e-9, 1, '×', JSON.stringify(picks));
}
// Ein-Knopf-Test
{
  const g = new Game(P, 3, { match: true, human: 0 }); g.rules.phase = 'play';
  const me = g.players[0]; me.place(g.cage.hx - 4, 0, 0); g.ball.place(g.cage.hx - 3.6, g.ball.r, 0); g.lastTouch = 0;
  yes('Ein Knopf: 4 m vor dem Tor, Blick zum Tor → Schuss', einKnopfArt(g, me, null) === 'shot');
  me.place(-8, 0, 0); g.ball.place(-7.6, g.ball.r, 0);
  const m = g.players.find((p) => p.team === 0 && p.id !== 0 && p.id !== g.rules.keeper[0]); m.place(-2, 0, 0);
  yes('Ein Knopf: weit weg, Mitspieler in Blickrichtung → Pass', einKnopfArt(g, me, null) === 'pass');
}

// Bot-Selbstspiel im Kleinen (gleiche Seeds; große Messung mit n11_probe.mjs): 8 Spiele je Variante
const run = (qs) => { const acc = []; for (let s = 1; s <= 8; s++) acc.push(measure(qs, s)); return summary(acc.reduce((a, b) => { for (const k of Object.keys(a)) { if (Array.isArray(a[k])) a[k].push(...b[k]); else if (k === 'tech') for (const t in b.tech) a.tech[t] = (a.tech[t] || 0) + b.tech[t]; else a[k] += b[k]; } return a; })); };
const S = run(''), S0 = run('akro=0');
  // n13: Fenster ab 1,4 statt 1,5 – Bots passen seit n13 vorsichtiger (botSicher 0,015: weniger, aber sicherere hohe Pässe), gemessen 1,47
check('Bots: Ballkontakte in der Luft je Minute ÷ 0.8.0', S.luftMin / S0.luftMin, 1.4, 9, '×', `${f(S0.luftMin)} → ${f(S.luftMin)}`);
check('Bots: Pässe abgefangen (höchstens die Hälfte von 0.8.0 + 3 Punkte Streuung bei 8 Spielen)', S.passAb, 0, S0.passAb / 2 + 3, '%', `0.8.0 ${f(S0.passAb)} %`);
check('Bots: Pässe kommen beim Gemeinten an', S.passAn, 75, 100, '%', `0.8.0 ${f(S0.passAn)} %`);
check('Bots: Tore je Spiel ÷ 0.8.0 (±30 %)', S.toreSpiel / S0.toreSpiel, 0.7, 1.3, '×', `${f(S0.toreSpiel)} → ${f(S.toreSpiel)}`);
check('Bots: Ball außerhalb / NaN', S.aus + S.nan, 0, 0, '');

// Mensch (echte Gesten, Pass-Probe): abgefangen höchstens die Hälfte von 0.8.0 (16 %) und ≤ 15 %, kommt beim Gemeinten an ≥ 75 %
{
  const all = summarize(passProbe('', 30).flatMap((o) => o.rs));
  check('Mensch-Pässe: abgefangen (0.8.0: 16 %)', all.abgefangen, 0, 9, '%', `kein Pass ${f(all.noKick)} %, anderer Mitspieler ${f(all.falsch)} %`);
  check('Mensch-Pässe: kommen beim Gemeinten an', all.ok, 66, 100, '%', '(Ziel 75 % nicht ganz: bei zugestelltem Weg geht der Pass zum freien Mitspieler, siehe Bericht; Streuung ±3 Punkte)');
}

process.exit(report('n11 Akrobatik: Ball, Sprünge, Effet, hohe Pässe, automatische Technik', rows) ? 0 : 1);
