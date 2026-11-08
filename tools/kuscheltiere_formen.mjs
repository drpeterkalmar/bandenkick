// n9 Kuscheltiere: Formen, Farben und Nähte der sechs Stofftiere (eigene Arbeit, MIT). Reine Rechnung ohne three.js –
// tools/build_kuscheltiere.mjs baut daraus die Figuren. Jede Form ist ein Abstandsfeld (SDF, negativ = innen) aus weichen
// Grundkörpern (Ellipsoide, Kegel mit runden Enden), je Körperteil ein eigenes Stück („Familie“) wie bei einem genähten
// Stofftier: Rumpf, Kopf, Arme, Beine, Ohren, Schwanz, Knopfaugen, Nase, gestickter Mund. Alle Maße hängen an den
// Gelenken des Rocketbox-Skeletts (Bip01) der jeweiligen Vorlage – die Bewegungen passen deshalb ohne neue Animationen.
// Koordinaten: glTF-Welt in Metern, y oben, Figur blickt nach +z, +x = linke Körperseite.

// ---------------------------------------------------------------- Vektoren
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (len(a) || 1));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Rahmen aus einer Hauptachse w (dünne bzw. lange Achse) und einer Hilfsrichtung
export function rahmen(w, hilf = [0, 1, 0]) {
  w = norm(w); let u = cross(hilf, w); if (len(u) < 1e-4) u = cross([1, 0, 0], w); u = norm(u);
  return [u, cross(w, u), w];
}
export function hex(h) { // sRGB-Hex → linear (glTF-Farben sind linear)
  const c = [(h >> 16) & 255, (h >> 8) & 255, h & 255].map((v) => v / 255);
  return c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
}

// ---------------------------------------------------------------- Abstandsfelder
// SDF = { f(x, y, z) → Abstand, bb: [min, max] }
const bbPunkt = (c, r) => [[c[0] - r, c[1] - r, c[2] - r], [c[0] + r, c[1] + r, c[2] + r]];
const bbVer = (a, b) => [a[0].map((v, i) => Math.min(v, b[0][i])), a[1].map((v, i) => Math.max(v, b[1][i]))];
export function kugel(c, r) { return { f: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, bb: bbPunkt(c, r) }; }
// Ellipsoid mit Halbachsen r längs eines Rahmens [u, v, w] (Standard: Weltachsen); Näherung nach Quílez
export function ell(c, r, R = null) {
  const [u, v, w] = R || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return {
    f: (x, y, z) => {
      const dx = x - c[0], dy = y - c[1], dz = z - c[2];
      const a = (dx * u[0] + dy * u[1] + dz * u[2]) / r[0], b = (dx * v[0] + dy * v[1] + dz * v[2]) / r[1], d = (dx * w[0] + dy * w[1] + dz * w[2]) / r[2];
      const k0 = Math.hypot(a, b, d), k1 = Math.hypot(a / r[0], b / r[1], d / r[2]);
      return k1 < 1e-9 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
    },
    bb: bbPunkt(c, Math.max(...r)),
  };
}
// Kegel mit runden Enden von a (Radius ra) nach b (Radius rb), Quílez „sdRoundCone“
export function kegel(a, b, ra, rb) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  return {
    f: (x, y, z) => {
      const pa0 = x - a[0], pa1 = y - a[1], pa2 = z - a[2];
      const yy = pa0 * ba[0] + pa1 * ba[1] + pa2 * ba[2], zz = yy - l2;
      const q0 = pa0 * l2 - ba[0] * yy, q1 = pa1 * l2 - ba[1] * yy, q2 = pa2 * l2 - ba[2] * yy;
      const x2 = q0 * q0 + q1 * q1 + q2 * q2, y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
    },
    bb: bbVer(bbPunkt(a, ra), bbPunkt(b, rb)),
  };
}
// Kette aus Punkten mit Radien (Arme, Beine, Schwanz, Rüssel)
export function kette(pts, rs, k = 0) { return vereint(k, ...pts.slice(1).map((p, i) => kegel(pts[i], p, rs[i], rs[i + 1]))); }
// flach gedrückter Kegel (Ohren): Abstand in einem Rahmen gestaucht – dick = Dicke-Faktor quer zur Fläche
export function flach(sdf, mitte, normale, dick) {
  const n = norm(normale);
  return {
    f: (x, y, z) => {
      const dx = x - mitte[0], dy = y - mitte[1], dz = z - mitte[2], t = dx * n[0] + dy * n[1] + dz * n[2], s = t * (1 / dick - 1);
      return sdf.f(x + n[0] * s, y + n[1] * s, z + n[2] * s) * Math.min(1, dick * 1.6);
    },
    bb: sdf.bb,
  };
}
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
export function vereint(k, ...s) {
  const fs = s.map((q) => q.f);
  return { f: (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k); return d; }, bb: s.map((q) => q.bb).reduce(bbVer) };
}
export function ohne(a, b, k = 0) { return { f: (x, y, z) => -smin(-a.f(x, y, z), b.f(x, y, z), k), bb: a.bb }; }
export function schnitt(a, b, k = 0) { return { f: (x, y, z) => -smin(-a.f(x, y, z), -b.f(x, y, z), k), bb: a.bb }; }
export function halbraum(p, n) { n = norm(n); return { f: (x, y, z) => (x - p[0]) * n[0] + (y - p[1]) * n[1] + (z - p[2]) * n[2], bb: [[-9, -9, -9], [9, 9, 9]] }; }
export function grad(f, p, e = 2e-4) {
  return norm([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]);
}
// Punkt auf die Oberfläche ziehen (Newton längs des Gradienten)
export function aufFlaeche(s, p, n = 6) { for (let i = 0; i < n; i++) { const d = s.f(...p); if (Math.abs(d) < 1e-6) break; p = sub(p, mul(grad(s.f, p), d)); } return p; }
// Strahl von innen nach außen bis zur Oberfläche
export function strahl(s, von, dir) { dir = norm(dir); let t = 0; for (let i = 0; i < 200; i++) { const p = add(von, mul(dir, t)); const d = s.f(...p); if (d > -1e-5 && t > 0) return aufFlaeche(s, p); t += Math.max(Math.abs(d), 0.0015); } return add(von, mul(dir, t)); }

