# Bandenkick – Bericht Nacht 1: Ball und Käfig (28.09.2026)

**Live:** https://drpeterkalmar.github.io/bandenkick/ · **Repo:** https://github.com/drpeterkalmar/bandenkick
Alle Punkte aus Nacht 1 sind umgesetzt, live und geprüft. Der Aero-Fallback (konstantes cD) war nicht nötig.

## Was geht
- **Käfig nach DFB-Minispielfeld:** 20 × 13 m Kunstrasen, Bande 1 m (RAL 6005), Tore 3 × 2 m in der Bande,
  Ballfangnetz, Dachnetz auf 5 m. Mit Dach reicht das Seitennetz bis zum Dach, sonst bliebe zwischen 3 und 5 m
  ein Spalt. `?dach=0` = Originalmaße (Netzoberkante 3 m, Ball kann raus → „Aus“, Ball kommt zurück).
  `?feld=30x15` baut Feld, Linien, Käfig und Kamera passend um.
- **Ballphysik** (eigener Kern ohne DOM, 120 Hz, deterministisch per Seed): Drag-Crisis nach Hong & Asai 2014,
  Magnus nach Asai 2007 / Goff & Carré, Flatterball per Seed, Aufprall nach dem Grip-Slip-Modell (Cross),
  Gleiten/Rollen mit Spin, harte Bande, weiche Netze mit sichtbarer Ausbeulung, Pfosten/Latte aus Stahlrohr.
- **Kunstrasen** per Simulation der FIFA-Laborverfahren auf „Quality Pro trocken“ kalibriert (Tabelle unten).
- **Platzhalter-Figur** mit Laufwerten (Sprint 7,5 m/s, 0 → 7 m/s in 2,48 s, Wendekreis tempoabhängig),
  Ballführung mit echten Kontakten (kein Klebeball, im Sprint längere Vorlagen), Pass (tippen), Schuss
  (halten = 0–30 m/s, Treffpunkt = Spin: seitlich bis 10 U/s Effet, unten Heber, Mitte Vollspann = Flatterball).
  Hilfe gibt eine deutliche Eingabe in 0,18 s frei. Anzeige nach jedem Schuss: km/h und Effet.
- **Grafik:** Poly-Haven-HDRI „Suburban Football Field“ (Licht, Himmel im Startbild), Sonne aus dem hellsten
  Bereich (bewölkt → weiches Licht), Kunstrasen aus ambientCG Grass005 umgefärbt + eigene Faser-Normalmap,
  Linien als Decal (inkl. Torraum-Halbkreise 4 m), Naturrasen außen, Netze als Alpha-Textur, Granulat-Partikel
  (schwarzes SBR + Faserstücke) bei Schuss und hartem Aufprall, Schattenfleck unter dem Ball. Erstladung 3,7 MB.
- **Kamera + Steuerung:** hoch = Tore oben/unten (Kamera hinter dem Tor, Spieler bleibt oberhalb der Knöpfe),
  quer = Tore links/rechts (Tribünenblick, Gestell zur Kamera hin ausgeblendet). Stick links, Knöpfe rechts,
  WASD/Maus, Gamepad, keine Wischgesten, `touch-action`/`overscroll` aus. PWA, offline spielbar.
- **Qualitäts-Automatik:** fällt die Bildrate 3 s unter ~42 fps, erst Auflösung runter, dann Schatten aus.

## Gate
| Kriterium | Ergebnis |
|---|---|
| Alle FIFA-Tests grün | **bestanden** – 16/16 (dazu Aero 24/24, Käfig 18/18, Spieler 22/22) |
| Frametime ≤ 16 ms (headless Metal) | **bestanden** – Arbeit je Bild (CPU p95 + GPU p95) höchstens **9,4 ms** |

Zur Frametime ehrlich: Headless läuft der Bildtakt auf diesem Mac heute generell gedrosselt – eine **leere** Seite
schafft nur 13–30 Bilder/s (Last 2,3–2,7 durch die Hermes-Dienste). Der rAF-Abstand (50–87 ms) sagt daher nichts
über das Spiel. Gemessen habe ich stattdessen die tatsächliche Arbeit je Bild: CPU-Zeit (Physik + Szene +
Render-Aufruf) und GPU-Zeit per Timer-Query (`EXT_disjoint_timer_query_webgl2`, läuft headless über Metal).

| Format | Stufe | Auflösung | CPU Ø / p95 (ms) | GPU Ø / p95 (ms) | Draw-Calls | Dreiecke |
|---|---|---|---|---|---|---|
| Handy hoch | 1 | 618×1372 (DPR 1,5) | 2,7 / 4,0 | 2,7 / 2,9 | 45 | 17.977 |
| Handy hoch | 2 | 824×1830 (DPR 2) | 2,7 / 3,5 | 4,6 / 4,9 | 45 | 17.977 |
| Handy quer | 1 | 1372×618 (DPR 1,5) | 2,5 / 3,5 | 2,6 / 2,9 | 43 | 17.273 |
| Handy quer | 2 | 1830×824 (DPR 2) | 2,5 / 4,2 | 4,6 / 5,2 | 43 | 17.273 |
| Desktop | 1 | 1280×720 (DPR 1) | 2,6 / 3,7 | 2,8 / 3,0 | 43 | 17.273 |
| Desktop | 2 | 1280×720 (DPR 1, Schatten 2048²) | 2,5 / 3,6 | 3,0 / 3,1 | 43 | 17.273 |

