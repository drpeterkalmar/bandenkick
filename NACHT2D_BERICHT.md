# Bandenkick – Bericht Nacht 2d „Wucht, Magnet, Hechten, Fallrückzieher, Tor-Wiederholung“

Live: https://drpeterkalmar.github.io/bandenkick/ (nach jeder Etappe live geprüft: HTTP 200, Version = lokal, 0 Fehler,
PWA offline). Grundlage: Peters Wünsche vom 30.09. Etappe 4 (Dauergeräusch) entfällt laut Nachtrag vom 03.10., das
erledigt der Folgejob `bandenkick-n2e-stumm-pass`. Am Ton-Code ist nichts geändert, auch die Wiederholung hat keine
eigenen Klänge.

## Was neu ist (3 Etappen, je ein Commit)

1. **Wucht, Magnet, Hechten** (`77ee5b8`)
   - **Wucht 1,5** (`?wucht=`): Vollspann und angeschnittene Schüsse fliegen 1,5-mal so schnell, für Mensch und Bots,
     bis 45 m/s (162 km/h). Der Drall der Banane wächst mit, deshalb biegt sie gleich weit.
   - Volley und Dropkick sind Vollspann aus der Luft und bekommen die Wucht auch. Mit 23–28 m/s wirkten sie neben dem
     neuen Vollspann lahm. Kopfball, Flugkopfball, Seit- und Fallrückzieher bleiben, der Kopfball bleibt langsamer als
     der Fuß. Pässe, Chips und Flanken bleiben unverändert.
   - **Ballmagnet 1,2** statt 0,5, im Sprint 70 % statt 45 %. Über 1 wird nur die Feder stärker. Vorher wurden
     Vorlagezeit und -weg ab Stärke 1,4 negativ, der Ball sprang dann 22-mal je Minute weg.
   - Grätscht ein Gegner, hält der Magnet den Ball nicht fest. Eine Grätsche erobert den Ball etwas früher
     (`tackleBall` 0,1 → 0,4 m). Bleibt der Ball an der Bande im Gedränge stecken, lupft ihn der Bot nach 1,5 s zur Mitte.
     Mit dem stärkeren Magnet gab es zwei Hänger in 200 Selbstspielen.
   - **Tormann hechtet:** sobald der Ball beim ersten Hinsehen ≥ 0,7 m neben dem Körper aufs Tor kommt, auch wenn
     Laufen reichen würde, und bei Bällen ≤ 0,5 m neben dem Pfosten. Er springt bis 0,7 s vor dem Ball ab, die
     Flugphase dauert, bis der Ball da ist. Auch zu spät wirft er sich noch.
   - Landung und Aufstehen 0,5 s statt 0,75 s. Pose ausgestreckt im Bogen, der Körper liegt fast waagrecht.
   - **Balance** (Tor-Fenster aus Nacht 2c gehalten): Gegen 1,5-mal härtere Schüsse reagieren die Tormänner schneller
     (Stufe 1/2/3: 0,2 / 0,08 / 0,06 s statt 0,44 / 0,38 / 0,24 s; Auto-Torwart 0,1 statt 0,26 s). Bei Schüssen mit
     40 m/s aus 6 m gibt es sonst gar keine Reaktion.
   - Dafür fahren die Arme im Hechtsprung erst in 0,2 s aus. Vorher waren sie sofort 1,3 m lang, und der Bot hielt
     jeden Elfmeter.
   - Die Übung „Elfmeter“ spielt gegen Tormann-Stufe 1, „1 gegen 1“ gegen einen Stürmer der Stufe 1.
   - **Physik:** Bei 30–52 m/s schlüpfte der Ball in Ecken zwischen Dach- und Seitennetz durch (23 von 1500
     Zufallsschüssen draußen). Im Selbstspiel landete er in 4 von 16 Spielen hinter dem Tor, an der Kante des Tornetzes.
     Jetzt greifen die Netze an den Kanten um die größte Eindellung ineinander, nur in der Kollision, die Grafik bleibt.
