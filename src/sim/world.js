// Käfig-Geometrie (DFB-Minispielfeld + Dachnetz) als Kollisionsdaten: Rechtecke (Bande hart, Netze weich)
// und Rohre (Pfosten, Latte). Koordinaten: x entlang des Feldes (Tore bei x = ±L/2), z quer, y nach oben.
// Die Grafik baut dieselben Maße (render/field.js), damit Kollision = Bild.

function rect(kind, o, n, u, v, hu, hv, tag) {
  return { kind, o, n, u, v, hu, hv, tag };
}

export function buildCage(P) {
  const hx = P.fieldL / 2, hz = P.fieldW / 2, bH = P.boardH, top = P.netTop;
  const gw = P.goalW / 2, gH = P.goalH, gD = P.goalD;
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const neg = (a) => [-a[0], -a[1], -a[2]];
  // n7 Vorlagen E5 #10 (Vorlage D, angepasst): abgeschrägte Ecken – je Ecke eine 45°-Wand (Bande + Netz bis oben) mit Schenkel
  // ecke m; Längs- und Stirnseiten werden um ecke kürzer. 0 = eckig wie bisher
  const ecke = Math.max(0, Math.min(P.eckschraege || 0, hz - gw - 0.3, hx - 1));
  const rects = [];
  for (const s of [1, -1]) {
    // Längsseiten z = ±hz: Bande 0…bH, darüber Netz bis top
    rects.push(rect('board', [0, bH / 2, s * hz], neg([0, 0, s]), X, Y, hx - ecke, bH / 2, 'side'));
    rects.push(rect('net', [0, (bH + top) / 2, s * hz], neg([0, 0, s]), X, Y, hx - ecke, (top - bH) / 2, 'sidenet'));
    // Stirnseiten x = ±hx: Bande neben dem Tor, Netz neben und über dem Tor
    for (const t of [1, -1]) {
      const zc = t * (gw + hz - ecke) / 2, hw = (hz - ecke - gw) / 2;
      rects.push(rect('board', [s * hx, bH / 2, zc], neg([s, 0, 0]), Z, Y, hw, bH / 2, 'end'));
      if (gH > bH) rects.push(rect('net', [s * hx, (bH + gH) / 2, zc], neg([s, 0, 0]), Z, Y, hw, (gH - bH) / 2, 'endnet'));
      if (ecke > 0) { // Ecke (s, t): von (s·(hx − ecke), t·hz) nach (s·hx, t·(hz − ecke)), Normale schräg ins Feld
        const c = Math.SQRT1_2, o = [s * (hx - ecke / 2), 0, t * (hz - ecke / 2)], n = [-s * c, 0, -t * c], u = [s * c, 0, -t * c], hu = ecke * c;
        rects.push(rect('board', [o[0], bH / 2, o[2]], n, u, Y, hu, bH / 2, 'corner'));
        rects.push(rect('net', [o[0], (bH + top) / 2, o[2]], n, u, Y, hu, (top - bH) / 2, 'cornernet'));
      }
    }
    rects.push(rect('net', [s * hx, (gH + top) / 2, 0], neg([s, 0, 0]), Z, Y, hz - ecke, (top - gH) / 2, 'endnet'));
    // Torraum hinter der Linie: Rückwand, Seiten, Dach (Tornetz)
    rects.push(rect('goalnet', [s * (hx + gD), gH / 2, 0], neg([s, 0, 0]), Z, Y, gw, gH / 2, 'goalback'));
    for (const t of [1, -1]) {
      rects.push(rect('goalnet', [s * (hx + gD / 2), gH / 2, t * gw], neg([0, 0, t]), X, Y, gD / 2, gH / 2, 'goalside'));
    }
    rects.push(rect('goalnet', [s * (hx + gD / 2), gH, 0], neg(Y), X, Z, gD / 2, gw, 'goalroof'));
  }
  if (P.roof) rects.push(rect('net', [0, top, 0], neg(Y), X, Z, hx, hz, 'roof'));
  // Nacht 2d (Wucht bis 45 m/s): Mit Dach hängen Dach- und Außennetze an den Kanten zusammen. Beult ein harter Ball das
  // Dach in einer Ecke aus, darf er dort nicht über die Kante des Seitennetzes entwischen (bei 30–52 m/s gemessen:
  // 23 von 1500 Zufallsschüssen draußen) → die Kollision der Außennetze reicht um die größte Eindellung über die Kante
  // hinaus (nur Kollision, die Grafik bleibt)
  // Ebenso das Tornetz: ein harter Schuss in die Ecke beult die Rückwand bis zur Sicherheitsgrenze aus – dort darf er
  // nicht seitlich oder oben an der Kante vorbei (Selbstspiel mit Wucht 1,5: 4 von 16 Spielen Ball hinter dem Tor).
  // Seiten- und Dachnetz des Tors reichen deshalb nach hinten, die Rückwand nach außen über ihre Kanten (nie ins Feld).
  {
    const e = P.netMaxDepth + 0.3;
    for (const R of rects) {
      if (R.kind !== 'goalnet') continue;
      const back = R.o[0] > 0 ? [0, e] : [e, 0];                                    // u = x: nur weg vom Feld
      if (R.tag === 'goalback') R.ext = [e, e, 0, e];
      else if (R.tag === 'goalside') R.ext = [...back, 0, e];
      else R.ext = [...back, e, e];                                                  // Tordach
    }
  }
  if (P.roof) {
    const e = P.netMaxDepth + 0.3;
    for (const R of rects) {
      if (R.kind !== 'net') continue;
      if (R.tag === 'roof') R.ext = [e, e, e, e];                                   // [u−, u+, v−, v+]
      else if (R.tag === 'sidenet' || R.tag === 'cornernet' || R.o[1] > gH) R.ext = [e, e, 0, e]; // Seiten-/Stirn-/Ecknetz bis zum Dach
      else R.ext = R.o[2] > 0 ? [0, e, 0, 0] : [e, 0, 0, 0];                        // Netz neben dem Tor: nur nach außen
    }
  }

  // Rohre: Pfosten und Latte (Segment a→b, Radius)
  const bars = [];
  for (const s of [1, -1]) {
    for (const t of [1, -1]) bars.push({ a: [s * hx, 0, t * gw], b: [s * hx, gH, t * gw], r: P.postR, tag: 'post' });
    bars.push({ a: [s * hx, gH, -gw], b: [s * hx, gH, gw], r: P.postR, tag: 'bar' });
  }
  return { hx, hz, bH, top, gw, gH, gD, rects, bars, roof: !!P.roof, ecke };
}

