// Physik- und Gefühlswerte von Bandenkick. Alles ohne DOM (läuft auch in Node).
// Jeder Wert ist per URL übersteuerbar: ?name=wert (z. B. ?vSprint=8&turfEn=0.62), dazu Kurzformen
// ?dach=0, ?feld=30x15, ?netz=2, ?sprint=8 (siehe ALIASES). Quellen stehen am jeweiligen Wert.

export const DEFAULTS = {
  // ---------------- Ball (FIFA-Spielregel 2: Umfang 68–70 cm, Masse 410–450 g) ----------------
  ballR: 0.11,            // m
  ballM: 0.43,            // kg
  ballK: 2 / 3,           // Trägheitsmoment I = k·m·r² (dünnwandige Hohlkugel)

  // ---------------- Luft ----------------
  g: 9.81,                // m/s²
  rho: 1.2,               // kg/m³ (Hong & Asai 2014, Methods)
  nu: 1.5e-5,             // m²/s kinematische Zähigkeit bei 20 °C → Re = v·d/ν ≈ 14 700·v

  // Drag-Crisis: logistische Kurve cD(Re) (Form wie Goff & Carré 2010, Gl. 3), Stützwerte aus
  // Hong & Asai 2014 (Sci. Rep. 4:5068, Windkanal): unterkritisch cD ≈ 0,5; Abfall ab Re ≈ 1,5–1,7·10⁵;
  // kritisches Re beim herkömmlichen Ball/Brazuca ≈ 2,2–2,8·10⁵ mit cD ≈ 0,15–0,17.
  cdSub: 0.50,
  cdSuper: 0.155,
  reMid: 1.95e5,          // Mitte des Abfalls (≈ 13,3 m/s)
  reWidth: 1.3e4,         // Breite: 95 % → 5 % des Abfalls zwischen Re ≈ 1,57 und 2,33·10⁵ (≈ 10,7…15,9 m/s)
  // Mehr Luftwiderstand mit Spin (überkritisch, Sp > 0,05): cD = c·Sp^d, Goff & Carré 2010 Gl. 4
  // (Fit an die Windkanal-Daten von Asai et al. 2007).
  cdSpinC: 0.4127,
  cdSpinD: 0.3056,
  // Spin klingt in der Luft langsam ab: ω ∝ exp(−Weg/L). Schätzung (~12 % auf 20 m).
  spinDecayL: 150,        // m

  // Flatterball (Hong & Asai 2014): Schwankung von Seiten- und Auftriebskraft ohne Spin, SD ≈ 0,6–3,1 N
  // bei 30 m/s je nach Ball und Lage (Text: Cafusa 1,0–2,2 N, Jabulani 1,1–3,1 N, Teamgeist 2 0,6–0,9 N);
  // Anstieg der SD von 20 auf 30 m/s um ≈ 320 % (herkömmlicher Ball, Brazuca); FFT-Spitze ≈ 2,5 Hz bei 30 m/s
  // → Strouhal-Zahl St = f·d/U ≈ 0,018. Kick-Roboter: 30 m/s, 15°, < 1 Umdrehung → Streuung am Tor in 25 m
  // SD 0,2–0,5 m. Zufall aus dem Seed (Host und Clients sehen dasselbe).
  knuckleF30: 1.5,        // N (SD je Achse bei 30 m/s)
  knuckleExp: 2.9,        // SD ∝ v^2,9 (≈ 320 % Anstieg von 20 auf 30 m/s)
  knuckleSt: 0.0183,
  knuckleSp0: 0.02,       // bis Sp = 0,02 volle Wirkung …
  knuckleSp1: 0.06,       // … ab Sp = 0,06 keine (Spin stabilisiert die Grenzschicht)

  // ---------------- Kunstrasen: FIFA Quality Pro, trocken ----------------
  // Anforderungen (FIFA Test Manual 2024 Teil II): Ballabprall 0,60–0,85 m aus 2,00 m, schräger Abprall
  // 45–60 %, Ballrollen 4,0–8,0 m. Prüfmethoden: FIFA Handbook of Test Methods 2015 (Methoden 01, 02, 03, 17).
  // Die vier Rasenwerte unten sind per tools/calibrate.mjs auf die Zielwerte 0,72 m / 52 % / 6,0 m gestellt.
  turfEn: 0.621,          // Stoßzahl normal (Ball + Rasen)
  turfEx: 0.20,           // tangentiale Stoßzahl (Cross 2002, Grip-Slip-Modell): Kontaktpunkt kehrt um → Überdrall
  turfMuImp: 1.2,         // wirksame Reibung beim Aufprall (Fasern + Granulat „pflügen“)
  turfMuSlide: 0.55,      // Gleitreibung Ball auf Rasen (Schätzung)
  turfRoll0: 0.654,        // Rollwiderstand a = r0 + r1·v (m/s²), zusätzlich zur Luft
  turfRoll1: 0.10,        // 1/s
  turfSpinY: 12,          // rad/s²: Bohrreibung bremst die Drehung um die Hochachse am Boden (μ·N·a/I, a ≈ 2,5 cm)
  concreteEn: 0.8575,     // Beton: Testball 1,35 ± 0,03 m aus 2,00 m (Handbuch 2015); e > √(1,35/2) wegen Luftwiderstand

  // ---------------- Bande, Pfosten, Netze ----------------
  // Bande: harter Kunststoff, Stoßzahl 0,6–0,7 (geschätzt, später per Video-Zeitlupe gestimmt).
  boardEn: 0.65, boardEx: 0.10, boardMu: 0.35,
  // Pfosten/Latte: Stahlrohr Ø 80 mm, harter Abprall.
  postEn: 0.78, postEx: 0.10, postMu: 0.25, postR: 0.04,
  // Netze: weich, Feder-Dämpfer (Ballfangnetz, Dachnetz, Tornetz). Einseitiger Kontakt mit ζ = 1,2 →
  // Stoßzahl ≈ 0,1 (gemessen in tests/node/cage.test.mjs), Eindellung ≈ 0,3 m bei 30 m/s.
  netK: 500,              // N/m
  netZeta: 1.2,
  netMu: 0.8,             // Tangential-Haftung im Netz
  netMaxDepth: 0.9,       // m, dahinter hart (Sicherheitsnetz)
  goalNetK: 350,          // Tornetz etwas weicher
  vRest: 0.25,            // m/s: darunter kein Abprall mehr (liegt/rollt an)

  // ---------------- Feld: DFB-Minispielfeld (Herstellerangaben) ----------------
  fieldL: 20, fieldW: 13, // m Kunstrasen
  boardH: 1.0,            // m Bande
  netH: 2.0,              // m Ballfangnetz über der Bande (ohne Dach); mit Dach reicht das Netz bis zum Dach
  roof: 1,                // Dachnetz an/aus (?dach=0)
  roofH: 5.0,             // m
  goalW: 3, goalH: 2, goalD: 1.0, // Tor 3 × 2 m in der Bande, 1 m tief
  torraum: 4,             // m Halbkreis-Radius (erst ab Nacht 2 aktiv)

  // ---------------- Spieler (Platzhalter-Kapsel) ----------------
  vSprint: 7.5,           // m/s Höchsttempo Sprint
  vRun: 5.2,              // m/s Laufen ohne Sprint
  tauAcc: 0.92,           // s: v(t) = vmax·(1 − e^(−t/τ)) → 0→7 m/s in ≈ 2,5 s
  aBrake: 6.5,            // m/s² Abbremsen
  aLat: 6.0,              // m/s² Querbeschleunigung → Wendekreis r = v²/aLat (7,5 m/s: 9,4 m)
  turnCap: 9.0,           // rad/s Drehrate im Stand/Schritt
  plantAngle: 1.9,        // rad: stärkere Richtungswechsel im Lauf → erst abbremsen
  bodyR: 0.30,            // m Abstand zur Bande
  // Ballführung ohne Klebeball: echte Ballkontakte, Hilfe wählt Stärke/Richtung.
  footAhead: 0.36,        // m Fußpunkt vor dem Körper
  reach: 0.48,            // m Reichweite um den Fußpunkt
  reachH: 0.40,           // m max. Ballhöhe (Mitte) für Fußkontakt
  ctrlRel: 8.0,           // m/s max. Relativtempo für eine saubere Ballannahme
  ctrlRelMax: 15.0,       // m/s darüber prallt der Ball nur ab
  touchLead: 0.45,        // s bis der Ball wieder am Fuß ist (Laufen) …
  touchLeadSprint: 0.85,  // … im Sprint (längere Vorlagen)
  touchExtra: 0.22,       // m Vorlage über den Fußpunkt hinaus (Laufen) …
  touchExtraSprint: 0.70, // … im Sprint
  touchErrDeg: 2.0,       // ° Richtungsfehler je Kontakt (Sprint ×2,5)
  touchErrSpeed: 0.05,    // relativer Stärkefehler je Kontakt (Sprint ×2)
  dribbleSlow: 0.94,      // Tempo mit Ball relativ zu ohne
  assist: 0.75,           // Stärke der Ballführungs-Hilfe (0 = aus)
  assistRelease: 0.06,    // s Zeitkonstante: deutliche Eingabe → Hilfe weg (≤ 0,3 s bis < 5 %)
  assistReturn: 0.5,      // s Zeitkonstante: sanft zurück
  assistAngle: 35,        // ° Abweichung Stick ↔ Ball, ab der die Eingabe „deutlich“ ist
  // Pass und Schuss
  passSpeed: 10.5,        // m/s flacher Pass (Tippen)
  shotMin: 6,             // m/s
  shotMax: 30,            // m/s ≈ 108 km/h (Profi-Maximum)
  chargeT: 1.0,           // s bis voll aufgeladen
  spinMax: 10,            // U/s Innenseite (Kurve)
  backspinMax: 7,         // U/s Heber/Chip
  kickBuffer: 0.6,        // s: Pass/Schuss wird so lange vorgemerkt, bis der Ball erreichbar ist
};

