# Bandenkick – Vorlagen (Mechaniken und Zahlen in eigenen Worten)

Spielgefühl inspiriert von Arcade-Fußball-Klassikern und offener Fußball-KI-Forschung. Dieses Blatt beschreibt nur Mechaniken
und Zahlen in eigenen Worten (Clean-Room): kein fremder Code, keine Assets, keine Namen von Spielen, Figuren oder Vereinen.
Die Vorlagen heißen hier nur A–D. Alle Werte sind auf Bandenkick umgerechnet; als „unsicher“ markierte Werte sind Startwerte,
die Messung entscheidet. Umsetzung, Messungen und Regler: [`N7_VORLAGEN_BERICHT.md`](N7_VORLAGEN_BERICHT.md).

| Vorlage | Art | genutzt für |
|---|---|---|
| A | offene Fußball-Simulation (Forschung) | Torwart-Stellung und Herauslaufen, Pass-Zielwahl, Stick-Filter, Wechsel-Glättung, Laufwege |
| B | Arcade-Fußball im umzäunten Käfig, 5 gegen 5 | Tormann-Müdigkeit, Traumpass mit Direktabnahme, Grätsch-Zeiten (nur Querprüfung) |
| C | klassischer Draufsicht-Fußball | Nachdrall nach dem Schuss mit abklingender Wirkung |
| D | Ball-Arena mit Wänden (gemessene Werte) | Abprall-Querprüfung, abgeschrägte Ecken gegen Klemm-Bälle |

## Mechaniken

**Torwart (A, B)**
- Grundstellung auf der Winkelhalbierenden zwischen den Linien Ball → linker und Ball → rechter Pfosten, knapp vor der Linie.
- Herauslaufen als Wettlauf zum Schusspunkt: kommt kein Verteidiger mindestens 1 m früher dorthin als der Angreifer, läuft der
  Torwart heraus; ein zweiter Angreifer bremst das.
- Müdigkeit: Energie 100, jede Parade kostet (Fangen wenig, Hechten und Abklatschen mehr), sie kommt pro Sekunde zurück. Unter
  einer Schwelle wird nicht mehr gefangen, nur abgewehrt → Abpraller; Aufstehen langsamer.
- Bei Hebern stolpert der Torwart manchmal.

**Nachdrall nach dem Schuss (C)**
- Kurzes Fenster nach dem Kontakt: Stick seitlich gibt Drall zur Seite, die Wirkung klingt schnell ab (Gewichte 5-4-3-2-2-2-2-1-1-1,
  gut die Hälfte in den ersten drei Schritten). Die Seite bleibt fest, nur die Stärke klingt ab. Stick nach hinten = höher.

**Pass und Laufwege (A, B)**
- Traumpass: Empfänger nah vor dem Tor, frei, Passweg frei → Belohnung für die Direktabnahme (volle Wucht).
- Geben und Gehen: nach dem Pass prüft der Passgeber regelmäßig, ob vor ihm Raum ist, und läuft dann einige Sekunden in die Tiefe.

**Steuerung (A, B)**
- Stick-Ruhe: kleine Richtungsänderungen erst nach kurzer Wartezeit, echte Kehrtwenden (> 117°) sofort.
- Wechsel-Glättung: nach dem Spielerwechsel zuerst halb alter Schwung, halb Stick, in 0,3 s ganz Stick.

**Arena (A, D)**
- Abprall von Rasen, Pfosten und Bande deckt sich mit Bandenkick (0,62 / 0,8 / 0,6–0,65).
- Abgeschrägte Ecken (45°-Eckwand) verhindern, dass der Ball in der Ecke festklemmt.

## Übertragung auf Bandenkick (Arbeitsliste)

| # | Mechanik | Entscheidung | Startwert | Regler | Wirkung |
|---|---|---|---|---|---|
| 1 | Tormann-Müdigkeit → Abpraller | übernehmen, schneller getaktet; Handschuh-Leuchten wird mit der Energie schwächer | Energie 100; Fangen −5, Hechten −10, Abklatschen −7; +4/s; unter 60 sinkt die Fanggrenze für mittlere Bälle; Aufstehen bis × 0,6 | `?muede=1`, `?muedeFang=60`, `?muedeErh=4` | 5 |
| 2 | Winkelhalbierende | übernehmen | 0,7 m vor der Linie, Vorschau 0,25 s | `?winkel=1` | 3 |
| 3 | Herauslaufen 1 gegen 1 | anpassen: nur bis Torraumkante + 1 m, draußen Blocken mit gespreizten Beinen | Schusspunkt 5 m vor dem Tor, Marge 1 m, Spreizen 1,0 m | `?raus=1`, `?rausMarge=1` | 4 |
| 4 | Heber-Stolpern | übernehmen, gedämpft | 25 % bei Chip über den Tormann | `?stolpern=0.25` | 2 |
| 5 | Nachdrall | anpassen: 0,25 s, über echten Drall (Magnus-Physik macht die Kurve) | bis +8 U/s seitlich, ±5 U/s oben/unten | `?nachdrall=1`, `?nachdrallT=0.25` | 5 |
| 6 | Traumpass → Direktabnahme | anpassen: Empfänger ≤ 8 m vor dem Tor, Pass ≥ 3 m, kein Gegner ≤ 1,5 m, Schussweg frei → Ring + Ballspur; Direktabnahme q + 0,25, Wucht × 1,1; keine eigene Zeitlupe, nur Ereignis an die Action-Momente | Schwelle 0,7 | `?perfekt=1`, `?perfektQ=0.25` | 4 |
| 7 | Geben und Gehen | anpassen: Passgeber läuft (Einheitstempo) 2 s in den freien Raum Richtung Tor, Empfänger-Bot bekommt Bonus für den Rückpass | Prüftakt 0,5 s, Wertung ≥ 0,5, Lauf 2 s, Bonus +0,3 | `?gebengehen=1`, `?laufT=2` | 4 |
| 8 | Stick-Ruhe | übernehmen für den Kinder-Stick | 1,8° / 117° / 0,1 s | `?stickruhe=0.1` | 2 |
| 9 | Wechsel-Glättung | übernehmen | 0,3 s | `?wechselGlatt=0.3` | 2 |
| 10 | Abgeschrägte Käfig-Ecken | anpassen, kleiner als im Vorbild | Schenkel 1,0 m (unsicher) | `?eckschraege=1.0` | 3 |
| 11 | Sprint mit Ball dreht schlechter | **entfällt** (seit n7 Etappe 0 gibt es keinen Sprint) | – | – | – |
| 12–13 | KI-Dribbel-Kraftfeld, „Block atmet“ | später | – | – | 1–2 |
| 14–17 | Aufladen, schwebige Schwerkraft, Bandenfuß-Rundung, kürzere Grätsche | weglassen | – | – | – |

## Messgrößen
Tore je Schuss (25–35 %), Nachschuss-Tore (≥ 10 % aller Tore), Torwart-Energie, Tore aus spitzem Winkel (−30 % mit
Winkelhalbierender), 1 gegen 1 vereitelt (35–50 %), Nachdrall-Kurve (15-m-Schuss +1,5 … 3 m), Torquote mit Nachdrall
(höchstens +10 Punkte), Traumpässe (2–5 je Spiel), Geben und Gehen (30–50 % der Pässe ≥ 4 m, Doppelpässe ≥ 3 je Spiel),
Kinder-Stick-Ballverluste, Pässe im Lauf, Ecken-Hänger (0), Spektakel (Hechter ≥ 15, Luftbälle ≥ 9 je Spiel), Regler auf 0 =
Messwerte wie vorher.
