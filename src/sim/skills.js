// n15 E4 (Peter 14.11.2026: „top 10 skill moves aus fifa 26 einbauen zB marseille roulette, die werden random ausgelöst um tackles
// auszuweichen“): zehn bekannte Ausweich-Tricks aus EA SPORTS FC 26 (Liste nach gamesradar.com „FC 26 skill moves guide“, redbull.com
// „EA FC 26 skillmoves tricks guide“, operationsports.com „The best skill moves in FC 26“ – Elastico, Ball Roll, Heel to Heel, McGeady,
// Rainbow, Roulette, Stepover, La Croqueta, Bridge, Drag Back/Berba). Ohne DOM, geprüft in tests/node/n15.test.mjs.
//
// Auslösung ohne Knopf: der Ballführende (Mensch und Bots, Bots seltener) wird angegriffen – ein Gegner grätscht auf ihn zu (≤ 3 m) oder steht
// ≤ 1,5 m frontal vor ihm und kommt näher. Je Lage gewichtet zufällig gewählt (Grätsche: Regenbogen/Hacke-Hacke/Croqueta/Tunnel, frontal:
// Übersteiger/Elastico/Roulette/McGeady/Sohlenroller/Zieher). Gelingt er (Chance skillQuote bzw. je Bot-Stufe 40/50/60 %), weicht der Spieler
// seitlich aus, der Ball bleibt am Fuß (folgt dem Fuß), die Grätsche geht ins Leere bzw. der Gegner ist kurz ausgespielt. Misslingt er, läuft der
// Zweikampf normal weiter.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// dur = Dauer (s), seit = seitlicher Ausweich-Anteil, vor = nach vorn, hoch = Ball wird gelupft (Regenbogen), dreh = Körperdrehung (Roulette, McGeady)
export const SKILLS = {
  roulette: { name: 'Marseille-Roulette', dur: 0.55, seit: 0.9, vor: 0.3, dreh: 1, gegen: ['frontal'] },
  elastico: { name: 'Elastico', dur: 0.35, seit: 1.0, vor: 0.4, gegen: ['frontal'] },
  regenbogen: { name: 'Regenbogen', dur: 0.55, seit: 0.1, vor: 1.0, hoch: true, gegen: ['graetsche', 'frontal'] },
  hackehacke: { name: 'Hacke-Hacke', dur: 0.35, seit: 0.4, vor: 1.0, gegen: ['graetsche'] },
  mcgeady: { name: 'McGeady-Drehung', dur: 0.45, seit: 1.0, vor: -0.2, dreh: 0.5, gegen: ['frontal'] },
  sohle: { name: 'Sohlenroller', dur: 0.45, seit: 1.0, vor: 0.1, gegen: ['frontal', 'graetsche'] },
  uebersteiger: { name: 'Übersteiger', dur: 0.4, seit: 0.8, vor: 0.5, gegen: ['frontal'] },
  tunnel: { name: 'Tunnel', dur: 0.4, seit: 0.5, vor: 0.9, gegen: ['frontal', 'graetsche'] },
  croqueta: { name: 'La Croqueta', dur: 0.3, seit: 1.0, vor: 0.3, gegen: ['graetsche', 'frontal'] },
  zieher: { name: 'Zieher mit Drehung', dur: 0.45, seit: 0.7, vor: -0.4, dreh: 0.5, gegen: ['frontal'] },
};
export const SKILL_KEYS = Object.keys(SKILLS);

// n16 (Peter 18.11.: „Bandenkick fehlen mir die Dribbeltricks“): freie Dribbeltricks ohne Gegnerdruck – bei der Ballannahme bzw. sobald ein
// Gegner ≤ dribbelNah m ist, höchstens einer je Ballbesitz (Mensch: Chance dribbelMensch × dribbel, Bots: dribbelBot × dribbel). Der Spieler
// läuft normal weiter (Stick, Tempo), nur der Ball folgt dem Fuß nach einer Choreografie (seitlich lat m, vor/zurück vor m über u = 0 … 1),
// dazu die Pose (avatars.js) und bei Roulette/McGeady eine Drehung nur im Bild (yaw). Gelingt immer (kein Gegner im Zweikampf), kostet kein
// Tempo; der Kick-Knopf bricht sofort ab (Player.step). Dauer dur s (0,45 … 0,8).
const glatt = (u) => u * u * (3 - 2 * u);
export const FREI = {
  uebersteiger: { dur: 0.55, ball: (u) => [0.12 * Math.sin(Math.PI * u), 0], yaw: (u) => 0.5 * Math.sin(Math.PI * u) },
  croqueta: { dur: 0.45, ball: (u) => [0.36 * (2 * glatt(u) - 1), 0] },
  elastico: { dur: 0.5, ball: (u) => [u < 0.55 ? 0.42 * Math.sin(0.5 * Math.PI * u / 0.55) : 0.42 - 0.8 * glatt((u - 0.55) / 0.45), 0] },
  sohle: { name: 'Ball Roll', dur: 0.6, ball: (u) => [0.55 * Math.sin(Math.PI * u), -0.15 * Math.sin(Math.PI * u)] },
  hackehacke: { name: 'Heel-to-Heel', dur: 0.5, ball: (u) => [0.1 * Math.sin(2 * Math.PI * u), -0.75 * Math.sin(Math.PI * Math.min(1, u * 1.25))] },
  roulette: { dur: 0.75, ball: (u) => [0.38 * Math.sin(2 * Math.PI * u), -0.45 * (1 - Math.cos(2 * Math.PI * u)) / 2], yaw: (u) => 2 * Math.PI * glatt(u) },
  mcgeady: { dur: 0.6, ball: (u) => [0.4 * Math.sin(Math.PI * u), -0.2 * Math.sin(Math.PI * u)], yaw: (u) => Math.PI * Math.sin(Math.PI * u) },
};
export const FREI_KEYS = Object.keys(FREI);

