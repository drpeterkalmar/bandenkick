# Bandenkick

**Kleinfeldfußball im Käfig** – wie auf einem DFB-Minispielfeld: 20 × 13 m Kunstrasen, 1 m Bande, darüber Netz,
oben ein Dachnetz. Der Ball bleibt immer im Spiel. Handy zuerst (hoch und quer), dazu Desktop und Gamepad.
Als App installierbar (PWA), läuft offline.

▶ **Spielen:** https://drpeterkalmar.github.io/bandenkick/

## Spielidee
- **3 gegen 3 im Käfig** mit Trainingsleibchen: du spielst **Orange** (Mitte, stößt an), zwei Mitspieler und die
  ganze Mannschaft **Blau** sind Bots. Kein Aus, keine Unterbrechung außer nach einem Tor.
- **„Letzte Hand“:** der hinterste Spieler jeder Mannschaft (kleinster Abstand zur eigenen Torlinie; Wechsel erst
  bei ≥ 0,5 m Vorsprung für ≥ 0,3 s) trägt **leuchtende Handschuhe** und einen **Ring am Boden**. Nur er darf die
  Hände nehmen, und nur im **eigenen Torraum** (Halbkreis 4 m): Fangen, Hechten, Abwurf, Abschlag. Außerhalb geht
  keine Handaktion – es gibt keine Handspiel-Pfiffe. Ball in der Hand höchstens **6 s** (Leiste im HUD), solange
  greift niemand an.
- **Nach einem Tor:** kurzer Jubel, alle laufen in ihre Hälfte, dann **Schnellstart** – der Tormann der Mannschaft,
  die das Tor bekommen hat, hat den Ball in der Hand (`?anstoss=1` = klassischer Anstoß in der Mitte).
- **Spielzeit** 2 × 4 min (`?dauer=`), Anzeige Spielstand und Restzeit, Pfiffe zu Halbzeit und Ende,
  **Golden Goal** bei Gleichstand mit `?golden=1`.
- **Menschen:** sechs Rocketbox-Avatare (Microsoft, MIT) mit echten Lauf-, Sprint-, Jubel- und Klatsch-Bewegungen;
  die Laufzyklen laufen phasengleich mit dem gemessenen Schrittweg (kein Fußgleiten), Stemmschritt sichtbar.
- **Bots** (Utility-KI, 3 Stärken `?bots=1…3`): Rollen Ballführer / Anspielstation / Absicherung (letzte Hand),
  beim Gegner am Ball Angreifer (stellt zu) / Decker; sie spielen Pässe, **Bandenpässe** (auch zu sich selbst),
  schießen, befreien, hechten.
- **Training (allein)** im Startmenü bzw. `?solo=1`: Ball und Käfig wie in Nacht 1 (eine Figur, kein Gegner).

## Steuerung
| | |
|---|---|
| **Handy** | **Stick links** (Finger irgendwo in der linken Hälfte): laufen, ganz nach außen = Sprint. **Pass:** tippen. **Schuss:** halten = aufladen (0–30 m/s), loslassen = schießen; Finger auf dem Knopf verschieben = Treffpunkt (seitlich Effet, unten Heber, Mitte Vollspann → flattert). **Sprint:** Knopf halten. **⇄** Spieler wechseln (sonst automatisch zum ballnächsten, nach deinem Pass zum Empfänger). |
| **Als letzte Hand im eigenen Torraum** | Die Knöpfe werden grün umrandet: Schuss-Knopf = **Fangen** (halten), Pass-Knopf = **Hechten** (in Stick-Richtung, ohne Stick zum Ball). Mit Ball: Pass-Knopf = **Abwurf** (auf den Stick bzw. den freiesten Mitspieler), Schuss-Knopf halten = **Abschlag**. Bälle direkt auf den Körper fängst du auch ohne Knopf (`?fanghilfe=0` schaltet das ab). |
| **Tastatur/Maus** | WASD/Pfeile laufen, Shift Sprint, **C/Tab** Wechsel. Maus zielt. Linksklick/J Pass (Torraum: Hechten/Abwurf), Leertaste/Rechtsklick halten Schuss (Torraum: Fangen/Abschlag); beim Loslassen Q/E Effet, R Heber, F flach. Esc Pause. |
| **Gamepad** | Linker Stick laufen, A Pass/Hechten/Abwurf, X oder RT Schuss/Fangen/Abschlag, **Y Wechsel**, rechter Stick Treffpunkt, LB/RB Sprint. |

