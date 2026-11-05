# Bandenkick n10 – mehr Ballmagnet, schärfere Pässe, Kuscheltiere im Kindchenschema (05.11.2026, Version 0.8.0)

Peters Wunsch (02.11.): „Bandenkick mehr ballmagnet, schärfere Pässe, tiere haben größere köpfe und kürzere ärmchen und
Beinchen“. Alles ist drin und gilt für dich und die Bots gleich. **Handy-Hinweis:** einmal neu laden (bzw. die App einmal schließen
und öffnen), dann holt der Service-Worker die neue Version.

**Kurz:** Der Ball bleibt enger am Fuß, und Gegner kommen schwerer an ihn heran (−11 % Ballverluste beim Führen; das Ziel −25 %
habe ich **nicht** erreicht, siehe unten). Pässe sind ~15–30 % schneller und kommen etwas öfter an. Die Tiere haben einen
deutlich größeren Kopf und kürzere Ärmchen und Beinchen; Physik, Trefferzonen und Kamera sind unverändert.

## Regler (alles einzeln zurückdrehbar)
| Regler | Standard n10 | wie 0.7.0 |
|---|---|---|
| `?magnet=` | 2,4 (Ball enger vor dem Fuß, Abschirmen 0,6 m) | `?magnet=1.8` (setzt auch das Abschirmen zurück) |
| `?magnetEng=` | 1,15 (wie eng die Feder den Ball vor den Fuß zieht) | `0` = nur stärkere Feder |
| `?pass=` | 13,5 m/s | `?pass=10.5` |
| `?tierform=` | Kindchenschema | `?tierform=0` |
| `?figuren=menschen` | – | Rocketbox-Menschen wie bis 0.6.x (geht weiter) |

Alles zusammen wie 0.7.0: `?magnet=1.8&pass=10.5&tierform=0`.

## 1. Ballmagnet
Gemessen mit `tests/node/n10_probe.mjs` (160 Bot-Spiele Stufe 2 gegen 2, gleiche Seeds vorher/nachher; Daten
`tests/perf/n10_vorher.txt`, `tests/perf/n10_nachher.txt`).

| Größe | 0.7.0 | n10 | Ziel |
|---|---|---|---|
| Ballverluste beim Führen je Minute | 1,69 | **1,50 (−11 %)** | −25 % ❌ |
| … davon im Zweikampf | 1,47 | **1,29 (−12 %)** | – |
| Grätschen mit Ballgewinn je Spiel | 7,7 | 7,2 (94 %) | ≥ 70 % ✅ |
| Tore je Spiel | 16,4 | 15,8 | – |
| Dribbel-Parcours Skript / Kinderhand | 8,36 s / 6,22 s | 8,45 s / 6,17 s | – |
| Kinder-Stick gegen einen Bot: Ball springt weg je Minute | 6,3 | 6,2 | nicht schlechter ✅ |

Was ich probiert habe (je 80–160 Spiele):
- **Nur mehr Feder** (`magnet` 2,4 / 3,0): Ballverluste unverändert (1,66 / 1,67). Wie schon in n7: Fast alle Verluste passieren im
  Zweikampf, wo der Fuß des Gegners den vorgelegten Ball früher erreicht. Mit 3,0 verpasste der Skript-Parcours zudem ein Slalom-Tor.
- **Neu: Feder zieht den Ball enger vor den Fuß** (Vorlage der Feder ab Stärke 1,8 kürzer, bei 2,4 × 0,31) und **schärferes
  Abschirmen** (der Gegner-Fuß muss 0,6 statt 0,3 m näher am Ball sein, um ihn per Kontakt zu holen). Das ist die Auslieferung.
- Noch enger (auch die Führ-Kontakte selbst kürzer): bis −17 % Ballverluste, aber im echten Spiel kamen dann **gezielte Pässe des
  Spielers deutlich seltener an (38 → 29 %)**, und beim zappeligen Kinder-Stick sprang der Ball öfter weg (6,3 → 7,9 je Minute).
  Deshalb nicht genommen.
- Größerer Abschirm-Radius, längere Abschirm-Zeit, Magnet bei Gegnernähe nicht abschwächen, Bots grätschen seltener: kein
  zusätzlicher Gewinn (alle 1,42–1,59).
- Was übrig bleibt: rund ein Fünftel der „Verluste“ sind Bälle, die der gegnerische Tormann beim Dribbeln in den Strafraum fängt,
  ein weiteres Fünftel sind echte Grätschen – beides soll bleiben. Mehr ginge nur über die Bots selbst (weniger Pressing) oder
  über einen „Klebeball“; beides habe ich nicht ohne dich geändert. **Frage an Peter:** Fühlt es sich am Handy griffig genug an?
  Sonst probier `?magnet=3` (noch mehr Feder) bzw. sag Bescheid, dann gehe ich an das Pressing der Bots.

