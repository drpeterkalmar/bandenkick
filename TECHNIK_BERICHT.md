# Bandenkick n4 – Technik „Fernsehbild bei 60 fps am Handy“ (08.10.2026)

Auftrag: Peter (05.10.) „… und Bandenkick wie FIFA 28 bei flüssiger Webapp-Leistung“. Grundlage: Grafik-Audit (Abschnitt
2 Bandenkick, Maßnahmen #1, #2, #5–#8, #10), Tricks-Katalog, Grafik-Kern der Stuntbahn (n30). Gebaut in zwei Spuren: die
Leicht-Spur hat ohne Browser vorgebaut (Branch `vorbau/bandenkick-n4-technik`, Übergabe unten eingearbeitet), dieser Lauf
hat auf **rog17** (Windows 11, Ryzen 9 6900HX, RTX 3070 Ti) gemessen, im Bild abgenommen, korrigiert und live gestellt.
Version 0.2.0. Mechanik, Ballphysik, Bots, Steuerung, Gesten und Spielstände sind unverändert.

## Was Peter am Handy sieht

- **Fernseh-Farben:** leicht kräftigere Farben, etwas mehr Tiefe, sehr dezente Abdunklung zu den Ecken. Abends ein
  kühles Flutlicht-Bild; die Strahler auf den Masten leuchten mit einem weichen Schein (Bloom nur abends – tagsüber leuchtet
  nichts, deshalb ist er tags ganz aus).
- **Kontaktschatten:** unter jedem Spieler und unter dem Ball liegt ein weicher dunkler Fleck, der beim Springen verblasst.
  Die Spieler „stehen“ dadurch sichtbarer auf dem Rasen.
- **Tor-Wiederholung wie im Fernsehen:** im Kontakt-Zoom ist der Ball scharf und der Hintergrund (Bande, Zuschauer) weich,
  in der Fan-Cam ebenso. Die TV-Kamera bleibt ganz scharf.
- **Fuß trifft den Ball:** beim Schuss streckt sich das Schussbein zum Ball (vorher stand der Fuß 30–40 cm daneben). Beim
  Stemmschritt stecken die Füße nicht mehr bis zu 18 cm im Rasen.
- **Schärfere, ruhigere Schatten:** die Schattenkarte folgt dem Bildausschnitt statt den ganzen Käfig abzudecken. Nebenwirkung:
  das grieselige „Korn“, das bisher über dem Rasen lag, war Rauschen der groben Schattenkarte – es ist weg, der Rasen wirkt
  ruhiger.
- **Grafik stellt sich selbst ein:** beim Laden misst das Spiel ~0,2 s („Grafik einstellen“) und wählt die Auflösung.
  Im Spiel regelt ein Autopilot auf und ab: ein starkes Handy kommt von Stufe 1 auf Stufe 2, ein schwaches ruckelt nicht
  lange, sondern geht in Schritten zurück (Auflösung → Effekte → Schatten → Stufe). Das Ergebnis merkt sich das Gerät.
- **Leicht weicheres Bild auf Stufe 1:** das Spiel zeichnet auf dem Handy mit 85 % der Auflösung und schärft danach nach
  (statt Kantenglättung des Browsers). Rückennummern und Linien bleiben lesbar; im direkten Vergleich ist das Bild einen
  Hauch weicher, dafür bleibt Grafikleistung für die Effekte.

## Messung vorher/nachher

Gemessen auf **rog17 (RTX 3070 Ti, Windows, ANGLE/Direct3D 11, headless)** mit dem Mess-Gate des Grafik-Kerns
(`tests/perf_gate.py`, Szenen `tests/perf_szenen.json`): Profil Mittelklasse-Android – CPU ×4 gedrosselt, DPR 2,6, Pixel 7
hoch 412 × 915 / quer 915 × 412, Bildrate ungedeckelt, je Szene 10 s. „vorher“ = Stand 8c27fcd (vor n4) aus einer zweiten
Kopie, „nachher“ = n4. **Wechselmodus**: Runde für Runde abwechselnd, 3 Runden, Median (`tests/perf/2026-10-08_ab_nachher.json`).
Hinweis: unter Windows wirkt die CPU-Drosselung deutlich stärker als auf dem Mac (ungedrosselt 3,4 ms je Bild, ×4
gedrosselt ~27 ms statt ~14 ms) – absolute Zahlen sind daher nicht mit den Mac-Berichten vergleichbar, der Vergleich
vorher/nachher auf derselben Maschine schon. Die GPU der Maschine ist nie der Engpass; die Ersparnis der kleineren
Renderskala auf Handy-GPUs zeigt sich hier nicht (GPU-Zeit Stufe 1: 2,99 → 2,88 ms).

| Szene | Gerät | p50 vorher | p50 nachher | p95 vorher | p95 nachher | Δ p95 | Draw-Calls vorher → nachher |
|---|---|---|---|---|---|---|---|
| Menü (Stufe 1) | hoch | 16,7 | 16,7 | 18,1 | 18,1 | ±0 % | 54 → 55 |
| Menü (Stufe 1) | quer | 16,7 | 16,7 | 18,1 | 18,0 | −1 % | 54 → 55 |
| Spiel Stufe 0 | hoch | 14,8 | 15,2 | 33,3 | 33,0 | −1 % | 46 → 45 |
| Spiel Stufe 0 | quer | 14,6 | 14,0 | 33,3 | 32,6 | −2 % | 46 → 43 |
| Spiel Stufe 1 | hoch | 18,5 | 18,4 | 34,7 | 34,7 | ±0 % | 52 → 52 |
| Spiel Stufe 1 | quer | 18,4 | 17,2 | 34,3 | 34,1 | −1 % | 52 → 50 |
| Spiel Stufe 2 | hoch | 20,4 | 22,9 | 34,3 | 32,7 | −5 % | 73 → 73 |
| Spiel Stufe 2 | quer | 20,5 | 22,1 | 34,4 | 33,8 | −2 % | 71 → 72 |
| Spiel Abend Stufe 1 | hoch | 17,4 | 19,1 | 34,4 | 34,8 | +1 % | 51 → 57 |
| Spiel Abend Stufe 1 | quer | 18,6 | 18,5 | 34,8 | 34,5 | −1 % | 52 → 56 |
| Spiel Automatik | hoch | 19,1 | 20,1 | 34,5 | 34,3 | −1 % | 52 → 49 |
| Spiel Automatik | quer | 19,5 | 19,7 | 34,8 | 34,7 | ±0 % | 51 → 47 |
| Training (Ballmaschine) | hoch | 11,1 | 11,1 | 13,6 | 14,5 | +7 %* | 66 → 66 |
| Training (Ballmaschine) | quer | 11,1 | 11,1 | 13,8 | 14,0 | +1 % | 67 → 67 |
| Replay Kontakt-Zoom | hoch | 15,4 | 12,0 | 32,2 | 14,5 | −55 % | 52 → 35 |
| Replay Kontakt-Zoom | quer | 15,5 | 11,2 | 31,6 | 13,8 | −56 % | 52 → 36 |

Alle Werte in ms je Bild. \* Training hoch mit 4 Runden nachgemessen (Spiel-eigene Zähler, A/B): p95 vorher 14,15 /
nachher 14,05 ms, CPU je Bild 9,88 / 9,90 ms → gleich; der +7-%-Wert war Rauschen.

- **Budget p95 je Stufe gleich oder besser: erfüllt** (alle Abweichungen ≤ ±2 % liegen im Rauschen; Abend hoch +1 %).
- **Ehrlich:** auf Stufe 2 ist der Median 8–12 % höher (Kino-Endbild mit MSAA-Render-Target und Umgebungsverdeckung); die
  Spitzen (p95) sind trotzdem kleiner. Abends kosten die Bloom-Durchgänge ~5 Draw-Calls (Median hoch +10 %, p95 gleich).
  Stufe 2 bekommt ein Handy nur, wenn der Autopilot Luft misst.
- **Replay −55 %:** die Figuren werden wieder per Sichtbarkeitsprüfung weggelassen, wenn sie nicht im Bild sind – im
  Kontakt-Zoom sind fast alle außerhalb.
- **Draw-Calls Stufe 2:** 72–73 (Grenze 100). **Ladegröße:** 4,43 → **4,54 MB gzip** (+0,11 MB, Grenze +1 MB).
- Rohmessungen: `tests/perf/2026-10-08_vorher.json` (Einzellauf vorher), `…_vorbau.json` (Vorbau ungeprüft, vor den
  Korrekturen: Stufe 1 p50 +5 %, Stufe 2 p50 +21 %), `…_ab_nachher.json` (Wechselmessung), `…_nachher_lade.json` (Ladegröße).

Was die Korrekturen dieses Laufs gebracht haben (A/B, CPU ×4, Spiel-eigene Zähler):
- Fuß-IK las die Knochenlagen per `getWorldPosition` (rechnet je Aufruf die ganze Elternkette neu): +1,0 ms je Bild für
  6 Figuren → jetzt direkt aus den Weltmatrizen: **±0 ms** (Figuren 5,55 mit / 5,58 ms ohne IK).
- Bloom tagsüber aus (Schwelle 0,97 traf ohnehin nichts): 5 Durchgänge weniger.
- Canvas ohne MSAA, wenn der Kino-Look selbst glättet (spart am Handy das Auflösen eines 4-fach-Bildschirmpuffers).

## Etappen

### E0 Messung vorher – fertig
Mess-Gate unverändert aus dem Grafik-Kern (n30), nur generische Weichen ergänzt: Windows → `--use-angle=d3d11`,
`.js/.mjs` mit `text/javascript` ausliefern (die Windows-Registry kennt `.mjs` oft nicht → die Training-Szene scheiterte),
JSON als UTF-8. Szenen: Menü, Spiel Stufe 0/1/2, Abend, Automatik, Training (Ballmaschine mit Skript-Spieler), Replay im
Kontakt-Zoom; hoch + quer. Kern-Test `tests/test_perf_gate_kern.py` grün.

### E1 Kino-Look – fertig, abgenommen
`src/render/kern/kinolook.js` (Kopie Stuntbahn, rückwärtsverträglich erweitert: eigene Stufen-Tabelle, Vignette-/Himmel-
Bloom-Feld, Bloom-Schwelle von außen), Bandenkick-Stufen in `src/render/kino_logik.js`, Anschluss `src/render/kino.js`.

| Stufe | Endbild | Renderskala [Start, min–max] |
|---|---|---|
| 0 | direkt wie bisher (+ Kontaktschatten), ohne Kantenglättung wie bisher | Pixeldichte-Faktor 0,75–1 |
| 1 (Handy) | Render-Target ohne MSAA, kantenbewusstes Hochskalieren (FXAA-Art) + Nachschärfen 0,7, Bloom abends (¼-Auflösung, 3 Ebenen), TV-Farbkorrektur, Vignette 0,12, Dither | **0,85**, 0,7–0,85 (Canvas DPR 1,5) |
| 2 (Desktop/starkes Handy) | wie 1 + MSAA 4 im Render-Target + Umgebungsverdeckung (8 Abtastungen, **Radius 0,4 m**), Bloom 4 Ebenen | 0,9, 0,7–1 |

Dunst, Blendung, Bewegungsunschärfe aus. Tiefenschärfe nur im Replay (Zoom, Fan-Cam), Fokus auf den Ball.
Kontaktschatten: ein `InstancedMesh` für 6 Figuren + Ball (ersetzt den Ball-Blob; die Deko-Sonnen-/Flutlicht-Schatten aus
n3 bleiben). Punktgrößen (Granulat, Leuchthöfe, Blitzlichter) werden mit der Renderskala korrigiert.

Abnahme am Bild (`tests/technik_shots.py`, Collagen in `tests/shots/technik/`), Änderungen gegenüber dem Vorbau:
- Startskala Stufe 1 0,8 → **0,85**, Nachschärfen 0,45 → **0,7** (0,8 war sichtbar zu weich: Rückennummern, Linien).
- Abend-Farbkorrektur heller (Kontrast 0,18 → 0,08, mehr Gain): mittlere Bildhelligkeit 53,8 → 61,6 (vorher 56,3).
- Tag ohne Bloom, Canvas ohne MSAA bei Kino-Look (s. o.).
- Replay-Tiefenschärfe fokussiert auf den Ball (im Hochformat lag der Ball vor dem Blickpunkt und war unscharf).
- Geprüft und in Ordnung: keine Halos an Linien/Netz, kein Glühen von Ball/Leibchen tags, Kanten der Baum- und Zuschauer-
  Tafeln ohne Säume (das Netz-Moiré am Himmel ist sogar ruhiger), Kontaktschatten unter Füßen und Ball.

### E2 Qualitäts-Autopilot + Avatar-Kosten – fertig, abgenommen (KTX2 bewusst nicht)
- **Autopilot** (`src/render/kern/autopilot.js` + `startprobe.js` unverändert aus der Stuntbahn, Anschluss
  `src/render/grafik.js`): misst Arbeitszeit (CPU + GPU-Timer), regelt auf- und abwärts mit Hysterese; runter: Renderskala →
  Deko schlank → Menschen-Schatten → Stufe, rauf umgekehrt (Stufe erst bei voller Skala). Handy startet auf 1 und darf auf 2.
  Gescheiterte Schritte nach oben lernen ihre echten Kosten (kein Dauer-Probieren). Kurzmessung im Ladebildschirm
  (24 Bilder ≈ 0,2 s), je Gerät gemerkt; zuletzt gefahrene Stufe in `bk_grafik` (21 Tage).
  Browser-Test `tests/test_autopilot.py` (erstmals gelaufen): ohne Last → Stufe 2 nach 10 s; schwere Last → erster Schritt
  nach 1,0 s, bis Stufe 0, Engpass CPU erkannt; Last weg → nach 2,6 s wieder hoch, volle Qualität nach 34 s; an der Kante
  40 s ohne Pendeln. `tests/test_autoq.py` grün.
- **Figuren:** Sichtbarkeitsprüfung wieder an (Kugel 1,25 m, in 10 Extremposen geprüft), außerhalb des Bildes Mischer nur
  jedes 2. Bild. Gewinn im Spiel klein (die TV-Kamera sieht fast alle), im Replay groß (s. Messung).
- **Schattenkamera** (`src/render/schatten.js`): folgt dem Bildausschnitt, Texel-gerastert, Hysterese. Kante hoch
  ±10–14 m, quer ±13–15,5 m statt ±15,5 m. **1024 reicht auf Stufe 2 nicht** (die TV-Kamera sieht fast den ganzen Käfig:
  2,2–2,8 cm statt bisher 1,5 cm je Texel) → Stufe 2 bleibt 2048 (`?schatten2=1024` zum Vergleich), Stufe 1 bis ⅓ schärfer.
- **KTX2 nicht erzeugt:** Stichprobe (Vorbau) ×1,9–4,3 größer als die WebP-Texturen (+1,0 bis +3,2 MB plus ~0,6 MB
  Transcoder) → reißt das Ladebudget (+1 MB); Gewinn wäre nur Grafikspeicher (~45 → ~10 MB). Auf dem rog fehlen zudem
  toktx/basisu. Lader mit `detectSupport` + WebP-Rückfall ist eingebaut (`src/render/avatar_ktx2.js` = `null` → inaktiv,
  Skript `tools/build_ktx2_avatars.mjs`). „Trikot 1024 statt 512“: die Körper-Textur ist schon 1024, das Leibchen ist
  eine 64er-Canvas.

### E3 „EA-FC-Bewegung“ – Fuß-IK fertig, Clips nicht möglich
- **Fuß-IK** (`src/render/ik.js`, `Avatar.fussIK`): analytischer Zwei-Knochen-Löser (Kosinussatz nach Holden), nur wenn
  prozedurale Schichten aktiv sind. Boden: aufrecht dürfen Knöchel/Zehen nicht unter die Ruhehöhe (Stemmschritt ohne IK
  bis 18,4 cm im Rasen, mit IK ≤ 1,2 cm). Ballkontakt: das Schussbein greift beim Kontakt (Kontaktpunkt aus der Simulation)
  zum Punkt hinter dem Ball und blendet in 0,12 s aus. Kosten nach der Korrektur ±0 ms (s. o.) → auf allen Stufen an.
  Bild: `tests/shots/technik/fuss_am_ball_*.jpg`.
- **Kick-/Annahme-/Torwart-Clips: nicht gebaut.** Rocketbox hat keine passenden (474 Clips geprüft, nur cheer/claphands),
  Mixamo braucht ein Adobe-Login, `tools/rb_to_glb.py` kann nur das Biped-Skelett und Blender fehlt auf dem rog. Die
  prozeduralen Technik-Posen bleiben; `?clips=0` entfällt. Vorschlag steht unten.

### E4 Publikum nah (VAT) – bewusst nicht gebaut
Begründung: (1) Budget – Stufe 2 ist im Median schon +10 %, abends kosten die Bloom-Durchgänge; Luft für zusätzliche
Vertex-Last gibt es auf Stufe 1 nicht. (2) Bedingung des Audits („nur wenn die Impostors aus der Fan-Cam-Nähe flach
wirken“) trifft kaum zu: es gibt 20 einzelne Zuschauer in 12–18 m, in der Fan-Cam sind sie jetzt durch die Tiefenschärfe
weich. (3) Reihen um den Käfig wären neue Deko (nicht Auftrag). (4) Back-Werkzeug (Blender für Reduktion + Animation)
fehlt auf dem rog. Lieber vier saubere Etappen.

### E5 Messung nachher + Abschluss – fertig
Messung s. o., Collagen hoch/quer in `tests/shots/technik/` (Flutlicht-Abend Startbildschirm und Spiel, Tag im Spiel,
Replay Kontakt-Zoom und Fan-Cam, Fuß am Ball, Zuschauer/Anlage), „vorher“ jeweils im alten Stand fotografiert
(`tests/technik_collage.py`). Version 0.2.0, Cache-Busting über `tools/update_sw.py`.

## Tests (alle grün, rog17)
`npm test` (alle 28 Node-Testdateien, inkl. kino 42, grafik 24, schatten, avatar 13, ik 14), `tests/smoke.py` (Rauchtest),
`tests/test_touch.py`, `tests/pass_touch.py`, `tests/test_autopilot.py`, `tests/test_autoq.py`, `tests/test_perf_gate_kern.py`,
`tests/test_live.py` nach jeder Landung.

Windows-Tauglichkeit (Mac-Verhalten unverändert): Haupt-Modul-Erkennung der Node-Proben per `pathToFileURL` (vorher lieferte
`keeper_probe` unter Windows nichts → `keeper.test` rot), `avatar_node.mjs` per `fileURLToPath`, `util.py`/`perf_gate.py`
Plattform-Weiche (Direct3D statt Metal), `tools/update_sw.py` schreibt `/`-Pfade und LF.

## URL-Regler (A/B-Links)

| Regler | Wirkung |
|---|---|
| `?kino=0` | Kino-Look aus: direktes Zeichnen, Ball-Blob wie bisher |
| `?look=0\|1\|2` | Kino-Stufe erzwingen (unabhängig von der Grafikstufe) |
| `?kl=-bloom,+ssao` | einzelne Stufen des Endbilds (scale, aa, sharpen, ssao, bloom, flare, aerial, grade, vignette, dither, contact, dof) |
| `?skala=0.85` | feste Renderskala des Kino-Looks |
| `?autopilot=0` | alte Automatik (nur abwärts) |
| `?startprobe=0` | ohne Kurzmessung beim Laden |
| `?schattenkam=0` | Schattenkarte über den ganzen Käfig wie bisher |
| `?schatten2=1024` | Stufe 2 mit 1024er-Karte |
| `?cull=0` | Figuren immer zeichnen und jedes Bild animieren |
| `?ik=0` | Fuß-IK aus |
| `?ktx=0` | KTX2-Avatare nicht benutzen (wirkt erst, wenn erzeugt) |
| `?q=0\|1\|2` | feste Stufe, Autopilot aus |

Altes Aussehen ungefähr: <https://drpeterkalmar.github.io/bandenkick/?kino=0&autopilot=0&schattenkam=0&cull=0&ik=0>
- Neu, Tag: <https://drpeterkalmar.github.io/bandenkick/?licht=tag>
- Neu, Abend mit Flutlicht: <https://drpeterkalmar.github.io/bandenkick/?licht=abend>
- Stufe 2 erzwingen: <https://drpeterkalmar.github.io/bandenkick/?q=2>
- ohne Fuß-IK (Vergleich Schuss/Stemmschritt): <https://drpeterkalmar.github.io/bandenkick/?ik=0>

## Offene Punkte
1. **Echte Handy-Messung** fehlt (rog17 ist ein Windows-Rechner; die Drosselung wirkt dort anders). Am Android per
   Remote-Debugging: `info().auto` zeigt Stufe, Skala, Engpass und Entscheidungen.
2. **Kick-/Annahme-/Torwart-Clips** (Audit #6): braucht Mixamo-Login am Mac. Vorschlag: Clips mit Kontakt-Zeitpunkt in
   `assets/anims/*.json` (`kontakt: s`), Start ~0,2 s vor dem Kontakt aus `pl.pending` + Ballabstand vorhersagen, Gewicht
   über die vorhandene `specialW`-Logik, Fuß-IK zieht den Rest; `?clips=0` als Rückfall. Mixamo-Skelett („mixamorig“)
   braucht in `tools/rb_to_glb.py` eine eigene Knochen-Tabelle. Die Ausholbewegung **vor** dem Kontakt fehlt weiter (die
   Simulation kennt den Kontakt nicht vorher).
3. **KTX2** nur, wenn ein ETC1S-Körper ≤ +1 MB machbar ist (Mac mit toktx; `tools/build_ktx2_avatars.mjs --nur-etc1s`), und
   `update_sw.py` darf dann nicht beide Fassungen vorab laden.
4. **Publikum VAT** (Audit #4) erst, wenn echte Handy-Messungen Luft zeigen.
5. Autopilot: der Schritt „Menschen-Schatten“ wirkt nur auf Stufe 2 – auf Stufe 1 kostet er beim Herunterregeln ein
   Messfenster (~0,5–1,5 s) ohne Wirkung. Klein, aber leicht zu beheben (Schritt nur ab Stufe 2 anbieten).
6. Schattenflimmern beim Kameraschwenk nur an Standbildern geprüft (Texel-Raster ist eingebaut); bitte am Handy beim
   schnellen Konter ansehen.
7. Das Gutachten aus `burn-bandenkick-2026-10-05` (`docs/audit/*gutachten*.md`) lag weder im Repo noch auf dem Mac vor –
   nicht berücksichtigt.
8. TAAU (Kantenglättung über mehrere Bilder) kommt laut Plan aus dem Stuntbahn-Kern n31.
