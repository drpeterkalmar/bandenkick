# Bandenkick – Bericht Nacht 2c „Spielgefühl für Kinderhände“

Live: https://drpeterkalmar.github.io/bandenkick/ (Version `04c7292e41`; nach jeder Etappe live geprüft: HTTP 200,
Version = lokal, 0 Fehler, PWA offline). Grundlage: Peters Wünsche vom 29.09. abends. Der Ton-Umbau von Hermes
(`611ba67`) bleibt unverändert.

## Was neu ist (6 Etappen, je ein Commit)

1. **Torwart** (`ffad2d4`)
   - **Auto-Torwart:** Steuerst du die letzte Hand im eigenen Torraum, fängt und hechtet er selbst. Die Stärke
     entspricht dem alten Bot-Tormann der Stufe 2. Es gibt keine grünen Knöpfe mehr.
   - Laufen darfst du selbst, der Stick gewinnt. Läufst du deutlich weg, hechtet er auch nicht in die andere Ecke.
     Lässt du den Stick los, stellt er sich richtig hin.
   - Mit Ball: Pass = Abwurf, Schuss = Abschlag (ein Druck reicht). Ohne Eingabe wirft er nach 2 s selbst ab.
   - In den drei Torwart-Übungen im Training bleiben die Knöpfe.
   - Umgesetzt als dieselbe Tormann-Funktion wie bei den Bots (`bots.js keeper()`), keine Kopie.
   - **CPU-Tormann schwächer**, mit eigenen Stufen `?tormann=1…3` (Zwischenwerte erlaubt). Stellschrauben:
     Reaktionszeit, Stand- und Hecht-Reichweite, Fingerspitzen (scharfe Bälle nur abgefälscht), Stellungsfehler,
     Abwehr statt Fangen bei harten Schüssen.
   - Nebenbei behoben: Flache Schüsse lenkte bisher der **Fuß** des Tormanns ab, bevor die Hände dran waren. Im
     Torraum haben jetzt die Hände Vorrang.
2. **Pass und Schuss ohne Aufladen** (`036516e`)
   - **Tipp** = Standard: flacher Pass in den Laufweg bzw. Vollspann. Die Stärke wählt das Spiel: nah platziert,
     weit hart.
   - **Doppeltipp** = Zweitfunktion: Pass hoch bzw. angeschnitten. Den „kurzen Schuss“ gibt es nicht mehr.
   - Der erste Druck merkt den Kick sofort vor, der Spieler läuft schon hin und legt einen Schritt zu. Halten wirkt
     wie Tippen.
   - **Luftbälle per Tipp:** Die Technik-Hilfe wartet auf den besten Moment. Zu spät gedrückt kostet höchstens
     15 % Timing-Wert.
   - `?laden=1` = Gesten aus Nacht 2b. Hilfekarte, ☰ → Steuerung und README sind angepasst.
3. **Leichter Ballmagnet** `?magnet=` (Standard 0,5; `04a3316`)
   - Zwischen den echten Kontakten führt eine weiche Feder den Ball quer auf die Stick-Linie und bremst zu weite
     Vorlagen.
   - Nach vorn bringt ihn weiter nur der Fuß: kein Klebeball, die Kontakte bleiben sichtbar.
   - Kürzere Vorlagen und genauere Kontakte.
   - Schwächer im Sprint, bei scharfen Richtungswechseln (ab 60°) und mit Gegner unter 1 m (dann legt er den Ball
     leicht auf den abgewandten Fuß).
   - Zieht nie in die Bande. Gilt für alle Spieler, auch Bots.
4. **Festere Bananen und Flanken** (`b519d53`)
   - Banane mit Grundtempo wie Vollspann, gleich große Kurve (`?banane=`).
   - Flanke 14–24° statt 25–45°, 2,5 statt 5 U/s Rückdrall (`?flanke=`). Kurzer Chip bis 5 m bleibt steil.
   - Nebenbei behoben: Die Chip-Tabelle zählte bei flachen Bällen erst den zweiten Aufsetzer. Hohe Pässe landen
     jetzt auf 5–15 cm genau (vorher bis 0,8 m daneben).
