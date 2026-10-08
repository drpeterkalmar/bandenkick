# Vorbau `bandenkick-n4-technik` (Leicht-Spur, 08.10.2026)

Branch `vorbau/bandenkick-n4-technik` (von `origin/main` 8c27fcd), alles gepusht, **main unberührt**. Kein Browser, kein
Server, kein Bundler gelaufen – alles unten ist nur mit Node-Tests (an echten Rocketbox-Skeletten, gegen die echte
three.js-Mathematik) und Syntaxprüfungen belegt. **Nichts davon ist im Bild oder in der Bildzeit geprüft.**

Reihenfolge für den Heavy-Job:
1. **Vorher-Messung auf main** (vor dem Merge): `python3 tests/perf_gate.py --szenen tests/perf_szenen.json --stand vorher`
   – Gate und Szenen-Datei liegen nur auf dem Branch → für den Lauf auf main z. B. `git worktree add ../bandenkick_vorher main`
   und dort `tests/perf_gate.py` + `tests/perf_szenen.json` aus dem Branch hineinkopieren, oder gleich den Wechsel-Modus
   `--ab vorher=../bandenkick_vorher:: --ab nachher=` (alte Fassung als zweite Kopie, Runde für Runde abwechselnd).
2. Branch mergen (`git merge vorbau/bandenkick-n4-technik`; main war beim Abzweigen 8c27fcd).
3. Abnahme je Etappe (Listen unten), korrigieren, messen, Bericht, Version/Cache-Busting (`python3 tools/update_sw.py`),
   Live-Check. Diese Datei danach in den Bericht übernehmen und löschen, Branch löschen.

## URL-Regler (alle neu, Standard = an)

| Regler | Wirkung | alt (wie n3) |
|---|---|---|
| `?kino=0` | Kino-Look aus: direktes Zeichnen, Ball-Blob und Figuren-Flecken wie bisher | ✔ |
| `?look=0\|1\|2` | Kino-Stufe erzwingen (unabhängig von der Grafikstufe) | |
| `?kl=-bloom,+flare` | einzelne Stufen des Endbilds (Kern-Namen: scale, aa, sharpen, ssao, bloom, flare, aerial, grade, vignette, dither, contact, dof) – „+“ in der URL als `%2B` oder einfach ohne Vorzeichen | |
| `?autopilot=0` | alte Automatik `autoQuality()` (nur abwärts) | ✔ |
| `?startprobe=0` | ohne Kurzmessung im Ladebildschirm (Start mit Preset-Skala bzw. Gespeichertem) | |
| `?schattenkam=0` | Schattenkarte über den ganzen Käfig (±15,5 m um den Ursprung) | ✔ |
| `?schatten2=1024` | Stufe 2 mit 1024er- statt 2048er-Schattenkarte | |
| `?cull=0` | Figuren immer zeichnen und jedes Bild animieren | ✔ |
| `?ik=0` | Fuß-IK aus | ✔ |
| `?ktx=0` | KTX2-Avatare nicht benutzen (wirkt erst, wenn sie erzeugt sind) | ✔ |
| `?q=0\|1\|2` | wie bisher: feste Stufe, Autopilot aus | |
| `?clips=0` | **nicht gebaut** (keine Clips, s. E3) | |

Alt-Look ungefähr: `?kino=0&autopilot=0&schattenkam=0&cull=0&ik=0`.

## E0 Mess-Gate – fertig, nie gelaufen
- `tests/perf_gate.py`: **unverändert** aus `stuntbahn/tests/perf_gate.py` (n30) kopiert (startet den Browser per `open` + CDP,
  ungedeckelt, `--ab`-Wechsel-Modus).
- `tests/perf_szenen.json`: `menu_s1`, `spiel_s0`, `spiel_s1`, `spiel_s2`, `spiel_abend_s1`, `spiel_auto` (ohne `?q`, Autopilot),
  `training_s1` (Torwart-Ballmaschine mit Skript-Spieler), `replay_s1` (Schuss aus 9 m wie `tests/deko_scenes.py replay_shots`,
  Wiederholung im Abschnitt „kontakt“ angehalten). Alle mit `?licht=tag|abend` fest und `?startprobe=0`; vorher wird auf
  `deko.ready` (Zuschauer gebacken) gewartet. `zusatz` liefert DPR, Größe, Stufe, Kino-Zustand, Autopilot-Zustand, Schattenausschnitt.
  Draw-Calls: ab n4 setzt das Spiel `renderer.info` selbst je Bild zurück (Kino-Look = mehrere Durchgänge), auf main wie bisher.