2. **Fallrückzieher richtig herum** (`1da528e`)
   - **Ausrichtung je Technik** (`air.js airFrame`):
     - Fallrückzieher: Blick zum Ball, Rücken zum Tor, er fällt mit dem Kopf zum Tor.
     - Seitfallzieher: seitlich, das Schussbein auf der Torseite.
     - Volley, Dropkick, Kopfball, Flugkopfball: Blick zwischen Ball und Tor.
   - Vorher schaute jeder Spieler in Flugrichtung des Balls, mit dem Rücken zum Ball. Der Körper stand dabei auf der
     Seite, von der der Ball kam.
   - **Pose des Fallrückziehers:** flach in der Luft statt kopfüber (−2,3 → −1,75 rad). Die Hüfte liegt 0,5 m unter dem
     Ball, das Schussbein schwingt über den Kopf. Beim Kontakt ist der Ball über dem Kopf am Fuß, vorher hing er an der
     Hüfte.
   - **Falle aus dem Brief behoben:** Im freien Training nimmt ein Luftball das Tor aus dem Plan beim Drücken, nicht
     mehr aus der Blickrichtung.
   - Volley-Station: Der Flugkopfball-Ball kommt jetzt 2,2 m seitlich. Mit den neuen Körperpositionen wäre er sonst als
     Volley erreichbar gewesen.
3. **Tor-Wiederholung** (`6140b1e`)
   - Nach jedem Tor im Spiel 1 s Live-Jubel, dann bis zu 7 s Wiederholung:
     1. Aufbau aus der TV-Kamera in Echtzeit.
     2. Ballkontakt in Zeitlupe 0,2 × mit extremem Zoom. Quer seitlich auf Fuß und Ball, hoch knapp hinter dem Schützen
        dem Ball nach. Dazu Blitz, Druckwelle und Leuchtspur hinter dem Ball.
     3. Flug in Echtzeit, falls Zeit ist.
     4. **Fan-Cam:** Handkamera außerhalb des Käfigs schräg hinter dem Tor auf 1,65 m, wackelnd, Zeitlupe 0,3 ×, wenn
        der Ball über die Linie ins Netz schlägt. Die Netz-Ausbeulung ist mit aufgezeichnet.
   - Danach läuft der Jubel weiter, dann Anstoß wie gewohnt.
   - Einblendung „WIEDERHOLUNG“ mit Schütze, Technik und km/h („Orange 2 (du) · Vollspann · 149 km/h“). Dazu
     Kinobalken, Vignette und „FAN-CAM“-Abzeichen, alles CSS. Steuerung und Anzeige sind ausgeblendet.
   - **Tippen irgendwo** (oder Taste/Knopf) überspringt. Pause-Menü „Wiederholung: an/aus“, `?replay=0`. Im Training
     gibt es keine Wiederholung.
   - Technik: Ringpuffer 8 s je Spieltakt, nur Darstellungs-Zustand (Positionen, Blick, Posen-Zustand, Ball mit
     Drehlage, Netz, Ereignisse). Während der Wiederholung steht die Simulation still, sie wird nicht verändert.
     `src/sim/replay.js` ist ohne DOM und in Node getestet.

## Messtabellen

**Wucht** (`tests/node/wucht.test.mjs`, gute Lage, echte Ballphysik; Treffer ins leere Tor: 40 Schüsse mit Streuung,
Ball bis 3 m seitlich):

| Schuss | vorher (`?wucht=1`): Tempo / Flugzeit / Kurve / leeres Tor | nachher |
|---|---|---|
| 8 m Vollspann | 26,7 m/s / 0,33 s / – / 95 % | **40,1 m/s** (144 km/h) / 0,22 s / – / 98 % |
| 8 m angeschnitten | 25,4 / 0,35 / 0,54 m / 95 % | **38,1** / 0,23 / **0,54 m** / 95 % |
| 12 m Vollspann | 24,9 / 0,53 / – / 75 % | **37,3** / 0,35 / – / 80 % |
| 12 m angeschnitten | 23,8 / 0,58 / 1,18 m / 80 % | **35,7** / 0,38 / **1,19 m** / 80 % |
| 16 m Vollspann | 20,7 / 0,86 / – / 73 % | **31,1** / 0,56 / – / 75 % |
| 16 m angeschnitten | 20,0 / 0,95 / 2,09 m / 80 % | **30,0** / 0,62 / **2,05 m** / 80 % |

