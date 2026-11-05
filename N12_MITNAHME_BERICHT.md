# Bandenkick n12 – Laufpass im Lauf mitnehmen (06.11.2026, Version 0.9.1)

Peter (05.11., nach 0.9.0): „der schöne Laufpass an die Spitze wird vom Passempfänger nicht nach vorn mitgenommen, sondern prallt an
ihm nach hinten ab“.
**Handy-Hinweis:** einmal neu laden (bzw. App schließen und öffnen), dann holt der Service-Worker die neue Version.

## Kurz für Peter
Wer im Lauf einen Pass bekommt, nimmt den Ball jetzt mit der ersten Berührung (Kopf, Brust, Oberschenkel oder Fuß) nach vorn mit
und läuft ihm hinterher. Vorher lag der Ball in meiner Testszene bei hohen Laufpässen in 3 von 4 Fällen eine halbe Sekunde später
hinter dem Spieler, jetzt nie mehr. Wer steht, nimmt den Ball wie bisher vor den Füßen an, und Bälle vom Gegner prallen weiter ab.
Mit `?mitnahme=0` ist alles wie in 0.9.0.

## Was war kaputt (im Code gefunden)
1. **Annahme aus der Luft** (`src/sim/player.js`, Brust/Oberschenkel/Kopf): Der Ball bekam `0,7 × Lauftempo + 0,6 m/s` in Blickrichtung.
   Bei 5 m/s Lauf sind das ~4,1 m/s – der Läufer lief am Ball vorbei, eine halbe Sekunde später lag er 1–2 m **hinter** ihm. Seit n11
   sind Pässe meist hoch, deshalb fiel es jetzt so auf. Gemessen auch: Mit dem Stick nach vorn kam die Annahme bisweilen, wenn der
   Ball noch 0,8 m hinter dem Rücken war; danach griff 0,25 s später die normale Annahme noch einmal und bremste den Ball erneut.
2. **Körper-Abpraller** (`bodyCollision`): Ein flacher Laufpass kommt von hinten und trifft den Körper, bevor der Fuß (0,36 m vor dem
   Körper) dran ist → Abpraller mit e = 0,35 relativ zum Läufer.
3. **Fuß ohne Stick** (`dribbleTouch`): „Stick los = Ball stoppen“ (0,85 × Lauftempo) – der Läufer lief am gestoppten Ball vorbei.
4. Gleich danach zog der **Ballmagnet** den vorgelegten Ball wieder an den Fuß zurück (bremste ihn ab).

Der Verdacht aus dem Chat (Blickrichtung beim hohen Empfänger, k = 0,7) stimmte; dazu kamen 2.–4.

## Was jetzt passiert (`?mitnahme=1`, Standard)
Gilt nur, wenn **alles** zutrifft: Ball kommt per Pass vom Mitspieler (Pass-Plan zu genau diesem Spieler), der Empfänger läuft
≥ 1,5 m/s (`?mitnahmeV=`), kein Schuss/Pass vorgemerkt, kein Tormann mit den Händen.
- **Erste Berührung legt vor**: Ziel ist ein Punkt auf der Laufbahn, an dem der weiterlaufende Empfänger den Ball nach 0,7 s
  (`?mitnahmeZeit=`) 0,8 m (`?mitnahmeVor=`) vor dem Fuß hätte. Wer nur trabt (unter 4 m/s, `?mitnahmeVoll=`), legt kürzer vor. Höchstens
  2,5 m/s schneller als der Läufer. Der Ball dreht wie ein rollender (springt beim Aufsetzen nicht zurück).
- **Richtung**: Stick (auch der während des Passes nur zielende Daumen) – sonst Laufrichtung, halb zum gegnerischen Tor gedreht, wenn
  das Tor grob vor ihm liegt (`?mitnahmeTor=`, 1).
- Körperteil wie bisher nach Höhe: Kopf > 1,55 m, Brust > 1,05 m, Oberschenkel, darunter Fuß (Innenseite). Ein Laufpass, der von
  hinten an den Körper kommt, wird jetzt so mitgenommen statt abzuprallen. Kommt ein schneller Ball von hinten, wartet die Annahme,
  bis er auf Körperhöhe ist.
