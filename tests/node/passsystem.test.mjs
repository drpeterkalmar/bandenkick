// Nacht 2e (Peter 03.10.: „repariere das Passsystem, die Pässe gehen irgendwo hin“): Pass-Probe mit festem Seed als Test.
// Echtes 3 gegen 3 mit Bots, Gesten wie am Handy (Tipp/Halten, mit/ohne Stick, stehend/laufend/Sprint, Daumen danach los
// oder gehalten) – siehe tests/node/pass_probe.mjs. Ziele (Passweg beim Abspiel frei): stehend ≥ 90 %, laufend ≥ 85 %,
// Sprint ≥ 80 % beim gemeinten Mitspieler; Empfänger = gemeint ≥ 90 %; Abflug = Vorschau (ohne Streuung ≤ 3°); deutlich
// besser als ?passfix=0. Dazu Bot-Pässe im Bot-Spiel. Aufruf: node tests/node/passsystem.test.mjs (PASS_PROBE_N=200)
import { runProbe, summarize } from './pass_probe.mjs';
import { botPassProbe } from './botpass_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const N = +(process.env.PASS_PROBE_N || 200);
const neu = runProbe('', N), alt = runProbe('passfix=0', N);
const grp = (out, moves) => summarize(out.filter((o) => moves.includes(o.move)).flatMap((o) => o.rs));
const f = (v) => v.toFixed(1).replace('.', ',');
for (const [name, moves, lo] of [['stehend (mit/ohne Stick)', ['steh', 'ohne'], 90], ['laufend', ['lauf'], 85], ['Sprint', ['sprint'], 80]]) {
  const a = grp(neu, moves), b = grp(alt, moves);
  check(`Pass kommt beim gemeinten Mitspieler an, Weg frei – ${name}`, a.okFreeK, lo, 100, '%', lo === 85 ? 90 : lo,
    `${a.nFreeK} Pässe; alle Pässe ${f(a.ok)} %, abgefangen ${f(a.abgefangen)} %, kein Pass ${f(a.noKick)} % · ?passfix=0: ${f(b.okFreeK)} % (alle ${f(b.ok)} %, kein Pass ${f(b.noKick)} %)`);
}
{
  const held = summarize(neu.filter((o) => o.thumb === 'halten').flatMap((o) => o.rs)), held0 = summarize(alt.filter((o) => o.thumb === 'halten').flatMap((o) => o.rs));
  check('Daumen bleibt nach dem Pass auf dem Stick: kommt trotzdem an (Weg frei)', held.okFreeK, 80, 100, '%', null, `?passfix=0: ${f(held0.okFreeK)} % – der Empfänger lief mit dem gehaltenen Stick vom Ball weg`);
  const a = summarize(neu.flatMap((o) => o.rs)), b = summarize(alt.flatMap((o) => o.rs));
  check('Gewählter Empfänger = Mitspieler, auf den Stick/Blick zeigt', a.sel, 90, 100, '%', 95, `?passfix=0: ${f(b.sel)} %`);
  check('Abflug = Vorschau ohne Streuung (p90)', a.errPlan90, 0, 3, '°', 0, `mit Streuung p50 ${f(a.errPrev50)}°, p90 ${f(a.errPrev90)}° (?passfix=0: p90 ${f(b.errPrev90)}°)`);
  check('Alle Pässe: kommt an, besser als ?passfix=0', a.ok - b.ok, 25, 100, 'Punkte', null, `${f(a.ok)} % statt ${f(b.ok)} %; Passgeber holt sich den Ball selbst ${f(a.selbst)} % (vorher ${f(b.selbst)} %), anderer Mitspieler ${f(a.falsch)} % (vorher ${f(b.falsch)} %)`);
}
{
  const n = +(process.env.BOTPASS_N || 6);
  const a = botPassProbe('', n), b = botPassProbe('passfix=0', n);
  check(`Bot-Spiele (${n}): Bot-Pässe kommen an`, a.okPct, 50, 100, '%', null, `${a.n} Pässe, abgefangen ${f(a.interPct)} % · ?passfix=0: ${f(b.okPct)} %`);
  check('Bot-Spiele: Passgeber spielt seinen eigenen Pass wieder selbst', a.selfPct, 0, 5, '%', 0, `?passfix=0: ${f(b.selfPct)} %`);
}
process.exit(report('Passsystem (Nacht 2e)', rows, 'passsystem') ? 0 : 1);