**Bewegung „zackig“ (Nacht 2):** kleine Richtungswechsel = Kurve (13 m/s² quer, Tempo bleibt), große = **Stemmschritt**
(falsche Anteile mit 16 m/s² gebremst, Körper dreht sofort, Abstoß in die neue Richtung), spritziger Antritt
(0 → 4 m/s in 0,6 s). 90° aus dem Lauf in 0,33 s, aus dem Sprint in 0,47 s. Im Stemmschritt nimmt der Spieler den
Ball mit (Sohle/Außenseite). `?zack=0` = altes Gefühl aus Nacht 1 zum Vergleichen.

## Physik (Kern ohne DOM, fester Takt 120 Hz, deterministisch per Seed)
- **Ball** nach FIFA-Spielregel 2: r = 0,11 m, m = 0,43 kg, Hohlkugel (I = ⅔·m·r²). Luftdichte 1,2 kg/m³.
- **Luftwiderstand mit Drag-Crisis** (Hong & Asai 2014, Sci. Rep. 4:5068, Windkanal): cD ≈ 0,5 unterkritisch,
  Abfall ab Re ≈ 1,5–1,7·10⁵, kritisch bei 2,2–2,8·10⁵ mit cD ≈ 0,15–0,17 → Übergang zwischen ~11 und ~16 m/s.
  Ein harter Schuss fliegt „glatt“; fällt er unter ~16 m/s, bremst die Luft plötzlich stärker (bei 13 m/s 30 % mehr
  Verzögerung als bei 17 m/s). Mit Spin steigt cD überkritisch (Goff & Carré 2010, Gl. 4).
- **Magnus-Kraft:** cL(Sp) aus den Windkanal-Daten von Asai et al. 2007 (Mediane von 5 Messreihen, abgelesen aus
  Goff & Carré 2010, Abb. 6), für große Sp die Flugbahn-Werte von Goff & Carré 2009. Rechenprobe: 25 m/s mit
  cL = 0,25 → 8,3 m/s² quer → 2,9 m Kurve auf 20 m.
- **Flatterball:** ohne Spin schwanken Seiten- und Auftriebskraft (Hong & Asai 2014: SD ≈ 1–2 N bei 30 m/s,
  Spitze ≈ 2,5 Hz → Strouhal ≈ 0,018). Zufall aus dem Seed; Kick-Roboter-Nachbau (30 m/s, 15°, Tor in 25 m):
  Streuung 0,29 m seitlich / 0,28 m vertikal (Paper: 0,2–0,5 m).
- **Kunstrasen** kalibriert auf **FIFA Quality Pro, trocken** – die Prüfverfahren laufen als Tests genau wie im Labor:
  Ballabprall aus 2,00 m (0,72 m; Fenster 0,60–0,85), Kanone 15°/50 km/h (52 %; 45–60 %), Rampe 45° mit
  R 500 mm und Stäben Ø 40 mm (6,0 m; 4,0–8,0), dazu „Reduced Ball Roll“ (Methode 17). Aufprall nach dem
  Grip-Slip-Modell (Cross 2002): Rückdrall bremst, Vorwärtsdrall lässt den Ball nachlaufen.
- **Bande:** hart (Stoßzahl 0,65, Reibung) – Effet ändert den Abprallwinkel (Bandenpass). **Netze:** weich
  (Feder-Dämpfer, Rückprall ≈ 10 %), Netz beult am Ball aus. **Pfosten/Latte:** Stahlrohr Ø 80 mm.
- **Käfig:** 20 × 13 m, Tore 3 × 2 m in der Bande, Bande 1 m, Ballfangnetz, Dachnetz auf 5 m. Mit Dach reicht das
  Seitennetz bis zum Dach (sonst Spalt zwischen 3 und 5 m). Ohne Dach (`?dach=0`) ist das Netz 2 m hoch
  (Oberkante 3 m); fliegt der Ball darüber, gibt es „Aus“ und der Ball kommt zurück.
- **Spieler:** Sprint 7,5 m/s, Laufen 5,2 m/s, 0 → 4 m/s in 0,60 s, 0 → 7 m/s in 2,5 s; Kurve r = v²/13 m/s²
  (4,3 m im Sprint), Stemmschritt 16 m/s². Ballführung mit echten Ballkontakten, kein Klebeball; im Sprint längere
  Vorlagen. Körper als Zylinder (Ball prallt ab, kann aber nie auf einem Spieler liegen bleiben), Spieler schieben
  sich gegenseitig weg (Zweikampf).