// Erfolgsquote: Mensch skillQuote, Bots je Stufe (Können L.skill 1 / 1,15 / 1,5 → 40 / 50 / 60 %)
function quote(game, pl) {
  const P = game.P;
  if (game.human === pl.id) return P.skillQuote;
  const L = game.bots && game.bots.L ? game.bots.L[pl.team] : null, sk = L ? L.skill : 1.15;
  return sk >= 1.4 ? 0.6 : sk >= 1.1 ? 0.5 : 0.4;
}

// Droht ein Angriff? → { o, art: 'graetsche'|'frontal' } | null
export function bedrohung(game, pl) {
  const b = game.ball;
  for (const o of game.players) {
    if (o.team === pl.team || o.hand.mode !== 'none' || o.fall) continue;
    const dx = pl.x - o.x, dz = pl.z - o.z, d = Math.hypot(dx, dz);
    if (o.slide && o.slide.phase === 'slide' && !o.slide.done && o.slide.t < 0.3 && d < 3 && (o.slide.dx * dx + o.slide.dz * dz) / (d || 1) > 0.6) return { o, art: 'graetsche' };
    if (d < 1.5 && !o.slide) {
      const fx = Math.cos(pl.face), fz = Math.sin(pl.face), vor = (-dx * fx - dz * fz) / (d || 1); // Gegner vor mir?
      const naeher = ((o.vx - pl.vx) * dx + (o.vz - pl.vz) * dz) / (d || 1);
      if (vor > 0.5 && naeher > 0.4 && Math.hypot(b.p.x - o.x, b.p.z - o.z) < 1.6) return { o, art: 'frontal' };
    }
  }
  return null;
}

// je Takt für den Ballführenden: Skill-Move starten? (startet höchstens einmal je skillPause s)
export function skillCheck(game, pl) {
  const P = game.P, b = game.ball;
  if (!P.skills || !game.match || game.challenge || pl.skill2 || pl.air || pl.fall || pl.slide || pl.hand.mode !== 'none' || pl.stumbleT > 0) return false;
  if (game.lastTouch !== pl.id || b.held >= 0 || b.p.y > 0.35 || game.t < (pl.skillNext || 0)) return false;
  const [fx, fz] = pl.footPoint();
  if (Math.hypot(b.p.x - fx, b.p.z - fz) > 1.0) return false;
  if (pl.pending && game.human === pl.id) return false; // Peter hat Kick gedrückt: der Kick hat Vorrang
  let th = bedrohung(game, pl);
  if (!th && P.dribbel > 0 && dribbelFrei(game, pl)) return true; // n16: freier Dribbeltrick
  if (!th && P.chaos) { // Chaos-Modus (Peter 20.11.): alle 3 s am Ball ein zufälliger Trick, auch ohne Gegner [?chaos=0 = aus]
    const fx2 = Math.cos(pl.face), fz2 = Math.sin(pl.face);
    th = { o: { id: -1, x: pl.x + fx2 * 2, z: pl.z + fz2 * 2, stumbleT: 0, slide: null }, art: "frontal", chaos: true };
  }
  if (!th) return false;
  if (th.chaos) {
    pl.skillNext = game.t + P.chaos;
    const r = game.rng, id = SKILL_KEYS[Math.floor(r.next() * SKILL_KEYS.length) % SKILL_KEYS.length];
    starte(game, pl, id, th, true);
    return true;
  }
  pl.skillNext = game.t + P.skillPause;
  const r = game.rng;
  if (r.next() > (game.human === pl.id ? P.skillChance : P.skillBot)) return false;
  const pool = SKILL_KEYS.filter((k) => SKILLS[k].gegen.includes(th.art));
  const id = pool[Math.floor(r.next() * pool.length) % pool.length];
  const ok = r.next() < quote(game, pl);
  starte(game, pl, id, th, ok);
  return true;
}

