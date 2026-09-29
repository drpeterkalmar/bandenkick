// Technik-Wahl als Tabellen (Konstanten; Winkel- und Höhengrenzen als Regler über params.js). Reine Funktionen,
// geprüft in tests/node/technique.test.mjs. Überschneidende Fenster werden per Punktwert entschieden, nicht per
// if-Kette.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Anzeigenamen (HUD, Bericht) und Symbole für den Aufladering
export const TECH_NAMES = {
  innen: 'Innenseite', aussen: 'Außenrist', ferse: 'Hacke', chip: 'Chip', vollspann: 'Vollspann',
  innenrist: 'Innenrist', aussenrist: 'Außenrist', volley: 'Volley', dropkick: 'Dropkick', seitfall: 'Seitfallzieher',
  fallrueck: 'Fallrückzieher', kopf: 'Kopfball', flugkopf: 'Flugkopfball',
};
export const MODE_SYMBOL = { vollspann: '⚡', innenrist: '↪', aussenrist: '↩', chip: '⌒', flach: '→' };

// ---------------- Pass: Technik nach Lage ----------------
// ang = Winkel zwischen Blickrichtung und Passrichtung (°), ballDist = Ball ↔ Körpermitte (m).
// Ziel grob vor dem Körper → Innenseite/Vorfuß; seitlich knapp → Außenrist; hinter dem Spieler und Ball nah am
// Standbein → Hacke (kürzer, max. ~8 m, ungenauer). Hinter dem Spieler, Ball weiter weg → Außenrist mit Drehung.
export function passTechnique(ang, ballDist, P) {
  if (ang <= P.passInnenDeg) return 'innen';
  if (ang <= P.passHackeDeg) return 'aussen';
  return ballDist <= P.hackeNear ? 'ferse' : 'aussen';
}
// Eigenschaften je Pass-Technik: Tempo-Grenze, Streuung (Faktor), Weite-Grenze
export const PASS_PROPS = {
  innen: { noise: 1.0, maxSpeed: 22, maxDist: 99 },
  aussen: { noise: 1.6, maxSpeed: 18, maxDist: 99 },
  ferse: { noise: 3.0, maxSpeed: 8.5, maxDist: 8 },
  chip: { noise: 1.8, maxSpeed: 22, maxDist: 99 },
};

// ---------------- Schuss: Vollspann oder angeschnitten (Innen-/Außenrist) ----------------
// mode 'std' → Vollspann (Fuß auf der Ballseite). mode 'var' → Kurve zum Tor hin: curveLeft = Ball soll nach links
// drehen (Drall um die Hochachse > 0). Rechter Innenrist und linker Außenrist drehen nach links, linker Innenrist
// und rechter Außenrist nach rechts. Das Bein wählt der Spieler: Innenrist bevorzugt, starkes Bein bevorzugt,
// Ball auf der Seite des Beins; steht das Innenrist-Bein unpassend (Ball auf der anderen Seite) → Außenrist.
// ballSide = seitliche Lage des Balls zur Körpermitte (m, + = rechts), strong = starkes Bein (+1 rechts, −1 links)
export function shotTechnique(mode, curveLeft, ballSide, strong = 1) {
  if (mode !== 'var') {
    const foot = ballSide > 0.06 ? 1 : ballSide < -0.06 ? -1 : strong;
    return { tech: 'vollspann', foot };
  }
  let best = null;
  for (const foot of [1, -1]) {
    const inside = curveLeft ? foot === 1 : foot === -1;
    const s = (inside ? 0.3 : 0) + (foot === strong ? 0.25 : 0) + clamp(ballSide * foot / 0.15, -1, 1) * 0.5;
    if (!best || s > best.s) best = { s, foot, tech: inside ? 'innenrist' : 'aussenrist' };
  }
  return { tech: best.tech, foot: best.foot };
}
// Drall-Vorzeichen: Kurve nach links = +, rechts = −
export const curveSign = (curveLeft) => (curveLeft ? 1 : -1);