## URL-Schalter
| Schalter | Wirkung |
|---|---|
| `?solo=1` | Training allein (Ball und Käfig wie Nacht 1) |
| `?bots=1` … `3` | Stärke der Bots (Reaktion, Tempo, Streuung, Fangsicherheit, Fehlerquote), Standard 2 |
| `?dauer=4`, `?golden=1`, `?anstoss=1` | Minuten je Halbzeit, Golden Goal bei Gleichstand, klassischer Anstoß statt Schnellstart |
| `?torraum=4`, `?fanghilfe=0` | Radius des Torraums (m), Fanghilfe für den menschlichen Tormann aus |
| `?zack=0` | altes Bewegungsmodell aus Nacht 1 (A/B-Vergleich) |
| `?wende=13`, `?stemm=16`, `?bremse=9`, `?kurve=20`, `?antritt=0.672` | Kurven-Querbeschleunigung, Stemmschritt-Bremsung, Abbremsen (m/s²), Winkel bis zur reinen Kurve (°), Antritts-Zeitkonstante (s) |
| `?sprint=8`, `?lauf=5.5` | Sprint-/Lauftempo (m/s) |
| `?hilfe=0` … `1` | Stärke der Ballführungs-Hilfe |
| `?schuss=32`, `?pass=12`, `?effet=12` | max. Schusstempo, Passtempo, max. Effet (U/s) |
| `?dach=0`, `?feld=30x15`, `?netz=2` | ohne Dachnetz (Ball kann raus → Abwurf), anderes Feld, Ballfangnetz ohne Dach (m) |
| `?bande=0.7`, `?abprall=0.62`, `?rollen=0.65` | Stoßzahl Bande, Stoßzahl Rasen, Rollwiderstand Rasen |
| `?dachhoehe=6`, `?torbreite=3`, `?torhoehe=2` | Käfig-Maße |
| `?<Parametername>=Wert` | jeder Wert aus `src/sim/params.js`, z. B. `?keeperDist=0.8`, `?holdMax=8` |
| `?q=0/1/2` | Grafikstufe fest: 0 niedrig, 1 mittel (Handy: Blob-Schatten unter den Menschen), 2 hoch (Echtzeit-Schatten). Ohne `?q=` Automatik: bei < ~42 fps erst Auflösung, dann Menschen-Schatten, dann alle Schatten runter |
| `?ton=0` | ohne Ton (sonst im Pause-Menü umschaltbar) |
| `?figur=kapsel` | Kapsel-Figuren statt Rocketbox-Menschen (Rückfall) |
| `?seed=4711`, `?debug`, `?play` | fester Zufall, Anzeige Bildrate/Draw-Calls, Startbildschirm überspringen |

## Technik
- three.js r186 als ES-Module mit Import-Map (`lib/three/`), **kein Build-Schritt**; GitHub Pages; PWA mit
  Service-Worker (Cache-Busting über Inhalts-Hash: `python3 tools/update_sw.py`).
- `src/sim/` – Physik ohne DOM (läuft auch in Node): `params.js` (alle Werte mit Quelle), `aero.js`, `ball.js`,
  `world.js` (Käfig), `player.js`, `step.js` (Spielwelt 120 Hz), `lab.js` (FIFA-Prüfverfahren als Simulation).
- `src/sim/rules.js` (letzte Hand, Torraum, Hände, 6 s, Schnellstart, Uhr), `src/sim/bots.js` (Utility-KI, Bandenpass
  mit gemessener Abprall-Kennzahl der Ballphysik), Schuss-/Pass-API `Player.kickAt({kind, target, technique})`.
- `src/render/` – Szene, Käfig, Ball/Granulat, `avatars.js` (Rocketbox-Menschen, Lauf-Blend, Leibchen, Posen), Kamera
  je Format. `src/audio/sound.js` – alle Geräusche selbst synthetisiert, per OfflineAudioContext vorgerendert.
  `src/input/` – Touch, Tastatur/Maus, Gamepad.
- **Menschen-Pipeline:** `tools/fetch_rocketbox.py` (nur benötigte Dateien, Rohdaten in `assets_src/`, gitignored) →
  `tools/rb_to_glb.py` (Blender 5.2 headless: Avatar-Export und Retargeting der Clips per Weltrotation auf das
  Referenz-Skelett, Wurzelbewegung raus, Laufzyklen mit gemessenem Tempo) → `tools/pack_avatars.mjs` (gltf-transform:
  WebP 1024²/512², Rotationen Int16, meshopt). Prüfstand: `tools/avatar_view.html` (`tests/avatar_view.py`).
- Debug-API für Tests: `window.__game` (`state()`, `info()`, `perf()`, `input()`, `kick()`, `sim()`, `human()`,
  `bots()`, `newGame()` …).
