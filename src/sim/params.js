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
  // Nacht 2c (Peter: „etwas kleinere Spieler bzw größeres Spielfeld“): 24 × 15 m statt 20 × 13 (?feld=20x13 = alt)
  fieldL: 24, fieldW: 15, // m Kunstrasen
  boardH: 1.0,            // m Bande
  netH: 2.0,              // m Ballfangnetz über der Bande (ohne Dach); mit Dach reicht das Netz bis zum Dach
  roof: 1,                // Dachnetz an/aus (?dach=0)
  roofH: 5.0,             // m
  goalW: 3, goalH: 2, goalD: 1.0, // Tor 3 × 2 m in der Bande, 1 m tief
  torraum: 4,             // m Halbkreis-Radius um die Tormitte: nur dort darf die „letzte Hand“ die Hände nehmen

  // ---------------- Spieler ----------------
  vSprint: 7.5,           // m/s Höchsttempo Sprint
  vRun: 5.2,              // m/s Laufen ohne Sprint
  // Bewegungsmodell „zack“ (Nacht 2, Peter: „fühlt sich an wie Auto fahren“): kleine Winkel = Kurve,
  // große Winkel = Stemmschritt (hart bremsen, Körper dreht, Abstoß in die neue Richtung), dann Antritt.
  // ?zack=0 = altes Modell aus Nacht 1 (Laufrichtung dreht nur mit ω = aLat/v wie ein Lenkrad).
  zack: 1,
  aLat: 13,               // m/s² Querbeschleunigung in der Kurve → r = v²/aLat (7,5 m/s: 4,3 m) [?wende=]
  aPlant: 16,             // m/s² Stemmschritt: Bremsen der falschen Geschwindigkeitsanteile [?stemm=]
  aBrake: 9,              // m/s² Abbremsen ohne Richtungswechsel (Stick los, langsamer) [?bremse=]
  curveDeg: 20,           // ° bis hier reine Kurve (Tempo bleibt) …                    [?kurve=]
  plantDeg: 45,           // ° … ab hier reiner Stemmschritt, dazwischen gemischt
  ballAgil: 0.9,          // mit Ball: Kurve und Stemmschritt × 0,9 (Ballführung macht etwas träger)
  // Antritt: dv/dt = (vSprint − v)/τ(v), τ(v) = τ0 + τ1·v/vSprint → erste Schritte spritzig
  // (0 → 4 m/s in 0,60 s), hinten heraus wie gemessen (0 → 7 m/s in 2,5 s, Höchsttempo 7,5 m/s).
  tauAcc0: 0.672,         // s [?antritt=]
  tauAcc1: 0.383,         // s
  // Altes Modell (nur ?zack=0): v(t) = vmax·(1 − e^(−t/τ)), Lenkrad-Drehung, ab plantAngle bremsen
  tauAcc: 0.92,           // s → 0→7 m/s in ≈ 2,5 s
  turnCap: 9.0,           // rad/s Drehrate im Stand/Schritt (beide Modelle)
  plantAngle: 1.9,        // rad: stärkere Richtungswechsel im Lauf → erst abbremsen (altes Modell)
  bodyR: 0.30,            // m Abstand zur Bande
  // Ballführung ohne Klebeball: echte Ballkontakte, Hilfe wählt Stärke/Richtung.
  footAhead: 0.36,        // m Fußpunkt vor dem Körper
  reach: 0.48,            // m Reichweite um den Fußpunkt
  cutReach: 0.85,         // m Reichweite ab Körpermitte im Stemmschritt (Ball mitnehmen mit Sohle/Außenseite)
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
  // Ballmagnet (Nacht 2c): Feder zur Soll-Vorlage vor dem Fuß zwischen den Kontakten, 0 = aus (wie Nacht 2b)
  // Nacht 2d (Peter: „viel mehr Ballmagnet“): 1,2 statt 0,5 (über 1: stärkere Feder, Vorlage/Genauigkeit bei 1 ausgereizt),
  // im Sprint 70 % statt 45 %. ?magnet=0.5&magnetSprint=0.45 = Nacht 2c
  magnet: 1.2,            // Stärke 0…2                                                             [?magnet=]
  magnetK: 112,           // 1/s² Federkonstante quer zur Stick-Richtung bei Stärke 1 (0,3 m daneben → 17 m/s² bei 0,5)
  magnetC: 20,            // 1/s Dämpfung (Tempo des Balls quer ans Tempo des Spielers angleichen)
  magnetAcc: 42,          // m/s² höchste Zugbeschleunigung bei Stärke 1 (0,5 → 21 m/s²)
  magnetSprint: 0.7,      // Anteil im Sprint (Nacht 2c: 0,45)
  magnetTurn0: 60,        // ° Richtungswechsel Stick ↔ Laufrichtung: ab hier wird der Magnet schwächer …
  magnetTurn1: 120,       // ° … bis hier auf 25 %
  magnetSlack: 0.25,      // m so weit darf der Ball über die Soll-Vorlage hinaus rollen, bevor er gebremst wird
  magnetLead: 0.7,        // Vorlagen beim Führen kürzer: Zeit und Weg × (1 − magnetLead · Stärke)
  magnetShield: 0.3,      // m: Gegner nah → Ball zur abgewandten Seite (Abschirmen), 0 = aus
  magnetSlide: 0,         // Nacht 2d: Anteil, solange ein Gegner in ≤ 3 m am Ball grätscht (0 = Magnet aus, Grätsche erobert)
  magnetOpp: 0.5,         // Anteil, wenn ein Gegner ≤ 0,4 m am Ball ist (ab 1 m voll) – Tackles bleiben möglich
  assistRelease: 0.06,    // s Zeitkonstante: deutliche Eingabe → Hilfe weg (≤ 0,3 s bis < 5 %)
  assistReturn: 0.5,      // s Zeitkonstante: sanft zurück
  assistAngle: 35,        // ° Abweichung Stick ↔ Ball, ab der die Eingabe „deutlich“ ist
  // Pass und Schuss
  passSpeed: 10.5,        // m/s flacher Pass (Tippen)
  shotMin: 6,             // m/s
  shotMax: 30,            // m/s ≈ 108 km/h (Profi-Maximum) – Grundtempo; Vollspann/angeschnitten zusätzlich × wucht [?schuss=]
  // Nacht 2d (Peter: „jeweils 1,5x härterer Vollspannschuss und Effetschuss“): Endtempo von Vollspann und angeschnittenen
  // Schüssen (Innen-/Außenrist) × wucht – für Mensch und Bots. Pässe, Chips, Flanken, Luftbälle bleiben. Bei 1,5 bis
  // 45 m/s ≈ 162 km/h. ?wucht=1 = Nacht 2c
  wucht: 1.5,             //                                                                         [?wucht=]
  wuchtDrall: 1,          // Drall der Banane × wucht^wuchtDrall (1 = gleiche Kurve trotz kürzerer Flugzeit, 0 = wie Nacht 2c)
  chargeT: 1.0,           // s bis voll aufgeladen
  spinMax: 10,            // U/s Innenseite (Kurve)
  backspinMax: 7,         // U/s Heber/Chip
  kickBuffer: 0.9,        // s: Pass/Schuss wird so lange vorgemerkt, bis der Ball erreichbar ist

  // ---------------- Nacht 2b: Gesten, Pass, Schuss, Luftbälle ----------------
  // Gesten (src/input/gesture.js). Nacht 2c: Tipp = Standard mit Auto-Stärke, Doppeltipp = Zweitfunktion (Pass hoch,
  // Schuss angeschnitten), kein Aufladen. ?laden=1 = Profi-Grammatik aus Nacht 2b (halten = Stärke, tipp + halten)
  laden: 0,               // 1 = Aufladen per Haltedauer wie Nacht 2b                              [?laden=1]
  doppel: 0.11,           // s Fenster für den zweiten Druck nach dem Loslassen des Tipps (Nacht 2b: 0,25 – mit
                          // ?laden=1 weiter 0,25); Wartezeit eines Einzeltipps = Tippdauer + doppel  [?doppel=]
  tapMax: 0.2,            // s kürzer gedrückt = Tipp (länger gehalten: Standard steht sofort fest)  [?tipp=]
  kickLunge: 0.2,         // m zusätzliche Reichweite für einen vorgemerkten Tipp-Kick (langer Schritt zum Ball)
  tippPuffer: 1.5,        // s ein Tipp-Kick bleibt so lange vorgemerkt (Ball kommt noch: Direktpass, Volley)
  timinghilfe: 1,         // Luftbälle: Technik-Hilfe wählt den besten Moment, falscher Zeitpunkt kostet höchstens
                          // 15 % Timing-Wert (0 = strenges Timing wie Nacht 2b)                       [?timinghilfe=0]
  treffpunkt: 0,          // 1 = Profi: alte Treffpunkt-Steuerung (Fingerlage/Q E R F, freie Richtung) [?treffpunkt=1]
  // Pass: Ziel im Kegel um die Stick-Richtung, in den Laufweg (Roll-/Chip-Tabelle aus ball.js)
  passCone: 35,           // ° halber Kegel um die Stick-/Blickrichtung                              [?kegel=]
  passInnenDeg: 60,       // ° bis hier Innenseite/Vorfuß, darüber Außenrist …                       [?innen=]
  passHackeDeg: 120,      // ° … ab hier Hacke (wenn der Ball nah am Standbein ist)                  [?hacke=]
  hackeNear: 0.6,         // m Ball ↔ Körpermitte für einen Hackenpass
  passMaxSpeed: 22,       // m/s härtester Pass
  passFree: 7,            // m Pass in den freien Raum (Tipp, kein Mitspieler im Kegel)
  // Nacht 2e (Peter: „repariere das Passsystem, die Pässe gehen irgendwo hin“), gemessen mit tests/node/pass_probe.mjs:
  // Empfänger steuert der gehaltene Daumen nicht vom Ball weg, Empfänger läuft dem Pass entgegen, Bots jagen den eigenen
  // Pass nicht, kein Spielerwechsel/keine Grätsche statt des vorgemerkten Passes, Empfänger bleibt ab dem Tipp gesetzt.
  passfix: 1,             // 0 = Passsystem wie Nacht 2d (A/B)                                      [?passfix=0]
  passNoise: 0.8,         // ° Grund-Streuung eines Passes (× Technik, Sprint × 1,3; Nacht 2d: 1,1 und × 1,6)
  passArr: 5.5,           // m/s Ankunftstempo eines Tipp-Passes (+ 0,15 m/s je Meter; Nacht 2d: 4,3 + 0,12/m)
  chipElevMin: 25,        // ° Chip/Lupfer: flach bei weiten …   (Nacht 2b, gilt mit ?flanke=0)      [?chipmin=]
  chipElevMax: 45,        // ° … steil bei kurzen Pässen (auch Nacht 2c: kurzer Chip über den Tormann) [?chipmax=]
  // Nacht 2c (Peter: „festere … flanken“): Pass hoch über Distanz flacher und schneller, weniger Rückdrall.
  // ?flanke=0 … 1 mischt alt (25–45°, 5 U/s) und neu; bis 5 m bleibt der Chip steil (chipElevMax)
  flanke: 1,              // 1 = feste Flanke, 0 = hoher Chip wie Nacht 2b                            [?flanke=]
  flankeElev: 24,         // ° Abflug bei flankeD …
  flankeD: 8,             // m …
  flankeMin: 14,          // ° … ab 15 m
  flankeBack: 2.5,        // U/s Rückdrall der Flanke (Nacht 2b: 5)
  // Schuss: Ziel automatisch (Ecke nach freiem Winkel am Tormann vorbei), Qualität q aus der Lage
  schusshilfe: 1,         // Nachsicht der Lage-Bewertung: q_eff = q^(1/Wert); 2 = nachsichtig, 0,5 = streng [?schusshilfe=]
  shotZ: 1.0,             // m Ecke: seitlich von der Tormitte (Pfosten innen bei 1,46 m)
  shotLow: 0.35,          // m Ecke flach (Ballmitte) …
  shotHigh: 1.45,         // m … bzw. hoch (Latte innen bei 1,96 m)
  curveSpeed: 0.85,       // angeschnitten: Tempo × 0,85 gegenüber Vollspann (Nacht 2b, gilt mit ?banane=0)
  // Nacht 2c (Peter: „festere bananenschüsse“): angeschnitten fast so hart wie Vollspann, Drall wächst mit dem Tempo
  banane: 1,              // 1 = feste Banane, 0 = wie Nacht 2b (Zwischenwerte mischen)            [?banane=]
  bananeSpeed: 1.0,       // angeschnitten: Grundtempo wie Vollspann (die Lage-Qualität q kostet etwas mehr)
  bananeSpin: 25,         // m/s: bis zu diesem Tempo wächst der Drall mit (Nacht 2b: bis 25 m/s, dann fest) …
  bananeSpinMax: 1.2,     // … höchstens × 1,2
  aussenSpin: 0.75,       // Außenrist: Drall × 0,75 …
  aussenNoise: 1.35,      // … und Streuung × 1,35
  // Luftbälle: Kopfball, Volley, Dropkick, Seitfallzieher, Fallrückzieher, Flugkopfball
  luft: 1,                // Faktor auf alle Höhenfenster                                            [?luft=]
  airHorizon: 0.9,        // s Vorschau: Ball in dieser Zeit erreichbar → Luftball-Technik
  jumpMax: 0.6,           // m Sprunghöhe beim Kopfball
  headH: 1.78,            // m Ballmitte am Kopf im Stand
  fallT: 0.8,             // s am Boden nach Seit-/Fallrückzieher
  // Grätsche (Nacht 2c, Peter: „wenn nicht am ball hingrätschen für pass und schuss“): nicht am Ball, Pass oder Schuss
  // gedrückt, Ball bzw. ballführender Gegner ≤ tackleReach m und ein Gegner näher am Ball → Grätsche in Ballrichtung
  graetsche: 1,           // 0 = aus (dann läuft der Spieler wie bisher hin und merkt den Kick vor)    [?graetsche=0]
  tackleReach: 2.5,       // m Abstand Körper ↔ Ball, bis zu dem gegrätscht wird
  slideT: 0.5,            // s Rutschen
  slideGroundT: 0.6,      // s danach am Boden
  slideSpeed: 6.0,        // m/s Anfangstempo des Rutschens (mindestens, sonst das Lauftempo)
  tackleBall: 0.4,        // m: so viel weiter weg als der Gegner (entlang der Beine) zählt der Ball noch als „zuerst“ (Nacht 2c:
                          // 0,1 – mit dem stärkeren Magnet liegt der Ball enger am Fuß des Gegners, Grätschen sollen weiter erobern)
  tackleShotD: 11,        // m: Schuss-Knopf schießt aus der Grätsche aufs Tor, wenn das Tor näher ist, sonst klärt er
  zeitlupe: 1,            // Zeitlupe + Kurz-Zoom bei spektakulären Luftbällen (0 = aus)            [?zeitlupe=0]
  // Nacht 2d (Peter: „nach tor Actionreplay mit extrem zoom und effekt fan cam slo mo im moment des Ballkontaktes und im
  // Torbereich“): Wiederholung nach jedem Tor im Spiel (nicht im Training), nach replayDelay s Live-Jubel; Tippen überspringt
  replay: 1,              // 0 = aus (sonst im Pause-Menü umschaltbar)                              [?replay=0]
  replayDelay: 1.0,       // s Live-Jubel vor der Wiederholung
  // Verschönerung (Peter 05.10.: „mehr Details und Eye Candy“, reine Optik): Himmel, Rasen, Schatten, Umgebung,
  // Zuschauer, Effekte. 0 = Aussehen wie Nacht 2e (A/B-Vergleich)                                        [?deko=0]
  deko: 1,

  // ---------------- Spiel 3 gegen 3 (Plan: „letzte Hand“, Schnellstart, Spielzeit) ----------------
  perTeam: 3,             // Spieler je Mannschaft
  botLevel: 2,            // Stärke der Bots 1 (leicht) … 3 (stark)                  [?bots=]
  dauer: 4,               // min je Halbzeit (2 Halbzeiten)                           [?dauer=]
  golden: 0,              // 1 = bei Gleichstand Golden Goal statt Unentschieden      [?golden=]
  anstoss: 1,             // Anstoß in der Mitte nach Tor (Peter 30.09.; war 0 = Schnellstart, Tormann hat den Ball) [?anstoss=0]
  // „Letzte Hand“: hinterster Spieler (kleinster Abstand zur eigenen Torlinie), Wechsel erst, wenn ein anderer
  // mindestens keeperDist näher an der Linie ist, und das mindestens keeperT lang (kein Flackern).
  keeperDist: 0.5,        // m
  keeperT: 0.3,           // s
  holdMax: 3,             // s Ball in der Hand, dann automatisch Abwurf (Nacht 2e: 3 statt 6 – Peter: „nicht so lange in der Hand“)
  // Nacht 2e: Tormann gibt den Ball schnell weiter. Bot-Tormann: Abwurf typisch nach ≤ halten s (sicherer Passweg), danach
  // auch auf einen weniger freien Mitspieler, spätestens nach halten + 0,8 s weiter Abschlag in die freiere Hälfte (kein
  // abgefangener Abwurf vor dem eigenen Tor). 0 = alt (Nacht 2d: 0,8–2,2 s, ohne freien Weg bis ≈ 4–4,6 s warten)
  halten: 1.2,            //                                                                         [?halten=]
  // Nacht 2e (Peter: „erlaube keinen Rückpass“): der eigene Tormann (letzte Hand im Torraum) ist kein Pass-Empfänger, und
  // spielt ein Mitspieler ihm den Ball absichtlich zu (Pass/Schuss mit dem Fuß, nicht abgefälscht), darf er ihn nicht mit den
  // Händen nehmen – er spielt ihn wie ein Feldspieler (kein Freistoß, nur ein Hinweis). 1 = alt (Rückpass erlaubt)
  rueckpass: 0,           //                                                                         [?rueckpass=1]
  fanghilfe: 1,           // Mensch als Tormann fängt Bälle auf den Körper (≤ 55 cm) auch ohne Knopf [?fanghilfe=0]
  // Nacht 2c (Peter: „Torwart soll alleine fangen und hechten ohne eigene Knöpfe. Cpu goalie ist zu stark.“)
  autoTorwart: 1,         // Mensch als letzte Hand: Fangen/Hechten automatisch (Stärke = alte Bot-Stufe 2), Knöpfe
                          // nur mit Ball (Abwurf/Abschlag); 0 = grüne Tormann-Knöpfe wie Nacht 2b       [?autotorwart=0]
  autoWurf: 1.0,          // s ohne Eingabe mit Ball in der Hand, dann wirft der Auto-Torwart selbst ab (Nacht 2e: 1 statt 2) [?autowurf=]
  tormann: 0,             // Stärke der CPU-Tormänner 1…3 (Zwischenwerte erlaubt), 0 = wie die Mannschaft [?tormann=]
  catchReach: 0.92,       // m Reichweite der Hände waagrecht (Körpermitte → Ball, mit Strecken; Nacht 2b: 1,0 → 0,92)
  catchLow: 0.12,         // m … bis zu dieser Höhe (Ballmitte) aufnehmen …
  catchHigh: 2.35,        // m … bis zu dieser Höhe fangen (mit Strecken)
  catchMaxRel: 24,        // m/s darüber nur abwehren (Ball prallt ab)
  diveSpeed: 5.2,         // m/s seitlich beim Hechten
  diveT: 0.38,            // s Flugphase des Hechtsprungs
  diveReach: 1.25,        // m Reichweite im Hechtsprung
  groundT: 0.5,           // s danach am Boden (Landung und Aufstehen; Nacht 2c: 0,75 – bei viel mehr Hechtsprüngen lag er
                          // sonst bei jedem Nachschuss noch am Boden)
  // Nacht 2d (Peter: „Torwart soll viel mehr hechten“): Hecht-Entscheidung der Tormänner (CPU und Auto-Torwart)
  hechten: 1,             // 0 = wie Nacht 2c (nur wenn Laufen nicht reicht, ≤ 0,5 s vor dem Ball)    [?hechten=0]
  hechtAb: 0.7,           // m: Ball so weit neben dem Körper aufs Tor → hechten, auch wenn Laufen reichen würde [?hechtAb=]
  hechtKnapp: 0.5,        // m: Ball so knapp neben dem Pfosten → hechtet trotzdem (Spektakel)
  hechtVorlauf: 0.7,      // s: frühester Absprung vor dem Ball (Nacht 2c: 0,5)                       [?hechtVorlauf=]
  diveArmT: 0.2,          // s bis die Arme im Hechtsprung ganz gestreckt sind (Nacht 2c: sofort, 0)
  hechtTMax: 0.7,         // s längste Flugphase (früher Absprung: fliegt, bis der Ball da ist)
  throwSpeed: 11,         // m/s Abwurf (flach geworfen)
  punt: 21,               // m/s Abschlag aus der Hand
  celebrateT: 2.6,        // s Jubel nach dem Tor, dann Anstoß (bzw. Schnellstart mit ?anstoss=0)
  switchT: 0.6,           // s Mindestabstand zwischen automatischen Spielerwechseln
};

