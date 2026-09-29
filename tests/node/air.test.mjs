// Luftbälle (Nacht 2b): Ballmaschinen-Serie (Volley-Station) headless mit Skript-Spieler, der wie ein Mensch den
// Schuss-Knopf im passenden Moment drückt. Jede Technik wird gewählt und trifft; Timing zählt; Kopfball langsamer als
// Fuß; nach Fall-/Seitfallzieher ~0,8 s am Boden; Kopfball mit Sprung; deutliche Stick-Eingabe bricht ab (≤ 0,3 s).
// Aufruf: node tests/node/air.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planAir } from '../../src/sim/air.js';
import { playChallenge, makeScript } from './scripts.mjs';
import { report } from './report.mjs';

const rows = [];
const check = (name, value, lo, hi, unit, target, note = '') => { const ok = value >= lo && value <= hi; rows.push({ name, value, lo, hi, unit, target, ok, note }); return ok; };
const P = makeParams({});
const TECHS = ['volley', 'dropkick', 'seitfall', 'fallrueck', 'kopf', 'flugkopf'];
const NAMES = { volley: 'Volley', dropkick: 'Dropkick', seitfall: 'Seitfallzieher', fallrueck: 'Fallrückzieher', kopf: 'Kopfball', flugkopf: 'Flugkopfball' };

// 1) Ballmaschinen-Serie: 8 Durchgänge à 10 Bälle (Volley-Station), Skript drückt im idealen Zeitfenster
const st = Object.fromEntries(TECHS.map((t) => [t, { want: 0, chosen: 0, kicks: 0, goals: 0, speed: 0, timing: 0, q: 0 }]));
let balls = 0, goalsAll = 0, falls = [], jumps = [];
for (let seed = 1; seed <= 8; seed++) {
  let cur = null, fallStart = null;
  playChallenge(Game, P, 'volley', {
    seed,
    onEvent: (e, g, C) => {
      if (e.type === 'machine') { balls++; cur = { want: C.st.want, tech: null }; st[C.st.want].want++; }
      if (e.type === 'airstart' && e.player === 0 && cur) { cur.tech = e.tech; st[e.tech].chosen++; if (e.tech === 'fallrueck' || e.tech === 'seitfall') fallStart = { t: g.t, tech: e.tech }; }
      if (e.type === 'air' && e.player === 0 && cur) { const s = st[e.tech]; s.kicks++; s.speed += e.speed; s.timing += e.timing; s.q += e.q; cur.kicked = e.tech; if (e.tech === 'kopf') jumps.push(g.players[0].jumpY); }
      if (e.type === 'goal' && cur && cur.kicked) { st[cur.kicked].goals++; goalsAll++; cur.kicked = null; }
    },
  });
  void fallStart;
}
const tab = TECHS.map((t) => { const s = st[t]; return `${NAMES[t]} ${s.chosen}× gewählt, ${s.kicks} getroffen, ${s.goals} Tore, Ø ${(s.speed / Math.max(1, s.kicks)).toFixed(1)} m/s, Timing ${(s.timing / Math.max(1, s.kicks)).toFixed(2)}`; });
check('Ballmaschinen-Serie (8 × 10 Bälle): Tore gesamt', goalsAll / balls * 100, 50, 100, '%', null, `${goalsAll} von ${balls}`);
for (const t of TECHS) {
  const s = st[t];
  check(`${NAMES[t]}: gewählt und trifft das Tor`, s.goals, 1, Infinity, 'Tore', null, `${s.chosen}× gewählt (Station ${s.want}×), ${s.kicks} Ballkontakte, Ø ${(s.speed / Math.max(1, s.kicks)).toFixed(1)} m/s, q ${(s.q / Math.max(1, s.kicks)).toFixed(2)}`);
}
rows.techTable = tab;
const vHead = st.kopf.speed / Math.max(1, st.kopf.kicks), vFoot = (st.volley.speed + st.dropkick.speed) / Math.max(1, st.volley.kicks + st.dropkick.kicks);
check('Kopfball langsamer als Fuß (Volley/Dropkick)', vHead / vFoot, 0, 0.8, '', null, `${vHead.toFixed(1)} vs. ${vFoot.toFixed(1)} m/s`);

