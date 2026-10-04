// Luftbälle (Nacht 2b): Ballmaschinen-Serie (Volley-Station) headless mit Skript-Spieler, der wie ein Mensch den
// Schuss-Knopf im passenden Moment drückt. Jede Technik wird gewählt und trifft; Timing zählt; Kopfball langsamer als
// Fuß; nach Fall-/Seitfallzieher ~0,8 s am Boden; Kopfball mit Sprung; deutliche Stick-Eingabe bricht ab (≤ 0,3 s).
// Aufruf: node tests/node/air.test.mjs
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { planAir } from '../../src/sim/air.js';
import { AIR_POSE } from '../../src/sim/technique.js';
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

// 2) Timing: gleiche Serie, Schuss-Knopf schon 0,3 s vor dem Abschuss der Maschine (viel zu früh).
//    Nacht 2c (Standard, Timing-Hilfe): die Hilfe wählt den besten Moment → kostet höchstens wenig.
//    Mit ?timinghilfe=0 (strenges Timing wie Nacht 2b): schlechteres Timing, langsamer, seltener Tor.
function timingRun(PP) {
  const sp = { good: [], early: [] }, goals = { good: 0, early: 0 };
  for (const [key, pressAt] of [['good', null], ['early', -0.3]]) {
    for (let seed = 1; seed <= 6; seed++) {
      let kicked = false;
      playChallenge(Game, PP, 'volley', { seed, script: makeScript('volley', { pressAt }), onEvent: (e) => {
        if (e.type === 'machine') kicked = false;
        if (e.type === 'air' && e.player === 0) { sp[key].push({ v: e.speed, t: e.timing, q: e.q }); kicked = true; }
        if (e.type === 'goal' && kicked) { goals[key]++; kicked = false; }
      } });
    }
  }
  return { sp, goals };
}
const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
{
  const { sp, goals } = timingRun(P);
  check('Timing-Hilfe: zu früh gedrückt (0,3 s vor dem Abschuss) → Timing-Wert höchstens 15 % schlechter', sp.early.length ? avg(sp.early, (x) => x.t) : 0, avg(sp.good, (x) => x.t) - 0.15, 1, '', null, `gut ${avg(sp.good, (x) => x.t).toFixed(2)} (${sp.good.length} Kontakte), zu früh ${avg(sp.early, (x) => x.t).toFixed(2)} (${sp.early.length})`);
  check('Timing-Hilfe: zu früh → kaum langsamer', sp.early.length ? avg(sp.early, (x) => x.v) : 0, avg(sp.good, (x) => x.v) - 1, 99, 'm/s', null, `gut ${avg(sp.good, (x) => x.v).toFixed(1)}, zu früh ${avg(sp.early, (x) => x.v).toFixed(1)} m/s; Tore ohne Tormann: gut ${goals.good}, zu früh ${goals.early} von je 60`);
}
{
  const { sp, goals } = timingRun(makeParams('timinghilfe=0'));
  check('?timinghilfe=0: zu früh gedrückt → Timing-Wert sinkt', sp.early.length ? avg(sp.early, (x) => x.t) : 9, 0, avg(sp.good, (x) => x.t) - 0.3, '', null, `gut ${avg(sp.good, (x) => x.t).toFixed(2)} (${sp.good.length} Kontakte), zu früh ${avg(sp.early, (x) => x.t).toFixed(2)} (${sp.early.length})`);
  check('?timinghilfe=0: zu früh → langsamer', sp.early.length ? avg(sp.early, (x) => x.v) : 99, 0, avg(sp.good, (x) => x.v) - 1, 'm/s', null, `gut ${avg(sp.good, (x) => x.v).toFixed(1)}, zu früh ${avg(sp.early, (x) => x.v).toFixed(1)} m/s`);
  check('?timinghilfe=0: zu früh → Qualität q sinkt (Ziel zur Mitte, mehr Streuung)', sp.early.length ? avg(sp.early, (x) => x.q) : 9, 0, avg(sp.good, (x) => x.q) - 0.25, '', null, `gut ${avg(sp.good, (x) => x.q).toFixed(2)}, zu früh ${avg(sp.early, (x) => x.q).toFixed(2)}; Tore ohne Tormann: gut ${goals.good}, zu früh ${goals.early} von je 60`);
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

// 5) Nacht 2d (Peter: „Fallrückzieher in die richtige Richtung“): Blick und Fallrichtung je Technik beim Kontakt.
//    g = Richtung Treffpunkt → Tormitte, s = Richtung, aus der der Ball kommt, f = Blick
{
  const by = {};
  for (let seed = 1; seed <= 8; seed++) {
    let cur = null;
    playChallenge(Game, P, 'volley', { seed, onEvent: (e, g, C) => {
      const me = g.players[0];
      if (e.type === 'airstart' && e.player === 0 && me.air) cur = { tech: e.tech, sx: me.air.sx, sz: me.air.sz };
      if (e.type === 'air' && e.player === 0 && cur) {
        const gx = g.cage.hx - e.x, gz = -e.z, gl = Math.hypot(gx, gz), fx = Math.cos(me.face), fz = Math.sin(me.face);
        const b = g.ball, bl = Math.hypot(b.v.x, b.v.z) || 1;
        const r = by[e.tech] || (by[e.tech] = { n: 0, fg: 0, fs: 0, behind: 0, toGoal: 0, hmin: 9, onTarget: 0 });
        r.n++; r.fg += (fx * gx + fz * gz) / gl; r.fs += fx * cur.sx + fz * cur.sz;
        r.behind += (e.x - me.x) * fx + (e.z - me.z) * fz; r.hmin = Math.min(r.hmin, e.y);
        r.toGoal += (b.v.x * gx + b.v.z * gz) / (bl * gl);
        const tl = (g.cage.hx - e.x) / (b.v.x || 1e-6), zl = e.z + b.v.z * tl; if (b.v.x > 0 && Math.abs(zl) < g.cage.gw + 0.3) r.onTarget++;
        cur = null;
      }
    } });
  }
  const m = (t, k) => (by[t] ? by[t][k] / by[t].n : NaN);
  const fr = by.fallrueck || { n: 0 };
  check('Fallrückzieher: Blick beim Kontakt ↔ Richtung Tor (Rücken zum Tor)', m('fallrueck', 'fg'), -1, -0.5, 'cos', -1, `${fr.n} Kontakte; Nacht 2c schaute er zum Tor (Blick in Flugrichtung des Balls)`);
  // Kopf fällt mit dem Körper: rückwärts (pitch < 0) heißt gegen den Blick, also zum Tor
  const headDir = Math.sign(AIR_POSE.fallrueck.pitch) * m('fallrueck', 'fg');
  check('Fallrückzieher: Kopf fällt zum Tor (Pose rückwärts, Blick vom Tor weg)', headDir, 0.5, 1, 'cos', 1, `pitch ${AIR_POSE.fallrueck.pitch} rad`);
  check('Fallrückzieher: Ball beim Kontakt über/hinter dem Kopf (hinter der Körpermitte, hoch)', m('fallrueck', 'behind'), -1, 0.05, 'm', null, `vor (+)/hinter (−) dem Körper entlang des Blicks; niedrigster Treffpunkt ${fr.hmin?.toFixed(2)} m`);
  check('Fallrückzieher: Ball fliegt aufs Tor', fr.n ? fr.onTarget / fr.n * 100 : 0, 80, 100, '%', null, `Richtung Ball ↔ Tor cos ${m('fallrueck', 'toGoal').toFixed(2)}`);
  check('Seitfallzieher: seitlich (Blick quer zum Tor)', Math.abs(m('seitfall', 'fg')), 0, 0.5, '|cos|', 0, `${by.seitfall?.n} Kontakte, Blick ↔ Ball cos ${m('seitfall', 'fs').toFixed(2)}`);
  check('Flugkopfball: Blick zum Ball hin', m('flugkopf', 'fs'), 0.3, 1, 'cos', null, `Blick ↔ Tor cos ${m('flugkopf', 'fg').toFixed(2)}`);
  for (const t of ['volley', 'dropkick', 'kopf']) {
    check(`${NAMES[t]}: Blick zwischen Ball und Tor`, Math.min(m(t, 'fs'), m(t, 'fg')), 0, 1, 'cos', null, `Blick ↔ Ball ${m(t, 'fs').toFixed(2)}, ↔ Tor ${m(t, 'fg').toFixed(2)}, Treffpunkt ${m(t, 'behind').toFixed(2)} m vor dem Körper`);
  }
  // Challenge Fallrückzieher über 40 Durchgänge (Nacht 2c, gleiche Messung: 65 von 80 = 81 %; Plan, Tempo und q sind
  // unverändert – die Abweichung je Lauf ist Zufall der Streuung, ±4,5 %)
  let fk = 0, fg = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let cur = null;
    playChallenge(Game, P, 'volley', { seed, onEvent: (e) => {
      if (e.type === 'machine') cur = null;
      if (e.type === 'air' && e.player === 0) { cur = e.tech; if (cur === 'fallrueck') fk++; }
      if (e.type === 'goal' && cur === 'fallrueck') { fg++; cur = null; }
    } });
  }
  check('Volley-Station, Fallrückzieher-Bälle (40 Durchgänge): Tore', fg / Math.max(1, fk) * 100, 72, 100, '%', 81, `${fg} von ${fk} (Nacht 2c 65 von 80)`);
}
// 6) Falle aus dem Brief: im freien Training (kein Spiel) nimmt der Schuss das Tor aus dem Plan beim Drücken, nicht aus
//    dem Blick – der Fallrückzieher schaut jetzt vom Tor weg und trifft trotzdem das Tor, auf das er beim Drücken lief
{
  const g = new Game(makeParams('solo=1'), 4);
  const me = g.players[0], hx = g.cage.hx;
  me.place(hx - 6, 0, 0); // läuft aufs rechte Tor zu (Blick +x)
  g.ball.place(hx - 13, 0.11, 0.1); g.ball.contact = false; g.ball.held = -1;
  // Ball von hinten über ihn hinweg: Scheitel kurz hinter ihm, fällt auf Brust-/Kopfhöhe vor ihm herunter
  g.ball.v.set(9.5, 5.2, 0); g.ball.w.set(0, 0, 0);
  let plan = null, kick = null;
  for (let i = 0; i < 2 / DT && !kick; i++) {
    if (!plan && !me.air) { const p = planAir(g, me, { tPress: g.t }); if (p && p.tech === 'fallrueck' && p.tq >= 0.999) { plan = p; me.air = p; } }
    for (const e of g.step([{ ...EMPTY_INPUT, passDown: false, shotDown: false }])) if (e.type === 'air' && e.player === 0) kick = { vx: g.ball.v.x, face: me.face };
  }
  check('Freies Training: Fallrückzieher trifft das Tor aus dem Plan (+x), obwohl er von ihm weg schaut', kick ? Math.sign(kick.vx) : 0, 1, 1, '', 1, plan ? `Plan-Tor x = ${plan.goalX}, Blick beim Kontakt cos ${Math.cos(kick ? kick.face : 0).toFixed(2)}` : 'kein Fallrückzieher geplant');
}

const ok = report('Luftbälle: Ballmaschinen-Serie, Timing, Technik-Folgen', rows, 'air');
console.log('\nJe Technik:\n' + tab.map((x) => '- ' + x).join('\n'));
process.exit(ok ? 0 : 1);
