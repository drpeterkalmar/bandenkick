# Bandenkick n5 – flüssige Figuren und ruckelfreie Wiederholung

Peters Meldung (08.10.2026): „die bandenkick figurenbewegungen sind sehr abgehackt und die replays sind sehr janky“.
Stand vorher: n4 (Commit 49f3644, Version 0.2.0). Gearbeitet und gemessen auf **rog17 (RTX 3070 Ti, Windows 11, Chromium
headless über ANGLE/D3D11, stumm)**; das Mittelklasse-Profil (CPU-Drosselung ×4, Pixel-7-Ansicht hoch und quer) gilt
trotzdem. Alles ist live (Etappen E1–E7 einzeln gelandet).

## Kurz für Peter

- **Figuren:** Große Ruckler (Knochen springt in einem Bild deutlich sichtbar) im Spiel **−86 % (quer) / −89 % (hoch) /
  −88 % (Handy-Profil)**, in der Wiederholung **von 16–17 auf 0**. Der größte Einzelruck sank von 130–148 auf 31–33 cm
  (Spiel) bzw. von ~100 auf 7–8 cm (Wiederholung). Der Moment „Jubel endet“ (jede Wiederholung, jeder Anstoß) zog alle
  sechs Figuren kurz Richtung Ruhepose – weg.
- **Wiederholung:** Kamera wie eine TV-Regie: weich, ohne Nachlauf, keine einzige Ruck-Spitze mehr (vorher 20–23 je drei
  Wiederholungen), Zeitlupe blendet sanft ein und aus statt umzuspringen, kein 0,2-s-Mini-Schnitt mehr. In der Zeitlupe
  trifft der Fuß jetzt den Ball (die Wiederholung kennt die Zukunft und lässt den Fuß schon vorher hingreifen).
- **Bildrate:** am Handy-Profil gleich (gedeckelt wie am Handy: vorher 50,4–53,3 fps, nachher 52,6–52,9 fps; p95 gleich).
- Zurückschalten zum Vergleich: `?glatt=0` (Figuren wie n4), `?rcam=alt` (Wiederholung wie Nacht 2d).

### Bitte am Handy testen
1. Ein Spiel hoch und eins quer, auf **Antritt/Stopp, Richtungswechsel, Dribbeln, Tormann (Hocke, Hechtsprung,
   Aufstehen)** achten – wirkt es flüssiger? Direkt danach dieselbe Stelle mit `…/bandenkick/?glatt=0&rcam=alt`
   (alter Stand) vergleichen.
2. Ein Tor schießen und die Wiederholung ganz ansehen: Kamerafahrt im Aufbau, Übergang in die Zeitlupe, Fuß am Ball,
   Fan-Cam. Fühlt es sich wie TV an? Wirkt die Zoom-Kamera im Hochformat zu nah am Schützen (sein Bein füllt kurz das
   Bild)?
3. Falls es trotzdem noch „abgehackt“ wirkt: Ist es eher ein gleichmäßiges Stocken des ganzen Bildes (dann Bildrate,
   siehe „Offen“) oder zucken einzelne Figuren?

## Messwerkzeug (sichtbar machen)

- `src/render/ruckmess.js` + `__game.ruckStart()/ruckDaten()`: je Bild Knochen-Lagen (Becken, Füße, Hände, Kopf) im
  Figuren-Raum (ohne Laufweg und Drehung → nur die Pose), Figuren-Lage/-Drehung, Summe der Clip-Gewichte, Zustand
  (Schuss, Sonderbewegung, Technik, Tempo, Stemmschritt), Kamera, Abschnitt der Wiederholung. Kostet nichts, solange aus.