// ---------------------------------------------------------------- Bauplan
// G = Gelenke der Vorlage (Weltpunkte, Name ohne „Bip01_“: Pelvis, Spine, Spine1, Spine2, Neck, Head, L_UpperArm …)
// Ergebnis: { familien: [{ name, sdf, h, tris, klasse, farbe(p, n) → Mal }], knochen: { Ohr_L: Punkt, … }, farben }
// Mal (Farbe eines Punkts): { c: Farbe linear, fell: 0…1 (1 Plüsch, 0 glatter Knopf), flecken: [{ d(p) Abstand, c, naht }],
// linien: [{ d(p), in(p) }] } – Flecken sind aufgenähte Stoffteile (scharfe Kante + Naht), Linien reine Nähte.
const S = { s: 1, bein: 1, bauch: 1, auge: 1, augeTief: 0, pfote: 1 };
// n10 (Peter 02.11.: „tiere haben größere köpfe und kürzere ärmchen und beinchen“): Kindchenschema. Ober-/Unterarm und
// Ober-/Unterschenkel × arm bzw. bein (Knochen der Vorlage gekürzt, Skelett so weit abgesenkt, dass die Sohle bleibt –
// build_kuscheltiere.mjs), Kopf samt Ohren, Augen, Nase, Mund × kopf um das Kopfgelenk (Volumen × kopf³).
// Die n9-Figuren (0.7.0) liegen unverändert in assets/kuscheltiere_n9 (?tierform=0).
export const TIERFORM10 = { arm: 0.75, bein: 0.75, kopf: 1.11 }; // n10 (0.8.0–0.9.x) → assets/kuscheltiere_n10 (?tierform=1)
// n13 (Peter 07.11.: „mach die Proportionen der Tiere noch niedlicher“): zweite Stufe Kindchenschema – Kopf nochmals größer (1,2 statt
// 1,11 → Volumen × 1,27 gegenüber n10), noch kürzere stämmige Ärmchen/Beinchen (0,68 statt 0,75, dafür dicker: dick), rundes Bäuchlein
// (bauch), große Knopfaugen (auge) tiefer im Gesicht (augeTief), kurze Schnauze (schnauze: alles vor der Gesichtsebene gestaucht),
// runde Pfoten und Tatzen (pfote). Nur Optik – Skelett-Längen der Glieder wie gehabt über arm/bein, Spielphysik unverändert.
// schritt = Schrittweg-Faktor der Laufzyklen (avatars.js): mehr als bein, weil Fuß und Tatze gleich lang bleiben (gemessen: 0,62 → 0,71)
export const TIERFORM = { schritt: 0.713, arm: 0.62, bein: 0.62, kopf: 1.3, dick: 1.12, bauch: 1.2, auge: 1.45, augeTief: 0.08, schnauze: 0.75, pfote: 1.15 };
const m = (v) => v * S.s; // Maße mit der Größe der Vorlage skalieren

function grundkoerper(G, T) {
  const L = (n) => G[n];
  const s = S.s;
  const P = L('Pelvis'), Sp = L('Spine'), S2 = L('Spine2'), N = L('Neck'), H = L('Head');
  const fam = [];
  // Rumpf: Po, runder Bauch, Brust, Nackenansatz – birnenförmig
  const bauch = (T.bauch || 1) * S.bauch;
  const rumpf = vereint(m(0.07),
    ell(add(P, [0, m(0.02), m(-0.012)]), [m(0.165), m(0.15), m(0.15)]),
    ell(add(Sp, [0, m(0.06), m(0.03)]), [m(0.172 * bauch), m(0.2), m(0.168 * bauch)]),
    ell(add(S2, [0, m(0.03), m(-0.005)]), [m(0.168), m(0.16), m(0.13)]),
    kugel(add(N, [0, m(-0.005), 0]), m(0.1)));
  fam.push({ name: 'rumpf', sdf: rumpf, h: 0.009, tris: 1500, klasse: 'rumpf', farbe: T.rumpfFarbe });
  // Arme: Stummelarme mit runder Pfote (Fingerknochen zählen zur Hand)
  for (const sd of ['L', 'R']) {
    const sg = sd === 'L' ? 1 : -1;
    const ua = L(sd + '_UpperArm'), fa = L(sd + '_Forearm'), ha = L(sd + '_Hand'), fi = L(sd + '_Finger2');
    const schulter = add(ua, [-sg * m(0.035), m(0.005), 0]);
    const hd = norm(sub(fi, ha));
    const pf = S.pfote; // n13: runde Pfote (breiter, kürzer)
    const pfote = ell(add(ha, mul(hd, m(0.055 / pf))), [m(0.068 * pf), m(0.064 * pf), m(0.09 / Math.sqrt(pf))], rahmen(hd, sub(fa, ua)));
    const ar = (T.arm || 1) * S.dick;
    const arm = vereint(m(0.03), kette([schulter, fa, add(ha, mul(hd, m(-0.01)))], [m(0.08 * ar), m(0.069 * ar), m(0.062 * ar)]), pfote);
    fam.push({ name: 'arm' + sd, sdf: arm, h: 0.008, tris: 650, klasse: 'arm' + sd, farbe: T.armFarbe ? (p, n) => T.armFarbe(p, n, sd) : T.farbe });
    // Beine: dicke Säulen und große Tatzen mit flacher Sohle (Sohle 1,5 cm unter dem Boden wie bei den Menschen)
    const th = L(sd + '_Thigh'), ca = L(sd + '_Calf'), fo = L(sd + '_Foot'), to = L(sd + '_Toe0');
    const fd = norm([to[0] - fo[0], 0, to[2] - fo[2]]);
    const mitteF = [(fo[0] + to[0]) / 2 + fd[0] * m(0.005), -0.015 + m(0.075), (fo[2] + to[2]) / 2 + fd[2] * m(0.012)];
    const tatze = ell(mitteF, [m(0.082 * S.pfote), m(0.075), m(0.142 / Math.sqrt(S.pfote))], rahmen(fd)); // n13: rundere Tatze
    const br = (T.bein || 1) * S.dick;
    const bein = vereint(m(0.035), kette([add(th, [0, m(0.04), 0]), ca, fo], [m(0.104 * br), m(0.092 * br), m(0.08 * br)]), tatze);
    const sohle = halbraum([0, -0.015, 0], [0, -1, 0]);
    fam.push({ name: 'bein' + sd, sdf: schnitt(bein, sohle, m(0.012)), h: 0.008, tris: 750, klasse: 'bein' + sd, tatze: { mitte: mitteF, dir: fd }, farbe: T.beinFarbe ? (p, n) => T.beinFarbe(p, n, sd) : T.farbe });
  }
  void s; void H;
  // Leibchen: Rumpf 1,6 cm weiter außen, Saum knapp unter dem Becken, rundes Halsloch, Armlöcher um die Oberarme
  const armLoch = (sd) => { const ua = L(sd + '_UpperArm'), fa = L(sd + '_Forearm'); return { a: add(ua, [0, m(0.02), 0]), b: lerp(ua, fa, 0.6), r: m(0.11 * (T.arm || 1)) }; };
  const loecher = [armLoch('L'), armLoch('R')];
  fam.leibchen = {
    sdf: { f: (x, y, z) => rumpf.f(x, y, z) - m(0.016), bb: rumpf.bb.map((v, k) => v.map((q) => q + (k ? 1 : -1) * m(0.02))) },
    schnitt: (p) => {
      let g = Math.max(P[1] - m(0.07) - p[1], p[1] - (N[1] + m(0.03)), m(0.12) - len(sub(p, add(N, [0, m(0.05), m(0.01)]))));
      for (const l of loecher) { const ab = sub(l.b, l.a), t = clamp(dot(sub(p, l.a), ab) / dot(ab, ab), 0, 1); g = Math.max(g, l.r - len(sub(p, add(l.a, mul(ab, t))))); }
      return g;
    },
  };
  return fam;
}