5. **Größeres Feld 24 × 15 m** (`?feld=20x13` = alt; `0c1a39e`)
   - Tor 3 × 2 m und Torraum bleiben.
   - Die Kamera zieht mit, die Figuren wirken im Bild 16–18 % kleiner.
   - Die Übungen sind relativ zu Tor und Bande aufgebaut, Abstände und Schwierigkeit bleiben also gleich.
6. **Grätsche** (`b88899d`)
   - Auslöser: nicht am Ball, Pass oder Schuss getippt, der Gegner hat den Ball in bis zu 2,5 m. Ist der Ball frei,
     läuft der Spieler wie bisher hin.
   - Ablauf: 0,5 s rutschen, 0,6 s am Boden.
   - Ball zuerst erwischt: Pass-Knopf → Pass zum Mitspieler im Stick-Kegel. Schuss-Knopf → bis 11 m vor dem Tor
     Schuss, sonst weit nach vorn klären.
   - Gegner zuerst getroffen: kein Foul, der Ball springt frei, der Gegner stolpert 0,6 s.
   - Bots grätschen je nach Stufe gelegentlich.
   - Dazu: Pose, Rutsch-Klang (dunkles Rauschen 300–1100 Hz), Meldung „Grätsche! Ball erobert / Ball frei“.

## Messtabellen

**CPU-Tormann: Tore je Schuss**, Schützen auf Stufe 2, Gegner-Mannschaft Stufe K
(`tests/node/keeper_probe.mjs`, ≥ 24 Spiele je Stufe):

| Stufe | vorher (20 Spiele) | nachher (24 Spiele, 24 × 15, mit Grätsche) | Ziel |
|---|---|---|---|
| 1 | 33,5 % | **52,4 %** | ≥ 40 % |
| 2 (Standard) | 14,2 % | **30,8 %** | 25–35 % |
| 3 | 16,7 % (nicht monoton) | **19,7 %** | ≤ 25 %, monoton |

- **Nur der Tormann wechselt** (Feldspieler Stufe 2, 30 Spiele, auf 20 × 13): 33 / 28 / 18 %.
- **Tormann isoliert:** feste Eckschuss-Serie, 14–22 m/s aus 7–11 m (`keeper_series.mjs`): 57 / 21 / 0 % Tore.
- **Harmlose Roller** (6–11 m/s aus 6–10 m): 0 von 40 Toren je Stufe.
- **Schüsse unter 12 m/s im Spiel:** 3,8–4,8 % Tore (dabei auch Stocherbälle aus 2 m).
- **Auto-Torwart ohne Knopf** (40 Schüsse, 14–20 m/s aus 7–10 m): 100 % gehalten, 3-mal gehechtet. Mit
  `?autotorwart=0` ohne Knopf: 0 %.
- **Abwurf:** Mit freiem Mitspieler kommt der Abwurf nach 2,0 s. Ohne Mitspieler schlägt er spätestens nach 4,4 s
  ab, nie erst über die 6-s-Regel.

**Tipp statt Aufladen** (`tests/node/tap.test.mjs`):

| Messung | Ergebnis |
|---|---|
| Tipp → Ballkontakt beim Führen (40 Lagen) | **Ø 0,196 s**, Median 0,192 s (Ziel ≤ 0,2) |
| Ball ruhig am Fuß | 0,192 s = Tippdauer 0,07 + Fenster 0,11 s |
| Sprint (Ball bis 1,8 m vorgelegt) | Ø 0,44 s – Laufweg zum Ball, keine Gesten-Wartezeit |
| 1000 Zufalls-Gesten | jeder Druck genau ein Ergebnis |
| Luftball 0,3 s zu früh gedrückt | Timing 1,00 statt 0,05 (Hilfe wartet auf den besten Moment), gleiche Torquote |