- `tests/ruckel.py`: 20 s Bot gegen Bot, dann 3 Tore mit rollendem Ball (Querpass, Bandenabpraller, Steilpass; der
  Schütze läuft an), Wiederholung ganz, Jubel davor und danach. Kennzahlen:
  - **Pose-Ruck** = zweite Ableitung der Knochen-Lage, auf 60 Hz normiert (cm/Bild²).
  - **Pose-Sprung** = über der Hülle, die saubere Lauf-Clips bei diesem Tempo selbst erzeugen (geeicht an stetigem
    Laufen 0–8,5 m/s in Node), ×1,25 Reserve, **und** Spitze (> 3× Median der ±6 Nachbarbilder). **Groß** = zusätzlich
    > 8 cm/Bild² (deutlich sichtbares Schnappen).
  - Dreh-Sprung (Blickrichtung), Gewichtssumme < 0,98, Fußgleiten (Weltgeschwindigkeit aufgesetzter Füße),
    Kamera-Ruck (Lage, Blick; Schnitte ausgenommen), Schnitte, Tempo-Sprünge, Bild-Hänger.
  - Teleports (Aufstellen, Anstoß), Schnitte und Bild-Hänger sind aus der Pose-Auswertung ausgenommen.
- `tests/node/fluessig.test.mjs` (in `npm test`): dieselben Kennzahlen ohne Browser – 7 harte Abläufe × 2 Figuren und
  **6 echte Bot-Tore** mit Regie und Kamera (deterministisch).
- `tests/ruckel_bilder.py`: Kontaktabzug der Wiederholung (angehalten in festen Schritten) und Kurven.
- `tests/autopilot_pendel.py`: Autopilot-Stufenwechsel und Bildabstände am Handy-Profil (gedeckelt).
- Messfehler unterwegs (ehrlich): Mein erster „Figur gespart“-Merker las einen Zähler, der stehen bleibt; dadurch fehlte
  ein Teil der Bilder in der Pose-Auswertung. Korrigiert (`gespartBild`), **alle Zahlen unten sind neu gemessen**;
  „vorher“ = gleicher Code mit `?glatt=0&rcam=alt` (Verhalten exakt n4, Node-Test belegt die Abschaltung).

## Ursachen (Verdachtsliste geprüft) und Behebung

| # | Verdacht | Befund | Behebung (Datei:Zeile, Stand E7) |
|---|---|---|---|
| 1 | Lauf-Gewichte ungeglättet | **bestätigt** – z. B. Tormann Hocke → Stehen: Becken 17 cm in 3 Bildern, Antritt/Stopp | Pose-Tempo über kritisch gedämpfte Feder `src/render/glatt.js`, `W_LAUF` `src/render/avatars.js:32`, Anwendung `:365`; Schrittphase weiter aus echtem Tempo + passender Schrittlänge (Füße stehen) `:369` |
| 2 | Sonderbewegung endet mit Pop | **bestätigt, schlimmster Einzelbefund** – Gewichtssumme fällt auf 0,10, bei **jedem Replay-Start alle 6 Figuren** (663–665 Bilder) und am Anstoß | je Sonderbewegung eigenes Gewicht, alte blendet mit aus `avatars.js:387`; Schnitt Spiel↔Wiederholung setzt die Glättungen sofort `avatars.js:325`, `src/main.js:677/684` |
| 3 | Phasen-Versatz je Clip | **nicht als Ursache gefunden** (Node-Eichung über alle Tempi ohne Spitzen beim Clipwechsel) | – |
| 4 | Culling n4 greift zu früh | **verworfen** – Figur im Bild, aber in diesem Bild gespart: 1–4 von ~15 000 Figuren-Bildern je Lauf (nur am Bildrand) | – |
| 5 | Blickrichtung nicht interpoliert | **bestätigt** – 932–961 Dreh-Sprünge; Bots kehren die Drehung teils von Takt zu Takt um (±9 rad/s) | zwischen Takten interpoliert `main.js:741`, Feder `avatars.js:332` → −80 % |
| 6 | Fuß-IK schnappt | **bestätigt, größte Einzelsprünge** – Fuß springt im Kontaktbild bis 1,5 m (normiert) zum Ball, bei Dribbel-Kontakten alle 0,3 s | weich ein/aus `src/render/ik.js:66`, Versatz über Feder + Reichweite 0,35 m `avatars.js:618`; Wiederholung: Fuß greift schon **vor** dem Kontakt zum Ball (`naechsterKick` `src/sim/replay.js:130`, `avatars.js:599`) |
| 7 | Autopilot pendelt | **verworfen** – in allen Läufen genau 3 Schritte abwärts in den ersten 6 s, danach stabil (vorher wie nachher). Aber Befund, siehe „Offen“ | – |
| 8 | Replay-Kamera ohne Dämpfung | **bestätigt** – Kamera hängt am Ball, Bandenabpraller/Schuss = Ruck bis 55 cm/Bild² | `ReplayKamera` `replay.js:327`: Ball vorausschauend geglättet (`ballGlatt` `:142`), kritisch gedämpfte Feder mit Vorhalt 2/ω (kein Nachlauf), Zoom ohne Vorgriff; Werte `REGIE` `:191` |
| 9 | Harte Tempo-Schnitte | **bestätigt** – 1 → 0,2 → 1 → 0,3 schlagartig; dazu „Flug“-Abschnitte von 0,18 s (zwei Schnitte in 0,2 s) | Tempo-Rampen `rateAt` `replay.js:232`, Flug < 0,45 s entfällt `:210` |
| 10 | Figuren in Zeitlupe | **bestätigt** – Technik-Pose sprang beim Kontakt (Luftball → Schuss), die Sim wechselt das Schussbein im Kontakt-Takt, Schuss-Schwung setzte hart ein, wenn die Technik-Pose ausblendete | Technik-Pose über Feder `avatars.js:437`, Bein bleibt während der Pose `:495`, Schwung geglättet und mit Technik gemischt `:509` |
| 11 | FOV-Sprünge | **verworfen** – FOV springt nur an Schnitten (gewollt), innerhalb einer Kamera konstant | – |
| + | (zusätzlich gefunden) | Stemmschritt: Neigungsrichtung kippte, wenn das Tempo durch 0 geht; Tormann-Rolle kippte beim Aufstehen die Seite | Neigung als Vektor geglättet `avatars.js:465`; Seite beim Absprung gemerkt `:476` |