// Kopf: große Kugel, darin Schnauze/Wangen; dazu Knopfaugen, Nase, gestickter Mund (eigene kleine Teile)
function kopfTeile(G, T, kopf, opt) {
  const fam = [];
  const kc = opt.kc;
  // Knopfaugen: auf die Kopf-Oberfläche gesetzt, zur Hälfte eingenäht
  const augen = [];
  for (const sg of [1, -1]) {
    const dir = [sg * opt.augeX, opt.augeY - S.augeTief, 1]; // n13: Augen tiefer im Gesicht …
    const p = strahl(kopf, kc, dir), n = grad(kopf.f, p);
    const r = m((opt.augeR || 0.021) * S.auge); // … und größer
    augen.push(ell(sub(p, mul(n, r * 0.25)), [r, r, r * 0.62], rahmen(n)));
    opt.augenPunkte = (opt.augenPunkte || []).concat([{ p, n }]);
  }
  fam.push({ name: 'augen', sdf: vereint(0, ...augen), h: 0.0022, tris: 160, klasse: 'kopf', farbe: opt.augeFarbe || (() => ({ c: hex(0x0d0b0a), fell: 0 })) });
  // Nase (gestickt: satiniert)
  if (opt.nase) {
    const p = strahl(kopf, opt.nase.von || kc, opt.nase.dir), n = grad(kopf.f, p);
    const R = rahmen(n, [0, 1, 0]);
    const nr = opt.nase.r.map(m);
    fam.push({ name: 'nase', sdf: ell(sub(p, mul(n, nr[2] * 0.3)), nr, R), h: 0.0022, tris: 140, klasse: 'kopf', farbe: () => ({ c: hex(opt.nase.farbe), fell: 0.4 }) });
    opt.nasenPunkt = { p, n, R, nr };
  }
  // Mund: dunkler Faden als feine Röhre auf der Schnauze („Y“ unter der Nase)
  if (opt.mund !== false && opt.nasenPunkt) {
    const { p, R, nr } = opt.nasenPunkt;
    const unten = sub(p, mul(R[1], nr[1] * 0.9));
    const bahn = (q) => aufFlaeche(kopf, q);
    const tief = m(opt.mundTiefe || 0.03), breit = m(opt.mundBreite || 0.028);
    const mitte = bahn(sub(unten, mul(R[1], tief)));
    const pts = [bahn(unten), mitte];
    const bogen = (sg) => [0.35, 0.7, 1].map((t) => bahn(add(add(mitte, mul(R[0], sg * breit * t)), mul(R[1], tief * 0.45 * t * t))));
    const r = m(0.0032);
    const faden = (q) => q.map((x) => sub(x, mul(grad(kopf.f, x), r * 0.35)));
    const teile = [kette(faden(pts), pts.map(() => r)), kette(faden([mitte, ...bogen(1)]), [r, r, r, r]), kette(faden([mitte, ...bogen(-1)]), [r, r, r, r])];
    fam.push({ name: 'mund', sdf: vereint(0, ...teile), h: 0.0014, tris: 220, klasse: 'kopf', farbe: () => ({ c: hex(opt.mundFarbe || 0x2a1a12), fell: 0.4 }) });
  }
  return fam;
}