- Drall der Banane 8,5 → 12,8 U/s (12 m).
- Ziel-Löser bei 45 m/s: höchstens 1,4 cm daneben.
- Tunneln (`cage.test`): Bande, Seitennetz, Tornetz, Pfosten, Latte und Dach halten 45 und 52 m/s. Kein Ball draußen
  bei 1500 Zufallsschüssen mit 30–52 m/s und 400 Schüssen in die Ecken des Tornetzes.
- Ein Ball mit 40 m/s auf den Tormann der Stufe 3 (Fang-Grenze 22 m/s) wird immer nur abgewehrt. Der Abpraller fliegt
  vom Tor weg, mit einem Drittel des Tempos.

**Tormann** (CPU, Schützen Stufe 2, `keeper_probe` 24 Spiele je Stufe):

| | Nacht 2c | nur Wucht 1,5 (Tormann alt) | Nacht 2d | Ziel |
|---|---|---|---|---|
| Stufe 1: Tore je Schuss | 44,5 % | 51,9 % | **57,6 %** | ≥ 40 % |
| Stufe 2 (Standard) | 27,6 % | 37,8 % | **29,1 %** | 25–35 % |
| Stufe 3 | 16,9 % | 28,7 % | **17,9 %** | ≤ 25 %, monoton |
| Hechtsprünge je Spiel (ein Tormann, Stufe 2) | 0,9 | 0,7 | **10,1** | |

- Stufe 2 schwankt je nach Spielserie zwischen 28,5 und 35,9 % (drei Serien à 24 Spiele).
- Harmlose Roller: 0 von 120 Tor. Langsame Schüsse unter 12 m/s: 4 % Tor.
- **Eckschuss-Serie** (14–22 m/s), Ball ≥ 0,8 m neben dem Tormann → Hechtsprung:

  | Stufe | Nacht 2d | alte Hecht-Regel (`?hechten=0`) |
  |---|---|---|
  | 1 | 97 % (38/39) | 35/37 |
  | 2 | 95 % (38/40) | 34/44 |
  | 3 | 100 % (44/44) | 31/44 |
- Die Serie hält jetzt jede Stufe fast komplett. Für die Monotonie läuft sie mit 21–33 m/s (× Wucht): 47 / 2 / 0 % Tore.
- **Auto-Torwart** (40 Schüsse): 97,5 % gehalten, 21-mal gehechtet (Nacht 2c: 100 %, 3-mal).

**Selbstspiel** (Bots Stufe 2 gegen 2, 16 Spiele, gleiche Seeds, `wucht_probe.mjs`):

| | Nacht 2c | Nacht 2d |
|---|---|---|
| Hechtsprünge je Spiel (beide Tormänner) | 2,2 | **22,5** (Ziel ≥ 15 und ≥ 3 ×) |
| Paraden im Hechtsprung je Spiel | 1,6 | 17,1 |
| Schüsse / Tore je Spiel | 35,9 / 11,8 | 33,8 / 11,5 |
| Tore je Schuss | 32,9 % | 34,1 % |
| schnellster Schuss | 104 km/h | 149 km/h |
| Ball draußen / Zahlenfehler | 0 / 0 | 0 / 0 |

Hermes' Vorschau mit `?magnet=1&schuss=45` lag bei 42,3 % Toren je Schuss und 1,5 Hechtsprüngen. Die neuen
Standardwerte ersetzen sie.

**Ballmagnet** (`magnet.test.mjs`, Kinder-Stick 30 × 60 s):