**Ballmagnet** (`tests/node/magnet.test.mjs`):

| Messung | ohne (`?magnet=0`) | mit 0,5 |
|---|---|---|
| Zappeliger Kinder-Stick allein (30 × 60 s): Ball springt weg | 17,1 / min | **8,6 / min** (−50 %) |
| … Tempo mit Ball | 2,13 m/s | 2,99 m/s |
| … gegen einen Bot (Stufe 2) | 21,0 / min | 14,7 / min |
| Selbstspiel: Ballverluste beim Führen | 2,56 / min | 2,21 / min (−14 %) |
| Dribbel-Parcours, Kinder-Skript | 6,19 s, 0 Verluste | 6,14 s, 0 Verluste |
| Führen geradeaus: Kontakte auf 29 m | 11 | 26 (echte Kontakte, max. 0,33 m vom Fuß) |

**Banane und Flanke** (`tests/node/curve.test.mjs`, echte Ballphysik):

| | vorher: Tempo / Flugzeit / Scheitel / Kurve | nachher |
|---|---|---|
| Banane 8 m | 21,7 m/s / 0,42 s / 0,46 m / 0,55 m | 25,4 m/s (95 % Vollspann) / 0,35 s / 0,41 m / 0,54 m |
| Banane 12 m | 20,3 / 0,68 / 0,80 / 1,17 | 23,8 (96 %) / 0,58 / 0,64 / 1,18 |
| Banane 16 m | 17,0 / 1,18 / 1,98 / 2,13 | 20,0 (97 %) / 0,95 / 1,37 / 2,09 |
| Flanke 9 m | 38° / 10,1 m/s / 1,33 s / 2,12 m | 23° / 11,4 m/s / 0,98 s (−26 %) / 1,14 m |
| Flanke 12 m | 33° / 12,1 / 1,46 / 2,43 | 18° / 14,0 / 1,05 (−28 %) / 1,24 |
| Flanke 15 m | 29° / 13,9 / 1,53 / 2,56 | 14° / 16,3 / 1,07 (−30 %) / 1,16 |
| Chip 6 m (über den Tormann) | 43° | 38° (bleibt steil) |

„Vorher“ ist mit korrigierter Chip-Tabelle gemessen, sonst wäre die Landestelle falsch.

**Feld und Kamera** (Pixel 7, CSS-px):

- Figur 1,78 m hoch: Hochformat 57 → **47 px**, Querformat 63 → **53 px**.
- Ball: 15 → 13 px bzw. 18 → 15 px.
- Leistungs-Gate: schlechtester Fall 13,6 ms je Bild (≤ 16 ms), bestanden.

**Grätsche:**

- Bots auf Stufe 2: etwa 8 Grätschen je Spiel, davon 4 mit Ball (2,8 Pass, 1,3 Schuss/Klären), 3,3 treffen zuerst
  den Gegner.
- In 200 Selbstspielen keine Hänger.

**Selbstspiel** (200 Spiele, alle Paarungen):

- Keine Hänger, 0 Numerik-Fehler.
- 18,3 Tore je Spiel (2,06 je Minute; Nacht 2b 12,4). Mehr Tore kommen vom schwächeren Tormann und den Grätschen.
- Stärke 2 > 1 und 3 > 1 je 100 %, 3 > 2 in 76–92 %.

**Ton** (`ton_ab.py`, Brutzel-Anteil über 2 kHz):

- Referenz-Szene (Seed 3, 35 s): 3,1 %.
- Dieselbe Szene mit 10 eingestreuten Grätschen: 4,3 % (Ziel ≤ 5 %).
- Eine 60-s-Szene auf dem großen Feld liegt bei 5,1 % – mit dem Ton vom 29.09. genauso hoch, das liegt an der
  Mischung der Ereignisse, nicht an den neuen Klängen.

**Tests:**