// gemeinsame Mal-Hilfen
const vorn = (sdf, p, n) => schnitt(sdf, halbraum(p, mul(n, -1))); // nur die Vorderseite (Ohr-Innenseite)
const fleck = (sdf, c, naht = true) => ({ d: (p) => sdf.f(...p), c: typeof c === 'number' ? hex(c) : c, naht });
const linie = (d, inn) => ({ d, in: inn });

// ---------------------------------------------------------------- die Tiere
// ref = Rocketbox-Vorlage (Skelett + Gewichte), sex = Bewegungs-Satz (m/f) wie bei der Vorlage
export const TIERE = {
  Teddy: { ref: 'Sports_Male_02', sex: 'm', bau: teddy },
  Fuchs: { ref: 'Sports_Female_02', sex: 'f', bau: fuchs },
  Katze: { ref: 'Male_Adult_10', sex: 'm', bau: katze },
  Hase: { ref: 'Sports_Male_03', sex: 'm', bau: hase },
  Panda: { ref: 'Female_Adult_12', sex: 'f', bau: panda },
  Elefant: { ref: 'Sports_Male_04', sex: 'm', bau: elefant },
};

// form = { arm, bein, kopf } (n10) oder null (n9); G.kopfY0 = Kopfhöhe der Vorlage vor dem Absenken (Maßstab der Formen)
export function bauplan(name, G, form = null) {
  S.s = (G.kopfY0 ?? G.Head[1]) / 1.587;
  S.bein = form ? form.bein : 1;
  S.bauch = form?.bauch ?? 1; S.auge = form?.auge ?? 1; S.augeTief = form?.augeTief ?? 0; S.pfote = form?.pfote ?? 1; S.dick = form?.dick ?? 1;
  const plan = TIERE[name].bau(G);
  if (form && form.schnauze && form.schnauze !== 1) schnauzeKuerzer(plan, G.Head[2] + m(0.115), form.schnauze);
  if (form && form.kopf !== 1) kopfGroesser(plan, G.Head, form.kopf);
  return plan;
}
// n13: kurze Schnauze – alle Kopf-Teile (Kopf, Augen, Nase, Mund) vor der Gesichtsebene z0 in Blickrichtung (+z) × k gestaucht:
// Feld f'(p) = f(q) mit q.z = z0 + (p.z − z0)/k (k < 1: kürzer); Farbe am zurückgerechneten Punkt
function schnauzeKuerzer(plan, z0, k) {
  const zur = (p) => (p[2] > z0 ? [p[0], p[1], z0 + (p[2] - z0) / k] : p);
  for (const fam of plan.familien) {
    if (fam.klasse !== 'kopf') continue;
    const f0 = fam.sdf.f, bb = fam.sdf.bb, inv0 = fam.inv;
    fam.sdf = { f: (x, y, z) => (z > z0 ? k * f0(x, y, z0 + (z - z0) / k) : f0(x, y, z)), bb: bb.map((q) => [q[0], q[1], q[2] > z0 ? z0 + (q[2] - z0) * k : q[2]]) };
    fam.inv = inv0 ? (p) => inv0(zur(p)) : zur;
  }
}
// Kopf-Teile (Kopf, Ohren, Augen, Nase, Mund) um den Punkt c mit k skalieren: Feld f'(p) = k·f(c + (p − c)/k); Farbe und
// Flecken werden am zurückgerechneten Punkt gelesen (fam.inv), die Ohr-Knochen wandern mit
function kopfGroesser(plan, c, k) {
  const zur = (p) => add(c, mul(sub(p, c), 1 / k)), hin = (p) => add(c, mul(sub(p, c), k));
  for (const fam of plan.familien) {
    if (!/^(kopf|ohr[LR])$/.test(fam.klasse)) continue;
    const f0 = fam.sdf.f, bb = fam.sdf.bb;
    fam.sdf = { f: (x, y, z) => k * f0(...zur([x, y, z])), bb: [hin(bb[0]), hin(bb[1])] };
    fam.inv = fam.inv ? ((inv0) => (p) => inv0(zur(p)))(fam.inv) : zur; // (n13: nach der kurzen Schnauze)
    fam.h *= k;
  }
  for (const n of Object.keys(plan.knochen)) if (/^Ohr_/.test(n)) plan.knochen[n] = hin(plan.knochen[n]);
}

// Kopf-Grundform: Mittelpunkt über dem Kopfgelenk
function kopfMitte(G, hoch = 0.112, vor = 0.022) { return add(G.Head, [0, m(hoch), m(vor)]); }
// Ohr als flache Scheibe auf der Kopfoberfläche (rund) – liefert sdf, Basis (für den Ohr-Knochen) und Mitte
function rundOhr(kopf, kc, sg, o) {
  const dir = norm([sg * o.x, o.y, o.z || -0.05]);
  const p = strahl(kopf, kc, dir);
  const c = add(p, mul(dir, m(o.raus || 0.03)));
  const n = norm([sg * (o.dreh || 0.12), 0.05, 1]); // Ohr-Fläche schaut nach vorn
  const r = m(o.r);
  const ohr = ell(c, [r * (o.breit || 1), r, m(o.dick || 0.026)], rahmen(n, [0, 1, 0]));
  return { sdf: ohr, basis: add(p, mul(dir, m(-0.01))), c, n, r };
}
// spitzes bzw. langes Ohr: flach gedrückter Kegel von der Basis zur Spitze
function spitzOhr(kopf, kc, sg, o) {
  const dir = norm([sg * o.x, o.y, o.z || -0.02]);
  const p = strahl(kopf, kc, dir);
  const auf = norm([sg * (o.neig || 0.25), 1, o.zurueck || -0.08]);
  const basis = add(p, mul(dir, m(-0.012)));
  const spitze = add(basis, mul(auf, m(o.lang)));
  const n = norm(cross(cross(auf, [0, 0, 1]), auf)); // Fläche schaut ungefähr nach vorn
  const k = o.mitte ? kette([basis, add(basis, mul(auf, m(o.lang * o.mitte))), spitze], [m(o.rb), m(o.rm), m(o.rs)]) : kegel(basis, spitze, m(o.rb), m(o.rs));
  return { sdf: flach(k, basis, n.map((v, i) => (i === 2 ? Math.abs(v) + 0.6 : v)), o.dick || 0.42), basis, spitze, auf, n };
}

