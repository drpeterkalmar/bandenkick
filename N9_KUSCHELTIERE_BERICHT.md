# Bandenkick n9 – Kuscheltiere statt Menschen (01.11.2026, Version 0.7.0)

Peters Wunsch: „bandenkick: ersetze alle menschen (auch spieler) durch kuscheltiere“. Erledigt: Spieler, Tormänner (auch
deine Figur), Zuschauer und die Trainingspuppe sind jetzt Kuscheltiere. Spiel, Physik, Bots, Bewegungen und Bestwerte sind
unverändert. **Handy-Hinweis:** einmal neu laden (bzw. die App einmal schließen und öffnen), dann holt der Service-Worker die
neue Version.

## Die Tiere
| Mannschaft | Tiere | Erkennungszeichen |
|---|---|---|
| **Orange** (warme Felle) | **Teddy** (du, Nr. 7), **Fuchs**, **Katze** (rot getigert) | runde Bärenohren, Spitzohren, buschiger Schwanz |
| **Blau** (kühle Felle) | **Hase** (Langohren), **Panda**, **Elefant** (Rüssel, Schlappohren) | grau-weiß-schwarz, blaue Leibchen |

- Plüsch: weicher, samtiger Randschimmer (Sheen-Näherung im Shader), feine Fell-Struktur (eigene Faser-Normalen), Knopfaugen
  mit Glanz, gestickter Mund und gestickte Nase, aufgenähte Flecken (Schnauze, Bauch, Innenohren, Sohlen, Panda-Augen, Socken)
  mit scharfer Kante und dunkler Naht, Kopfnaht beim Teddy. Etwas pummelig: großer Kopf, runder Bauch, dicke Arme und Beine,
  große Tatzen.
- Leibchen in Teamfarbe mit Rückennummer (jetzt als eigenes Teil mit glattem Saum, Hals- und Armlöchern), Tormann mit dicken
  leuchtenden Fäustlingen über den Pfoten.
- Ohren wippen beim Laufen und wehen nach hinten, der Schwanz wedelt; im Stand schaukeln sie leise. Jubel = der bisherige Jubel.
- Zuschauer: aus den sechs Tieren gerendert (reihum, jede Gruppe gemischt), die Trainingspuppe ist eine Stoffpuppe mit Bärenohren
  und Knopfaugen. Die Wiederholung, der Fan-Edit und das Menü zeigen dieselben Figuren.
- `?figuren=menschen` = die Rocketbox-Menschen wie bis 0.6.2 (geprüft: Smoke-Test grün, Fotos unten).

## Woher (Lizenz)
Recherche zuerst (Sketchfab-API nur „downloadbar“, Quaternius, Kenney, Poly Pizza, OpenGameArt): kein frei nutzbares
Plüschtier mit menschlichem Skelett. Die CC-BY-Teddys auf Sketchfab sind Chibi-Figuren mit eigenem Skelett (oft Fan-Art
fremder Marken), die CC0-Funde (Quaternius-Hasen, „Bunny Plush“, „Detective Bunny“) haben eigene Rigs ohne
Fußball-Bewegungen. Deshalb **selbst gebaut, eigene Arbeit (MIT)**; Liste der geprüften Quellen in `LICENSES.md`.

So gebaut (`tools/build_kuscheltiere.mjs`, Formen und Farben in `tools/kuscheltiere_formen.mjs`, 6 Tiere in ~5 s):
weiche Grundformen (Ellipsoide, runde Kegel) je Körperteil → Gitter („Surface Nets“) → mit meshoptimizer auf ~7 300 Dreiecke
vereinfacht. Jedes Tier sitzt auf dem **unveränderten Skelett seiner Rocketbox-Vorlage** (Teddy ← Sports_Male_02,
Fuchs ← Sports_Female_02, Katze ← Male_Adult_10, Hase ← Sports_Male_03, Panda ← Female_Adult_12, Elefant ← Sports_Male_04);
die Hautgewichte kommen vom nächsten Punkt des Menschen derselben Körpergegend und werden geglättet. Deshalb laufen alle
16 Bewegungen, Fuß-IK, Schuss, Grätsche und Tormann-Posen ohne neue Animationen (Test: 5 088 Animationsspuren, 0 ohne Knochen).
Blender war nicht nötig – alles läuft in Node mit den Werkzeugen, die das Repo schon hat.

## Fotos
- Vergleich vorher (Menschen) / nachher (Kuscheltiere): [hoch](tests/shots/kuscheltiere/vergleich_hoch.jpg),
  [quer](tests/shots/kuscheltiere/vergleich_quer.jpg) – Menü, Spiel, Torjubel (+ nah), Tormann-Parade, Zuschauer,
  Wiederholung (Aufbau, Kontakt-Zoom, Fan-Cam), Training mit Puppe.
- Bewegungstest (alle sechs Tiere je Pose): [bewegungen.jpg](tests/shots/kuscheltiere/bewegungen.jpg) – Laufen, Sprint,
  Wende (Stemmschritt), Schuss, Pass, Grätsche, Hechtsprung, Ball halten, Jubel, Fallrückzieher, Kopfball.
- Nah: [Gesichter](tests/shots/kuscheltiere/nah.jpg), [Rücken mit Nummern](tests/shots/kuscheltiere/ruecken.jpg).

