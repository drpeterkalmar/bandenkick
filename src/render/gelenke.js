// n11 (Peter 02.11.: „Spieler treffen ball so physiologisch wie möglich, sie sind dafür sehr beweglich in ihren beingelenken (Hüfte
// Kugelgelenk, knie und Sprunggelenk scharnier)“): Gelenkgrenzen des Spielbeins in EINER Tabelle und das Ziel der Schuss-IK je
// Körperteil. Reine Rechnung ohne three.js (tests/node/gelenke.test.mjs prüft 200 Zufallslagen je Technik); Einbau in
// src/render/avatars.js (fussIK). Winkel in Grad.
//   Hüfte (Kugelgelenk, 3 Achsen): Beugung −45 … 150 (− = Bein nach hinten; Kuscheltiere sind sehr beweglich, der Skorpion-Kick der
//   Salto-Hacke braucht die Streckung), Abspreizen −30 … 90 (− = über die Mitte), Drehung ±60
//   Knie (Scharnier): 0 … 160 (0 = gestreckt, nie nach vorn durchgedrückt), Sprunggelenk (Scharnier): −50 … 45 (+ = Zehen hoch)
export const GELENK_GRENZEN = {
  huefte: { beugung: [-45, 150], abspreizen: [-30, 90], drehung: [-60, 60] },
  knie: [0, 160],
  sprung: [-50, 45],
};
const DEG = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (...v) => v.reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2]], [0, 0, 0]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Technik → Körperteil, das den Ball trifft
export const KONTAKT_TEIL = {
  innen: 'innenseite', innenrist: 'innenseite', lupfer: 'innenseite', kurve: 'innenseite', chip: 'innenseite',
  aussen: 'aussenrist', aussenrist: 'aussenrist', vollspann: 'spann', volley: 'spann', dropkick: 'spann', seitfall: 'spann',
  fallrueck: 'spann', volleypass: 'spann', ferse: 'ferse', salto: 'ferse', kopf: 'kopf', flugkopf: 'kopf', kopfpass: 'kopf',
  brust: 'brust', oberschenkel: 'oberschenkel',
};
export const kontaktTeil = (tech) => KONTAKT_TEIL[tech] || 'spann';
// Lage des Körperteils relativ zum Knöchel (Fuß-Knochen) im Körper-Rahmen: [vorn, oben, nach außen] in m (Kuscheltier-Tatze,
// gemessen an den Figuren: Knöchel ~9 cm über der Sohle, Tatze ~16 cm lang)
export const TEIL_VERSATZ = {
  spann: [0.075, -0.035, 0], innenseite: [0.035, -0.055, -0.05], aussenrist: [0.06, -0.055, 0.05], ferse: [-0.06, -0.06, 0],
};

// Knöchel-Ziel, damit das Körperteil die Balloberfläche trifft. ball, spieler (Körpermitte am Boden) [x, y, z]; fwd/up/right =
// Körperachsen (Welt, Einheitsvektoren; right = rechts vom Spieler); seite = Schussbein (+1 rechts, −1 links); hoch = Luftball
// (Richtung aus der Hüfte statt waagrecht). ruheKnoechel = Knöchelhöhe im Stand (Fuß nie unter den Rasen)
export function zielFuerTeil(ball, spieler, r, ruheKnoechel, teil, achsen, seite = 1, hoch = false) {
  const { fwd, up, right } = achsen;
  let d = hoch ? sub(ball, [spieler[0], spieler[1] + 0.55, spieler[2]]) : [ball[0] - spieler[0], 0, ball[2] - spieler[2]];
  const l = len(d) || 1; d = sc(d, 1 / l);
  const C = sub(ball, sc(d, r));                                           // Treffpunkt auf der Balloberfläche
  const v = TEIL_VERSATZ[teil] || TEIL_VERSATZ.spann, out = sc(right, seite);
  const k = sub(C, add3(sc(fwd, v[0]), sc(up, v[1]), sc(out, v[2])));
  if (!hoch) k[1] = Math.max(ruheKnoechel, k[1]);
  return k;
}
// Welt-Punkt des Körperteils zum Knöchel (für Tests und das Kontaktbild)
export function teilPunkt(knoechel, teil, achsen, seite = 1) {
  const v = TEIL_VERSATZ[teil] || TEIL_VERSATZ.spann, { fwd, up, right } = achsen;
  return add3(knoechel, sc(fwd, v[0]), sc(up, v[1]), sc(right, seite * v[2]));
}