// 2) Timing zählt: gleiche Serie, Schuss-Knopf schon 0,3 s vor dem Abschuss der Maschine (viel zu früh) →
//    schlechteres Timing, langsamer, seltener Tor
{
  const sp = { good: [], early: [] }, goals = { good: 0, early: 0 };
  for (const [key, pressAt] of [['good', null], ['early', -0.3]]) {
    for (let seed = 1; seed <= 6; seed++) {
      let kicked = false;
      playChallenge(Game, P, 'volley', { seed, script: makeScript('volley', { pressAt }), onEvent: (e) => {
        if (e.type === 'machine') kicked = false;
        if (e.type === 'air' && e.player === 0) { sp[key].push({ v: e.speed, t: e.timing, q: e.q }); kicked = true; }
        if (e.type === 'goal' && kicked) { goals[key]++; kicked = false; }
      } });
    }
  }
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
  check('Timing: zu früh gedrückt (0,3 s vor dem Abschuss) → Timing-Wert sinkt', sp.early.length ? avg(sp.early, (x) => x.t) : 9, 0, avg(sp.good, (x) => x.t) - 0.3, '', null, `gut ${avg(sp.good, (x) => x.t).toFixed(2)} (${sp.good.length} Kontakte), zu früh ${avg(sp.early, (x) => x.t).toFixed(2)} (${sp.early.length})`);
  check('Timing: zu früh → langsamer', sp.early.length ? avg(sp.early, (x) => x.v) : 99, 0, avg(sp.good, (x) => x.v) - 1, 'm/s', null, `gut ${avg(sp.good, (x) => x.v).toFixed(1)}, zu früh ${avg(sp.early, (x) => x.v).toFixed(1)} m/s`);
  check('Timing: zu früh → Qualität q sinkt (Ziel zur Mitte, mehr Streuung)', sp.early.length ? avg(sp.early, (x) => x.q) : 9, 0, avg(sp.good, (x) => x.q) - 0.25, '', null, `gut ${avg(sp.good, (x) => x.q).toFixed(2)}, zu früh ${avg(sp.early, (x) => x.q).toFixed(2)}; Tore ohne Tormann: gut ${goals.good}, zu früh ${goals.early} von je 60`);
}

// 3) Nach Fallrück-/Seitfallzieher am Boden (~0,8 s), Kopfball mit Sprung
{
  const g = new Game(P, 3, { challenge: 'volley' });
  const C = g.challenge; const sc = makeScript('volley');
  let groundT = [], fallT0 = null, jumpMax = 0;
  while (!C.done && g.t < 80) {
    const ev = g.step([sc(g, C)]);
    const me = g.players[0];
    if (me.fall && fallT0 == null) fallT0 = g.t;
    if (!me.fall && fallT0 != null) { groundT.push(g.t - fallT0); fallT0 = null; }
    if (me.air && me.air.tech === 'kopf') jumpMax = Math.max(jumpMax, me.jumpY);
    void ev;
  }
  const gm = groundT.reduce((a, b) => a + b, 0) / Math.max(1, groundT.length);
  check('Nach Fallrück-/Seitfallzieher am Boden', gm, 0.8, 1.2, 's', 0.8, `${groundT.length}× gemessen (0,8 s + Landung)`);
  check('Kopfball in Sprunghöhe: Absprung', jumpMax, 0.1, P.jumpMax + 0.01, 'm', null, 'höchster Sprung bei den Kopfball-Flanken');
}

// 4) Hilfe nimmt nie die Kontrolle: deutliche Stick-Eingabe gegen den Anlauf bricht den Luftball nach ≤ 0,3 s ab
{
  const g = new Game(P, 2, { challenge: 'volley' });
  const C = g.challenge;
  while (C.attempt < 1 || !C.fired) g.step([{ ...EMPTY_INPUT, passDown: false, shotDown: false }]);
  const me = g.players[0];
  let press = null, t0 = null, cancel = null;
  for (let i = 0; i < 2 / DT && cancel == null; i++) {
    let o = { ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false };
    if (!press && !me.air) { const plan = planAir(g, me, { tPress: g.t }); if (plan && plan.lead > 0.55) press = g.t; }
    if (press && g.t - press < 0.08) o.shotDown = true;
    if (me.air && t0 == null) t0 = g.t;
    if (t0 != null) { const a = me.air || { bx: me.x + 1, bz: me.z }; const dx = me.x - a.bx, dz = me.z - a.bz, l = Math.hypot(dx, dz) || 1; o.mx = dx / l; o.mz = dz / l; }
    g.step([o]);
    if (t0 != null && !me.air) cancel = g.t - t0;
  }
  check('Deutliche Gegen-Eingabe bricht den Luftball ab', cancel ?? 9, 0, 0.36, 's', 0.3, 'Stick weg vom Anlaufpunkt');
}

const ok = report('Luftbälle: Ballmaschinen-Serie, Timing, Technik-Folgen', rows, 'air');
console.log('\nJe Technik:\n' + tab.map((x) => '- ' + x).join('\n'));
process.exit(ok ? 0 : 1);