// n16: einmal je Ballbesitz würfeln (pl.besitzT setzt rules.touch, wenn der Ball von einem anderen kommt); Auslösung bei der Annahme
// (Ball ≤ dribbelAnnahme s am Fuß) oder sobald ein Gegner ≤ dribbelNah m ist
function dribbelFrei(game, pl) {
  const P = game.P, mensch = game.human === pl.id;
  if (pl.dribbelEp === pl.besitzT) return false;
  // nur mit dem Ball unter Kontrolle: nicht gleich nach dem eigenen Kick (der Ball fliegt noch am Fuß vorbei) und nicht, solange er schnell ist
  const b = game.ball;
  if (game.t - ((pl.lastKick && pl.lastKick.t) ?? -9) < 0.4 || Math.hypot(b.v.x - pl.vx, b.v.z - pl.vz) > 3) return false;
  const tb = game.t - (pl.besitzT ?? -99);
  let nah = 99;
  for (const o of game.players) if (o.team !== pl.team && o.hand.mode === 'none') nah = Math.min(nah, Math.hypot(o.x - pl.x, o.z - pl.z));
  if (tb > P.dribbelAnnahme && nah > P.dribbelNah) return false;
  if (game.match && Math.hypot(game.rules.goalX(1 - pl.team) - pl.x, pl.z) < P.dribbelTorD) return false; // in Schussnähe: abschließen statt Trick
  pl.dribbelEp = pl.besitzT; // (je Ballbesitz nur ein Wurf)
  const r = game.rng;
  if (r.next() >= Math.min(1, (mensch ? P.dribbelMensch : P.dribbelBot) * P.dribbel)) return false;
  if (nah < P.dribbelFrei) return false; // Gegner schon (fast) im Zweikampf: dafür sind die Ausweich-Tricks da
  const id = FREI[globalThis.BK_TRICK_NUR] ? globalThis.BK_TRICK_NUR : FREI_KEYS[Math.floor(r.next() * FREI_KEYS.length) % FREI_KEYS.length], F = FREI[id]; // (BK_TRICK_NUR: Tests/Fotos)
  const quer = r.next() < 0.5 ? -1 : 1;
  pl.skill2 = { id, t: 0, dur: F.dur, ok: true, frei: true, seite: quer, yaw: 0 };
  pl.skillDur = F.dur; pl.tech = 'skill_' + id; pl.techT = 0;
  game.events.push({ type: 'skill', id, name: F.name || SKILLS[id].name, ok: true, frei: true, player: pl.id, human: mensch, gegner: -1, art: 'frei', dur: F.dur });
  return true;
}

// n16: Takt des freien Tricks nach der normalen Bewegung (Player.step): Ball folgt dem Fuß nach der Choreografie, der Spieler berührt ihn
// sonst nicht (touchCd). Gibt false zurück, wenn der Trick endet oder der Ball weg ist.
export function freiStep(pl, dt, game) {
  const s = pl.skill2, b = game.ball, P = game.P, F = FREI[s.id];
  s.t += dt;
  const u = clamp(s.t / s.dur, 0, 1);
  if (game.lastTouch !== pl.id || b.held >= 0 || b.p.y > 0.5 || Math.hypot(b.p.x - pl.x, b.p.z - pl.z) > 1.6) { pl.skill2 = null; return false; }
  // Gegner kommt heran (≤ dribbelAbbruch m) → Trick abbrechen, normal abschirmen bzw. Ausweich-Trick (ohne Druck kein Ballverlust durch den Trick)
  for (const o of game.players) if (o.team !== pl.team && o.hand.mode === 'none' && Math.hypot(o.x - pl.x, o.z - pl.z) < P.dribbelAbbruch) { pl.skill2 = null; pl.touchCd = 0; return false; }
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face), qx = -fz * s.seite, qz = fx * s.seite;
  const [lat, vor] = F.ball(u);
  const a = P.footAhead * 0.8 + vor;
  const tx = pl.x + fx * a + qx * lat + pl.vx * 0.1, tz = pl.z + fz * a + qz * lat + pl.vz * 0.1;
  b.v.x = pl.vx + (tx - b.p.x) / 0.07; b.v.z = pl.vz + (tz - b.p.z) / 0.07;
  if (b.p.y < b.r + 0.02 && b.v.y > 0) b.v.y = 0;
  b.w.set(b.v.z / b.r, 0, -b.v.x / b.r);
  pl.lastTouchT = game.t; pl.touchCd = Math.max(pl.touchCd, 0.05); pl.bodyOffT = Math.max(pl.bodyOffT, 0.05);
  s.yaw = F.yaw ? s.seite * F.yaw(u) : 0;
  if (s.t >= s.dur) { pl.skill2 = null; pl.touchCd = 0; return false; }
  return true;
}