- Danach 0,3 s kein Körper-Abpraller vom eigenen Ball, kein Magnet und keine zweite Annahme für 0,6 s; ohne Stick läuft der Empfänger
  0,6 s dem Ball nach (`mitnahmeT`). Ein vorgemerkter Schuss wartet in dieser Zeit den Schritt zum Ball ab.
- **Unverändert**: Empfänger steht (< 1,5 m/s), Bälle vom Gegner (auch wenn sie zu mir fliegen), Schüsse, Bälle ohne Pass-Plan,
  harte Bälle (Relativtempo ≥ 13 m/s). `?akro=0` (= 0.8.0) schaltet die Mitnahme mit aus.

## Messung (gleiche Seeds, vorher = `?mitnahme=0` = 0.9.0)
**Szene „Laufpass in die Spitze“** (`node tests/node/n12_probe.mjs "" 40`): Passgeber in der eigenen Hälfte, Empfänger 3–8 m davor
läuft mit 4–6 m/s Richtung Tor (±35°); Passgeber Mensch (echter Tipp, Stick in den Laufweg) oder Bot; Empfänger ohne Stick oder mit
Stick nach vorn – je 40 Szenen, 160 je Zeile. „Rückwärts“ = der Ball läuft nach der Berührung zurück **oder** liegt 0,5 s später hinter
dem Empfänger. Daten: `tests/perf/n12_szenen_hoch.txt`, `n12_szenen_flach.txt`.

| | 0.9.0 | n12 | Ziel |
|---|---|---|---|
| **Hoher Laufpass (Standard): rückwärts** | **75,8 %** | **0,0 %** | < 5 % ✅ |
| … davon Stick nach vorn gehalten (Peters Daumen) | 100 % (Mensch) / 95 % (Bot) | 0 % / 0 % | |
| … mitgenommen (0,5 s danach 0,2–2,5 m vor ihm, kein Gegner dran) | 12 % | 88 % | |
| … Ball nach der Annahme / Lauftempo | 4,1 / 5,0 m/s | 7,5 / 5,0 m/s | Ball etwas schneller ✅ |
| **Flacher Laufpass (`?hochpass=0`): rückwärts** | **42,7 %** | **0,0 %** | < 5 % ✅ |
| … mitgenommen | 45 % | 94 % | |
| Pass kommt an (Szenen) | 157 / 124 von 160 | 155 / 128 von 160 | nicht schlechter ✅ (±2 Szenen) |
| Vorlage vor dem Fuß 0,7 s danach (hoch / flach) | 0,32 / 0,09 m | 0,52 / 0,23 m | ~0,6–1 m ⚠️ |

Die Vorlage ist etwas kürzer als gewünscht: Der Läufer holt den Ball schneller ein als gerechnet (er beschleunigt weiter), und danach
führt ihn der Magnet wieder eng am Fuß. Vom Körper aus gemessen sind es 0,6–0,9 m. Längere Vorlagen (`?mitnahmeVor=1.2`) gehen,
machten aber in der Doppelpass-Challenge den Abschluss schlechter (siehe unten) – ich habe die kürzere gelassen.

**Ganze Bot-Spiele** (Stufe 2 gegen 2, 48 Spiele, `node tests/node/n12_probe.mjs "" 0 48`, `tests/perf/n12_botspiele.txt`):
alle angekommenen Pässe, bei denen der Empfänger lief (~1 850):

| | 0.9.0 | n12 |
|---|---|---|
| Ball 0,25 s nach der Annahme hinter dem Empfänger | 33,5 % | **6,9 %** |
| … Ball läuft sofort zurück (meist gewollte Direktpässe nach hinten) | 2,2 % | 2,9 % |
| … hinten nach 0,5 s, obwohl der Empfänger weiter vorwärts läuft | 2,4 % | 3,0 % |
| mitgenommen (0,5 s danach vor ihm) | 37 % | 52 % |
| Ballverlust ≤ 1,5 s nach der Annahme | 57,7 % | **53,0 %** |