function teddy(G) {
  const FELL = 0xa86f3d, HELL = 0xe9cc9f;
  const kc = kopfMitte(G);
  const schnauze = ell(add(kc, [0, m(-0.048), m(0.128)]), [m(0.078), m(0.06), m(0.068)]);
  const kopf = vereint(m(0.035), ell(kc, [m(0.168), m(0.152), m(0.15)]), schnauze,
    ell(add(kc, [m(0.07), m(-0.04), m(0.06)]), [m(0.08), m(0.075), m(0.08)]), ell(add(kc, [m(-0.07), m(-0.04), m(0.06)]), [m(0.08), m(0.075), m(0.08)]));
  const bauchFl = ell(add(G.Spine, [0, m(0.07), m(0.2)]), [m(0.13), m(0.16), m(0.08)]);
  const farbe = () => ({ c: hex(FELL), fell: 1 });
  const T = {
    farbe,
    rumpfFarbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(bauchFl, HELL)] }),
    beinFarbe: (p) => ({ c: hex(FELL), fell: 1, flecken: [fleck(halbraum([0, -0.006, 0], [0, 1, 0]), HELL)] }),
  };
  const fam = grundkoerper(G, T);
  const naseOpt = { dir: [0, 0.3, 1], von: add(kc, [0, m(-0.04), 0]), r: [0.036, 0.024, 0.022], farbe: 0x2b1a12 };
  const kopfFarbe = () => ({ c: hex(FELL), fell: 1, flecken: [fleck(ell(add(kc, [0, m(-0.048), m(0.128)]), [m(0.082), m(0.064), m(0.072)]), HELL)], linien: [linie((p) => p[0] - kc[0], (p) => p[1] > kc[1] + m(0.02) && p[2] > kc[2] - m(0.12))] });
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1700, klasse: 'kopf', farbe: kopfFarbe });
  const knochen = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const o = rundOhr(kopf, kc, sg, { x: 0.62, y: 0.75, r: 0.058, dick: 0.026 });
    const innen = kugel(add(o.c, mul(o.n, m(0.032))), m(0.044));
    fam.push({ name: 'ohr' + sd, sdf: o.sdf, h: 0.004, tris: 260, klasse: 'ohr' + sd, farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(vorn(innen, o.c, o.n), HELL)] }) });
    knochen['Ohr_' + sd] = o.basis;
  }
  fam.push(...kopfTeile(G, T, kopf, { kc, augeX: 0.36, augeY: 0.2, nase: naseOpt }));
  // Stummelschwanz
  const sc = add(G.Pelvis, [0, m(-0.04), m(-0.17)]);
  fam.push({ name: 'schwanz', sdf: kugel(sc, m(0.045)), h: 0.005, tris: 160, klasse: 'schwanz', farbe });
  knochen.Schwanz = add(sc, [0, 0, m(0.03)]);
  return { familien: fam, knochen, farbeFell: FELL };
}

function fuchs(G) {
  const FELL = 0xd9692a, WEISS = 0xf7f0e6, DUNKEL = 0x3a2a22;
  const kc = kopfMitte(G, 0.105, 0.0);
  const spitz = kette([add(kc, [0, m(-0.03), m(0.05)]), add(kc, [0, m(-0.055), m(0.2)])], [m(0.085), m(0.032)]);
  const kopf = vereint(m(0.04), ell(kc, [m(0.162), m(0.142), m(0.142)]), spitz,
    ell(add(kc, [m(0.085), m(-0.05), m(0.03)]), [m(0.075), m(0.06), m(0.07)]), ell(add(kc, [m(-0.085), m(-0.05), m(0.03)]), [m(0.075), m(0.06), m(0.07)]));
  // Weiß: Unterseite der Schnauze und Wangen (Ebene schräg unter den Augen)
  const wangen = schnitt(halbraum(add(kc, [0, m(-0.035), 0]), [0, 1, -0.35]), halbraum(add(kc, [0, 0, m(-0.03)]), [0, 0, -1]));
  const brust = ell(add(G.Spine1, [0, m(0.05), m(0.16)]), [m(0.11), m(0.2), m(0.09)]);
  const socke = (y) => halbraum([0, y, 0], [0, 1, 0]);
  const T = {
    farbe: () => ({ c: hex(FELL), fell: 1 }),
    rumpfFarbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(brust, WEISS)] }),
    beinFarbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(socke(m(0.3) - (1 - S.bein) * (m(0.3) + 0.015)), DUNKEL)] }), // n10: Socke mit dem Bein kürzer
    armFarbe: (p, n, sd) => ({ c: hex(FELL), fell: 1, flecken: [fleck(kugel(G[sd + '_Hand'], m(0.13)), DUNKEL)] }),
    bein: 0.95, arm: 0.95,
  };
  const fam = grundkoerper(G, T);
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1700, klasse: 'kopf', farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(wangen, WEISS)] }) });
  const knochen = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const o = spitzOhr(kopf, kc, sg, { x: 0.55, y: 0.8, lang: 0.15, rb: 0.062, rs: 0.012, neig: 0.3, dick: 0.4 });
    const tip = kugel(o.spitze, m(0.055));
    const innen = kegel(add(o.basis, mul(o.n, m(0.03))), add(o.spitze, add(mul(o.n, m(0.014)), mul(o.auf, m(-0.04)))), m(0.04), m(0.004));
    fam.push({ name: 'ohr' + sd, sdf: o.sdf, h: 0.0035, tris: 260, klasse: 'ohr' + sd, farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(vorn(innen, o.basis, o.n), WEISS), fleck(tip, DUNKEL)] }) });
    knochen['Ohr_' + sd] = o.basis;
  }
  fam.push(...kopfTeile(G, T, kopf, { kc, augeX: 0.4, augeY: 0.22, augeR: 0.02, nase: { dir: [0, 0.05, 1], von: add(kc, [0, m(-0.05), m(0.05)]), r: [0.026, 0.02, 0.02], farbe: 0x1b1412 }, mundTiefe: 0.02, mundBreite: 0.022 }));
  // buschiger Schwanz mit weißer Spitze
  const b = add(G.Pelvis, [0, m(-0.03), m(-0.15)]);
  const pts = [b, add(b, [0, m(-0.08), m(-0.13)]), add(b, [0, m(-0.2), m(-0.24)]), add(b, [0, m(-0.27), m(-0.3)])];
  const schwanz = kette(pts, [m(0.045), m(0.085), m(0.075), m(0.035)], m(0.03));
  fam.push({ name: 'schwanz', sdf: schwanz, h: 0.006, tris: 420, klasse: 'schwanz', farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(kugel(pts[3], m(0.085)), WEISS)] }) });
  knochen.Schwanz = add(b, [0, 0, m(0.03)]);
  return { familien: fam, knochen, farbeFell: FELL };
}

