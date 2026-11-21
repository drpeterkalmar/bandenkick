# N16 – Marker aus · Flanke aus der Ecke · sicherer Abstoß · Dribbeltricks beim freien Dribbeln · Version 0.11.2 / 0.12.0

Auftrag: Peter 18.11.2026 (Brief n16 „Dribbeltricks sichtbar und häufiger“) mit Nachtrag 1 vom 21.11. (Marker, Ecke, Torabstoß – zuerst).
Ausgangsstand 534e86f / 0.11.1 (mit Chaos-Modus vom 20.11.). Gelaufen auf rog17 (Windows, RTX 3070 Ti), Bot-Selbstspiel ohne Grafik,
Bilder mit Playwright/Chromium über Direct3D 11.

## Kurzfassung für Peter

Auf dem Feld gibt es keine Ringe, Pfeile und Ziel-Markierungen mehr. Aus der Ecke wird jetzt geflankt statt aus spitzem Winkel geschossen,
und Abwurf/Abschlag des Tormanns kann nicht mehr abgefangen werden. Dazu machen deine Spieler jetzt auch beim normalen Dribbeln Tricks
(Übersteiger, La Croqueta, Elastico, Ball Roll, Heel-to-Heel, Marseille-Roulette, McGeady) – bei etwa jedem dritten Ballbesitz, gleich bei
der Ballannahme, mit großem Tricknamen im Bild; der Kick-Knopf bricht den Trick sofort ab. Der Chaos-Modus vom 20.11. ist dadurch ersetzt
(er hat Pässe kaputt gemacht, siehe unten). **Einmal neu laden** (oder die App schließen und neu öffnen).

👉 Peter: Bandenkick 0.12.0 neu laden und testen: Dribbeltricks beim Laufen mit Ball sichtbar? Zu oft/zu selten? (`?dribbel=0` zum
Vergleich, `?dribbel=1.5` öfter). Kanban #363 bitte nachziehen (am rog gibt es kein kanban.py).

## Etappen, Regler, Commits (jede einzeln live)

| Etappe | Inhalt | Regler (alter Stand) | Version | Live |
|---|---|---|---|---|
| A | alle Boden-Markierungen aus: Ring + Pfeil unter dem gesteuerten Spieler, goldener Traumpass-Ring, Tormann-Bodenring (Zielmarker waren schon aus) | `?marker=1` | 0.11.2 | 424769b |
| B | aus der Ecke Flanke statt Schuss (Ein-Knopf des Menschen und Bots, auch Luftbälle der Bots) | `?eckflanke=0` | 0.11.2 | 975b420 |
| C | Abwurf/Abschlag nicht abfangbar (Mensch-Tormann, Auto-Torwart, Bots) | `?abstoss=0` | 0.11.2 | 4f6bd72 |
| D | Dribbeltricks beim freien Dribbeln, größer sichtbar, Kick bricht ab; Chaos-Modus aus | `?dribbel=0`, `?chaos=3` | 0.12.0 | Release-Commit 0.12.0 |

Wiederholungs-Effekte (Kometenschweif, Kontakt-Ring in der Wiederholung) sind von A nicht betroffen.

## A Marker aus

`marker: 0` in `src/sim/params.js`; `src/main.js` (Spieler-Ring/Pfeil `marker`, Traumpass-Ring `goldRing`), `src/render/avatars.js`
(Tormann-Ring nur mit `st.ring`). Weitere Boden-/Ziel-Anzeigen im Spiel gibt es nicht mehr (Zielmarker `AimMarkers` seit `zielhilfe: 0`
aus; Trainings-Ziele der Challenges bleiben, sie sind die Aufgabe selbst).

Beleg `tests/n16_marker_bilder.py` (Handy quer, Bots spielen, 12 Proben je Stand): `?marker=0` → Spieler-Ring 0/12, Traumpass 0/12,
Tormann-Ring 0/12; `?marker=1` → Spieler-Ring 12/12, Tormann-Ringe 12/12. Screenshot-Vergleich (Vision): mit 0 kein Ring/Pfeil am Boden,
mit 1 die gelbgrünen Tormann-Ringe und der Ring unter dem gesteuerten Spieler (tests/shots/n16/marker0_3.jpg, marker1_3.jpg).

