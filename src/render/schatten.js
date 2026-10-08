// Enge Schattenkamera (n4-Technik, Audit #10): statt den ganzen Käfig (±15,5 m) in die Schattenkarte zu legen, folgt die
// Schattenkamera dem Ausschnitt, den die Spielkamera gerade zeigt (Boden und Figurenhöhe im Bild, auf den Käfig + Rand
// geklemmt). Bei kleinerem Ausschnitt reicht 1024² auch auf Stufe 2, und die Schatten werden schärfer. Gegen Flimmern:
// Kantenlänge in 0,5-m-Schritten mit Hysterese (wird erst kleiner, wenn sie 1 m kleiner sein darf), Mittelpunkt im
// Lichtraum auf ganze Texel gerastert (die Karte verschiebt sich nur um ganze Texel).
// Reine Rechnung ohne three.js (tests/node/schatten.test.mjs); Anschluss in main.js. ?schattenkam=0 = ganzer Käfig wie bisher.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Achsen der Schattenkamera wie three.js (Kamera.lookAt: z = Auge − Ziel, x = oben × z, y = z × x). dir = Richtung ZUR Sonne.
export function lichtAchsen(dir) {
  const Z = norm(dir);
  let up = [0, 1, 0];
  if (Math.abs(Z[1]) > 0.9999) up = [0, 0, Z[1] > 0 ? -1 : 1];   // Sonne senkrecht (three.js weicht genauso aus)
  const X = norm(cross(up, Z)), Y = cross(Z, X);
  return { X, Y, Z };
}

// Sichtbare Fläche: Strahlen der Spielkamera (Richtungen, z. B. vier Ecken + Randmitten) gegen die Ebenen y = 0 (Boden)
// und y = h (Köpfe, Bande, Tor). Strahl über dem Horizont oder weiter als maxDist → Punkt in maxDist. Danach auf das
// Rechteck box = [minX, maxX, minZ, maxZ] (Käfig + Rand) geklemmt. Ecken des Rechtecks, die im Bild liegen (vp = Matrix
// Projektion · Kamera⁻¹ als 16 Zahlen, Spalten wie three.js), kommen dazu – sonst fehlen sie in der Hülle, wenn das Bild über
// den Käfig hinausreicht. Liefert Punkte [x, y, z].
export function bildFlaeche(camPos, dirs, { h = 2.2, maxDist = 60, box = null, vp = null } = {}) {
  const pts = [];
  for (const d of dirs) {
    for (const y of [0, h]) {
      let t = Math.abs(d[1]) > 1e-6 ? (y - camPos[1]) / d[1] : -1;
      if (!(t > 0) || t > maxDist) t = maxDist;
      let x = camPos[0] + d[0] * t, z = camPos[2] + d[2] * t;
      if (box) { x = Math.max(box[0], Math.min(box[1], x)); z = Math.max(box[2], Math.min(box[3], z)); }
      pts.push([x, y, z]);
    }
  }
  if (box && vp) {
    for (const x of [box[0], box[1]]) for (const z of [box[2], box[3]]) for (const y of [0, h]) {
      const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (cw > 1e-6 && Math.abs(cx / cw) <= 1.02 && Math.abs(cy / cw) <= 1.02) pts.push([x, y, z]);
    }
  }
  return pts;
}
// Strahlrichtungen für bildFlaeche: n Punkte je Bildrand (NDC), Reihenfolge egal
export function randPunkte(n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = -1 + 2 * i / n; out.push([t, -1], [1, t], [-t, 1], [-1, -t]); }
  return out;
}

// Ausschnitt der Schattenkarte: Punkte in den Lichtraum, umschließendes Quadrat (halbe Kante ext, in raster-Schritten,
// höchstens maxExt), Mittelpunkt auf Texel gerastert. prevExt = letzte Kante (Hysterese). abstand = Sonne vor dem Ziel (m).
// → { ext, target: [x, y, z], pos: [x, y, z], texel }
export function schattenAusschnitt(pts, dir, { mapSize = 1024, minExt = 5, maxExt = 16, raster = 0.5, prevExt = null, abstand = 40 } = {}) {
  const { X, Y, Z } = lichtAchsen(dir);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zs = 0;
  for (const p of pts) {
    const a = dot(p, X), b = dot(p, Y);
    if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < y0) y0 = b; if (b > y1) y1 = b;
    zs += dot(p, Z);
  }
  if (!pts.length) { x0 = x1 = y0 = y1 = 0; }
  const halb = Math.max((x1 - x0) / 2, (y1 - y0) / 2) + 0.3;   // 30 cm Rand (weiche PCF-Kante)
  let ext = Math.min(maxExt, Math.max(minExt, Math.ceil(halb / raster) * raster));
  if (prevExt != null && ext < prevExt && ext > prevExt - 1.0 - 1e-9 && prevExt <= maxExt) ext = prevExt;   // Hysterese
  const texel = 2 * ext / mapSize;
  const cx = Math.round((x0 + x1) / 2 / texel) * texel, cy = Math.round((y0 + y1) / 2 / texel) * texel;
  const cz = pts.length ? zs / pts.length : 0;
  const target = [X[0] * cx + Y[0] * cy + Z[0] * cz, X[1] * cx + Y[1] * cy + Z[1] * cz, X[2] * cx + Y[2] * cy + Z[2] * cz];
  const pos = [target[0] + Z[0] * abstand, target[1] + Z[1] * abstand, target[2] + Z[2] * abstand];
  return { ext, target, pos, texel, mitte: [cx, cy] };
}

// Prüfhilfe (Tests): liegt ein Weltpunkt im Ausschnitt (Lichtraum relativ zum Ziel)?
export function imAusschnitt(p, dir, aus) {
  const { X, Y } = lichtAchsen(dir);
  const d = sub(p, aus.target);
  return Math.abs(dot(d, X)) <= aus.ext + 1e-6 && Math.abs(dot(d, Y)) <= aus.ext + 1e-6;
}