## Messwerte Physik (Node-Tests, `npm test`)
**FIFA-Rasen (Quality Pro, trocken)** – Verfahren aus dem FIFA Handbook of Test Methods 2015, im Volltext geprüft:

| Prüfung | Messwert | Fenster | Ziel |
|---|---|---|---|
| Ballabprall aus 2,00 m (M01), H = 1,23·T² | **0,72 m** (Scheitel 0,717 m) | 0,60–0,85 m | 0,72 m |
| Testball auf Beton (Kalibrierung) | 1,35 m | 1,32–1,38 m | 1,35 m |
| Schräger Abprall (M02) 15°, 50 km/h | **52 %** (46,3 → 24,1 km/h) | 45–60 % | 52 % |
| – Toleranzecken 13°/17° × 45/55 km/h | je 52 % | 45–60 % | |
| Ballrollen (M03), Rampe 45°, R 500 mm, Start 1,000 m | **6,00 m** (Rampenende 3,11 m/s) | 4,0–8,0 m | 6,0 m |
| Reduced Ball Roll (M17, 4 Höhen, Lichtschranken, Polynom) | 5,99 m | 4,0–8,0 m | 6,0 m |
| Gleiten 8 m/s: Rückdrall / ohne / Vorwärtsdrall 8 U/s | 7,7 / 12,6 / 18,3 m | Rückdrall kürzer, Vorwärts weiter | |

**Aerodynamik**

| Prüfung | Messwert | Quelle/Erwartung |
|---|---|---|
| cD bei Re 1,0 / 2,2 / 2,5 / 2,8·10⁵ | 0,50 / 0,20 / 0,16 / 0,155 | Hong & Asai: ~0,5; krit. 0,15–0,17 |
| Übergang der Drag-Crisis | 10,7 → 15,9 m/s | Plan: ~10…17 m/s |
| Luftbremse bei 13 m/s ÷ 17 m/s | 1,30× (3,19 vs. 2,46 m/s²) | „bremst plötzlich stark“ |
| Seitenbeschleunigung 25 m/s, cL 0,25 | 8,29 m/s² | Plan: ~8 m/s² |
| Kurve auf 20 m (25 m/s, 6,1 U/s, cL₀ 0,25) | **2,87 m** nach links | Plan: ~3 m |
| Innenseite 10 U/s, 25 m/s | 3,21 m | Maximum im Spiel |
| Flatterball, Kick-Roboter-Nachbau (30 m/s, 15°, 25 m, 80 Seeds) | SD 0,29 m seitlich / 0,28 m vertikal | Paper: 0,20–0,51 m |
| Mit Effet 5 U/s | kein Flattern (SD 0,000 m) | |
| Gleicher Seed / anderer Seed | identisch / 1,18 m Unterschied | deterministisch |

**Käfig:** Bande Stoßzahl 0,65; Effet ±8 U/s dreht den Bandenabprall um 10°; Netz-Rückprall 10 %; Dachschuss
30 m/s: max. 5,12 m, bleibt drin; **1500 Zufallsschüsse (5–30 m/s, alle Richtungen, Spin bis 10 U/s): 0× draußen,
0 Numerik-Fehler**; Tor- und Pfostenerkennung; ohne Dach wird „Aus“ erkannt.
**Spieler:** 0 → 7 m/s in 2,48 s, Vmax 7,47 m/s, Laufen 5,2 m/s; Wendekreis-Radius 9,4 / 2,7 / 0,65 m bei
7,5 / 4 / 2 m/s; Führen: Laufen 2,6 m je Kontakt, Sprint 8,8 m je Kontakt; Hilfe frei nach 0,18 s;
Pass 9,9 m/s; Schuss voll 30,0 m/s (Vollspann 0,09 U/s), Innenseite 9,8 U/s, Heber 21°; Schuss nach Aufladen im
Lauf 20/20 sofort beim Loslassen.

## Browser-Tests (headless, Metal)
- `tests/smoke.py`: hoch, quer, Desktop – 0 Page-/Console-Fehler, Führen, Pass, Effet-Schuss, **Schuss 28 m/s gegen
  die Bande und 29 m/s ins Dachnetz: Ball bleibt im Käfig**, Tor erkannt, alle Knöpfe ≥ 48 px.
- `tests/test_touch.py`: echte Touch-Ereignisse – Stick bewegt die Figur in Bildschirmrichtung (cos 1,00), Pass
  tippen, Schuss halten mit Finger am Knopfrand → 8,4 U/s Effet, keine Überlappung, kein Scrollen/Zoom.
- `tests/test_autoq.py`: Automatik senkt die Auflösung bei langsamer Bildfolge, mit `?q=` bleibt alles fest.
- `tests/test_live.py` gegen GitHub Pages: HTTP 200, Version live = lokal, 0 Fehler hoch/quer, PWA installierbar,
  Service-Worker aktiv, offline neu geladen.