- Geprüft: `python3 tests/test_perf_gate_kern.py` (Tabelle, Vergleich, Profil, Szenen vollständig, alle 21 JS-Ausdrücke der
  Szenen-Datei syntaktisch gültig) – grün.
- **Heavy abnehmen:** läuft jede Szene durch (v. a. `replay_s1`: erreicht die Wiederholung „kontakt“? sonst `fancam` halten;
  `training_s1`: endet die Ballmaschine in 10 s nicht mit der Ergebniskarte?), hoch + quer, Vorher-Tabelle.

## E1 Kino-Look – Code fertig, Bild offen
Dateien: `src/render/kern/kinolook.js` (Kopie Stuntbahn, rückwärtsverträglich erweitert: `opts.presets`, Preset-Felder
`vignette`/`bloomSky`, `kino.bloomThreshold`/`bloomStrength` – Diff im Kopfkommentar), `src/render/kino_logik.js` (Stufen,
Farben, Regeln, ohne three.js), `src/render/kino.js` (Anschluss, Kontaktschatten), `src/main.js` (zeichnen, Licht, Replay),
`src/render/avatars.js` (`setContact`), `src/render/deko.js` (Punktgrößen × Renderskala).

| Stufe | Endbild | Renderskala [min–max, Start] |
|---|---|---|
| 0 | direkt wie bisher (+ Kontaktschatten) | Pixeldichte-Faktor 0,75–1 |
| 1 (Handy) | Render-Target ohne MSAA, FXAA-Hochskalieren + CAS-Schärfen 0,45, Bloom ¼-Auflösung 3 Ebenen, TV-Farbe, Vignette 0,12, Dither | **0,7–0,85, Start 0,8** (Canvas bleibt DPR 1,5) |
| 2 (Desktop) | wie 1 + MSAA 4 im Render-Target + AO (8 Abtastungen, **Radius 0,4 m**, Stärke 0,5), Schärfe 0,3, Bloom 4 Ebenen | 0,7–1, Start **0,9** |

- Dunst (`aerial`), Blendung (`flare`), Bewegungsunschärfe, Hitzeflimmern: aus. `scene.fog` bleibt.
- Bloom „nur Leuchtendes“: kein Masken-Durchgang, sondern Schwelle nach Licht – **Tag 0,97** (Stärke ×0,7), **Abend 0,93/0,90**
  (Stufe 1/2); Himmel zählt nicht (`bloomSky 0`). Farbkorrektur `tv` (Sättigung 1,07, Kontrast 0,14, keine Grün-Bremse) und
  `tvAbend` (leicht kühl, Kontrast 0,18). Umschalten mit dem Licht (`setLicht()` in main.js).
- **Tiefenschärfe nur im Replay** (`replayDof`): Zoom k 0,85 (near 0,5 / far 0,9), Fan-Cam k 0,6; TV-Kamera ohne.
- **Kontaktschatten:** ein `InstancedMesh` für 6 Figuren + Ball (Deckkraft je Instanz über `instanceColor.r`, kleiner
  Shader-Patch an `color_fragment`), Ellipse 0,85 × 0,6 m in Blickrichtung, verblasst bis 0,4 m Sprunghöhe, Ball wie der
  alte Blob, abends ×0,8. Ersetzt den Ball-Blob und (nur ohne Deko) die runden Figuren-Flecken; die Deko-Sonnen-/
  Flutlicht-Schatten bleiben (n3 nicht zurückgedreht). Netto Draw-Calls: Ball-Blob −1, Kontaktschatten +1.
- Punktgrößen (Granulat `PointsMaterial`, Flutlicht-Leuchthöfe, Blitzlichter) werden im kleineren Render-Target sonst
  1/Skala zu groß → mit `kino.renderScale` korrigiert.
- Geprüft: `node tests/node/kino.test.mjs` (40 Prüfungen: Stufen, Pixelanteil Stufe 1 ≤ 0,72 von heute, Licht, URL, Replay-
  Fokus, Kontaktschatten-Ausrichtung am echten InstancedMesh, KinoLook-Kern mit Bandenkick-Presets). Alle Importe von
  `main.js` in Node aufgelöst.
- **Heavy abnehmen (Browser):** Bild Tag/Abend hoch/quer, Stufe 1/2 gegen `?kino=0`: Schärfe nach dem Hochskalieren
  (Leibchen-Muster, Rückennummern, Netz), Bloom an Strahlern/Fenstern abends, **kein** Glühen an Linien/Ball/Leibchen tags,
  Vignette nicht zu stark zur CSS-Vignette der Wiederholung, AO 0,4 m an Bande/Füßen (Stufe 2) ohne Halos, Kontaktschatten
  unter Füßen und Ball (Lage, Größe, Abend), Tiefenschärfe im Replay-Zoom/Fan-Cam (Ränder um Fuß/Ball). Bildzeit Stufe 1
  muss **schneller** sein als heute (Brief), Stufe 2 gleich/besser – falls nicht: Stufe-2-Start 0,8 oder `ssao` aus.