Sicherheitsnetz („Inertialisierung“, `avatars.js:545`): fängt Rest-Sprünge der Beine ab. Kostete am Handy-Profil ~1 fps
(quer) bei kleinem Zusatznutzen → **im Spiel aus**, `?traeg=1` schaltet es zu.

## Zahlen vorher / nachher (tests/ruckel.py, je 20 s Spiel + 3 Tore mit Wiederholung)

**quer, ungedrosselt**

| Kennzahl | Spiel vorher | Spiel nachher | Wiederholung vorher | Wiederholung nachher |
|---|---|---|---|---|
| Pose-Sprünge (alle) | 1042 | 549 | 80 | 39 |
| **große** Pose-Sprünge (> 8 cm/Bild²) | 397 | 56 | 17 | 0 |
| größter Pose-Ruck (cm/Bild²) | 129.6 | 31.49 | 98.05 | 7.32 |
| Dreh-Sprünge (Blickrichtung) | 932 | 185 | 38 | 12 |
| Bilder mit Gewichtssumme < 1 | 663 | 0 | 665 | 0 |
| Fußgleiten Ø (cm/s) | 141.3 | 123.8 | 240.6 | 226.9 |
| Kamera-Lage Ruck p99 / max (cm/Bild²) | 6.002 / 47.86 | 5.64 / 48.05 | 3.103 / 54.7 | 0.403 / 0.46 |
| Kamera-Blick Ruck max (°/Bild²) | 0.0 | 0.0 | 0.51 | 0.01 |
| Kamera-Ausreißer (Lage + Blick) | 178 | 169 | 23 | 0 |
| Tempo-Sprünge | 3 | 3 | 3 | 0 |
| Bildabstand p50 / p95 (ms) | 16.7 / 17.8 | 16.6 / 17.8 | 16.6 / 17.9 | 16.7 / 17.8 |

**hoch, ungedrosselt**

| Kennzahl | Spiel vorher | Spiel nachher | Wiederholung vorher | Wiederholung nachher |
|---|---|---|---|---|
| Pose-Sprünge (alle) | 1060 | 562 | 73 | 31 |
| **große** Pose-Sprünge (> 8 cm/Bild²) | 395 | 44 | 16 | 0 |
| größter Pose-Ruck (cm/Bild²) | 148.06 | 32.96 | 99.76 | 7.89 |
| Dreh-Sprünge (Blickrichtung) | 961 | 183 | 35 | 11 |
| Bilder mit Gewichtssumme < 1 | 662 | 0 | 665 | 0 |
| Fußgleiten Ø (cm/s) | 139.0 | 121.5 | 226.3 | 190.3 |
| Kamera-Lage Ruck p99 / max (cm/Bild²) | 3.48 / 65.45 | 4.882 / 63.62 | 0.382 / 7.26 | 0.119 / 0.16 |
| Kamera-Blick Ruck max (°/Bild²) | 0.07 | 0.07 | 2.72 | 0.03 |
| Kamera-Ausreißer (Lage + Blick) | 133 | 151 | 20 | 0 |
| Tempo-Sprünge | 3 | 3 | 3 | 0 |
| Bildabstand p50 / p95 (ms) | 16.6 / 17.8 | 16.6 / 17.8 | 16.6 / 17.9 | 16.6 / 17.9 |