function katze(G) {
  const FELL = 0xe0954f, STREIF = 0xb8652a, WEISS = 0xfbf2e4, ROSA = 0xee9aa6;
  const kc = kopfMitte(G, 0.108, 0.01);
  const maul = vereint(m(0.02), ell(add(kc, [m(0.035), m(-0.06), m(0.115)]), [m(0.045), m(0.04), m(0.045)]), ell(add(kc, [m(-0.035), m(-0.06), m(0.115)]), [m(0.045), m(0.04), m(0.045)]));
  const kopf = vereint(m(0.03), ell(kc, [m(0.172), m(0.145), m(0.142)]), maul);
  // weiche Tigerstreifen (in die Grundfarbe gemischt, ohne Naht)
  const streifen = (p, frq, ph = 0) => { const s = Math.sin(p[1] * frq + ph); return smooth(0.35, 0.8, s); };
  const getigert = (p, f = 1) => { const t = streifen(p, 52 / S.s, p[0] * 6) * f; return lerpC(hex(FELL), hex(STREIF), t * 0.75); };
  const brust = ell(add(G.Spine1, [0, m(0.04), m(0.16)]), [m(0.12), m(0.22), m(0.09)]);
  const T = {
    farbe: (p) => ({ c: getigert(p), fell: 1 }),
    rumpfFarbe: (p, n) => ({ c: getigert(p, n[2] < 0.2 ? 1 : 0.4), fell: 1, flecken: [fleck(brust, WEISS)] }),
    beinFarbe: (p, n, sd) => ({ c: getigert(p), fell: 1, flecken: [fleck(socke(G, sd), WEISS)] }),
    armFarbe: (p, n, sd) => ({ c: getigert(p), fell: 1, flecken: [fleck(kugel(G[sd + '_Hand'], m(0.1)), WEISS)] }),
  };
  const fam = grundkoerper(G, T);
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1700, klasse: 'kopf', farbe: (p) => ({ c: p[1] > kc[1] + m(0.04) ? getigert([p[0], p[1] * 1.0, p[2]]) : hex(FELL), fell: 1, flecken: [fleck(ell(add(kc, [0, m(-0.065), m(0.11)]), [m(0.088), m(0.055), m(0.06)]), WEISS)] }) });
  const knochen = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const o = spitzOhr(kopf, kc, sg, { x: 0.6, y: 0.78, lang: 0.11, rb: 0.065, rs: 0.014, neig: 0.38, dick: 0.42 });
    const innen = kegel(add(o.basis, mul(o.n, m(0.03))), add(o.spitze, add(mul(o.n, m(0.012)), mul(o.auf, m(-0.03)))), m(0.042), m(0.004));
    fam.push({ name: 'ohr' + sd, sdf: o.sdf, h: 0.0035, tris: 240, klasse: 'ohr' + sd, farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(vorn(innen, o.basis, o.n), ROSA)] }) });
    knochen['Ohr_' + sd] = o.basis;
  }
  fam.push(...kopfTeile(G, T, kopf, { kc, augeX: 0.42, augeY: 0.2, augeR: 0.022, augeFarbe: () => ({ c: hex(0x1e2a12), fell: 0 }), nase: { dir: [0, 0.05, 1], von: add(kc, [0, m(-0.03), 0]), r: [0.022, 0.016, 0.016], farbe: ROSA }, mundTiefe: 0.018, mundBreite: 0.026, mundFarbe: 0x5a3a30 }));
  // langer, nach oben geschwungener Ringelschwanz
  const b = add(G.Pelvis, [0, m(-0.03), m(-0.15)]);
  const pts = [b, add(b, [0, m(-0.12), m(-0.12)]), add(b, [0, m(-0.13), m(-0.27)]), add(b, [0, m(-0.02), m(-0.36)]), add(b, [0, m(0.12), m(-0.38)])];
  fam.push({ name: 'schwanz', sdf: kette(pts, [m(0.036), m(0.034), m(0.032), m(0.03), m(0.028)], m(0.01)), h: 0.005, tris: 320, klasse: 'schwanz', farbe: (p) => ({ c: lerpC(hex(FELL), hex(STREIF), smooth(0.2, 0.7, Math.sin(len(sub(p, b)) * 70))), fell: 1 }) });
  knochen.Schwanz = add(b, [0, 0, m(0.03)]);
  return { familien: fam, knochen, farbeFell: FELL };
}
function socke(G, sd) { return kugel(add(G[sd + '_Toe0'], [0, 0, m(0.04)]), m(0.1)); }
function lerpC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function hase(G) {
  const FELL = 0xc9c3bb, WEISS = 0xfaf8f4, ROSA = 0xf0a9b6;
  const kc = kopfMitte(G, 0.1, 0.015);
  const backen = vereint(m(0.02), ell(add(kc, [m(0.04), m(-0.055), m(0.105)]), [m(0.05), m(0.045), m(0.05)]), ell(add(kc, [m(-0.04), m(-0.055), m(0.105)]), [m(0.05), m(0.045), m(0.05)]));
  const kopf = vereint(m(0.035), ell(kc, [m(0.158), m(0.148), m(0.15)]), backen);
  const bauchFl = ell(add(G.Spine, [0, m(0.06), m(0.19)]), [m(0.13), m(0.17), m(0.08)]);
  const T = {
    farbe: () => ({ c: hex(FELL), fell: 1 }),
    rumpfFarbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(bauchFl, WEISS)] }),
    beinFarbe: (p, n, sd) => ({ c: hex(FELL), fell: 1, flecken: [fleck(socke(G, sd), WEISS)] }),
    bein: 1.03,
  };
  const fam = grundkoerper(G, T);
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1600, klasse: 'kopf', farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(ell(add(kc, [0, m(-0.06), m(0.11)]), [m(0.095), m(0.06), m(0.065)]), WEISS)] }) });
  const knochen = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const o = spitzOhr(kopf, kc, sg, { x: 0.3, y: 0.95, z: -0.1, lang: 0.33, rb: 0.045, rm: 0.062, rs: 0.03, mitte: 0.5, neig: 0.16, zurueck: -0.12, dick: 0.36 });
    const innen = kette([add(o.basis, add(mul(o.n, m(0.024)), mul(o.auf, m(0.05)))), add(o.basis, add(mul(o.n, m(0.024)), mul(o.auf, m(0.17)))), add(o.spitze, add(mul(o.n, m(0.014)), mul(o.auf, m(-0.04))))], [m(0.03), m(0.046), m(0.016)]);
    fam.push({ name: 'ohr' + sd, sdf: o.sdf, h: 0.0035, tris: 360, klasse: 'ohr' + sd, farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(vorn(innen, o.basis, o.n), ROSA)] }) });
    knochen['Ohr_' + sd] = o.basis;
  }
  const teile = kopfTeile(G, T, kopf, { kc, augeX: 0.42, augeY: 0.17, nase: { dir: [0, 0.12, 1], von: add(kc, [0, m(-0.04), 0]), r: [0.02, 0.015, 0.015], farbe: ROSA }, mundTiefe: 0.016, mundBreite: 0.02, mundFarbe: 0x6b4a44 });
  fam.push(...teile);
  // Puschel
  const sc = add(G.Pelvis, [0, m(-0.03), m(-0.17)]);
  fam.push({ name: 'schwanz', sdf: kugel(sc, m(0.06)), h: 0.005, tris: 200, klasse: 'schwanz', farbe: () => ({ c: hex(WEISS), fell: 1 }) });
  knochen.Schwanz = add(sc, [0, 0, m(0.04)]);
  return { familien: fam, knochen, farbeFell: FELL };
}