- **Annahmen/Risiken (Startwerte, TODO am Bild):** alle Werte in `kino_logik.js` (Schwellen, Schärfe, Vignette, Grade,
  DoF-k/near/far, Kontaktschatten-Größe/Deckkraft). Canvas behält `antialias` (MSAA) für Stufe 0; im Kino-Pfad kostet der
  MSAA-Canvas nur das Auflösen des Endbilds – evtl. `antialias:false` prüfen, wenn Kino an ist (dann braucht Stufe 0 FXAA).
  Bloom per Schwelle statt Maske: weiße Trikots im Gegenlicht können abends mitleuchten.

## E2 Autopilot + Avatar-Kosten – Code fertig, Browser offen
**Autopilot** (`src/render/kern/autopilot.js` + `startprobe.js` unverändert aus der Stuntbahn, Anschluss `src/render/grafik.js`,
`src/main.js` → `startGrafik`, `stufeAnwenden`, `skalaAnwenden`, `menschenAnwenden`, `dekoAnwenden`):
- Reihenfolge runter: Renderskala → Deko schlank (`deko.setLite`/neu `setFull`) → Menschen-Schatten → Stufe; rauf umgekehrt,
  Stufe erst bei Renderskala am Maximum. Kosten-Schätzungen `KOSTEN` in grafik.js (deko 0,06, menschenschatten 0,08, stufe 0,3).
- **Handy startet auf 1 und darf auf 2:** der Kern hebt nur an, was er selbst abgeschaltet hat → fehlende Stufen werden beim
  Start als „abgeschaltet“ auf seinen Stapel gelegt.
- **Gescheiterter Schritt nach oben lernt seine echten Kosten** (Arbeit nachher/vorher − 1), sonst probierte ein schwaches
  Gerät alle 8–16 s erneut Stufe 1 (je ~1,5 s Ruckeln). Nur mit GPU-Zeit.
- Start: `?q` > zuletzt gefahrene Stufe (`localStorage bk_grafik`, 21 Tage – nötig, weil `antialias` beim Erzeugen feststeht)
  > Touch 1 / Desktop 2. Startskala: gespeichert je Gerät (`grafikKern.<schlüssel>`) oder **Kurzmessung** im Ladebildschirm
  (4 + 20 Bilder der Startszene, „Bandenkick lädt … Grafik einstellen“).
- Gefüttert werden nur Bilder im Spiel (inkl. Wiederholung), nach Moduswechsel 1,5 s Schonzeit (Menüs laufen mit halber
  Bildrate). GPU-Zeit über `GpuZeit` (ersetzt dann die alte `?gpu`-Abfrage, `perf().gpuMs` wird weiter befüllt).
- Stufenwechsel zur Laufzeit: Pixeldichte, Kino-Stufe, Schattenkarte an/aus (**alle Materialien neu übersetzen → Hänger**,
  selten), Größe der Karte, Menschen-Schatten, Deko. `info().auto` = `{ on, autopilot: zustand, steps, log, startProbe }`
  (`steps` bleibt für `tests/test_autoq.py`).
- Geprüft: `node tests/node/grafik.test.mjs` (24: künstliche Geräte – starkes Handy auf Stufe 2 nach 7 s, schwaches: erster
  Schritt Renderskala nach 2,5 s, Stufe 0 nach 7,3 s, danach ruhig; mittleres bleibt auf 1 mit Skala 0,72; CPU-gebunden
  überspringt die Skala; ohne GPU-Zeit beides auch; Rückruf-Reihenfolge; Speicher; Kurzmessung).
- **Heavy abnehmen:** `python3 tests/test_autopilot.py` (neu, Vorlage Stuntbahn, **nie gelaufen**; künstliche Last über
  `__game.testLast`), `tests/test_autoq.py`, Szene `spiel_auto` im Gate. Prüfen: Startprobe-Dauer und -Skala (`info().auto.startProbe`),
  Hänger beim Stufenwechsel 0↔1, dass `?q=` den Autopiloten wirklich aus lässt. `szenenFaktor` der Kurzmessung = 1 (Menü ≈ Spiel?).