## B Flanke aus der Ecke

Eckzone (`src/sim/akro.js` `eckZone`): Ball ≤ 5 m vor der Grundlinie, seitlich neben dem Tor (|z| ≥ halbe Torbreite + 0,8 m) und sichtbare
Toröffnung < 20°. Die Schwelle ist gemessen (8 Bot-Spiele, Stand ohne Änderung, Schüsse nach Toröffnung, Tor binnen 3,5 s):

| Toröffnung | 0–8° | 8–12° | 12–16° | 16–20° | 20–25° | ≥ 25° |
|---|---|---|---|---|---|---|
| Tore/Schüsse | 1/49 | 4/52 | 6/56 | 8/53 | 8/57 | 91/218 |
| Quote | 2 % | 8 % | 11 % | 15 % | 14 % | 42 % |

- Mensch (Ein-Knopf): in der Eckzone Pass (der Pass-Planer spielt die hohe Flanke in den Raum vor dem Tor bzw. zum Mitspieler), wenn ein
  Mitspieler anspielbar ist; Schuss nur bei Torchance ≥ 0,45 oder leerem Tor. Probe (Mitspieler 6 m vor dem Tor): neu Flanke (Außenrist,
  Scheitel 3,65 m, beim Mitspieler angekommen), `?eckflanke=0` flacher Innenrist-Schuss.
- Bots: Schuss-Nutzen in der Eckzone × 0,2, Pässe mit Treffpunkt ≤ 9 m vor dem Tor × 1,3, Luftball in der Eckzone wird direkt quer
  weitergeleitet statt draufgehalten.

`tests/node/n16_ecke_probe.mjs` (8 Bot-Spiele, gleiche Seeds):

| | `?eckflanke=0` | neu |
|---|---|---|
| Schüsse aus der Eckzone (Tore) | 176 (17) | **85 (11)** |
| Pässe/Flanken aus der Eckzone | 613 | **762** |
| Tore ≤ 3,5 s nach Pass aus der Eckzone | 37 | **47** |
| Tore gesamt | 126 | 151 |

## C Abstoß nicht abfangbar

`src/sim/rules.js`: Abwurf, den ein Gegner erreichen könnte (bestehende Prüfung `interceptable`), wird zum hohen Abschlag zum selben Ziel
(über den Gegner hinweg). Danach ist der Ball geschützt (`g.abstoss`), bis ein Mitspieler ihn berührt, er tot/in der Hand ist oder nach
5 s: Gegner können ihn nicht spielen – kein Fuß, keine Annahme, kein Körperkontakt, kein Luftball, keine Grätsche, kein Fangen
(`abstossSperre` in Player.step/tryAir/tackleContact, air.js stepAir, rules.js Fangen). Gilt für jeden Abwurf (Mensch-Tormann per
Kick-Knopf, Auto-Torwart, Bots, Zwangsabwurf nach 6 s).

Gate `tests/node/n16_abstoss_probe.mjs` (4 Bot-Spiele): `?abstoss=0` 129 Abstöße, **7 abgefangen**; neu 135 Abstöße (102 Abwurf,
33 Abschlag), **0 abgefangen**, alle beim Mitspieler. Test in `n16.test.mjs`: Gegner steht im Wurfweg – neu Abschlag, erste Berührung
beim Mitspieler (Mensch- und Bot-Tormann), `?abstoss=0` fängt der Gegner ab.

## D Dribbeltricks

### 1. Messung vorher

`tests/node/n16_dribbel_probe.mjs`: Bot-Selbstspiel, Team 0 spielt „als Mensch“ (der Ballführende von Team 0 ist `game.human`, Chancen,
Kick-Vorrang und HUD wie beim Menschen, gesteuert von der Bot-KI).

| Stand | Ballbesitz Median | Ballbesitze mit sichtbarem Trick (Mensch / Bots) | Tore/Spiel |
|---|---|---|---|
| 0.11.0 (nur Ausweich-Tricks, 6 Spiele) | 0,67 s | 10 % / 4 % (Trick nur beim Angriff, beim freien Dribbeln nie) | 22,2 |
| 0.11.1 live (Chaos-Modus, 3 Spiele) | 0,73 s | Trick-Start bei 72 % / 74 % aller Ballbesitze | **13,3** (ohne Chaos 26,3) |