| | ohne | Nacht 2c (0,5) | Nacht 2d (1,2) | Ziel |
|---|---|---|---|---|
| allein: Ball springt weg je Minute | 18,2 | 8,6 | **4,9** | ≤ 3 |
| … davon nicht nach einer Kehrtwende | 16,4 | 5,9 | **2,4** | |
| gegen einen Bot (Stufe 2) | 20,7 | 11,8 | **6,5** | ≤ 9 |
| Tempo mit Ball | 2,25 m/s | 2,99 m/s | 3,64 m/s | |
| Selbstspiel: Zweikampf-Ballverluste je Minute | | 2,81 | 2,76 | höchstens halbiert |
| Grätschen mit Ballgewinn je Spiel (48 Spiele) | | 4,3 | 4,5 | nicht seltener |

- Die Messung zählte bisher auch Bälle, die der Kinder-Spieler als „letzte Hand“ im eigenen Torraum mit den Händen
  nahm und nach 6 s abwarf. Das ist korrigiert, die Vorher-Werte sind mit der korrigierten Messung erhoben.

**Fallrückzieher und Luftbälle** (`air.test.mjs`, Volley-Station):

| Prüfung | Nacht 2c | Nacht 2d |
|---|---|---|
| Fallrückzieher: Blick ↔ Richtung Tor (cos) | +1 (schaut zum Tor) | **−1,00** (Rücken zum Tor) |
| Ball beim Kontakt entlang des Blicks | an der Hüfte | 0,24–0,37 m hinter der Körpermitte, über dem Kopf am Fuß |
| Fallrückzieher-Bälle aufs Tor | | 94 % |
| Fallrückzieher-Tore, 40 Durchgänge | 65/80 (81 %) | 61/80 (76 %) |
| Seitfallzieher Blick ↔ Tor | | \|cos\| 0,25 (seitlich) |
| Flugkopfball Blick ↔ Ball | | 0,79 |

Bei den Fallrückzieher-Toren sind Plan, Tempo, Qualität q und Zielpunkt unverändert. Der Unterschied ist Zufall der
Streuung (±4,5 %). Der Test verlangt ≥ 72 %.

**Tor-Wiederholung** (`replay.test.mjs`, `smoke.py`):

| Prüfung | Ergebnis |
|---|---|
| Ringpuffer | 8,00 s, 679 KB |
| Kontakt-Takt gefunden (6 Tore) | 6/6, davon 5 vom Torschützen, das sechste ein Eigentor |
| Ball beim Kontakt-Takt am Ort des Ereignisses | 0,000 m |
| Ablauf | Zeitlupe am Kontakt und in der Fan-Cam, höchstens 6,5 s (mit Jubel ≤ 7,5 s) |
| Spielzustand nach der Wiederholung | Hash unverändert; das Spiel läuft danach genauso weiter wie ohne (6/6) |
| Browser hoch/quer/Desktop | Tor → Aufbau → Kontakt → Fan-Cam → Anstoß; Tippen überspringt; 0 Fehler |
| Leistung während der Wiederholung (CPU p95 + GPU p95) | höchstens 12,8 ms je Bild |

**Leistungs-Gate** (`perf.py`): schlechtester Fall 13,4 ms je Bild (Nacht 2c 13,6 ms), bestanden.

**Tests:**

- `npm test`: 19 Dateien grün. Neu: `wucht`, `replay`. Erweitert: `cage` (52 m/s, Netzkanten, Tor-Ecken),
  `keeper` (Hechten), `air` (Ausrichtung, Fallrückzieher, Training), `magnet` (Nacht 2c als Referenz, Grätschen).
- `smoke.py` und `test_touch.py`: hoch und quer grün, 0 Fehler, Knöpfe ≥ 48 px, keine Überlappung.

**Fotos** in `tests/shots/final/n2d_*.jpg` (hoch und quer), alle selbst angesehen:

- Sechs Luftball-Techniken im Kontaktmoment, je mit Spiel- und Seitenkamera.
- CPU-Tormann im Hechtsprung gegen 35 m/s.
- Wiederholung: Aufbau, Kontakt-Zoom (quer zusätzlich mit Blitz), Fan-Cam mit Ball im Netz.

## Bitte am Handy testen