## 2. Schärfere Pässe (schlank, wegen n11)
`?pass=` ist jetzt das typische Abspieltempo (0.7.0: 10,5 m/s). Alle flachen Pässe – Tipp, Direktpass, Doppelpass, Bandenpass,
Bot-Pässe – werden im selben Verhältnis schärfer (Ankunftstempo × 13,5/10,5); Pässe unter 2 m bleiben wie bisher, ab 8 m voll
schärfer (sonst versprangen kurze Bot-Pässe). Ist ein Bandenpass dafür zu hart, geht er mit dem alten Tempo.

| Pass-Probe (echte Gesten, 200 je Variante, 1 600 Pässe) | 0.7.0 | n10 |
|---|---|---|
| kommt beim Gemeinten an (alle / Weg frei) | 75,6 / 87,7 % | **77,9 / 89,8 %** ✅ |
| abgefangen | 19,5 % | **17,4 %** |
| Abspieltempo (Median) | 10,5 m/s | **12,1 m/s** (+15 %; Pässe ab 8 m +29 %) |
| geplante Flugzeit bis zum Mitspieler | – | −23 % (bei voller Schärfe) |
| gemessene Zeit bis zur ersten Berührung (Median) | 0,52 s | 0,50 s (−4 %) |
| Annahme gelingt (0,8 s später kein Gegner dran, Ball beim Empfänger) | 46,5 % | 49,5 % ✅ verspringt nicht öfter |
| Bot-Selbstspiel: Bot-Pässe kommen an / abgefangen | 64 / 31 % | 64 / 32 % |
| ganze Spiele mit Skript-Mensch, 8 je Format (hoch / quer): gezielte Pässe kommen an | 39,4 / 36,0 % | 45,5 / 38,0 % |

Ziel „Ballzeit −20 %“: die **geplante** Flugzeit sinkt um 23 %, die gemessene Zeit bis zur ersten Berührung nur um 4 %, weil der
Empfänger dem Pass entgegenläuft (der langsamere Ball hatte ihm dafür mehr Zeit gelassen). Nach dem Nachtrag habe ich hier keine
weitere Feinarbeit gemacht.

**Für n11 (alle Pässe hoch):** `passScharf(P)` in `src/sim/kickplan.js` ist der Schärfe-Faktor (`?pass=` ÷ 10,5); er wirkt heute auf
`leadFlat` (Ankunftstempo und erlaubtes Relativtempo beim Empfänger, `passRelMax` 12), `leadBank` und die Bot-Bandenpässe – **nicht**
auf Chips/Flanken (`leadChip`, `chipElev`, `flanke*`). Wer alle Pässe hoch macht, sollte den Faktor dort einbauen oder bewusst
weglassen. Die Annahme scharfer Bälle hängt an `ctrlRel` (8 m/s) und `ctrlRelMax` (15 m/s, darüber prallt der Ball ab); mit dem
stärkeren Magnet verspringt der flache Ball nicht öfter, bei hohen Bällen greift dagegen die Brust-/Oberschenkel-Annahme
(player.js, `rel < 11`). Die Messung „Annahme gelingt“ steht jetzt in `tests/node/pass_probe.mjs`.

## 3. Kuscheltiere: größere Köpfe, kürzere Ärmchen und Beinchen
- **Kopf** samt Ohren, Augen, Nase und Mund × 1,11 um das Kopfgelenk → **Volumen +37 %** (gemessen an allen 6 Tieren). Der Auftrag
  nannte +25–35 %; mit 1,10 war der Unterschied auf den Fotos zu zart, deshalb ein Stück darüber.
- **Arme und Beine −25 %**: Ober-/Unterarm und Ober-/Unterschenkel der Skelette gekürzt, das ganze Skelett um ~20 cm abgesenkt,
  damit die Tatzen am Boden bleiben. Pfoten und Tatzen behalten ihre Größe (wirkt niedlicher). Die Tiere sind dadurch ~16 cm kleiner.
- Damit die Bewegungen sauber bleiben: Schrittfrequenz und Gangart passen sich den kürzeren Beinen an (sonst wären die Tatzen bis
  1,7 m/s über den Rasen gerutscht; jetzt so wenig wie in 0.7.0); liegend (Hechtsprung, Grätsche, Fallrückzieher, Flugkopfball)
  liegt der Körper so hoch wie vorher; beim Fallrückzieher geht die Hüfte näher an den Ball; beim Kopfball im Stand macht das Tier
  einen kleinen Hüpfer, sodass der Kopf den Ball in derselben Höhe wie früher trifft; den gehaltenen Ball zeichnet das Spiel tiefer
  und näher am Körper, zwischen den Fäustlingen. **Die Spielwelt (Ballhöhen, Fanghöhe, Kollision) ist unverändert.**
