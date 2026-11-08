// n8 Etappe 2 (Peter 26.10.: „Pässe gehen irgendwohin“): Pässe in ganzen Spielen wie am Handy. Ein Skript-Mensch (Orange, Bots
// Stufe 2 überall sonst) führt den Ball und passt nach 0,4–1,5 s: meist zielt er im BILD auf einen Mitspieler (echte Spielkamera
// hoch oder quer, Daumen-Fehler σ 8° im Bild), manchmal (20 %) in eine beliebige Richtung. Der Stick geht wie im Spiel auf den
// Boden (P.stickBild). Je Pass gemessen: Winkel Stick ↔ Abspielrichtung, ob dort (±30°) ein Mitspieler war, Art (Mitspieler,
// Bande, freier Raum, Rückpass-Umweg), wer als Nächster am Ball ist (der Gemeinte, anderer Mitspieler, Gegner, niemand in 3 s).
// Aufruf: node tests/node/passspiel_probe.mjs [Spiele=8] ["qs"] [hoch|quer]
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { EMPTY_INPUT } from '../../src/sim/player.js';
import { Rng } from '../../src/sim/rng.js';
import { kamera, folgen, stickImBild, stickWelt } from './stickbild.mjs';
import { pathToFileURL } from 'node:url';

const DEG = 180 / Math.PI;
const H = (o = {}) => ({ ...EMPTY_INPUT, mx: 0, mz: 0, passDown: false, shotDown: false, ...o });
const segD = (px, pz, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L2)); return Math.hypot(px - ax - ex * t, pz - az - ez * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

export function spielPaesse(qs = '', games = 8, form = 'quer', seed0 = 1) {
  const P = makeParams('dauer=4&' + qs);
  const all = [];
  for (let s = 0; s < games; s++) {
    const g = new Game(P, 'ps' + (seed0 + s), { match: true, human: 1, botLevel: 2 });
    const R = new Rng('psr' + (seed0 + s));
    const cam = kamera(form, g.cage);
    folgen(cam, { x: 0, z: 0, vx: 0, vz: 0 }, g.players[1], 1);
    let plan = null, open = null, pressT = -9, holdSince = -1;
    while (g.rules.phase !== 'end' && g.t < g.rules.halfLen * 2 + 200) {
      const me = g.players[g.human], b = g.ball;
      const mates = g.players.filter((p) => p.team === me.team && p.id !== me.id && !(g.rules.isBackPassTarget && g.rules.isBackPassTarget(p)));
      const bd = Math.hypot(b.p.x - me.x, b.p.z - me.z);
      const mine = g.lastTouch === me.id && bd < 1.5 && b.held < 0 && g.rules.phase === 'play';
      let inp;
      // Daumen bleibt bis zum Abspiel (höchstens 0,8 s) in Pass-Richtung, wie ein Kind, das auf den Mitspieler zeigt
      if (plan && g.t - pressT < 0.8) inp = H({ mx: plan.w[0], mz: plan.w[1], passDown: g.t - pressT < 0.07 });
      else if (mine) {
        if (holdSince < 0) holdSince = g.t + R.range(0.4, 1.5);
        if (g.t >= holdSince && !open) {
          // Ziel wählen: 80 % ein Mitspieler (im Bild gezielt), 20 % irgendeine Richtung
          let sb, want = -1;
          if (mates.length && R.next() < 0.8) {
            const m = mates[R.next() < 0.5 ? 0 : mates.length - 1]; want = m.id;
            const s0 = stickImBild(cam, me, m), a = Math.atan2(s0[1], s0[0]) + R.gauss() * 8 / DEG; sb = [Math.cos(a), Math.sin(a)];
          } else { const a = R.range(-Math.PI, Math.PI); sb = [Math.cos(a), Math.sin(a)]; }
          const w = stickWelt(cam, me, sb, !!P.stickBild), wl = Math.hypot(w[0], w[1]) || 1;
          plan = { w: [w[0] / wl * 0.8, w[1] / wl * 0.8], want, t: g.t, from: me.id }; pressT = g.t; holdSince = -1;
          inp = H({ mx: plan.w[0], mz: plan.w[1], passDown: true });
        } else {
          const gx = me.team === 0 ? g.cage.hx : -g.cage.hx, dx = gx - me.x, dz = -me.z * 0.5, l = Math.hypot(dx, dz) || 1;
          inp = H({ mx: dx / l * 0.7, mz: dz / l * 0.7 });
        }
      } else {
        holdSince = -1;
        const dx = b.p.x + b.v.x * 0.3 - me.x, dz = b.p.z + b.v.z * 0.3 - me.z, l = Math.hypot(dx, dz) || 1;
        inp = H(l > 0.3 ? { mx: dx / l, mz: dz / l } : {});
      }
      const ins = []; ins[g.human] = inp;
      const ev = g.step(ins);
      cam.update(DT, { x: b.p.x, z: b.p.z, vx: b.v.x, vz: b.v.z }, g.players[g.human], 'play');
      for (const e of ev) {
        // (auch Abpraller am Körper und Blocken zählen als Berührung)
        if (open && e.player != null && e.player !== open.from && ['touch', 'kick', 'control', 'catch', 'parry', 'tackle', 'body', 'block', 'air'].includes(e.type)) { // (n8: auch im selben Takt – ein Gegner, der sofort dagegen tritt)
          const pl = g.players[e.player];
          open.res = e.player === open.want ? 'gemeint' : e.player === open.to && open.want < 0 ? 'empfaenger' : pl.team === open.team ? 'mitspieler' : 'gegner';
          open.resT = g.t - open.t; open.resD = Math.hypot(b.p.x - open.x, b.p.z - open.z); open.resTyp = e.type + (e.kind ? ':' + e.kind : '') + (e.result ? ':' + e.result : ''); open.resWer = e.player;
          all.push(open); open = null;
        } else if (open && e.player === open.from && ['touch', 'kick', 'body', 'air'].includes(e.type) && g.t > open.t + 0.15) { open.res = 'selbst'; open.selbstT = g.t - open.t; open.selbstTyp = e.type + (e.kind ? ':' + e.kind : ''); open.selbstHuman = g.human === open.from; if (process.env.DBG && open.art === 'Mitspieler' && open.selbstHuman) console.log('selbst', JSON.stringify({ t: +g.t.toFixed(2), kt: +open.t.toFixed(2), to: open.to, hist: open.hist, evs: open.evs })); all.push(open); open = null; }
        if (open && (e.type === 'goal' || e.type === 'restart')) { open.res = 'tor/unterbrochen'; all.push(open); open = null; }
        if (!open && plan && e.type === 'kick' && e.player === plan.from && e.kind === 'pass') {
          const kp = g.players[e.player], lk = kp.lastKick || {};
          const sa = Math.atan2(plan.w[1], plan.w[0]), ka = Math.atan2(e.dz, e.dx);
          let mateAt = false; for (const m of g.players) if (m.team === kp.team && m.id !== kp.id && Math.hypot(m.x - e.x, m.z - e.z) < 18 && angDiff(Math.atan2(m.z - e.z, m.x - e.x), sa) < 30 / DEG) mateAt = true;
          // (Pass in den Laufweg eines Mitspielers, der dort ankommt: der Treffpunkt liegt in Abspielrichtung – Mitspieler „dort“)
          const vorhalt = e.to >= 0 && (!lk.bank || e.to === plan.want); // (Laufweg bzw. Bande zum gemeinten Mitspieler)
          const rc = e.to >= 0 ? g.players[e.to] : null;
          // Weg frei wie in pass_probe: kein Gegner ≤ 1,5 m an der Strecke Ball → gemeinter Mitspieler, der ≥ 1,5 m frei
          const wm = plan.want >= 0 ? g.players[plan.want] : null;
          let lane = 9, offen = 9, nah = 9;
          if (wm) for (const o of g.players) if (o.team !== kp.team) { lane = Math.min(lane, segD(o.x, o.z, e.x, e.z, wm.x, wm.z)); offen = Math.min(offen, Math.hypot(o.x - wm.x, o.z - wm.z)); }
          for (const o of g.players) if (o.team !== kp.team) nah = Math.min(nah, Math.hypot(o.x - e.x, o.z - e.z));
          const vor = rc && !lk.bank ? angDiff(ka, Math.atan2(rc.z - e.z, rc.x - e.x)) * DEG : null;
          // Lage der Gegner zur Abspielrichtung beim Abspiel: [id, längs (m), quer (m)]
          const ux = Math.cos(ka), uz = Math.sin(ka), opl = g.players.filter((o) => o.team !== kp.team).map((o) => [o.id, (o.x - e.x) * ux + (o.z - e.z) * uz, Math.abs(-(o.x - e.x) * uz + (o.z - e.z) * ux), o.slide ? 1 : 0]);
          open = { vorhalt, opl, frei: lane >= 1.5 && offen >= 1.5, gegnerNah: nah, x: e.x, z: e.z, tech: lk.tech, face: angDiff(ka, kp.face) * DEG, spd: lk.speed, ps: Math.hypot(kp.vx, kp.vz), t: g.t, from: e.player, team: kp.team, want: plan.want, to: e.to, bank: !!lk.bank, err: angDiff(ka, sa) * DEG, mateAt, vor, rv: rc ? Math.hypot(rc.vx, rc.vz) : null, art: e.to >= 0 ? (lk.bank ? 'Bande' : 'Mitspieler') : 'Freiraum', T: lk.T, dist: Math.hypot((lk.meet || [e.x])[0] - e.x, (lk.meet || [0, e.z])[1] - e.z) };
          plan = null;
        }
      }
      if (plan && !g.players[plan.from].pending && g.t - plan.t > 0.1 && g.human !== plan.from) plan = null; // (Steuerung schon weg)
      if (open && process.env.DBG && g.t - open.t < 0.05) { open.evs = (open.evs || []).concat(ev.filter((e) => e.player != null).map((e) => e.type + ':' + e.player)); }
      if (open && process.env.DBG) { open.hist = open.hist || []; const last = open.hist[open.hist.length - 1]; const st = `${g.human}/${g.passTo}/${g.passPlan ? g.passPlan.to : '-'}/${g.lastTouch}/${g.recvHold ? 'H' : ''}`; if (!last || last[1] !== st) open.hist.push([+(g.t - open.t).toFixed(2), st]); }
      if (open && g.t > open.t + 3) { open.res = 'niemand'; all.push(open); open = null; }
      if (plan && g.t - plan.t > 2) plan = null; // Tipp verfallen (Ball weg)
    }
  }
  return all;
}

const qq = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : NaN; };
export function auswerten(all) {
  const n = all.length, pct = (f) => (n ? 100 * all.filter(f).length / n : NaN);
  const zm = all.filter((r) => r.want >= 0);
  const pz = (f) => (zm.length ? 100 * zm.filter(f).length / zm.length : NaN);
  const errs = all.map((r) => r.err).sort((a, b) => a - b), q = (p) => errs[Math.min(errs.length - 1, Math.floor(errs.length * p))];
  return {
    n, nZiel: zm.length, nFrei: zm.filter((r) => r.frei).length, freiAn: zm.filter((r) => r.frei).length ? 100 * zm.filter((r) => r.frei && r.res === 'gemeint').length / zm.filter((r) => r.frei).length : NaN,
    ueber30ohneArt: all.filter((r) => r.err > 30 && !r.mateAt && !(r.vorhalt && r.to === r.want)).reduce((o, r) => (o[r.art] = (o[r.art] || 0) + 1, o), {}),
    gemeintAn: pz((r) => r.res === 'gemeint'), gemeintGegner: pz((r) => r.res === 'gegner'), gemeintNiemand: pz((r) => r.res === 'niemand'), gemeintAnderer: pz((r) => r.res === 'mitspieler'), gemeintSelbst: pz((r) => r.res === 'selbst'),
    // „ohne Mitspieler dort“: kein Mitspieler ±30° um den Stick, und der Pass ging auch nicht zum gemeinten (im Bild angezielten)
    // Mitspieler (Vorhalt in seinen Laufweg, Bande zu ihm, beim Tipp gemerkter Empfänger zählen als „dort“)
    ueber30ohne: pct((r) => r.err > 30 && !r.mateAt && !(r.vorhalt && r.to === r.want)), ueber30ohneStreng: pct((r) => r.err > 30 && !r.mateAt), ueber30: pct((r) => r.err > 30), err50: q(0.5), err90: q(0.9), err99: q(0.99),
    gegner: pct((r) => r.res === 'gegner'), niemand: pct((r) => r.res === 'niemand'),
    freiraum: pct((r) => r.art === 'Freiraum'), bande: pct((r) => r.art === 'Bande'),
    vor50: qq(all.filter((r) => r.vor != null).map((r) => r.vor), 0.5), vor90: qq(all.filter((r) => r.vor != null).map((r) => r.vor), 0.9),
    rv50: qq(all.filter((r) => r.rv != null).map((r) => r.rv), 0.5),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 8), qs = process.argv[3] || '', form = process.argv[4] || 'quer';
  const r = auswerten(spielPaesse(qs, G, form)), f = (x) => x.toFixed(1);
  console.log(`Pässe im Spiel „${qs || 'Standard'}“, ${form}, ${G} Spiele: ${r.n} Pässe (${r.nZiel} auf einen Mitspieler gezielt)`);
  console.log(`  gezielt, Weg frei beim Abspiel (${r.nFrei}): kommt an ${f(r.freiAn)} % · > 30° ohne Mitspieler je Art: ${JSON.stringify(r.ueber30ohneArt)}`);
  console.log(`  gezielt: kommt an ${f(r.gemeintAn)} %, Gegner ${f(r.gemeintGegner)} %, anderer Mitspieler ${f(r.gemeintAnderer)} %, niemand ${f(r.gemeintNiemand)} %, selbst ${f(r.gemeintSelbst)} %`);
  console.log(`  Stick ↔ Abspielrichtung p50/p90/p99 ${f(r.err50)}°/${f(r.err90)}°/${f(r.err99)}° · > 30° daneben ${f(r.ueber30)} %, davon ohne Mitspieler dort ${f(r.ueber30ohne)} % aller Pässe (streng, auch Vorhalt zum Mitspieler: ${f(r.ueber30ohneStreng)} %)`);
  console.log(`  alle: zum Gegner ${f(r.gegner)} %, ins Leere ${f(r.niemand)} % · Freiraum-Pässe ${f(r.freiraum)} %, Bande ${f(r.bande)} %`);
  console.log(`  Vorhalt (Abspielrichtung ↔ Empfänger jetzt) p50/p90 ${f(r.vor50)}°/${f(r.vor90)}°, Empfänger-Tempo beim Abspiel p50 ${f(r.rv50)} m/s`);
}