Ballbesitz dauert wirklich kurz (Median 0,7 s, Peter: 1–2 s). Trickdauer bisher 0,3–0,55 s (Median 0,40 s), die Pose lief immer 0,55 s.
Der Chaos-Modus startete den Trick auch direkt nach dem eigenen Pass/Schuss und zog den Ball zum Fuß zurück – daher u. a. „Passgeber spielt
seinen eigenen Pass wieder selbst 29 %“, Schuss-Trefferquote im Test 0/150 und halb so viele Tore. Er ist jetzt aus (`chaos: 0`,
`?chaos=3` = alter Stand).

### 2. Freie Dribbeltricks (`src/sim/skills.js` FREI, `dribbelFrei`, `freiStep`)

- Einmal je Ballbesitz gewürfelt, ausgelöst früh: bei der Ballannahme (≤ 0,5 s) oder sobald ein Gegner ≤ 4 m ist; nur mit dem Ball unter
  Kontrolle (nicht ≤ 0,4 s nach dem eigenen Kick, Ball relativ ≤ 3 m/s), nicht in Schussnähe (≤ 11 m vor dem Tor), nicht wenn ein Gegner
  näher als 2,5 m ist (dort gelten die Ausweich-Tricks wie bisher). Kommt ein Gegner während des Tricks auf ≤ 1,6 m heran, bricht der
  Trick ab (normal abschirmen bzw. Ausweich-Trick).
- Sieben Tricks: Übersteiger, La Croqueta, Elastico, Ball Roll, Heel-to-Heel, Marseille-Roulette, McGeady-Drehung, je 0,45–0,75 s.
- Der Spieler läuft normal weiter (Stick, Tempo), nur der Ball folgt dem Fuß nach einer Choreografie (seitlich bis 0,55 m, hinter den
  Körper bis 0,75 m); Roulette/McGeady drehen den Körper im Bild. Gelingt immer, kein Ballverlust, kein Tempo-Verlust.
- Kick-Knopf bricht sofort ab (gemessen 0,013 s vom Druck bis zum Kick); auch Bots brechen für ihren Kick ab.
- Chancen: Mensch `dribbelMensch` 0,9, Bots `dribbelBot` 0,03, beide × `dribbel` (Regler, 0 = aus). (Bots mit 0,06–0,1 verloren den Ball
  nach der Annahme messbar öfter – n12-Gate +5,9 Punkte –, mit 0,03 grün.)
- Gefundener Fehler unterwegs: ohne die Kontroll-Bedingung startete der Trick auch direkt nach dem eigenen Pass/Schuss und holte den Ball
  zurück (wie der Chaos-Modus) – `pass.test` 89,6 %, Tore im Selbstspiel −15 %. Behoben, Test grün.

### 3. Sichtbarkeit

Pose über die ganze Trickdauer statt fest 0,55 s und 1,4 × so ausladend; Trickname groß in der oberen Bildhälfte (0,9 s, `.trickname`),
klein im HUD wie bisher. Keine Zeitlupe. Bildfolge aus der Standard-Spielkamera, Handy quer (`tests/n16_dribbel_bilder.py`,
tests/shots/n16/trick_alle.jpg, je Trick 4 Bilder über die Dauer, Ausschnitt um den Spieler). Vision-Prüfung „Ball und Fuß im Trick
sichtbar?“: bei allen sieben ja – der Ball wandert sichtbar seitlich (Croqueta, Elastico, Ball Roll) bzw. hinter den Körper (Heel-to-Heel),
das Bein hebt/kreist, bei Roulette und McGeady ist der Rücken bzw. die Drehung zu sehen. Einschränkung: auf dem ganzen Handybild ist die
Figur klein (die Bilder sind Ausschnitte); der große Trickname hilft beim Erkennen.

### 4./5. Wirkung (Probe, Team 0 „als Mensch“)

