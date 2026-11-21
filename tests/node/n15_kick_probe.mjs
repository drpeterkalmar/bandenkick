// n15 E1 (Peter 14.11.: „der eine kick button … soll immer einen kick oder kopfball auslösen, sonst spamme ich den knopf und nichts
// passiert“): Knopf-Spam-Probe. Skript-Mensch (Orange, Bots Stufe 2) jagt den Ball bzw. führt ihn Richtung Tor und drückt den
// Kick-Knopf zu zufälligen Zeiten (alle 0,4–2,5 s, je 0,07 s; halb mit Stick zum Ball/Tor, halb ohne). Je Druck: Lage (am Fuß / frei nah /
// hoch / beim Gegner / weit) und ob binnen 1,5 s ein Ballkontakt (Kick, Luftball, Jongliertrick), Kopfball oder eine Grätsche des
// gesteuerten Spielers (auch nach einem Wechsel) folgt. Nicht gezählt (begründet): Ball in der Hand, Spiel ruht (Tor, Aus, Anstoß).
// Aufruf: node tests/node/n15_kick_probe.mjs [Drücke=300] ["qs"]
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { predictBall } from '../../src/sim/kickplan.js';
import { pathToFileURL } from 'node:url';

const TRACE = process.env.TRACE ? process.env.TRACE.split(':').map(Number) : null;
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const lageVon = (g, me) => {
  const b = g.ball, d = Math.hypot(b.p.x - me.x, b.p.z - me.z);
  if (b.held >= 0) return 'hand';
  let dOpp = 9;
  for (const o of g.players) if (o.team !== me.team) dOpp = Math.min(dOpp, Math.hypot(o.x - b.p.x, o.z - b.p.z));
  const lt = g.lastTouch >= 0 ? g.players[g.lastTouch] : null;
  if (b.p.y > 0.6 && d < 8) return 'hoch';
  if (lt && lt.team !== me.team && dOpp < 1.3 && d < 8) return 'gegner';
  if (d < 1.2 && g.lastTouch === me.id) return 'fuss';
  if (d < 6) return 'nah';
  return 'weit';
};

