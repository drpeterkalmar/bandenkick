# Bandenkick n11 – Akrobatik-Fußball (05.11.2026, Version 0.9.0)

Peters Wunsch (02.11. und 04.11.): „ball springt höher und spieler auch … mit ferse schiessen und passen, zb im Rahmen eines
vorwärtssaltos … Pässe gehen immer hoch“ – und dazu: „separater schuss und pass knopf der aber mit 1x drauftippen alles automatisch
berechnet und je nach situation das beste und spektakulärste draus macht. die bälle können auch viel mehr effet bekommen“.
**Handy-Hinweis:** einmal neu laden (bzw. App schließen und öffnen), dann holt der Service-Worker die neue Version.

## Kurz für Peter
- **Zwei Knöpfe, je ein Tipp.** Kein Halten, kein Doppeltipp, kein Lade-Ring mehr. Das Spiel rechnet alles selbst: wohin
  (Ecke im Tor bzw. Mitspieler mit freiem Weg), womit (Innenseite, Außenrist, Vollspann, Hacke, Volley, Dropkick, Kopfball,
  Seitfall-/Fallrückzieher, Flugkopfball, **Salto-Hacke**), wie hoch, wie hart und mit wie viel Effet.
- **Regel der Wahl:** erst die Erfolgschance, dann – unter Optionen, die höchstens 10 % schlechter sind – die spektakulärste
  (Salto-Hacke > Fallrückzieher > Seitfall/Flugkopf > Volley/Hacke > Außenrist-Effet > Innenseite). Nie eine klar schlechtere.
- **Beispiele:** Ball am Fuß, Tor frei → meist angeschnittener Innenrist um den Tormann herum. Mit dem Rücken zum Tor, Ball am
  Standbein → Hackenschuss. Flanke von der Seite → Seitfallzieher oder Volley. Ball kommt hoch aus Torrichtung über dich drüber →
  ab und zu die Salto-Hacke. Pass-Knopf, wenn ein Ball hoch auf dich zukommt → Kopfball- oder Volleypass zum Mitspieler.
- **Über dem Knopf** steht klein, was ein Tipp gerade spielen würde (z. B. „↪ Innenrist“, „✦ Fallrückzieher“). **✋ kein freier
  Pass** heißt: gerade ist jeder Weg zu – dann behält dein Spieler den Ball am Fuß, und der Pass geht, sobald ein Weg frei wird.
- **Pässe gehen immer hoch** (Lupfer, Außenrist-Lupfer, Kurvenpass, Hacke) und kommen in Volley-, Brust- oder Kopfhöhe an.
  Nur ein kurzer flacher Pass, wenn der hohe zu ist und der flache sicher.
- **Effet:** 18 statt 10 Umdrehungen/s (Rückdrall 11 statt 7); die Kurve eines Innenseit-Schusses über 20 m ist 1,8-mal so stark
  (2,9 → 5,1 m). Die Zielrechnung kennt die Kurve, deshalb gehen die Bälle trotzdem aufs Tor.
- **Ball** springt aus 2 m knapp 1,0 m statt 0,67 m hoch; **Spieler** springen bis 1,0 m (Kopfball), Seit-/Fallrückzieher,
  Flugkopfball und Salto 30 % höher; der Tormann springt genauso hoch (Fanghöhe +0,4 m).
- **Ein-Knopf-Test:** im Pause-Menü „Ein Kick-Knopf (Test)“ (Standard aus). Ergebnis siehe unten: kein Vorteil.

## Regler (alte Werte bleiben abrufbar)
| Regler | n11 | wie 0.8.0 |
|---|---|---|
| `?akro=0` | – | alles aus dieser Nacht aus |
| `?abprall=` | 0,75 | 0,621 |
| `?sprungkraft=` | 1,0 m | 0,6 |
| `?effet=` | 18 U/s (+ `?clSteig=0.7`: Magnus über dem Plateau) | 10 (und `?clSteig=0`) |
| `?hochpass=0` | hohe Pässe | flache Pässe |
| `?autotech=0` | ein Tipp, automatisch | Tipp/Doppeltipp |
| `?salto=0` | Salto-Hacke + Hackenschuss | aus |
| `?gelenke=0` | Fuß trifft mit dem Körperteil, Gelenkgrenzen | Schuss-IK wie 0.8.0 |
| `?einknopf=1` | Ein-Kick-Knopf-Test | – |
| `?spektakel=` | 0,1 (höchstens 10 % schlechter fürs Spektakel) | – |
| `?hochSicher=`, `?hochGemeint=`, `?botSicher=` | 0,06 / 0,1 / −0,03 s Zeitreserve | – |

## Messung (gleiche Seeds, vorher = 0.8.0 bzw. `?akro=0`)
Bot-Selbstspiel Stufe 2 gegen 2, 80 Spiele (`node tests/node/n11_probe.mjs "" 80`; Daten `tests/perf/n11_vorher.txt`, `n11_nachher.txt`):