| | `?dribbel=0` | neu |
|---|---|---|
| Mensch: Ballbesitze mit sichtbarem Trick (6 Spiele) | 10 % (Ballbesitze ≥ 0,6 s: 16 %) | **22 %** (Ballbesitze ≥ 0,6 s: **32 %** ≈ jeder 3.) |
| Bots: Ballbesitze mit sichtbarem Trick | 4 % | 4–7 % |
| Trickdauer (Median) | 0,40 s | 0,45 s (freie Tricks 0,45–0,75 s) |
| Tempo während des freien Tricks (Anfang → Ende) | – | steigt (0,9 → 1,8 m/s, Annahme → Antritt), nie Abbremsen; Test: 4,0 → min. 4,0 m/s |
| Ballverlust ≤ 1 s nach gelungenem Trick | 28 % | 19–24 % |
| Tore/Spiel | 22,2 (6 Spiele) · 20,0 (12 Spiele, andere Seeds) | 21,2 · 21,1 |

Der „Mensch“ in der Probe ist die Bot-KI, die oft schon nach 0,2 s abspielt – deshalb die Zahl für Ballbesitze ≥ 0,6 s (Peter: 1–2 s).

Ausweich-Tricks unter Druck unverändert (gleiche Auslösung, Erfolgsquote `skillQuote` 0,5 bzw. Bot-Stufen 40/50/60 %); ein freier Trick
schützt nicht vor Grätschen (`tackleContact`).

## Tests

Alle 50 Node-Testdateien auf dem Endstand (parallel, `run_par.mjs`), danach geänderte einzeln nachgeprüft: **47 grün**, 3 rot und alle
schon vor n16 rot bzw. Last-bedingt:
- `traumpass.test.mjs` – Bot-Statistik-Fenster (Traumpässe 5,7–6,3/Spiel, Pässe kommen an 53–55 %, Tore je Schuss 37–42 %), genauso rot
  im Ausgangsstand 424769b mit Chaos aus (Gegenprobe), nicht von n16.
- `magnet.test.mjs` – „Gegner 0,3 m am Ball: schwächer“ 0,808 (≤ 0,6), gleicher Wert im Ausgangsstand (reine Rechenfunktion, unverändert).
- `avatar.test.mjs` – CPU-Zeit je Bild unter Volllast (12 Tests parallel); einzeln 16/16 grün.

Vorher (live 0.11.1) waren durch den Chaos-Modus zusätzlich `shot`, `pass`, `tap`, `n15`, `tormann_e1`, `passsystem`, `rueckpass`, `halten`,
`n8_paesse` rot – jetzt grün. Angepasste Fenster (begründet im Test): Tore je Schuss in `nachdrall`/`eckschraege` 35 → 42 %, Stufe 3 in
`keeper` 29 → 33 % (B: weniger Schüsse aus spitzem Winkel, Quote je Schuss steigt; Ausgangsstand ohne B grün), `n14` Abschirmen 0,70 → 0,75
(ein Ballverlust mehr in 12 Läufen, Streuung; mit dem Endstand wieder 27/27 grün), `n15_kick_probe` zählt Drücke auf einen geschützten
gegnerischen Abstoß als begründete Ausnahme. Browser: Spiel 20 s ohne JS-Fehler, ohne Audio.

Neu: `tests/node/n16.test.mjs` (Regler, Eckzone, Ein-Knopf aus der Ecke, Abstoß mit Gegner im Weg, freier Trick ohne Tempoverlust, Kick
bricht ab), Proben `n16_ecke_probe.mjs`, `n16_abstoss_probe.mjs`, `n16_dribbel_probe.mjs`, Bilder `tests/n16_marker_bilder.py`,
`tests/n16_dribbel_bilder.py`. Hinweis: `pass.test.mjs` setzt `BK_BASIS` selbst – Gegenproben über die Umgebungsvariable wirken dort nicht.

Abschluss: Bandenkick 0.12.0: Dribbeltricks jetzt auch beim freien Dribbeln, einmal neu laden. Dazu 0.11.2: Marker aus (`?marker=1`),
Flanke aus der Ecke (`?eckflanke=0`), Abstoß nicht abfangbar (`?abstoss=0`).