// ---------------- Luftbälle ----------------
// Höhe h = Ballmitte am Treffpunkt (m). theta = Winkel zwischen „woher der Ball kommt“ und „wo das Tor ist“
// (°, vom Treffpunkt aus): 0 = Ball kommt aus Torrichtung, 90 = Flanke von der Seite, 180 = Ball kommt von vorn,
// Tor im Rücken. Je Technik: Höhenfenster [a, b, c, d] (b…c ideal, außerhalb a…d unmöglich), Winkel-Eignung
// (Stützstellen), Grundwert, Reichweite (Körper ↔ Ball, m), Zusatz-Reichweite (Sprung/Hechten/Fallen),
// ideales Zeitfenster Druck → Treffpunkt (s).
export const AIR_TECH = {
  volley: { h: [0.35, 0.5, 0.85, 1.05], ang: [[0, 1], [100, 1], [150, 0.15], [180, 0.1]], prior: 1.0, dist: 0.5, extra: 0.25, lead: [0.16, 0.5] },
  dropkick: { h: [0.12, 0.16, 0.42, 0.56], ang: [[0, 1], [100, 1], [150, 0.15], [180, 0.1]], prior: 1.05, dist: 0.45, extra: 0.2, lead: [0.14, 0.45], bounce: true },
  seitfall: { h: [0.8, 1.0, 1.35, 1.55], ang: [[0, 0.15], [40, 0.35], [60, 1], [130, 1], [160, 0.3], [180, 0.3]], prior: 0.92, dist: 0.55, extra: 0.35, lead: [0.22, 0.6] },
  fallrueck: { h: [1.05, 1.2, 1.75, 1.95], ang: [[0, 0.1], [110, 0.1], [140, 1], [180, 1]], prior: 0.9, dist: 0.25, extra: 0.15, lead: [0.28, 0.65] },
  kopf: { h: [1.45, 1.6, 2.35, 2.55], ang: [[0, 1], [110, 1], [150, 0.2], [180, 0.15]], prior: 1.0, dist: 0.22, extra: 0.15, lead: [0.18, 0.6] },
  flugkopf: { h: [0.5, 0.6, 0.9, 1.0], ang: [[0, 0.7], [30, 1], [125, 1], [150, 0.1], [180, 0.1]], prior: 0.72, dist: 0.95, extra: 1.0, lead: [0.24, 0.6] },
};
export const AIR_KEYS = Object.keys(AIR_TECH);

function interp(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return tab[tab.length - 1][1];
}
// Höhen-Eignung: 1 im Idealband, an den Fenstergrenzen 0,3, außerhalb 0
export function heightFit(w, h) {
  const [a, b, c, d] = w;
  if (h < a || h > d) return 0;
  if (h >= b && h <= c) return 1;
  return h < b ? 0.3 + 0.7 * (h - a) / (b - a) : 0.3 + 0.7 * (d - h) / (d - c);
}
export const angleFit = (tech, theta) => interp(AIR_TECH[tech].ang, theta);
// Zeitfenster: 1 im idealen Vorlauf, außerhalb Gauß-Abfall (σ = 0,15 s)
export function timingFit(tech, lead) {
  const [lo, hi] = AIR_TECH[tech].lead;
  if (lead >= lo && lead <= hi) return 1;
  const d = lead < lo ? lo - lead : lead - hi;
  return Math.exp(-((d / 0.15) ** 2));
}
// Punktwerte aller Techniken für Höhe h, Winkel theta, Aufsetzer (bounced). Optional: scale = Höhen-Faktor
// (Regler ?luft=, verschiebt alle Fenster), P für Überschreibungen.
export function airScores(h, theta, bounced = false, scale = 1) {
  const out = {};
  for (const k of AIR_KEYS) {
    const T = AIR_TECH[k];
    if (T.bounce && !bounced) { out[k] = 0; continue; }
    out[k] = heightFit(T.h.map((x) => x * scale), h) * angleFit(k, theta) * T.prior;
  }
  return out;
}
export function airTechnique(h, theta, bounced = false, scale = 1) {
  const s = airScores(h, theta, bounced, scale);
  let best = null, bs = 0;
  for (const k of AIR_KEYS) if (s[k] > bs) { bs = s[k]; best = k; }
  return best ? { tech: best, score: bs, scores: s } : null;
}
// Eigenschaften je Luft-Technik: Grundtempo (m/s), Anteil des ankommenden Tempos, Obergrenze, Streuung (°),
// Zeit am Boden danach (s), Sprung (Kopfball), Fallen (Seit-/Fallrückzieher), Hechten (Flugkopfball)
export const AIR_PROPS = {
  volley: { v0: 23, vin: 0.1, vmax: 28, noise: 2.8, ground: 0, name: 'Volley' },
  dropkick: { v0: 22, vin: 0.1, vmax: 27, noise: 3.2, ground: 0, name: 'Dropkick' },
  seitfall: { v0: 20, vin: 0.1, vmax: 25, noise: 4.0, ground: 0.8, name: 'Seitfallzieher' },
  fallrueck: { v0: 18, vin: 0.1, vmax: 23, noise: 4.8, ground: 0.8, name: 'Fallrückzieher' },
  kopf: { v0: 10, vin: 0.4, vmax: 17, noise: 2.8, ground: 0, name: 'Kopfball' },
  flugkopf: { v0: 11, vin: 0.35, vmax: 16, noise: 3.2, ground: 0.6, name: 'Flugkopfball' },
};