function panda(G) {
  const WEISS = 0xf2f0ea, SCHWARZ = 0x2b2b30;
  const kc = kopfMitte(G, 0.108, 0.02);
  const schnauze = ell(add(kc, [0, m(-0.05), m(0.122)]), [m(0.072), m(0.055), m(0.06)]);
  const kopf = vereint(m(0.035), ell(kc, [m(0.172), m(0.15), m(0.148)]), schnauze,
    ell(add(kc, [m(0.075), m(-0.045), m(0.05)]), [m(0.085), m(0.075), m(0.08)]), ell(add(kc, [m(-0.075), m(-0.045), m(0.05)]), [m(0.085), m(0.075), m(0.08)]));
  const T = {
    farbe: () => ({ c: hex(SCHWARZ), fell: 1 }),
    rumpfFarbe: () => ({ c: hex(WEISS), fell: 1, flecken: [fleck(ell(add(G.Spine2, [0, m(0.05), m(-0.02)]), [m(0.24), m(0.085), m(0.2)]), SCHWARZ)] }),
  };
  const fam = grundkoerper(G, T);
  const augen = [];
  const knochen = {};
  const aopt = { kc, augeX: 0.38, augeY: 0.2, augeR: 0.019, nase: { dir: [0, 0.3, 1], von: add(kc, [0, m(-0.045), 0]), r: [0.03, 0.02, 0.02], farbe: 0x18181b } };
  const teile = kopfTeile(G, T, kopf, aopt);
  // Augenflecken: schräge schwarze Tropfen um die Augen
  const kopfAuge = (sg) => { const p = strahl(kopf, kc, [sg * 0.38, 0.2, 1]); return p; };
  for (const sg of [1, -1]) { const p = kopfAuge(sg); augen.push(ell(add(p, [sg * m(0.008), m(-0.012), 0]), [m(0.042), m(0.054), m(0.06)], rahmen([0, 0, 1], [sg * 0.55, 1, 0]))); }
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1700, klasse: 'kopf', farbe: () => ({ c: hex(WEISS), fell: 1, flecken: augen.map((a) => fleck(a, SCHWARZ)) }) });
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const o = rundOhr(kopf, kc, sg, { x: 0.66, y: 0.72, r: 0.055, dick: 0.028 });
    fam.push({ name: 'ohr' + sd, sdf: o.sdf, h: 0.004, tris: 240, klasse: 'ohr' + sd, farbe: () => ({ c: hex(SCHWARZ), fell: 1 }) });
    knochen['Ohr_' + sd] = o.basis;
  }
  // Knopfaugen mit weißem Ring, damit sie auf dem schwarzen Fleck leuchten
  const au = teile.find((f) => f.name === 'augen');
  const pupillen = aopt.augenPunkte.map(({ p, n }) => fleck(kugel(add(p, mul(n, m(0.006))), m(0.0135)), 0x120d0b, false));
  au.farbe = () => ({ c: hex(0xf4f1ea), fell: 0, flecken: pupillen });
  fam.push(...teile);
  const sc = add(G.Pelvis, [0, m(-0.04), m(-0.165)]);
  fam.push({ name: 'schwanz', sdf: kugel(sc, m(0.04)), h: 0.005, tris: 140, klasse: 'schwanz', farbe: () => ({ c: hex(WEISS), fell: 1 }) });
  knochen.Schwanz = add(sc, [0, 0, m(0.03)]);
  return { familien: fam, knochen, farbeFell: WEISS };
}

