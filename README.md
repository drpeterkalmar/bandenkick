# Bandenkick

**Kleinfeldfußball im Käfig** – wie auf einem DFB-Minispielfeld: 20 × 13 m Kunstrasen, 1 m Bande, darüber Netz,
oben ein Dachnetz. Der Ball bleibt immer im Spiel. Handy zuerst (hoch und quer), dazu Desktop und Gamepad.
Als App installierbar (PWA), läuft offline.

▶ **Spielen:** https://drpeterkalmar.github.io/bandenkick/

## Spielidee
- 3 gegen 3 im Käfig, ohne Aus und ohne Unterbrechung außer nach einem Tor (Ziel ab Nacht 2: Bots und bis zu
  6 Menschen online).
- **Stand Nacht 1 („Ball und Käfig“):** eine Figur, ein Ball, zwei Tore. Ball führen, gegen die Bande spielen,
  Effet-Schüsse, Heber, Flatterbälle ins Netz. Nach einem Tor liegt der Ball wieder in der Mitte.
- Nach jedem Schuss zeigt die Anzeige oben Tempo und Effet (z. B. „Schuss 97 km/h · Effet 8,4 U/s“).

## Steuerung
| | |
|---|---|
| **Handy** | **Stick links** (Finger irgendwo in der linken Hälfte aufsetzen): laufen, ganz nach außen = Sprint. **Pass:** tippen. **Schuss:** halten = aufladen (0–30 m/s), loslassen = schießen. **Treffpunkt:** den Finger auf dem Schuss-Knopf verschieben – seitlich = Innenseite mit Effet (bis 10 U/s), unten = Heber mit Rückdrall, Mitte = Vollspann (kaum Drall → Flatterball). **Sprint:** Knopf halten. Keine Wischgesten. |
| **Tastatur/Maus** | WASD oder Pfeile laufen, Shift Sprint. Die Maus zielt (Pass/Schuss in Richtung Mauszeiger). Linksklick oder J: Pass. Leertaste oder rechte Maustaste halten: Schuss aufladen. Beim Loslassen Q/E = Effet links/rechts, R = Heber, F = flach mit Vorwärtsdrall. Esc: Pause. |
| **Gamepad** | Linker Stick laufen, A Pass, X oder RT halten Schuss, rechter Stick Treffpunkt, LB/RB Sprint. |

Hochformat: Tore oben/unten, Kamera hinter dem eigenen Tor. Querformat: Tore links/rechts, Tribünenblick von der
Längsseite. Die Hilfe beim Ballführen zieht nur, solange der Stick grob zum Ball zeigt; eine deutliche Eingabe gibt
sie in unter 0,2 s frei (gemessen 0,18 s).

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
- **Spieler (Platzhalter):** Sprint 7,5 m/s, 0 → 7 m/s in 2,5 s, Laufen 5,2 m/s, Wendekreis r = v²/6 m/s²
  (9,4 m im Sprint, 0,7 m bei 2 m/s). Ballführung mit echten Ballkontakten, kein Klebeball; im Sprint längere Vorlagen.

## URL-Schalter
| Schalter | Wirkung |
|---|---|
| `?dach=0` | ohne Dachnetz (Ballfangnetz 2 m, Ball kann raus → „Aus“) |
| `?feld=30x15` | anderes Feld (Länge × Breite in m) |
| `?netz=2` | Ballfangnetz über der Bande ohne Dach (m) |
| `?sprint=8`, `?lauf=5.5`, `?antritt=0.9`, `?wende=7` | Sprint-/Lauftempo, Antrittszeitkonstante, Querbeschleunigung |
| `?hilfe=0` … `1` | Stärke der Ballführungs-Hilfe |
| `?schuss=32`, `?pass=12`, `?effet=12` | max. Schusstempo, Passtempo, max. Effet (U/s) |
| `?bande=0.7`, `?abprall=0.62`, `?rollen=0.65` | Stoßzahl Bande, Stoßzahl Rasen, Rollwiderstand Rasen |
| `?dachhoehe=6`, `?torbreite=3`, `?torhoehe=2` | Käfig-Maße |
| `?<Parametername>=Wert` | jeder Wert aus `src/sim/params.js`, z. B. `?knuckleF30=3` (stärkeres Flattern) |
| `?q=0/1/2` | Grafikstufe fest (Standard: Handy 1, Desktop 2, mit Automatik: bei < ~42 fps erst Auflösung, dann Schatten runter) |
| `?seed=4711` | fester Zufall (Flatterball, Ballkontakte) |
| `?debug` | Anzeige Bildrate, Draw-Calls, Dreiecke |
| `?play` | Startbildschirm überspringen |