Selbst geprüft (Bilder angesehen): Auf jedem Bild sieht man auf Anhieb Kuscheltiere, kein Mensch mehr (auch nicht bei den
Zuschauern oder im Training). Orange gegen Blau ist durch Leibchen und Fellfarben klar getrennt. Pfoten gehen beim Schuss und
Pass zum Ball, keine verdrehten Glieder. Liegend (Hechtsprung, Grätsche, Fallrückzieher) stecken die Tiere höchstens 6 cm im
Rasen, die Menschen bis 13 cm. Beim Fallrückzieher zieht sich der Katzenschwanz ein, damit er nicht im Boden steckt.
**Grenze:** In der tiefen Tormann-Hocke zeichnet sich der Ansatz der Oberschenkel am Rumpf als Kante ab, wie ein angenähtes
Bein. Aus der Spielkamera fällt das kaum auf.

## Leistung (Mess-Gate wie im Technik-Bericht)
`tests/perf_gate.py`, Profil Mittelklasse-Android (CPU ×4 gedrosselt, DPR 2,6, Pixel 7 hoch/quer, ungedeckelt, je Szene 10 s),
**A/B im Wechsel, 3 Runden, Median**. Vorher = Stand 0.6.2 (Hauptordner), nachher = n9. Mac mini, ANGLE/Metal. ms je Bild:

| Szene | Gerät | p95 vorher | p95 nachher | Δ p95 | Draw-Calls |
|---|---|---|---|---|---|
| Menü (Stufe 1) | hoch / quer | 18,7 / 18,7 | 18,7 / 18,7 | ±0 / ±0 % | 55 → 45 |
| Spiel Stufe 0 | hoch / quer | 6,4 / 5,9 | 5,4 / 5,1 | −16 / −14 % | 43 → 34 / 32 |
| Spiel Stufe 1 | hoch / quer | 6,9 / 7,0 | 6,5 / 6,1 | −6 / −13 % | 51 / 50 → 41 / 39 |
| Spiel Stufe 2 | hoch / quer | 9,5 / 10,5 | 9,7 / 7,5 | +2 / −29 % | 71 / 67 → 51 / 53 |
| Spiel Abend (Stufe 1) | hoch / quer | 7,2 / 7,0 | 6,5 / 6,4 | −10 / −9 % | 56 / 55 → 46 / 44 |
| Wiederholung | hoch / quer | 5,0 / 5,4 | 4,9 / 4,9 | −2 / −9 % | 37 / 38 → 35 / 36 |
| Training (Puppen) | hoch / quer | 5,2 / 4,8 | 4,9 / 5,0 | −6 / +4 % | 67 / 68 → 66 / 67 |

Ergebnis: Bildrate nirgends mehr als 5 % schlechter (meist besser), Draw-Calls überall gleich oder weniger (je Figur 2 statt
3: ein Körper + Leibchen; Schattenpass ebenso). Gründe: ein Mesh und ein gemeinsamer Shader für alle Tiere, keine Texturen,
55 statt 80 Knochen (die Gesichtsknochen bewegt keine Animation). Daten: `tests/perf/2026-11-01_n9_ab.json`,
`tests/perf/2026-11-01_n9_ab_training.json`. Auf der niedrigen Stufe (`?q=0`) fällt die Fell-Struktur weg (billiger Rückfall),
Randschimmer und Nähte bleiben.

**Ladegröße der Figuren:** 6 Kuscheltiere 586 KB statt 1 735 KB Menschen (−66 %, Bewegungen unverändert 0,9 MB). Die
Menschen bleiben für `?figuren=menschen` im Repo und im Offline-Cache.

**Flüssigkeit (n5-Ruckmessung, `tests/ruckel.py`, quer, 20 s Spiel + 3 Tore mit Wiederholung):** Pose-Sprünge im Spiel 678 → 659,
große Pose-Sprünge 70 → 60, Gewichtssumme < 1: 0 → 0; Wiederholung 74 → 79 bzw. 11 → 12 (Streuung zwischen zwei Läufen –
die Knochen bewegen sich genau wie vorher, nur die Haut ist neu). Nicht schlechter.

## Tests
- `npm test`: alle Node-Tests grün, Selbstspiel unverändert (Simulation nicht angefasst). Neu `tests/node/kuscheltiere.test.mjs`
  (17 Prüfungen): Satz-Umschalter, 6 Tiere, Bewegungs-Satz m/f, alle Animationsspuren finden ihren Knochen, Gewichte normiert,
  Sohle −1,2 cm (Menschen −1,5), Begrenzungskugel reicht in 12 Posen, liegend nicht tief im Rasen, Ohr wackelt (0,35 rad) und
  kehrt zurück, Schwanz-Knochen, Leibchen, 2 Draw-Calls je Figur, Ladegröße ≤ 1,3 × (gemessen 0,34 ×), Menschen-Satz unverändert.
- `tests/smoke.py` (hoch, quer, Desktop) mit Kuscheltieren und mit `&figuren=menschen`: 0 Seiten-/Konsolenfehler.
- Prüfstand: `tools/kuscheltier_view.html` (`python3 tests/kuscheltier_view.py pose[:yaw[:zusatz]]`), Fotos:
  `python3 tests/kuscheltiere_bilder.py [hoch quer] [--bewegung]`.

## Regler
`?figuren=menschen` (altes Aussehen), `?figuren=kuscheltiere` (Standard), `?q=0` (billiger Plüsch ohne Fell-Struktur).