**Enge Schattenkamera** (`src/render/schatten.js`, Anschluss `schattenFolgen()` in main.js, `sonnenSchatten()` in scene.js):
- Bildausschnitt (Rand-Strahlen gegen Boden und 2,2 m Höhe, auf Käfig + 2,5 m geklemmt, Käfig-Ecken im Bild dazu) → Quadrat im
  Lichtraum, Kante in 0,5-m-Schritten mit Hysterese, Mittelpunkt auf ganze Texel gerastert. Abend-Sonne (Mast) wird übernommen.
- Node (`tests/node/schatten.test.mjs`, 19, gegen die echte `DirectionalLight.shadow`-Matrix): **nie schlechter abgedeckt als
  bisher**; Kante hoch ±10–14 m, quer ±13–15,5 m statt ±15,5 m. **Die TV-Kamera sieht fast den ganzen Käfig → 1024 reicht auf
  Stufe 2 nicht** (2,2–2,8 cm statt bisher 1,5 cm je Texel). Deshalb Stufe 2 weiter 2048 (dann 1,0–1,4 cm), `?schatten2=1024`
  zum Vergleich. Stufe 1: 1024 wie bisher, aber bis ⅓ schärfer.
- **Heavy abnehmen:** Schattenkanten am Bildrand (abgeschnitten?), Flimmern beim Kameraschwenk (Texel-Raster), Schattenakne
  (Bias unverändert −0,0004 / normalBias 0,02), Abend.

**Figuren (Audit #8):** `frustumCulled` wieder an mit Kugel `BOUND_R = 1,25 m` um die Ruhepose-Mitte (in Node über 6 Figuren ×
10 Posen – Sprint, Stemmschritt, Hechtsprung, Liegen, Grätsche, Fallrückzieher, Flugkopf, Vollspann, Ball halten – füllt die
schlimmste Pose 84 %). Außerhalb des Bildes (Kugel 1,5 m, Kamera des letzten Bildes, nicht im Replay) Mischer + Schichten nur
jedes 2. Bild, Zeit sammelt sich (Phase identisch zum Volltakt), Lage jedes Bild. `info().figuren.gespart`.
Geprüft: `node tests/node/avatar.test.mjs` (Avatare in Node ohne Texturen geladen: `tests/node/avatar_node.mjs`).
**Heavy:** CPU-Gewinn messen (hoch: Figuren hinter der Kamera), Zucken am Bildrand, Schatten von Figuren knapp außerhalb (Stufe 2).

**KTX2 (Audit #7) – Lader fertig, Dateien bewusst NICHT erzeugt:** `tools/build_ktx2_avatars.mjs` (UASTC Gesicht + Normalen mit
zstd/RDO, ETC1S Körper/Haare, `--nur-etc1s`, `--koerper 2048` aus `assets_src/work`, `--messen`), Lader in `avatars.js`
(`KTX2Loader.detectSupport`, je Figur Rückfall auf WebP, `?ktx=0`), Liste `src/render/avatar_ktx2.js` (= `null` → nichts passiert,
keine 404). Das Skript kopiert beim echten Lauf KTX2Loader + Transcoder aus `../stuntbahn/lib/addons` (r186).
**Stichprobe Sports_Male_02 (3 Texturen):** WebP 0,13 MB → KTX2 gemischt **0,56 MB (×4,3)**, nur ETC1S **0,25 MB (×1,9)**
(9 s CPU). Alle sechs Figuren haben heute nur **1,04 MB** WebP-Texturen → hochgerechnet +3,2 MB (gemischt) bzw. +1,0 MB (ETC1S)
plus ~0,6 MB Transcoder (roh) → **reißt das Ladebudget (+1 MB)**. Gewinn wäre nur Grafikspeicher (~45 MB → ~10 MB).
Empfehlung: weglassen oder nur ETC1S für den Körper; falls doch: `update_sw.py` darf nicht beide Fassungen vorab laden
(WebP- und KTX2-GLBs), Lizenzen (three.js-Addons MIT, Basis-Transcoder Apache 2.0) in `LICENSES.md`.
„Trikot 1024 statt 512“: die Körper-Textur ist schon 1024 (nur Kopf/Normalen 512); das Leibchen selbst ist eine 64er-Canvas.

## E3 EA-FC-Bewegung
**Fuß-IK – fertig** (`src/render/ik.js`, `Avatar.fussIK` in avatars.js, `?ik=0`): analytischer Zwei-Knochen-Löser (Holden),
nur wenn prozedurale Schichten aktiv sind (reine Clips stehen auf dem Boden; in Node bestätigt: Laufzyklus unverändert).
- Boden: aufrecht (kein Hechtsprung/Liegen/Grätsche/Luftball) dürfen Knöchel und Zehen nicht unter ihre Ruhehöhe (−1 cm);
  nur anheben, Fuß behält die Welt-Ausrichtung. **Ohne IK stecken die Füße beim Stemmschritt bis 18,4 cm im Rasen, mit IK
  ≤ 1,2 cm** (6 Figuren, Stemmschritt vorn/seitlich, Torwart bereit, Vollspann, Innenseite, Ball halten).