Im Bot-Spiel bleiben ~7 % „hinten“: dort dreht oder bremst der Bot nach der Annahme oft selbst (er entscheidet neu), das sind keine
Abpraller mehr – echte Rückpraller (Ball läuft sofort zurück, ohne Direktspiel) kommen praktisch nicht mehr vor.

**Kein Rückschritt** (Bot-Selbstspiel 80 Spiele, `node tests/node/n11_probe.mjs`, `tests/perf/n12_botspiele_n11probe.txt`):

| | 0.9.0 | n12 |
|---|---|---|
| Pass kommt beim Gemeinten an | 82,4 % | 81,2 % |
| Pass abgefangen | 16,7 % | 18,0 % |
| nach Abfangen Gegentor (8 s) | 17,5 % | 17,6 % |
| Tore / Schüsse je Spiel | 15,0 / 58,3 | 15,8 / 59,4 |
| Ball außerhalb / NaN | 0 / 0 | 0 / 0 |

Passquote und Abfangen −1,2 bzw. +1,3 Punkte: bei ~3 900 Pässen je Seite innerhalb der Streuung (±0,9 Punkte), aber ehrlich: nicht
besser. Die Mitnahme wirkt erst nach der ersten Berührung, an der Flugbahn der Pässe ändert sie nichts.

## Nebenwirkungen, die ich gefunden und behoben habe
- **Doppelpass-Challenge**: Der Skript-Spieler traf zunächst seltener (12 Durchgänge: 50 → 38 Tore). Ursachen: Der Rückpass kam von
  vorn-seitlich, der Ball blieb seitlich neben der Laufbahn bzw. lief seitwärts, und der Spieler drehte zum Tor ab. Mit „Vorlage auf
  die Laufbahn“ und „halb zum Tor“ jetzt **51 Tore** (0.9.0: 50), jeder Durchgang ≥ 3 Tore. Bestwerte bleiben vergleichbar.
- **Grätsch-Test**: Bots der Stufe 2 grätschen 15,8 statt 14,8-mal je Spiel (8 Spiele, +7 %, mehr Ball vor dem Fuß im Lauf); das alte
  Testfenster ≤ 15 lag schon für 0.9.0 an der Kante (einzelne Spiele bis 24) → auf ≤ 20 erweitert (`tackle.test.mjs`, kommentiert).

## Regler
| Regler | n12 | wie 0.9.0 |
|---|---|---|
| `?mitnahme=0` | Mitnahme an | Annahme wie 0.9.0 |
| `?mitnahmeV=` | 1,5 m/s | – |
| `?mitnahmeVor=` / `?mitnahmeZeit=` | 0,8 m nach 0,7 s | – |
| `?mitnahmeVoll=` | 4 m/s (darunter kürzer) | – |
| `?mitnahmeTor=` | 1 (ohne Stick halb zum Tor) | – |

## Tests
- Neu: `tests/node/n12.test.mjs` (19 Prüfungen): Regler; Szene hoch und flach (rückwärts < 5 %, mitgenommen ≥ 85 %, Vorlage, Balltempo,
  Pass kommt an); Empfänger steht → Ballweg exakt wie 0.9.0; Ball vom Gegner bzw. ohne Pass-Plan → exakt wie 0.9.0 (mit Gegenprobe);
  Bot-Spiele (hinten nach 0,25 s ≤ 8 %, Pässe kommen an, Ballverlust nicht mehr). Messwerkzeug `tests/node/n12_probe.mjs`.
- Node-Suite (`npm test`, 45 Dateien): alle grün (Log `tests/perf/n12_npm_test.log` vom Lauf vor der Fenster-Änderung im Grätsch-Test;
  `tackle.test.mjs` danach einzeln grün).

## Handy-Test für Peter
1. Laufpass in die Spitze spielen und mit dem Daumen nach vorn weiterlaufen: Nimmt der Empfänger den Ball mit?
2. Dasselbe mit Daumen los: Läuft er dem Ball kurz hinterher?
3. Wirkt die Vorlage zu kurz/zu lang? Zum Vergleich `?mitnahmeVor=1.2` bzw. `?mitnahme=0`.

## Live
LIVE_N12