function starte(game, pl, id, th, ok) {
  const S = SKILLS[id], o = th.o, b = game.ball;
  // Ausweichrichtung: quer zur Richtung Gegner → ich, zur Seite weg vom Gegner (bzw. zur Feldmitte an der Bande), dazu vorn
  let ax = pl.x - o.x, az = pl.z - o.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  const fx = Math.cos(pl.face), fz = Math.sin(pl.face);
  let qx = -fz, qz = fx;
  const seite = (o.x - pl.x) * qx + (o.z - pl.z) * qz > 0 ? -1 : 1; // weg vom Gegner
  qx *= seite; qz *= seite;
  if (Math.abs(pl.z + qz * 1.5) > game.cage.hz - 0.6) { qx = -qx; qz = -qz; }
  let dx = qx * S.seit + fx * S.vor, dz = qz * S.seit + fz * S.vor; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  pl.skillDur = S.dur;
  pl.skill2 = { id, t: 0, dur: S.dur, ok, dx, dz, v: Math.max(3.2, pl.speed * 0.8), dreh: S.dreh || 0, gegner: o.id, seite };
  pl.tech = 'skill_' + id; pl.techT = 0;
  if (ok) {
    if (o.slide) o.slide.done = true;                           // die Grätsche geht ins Leere
    else o.stumbleT = Math.max(o.stumbleT, 0.45);              // ausgespielt: kurz falsch gestanden
    if (S.hoch) { b.v.set(dx * pl.skill2.v, 4.2, dz * pl.skill2.v); b.w.set(0, 0, 0); b.contact = false; } // Regenbogen: über den Gegner
  }
  // (misslungen: nur die Bewegung angedeutet – der Spieler führt normal weiter, der Zweikampf läuft wie ohne Trick)
  if (!ok) pl.skill2 = null;
  game.events.push({ type: 'skill', id, name: S.name, ok, player: pl.id, human: game.human === pl.id, gegner: o.id, art: th.art });
}

// je Takt während des Skill-Moves: Ausweichbewegung, Ball folgt dem Fuß (bei Erfolg). Gibt true zurück, solange er läuft.
export function skillStep(pl, dt, game) {
  const s = pl.skill2, b = game.ball, P = game.P;
  s.t += dt;
  const u = clamp(s.t / s.dur, 0, 1);
  // Tempo: erst kurz verzögern (Täuschung), dann seitlich raus
  const k = s.ok ? (u < 0.35 ? 0.45 : 1.15) : 0.6;
  pl.vx = s.dx * s.v * k; pl.vz = s.dz * s.v * k;
  pl.x += pl.vx * dt; pl.z += pl.vz * dt;
  const lx = game.cage.hx - P.bodyR, lz = game.cage.hz - P.bodyR;
  pl.x = clamp(pl.x, -lx, lx); pl.z = clamp(pl.z, -lz, lz);
  pl.speed = Math.hypot(pl.vx, pl.vz);
  if (pl.speed > 0.1) { pl.hx = pl.vx / pl.speed; pl.hz = pl.vz / pl.speed; }
  // Blick: Drehung (Roulette einmal ganz herum) bzw. in Laufrichtung
  const ziel = Math.atan2(s.dz, s.dx) + (s.dreh ? s.seite * s.dreh * 2 * Math.PI * u : 0);
  pl.face = s.dreh ? ziel : pl.face + clamp(((ziel - pl.face + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, -P.turnCap * dt, P.turnCap * dt);
  pl.gait += pl.speed * dt / 1.1;
  // Ball am Fuß: weiche Führung zum (Schwung-)Fuß, nicht beim gelupften Regenbogen in der Luft
  if (s.ok && b.held < 0 && game.lastTouch === pl.id && b.p.y < 0.4) {
    const fx = pl.x + Math.cos(pl.face) * P.footAhead * 0.8 + pl.vx * 0.12, fz = pl.z + Math.sin(pl.face) * P.footAhead * 0.8 + pl.vz * 0.12;
    b.v.x = pl.vx + (fx - b.p.x) / 0.08; b.v.z = pl.vz + (fz - b.p.z) / 0.08;
    b.w.set(b.v.z / b.r, 0, -b.v.x / b.r);
    pl.lastTouchT = game.t;
  }
  if (s.t >= s.dur) { pl.skill2 = null; pl.techT = 99; return false; }
  return true;
}