// Ball so hoch in der Luft, dass er erst nach > 1,2 s unter Kopfball-Sprunghöhe (2,6 m) fällt – kein Kontakt in 1,5 s möglich
const zuHoch = (g) => { const b = g.ball, P = g.P; if (b.p.y < 2.6) return false; const c = b.p.y - 2.6; const t = (b.v.y + Math.sqrt(b.v.y * b.v.y + 2 * P.g * c)) / P.g; return t > 1.2; };
// Kann überhaupt ein Spieler des Teams den Ball binnen 1,5 s erreichen (Ballbahn ohne weitere Berührung, unter 2,6 m, Lauftempo nach 0,2 s
// Reaktion, 1 m Reichweite inkl. Ausfallschritt/Grätsche)? Sonst ist kein Kontakt möglich (Ball fliegt nach dem eigenen Schuss davon …)
const _pr = [];
const erreichbar = (g, team) => {
  const pr = predictBall(g.P, g.cage, g.ball, 1.5, 3, _pr);
  for (const p of g.players) {
    if (p.team !== team) continue;
    for (const q of pr) {
      if (q.y > 2.6 || q.t > 1.35) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), vh = d > 0.01 ? (p.vx * dx + p.vz * dz) / d : 0;
      if (d - 1.0 <= p.travel(vh, g.P.vTop, Math.max(0, q.t - 0.15))) return true; // echte Antrittskurve, 0,15 s Reaktion
    }
  }
  return false;
};
export function spam(qs = '', presses = 300, seed0 = 1) {
  const P = makeParams('dauer=3&' + qs);
  const r = { presses: 0, ok: 0, lagen: {}, ausgelassen: { hand: 0, ruht: 0, hoch: 0, gefangen: 0, weg: 0, aktion: 0, abstoss: 0 }, arten: {}, dt: [] };
  for (let s = 0; r.presses < presses && s < 80; s++) {
    const g = new Game(P, 'ks' + (seed0 + s), { match: true, human: 1, botLevel: 2 });
    const R = new Rng('ksr' + (seed0 + s));
    let next = 1 + R.range(0.4, 2.5), press = null, stickMode = 0;
    while (g.rules.phase !== 'end' && r.presses < presses) {
      const me = g.players[g.human], b = g.ball, gx = me.team === 0 ? g.cage.hx : -g.cage.hx;
      // Skript-Stick: am Ball Richtung Tor, sonst zum Ball (stickMode 1: ab dem Druck ohne Stick)
      const mine = g.lastTouch === me.id && Math.hypot(b.p.x - me.x, b.p.z - me.z) < 1.5 && b.held < 0;
      let mx = 0, mz = 0;
      if (mine) { const l = Math.hypot(gx - me.x, -me.z * 0.5) || 1; mx = (gx - me.x) / l * 0.8; mz = -me.z * 0.5 / l * 0.8; }
      else { const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1; if (l > 0.3) { mx = dx / l; mz = dz / l; } }
      if (press && stickMode === 1) { mx = 0; mz = 0; }
      let down = false;
      if (!press && g.t >= next) {
        next = g.t + R.range(0.4, 2.5);
        const lage = lageVon(g, me);
        if (g.rules.phase !== 'play' && g.rules.phase !== 'kickoff') r.ausgelassen.ruht++;
        else if (lage === 'hand') r.ausgelassen.hand++;
        else if (zuHoch(g)) r.ausgelassen.hoch++;
        else if (!erreichbar(g, me.team)) r.ausgelassen.weg++;
        else if (me.slide || me.fall || me.air || me.hand.mode === 'dive' || me.hand.mode === 'ground') r.ausgelassen.aktion++; // Aktion des vorigen Drucks läuft noch
        else {
          press = { t: g.t, lage, ids: new Set([me.id]), team: me.team, d0: Math.hypot(b.p.x - me.x, b.p.z - me.z), dMin: 99, y0: b.p.y, miss: 0, vSum: 0, n: 0, stick: 0 };
          stickMode = R.next() < 0.5 ? 1 : 0;
          r.presses++; r.lagen[lage] = r.lagen[lage] || { n: 0, ok: 0 }; r.lagen[lage].n++;
          down = true;
        }
      }
      if (press && g.t - press.t < 0.07) down = true;
      const ins = []; ins[g.human] = H({ mx, mz, shotDown: down });
      const ev = g.step(ins);
      if (press) {
        press.ids.add(g.human);
        if (g.ball.held >= 0 && !press.ids.has(g.ball.held)) press.gefangen = true;
        if (g.abstoss && g.abstoss.team !== press.team) press.abstoss = true; // n16 C: geschützter Abstoß des Gegners – absichtlich nicht spielbar
        { const m2 = g.players[g.human]; press.dMin = Math.min(press.dMin, Math.hypot(g.ball.p.x - m2.x, g.ball.p.z - m2.z)); press.vSum += m2.speed; press.n++; press.pd = !!m2.pending; press.air = !!m2.air; press.sl = !!m2.slide; press.stick = stickMode; }
        for (const e of ev) if (e.type === 'airmiss' && press.ids.has(e.player)) press.miss++;
        if (TRACE && TRACE[0] === s && Math.abs(TRACE[1] - press.t) < 0.06 && g.tick % 6 === 0) { const m2 = g.players[g.human], pd = m2.pending; console.log(`t+${(g.t - press.t).toFixed(2)} h${g.human} me(${m2.x.toFixed(2)},${m2.z.toFixed(2)}) f${m2.face.toFixed(2)} v${m2.speed.toFixed(1)} ball(${g.ball.p.x.toFixed(2)},${g.ball.p.y.toFixed(2)},${g.ball.p.z.toFixed(2)}) bv${g.ball.v.len().toFixed(1)} lt${g.lastTouch} pd${pd ? pd.kind + '/' + pd.age.toFixed(2) + (pd.kein ? 'k' : '') : '-'} air${m2.air ? m2.air.tech : '-'} cd${m2.touchCd.toFixed(2)} st${m2.stumbleT.toFixed(2)} sl${m2.slide ? 1 : 0} fa${m2.fall ? 1 : 0} ` + ev.map((e) => e.type).join(',')); }
        for (const e of ev) {
          if (e.type === 'switch') press.ids.add(e.player);
          const hit = (e.type === 'kick' || e.type === 'air' || e.type === 'jongl' || (e.type === 'tackle' && e.phase === 'start') || (e.type === 'control' && e.part === 'kopf') || e.type === 'catch' || e.type === 'parry') && press.ids.has(e.player);
          if (hit) {
            r.ok++; r.lagen[press.lage].ok++; r.dt.push(g.t - press.t);
            const art = e.type === 'kick' ? e.tech || e.kind : e.type === 'tackle' ? 'graetsche' : e.type === 'air' ? e.tech : e.type;
            r.arten[art] = (r.arten[art] || 0) + 1;
            press = null; break;
          }
        }
        if (press && (g.t - press.t > 1.5 || (g.rules.phase !== 'play' && g.rules.phase !== 'kickoff'))) {
          if (g.rules.phase !== 'play' && g.rules.phase !== 'kickoff' && g.t - press.t < 1.5) { r.presses--; r.lagen[press.lage].n--; r.ausgelassen.ruht++; } // Tor/Aus mitten im Fenster
          else if (press.gefangen) { r.presses--; r.lagen[press.lage].n--; r.ausgelassen.gefangen++; } // ein anderer hat den Ball in die Hand genommen
          else if (press.abstoss) { r.presses--; r.lagen[press.lage].n--; r.ausgelassen.abstoss++; }
          else (r.fehl || (r.fehl = [])).push({ lage: press.lage, t: +press.t.toFixed(1), seed: s, d0: +press.d0.toFixed(1), dMin: +press.dMin.toFixed(1), y0: +press.y0.toFixed(1), v: +(press.vSum / press.n).toFixed(1), miss: press.miss, pd: press.pd, air: press.air, sl: press.sl, ohneStick: press.stick });
          press = null;
        }
      }
    }
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const N = +(process.argv[2] || 300), qs = process.argv[3] || '';
  const r = spam(qs, N);
  const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
  console.log(`Drücke ${r.presses} · mit Ballaktion binnen 1,5 s ${r.ok} = ${pct(r.ok, r.presses)} % · nicht gezählt: Ball in der Hand ${r.ausgelassen.hand}, Spiel ruht ${r.ausgelassen.ruht}, Ball > 1,2 s über Kopfhöhe ${r.ausgelassen.hoch}, im Fenster gefangen ${r.ausgelassen.gefangen}, für niemanden erreichbar ${r.ausgelassen.weg}, Spieler grätscht/springt noch (voriger Druck) ${r.ausgelassen.aktion}`);
  for (const [k, v] of Object.entries(r.lagen)) console.log(`  ${k.padEnd(7)} ${String(v.n).padStart(4)} Drücke · ${pct(v.ok, v.n)} %`);
  const dt = r.dt.sort((a, b) => a - b);
  console.log(`  Zeit bis zur Aktion: Median ${(dt[dt.length >> 1] || 0).toFixed(2)} s, 90 % ${(dt[Math.floor(dt.length * 0.9)] || 0).toFixed(2)} s`);
  console.log('  Arten: ' + Object.entries(r.arten).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  if (process.argv.includes('--fehl')) for (const f of r.fehl || []) console.log(JSON.stringify(f));
}