- Auch die Zuschauer (aus denselben Figuren gerendert) und die Trainingspuppe (Kopf × 1,11) haben die neue Form.
- Gebaut wie in n9 (`node tools/build_kuscheltiere.mjs`, Werte `TIERFORM` in `tools/kuscheltiere_formen.mjs`); die n9-Figuren liegen
  unverändert in `assets/kuscheltiere_n9` (`node tools/build_kuscheltiere.mjs --n9` baut sie nach). Ladegröße je Tier gleich (~97 KB).

### Fotos (alt/neu)
- Bewegungen, je Pose links 0.7.0, rechts neu: [bewegungen.jpg](tests/shots/n10/bewegungen.jpg) – Laufen, Sprint, Wende, Schuss,
  Pass, Grätsche, Hechtsprung, Ball halten, Jubel, Fallrückzieher, Kopfball (Luft und Stand), Gesichter nah
  ([nah](tests/shots/n10/pose_stehen.jpg)).
- Spiel am Handy: [quer](tests/shots/n10/vergleich_quer.jpg), [hoch](tests/shots/n10/vergleich_hoch.jpg) – Menü, Spiel, Torjubel
  (+ nah), Tormann-Parade, Zuschauer, Wiederholung, Training mit Puppe.

Sichtprüfung je Bewegung (selbst angesehen): Kopf deutlich größer und Arme/Beine sichtbar kürzer in allen Posen; keine Tatze im
Boden, kein durchstoßendes Teil; Schuss und Pass: die Tatze ist am Ball; Ball halten: Ball zwischen den Fäustlingen vor der Brust,
Fäustlinge sitzen auf den Pfoten; Kopfball: Ball am Kopf. Aus der Spielkamera fällt vor allem der größere Kopf auf.

## Leistung (Handy-Profil)
`tests/perf_gate.py`, Mittelklasse-Android-Profil (CPU × 4 gedrosselt, DPR 2,6, Pixel 7 hoch/quer), A/B im Wechsel, 3 Runden,
Median; vorher = `?tierform=0`. Ein iPhone-Profil hat das Mess-Gate nicht – dieses ist das strengere.

| Szene | ms je Bild p50 vorher → nachher (hoch / quer) | Draw-Calls |
|---|---|---|
| Menü | 16,6 → 16,6 / 16,6 → 16,6 | 45 = 45 |
| Spiel Stufe 1 | 4,3 → 4,2 / 4,8 → 4,6 (2. Lauf 4,4 → 4,3 / 4,3 → 4,3) | 41–42 |
| Spiel Stufe 2 | 5,8 → 5,8 / 5,7 → 5,2 | 53 = 53 |
| Training | 3,5 → 3,4 / 3,4 → 3,6 (2. Lauf 3,1 → 3,1 / 3,1 → 3,1) | 66–67 |

Bildrate unverändert (gleiche Dreiecke und Draw-Calls, nur die Form ist anders); die p95-Spitzen schwankten zwischen zwei Läufen
in beide Richtungen (−28 … +9 %). Daten: `tests/perf/2026-11-04_n10_ab.json`, `…_n10_ab_training.json`.

## Bestwerte
Nur der Dribbel-Parcours wird in Sekunden gewertet: Kinderhand-Skript 6,13 → 6,13 s (±0 %), vorsichtiges Skript 8,36 → 8,45 s
(+1,1 %) – innerhalb ±2 %, **Bestwerte bleiben gültig**. Bandenpass-Treffer gleich (6/6), Doppelpass-Tore 4,58 → 4,42 im Mittel
(12 Seeds, Zählwerte).

## Tests
- Neu `tests/node/n10.test.mjs` (Magnet und Pässe gegen 0.7.0, 11 Prüfungen) und `tests/node/tierform.test.mjs` (Kopf-Volumen,
  Arm-/Beinlänge, Sohle, liegend nicht tiefer im Rasen, Kopfball, Ball halten, Tatzen gleiten nicht, 11 Prüfungen).
- Angepasst: `eckschraege.test` misst 40 statt 20 Spiele, Grenze 0,73 statt 0,70 (das Verhältnis streut um ±0,02, auch 0.7.0 lag
  bei 40 Spielen bei 0,72). `magnet.test`, `n8_paesse.test`, `pass.test` u. a. unverändert grün.
- Node-Suite: alle 42 Testdateien grün (`node tests/node/run_par.mjs 6`). Browser: `smoke.py` grün (Standard, `&tierform=0`, `&figuren=menschen`), `pass_touch.py` grün.
- Prüfstand: `tools/kuscheltier_view.html?pose=…&tierform=0` (neu: Pose `kopfball`, Ball sichtbar), Fotos
  `python3 tests/kuscheltiere_bilder.py --n10 [hoch quer] [--bewegung]`.

## Handy-Test für Peter
1. Dribbeln gegen einen Gegner: bleibt der Ball spürbar besser am Fuß? Vergleich `?magnet=1.8`.
2. Pässe: kommen sie zackiger? Vergleich `?pass=10.5`; noch schärfer: `?pass=15`.
3. Die Tiere: gefallen dir Kopf und Beinchen so? Vergleich `?tierform=0`.