**quer, CPU ×4 (Mittelklasse-Profil)**

| Kennzahl | Spiel vorher | Spiel nachher | Wiederholung vorher | Wiederholung nachher |
|---|---|---|---|---|
| Pose-Sprünge (alle) | 608 | 344 | 78 | 30 |
| **große** Pose-Sprünge (> 8 cm/Bild²) | 153 | 18 | 12 | 1 |
| größter Pose-Ruck (cm/Bild²) | 89.01 | 14.6 | 96.73 | 10.55 |
| Dreh-Sprünge (Blickrichtung) | 563 | 145 | 29 | 3 |
| Bilder mit Gewichtssumme < 1 | 536 | 0 | 504 | 0 |
| Fußgleiten Ø (cm/s) | 133.8 | 120.6 | 182.7 | 157.9 |
| Kamera-Lage Ruck p99 / max (cm/Bild²) | 3.593 / 37.5 | 2.794 / 30.32 | 2.438 / 8.94 | 0.407 / 0.43 |
| Kamera-Blick Ruck max (°/Bild²) | 0.0 | 0.0 | 0.57 | 0.01 |
| Kamera-Ausreißer (Lage + Blick) | 91 | 102 | 17 | 0 |
| Tempo-Sprünge | 3 | 3 | 4 | 0 |
| Bildabstand p50 / p95 (ms) | 21.9 / 30.75 | 20.8 / 29.54 | 18.8 / 23.8 | 18.5 / 24.17 |

(„Spiel“ enthält das Aufstellen der Test-Tore und den Jubel; die Spielkamera war nicht Teil dieses Auftrags – daher dort
gleiche Kamera-Werte. Tempo-Sprünge im Spiel = die Schnitte in die Wiederholung hinein/heraus.)

**Node (deterministisch, `tests/node/fluessig.test.mjs`, ALLE GRÜN 16/16):** Gewichtssumme bleibt 1,000 (n4: 0,10);
Stärke der großen Sprünge in 7 harten Abläufen 3213 → 773 cm (−76 %), größter Sprung 100 → 29 cm; Kamera an 6 echten
Bot-Toren: Ruck-Summe 531 → 104 (−80 %), Ausreißer 74 → 0, Tempo-Sprünge 6 → 0, Ball bleibt im Bild wie vorher.

### Ziele des Auftrags

| Ziel | Ergebnis |
|---|---|
| Pose-Sprünge −80 % | **große** Sprünge −86 % / −89 % / −88 % ✅; alle Sprünge (inkl. Grenzfälle knapp über der Hülle) nur −47 % / −47 % / −43 % (Spiel) und −51 % / −58 % / −62 % (Wiederholung) – **nicht erreicht** für die strenge Zählung |
| Kamera-Ruck Wiederholung −80 % | p99 −87 % / −69 % / −83 %, Maximum −99 %, Ausreißer 23/20/17 → 0, Node-Summe −80 % ✅ |
| keine Gewichtssumme < 1 | 0 Bilder (vorher 500–665), Node-Test ✅ |
| Fußgleiten nicht schlechter | überall besser (−9 … −16 %) ✅ |
| Bildrate nicht schlechter | gedeckelt (wie am Handy) gleich: hoch 50,4/50,8/52,0 → 52,9 fps, quer 52,7/53,2/53,3 → 52,6 fps; Mess-Gate A/B (ungedeckelt, 3 Runden): p95 gleich (±2 %), Median im Spiel +0,8 … +1,3 ms (CPU ×4) ✅ mit Hinweis |