1. **Wucht:** Schießen mit Tipp bzw. Doppeltipp.
   - Zu hart: `?wucht=1.3`. Wie früher: `?wucht=1`.
   - Banane mit weniger Drall: `?wuchtDrall=0`, die Kurve wird dann kleiner.
2. **Magnet:** Bleibt der Ball jetzt am Fuß, ohne zu kleben?
   - Weniger: `?magnet=0.8`. Nacht 2c: `?magnet=0.5&magnetSprint=0.45`.
   - Das alte `?magnet=1&schuss=45` bitte weglassen: `schuss=45` macht zusätzlich alle Schüsse härter, auch
     Befreiungsschläge.
3. **Torwart:** Hechtet er genug, ist er zu stark oder zu schwach?
   - Gegner-Tormann weicher: `?tormann=1.5`, härter: `?tormann=2.5`.
   - Alte Hecht-Regel: `?hechten=0`. Später springen: `?hechtVorlauf=0.5`. Länger am Boden: `?groundT=0.75`.
4. **Fallrückzieher:** Eine Flanke von vorn mit dem Rücken zum Tor – fällt er jetzt richtig?
   - Am leichtesten zu sehen im Training → Volley-Station (Ball 4 und 10).
5. **Wiederholung:** Nach einem Tor startet sie nach 1 s. Tippen überspringt.
   - Aus: Pause-Menü „Wiederholung“ oder `?replay=0`. Mehr Jubel davor: `?replayDelay=1.5`.

## Offene Punkte

- **Kinder-Stick allein 4,9 statt ≤ 3 Ballverluste je Minute.**
  - Die Hälfte davon kommt nach einer Kehrtwende (Stick > 150° gegen die Laufrichtung). Dort lässt der Magnet
    absichtlich los, wie im Auftrag verlangt („eine deutliche Stick-Wende lässt den Ball weiter los“).
  - Ohne Kehrtwenden sind es 2,4 je Minute.
  - Ein Versuch mit Mitnahme in der Wende machte es schlechter (6,1).
- **Der Ball läuft beim Führen enger am Fuß:** höchstens 0,14 m Abstand statt 0,28 m. Die Kontakte bleiben echt (gleich
  viele je Meter). Der alte Test „≥ 0,25 m“ ist auf ≥ 0,12 m gesenkt. Wenn es nach Klebeball aussieht, hilft
  `?magnetLead=0.35`. Dann ist die Vorlage wie in Nacht 2c, aber der Ball springt wieder 5,9-mal je Minute weg.
- **Tormänner reagieren sehr schnell (bis 0,06 s).** Nur so halten sie gegen 40 m/s die Tor-Fenster. Ihre Schwäche
  liegt jetzt in den Armen, die erst ausfahren, und in Hechtsprüngen, die zu spät kommen.
  - Besser wäre, dass der Tormann die Ecke am Anlauf des Schützen liest und auch mal falsch rät. Das wäre noch mehr
    Spektakel, aber ein größerer Umbau.
  - Der isolierte Tormann (feste Eckschuss-Serie mit 14–22 m/s) hält dadurch auf Stufe 2 und 3 fast alles.
- **Luftbälle im Selbstspiel seltener** (16 → 9 je Spiel). Mit den richtigen Körperpositionen sind manche Bälle für
  Bots nicht mehr als Volley erreichbar.
- **Dropkick-Pose:** Der Fuß trifft den Ball (0,17 m hoch) von oben, die Pose zeigt das Bein waagrecht. Das kommt mit
  den Mixamo-Clips in Nacht 4.
- **Wiederholung:**
  - Bei sehr harten Schüssen aus kurzer Distanz entfällt der Echtzeit-Flug, und die Fan-Cam beginnt direkt nach dem
    Kontakt.
  - Ohne Ton (Etappe 4 entfällt). Ein verlangsamter Schuss- oder Netzklang wäre ein Punkt für den Folgejob.
- **Lautlos-Schalter am iPhone** (`audioSession 'playback'`) ist nicht angefasst: Etappe 4 entfällt, alle Töne fliegen
  im Folgejob raus.