- Ballkontakt: Sprung von `kickT` auf 0 merkt den Ball (wie gezeichnet) → Knöchel-Ziel 0,19 m hinter dem Ball in Ruhehöhe,
  Gewicht 0,85 → 0 in 0,12 s (`KICK_T`), Schussbein wie die Schwung-Schicht (`kickFoot`, nach dem Wechsel in der Simulation).
  Node: beim Kontakt 7,4 statt 45,8 cm vom Ziel (Bein streckt sich, Ball teils außer Reichweite), nach 0,12 s nichts mehr.
- CPU in Node (ungedrosselt): 6 Figuren im Stemmschritt +0,03 ms je Bild (IK selbst 0,023 ms, 2 Beine × 6). Am Handy ×4–6 →
  ~0,15 ms, unter der Grenze +0,5 ms → **auf allen Stufen an**. Heavy: am Gate nachmessen (`info().figuren.ikMs`).
- Geprüft: `node tests/node/ik.test.mjs` (14: Löser = Ziel exakt, Längen, Knie vorn, unerreichbar gestreckt, Pol,
  Quaternionen = three.js) und `avatar.test.mjs` (IK-Teil an echten Skeletten).
- **Heavy abnehmen:** Bild „Fuß am Ball nah“ (Replay-Zoom!) – trifft der Fuß den Ball oder schlägt er durch/zu früh?
  Stemmschritt: sehen gebeugte Knie natürlich aus? Kein Ziehen bei Volley/Fallrückzieher (dort aus). Die Schwung-Schicht
  beginnt erst nach dem Kontakt (Simulation kennt den Kontakt nicht vorher) – Ausholbewegung vor dem Kontakt fehlt weiter.
**Clips – nicht angefangen:** Rocketbox hat keine Kick-/Annahme-/Torwart-Clips (alle 474 Clips in
`assets_src/rocketbox/tree.json` durchsucht: nur cheer/claphands passen), Mixamo braucht ein Adobe-Login (kein Download ohne
Browser). `tools/rb_to_glb.py` kann nur das Biped-Skelett „Bip01“; Mixamo-Clips (Skelett „mixamorig“) brauchen eine eigene
Knochen-Tabelle. Vorschlag: Clips mit Kontakt-Zeitpunkt in `assets/anims/*.json` (`kontakt: s`), Start ~0,2 s vor dem Kontakt
aus `pl.pending` + Ballabstand vorhersagen, Gewicht über die vorhandene `specialW`-Logik, Fuß-IK zieht den Rest; `?clips=0`.

## E4 Publikum nah (VAT) – nicht angefangen
Brief: nur wenn E1–E3 im Budget sind – das weiß erst die Messung. Backen der Vertex-Animation braucht Browser/Blender und Abnahme
am Bild. Nichts vorbereitet.

## Tests (alle ohne Browser)
`npm test` enthält jetzt zusätzlich `kino`, `grafik`, `schatten`, `avatar`, `ik` (alle grün, je < 15 s). Neu dazu:
`tests/node/three_hook.mjs` + `three_resolve.mjs` (Node lädt `three` wie die Import-Map), `tests/node/avatar_node.mjs` (GLBs
ohne Texturen). Alle bisherigen Node-Tests grün außer **nicht gelaufen**: `selfplay.test.mjs` (lang) und `magnet.test.mjs`
(brauchte > 100 s, abgebrochen) – Simulation ist unverändert. `python3 tests/test_perf_gate_kern.py` grün.

## Für den Bericht / sonst offen
- Version, Cache-Busting, `update_sw.py` (neue Dateien: `src/render/kern/*.js`, `kino*.js`, `grafik.js`, `schatten.js`, `ik.js`,
  `avatar_ktx2.js`) – Heavy.
- README: neue Regler, Autopilot statt „Automatik nur abwärts“, Fuß-IK.
- `?gpu` + Autopilot: `perf().gpuMs` kommt dann aus `GpuZeit` (nur neue Werte); `tests/perf.py` nutzt `?q` → alter Weg.
- `tests/test_autoq.py` erwartet nur `auto.steps` ≠ leer bei Ruckeln – mit Autopilot sind das Texte wie „skala − (Skala 0.72, 31 fps)“.