// Hüft- und Kniewinkel aus Hüfte a, Knie b, Knöchel c im Körper-Rahmen (Becken): Beugung (Oberschenkel nach vorn), Abspreizen
// (nach außen, seite = Bein), Kniebeugung, Knie nach vorn (true = Knie vor der Linie Hüfte → Knöchel, also nicht durchgedrückt)
export function beinWinkel(a, b, c, achsen, seite = 1) {
  const { fwd, up, right } = achsen, out = sc(right, seite);
  const t = sub(b, a), s = sub(c, b);
  const f = dot(t, fwd), u = dot(t, up), o = dot(t, out);
  const beugung = Math.atan2(f, -u) / DEG;
  const abspreizen = Math.atan2(o, Math.hypot(f, u)) / DEG;
  const knie = Math.acos(clamp(dot(t, s) / ((len(t) * len(s)) || 1), -1, 1)) / DEG;
  return { beugung, abspreizen, knie };
}
// Kniewinkel aus Abstand Hüfte ↔ Knöchel (Kosinussatz): 0 = gestreckt
export function knieAusAbstand(lab, lcb, L) {
  const cosI = clamp((lab * lab + lcb * lcb - L * L) / (2 * lab * lcb), -1, 1);
  return 180 - Math.acos(cosI) / DEG;
}

// Ziel t für den Knöchel so begrenzen, dass Hüfte (Beugung, Abspreizen) und Knie (≤ 160°) in der Tabelle bleiben: Richtung
// Hüfte → Ziel im Körper-Rahmen in Beuge-/Abspreizwinkel zerlegt, beschnitten, wieder zusammengesetzt; Abstand ≥ Mindestabstand
// für 160° Kniebeugung und ≤ Beinlänge. Gibt das neue Ziel zurück.
export function begrenzeZiel(a, lab, lcb, t, achsen, seite = 1, G = GELENK_GRENZEN) {
  const { fwd, up, right } = achsen, out = sc(right, seite);
  const d = sub(t, a);
  let L = len(d);
  const Lmin = Math.sqrt(lab * lab + lcb * lcb - 2 * lab * lcb * Math.cos((180 - G.knie[1]) * DEG)) + 1e-3;
  L = clamp(L, Lmin, lab + lcb);
  const f = dot(d, fwd), u = dot(d, up), o = dot(d, out);
  // Bei gebeugtem Knie (Knie vorn) steht der Oberschenkel um β weiter vorn als die Linie Hüfte → Knöchel (Kosinussatz)
  const beta = Math.acos(clamp((lab * lab + L * L - lcb * lcb) / (2 * lab * L), -1, 1)) / DEG;
  const beug = clamp(Math.atan2(f, -u) / DEG, G.huefte.beugung[0] - beta, G.huefte.beugung[1] - beta);
  const absp = clamp(Math.atan2(o, Math.hypot(f, u)) / DEG, G.huefte.abspreizen[0], G.huefte.abspreizen[1]);
  const ca = Math.cos(absp * DEG), sa = Math.sin(absp * DEG), cb = Math.cos(beug * DEG), sb = Math.sin(beug * DEG);
  const dir = add3(sc(fwd, sb * ca), sc(up, -cb * ca), sc(out, sa));
  return add3(a, sc(dir, L));
}
