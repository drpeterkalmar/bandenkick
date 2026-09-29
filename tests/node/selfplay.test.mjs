// Selbstspiel-Gate: ≥ 200 Bot-Spiele (2 × 4 min) headless im Zeitraffer, alle 9 Stärke-Paarungen reihum.
// Keine Hänger (Ball liegt fest / in der Ecke eingeklemmt, Bots laufen im Kreis), keine Numerik-Fehler,
// Ball nie länger als 6 s in der Hand, Tore fallen, beide Mannschaften treffen. SELFPLAY_N=20 für kurze Läufe.
import { playGame } from './selfplay.mjs';
import { report } from './report.mjs';

const N = +(process.env.SELFPLAY_N || 200);
const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const t0 = performance.now();
const agg = { goals: [0, 0], t: 0, stuck: [], faults: 0, holdMax: 0, ended: 0, noGoal: 0, bothScore: 0, team0: 0, team1: 0, ev: {}, kicks: {}, bot: {}, maxGoals: 0, draws: 0, air: {}, airGoals: {}, tech: {} };
const vs = {}; // Stärke-Paarung → Siege
const goalsBy = {}; // Stärke-Paarung → Tore gesamt
for (let s = 1; s <= N; s++) {
  const levels = [((s - 1) % 3) + 1, (Math.floor((s - 1) / 3) % 3) + 1];
  const r = playGame(s, { levels });
  agg.t += r.t; agg.goals[0] += r.goals[0]; agg.goals[1] += r.goals[1];
  agg.stuck.push(...r.stuck.map((x) => ({ ...x, seed: s })));
  agg.faults += r.faults; agg.holdMax = Math.max(agg.holdMax, r.holdMax);
  if (r.phase === 'end') agg.ended++;
  const g = r.goals[0] + r.goals[1];
  if (!g) agg.noGoal++;
  if (r.goals[0] && r.goals[1]) agg.bothScore++;
  if (r.goals[0]) agg.team0++;
  if (r.goals[1]) agg.team1++;
  if (r.goals[0] === r.goals[1]) agg.draws++;
  agg.maxGoals = Math.max(agg.maxGoals, g);
  for (const [k, v] of Object.entries(r.events)) agg.ev[k] = (agg.ev[k] || 0) + v;
  for (const [k, v] of Object.entries(r.kicks)) agg.kicks[k] = (agg.kicks[k] || 0) + v;
  for (const [k, v] of Object.entries(r.bot)) agg.bot[k] = (agg.bot[k] || 0) + v;
  for (const [k, v] of Object.entries(r.air)) agg.air[k] = (agg.air[k] || 0) + v;
  for (const [k, v] of Object.entries(r.airGoals)) agg.airGoals[k] = (agg.airGoals[k] || 0) + v;
  for (const [k, v] of Object.entries(r.tech)) agg.tech[k] = (agg.tech[k] || 0) + v;
  { const key = `${levels[0]}-${levels[1]}`; goalsBy[key] = goalsBy[key] || [0, 0, 0]; goalsBy[key][0] += r.goals[0]; goalsBy[key][1] += r.goals[1]; goalsBy[key][2]++; }
  if (levels[0] !== levels[1]) {
    const hi = levels[0] > levels[1] ? 0 : 1, key = `${Math.max(...levels)} gegen ${Math.min(...levels)}`;
    vs[key] = vs[key] || { stronger: 0, weaker: 0, draw: 0 };
    if (r.goals[0] === r.goals[1]) vs[key].draw++; else if ((r.goals[0] > r.goals[1]) === (hi === 0)) vs[key].stronger++; else vs[key].weaker++;
  }
}
const sec = (performance.now() - t0) / 1000;
if (process.env.DEBUG) console.log('Tore je Paarung (Orange-Blau: Tore Orange/Blau/Spiele)', JSON.stringify(goalsBy));
const G = agg.goals[0] + agg.goals[1], min = agg.t / 60;
const kinds = {};
for (const x of agg.stuck) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
check('Bot-Spiele (2 × 4 min, alle Stärke-Paarungen)', N, 200, Infinity, '', 200, `${sec.toFixed(0)} s Rechenzeit, Zeitraffer ${(agg.t / sec).toFixed(0)}×`);
check('Spiele regulär beendet (Abpfiff)', agg.ended, N, N, `/${N}`, N);
check('Hänger: Ball liegt fest / in der Ecke eingeklemmt', (kinds['Ball liegt fest'] || 0) + (kinds['Ball in der Ecke eingeklemmt'] || 0), 0, 0, '×', 0, agg.stuck.slice(0, 3).map((x) => `Seed ${x.seed} t=${x.t}`).join(', '));
check('Hänger: Bot läuft im Kreis', kinds['Bot läuft im Kreis'] || 0, 0, 0, '×', 0);
check('Numerik-Fehler', agg.faults, 0, 0, '×', 0);
check('Ball höchstens 6 s in der Hand', agg.holdMax, 0, 6.01, 's', 6);
check('Tore fallen: Spiele ohne Tor', agg.noGoal, 0, Math.floor(N * 0.02), '', 0, `Ø ${(G / N).toFixed(1)} Tore je Spiel (${(G / min).toFixed(2)} je Minute), höchstens ${agg.maxGoals}, Remis ${agg.draws}`);
check('Beide Mannschaften treffen (gesamt)', Math.min(agg.goals[0], agg.goals[1]), 1, Infinity, 'Tore', null, `Mannschaft 0: ${agg.goals[0]}, Mannschaft 1: ${agg.goals[1]}`);
check('Spiele, in denen beide treffen', agg.bothScore / N * 100, 80, 100, '%', null, `Mannschaft 0 trifft in ${agg.team0}, Mannschaft 1 in ${agg.team1} von ${N}`);
const pe = (k) => ((agg.ev[k] || 0) / N).toFixed(1), pk = (k) => ((agg.kicks[k] || 0) / N).toFixed(1);
check('Letzte Hand wechselt im Spiel (Hysterese)', (agg.ev.keeper || 0) / N, 0.2, Infinity, '× je Spiel', null);
check('Tormann-Aktionen je Spiel: Fangen', +pe('catch'), 5, Infinity, '', null, `Abwehren ${pe('parry')}, Hechten ${pe('dive')}, Abwurf ${pe('throw')}, Abschlag ${pe('punt')}, 6-s-Regel ${pe('sixsec')}`);
check('Schüsse je Spiel', +pk('shot'), 10, Infinity, '', null, `Verwertung ${(100 * G / (agg.kicks.shot || 1)).toFixed(0)} %, Pässe ${pk('pass')}, Befreien ${pk('clear')}, Ballkontakte beim Führen ${pe('touch')}`);
check('Bandenpässe je Spiel (zum Mitspieler / zu sich selbst)', (agg.bot.banks + agg.bot.selfWall) / N, 1, Infinity, '', null, `${(agg.bot.banks / N).toFixed(1)} / ${(agg.bot.selfWall / N).toFixed(1)}, Bande-Treffer ${pe('board')}`);
const airAll = Object.values(agg.air).reduce((a, b) => a + b, 0);
check('Neue Techniken im Selbstspiel: Luftbälle je Spiel', airAll / N, 1, Infinity, '', null, Object.entries(agg.air).map(([k, v]) => `${k} ${(v / N).toFixed(1)} (${agg.airGoals[k] || 0} Tore)`).join(', '));
check('Neue Techniken im Selbstspiel: Chips/Hacke/Außenrist/angeschnitten je Spiel', ((agg.tech.chip || 0) + (agg.tech.ferse || 0) + (agg.tech.aussen || 0) + (agg.tech.innenrist || 0) + (agg.tech.aussenrist || 0)) / N, 1, Infinity, '', null,
  ['innen', 'aussen', 'ferse', 'chip', 'vollspann', 'innenrist', 'aussenrist'].map((k) => `${k} ${((agg.tech[k] || 0) / N).toFixed(1)}`).join(', '));
for (const [k, v] of Object.entries(vs).sort()) check(`Stärke ${k}: Siege der stärkeren Bots`, v.stronger / (v.stronger + v.weaker || 1) * 100, 50, 100, '%', null, `${v.stronger}:${v.weaker}, Remis ${v.draw}`);

process.exit(report(`Selbstspiel (${N} Bot-Spiele)`, rows, 'selfplay') ? 0 : 1);