| Größe | 0.8.0 | n11 | Ziel |
|---|---|---|---|
| Ballkontakte in der Luft je Minute | 11,7 | **22,8** (× 1,95) | deutlich mehr ✅ |
| Akrobatik-Anteil an allen Kicks (Luftbälle, Hacke, Salto) | 13,5 % | 16,2 % | mehr ✅ (nur mäßig) |
| Effet-Anteil (Innen-/Außenrist, Kurvenpass) | 14,0 % | 20,2 % | – |
| Pässe kommen beim Gemeinten an | 63,7 % | **82,4 %** | ≥ 60 % ✅ |
| Pässe abgefangen | 35,4 % | **16,7 %** | ≤ die Hälfte ✅ |
| Gegentore nach eigenem Fehlpass (≤ 8 s) je Spiel | 4,6 | **1,4** | deutlich weniger ✅ |
| Pässe je Spiel | 92,6 | 48,7 | (Bots passen nur noch über freie Wege) |
| davon hoch | 6 % | 61 % (Rest: Anstoß, Bandenpässe) | – |
| Tore je Spiel | 15,8 | 15,0 (−5 %) | ±30 % ✅ |
| Schüsse / Tormann-Paraden je Spiel | 52 / 55 | 58 / 65 | – |
| Ball außerhalb / NaN | 0 / 0 | 0 / 0 | 0 ✅ |

Seltene Techniken in 80 Spielen: Salto-Hacke 34, Fallrückzieher 31 (vorher 19), Seitfallzieher 199 (93), Volley 938 (474).

**Deine Pässe (echte Gesten, `tests/node/pass_probe.mjs`, 10 Spielweisen):** abgefangen **16 % → 7 %** ✅ (Ziel ≤ 8 % und ≤ 15 %),
kommt beim Gemeinten an 79 % → **72–74 %** (Ziel 75 % knapp verfehlt: ist der Weg zum Gemeinten zu, geht der Pass jetzt zum
freien Mitspieler – 18 % statt 4 % – oder gar nicht, 5 %). Mit `?hochGemeint=0.15` kämen 75 % beim Gemeinten an, aber in ganzen
Spielen würde dann wieder jeder dritte Pass abgefangen – ich habe die Sicherheit vorgezogen (deine Hauptsorge).

**Ganze Spiele mit Skript-Mensch, 12 Spiele (`tests/node/einknopf_probe.mjs`, `tests/perf/n11_einknopf.txt`):**

| | 0.8.0 | n11 zwei Knöpfe | n11 Ein-Knopf-Test |
|---|---|---|---|
| eigene Pässe abgefangen | 53,7 % | **20,6 %** | 23,4 % |
| Gegentor ≤ 8 s nach abgefangenem Pass | 91 | **24** | 29 |
| Schüsse | 213 | 229 | 263 |
| Tore des Skript-Menschen-Teams | 65 | 38 | 35 |

→ **Ein Knopf bringt nichts** (etwas mehr Abfangen, etwas mehr Gegentore) – zwei Knöpfe bleiben Standard. **Frage an Peter:** In
diesen Skript-Spielen schießt das Team des Skript-Menschen weniger Tore (65 → 38); an der Spektakel-Wahl liegt es nicht
(`?spektakel=0`: 41), an den hohen Pässen nur teils (`?hochpass=0`: 48). Bei den Bots ist die Torzahl gleich geblieben. Fühlt sich das
Toreschießen am Handy schwerer an? Dann schaue ich gezielt nach (Tormann springt jetzt höher, Ball springt höher).

Effet/Ball: Abprall 0,67 → 0,97 m, Kurve 20 m 2,87 → 5,08 m (× 1,77, Ziel 1,6–2 ✅). Nur 18 U/s ohne mehr Magnus hätte praktisch nichts
gebracht (3,0 m): der gemessene Auftrieb des Balls ist bei 25 m/s schon bei 10 U/s ausgereizt – deshalb wächst er über dem Plateau
weiter (Spektakel vor Realismus, `?clSteig=0` = Windkanal-Werte).

## Körperteil am Ball, Gelenke
- Neue Datei `src/render/gelenke.js`: Gelenkgrenzen in einer Tabelle – Hüfte (Kugelgelenk) Beugung −45…150°, Abspreizen −30…90°,
  Drehung ±60°; Knie 0…160° (nie nach vorn durchgedrückt); Sprunggelenk −50…45°. Dazu je Technik das Körperteil (Innenseite,
  Außenrist, Spann, Ferse, Kopf, Brust, Oberschenkel) und das Fuß-Ziel, damit genau dieses Teil die Balloberfläche trifft.
  Hüftstreckung −45° statt der üblichen −30°: die Kuscheltiere sind „sehr beweglich“, der Skorpion-Kick braucht es.
