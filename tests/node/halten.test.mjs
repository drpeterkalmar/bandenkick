// Nacht 2e (Peter 03.10.): Tormann hält den Ball nicht mehr so lange. Bot-Spiele (Stufe 2, je 2 × 4 min) vorher/nachher:
// Haltezeit je Ballbesitz des Tormanns (Median ≤ 1,2 s, spätestens nach ~2 s weg), keine Zwangsabwürfe, Anteil
// abgefangener Abwürfe nicht höher als vorher (?halten=0 = Nacht 2d). Aufruf: node tests/node/halten.test.mjs (HALTEN_N=6)
import { makeParams } from '../../src/sim/params.js';
import { holdProbe } from './keeper_hold_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const N = +(process.env.HALTEN_N || 6);
const f = (v) => v.toFixed(2).replace('.', ',');
const P = makeParams('');
{
  const neu = holdProbe('', N), alt = holdProbe('halten=0', N);
  const nt = (r) => `Median ${f(r.med)} s, 90 % ${f(r.p90)} s, max ${f(r.max)} s (${r.n} Ballbesitze; Abwurf ${r.kinds.throw}, Abschlag ${r.kinds.punt}, Zwang ${r.kinds.sixsec})`;
  check(`Bot-Tormann: Haltezeit Median (${N} Spiele)`, neu.med, 0, P.halten, 's', P.halten, `${nt(neu)} · vorher (?halten=0): ${nt(alt)}`);
  check('Bot-Tormann: längste Haltezeit', neu.max, 0, P.halten + 0.85, 's', P.halten + 0.8, 'spätestens nach ~2 s Abschlag in die freiere Hälfte');
  check('Bot-Tormann: kein Zwangsabwurf (Zeitregel)', neu.kinds.sixsec, 0, 0, '×', 0, `Zeitregel jetzt ${P.holdMax} s (vorher 6 s)`);
  check('Abgefangene Abwürfe/Abschläge (Gegner zuerst am Ball)', neu.interPct, 0, alt.interPct + 3, '%', null, `${neu.inter}/${neu.n}, daraus Gegentor ≤ 6 s ${neu.interGoal} · vorher ${alt.inter}/${alt.n} = ${alt.interPct.toFixed(1)} %, Gegentor ${alt.interGoal}`);
  check('Numerik-Fehler', neu.faults, 0, 0, '×', 0, `Tore ${neu.goals} (vorher ${alt.goals})`);
}
process.exit(report('Tormann gibt den Ball schnell weiter (Nacht 2e)', rows, 'halten') ? 0 : 1);
