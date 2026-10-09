// Zwei-Knochen-IK für die Beine (n4-Technik, Audit #5): analytisch über den Kosinussatz (billiger als CCD, Katalog F2),
// nach D. Holden („Simple Two Joint IK“). Hüfte a, Knie b, Knöchel c, Ziel t (Welt). Liefert Welt-Drehungen als
// Quaternionen [x, y, z, w]: qHuefte wirkt auf den Oberschenkel (vorn anmultipliziert: neu = qHuefte · alt), qKnie auf den
// Unterschenkel vor der Hüftdrehung (neu = qHuefte · qKnie · alt). Danach liegt der Knöchel auf t (wenn erreichbar, sonst
// so nah wie möglich, Bein gestreckt), Knochenlängen bleiben, das Knie bleibt in seiner Beugeebene (Rückfall: pole).
// Reine Rechnung ohne three.js (tests/node/ik.test.mjs); Einbau in avatars.js (Avatar.fussIK), ?ik=0 = aus.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function quatAchse(ax, ang) { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; }
export function quatMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
export function quatDreh(q, v) {   // v' = q · v · q⁻¹ (wie three.js Vector3.applyQuaternion)
  const [qx, qy, qz, qw] = q, tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
  return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx];
}
export const EINS = [0, 0, 0, 1];

export function zweiKnochen(a, b, c, t, pole = [0, 0, 1]) {
  const eps = 1e-4;
  const ab = sub(b, a), cb = sub(b, c), ca = sub(c, a), ta = sub(t, a);
  const lab = len(ab), lcb = len(cb);
  if (lab < 1e-6 || lcb < 1e-6) return { qHuefte: EINS, qKnie: EINS, erreicht: false };
  const lat = clamp(len(ta), eps, lab + lcb - eps);
  const nca = norm(ca), nab = norm(ab), nta = norm(ta);
  const ac_ab_0 = Math.acos(clamp(dot(nca, nab), -1, 1));
  const ba_bc_0 = Math.acos(clamp(dot(norm(sub(a, b)), norm(sub(c, b))), -1, 1));
  const ac_at_0 = Math.acos(clamp(dot(nca, nta), -1, 1));
  const ac_ab_1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const ba_bc_1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  // Beugeebene: aus dem aktuellen Knie; Bein gestreckt → Pol (Knie zeigt dorthin)
  let ax0 = cross(ca, ab);
  if (len(ax0) < 1e-6 * lab * len(ca)) ax0 = cross(ca, pole);
  ax0 = norm(ax0);
  const r0 = quatAchse(ax0, ac_ab_1 - ac_ab_0), r1 = quatAchse(ax0, ba_bc_1 - ba_bc_0);
  let ax1 = cross(ca, ta), r2 = EINS;
  if (len(ax1) > 1e-9) r2 = quatAchse(norm(ax1), ac_at_0);
  return { qHuefte: quatMul(r2, r0), qKnie: r1, erreicht: len(ta) <= lab + lcb - eps };
}

// Prüfhilfe: Knöchel nach Anwenden der Drehungen
export function knoechelNach(a, b, c, L) {
  const kb = add(a, quatDreh(L.qHuefte, sub(b, a)));
  return add(kb, quatDreh(quatMul(L.qHuefte, L.qKnie), sub(c, b)));
}
export function knieNach(a, b, L) { return add(a, quatDreh(L.qHuefte, sub(b, a))); }

// ---- Ziele (reine Regeln, in avatars.js je Bein angewandt) ----
// Boden: Knöchel bzw. Zehen dürfen nicht unter ihre Ruhehöhe (Sohle auf dem Rasen) – nur anheben, nie herunterziehen.
// Gibt die nötige Anhebung in m zurück (0 = nichts zu tun).
export function bodenHub(knoechelY, zehY, ruheKnoechel, ruheZeh, boden = 0) {
  return Math.max(0, boden + ruheKnoechel - knoechelY, boden + ruheZeh - zehY);
}
// Schuss: Gewicht des Ballkontakts nach dem Kick (kt = Zeit seit Kontakt in s): voll beim Kontakt, nach KICK_T weg
export const KICK_T = 0.12;
// n5: an > 0 = der Fuß greift in `an` s zum Ball (weich ein, weich aus) statt im Kontaktbild voll hinzuspringen (bis 1,5 m
// Ruck in einem Bild gemessen); an = 0 = wie n4
export const KICK_AN = 0.04, KICK_T_GLATT = 0.15;
const ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
export function kickGewicht(kt, an = 0) {
  if (an > 0) return kt >= 0 && kt < KICK_T_GLATT ? 0.85 * (kt < an ? ss(kt / an) : 1 - ss((kt - an) / (KICK_T_GLATT - an))) : 0;
  return kt >= 0 && kt < KICK_T ? 0.85 * (1 - kt / KICK_T) ** 1.5 : 0;
}
// Knöchel-Ziel beim Ballkontakt: hinter dem Ball (Spann trifft), aus Richtung Spieler → Ball, nicht unter Ruhehöhe
export function kickZiel(ball, spieler, r, ruheKnoechel) {
  let dx = ball[0] - spieler[0], dz = ball[2] - spieler[2];
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const back = r + 0.08;
  return [ball[0] - dx * back, Math.max(ruheKnoechel, ball[1] - 0.02), ball[2] - dz * back];
}