// n7 E5: Punkt (Objekt mit x, z) mit Abstand r vor der Eck-Schräge halten (Spieler, Zielpunkte) → true, wenn verschoben
export function clampCorner(cage, o, r = 0) {
  if (!cage.ecke) return false;
  const ax = Math.abs(o.x), az = Math.abs(o.z), c = cage.hx + cage.hz - cage.ecke - r * Math.SQRT2;
  if (ax + az <= c) return false;
  const d = (ax + az - c) / 2;
  o.x -= Math.sign(o.x) * d; o.z -= Math.sign(o.z) * d;
  return true;
}

// Liegt der Ballmittelpunkt komplett hinter einer Torlinie (im Tor)? → +1 / −1 (Seite), sonst 0
export function goalSide(cage, p, r) {
  if (Math.abs(p.z) < cage.gw && p.y < cage.gH) {
    if (p.x > cage.hx + r) return 1;
    if (p.x < -cage.hx - r) return -1;
  }
  return 0;
}

// Ball außerhalb des Käfigs (nur ohne Dach möglich, oder bei einem Fehler)
export function outOfCage(cage, p) {
  const inGoal = Math.abs(p.z) < cage.gw + 0.3 && Math.abs(p.x) < cage.hx + cage.gD + 0.5 && p.y < cage.gH + 0.3;
  if (inGoal) return false;
  return Math.abs(p.x) > cage.hx + 0.4 || Math.abs(p.z) > cage.hz + 0.4 || p.y > cage.top + 1.5 || p.y < -0.5;
}