- `npm test`: 18 Dateien, alle grün. Neu: `keeper`, `tap`, `magnet`, `curve`, `tackle`.
- `tests/smoke.py` (hoch, quer, Desktop) und `tests/test_touch.py` (echte Touch-Gesten hoch und quer): grün,
  0 Fehler, Knöpfe ≥ 48 px, keine Überlappung.

**Fotos** in `tests/shots/final/n2c_*.jpg` (hoch und quer), alle selbst angesehen:

- Auto-Tormann im Hechtsprung mit Ball.
- Grätsche mit gestrecktem Bein am Ball und Meldung.
- Flache Flanke in den Torraum (Schatten unter dem Ball).
- Großes Feld mit Bots.

## Bitte am Handy testen (mit den Kindern)

1. **Torwart:** Einfach laufen lassen – fängt und hechtet er gut? Zu stark oder zu schwach?
   - Gegner-Tormann weicher: `?tormann=1.5`, härter: `?tormann=2.5`.
   - Alte grüne Knöpfe: `?autotorwart=0`.
2. **Tipp/Doppeltipp:** Klappt der Doppeltipp für den hohen Pass bzw. die Banane?
   - Wird er zu oft als zwei Einzeltipps erkannt, hilft `?doppel=0.15` (Einzeltipp dauert dann 0,04 s länger).
   - Wer lieber auflädt: `?laden=1`.
3. **Ballmagnet:** Bleibt der Ball beim Dribbeln am Fuß, ohne zu kleben? Weniger: `?magnet=0.3`, mehr:
   `?magnet=0.8`, aus: `?magnet=0`.
4. **Banane/Flanke:** Alte Flugbahnen zum Vergleich mit `?banane=0` bzw. `?flanke=0`.
5. **Feld:** Sind die Figuren klein genug und der Ball gut zu sehen? Altes Feld und alte Kamera: `?feld=20x13`.
6. **Grätsche:** Wenn der Gegner den Ball hat, einfach Schuss oder Pass tippen. Zu oft oder zu selten? Aus mit
   `?graetsche=0`, Reichweite z. B. `?tackleReach=2`.

## Offene Punkte

- **Ballverluste der Bots im Selbstspiel nur −14 % statt halbiert.**
  - 90 % davon sind Zweikämpfe, und dort soll der Magnet laut Auftrag schwächer sein („Tackles bleiben möglich“).
  - Beim Führen mit Kinder-Stick ist die Wirkung halbiert – das ist der Fall, um den es Peter geht.
- **Dribbel-Parcours nicht schneller.**
  - Mit Kinder-Skript 6,2 s mit und ohne Magnet: Die Zeit begrenzt das Lauftempo, nicht die Ballkontrolle.
  - Das vorsichtige Challenge-Skript verpasst im Slalom weiter 2–3 Hütchen-Tore (lenkt nie mehr als 30° neben den
    Ball). Das ist ein Mangel des Test-Skripts, nicht des Spiels; die 3 Sterne holt es trotzdem.
- **Der Auto-Torwart des Menschen** ist so stark wie der alte Bot-Tormann der Stufe 2 (hält die Test-Serie
  komplett). Falls die Kinder kaum noch Gegentore bekommen, könnte er einen eigenen Regler bekommen.
- **Grätsche** gibt es nur in der Tipp-Grammatik, nicht mit `?laden=1`.
- **Querformat:** Die Leiste „Ball in der Hand – Abwurf in 6 s“ überlappt die Meldung „Gefangen“ kurz (schon seit
  Nacht 2).
- **Headless-Touch-Test** braucht weiter großzügige Gestenfenster (`?tipp=0.6&doppel=0.7`), weil CDP-Ereignisse
  50–250 ms brauchen. Die echten Werte (0,2 / 0,11 s) bestätigt nur Peters Handy.
- **Grätsche, Stolpern und Tormann-Posen** sind prozedural; echte Mixamo-Clips kommen mit Nacht 4.
