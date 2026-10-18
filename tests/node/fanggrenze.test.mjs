// n7 Etappe 0 (Peter 14.10.: „Torwart hält fast nie einen scharfen Schuss, sondern klatscht nur ab“): eine Fanggrenze für alle
// Tormänner. Schüsse mit festem Relativtempo auf den stehenden Tormann (CPU-Stufe 1–3 und Auto-Torwart): bis fangMax gefangen,
// darüber abgeklatscht (Körperbälle bis fangKoerperMax ab und zu gefangen), Abpraller seitlich/schräg nach vorn mit 25–40 %
// des Tempos, nie ins eigene Tor, hohe Bälle gefaustet; ?fangMax=0 = alt. Dazu das Messwerkzeug keeper_catch_probe.mjs
// (Bot-Spiele). Aufruf: node tests/node/fanggrenze.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { keeperLevel, HUMAN_KEEPER } from '../../src/sim/bots.js';
import { catchProbe } from './keeper_catch_probe.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };

// Ball fliegt mit Tempo v flach (Höhe y) auf den Tormann zu, seitlich um dz neben der Körpermitte; der Tormann steht still und
// will fangen (Werte der Stufe bzw. des Auto-Torwarts). → {res, v (Abpraller), vx, vz, high, tech}
function shotAtKeeper(qs, K, v, dz, y = 1.0, seed = 1) {
  const g = new Game(makeParams(qs), seed, { match: true, human: -1, perTeam: [1, 1], bots: false });
  g.rules.phase = 'play';
  const kp = g.players[1], hx = g.cage.hx;
  kp.place(hx - 1, 0, Math.PI); g.players[0].place(-6, 0, 0); g.rules.updateKeepers(0, true);
  const b = g.ball; b.place(hx - 4, y, dz); b.v.set(v, 0, 0); b.w.set(0, 0, 0); b.held = -1; b.contact = false;
  const inp = { ...EMPTY_INPUT, hand: true, autoCatch: true, catchSkill: K.catchSkill, fumble: false, diveReach: K.diveReach, catchRel: K.catchRel, tip: K.tip, reachMul: K.reach };
  for (let i = 0; i < 0.5 / DT; i++) {
    const vy0 = b.v.y; b.v.y = 0; b.p.y = y; void vy0; // flach halten bis zum Kontakt
    for (const e of g.step([EMPTY_INPUT, inp])) {
      if (e.type === 'catch') return { res: 'catch' };
      if (e.type === 'parry' && !e.tip) return { res: 'parry', v: Math.hypot(b.v.x, b.v.z), vx: b.v.x, vz: b.v.z, high: e.high, tech: kp.tech, rel: e.speed };
      if (e.type === 'parry') return { res: 'tip' };
    }
  }
  return { res: 'none' };
}
const keepers = [['Stufe 1', keeperLevel(makeParams(''), 1)], ['Stufe 2', keeperLevel(makeParams(''), 2)], ['Stufe 3', keeperLevel(makeParams(''), 3)], ['Auto-Torwart', { ...HUMAN_KEEPER, catchRel: null }]];
const P = makeParams('');
for (const [name, K] of keepers) {
  const slow = shotAtKeeper('', K, 11, 0.45), mid = shotAtKeeper('', K, 15, 0.45), hard = shotAtKeeper('', K, 24, 0.45);
  check(`${name}: 11 m/s (40 km/h) neben den Körper → gefangen`, slow.res === 'catch' ? 1 : 0, 1, 1, '', 1);
  // (tip = nur mit den Fingerspitzen dran, abgefälscht – zählt auch als nicht gefangen)
  check(`${name}: 15 m/s (54 km/h) neben den Körper → abgeklatscht`, mid.res === 'parry' || mid.res === 'tip' ? 1 : 0, 1, 1, '', 1, mid.res);
  check(`${name}: 24 m/s (86 km/h) → abgeklatscht`, hard.res === 'parry' || hard.res === 'tip' ? 1 : 0, 1, 1, '', 1, hard.res);
}
// Körperbälle 13–16 m/s: ab und zu gefangen, darüber nie
{
  const K = keeperLevel(P, 2);
  let c14 = 0, c17 = 0; const n = 40;
  for (let s = 1; s <= n; s++) { if (shotAtKeeper('', K, 14, 0.05, 1.0, s).res === 'catch') c14++; if (shotAtKeeper('', K, 17.5, 0.05, 1.0, s).res === 'catch') c17++; }
  check('Ball direkt auf den Körper, 14 m/s: ab und zu gefangen', 100 * c14 / n, 10, 60, '%', null, `${c14}/${n}`);
  check('… 17,5 m/s: nie gefangen', c17, 0, 0, '', 0);
}
// Abpraller: Tempo 25–40 %, nie Richtung eigenes Tor, seitlich/schräg nach vorn, hohe Bälle gefaustet
{
  const K = keeperLevel(P, 2); const ok = { share: [], back: 0, side: [], n: 0 };
  for (let s = 1; s <= 30; s++) {
    const r = shotAtKeeper('', K, 22, (s % 2 ? 1 : -1) * 0.4, 1.0, s);
    if (r.res !== 'parry') continue;
    ok.n++; ok.share.push(r.v / r.rel); if (r.vx > -0.1) ok.back++; ok.side.push(Math.abs(Math.atan2(r.vz, -r.vx)) * 180 / Math.PI);
  }
  const mn = Math.min(...ok.share), mx = Math.max(...ok.share);
  check('Abpraller-Tempo: Anteil des Schusstempos (min…max)', mn, 0.24, 0.41, '×', null, `bis ${mx.toFixed(2)}, ${ok.n} Paraden`);
  check('… höchstens 0,41 des Tempos', mx, 0, 0.41, '×', null);
  check('Abpraller nie zurück Richtung eigenes Tor', ok.back, 0, 0, '', 0);
  check('Abpraller schräg zur Seite (Winkel zur Torlinien-Normalen, min)', Math.min(...ok.side), 20, 75, '°', null, `max ${Math.max(...ok.side).toFixed(0)}°`);
  const hi = shotAtKeeper('', K, 22, 0.3, 1.85);
  check('Hoher Ball (1,85 m) wird gefaustet (Pose „fausten“)', hi.res === 'parry' && hi.high && hi.tech === 'fausten' ? 1 : 0, 1, 1, '', 1, `${hi.res}, ${hi.tech}`);
  const lo = shotAtKeeper('', K, 22, 0.4, 1.0);
  check('Mittlerer Ball: Pose „parade“ (Abklatschen sichtbar)', lo.tech === 'parade' ? 1 : 0, 1, 1, '', 1, lo.tech);
}
// ?fangMax=0: wie bisher (Stufe 3 fängt 18 m/s)
{
  const r = shotAtKeeper('fangMax=0', keeperLevel(makeParams('fangMax=0'), 3), 18, 0.45);
  check('?fangMax=0: Stufe 3 fängt 18 m/s wie bisher', r.res === 'catch' ? 1 : 0, 1, 1, '', 1, r.res);
}
// Bot-Spiele: Fangquote des ersten Kontakts nach Schuss je Schusstempo (Messwerkzeug keeper_catch_probe.mjs)
{
  const N = +(process.env.FANG_N || 8);
  const r = catchProbe('', N), r0 = catchProbe('fangMax=0', N);
  const pc = (x) => (x.catch + x.parry ? 100 * x.catch / (x.catch + x.parry) : 0);
  check(`Bot-Spiele (${N}): direkte Schüsse 58–72 km/h gefangen`, pc(r.direct[2]), 0, 15, '%', null, `?fangMax=0: ${pc(r0.direct[2]).toFixed(0)} %`);
  check('… 72–90 km/h', pc(r.direct[3]), 0, 5, '%', null, `?fangMax=0: ${pc(r0.direct[3]).toFixed(0)} %`);
  check('… ≥ 90 km/h', pc(r.direct[4]), 0, 2, '%', null, `?fangMax=0: ${pc(r0.direct[4]).toFixed(0)} %; alle (auch abgefälschte, die langsam ankommen): ${r.all.map((x) => pc(x).toFixed(0)).join('/')} %`);
  check('… langsame Bälle (< 45 km/h an den Händen) gefangen', 100 * r.slowCatch / Math.max(1, r.slowAll), 90, 100, '%', null, `${r.slowAll} Bälle`);
}
process.exit(report('Fanggrenze (n7 Etappe 0)', rows, 'fanggrenze') ? 0 : 1);
