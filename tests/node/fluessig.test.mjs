// n5 Flüssige Figuren und ruckelfreie Wiederholung (Peter: „Figurenbewegungen sehr abgehackt, Replays sehr janky“).
// Figuren an den echten Rocketbox-Skeletten (ohne Browser): Summe der Clip-Gewichte bleibt 1, große Pose-Sprünge in
// typischen Abläufen (Antritt/Stopp, Jubel-Ende, Tormann Hocke/Hechtsprung/Aufstehen, Dribbel-Kontakte, Technik-Wechsel)
// gegenüber n4 (?glatt=0). Wiederholung an 6 echten Bot-Toren: Kamera-Ruck (zweite Ableitung von Lage und Blickrichtung,
// Schnitte ausgenommen), Tempo-Sprünge, kürzester Abschnitt, Länge. Aufruf: node tests/node/fluessig.test.mjs
import { report } from './report.mjs';
import { makeParams } from '../../src/sim/params.js';
import { Game, DT } from '../../src/sim/step.js';
import { ReplayRecorder, ReplayDirector, ReplayKamera } from '../../src/sim/replay.js';
const { A, Avatar, spieler, spiele, ruck, spruenge } = await import('./fluessig_kern.mjs');

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const GROSS = 8; // cm/Bild² bei 60 Hz: deutlich sichtbares Schnappen (wie tests/ruckel.py)

// ---------------- Figuren ----------------
const dive = (t, T = 0.38) => ({ mode: t < T ? 'dive' : 'ground', dx: 0, dz: 1, t: t < T ? t : t - T, T });
const ABLAEUFE = {
  // Bot: Antritt auf Sprint, Vollbremsung, wieder los (Tempo springt je Takt)
  antritt_stopp: (i) => { const v = i < 30 ? 0 : i < 90 ? 7 : i < 120 ? 0 : 4; return [spieler({ speed: v, vx: v }), {}]; },
  // Jubel endet (Anstoß) und Jubel → Klatschen
  jubel_ende: (i) => [spieler(), { special: i < 60 ? 'cheer' : i < 100 ? 'clap' : null }],
  // Tormann: bereit (Hocke), läuft los, bleibt stehen
  tormann_hocke: (i) => { const v = i < 40 ? 0 : i < 70 ? 1.5 : 0; return [spieler({ speed: v, vx: v }), { keeper: true, ready: v < 0.5 }]; },
  // Hechtsprung, liegen, aufstehen und dabei drehen (Seite der Rolle kippte vorher)
  hechten_aufstehen: (i) => { const t = (i - 10) / 60; const h = i < 10 ? { mode: 'none', dx: 0, dz: 0, t: 0, T: 0.38 } : t < 1.0 ? dive(t) : { mode: 'none', dx: 0, dz: 0, t: 0, T: 0.38 }; return [spieler({ hand: h, face: i < 70 ? 0 : (i - 70) * 0.08, speed: i > 70 ? 1.5 : 0, vx: i > 70 ? 1.5 : 0 }), { keeper: true }]; },
  // Dribbeln: Kontakt alle 0,35 s im Lauf, Ball 0,7 m voraus
  dribbeln: (i) => { const kt = (i % 21) / 60; return [spieler({ speed: 5, vx: 5, kickT: kt, techT: 9 }), { ball: [0.75, 0.11, 0.1] }]; },
  // Volley in der Luft, dann Kontakt (Technik-Pose wechselt), dann zweiter Schuss
  technik_wechsel: (i) => {
    const t = i / 60;
    if (i < 30) return [spieler({ speed: 2, vx: 2, air: { go: true, tech: 'volley', t0: 0, tc: 0.5, cy: 0.8 }, jumpY: 0.1 }), { t }];
    if (i < 60) { const k = (i - 30) / 60; return [spieler({ speed: 2, vx: 2, kickT: k, techT: k, tech: 'volley' }), { t }]; }
    const k = (i - 60) / 60; return [spieler({ speed: 2, vx: 2, kickT: k, techT: k, tech: 'innen' }), { t }];
  },
  // Stemmschritt mit Richtungsumkehr (Tempo geht durch 0)
  stemmschritt: (i) => { const vx = 5 - i * 0.12; return [spieler({ speed: Math.abs(vx), vx, plant: i > 5 && i < 80 ? 1 : 0 }), {}]; },
};
const erg = {};
for (const [glatt, traeg] of [[false, true], [true, true], [true, false]]) { // n4, n5 mit Sicherheitsnetz (?traeg=1), n5 wie im Spiel
  let wsMin = 9, gross = 0, maxR = 0, staerke = 0; const je = {};
  for (const name of ['Sports_Male_02', 'Sports_Female_02']) {
    for (const [ab, fn] of Object.entries(ABLAEUFE)) {
      const av = new Avatar(A, name, 0, { shadows: false, cull: false, glatt, traeg });
      av.phase = 0;
      const r = spiele(av, 160, fn);
      wsMin = Math.min(wsMin, ...r.wsum.slice(1));
      const R = ruck(r);
      const sp = spruenge(R, r.tempo, 2, GROSS), g = sp.filter((x) => x.gross).length;
      for (const x of sp) { maxR = Math.max(maxR, x.m); if (x.gross) staerke += x.m; }
      gross += g; je[ab] = (je[ab] || 0) + g;
    }
  }
  erg[!glatt ? 'alt' : traeg ? 'mitNetz' : 'neu'] = { wsMin, gross, maxR, je, staerke };
}
const { alt, neu, mitNetz } = erg;
check('Figuren n5 mit Sicherheitsnetz (?traeg=1): Stärke der großen Sprünge (Info)', mitNetz.staerke, -Infinity, Infinity, 'cm', Object.entries(mitNetz.je).map(([k, v]) => `${k} ${v}`).join(', ') + `; größter Sprung ${mitNetz.maxR.toFixed(1)} cm`);
check('Figuren n4 (?glatt=0): kleinste Summe der Clip-Gewichte (Info)', alt.wsMin, -Infinity, Infinity, '', 'unter 1 = Figur zieht Richtung Ruhepose');
check('Figuren: Summe der Clip-Gewichte bleibt 1 (kleinste)', neu.wsMin, 0.999, 1.001);
check('Figuren n4: große Pose-Sprünge (Spitze über der Lauf-Hülle und > 8 cm/Bild²) in 7 Abläufen × 2 Figuren (Info)', alt.gross, -Infinity, Infinity, '', Object.entries(alt.je).map(([k, v]) => `${k} ${v}`).join(', '));
check('Figuren: große Pose-Sprünge, Anzahl (Info – Grenzfälle knapp über 8 cm zählen voll)', neu.gross, -Infinity, Infinity, '', Object.entries(neu.je).map(([k, v]) => `${k} ${v}`).join(', '));
check('Figuren: Stärke der großen Sprünge (Summe cm/Bild²) −60 % gegenüber n4', neu.staerke, 0, alt.staerke * 0.4, 'cm', `n4 ${alt.staerke.toFixed(0)} cm`);
check('Figuren: größter Sprung (cm/Bild²) −50 % gegenüber n4', neu.maxR, 0, alt.maxR * 0.5, 'cm', `n4 ${alt.maxR.toFixed(1)} cm`);