- Das Spielbein trifft jetzt mit vollem Gewicht; liegt der Ball weiter weg, als die kurzen Kuscheltier-Beine reichen, macht die Figur
  einen kleinen Ausfallschritt (bis 0,2 m, nur Grafik).
- Salto-Hacke: eigene Bewegung auf dem Skelett (Vorwärtssalto kopfüber, beide Knie stark gebeugt, Fersen schlagen hinter dem Rücken
  an den Ball, Landung über die Arme). Kurz nach dem Treffpunkt bleibt die Treff-Pose stehen, damit das Kontaktbild sie zeigt.
- Test `tests/node/gelenke.test.mjs`: 1 600 Zufallslagen (8 Techniken × 200) – kein Gelenk über der Grenze (Rechentoleranz 2°),
  Knie nie durchgedrückt ✅. Kontaktbild an allen 6 Tieren, Abstand Körperteil ↔ Ballmitte (Ziel ≤ Ballradius + 3 cm = 14 cm):
  Innenseite 13,1 · Außenrist 12,7 · Spann 13,7 · Hacke 6,5 · Volley 10,9 · Seitfall 9,4 cm ✅ –
  **Fallrückzieher 19,8 cm und Salto-Hacke 31 cm ❌ (nicht erreicht)**: dort bringt die Körperhaltung den Fuß noch nicht genau
  genug hin. Ehrlich offen für eine nächste Runde.
- Kontaktbild aus der Tor-Wiederholung (Schuss, Fuß am Ball, links 0.8.0, rechts n11): [hoch](tests/shots/n11/kontakt_hoch.jpg),
  [quer](tests/shots/n11/kontakt_quer.jpg). Eine Collage je Technik mit Sichtprüfung habe ich **nicht** mehr geschafft.

## Wiederholung / Fan-Edit
Salto-Hacke ist jetzt das spektakulärste Ereignis (Bullet-Time wie Fallrückzieher), Volley-/Kopfballpass und Kurvenpass zählen
mit; der Fan-Edit blendet „SALTO-HACKE“, „KURVENPASS“ usw. ein. Neue Techniken sind in der Aufzeichnung hinten angehängt.

## Bestwerte / Challenges
In den Challenges bleibt der flache Pass (Bandenpass, Doppelpass sind dafür gebaut); der Dribbel-Parcours ist unverändert
(`challenge.test` grün) → **Bestwerte bleiben gültig**. Die Schüsse in den Challenges wählen ihre Technik jetzt automatisch.

## Leistung (Handy-Profil, `tests/perf_gate.py`, A/B im Wechsel, 2 Runden)
| Szene | ms je Bild p50 0.8.0 → n11 | p95 |
|---|---|---|
| Spiel Stufe 1 hoch / quer | 4,1 → 4,0 / 4,1 → 3,9 | 5,4 → 5,3 / 5,3 → 5,2 |
| Spiel Stufe 2 hoch / quer | 5,1 → 5,2 / 5,3 → 5,2 | 6,4 → 7,2 (+12 %) / 6,9 → 6,6 |

Bildrate unverändert (60 fps, Bildzeit weit unter 16,7 ms); eine p95-Spitze +12 % in Stufe 2 hoch. Daten: `tests/perf/2026-11-05_n11_ab.json`.
Die Simulation rechnet für die Pass-Sicherheit mehr (Bot-Spiel im Zeitraffer ~30 % langsamer), am Handy fällt das nicht ins Gewicht.

## Tests
- Neu: `tests/node/n11.test.mjs` (Regler, Abprall, Effet, Sprung-Fenster, Pass-Sicherheit, Spektakel-Regel, Ein-Knopf, Bots und
  Mensch-Pässe im Kleinen), `tests/node/gelenke.test.mjs`, Messwerkzeuge `n11_probe.mjs`, `einknopf_probe.mjs`.
- Ältere Tests, die bewusst das Verhalten bis 0.8.0 prüfen (FIFA-Abprall, flache Pässe, Doppeltipp …), laufen mit der Grundeinstellung
  `akro=0` (`BK_BASIS` in `makeParams`).
- Node-Suite: alle 44 Testdateien grün. Browser: `smoke.py` grün (Standard und `&akro=0`, hoch/quer/Desktop).

## Handy-Test für Peter
1. Ein paar Tipps auf Schuss und Pass: Passt, was über dem Knopf steht, zu dem, was passiert? Wirkt die Wahl „klug + spektakulär“?
2. Werden deine Pässe noch abgefangen? (Vergleich `?akro=0`)
3. Gefällt dir der höhere Ball und das viele Effet? (`?abprall=0.621`, `?effet=10` zum Vergleich)
4. Ein-Kick-Knopf im Pause-Menü ausprobieren – bleibt es bei zwei Knöpfen?