// Kurzformen für Peter (deutsch) → interne Namen
export const ALIASES = {
  dach: 'roof', sprint: 'vSprint', lauf: 'vRun', antritt: 'tauAcc0', wende: 'aLat', hilfe: 'assist',
  schuss: 'shotMax', pass: 'passSpeed', bande: 'boardEn', netz: 'netH', dachhoehe: 'roofH',
  abprall: 'turfEn', rollen: 'turfRoll0', effet: 'spinMax', torbreite: 'goalW', torhoehe: 'goalH',
  stemm: 'aPlant', bremse: 'aBrake', kurve: 'curveDeg', bots: 'botLevel',
  tipp: 'tapMax', autotorwart: 'autoTorwart', autowurf: 'autoWurf', kegel: 'passCone', innen: 'passInnenDeg', hacke: 'passHackeDeg', chipmin: 'chipElevMin', chipmax: 'chipElevMax',
};
// ?zack=0: Werte des alten Bewegungsmodells (Nacht 1), sofern nicht ausdrücklich übersteuert
const ZACK0 = { aLat: 6.0, aBrake: 6.5 };
// ?laden=1: Fenster für den zweiten Druck wie Nacht 2b, sofern nicht ausdrücklich übersteuert
const LADEN1 = { doppel: 0.25 };
// ?halten=0: Tormann mit Ball wie Nacht 2d (6 s Zwangsabwurf, Auto-Torwart nach 2 s), sofern nicht ausdrücklich übersteuert
const HALTEN0 = { holdMax: 6, autoWurf: 2 };
const ZACK0_ALIAS = { antritt: 'tauAcc' };

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
  const zack0 = String(src.zack ?? '1') === '0';
  const set = new Set();
  for (const [k0, v0] of Object.entries(src)) {
    if (k0 === 'feld') {
      const m = String(v0).match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i);
      if (m) { P.fieldL = clamp(+m[1], 10, 60); P.fieldW = clamp(+m[2], 8, 40); }
      continue;
    }
    const k = (zack0 && ZACK0_ALIAS[k0]) || ALIASES[k0] || k0;
    if (!(k in DEFAULTS)) continue;
    const v = Number(v0);
    if (Number.isFinite(v)) { P[k] = v; set.add(k); }
  }
  if (zack0) for (const [k, v] of Object.entries(ZACK0)) if (!set.has(k)) P[k] = v;
  if (P.laden) for (const [k, v] of Object.entries(LADEN1)) if (!set.has(k)) P[k] = v;
  if (!P.halten) for (const [k, v] of Object.entries(HALTEN0)) if (!set.has(k)) P[k] = v;
  P.zack = P.zack ? 1 : 0;
  P.roof = P.roof ? 1 : 0;
  P.goalW = clamp(P.goalW, 1, P.fieldW - 2);
  P.goalH = clamp(P.goalH, 0.8, 3);
  P.roofH = Math.max(P.roofH, P.goalH + 0.5);
  // Mit Dach reicht das Seitennetz bis zum Dach (sonst Spalt zwischen Ballfangnetz und Dach).
  P.netTop = P.roof ? Math.max(P.roofH, P.boardH + P.netH) : P.boardH + P.netH;
  return P;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