// ---------------- Wiederholung ----------------
const P = makeParams('');
function untilGoal(seed) {
  const g = new Game(P, seed, { match: true, human: -1, botLevels: [2, 2] });
  const rec = new ReplayRecorder(g.players.length);
  let goal = null;
  while (!goal && g.t < 600) { const ev = g.step([]); rec.record(g, ev); for (const e of ev) if (e.type === 'goal') goal = { ...e, t: g.t - DT }; }
  for (let i = 0; i < 1 / DT && goal; i++) rec.record(g, g.step([]));
  return { g, rec, goal };
}
const d2 = (a, b, c) => Math.hypot(c[0] - 2 * b[0] + a[0], c[1] - 2 * b[1] + a[1], c[2] - 2 * b[2] + a[2]);
const kam = { alt: { lage: 0, blick: 0, summe: 0, tempo: 0, kurz: 9, lang: 0, bilder: 0 }, neu: { lage: 0, blick: 0, summe: 0, tempo: 0, kurz: 9, lang: 0, bilder: 0 } };
let tore = 0;
for (const seed of [3, 7, 11, 19, 23, 31]) {
  const { g, rec, goal } = untilGoal(seed);
  if (!goal) continue;
  tore++;
  for (const regie of [false, true]) {
    const K = kam[regie ? 'neu' : 'alt'];
    const D = new ReplayDirector(rec, goal, { regie }), C = new ReplayKamera(rec, regie);
    const c = D.contact;
    let side = 1;
    if (c) { const dl = Math.hypot(c.dx, c.dz) || 1, nx = -c.dz / dl, nz = c.dx / dl; side = nx * -c.x + nz * -c.z >= 0 ? 1 : -1; }
    const ctx = { cage: g.cage, mode: seed % 2 ? 'hoch' : 'quer', contact: c, goal: { side: goal.side }, time: 0, frac: 0, side };
    const P3 = [], L3 = [], cut = [], rate = [], segReal = {}, art = [];
    const out = {};
    let frames = 0, tPrev = D.t;
    while (!D.done && frames < 2000) {
      const seg = D.cur.name;
      const t = D.update(1 / 60);
      if (D.done) break;
      const f = rec.frameAt(t, out, P);
      ctx.time = D.real; ctx.frac = D.segFrac();
      const cm = C.bild(D.cur.cam, f, ctx, 1 / 60, (t - tPrev) * 60);
      // Ball im Bild: Winkel zwischen Blickrichtung und Richtung zum (echten) Ball
      const bx = f.ball.p.x - cm.pos[0], by = f.ball.p.y - cm.pos[1], bz = f.ball.p.z - cm.pos[2], bl = Math.hypot(bx, by, bz) || 1;
      const lx = cm.look[0] - cm.pos[0], ly = cm.look[1] - cm.pos[1], lz = cm.look[2] - cm.pos[2], ll = Math.hypot(lx, ly, lz) || 1;
      K.ballWinkel = Math.max(K.ballWinkel || 0, Math.acos(Math.min(1, (bx * lx + by * ly + bz * lz) / bl / ll)) * 180 / Math.PI);
      const dl = Math.hypot(cm.look[0] - cm.pos[0], cm.look[1] - cm.pos[1], cm.look[2] - cm.pos[2]) || 1;
      P3.push(cm.pos.map((x) => x * 100)); L3.push([0, 1, 2].map((k) => (cm.look[k] - cm.pos[k]) / dl * 180 / Math.PI)); cut.push(cm.schnitt);
      rate.push((t - tPrev) * 60); tPrev = t; art.push(D.cur.cam);
      segReal[seg] = (segReal[seg] || 0) + 1 / 60;
      frames++;
    }
    for (let i = 1; i < P3.length - 1; i++) {
      if (cut[i - 1] || cut[i] || cut[i + 1] || i < 2) continue;
      const a = d2(P3[i - 1], P3[i], P3[i + 1]), b = d2(L3[i - 1], L3[i], L3[i + 1]);
      if (a > 1) K.lage++; if (b > 0.25) K.blick++; K.summe += a + 10 * b; K.je = K.je || {}; K.je[art[i]] = (K.je[art[i]] || 0) + a + 10 * b;
    }
    for (let i = 1; i < rate.length; i++) if (Math.abs(rate[i] - rate[i - 1]) > 0.15) K.tempo++;
    K.kurz = Math.min(K.kurz, ...Object.values(segReal)); K.lang = Math.max(K.lang, D.realTotal); K.bilder += frames;
  }
}
const ka = kam.alt, kn = kam.neu;
check('Wiederholung: Tore untersucht', tore, 5, 99);
check('Kamera Nacht 2d (?rcam=alt): Ruck-Summe Lage + 10×Blick (Info)', ka.summe, -Infinity, Infinity, '', `Lage-Ausreißer ${ka.lage}, Blick-Ausreißer ${ka.blick}, ${ka.bilder} Bilder`);
check('Kamera: Ruck-Summe −80 % gegenüber Nacht 2d', kn.summe, 0, ka.summe * 0.2, '', `Lage-Ausreißer ${kn.lage}, Blick-Ausreißer ${kn.blick}; je Kamera ${Object.entries(kn.je).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')} (Nacht 2d ${Object.entries(ka.je).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')})`);
check('Kamera: Ausreißer (Lage > 1 cm, Blick > 0,25° je Bild²) −80 %', kn.lage + kn.blick, 0, Math.floor((ka.lage + ka.blick) * 0.2), '', `Nacht 2d ${ka.lage + ka.blick}`);
check('Tempo: Sprünge > 0,15 je Bild (Nacht 2d, Info)', ka.tempo, -Infinity, Infinity);
check('Tempo: keine Sprünge mehr (Rampen)', kn.tempo, 0, 0);
check('Abschnitte: kürzester ≥ 0,4 s Echtzeit (kein Schnitt-Gewitter)', kn.kurz, 0.4, 99, 's', `Nacht 2d ${ka.kurz.toFixed(2)} s`);
check('Kamera: Ball bleibt im Bild (größter Winkel Blick → Ball, Nacht 2d zum Vergleich)', kn.ballWinkel, 0, Math.max(25, ka.ballWinkel * 1.1), '°', `Nacht 2d ${ka.ballWinkel.toFixed(1)}°`);
check('Wiederholung höchstens 7 s', kn.lang, 2, 7.05, 's', `Nacht 2d ${ka.lang.toFixed(2)} s`);

process.exit(report('Flüssig (n5): Figuren und Wiederholung', rows, 'fluessig') ? 0 : 1);