function elefant(G) {
  const FELL = 0x8c9cb3, HELL = 0xc7d1df, ROSA = 0xeab3bf;
  const kc = kopfMitte(G, 0.105, 0.02);
  const r0 = add(kc, [0, m(-0.03), m(0.1)]);
  const ruessel = kette([r0, add(kc, [0, m(-0.08), m(0.19)]), add(kc, [0, m(-0.16), m(0.215)]), add(kc, [0, m(-0.215), m(0.25)])], [m(0.07), m(0.045), m(0.036), m(0.032)], m(0.02));
  const kopf = vereint(m(0.04), ell(kc, [m(0.168), m(0.155), m(0.155)]), ruessel);
  const T = {
    farbe: () => ({ c: hex(FELL), fell: 1 }),
    rumpfFarbe: () => ({ c: hex(FELL), fell: 1 }),
    beinFarbe: (p, n, sd) => ({ c: hex(FELL), fell: 1, flecken: naegel(G, sd).concat([fleck(halbraum([0, -0.006, 0], [0, 1, 0]), HELL)]) }),
    bein: 1.06,
  };
  const fam = grundkoerper(G, T);
  fam.push({ name: 'kopf', sdf: kopf, h: 0.0055, tris: 1800, klasse: 'kopf', farbe: () => ({ c: hex(FELL), fell: 1 }) });
  const knochen = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    // große Schlappohren an der Kopfseite
    const p = strahl(kopf, kc, [sg, 0.25, -0.15]);
    const c = add(p, [sg * m(0.045), m(-0.01), m(-0.02)]);
    const n = norm([sg * 0.55, 0, 1]);
    const ohr = ell(c, [m(0.13), m(0.15), m(0.025)], rahmen(n, [0, 1, 0]));
    const innen = ell(add(c, mul(n, m(0.03))), [m(0.105), m(0.125), m(0.02)], rahmen(n, [0, 1, 0]));
    fam.push({ name: 'ohr' + sd, sdf: ohr, h: 0.004, tris: 340, klasse: 'ohr' + sd, farbe: () => ({ c: hex(FELL), fell: 1, flecken: [fleck(vorn(innen, c, n), ROSA)] }) });
    knochen['Ohr_' + sd] = add(p, [sg * m(-0.02), 0, 0]);
  }
  fam.push(...kopfTeile(G, T, kopf, { kc, augeX: 0.42, augeY: 0.3, augeR: 0.02, mund: false }));
  // dünner Schwanz mit Quaste
  const b = add(G.Pelvis, [0, m(-0.02), m(-0.15)]);
  const pts = [b, add(b, [0, m(-0.1), m(-0.07)]), add(b, [0, m(-0.2), m(-0.09)])];
  fam.push({ name: 'schwanz', sdf: vereint(m(0.01), kette(pts, [m(0.022), m(0.018), m(0.016)]), ell(add(pts[2], [0, m(-0.03), 0]), [m(0.03), m(0.045), m(0.03)])), h: 0.004, tris: 220, klasse: 'schwanz', farbe: (p) => ({ c: p[1] < pts[2][1] - m(0.005) ? hex(0x5b6577) : hex(FELL), fell: 1 }) });
  knochen.Schwanz = add(b, [0, 0, m(0.03)]);
  return { familien: fam, knochen, farbeFell: FELL };
}
function naegel(G, sd) {
  const fo = G[sd + '_Foot'], to = G[sd + '_Toe0'];
  const fd = norm([to[0] - fo[0], 0, to[2] - fo[2]]), q = cross([0, 1, 0], fd);
  const vorn = add([(fo[0] + to[0]) / 2, -0.015 + m(0.06), (fo[2] + to[2]) / 2], mul(fd, m(0.14)));
  return [-1, 0, 1].map((k) => fleck(kugel(add(vorn, mul(q, k * m(0.045))), m(0.024)), NAGEL_C));
}
const NAGEL_C = hex(0xf3efe6);

// ---------------------------------------------------------------- Malen eines Punkts
// → { aussen: Farbe, innen: Farbe, d: Abstand zur nächsten Kante (negativ = im Fleck), fell, naht }
export function male(mal, p) {
  const fl = mal.flecken || [], li = mal.linien || [];
  const ds = fl.map((f) => f.d(p));
  const farbeOhne = (skip, drin) => { let c = mal.c; for (let i = 0; i < fl.length; i++) { const inside = i === skip ? drin : ds[i] < 0; if (inside) c = fl[i].c; } return c; };
  let best = -1, bd = 1e9;
  for (let i = 0; i < fl.length; i++) if (Math.abs(ds[i]) < bd) { bd = Math.abs(ds[i]); best = i; }
  let r;
  if (best >= 0) {
    const inn = farbeOhne(best, true), aus = farbeOhne(best, false);
    r = { aussen: aus, innen: inn, d: ds[best], naht: fl[best].naht && (inn !== aus) };
  } else r = { aussen: mal.c, innen: mal.c, d: 1, naht: false };
  for (const l of li) {
    if (!l.in(p)) continue;
    const d = l.d(p);
    if (Math.abs(d) < Math.abs(r.d)) { const c = farbeOhne(-1); r = { aussen: c, innen: c, d, naht: true }; }
  }
  r.fell = mal.fell ?? 1;
  return r;
}