## Technik
- three.js r186 als ES-Module mit Import-Map (`lib/three/`), **kein Build-Schritt**; GitHub Pages; PWA mit
  Service-Worker (Cache-Busting über Inhalts-Hash: `python3 tools/update_sw.py`).
- `src/sim/` – Physik ohne DOM (läuft auch in Node): `params.js` (alle Werte mit Quelle), `aero.js`, `ball.js`,
  `world.js` (Käfig), `player.js`, `step.js` (Spielwelt 120 Hz), `lab.js` (FIFA-Prüfverfahren als Simulation).
- `src/render/` – Szene, Käfig, Ball/Figur/Granulat, Kamera je Format. `src/input/` – Touch, Tastatur/Maus, Gamepad.
- Debug-API für Tests: `window.__game` (`state()`, `info()`, `perf()`, `input()`, `kick()`, `sim()` …).
- Erstladung 3,7 MB (Budget 15 MB).

## Entwicklung und Tests
```bash
npm test                        # alle Node-Tests: FIFA-Rasen, Aerodynamik, Käfig, Spieler (Messtabellen)
node tests/node/fifa.test.mjs   # Fall, Kanone, Rampe (M01/M02/M03/M17) wie im Labor
node tests/node/aero.test.mjs   # Drag-Crisis, Magnus-Kurve, Flatterball-Streuung, Determinismus
node tests/node/cage.test.mjs   # Bande, Netz, Dach, Tore, 1500 Zufallsschüsse: Ball bleibt im Käfig
node tests/node/player.test.mjs # Laufwerte, Wendekreis, Ballführung, Hilfe ≤ 0,3 s, Pass, Schuss
node tools/calibrate.mjs        # Rasenwerte neu auf die FIFA-Ziele stellen
python3 tests/smoke.py          # Browser (Pixel 7 hoch/quer, Desktop): 0 Fehler, Spielablauf, Bande/Dach im Käfig
python3 tests/test_touch.py     # echte Touch-Ereignisse: Stick, Pass, Schuss mit Treffpunkt, Knopfgrößen
python3 tests/perf.py           # CPU- und GPU-Zeit je Bild, Draw-Calls, Dreiecke je Format und Stufe
python3 tests/test_autoq.py     # Qualitäts-Automatik (ohne ?q=) greift, mit ?q= bleibt alles fest
python3 tests/test_live.py      # GitHub Pages: HTTP 200, Version = lokal, 0 Fehler, PWA installierbar, offline
python3 tests/shots.py final    # Fotos nach tests/shots/final/
python3 tools/fetch_assets.py && python3 tools/make_assets.py   # Assets neu bauen
```
Browser-Tests laufen headless über die GPU (ANGLE/Metal), nie zwei Browser gleichzeitig.

## Credits
- **Himmel/Licht:** „Suburban Football Field“ von Grzegorz Wronkowski, Poly Haven, CC0.
- **Rasen-Texturen:** Grass004 und Grass005, ambientCG, CC0 (Kunstrasen umgefärbt, Faser-Normalmap selbst erzeugt).
- **Bibliothek:** three.js (MIT).
- **Physik-Quellen:** Hong & Asai 2014; Asai et al. 2007; Goff & Carré 2009/2010; Cross 2002; FIFA Quality Programme
  for Football Turf (Handbook of Test Methods 2015, Test Manual 2024).

Details: [`LICENSES.md`](LICENSES.md). Code, Käfig, Ball, Figur, Physik: eigene Arbeit (MIT).
Keine Vereins- oder Markenlogos, keine echten Spielernamen.