// Kurzformen für Peter (deutsch) → interne Namen
export const ALIASES = {
  dach: 'roof', sprint: 'vSprint', lauf: 'vRun', antritt: 'tauAcc', wende: 'aLat', hilfe: 'assist',
  schuss: 'shotMax', pass: 'passSpeed', bande: 'boardEn', netz: 'netH', dachhoehe: 'roofH',
  abprall: 'turfEn', rollen: 'turfRoll0', effet: 'spinMax', torbreite: 'goalW', torhoehe: 'goalH',
};

// Liest Overrides aus einem Query-String (oder Objekt) und gibt ein vollständiges Parameter-Objekt zurück.
export function makeParams(overrides = {}) {
  const P = { ...DEFAULTS };
  let src = overrides;
  if (typeof overrides === 'string') {
    src = {};
    const q = overrides.replace(/^\?/, '');
    for (const part of q.split('&')) {
      if (!part) continue;
      const i = part.indexOf('=');
      const k = decodeURIComponent(i < 0 ? part : part.slice(0, i));
      const v = i < 0 ? '1' : decodeURIComponent(part.slice(i + 1));
      src[k] = v;
    }
  }
  for (const [k0, v0] of Object.entries(src)) {
    if (k0 === 'feld') {
      const m = String(v0).match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i);
      if (m) { P.fieldL = clamp(+m[1], 10, 60); P.fieldW = clamp(+m[2], 8, 40); }
      continue;
    }
    const k = ALIASES[k0] || k0;
    if (!(k in DEFAULTS)) continue;
    const v = Number(v0);
    if (Number.isFinite(v)) P[k] = v;
  }
  P.roof = P.roof ? 1 : 0;
  P.goalW = clamp(P.goalW, 1, P.fieldW - 2);
  P.goalH = clamp(P.goalH, 0.8, 3);
  P.roofH = Math.max(P.roofH, P.goalH + 0.5);
  // Mit Dach reicht das Seitennetz bis zum Dach (sonst Spalt zwischen Ballfangnetz und Dach).
  P.netTop = P.roof ? Math.max(P.roofH, P.boardH + P.netH) : P.boardH + P.netH;
  return P;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