- Fotos (mit Vision geprüft): `tests/shots/final/` – hoch, quer, Desktop: Start, Führen, Aufladen, Schuss, Bande,
  Dach, Tor, Live. Gefunden und behoben: Oberrohr des vorderen Gestells quer durchs Bild, Leibchen von oben offen,
  Figur schwebte ohne Beine, grobes Dachnetz-Gitter über dem Rasen, Lade-Ring 1 px breit, ☰-Knopf auf 47 px
  gequetscht, Figur unter den Knöpfen im Hochformat, TOR-Banner über dem Spieler, und im Spielablauf: Aufladen im
  Lauf schob den Ball mit normalen Kontakten weg, der Schuss verfiel → beim Aufladen kurze Vorbereitungs-Kontakte.

## Offene Punkte / Grenzen
- **Echtes Handy ungetestet.** Bildrate und Gefühl nur headless gemessen (siehe Gate).
- **Werte geschätzt, nicht gemessen:** Bande (Stoßzahl 0,65, Reibung 0,35), Netzsteifigkeit, Gleitreibung auf
  dem Rasen (0,55), Spin-Abklingen in der Luft (~12 % auf 20 m). Rollwiderstand-Form a = r₀ + r₁·v: r₁ gesetzt,
  r₀ auf 6,0 m kalibriert.
- **cL-Kurve** aus den Abbildungen abgelesen (Mediane, Genauigkeit ~±0,01); Magnus/Drag unabhängig von der
  Ballorientierung. Flattern ist ein statistisches Modell (Kräfte-SD + Spektrum aus dem Paper), keine Nahtgeometrie.
- **„Reduced Ball Roll“ 2024:** nicht im Volltext – nachgebaut ist Methode 17 aus dem Handbuch 2015 (gleicher Name,
  Rampe wie M03). Sie stimmt mit M03 auf 1 cm überein.
- Schräger Abprall reagiert auf Drall (±3 U/s → 44–60 %); die Norm schreibt eine Kanone ohne Drall vor.
- Repo-Historie: Ein Zwischen-Commit enthielt ~40 MB PNG-Testfotos (im aktuellen Stand gelöscht, jetzt JPG). Das
  Spiel betrifft das nicht; nur der Klon ist größer. Bereinigen ginge nur per History-Rewrite + Force-Push – nicht
  ungefragt gemacht.
- Nur eine Figur, keine Gegner, kein Ton, keine Tor-Wiederholung (Nacht 2–4). Torraum-Linien sind gezeichnet,
  die Regel „letzte Hand“ ist noch nicht aktiv.

## Bitte am Android-Handy testen
1. Link öffnen – lädt es flott? Ruckelt es beim Laufen und bei Schüssen? (Menü ☰ zeigt unten die Version.)
2. **Hochformat:** Stick links unten, Knöpfe rechts gut erreichbar? Sieht man Ball und Figur immer (nicht unter
   den Knöpfen)?
3. **Querformat:** dasselbe; ist das ganze Feld gut lesbar, stört das ausgeblendete vordere Netz?
4. **Ball führen:** Fühlt es sich an wie echtes Dribbeln (kein Klebeball), aber nicht zu schwer? Sprint = längere
   Vorlagen – passt das?
5. **Schuss:** Finger auf dem Schuss-Knopf halten, zur Seite schieben → kommt die Kurve (bis ~3 m)? Mitte = Flatterball
   – sieht man das Flattern? Unten = Heber.
6. **Bande und Netz:** Bandenpass mit Effet, Ball ins Dachnetz – wirkt der Abprall echt, beult das Netz?
7. Rasen: springt und rollt der Ball wie auf Kunstrasen (nach einem Aufsetzer, beim Auslaufen)?
8. „Zum Startbildschirm hinzufügen“ → startet im Vollbild, auch im Flugmodus?
9. Gefühlswerte per URL zum Vergleichen: `?sprint=8`, `?hilfe=0.4`, `?effet=12`, `?bande=0.7`, `?dach=0`.

## Vorschlag Nacht 2 – Menschen und Mannschaft
1. Rocketbox-Pipeline (Blender headless): **ein** Avatar end-to-end (FBX → GLB, 1024²-WebP, meshopt), dann Sports_Male/
   Female; Leibchen in Teamfarbe; Lauf-/Sprint-/Stopp-Animationen aus Rocketbox, Blend nach Tempo.
2. 3 gegen 3 mit Bots (Utility-KI: Ballführer, Anspielstation, Absicherung), Spielerwechsel zum ballnächsten.
3. „Letzte Hand“ im Torraum (Hysterese, Anzeige Handschuhe/Ring), Fangen/Hechten/Abwurf, 6-s-Regel.
4. Schnellstart nach Tor, Spielzeit 2 × 4 min, Golden Goal optional.
5. Ton (vorgerendert: Schuss, Bandenknall, Netz, Pfosten, Umgebung) und Qualitätsstufen feiner.
6. Nach deinem Handy-Test: Gefühlswerte (Sprint, Hilfe, Effet, Bande) nachziehen.