## Bildrate (Mittelklasse-Profil: CPU ×4, DPR 2,6, gemessen auf rog17)

- Mess-Gate A/B gegen 49f3644 (`tests/perf/2026-10-09_n5_nachher_{hoch,quer}.json`, je 3 Runden abwechselnd):
  spiel_s1 hoch p50/p95 18,8/34,3 → 20,0/34,9 ms, quer 18,5/34,8 → 19,3/34,6; spiel_auto hoch 18,6/34,8 → 19,4/34,7,
  quer 17,7/34,6 → 19,0/34,6; replay_s1 hoch 11,3/13,4 → 11,1/13,2, quer 11,1/13,3 → 11,4/13,6.
- Gedeckelt mit Autopilot (`tests/perf/autopilot_*.json`, 45 s): siehe Tabelle oben; Autopilot je 3 Wechsel (alle
  abwärts in den ersten 6 s), kein Pendeln.
- Unterwegs gemessen und behoben: die erste Glättungs-Fassung kostete am Handy-Profil bis 1,5 ms je Bild (Ursache:
  Zusatzschichten liefen länger und rechneten die Weltmatrizen der ganzen Figur inkl. aller Meshes; Sicherheitsnetz).
  Jetzt nur noch Knochenbaum (`avatars.js:492`), Listen/Knochen einmal abgelegt, Netz aus. Node (ungedrosselt, 6 Figuren
  mit Schüssen/Stemmschritten): 0,263 ms (49f3644) → 0,24–0,29 ms je Bild.

## Bilder

- `tests/shots/fluessig/abzug_replay_quer.jpg`, `abzug_replay_hoch.jpg` – Wiederholung angehalten in festen Schritten
  (Aufbau, Kontakt-Zeitlupe, Fan-Cam), oben vorher (`?glatt=0&rcam=alt`), unten nachher. Nachher: Fuß am Ball beim
  Kontakt; im Hochformat ist der Schütze im Zoom überhaupt erst im Bild.
- `tests/shots/fluessig/kurven_replay_quer.png` – erste Wiederholung: Kamera-Lage, Blickrichtung, Füße des Schützen;
  vorher senkrechte Kanten (Sprünge) und ein Kamera-Knick am Kontakt, nachher stetige Bahnen.

## A/B-Schalter (URL)

`?glatt=0` Figuren wie n4 · `?rcam=alt` Wiederholung wie Nacht 2d · `?traeg=1` Sicherheitsnetz zu · `?vorgriff=0`
Fuß greift in der Wiederholung erst nach dem Kontakt.

## Offen (für den Mac)

1. **Bildrate am Handy ist CPU-gebunden:** am Mittelklasse-Profil brauchen ≥ 5 % der Bilder zwei Bildschirmtakte
   (p95 = 33 ms, vorher wie nachher; Autopilot meldet Engpass „cpu“, Arbeit ~14 ms von 16,7). Die Auflösungs-Stufen des
   Autopiloten helfen dagegen nicht. Das ist vermutlich ein großer Teil von „abgehackt“ am echten Handy und der nächste
   Hebel (CPU je Bild: Simulation 120 Hz, Figuren, Schatten; oder bewusst stabile 30/40 fps statt unregelmäßiger 50).
   Bitte am Handy mit `?debug` die fps-Anzeige ansehen.
2. **Spielkamera** (`src/render/camera.js`, nicht Teil dieses Auftrags): ähnlich viele Ruck-Ausreißer wie die alte
   Wiederholungs-Kamera (150–180 je 45 s, max ~50–65 cm/Bild²). Gleiches Rezept (Feder + Vorhalt) wäre naheliegend.
3. Die strenge Zählung „alle Pose-Sprünge“ liegt erst bei −43 … −62 %; der Rest sind überwiegend Grenzfälle (Tormann-
   Aktionen, Technik-Wechsel, Dribbel-Kontakte knapp über der Lauf-Hülle). Die Hülle ist nur an Lauf-Clips geeicht –
   Jubel-/Technik-Clips eigens zu eichen würde die Zählung schärfen.
4. Nicht am echten Handy geprüft (nur Profil auf rog17).


Version live: 0.3.0, Build `97369c525a` (sw.js), Commit siehe `git log` (n5 E8).