- Erstladung 6,6 MB (Budget 15 MB): 6 Menschen 1,7 MB, Bewegungen 0,9 MB.

## Entwicklung und Tests
```bash
npm test                        # alle Node-Tests: FIFA-Rasen, Aerodynamik, Käfig, Spieler (Messtabellen)
node tests/node/fifa.test.mjs   # Fall, Kanone, Rampe (M01/M02/M03/M17) wie im Labor
node tests/node/aero.test.mjs   # Drag-Crisis, Magnus-Kurve, Flatterball-Streuung, Determinismus
node tests/node/cage.test.mjs   # Bande, Netz, Dach, Tore, 1500 Zufallsschüsse: Ball bleibt im Käfig
node tests/node/player.test.mjs # Laufwerte, Zack-Zieltabelle (Peters Probe), Kurve, Ballführung, Hilfe ≤ 0,3 s, Pass, Schuss
node tests/node/agility.mjs     # Richtungswechsel-Tabelle wie Peters Probe (z. B. node tests/node/agility.mjs zack=0)
node tests/node/rules.test.mjs  # letzte Hand, Hysterese, Torraum, Hände, 6 s, Hechten, Schnellstart, Spielzeit, Golden Goal
node tests/node/selfplay.test.mjs  # 200 Bot-Spiele à 2 × 4 min: keine Hänger, Tore, beide treffen, Stärken (≈ 2 min)
node tools/calibrate.mjs        # Rasenwerte neu auf die FIFA-Ziele stellen
python3 tests/smoke.py          # Browser (Pixel 7 hoch/quer, Desktop): 0 Fehler; Training: Führen/Schuss/Bande/Dach;
                                #   3 gegen 3: Bots spielen, Tor → Schnellstart, Tormann-Knöpfe, Abwurf, Wechsel, Ton
python3 tests/test_touch.py     # echte Touch-Ereignisse: Stick, Pass, Schuss mit Treffpunkt, Knopfgrößen
python3 tests/perf.py           # CPU- und GPU-Zeit je Bild, Draw-Calls, Dreiecke je Format und Stufe
python3 tests/test_autoq.py     # Qualitäts-Automatik (ohne ?q=) greift, mit ?q= bleibt alles fest
python3 tests/test_live.py      # GitHub Pages: HTTP 200, Version = lokal, 0 Fehler, PWA installierbar, offline
python3 tests/shots.py final    # Fotos Training (Nacht 1) nach tests/shots/final/
python3 tests/shots2.py final   # Fotos 3 gegen 3: Anstoß, Zweikampf, Tormann mit Ball, Hechtsprung, Tor-Jubel, Pause
python3 tests/avatar_view.py    # Avatar-Prüfstand: Clips nebeneinander, Füße/Blickrichtung gemessen
python3 tools/fetch_rocketbox.py && Blender -b --python tools/rb_to_glb.py -- avatar <Name …> && … -- anims m Sports_Male_02 && … -- anims f Sports_Female_02 && node tools/pack_avatars.mjs
python3 tools/fetch_assets.py && python3 tools/make_assets.py   # Assets neu bauen
```
Browser-Tests laufen headless über die GPU (ANGLE/Metal), nie zwei Browser gleichzeitig.

## Credits
- **Himmel/Licht:** „Suburban Football Field“ von Grzegorz Wronkowski, Poly Haven, CC0.
- **Rasen-Texturen:** Grass004 und Grass005, ambientCG, CC0 (Kunstrasen umgefärbt, Faser-Normalmap selbst erzeugt).
- **Menschen und Bewegungen:** Microsoft Rocketbox Avatar Library (MIT, © 2020 Microsoft) – Sports_Male_02/03/04,
  Sports_Female_02, Male_Adult_10, Female_Adult_12 und 16 Bewegungen je Geschlecht.
- **Geräusche:** selbst synthetisiert (Web Audio), keine fremden Aufnahmen.
- **Bibliothek:** three.js (MIT), meshoptimizer-Decoder (MIT).
- **Physik-Quellen:** Hong & Asai 2014; Asai et al. 2007; Goff & Carré 2009/2010; Cross 2002; FIFA Quality Programme
  for Football Turf (Handbook of Test Methods 2015, Test Manual 2024).

Details: [`LICENSES.md`](LICENSES.md). Code, Käfig, Ball, Leibchen, Posen, Physik, Bots, Ton: eigene Arbeit (MIT).
Keine Vereins- oder Markenlogos, keine echten Spielernamen.
