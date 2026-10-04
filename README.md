# Bandenkick

**Kleinfeldfußball im Käfig** – 24 × 15 m Kunstrasen (Nacht 2c; das DFB-Minispielfeld 20 × 13 m mit `?feld=20x13`), 1 m Bande, darüber Netz,
oben ein Dachnetz. Der Ball bleibt immer im Spiel. Handy zuerst (hoch und quer), dazu Desktop und Gamepad.
Als App installierbar (PWA), läuft offline.

▶ **Spielen:** https://drpeterkalmar.github.io/bandenkick/

## Spielidee
- **3 gegen 3 im Käfig** mit Trainingsleibchen: du spielst **Orange** (Mitte, stößt an), zwei Mitspieler und die
  ganze Mannschaft **Blau** sind Bots. Kein Aus, keine Unterbrechung außer nach einem Tor.
- **„Letzte Hand“:** der hinterste Spieler jeder Mannschaft (kleinster Abstand zur eigenen Torlinie; Wechsel erst
  bei ≥ 0,5 m Vorsprung für ≥ 0,3 s) trägt **leuchtende Handschuhe** und einen **Ring am Boden**. Nur er darf die
  Hände nehmen, und nur im **eigenen Torraum** (Halbkreis 4 m): Fangen, Hechten, Abwurf, Abschlag. Außerhalb geht
  keine Handaktion – es gibt keine Handspiel-Pfiffe. Ball in der Hand höchstens **3 s** (Leiste im HUD; bis Nacht 2d
  6 s), solange greift niemand an.
- **Kein Rückpass (Nacht 2e, Peter 03.10.: „erlaube keinen Rückpass“):** zum eigenen Tormann (letzte Hand im Torraum)
  wird nicht gepasst – weder vom Menschen (der Stick-Kegel überspringt ihn; zeigt der Stick aufs eigene Tor, geht der Pass
  zum nächsten Mitspieler im erweiterten Kegel ±70° oder seitlich in den freien Raum, nie aufs eigene Tor zu) noch von den
  Bots. Spielt ein Mitspieler dem Tormann den Ball trotzdem absichtlich zu (Pass, Schuss, Befreiung Richtung eigenes Tor oder
  nah am Torraum; Kopfball zählt nicht), darf er ihn nicht in die Hand nehmen und spielt ihn wie ein Feldspieler – kein
  Freistoß, nur einmal je Spiel der Hinweis „Rückpass – keine Hände“. Berührt danach ein anderer Spieler den Ball (auch ein
  Abpraller am Gegner), gelten die Hände wieder. 6 Bot-Spiele: Rückpässe 141 → 0, Hand nach Rückpass 101 → 0.
  `?rueckpass=1` = alt.
- **Tormann gibt den Ball schnell weiter (Nacht 2e, Peter 03.10.: „nicht so lange in die Hand nehmen“):** der Bot-Tormann
  wirft nach 0,3–0,7 s auf einen sicher freien Mitspieler ab, ab 0,9 s auch auf einen weniger freien (nie in einen Weg, den
  ein Gegner abfangen kann), spätestens nach 2 s schlägt er weit in die freiere Hälfte ab. Gemessen in 6 Bot-Spielen:
  Haltezeit Median 3,4 → 0,9 s, längste 4,4 → 2,0 s, abgefangene Abwürfe 20 → 8 %. Der Auto-Torwart des Menschen wirft nach
  1 s ohne Eingabe ab (vorher 2 s). `?halten=0` = Nacht 2d, `?halten=1.5` = etwas länger (Sekunden bis zum Abwurf).
- **Nach einem Tor:** kurzer Jubel, alle laufen in ihre Hälfte, dann **Anstoß in der Mitte** (seit 30.09.;
  `?anstoss=0` = Schnellstart: der Tormann der Mannschaft, die das Tor bekommen hat, hat den Ball in der Hand).
- **Spielzeit** 2 × 4 min (`?dauer=`), Anzeige Spielstand und Restzeit, Pfiffe zu Halbzeit und Ende,
  **Golden Goal** bei Gleichstand mit `?golden=1`.
- **Menschen:** sechs Rocketbox-Avatare (Microsoft, MIT) mit echten Lauf-, Sprint-, Jubel- und Klatsch-Bewegungen;
  die Laufzyklen laufen phasengleich mit dem gemessenen Schrittweg (kein Fußgleiten), Stemmschritt sichtbar.
- **Bots** (Utility-KI, 3 Stärken `?bots=1…3`): Rollen Ballführer / Anspielstation / Absicherung (letzte Hand),
  beim Gegner am Ball Angreifer (stellt zu) / Decker; sie spielen Pässe, **Bandenpässe** (auch zu sich selbst),
  schießen, befreien, hechten.
- **Training** im Startmenü (oder ☰ → Training): **9 Übungen** mit 1–3 Sternen und Bestwert (bleibt gespeichert),
  Hinweiskarte vor dem Start, „Nochmal“ mit einem Tipp. **Schütze:** 🎯 Torwand (leuchtende Scheibe treffen),
  🦵 Volley-Station (Ballmaschine flankt – Volley, Dropkick, Kopfball, Seitfall-, Fallrückzieher), ↗️ Bandenpass
  (über die Bande am Dummy vorbei zum Ziel), 🔶 Dribbel-Parcours (Hütchentore auf Zeit), ⚽ Elfmeter, 🔁 Doppelpass.
  **Torwart:** 🧤 Ballmaschine (12 Schüsse: flach, hoch, Flatterball, Aufsetzer, Bande, Kurve), ⚡ Reaktion,
  🥅 1 gegen 1. „Freies Training“ = allein mit Ball wie in Nacht 1 (`?solo=1`).

## Steuerung
| | |
|---|---|
| **Handy** | **Stick links** (Finger irgendwo in der linken Hälfte): laufen, ganz nach außen = Sprint. **Pass** und **Schuss** tippen oder doppeltippen (Tabelle unten), der Ring um den Knopf zeigt den Modus. **Sprint:** Knopf halten. **⇄** Spieler wechseln (sonst automatisch zum ballnächsten, nach deinem Pass zum Empfänger). |
| **Als letzte Hand im eigenen Torraum** | **Auto-Torwart (Nacht 2c):** Fangen und Hechten macht er selbst – so sicher wie ein Bot-Tormann der alten Stufe 2. Laufen darfst du selbst (der Stick gewinnt; lässt du ihn los, stellt er sich hin). Mit Ball: Pass-Knopf = **Abwurf** (auf den Stick bzw. den freiesten Mitspieler), Schuss-Knopf = **Abschlag**; ohne Eingabe wirft er nach 1 s selbst ab (Nacht 2e; ohne freien Mitspieler nach 2 s weiter Abschlag). `?autotorwart=0` = alte grüne Knöpfe (Schuss = Fangen, Pass = Hechten). In den drei Torwart-Übungen im Training bleiben die Knöpfe, dort ist Fangen die Aufgabe. |
| **Tastatur/Maus** | WASD/Pfeile laufen, Shift Sprint, **C/Tab** Wechsel. Maus zielt. **J/Enter/Linksklick = Pass-Knopf**, **Leertaste/K/Rechtsklick = Schuss-Knopf** – gleiche Gesten wie am Handy (Tormann mit Ball: Abwurf bzw. Abschlag). Esc Pause. |
| **Gamepad** | Linker Stick laufen, A = Pass-Knopf, X oder RT = Schuss-Knopf (Gesten wie am Handy), **Y Wechsel**, LB/RB Sprint. |

### Gesten (Nacht 2c „Kinderhände“: Tipp statt Aufladen)
| Geste | Pass-Knopf | Schuss-Knopf |
|---|---|---|
| **tippen** | **flacher Pass** in den Laufweg, Stärke automatisch (Ring →) | **Vollspann** (Ring ⚡), Stärke automatisch: nah platziert, weit hart; mittig getroffen → Flatterball |
| **doppeltippen** (2. Druck höchstens 0,11 s nach dem Loslassen) | **hoch** – feste Flanke (weit flach 14–24°, kurz steiler Chip bis 45°) (Ring ⌒) | **angeschnitten** – feste Banane, fast so hart wie Vollspann (Ring ↪/↩): Innenrist oder Außenrist, je nach Lage des Balls zum Fuß |
| **Ball in der Luft** + Schuss tippen | – | automatisch **Volley, Dropkick, Kopfball (auch mit Sprung), Flugkopfball, Seitfallzieher, Fallrückzieher** – je nach Höhe, Winkel und Zeit bis zum Ball. Den besten Moment wählt die Technik-Hilfe; zu spät gedrückt kostet höchstens 15 % Timing-Wert. Nach Seitfall-/Fallrückzieher ~0,8 s am Boden |

| **Gegner hat den Ball** (du nicht am Ball, Ball ≤ 2,5 m) + tippen | **Grätsche** in Ballrichtung, erwischt → Pass zum Mitspieler im Stick-Kegel | **Grätsche**, erwischt → in Tornähe (≤ 11 m) Schuss aufs Tor, sonst weit nach vorn klären |

- **Grätsche (Nacht 2c):** 0,5 s rutschen, danach 0,6 s am Boden. Trifft sie zuerst den Gegner, gibt es kein Foul
  (Kinderspiel): der Ball springt frei, der Gegner stolpert 0,6 s. Ist der Ball frei (kein Gegner näher dran), läuft
  der Spieler wie bisher hin und spielt ihn. Bots grätschen gelegentlich (Stufe 2 etwa 6–9-mal je Spiel). `?graetsche=0` = aus.
- **Kein Aufladen, kein Timing:** Der erste Druck merkt den Kick sofort vor (der Spieler läuft schon zum Ball und legt
  einen Schritt zu); fest steht er nach dem Loslassen + 0,11 s bzw. beim zweiten Druck. Tipp → Ballkontakt im Mittel
  0,19 s (Ball am Fuß oder beim Führen). Halten wirkt wie Tippen. Man darf tippen, bevor der Ball da ist (bis 1,5 s:
  Direktpass, Volley).
- **Profi:** `?laden=1` = Gesten aus Nacht 2b (halten = Stärke per Haltedauer, tipp + sofort halten = Variante,
  Fenster 0,25 s); `?timinghilfe=0` = strenges Luftball-Timing wie Nacht 2b.

- **Passsystem repariert (Nacht 2e, Peter 03.10.: „die Pässe gehen irgendwo hin“)** – gemessen mit einer Probe (echte Gesten,
  Bots, 2000 Pässe; `tests/node/pass_probe.mjs`), Ursachen nach Größe: (1) nach dem Pass steuert der Daumen den Empfänger –
  wer den Stick weiter in Pass-Richtung hielt, schickte den Empfänger vom Ball weg (nur 14 % kamen an); jetzt zählt der Stick
  bis zur Annahme nur zum Zielen, gelaufen wird mit der Empfänger-Hilfe (loslassen oder deutlich andere Richtung = sofort
  wieder selbst). (2) Der Passgeber-Bot jagte seinem eigenen Pass nach (14 %, im Bot-Spiel 22 %); jetzt nimmt der Empfänger
  an, wer hinter ihm steht, sichert ab. (3) Beim Tipp mit Stick nach hinten lief der Spieler in Stick-Richtung los und ließ
  den Ball liegen, oder die Steuerung sprang weg – jeder 4.–8. Pass im Lauf kam nie; jetzt läuft er mit vorgemerktem Tipp
  zum Ball, dreht sich zum Ziel auf (Innenseite statt Hacke) und behält die Steuerung; als Ballführer grätscht der Tipp nie.
  (4) Bei zugestelltem Weg nahm die Wahl einen anderen Mitspieler (auch über die Bande); jetzt gewinnt, auf wen der Stick am
  genauesten zeigt, bei zugestelltem Weg geht es über die Bande zu IHM, und der beim Tipp gewählte Empfänger bleibt bis zum
  Kontakt. (5) Der Empfänger läuft flachen Pässen entgegen, Pässe kommen etwas zügiger an (8 m: 6,7 statt 5,3 m/s), Streuung
  kleiner (0,8° statt 1,1°, Sprint × 1,3 statt × 1,6). Ring am Empfänger dicker, bleibt sichtbar, bis er den Ball hat, und
  schon beim Führen zeigt ein schwacher Ring, wer den Pass bekäme. Ergebnis bei freiem Passweg: stehend 59 → 92 %, laufend
  26 → 88 %, Sprint 29 → 83 %; alle Pässe 37 → 74 %; Bot-Pässe 33 → 60 %. `?passfix=0` = Nacht 2d.
- **Pass** geht zum Mitspieler, auf den der Stick zeigt (Kegel ±35°), **in seinen Laufweg** (Vorhalt aus dem echten
  Rollmodell). Technik automatisch: Innenseite (bis 60° zur Blickrichtung), Außenrist, **Hacke** (nach hinten,
  Mitspieler nah). Zeigt der Stick auf die Bande, geht der Pass über die Bande. Ohne Stick: bester freier Mitspieler.
- **Schuss** geht immer aufs Tor: in die Ecke weg vom Tormann; Stick seitlich = flache Ecke, schräg nach vorn = hohe
  Ecke. Die **Lage** bestimmt die Qualität q (0–1): Blick aufs Tor, Entfernung, Körperstellung, Ball vor dem Fuß,
  starker/schwacher Fuß, Tempo, springender Ball, Gegner dran. Schlechte Lage = langsamer, zentraler, mehr Streuung.
  Der letzte Schuss steht im Pause-Menü (Technik, Tempo, q). Anzeige nach jedem Schuss oben links.
- **Profi-Steuerung** `?treffpunkt=1`: altes Modell aus Nacht 1/2 – Finger auf dem Schuss-Knopf verschieben =
  Treffpunkt (seitlich Effet, unten Heber, Mitte Vollspann), Tastatur Q/E/R/F.
- **Zeitlupe** bei Luftbällen (0,9 s, 40 % Tempo, Kamera zoomt leicht) – im Pause-Menü abschaltbar.
- **Tor-Wiederholung** (Nacht 2d, Peter: „Actionreplay mit extrem zoom und effekt fan cam slo mo“): nach jedem Tor im
  Spiel 1 s Live-Jubel, dann die Wiederholung (höchstens 7 s): Aufbau aus der TV-Kamera in Echtzeit → **Ballkontakt in
  Zeitlupe (0,2 ×) mit extremem Zoom** auf Fuß und Ball (quer seitlich, hoch über die Schulter des Schützen), Blitz,
  Druckwelle und Leuchtspur hinter dem Ball → **Fan-Cam** hinter dem Tor außerhalb des Käfigs auf Zuschauerhöhe,
  wackelnd, Zeitlupe (0,3 ×), wenn der Ball über die Linie ins Netz schlägt → zurück zum Jubel, dann Anstoß.
  Einblendung „WIEDERHOLUNG“ mit Schütze, Technik und km/h, Kinobalken und Vignette. **Tippen** (oder eine Taste)
  überspringt. Im Pause-Menü „Wiederholung: an/aus“, `?replay=0` = aus; im Training keine Wiederholung. Aufgezeichnet
  wird nur der Darstellungs-Zustand (Ringpuffer 8 s), die Simulation steht währenddessen still und bleibt unverändert.
- **Kein Ton (Nacht 2e, Peter 03.10.: „Lösch mal alle Sounds, es brutzelt noch immer ab Spielstart“):** das Spiel ist
  komplett stumm – kein AudioContext, keine Umgebungsschleife, keine Effekte, auch nicht in Menü, Training und
  Wiederholung. Der Ton-Knopf im Pause-Menü ist weg. Wiedereinbau nur auf Wunsch.
- Beim ersten Start erklärt eine **Hilfekarte** die Gesten; später über ☰ → Steuerung.

**Ballmagnet (Nacht 2c, Peter: „leichter ballmagnet, sonst kein dribbling“; Nacht 2d: „viel mehr Ballmagnet“ → Stärke 1,2
statt 0,5, im Sprint 70 % statt 45 %):** zwischen den echten Ballkontakten führt
eine weiche Feder den Ball, den du zuletzt berührt hast, auf die Linie deines Sticks und bremst ihn, wenn er zu weit
vorrollt – nach vorn bringt ihn weiter nur der Fuß (kein Klebeball, die Kontakte bleiben sichtbar), die Vorlagen sind
kürzer und die Kontakte genauer. Schwächer im Sprint (45 %), bei scharfen Richtungswechseln (ab 60°, bei 120° 25 %) und
wenn ein Gegner näher als 1 m ist (bis 50 %; dann legt er den Ball leicht auf den abgewandten Fuß). An der Bande zieht
er nie in die Bande. Gilt für alle Spieler (auch Bots). Grätscht ein Gegner, hält der Magnet den Ball nicht fest.
Gemessen mit zappeligem Kinder-Stick: Ball springt ohne Magnet 18,2-mal je Minute weg, Nacht 2c 8,6, jetzt 4,9 (davon die
Hälfte nach einer Kehrtwende, dort lässt er absichtlich los); Zweikämpfe und Grätschen im Selbstspiel unverändert möglich.
`?magnet=0.5&magnetSprint=0.45` = Nacht 2c, `?magnet=0` = aus.

**Wucht (Nacht 2d, Peter: „jeweils 1,5x härterer Vollspannschuss und Effetschuss“):** Vollspann, angeschnittene Schüsse
(Innen-/Außenrist) sowie Volley und Dropkick fliegen 1,5-mal so schnell (bis 45 m/s ≈ 162 km/h), für Mensch und Bots. Die
Banane bekommt entsprechend mehr Drall und biegt so weit wie vorher. Pässe, Chips, Flanken, Kopfbälle, Seit- und
Fallrückzieher bleiben. `?wucht=1` = Nacht 2c.

**Torwart hechtet (Nacht 2d, Peter: „Torwart soll viel mehr hechten“):** CPU-Tormänner und der Auto-Torwart werfen sich,
sobald der Ball mindestens 0,7 m neben ihnen aufs Tor kommt, auch wenn Laufen reichen würde, und bei Bällen knapp neben den
Pfosten. Absprung bis 0,7 s vor dem Ball, ausgestreckt im Bogen, nach 0,5 s wieder auf den Beinen. Im Selbstspiel etwa 20
Hechtsprünge je Spiel (Nacht 2c: 2). Damit die Tor-Quoten bleiben (Stufe 2 ≈ 30 % Tore je Schuss), reagieren die
Tormänner schneller, die Arme fahren im Sprung aber erst aus (zu späte Hechter kommen nicht mehr ran). `?hechten=0` = alte
Hecht-Regel.

**Bewegung „zackig“ (Nacht 2):** kleine Richtungswechsel = Kurve (13 m/s² quer, Tempo bleibt), große = **Stemmschritt**
(falsche Anteile mit 16 m/s² gebremst, Körper dreht sofort, Abstoß in die neue Richtung), spritziger Antritt
(0 → 4 m/s in 0,6 s). 90° aus dem Lauf in 0,33 s, aus dem Sprint in 0,47 s. Im Stemmschritt nimmt der Spieler den
Ball mit (Sohle/Außenseite). `?zack=0` = altes Gefühl aus Nacht 1 zum Vergleichen.

## Physik (Kern ohne DOM, fester Takt 120 Hz, deterministisch per Seed)
- **Ball** nach FIFA-Spielregel 2: r = 0,11 m, m = 0,43 kg, Hohlkugel (I = ⅔·m·r²). Luftdichte 1,2 kg/m³.
- **Luftwiderstand mit Drag-Crisis** (Hong & Asai 2014, Sci. Rep. 4:5068, Windkanal): cD ≈ 0,5 unterkritisch,
  Abfall ab Re ≈ 1,5–1,7·10⁵, kritisch bei 2,2–2,8·10⁵ mit cD ≈ 0,15–0,17 → Übergang zwischen ~11 und ~16 m/s.
  Ein harter Schuss fliegt „glatt“; fällt er unter ~16 m/s, bremst die Luft plötzlich stärker (bei 13 m/s 30 % mehr
  Verzögerung als bei 17 m/s). Mit Spin steigt cD überkritisch (Goff & Carré 2010, Gl. 4).
- **Magnus-Kraft:** cL(Sp) aus den Windkanal-Daten von Asai et al. 2007 (Mediane von 5 Messreihen, abgelesen aus
  Goff & Carré 2010, Abb. 6), für große Sp die Flugbahn-Werte von Goff & Carré 2009. Rechenprobe: 25 m/s mit
  cL = 0,25 → 8,3 m/s² quer → 2,9 m Kurve auf 20 m.
- **Flatterball:** ohne Spin schwanken Seiten- und Auftriebskraft (Hong & Asai 2014: SD ≈ 1–2 N bei 30 m/s,
  Spitze ≈ 2,5 Hz → Strouhal ≈ 0,018). Zufall aus dem Seed; Kick-Roboter-Nachbau (30 m/s, 15°, Tor in 25 m):
  Streuung 0,29 m seitlich / 0,28 m vertikal (Paper: 0,2–0,5 m).
- **Kunstrasen** kalibriert auf **FIFA Quality Pro, trocken** – die Prüfverfahren laufen als Tests genau wie im Labor:
  Ballabprall aus 2,00 m (0,72 m; Fenster 0,60–0,85), Kanone 15°/50 km/h (52 %; 45–60 %), Rampe 45° mit
  R 500 mm und Stäben Ø 40 mm (6,0 m; 4,0–8,0), dazu „Reduced Ball Roll“ (Methode 17). Aufprall nach dem
  Grip-Slip-Modell (Cross 2002): Rückdrall bremst, Vorwärtsdrall lässt den Ball nachlaufen.
- **Bande:** hart (Stoßzahl 0,65, Reibung) – Effet ändert den Abprallwinkel (Bandenpass). **Netze:** weich
  (Feder-Dämpfer, Rückprall ≈ 10 %), Netz beult am Ball aus (höchstens 0,9 m, an den Kanten greifen Dach-, Außen- und
  Tornetz ineinander: auch 52 m/s bleiben drin). **Pfosten/Latte:** Stahlrohr Ø 80 mm.
- **Käfig:** 24 × 15 m (Nacht 2c, vorher 20 × 13 = `?feld=20x13`), Tore 3 × 2 m in der Bande, Bande 1 m, Ballfangnetz, Dachnetz auf 5 m. Mit Dach reicht das
  Seitennetz bis zum Dach (sonst Spalt zwischen 3 und 5 m). Ohne Dach (`?dach=0`) ist das Netz 2 m hoch
  (Oberkante 3 m); fliegt der Ball darüber, gibt es „Aus“ und der Ball kommt zurück.
- **Spieler:** Sprint 7,5 m/s, Laufen 5,2 m/s, 0 → 4 m/s in 0,60 s, 0 → 7 m/s in 2,5 s; Kurve r = v²/13 m/s²
  (4,3 m im Sprint), Stemmschritt 16 m/s². Ballführung mit echten Ballkontakten und Ballmagnet, kein Klebeball;
  im Sprint längere Vorlagen. Körper als Zylinder (Ball prallt ab, kann aber nie auf einem Spieler liegen bleiben), Spieler schieben
  sich gegenseitig weg (Zweikampf).

## URL-Schalter
| Schalter | Wirkung |
|---|---|
| `?solo=1` | Training allein (Ball und Käfig wie Nacht 1) |
| `?bots=1` … `3` | Stärke der Bots (Reaktion, Tempo, Streuung, Fangsicherheit, Fehlerquote), Standard 2 |
| `?dauer=4`, `?golden=1`, `?anstoss=0` | Minuten je Halbzeit, Golden Goal bei Gleichstand, Schnellstart statt Anstoß nach Tor |
| `?torraum=4`, `?fanghilfe=0` | Radius des Torraums (m), Fanghilfe für den menschlichen Tormann aus (nur mit `?autotorwart=0`) |
| `?autotorwart=0`, `?autowurf=1` | Auto-Torwart aus (grüne Knöpfe wie Nacht 2b); Sekunden ohne Eingabe bis zum automatischen Abwurf (Nacht 2e: 1, vorher 2) |
| `?rueckpass=1` | Rückpass wie bis Nacht 2d erlaubt (Tormann als Pass-Empfänger, fängt den Ball vom Mitspieler) |
| `?halten=1.2`, `?holdMax=3` | Tormann mit Ball (Nacht 2e): Sekunden bis zum Abwurf des Bot-Tormanns (spätestens + 0,8 s Abschlag), `0` = Nacht 2d (wartet bis ~4,4 s, Zeitregel 6 s, Auto-Torwart 2 s); Zeitregel (s) |
| `?tormann=1` … `3` | Stärke der CPU-Tormänner getrennt von den Feldspielern (Zwischenwerte wie `1.5` erlaubt; ohne Regler wie `?bots=`). Standard 2 lässt ≈ 30 % der Schüsse rein (Nacht 2b: 14 %) |
| `?zack=0` | altes Bewegungsmodell aus Nacht 1 (A/B-Vergleich) |
| `?wende=13`, `?stemm=16`, `?bremse=9`, `?kurve=20`, `?antritt=0.672` | Kurven-Querbeschleunigung, Stemmschritt-Bremsung, Abbremsen (m/s²), Winkel bis zur reinen Kurve (°), Antritts-Zeitkonstante (s) |
| `?sprint=8`, `?lauf=5.5` | Sprint-/Lauftempo (m/s) |
| `?hilfe=0` … `1` | Stärke der Ballführungs-Hilfe (lenkt den Spieler zum Ball) |
| `?magnet=0` … `2` | Ballmagnet (Standard 1,2; Nacht 2c 0,5; 0 = Ballführung wie Nacht 2b). Feinregler: `?magnetK=112`, `?magnetC=20`, `?magnetAcc=42`, `?magnetLead=0.7`, `?magnetSprint=0.7` (Nacht 2c 0,45), `?magnetOpp=0.5`, `?magnetShield=0.3`, `?magnetTurn0=60`, `?magnetTurn1=120`, `?magnetSlide=0` (Magnet während einer gegnerischen Grätsche) |
| `?wucht=1.5` | Endtempo von Vollspann, angeschnittenen Schüssen, Volley und Dropkick (Nacht 2d; `1` = Nacht 2c). `?wuchtDrall=1`: Drall der Banane wächst mit (0 = Drall wie Nacht 2c, die Kurve wird dann kleiner) |
| `?hechten=0`, `?hechtAb=0.7`, `?hechtVorlauf=0.7`, `?hechtKnapp=0.5`, `?groundT=0.5`, `?diveArmT=0.2` | Tormann-Hechtsprung (Nacht 2d): alte Regel; ab so viel Abstand Ball ↔ Körper (m) hechtet er; frühester Absprung vor dem Ball (s); Spektakel-Hechter bei so knapp daneben (m); am Boden (s, Nacht 2c 0,75); bis die Arme gestreckt sind (s) |
| `?schuss=32`, `?pass=12`, `?effet=12` | max. Schusstempo (Grundwert vor der Wucht, wirkt auf alle Schüsse), Passtempo, max. Effet (U/s) |
| `?dach=0`, `?feld=20x13`, `?netz=2` | ohne Dachnetz (Ball kann raus → Abwurf), anderes Feld (Standard 24 × 15; die Kamera zieht mit: Figuren auf 24 × 15 ≈ 17 % kleiner im Bild als auf 20 × 13), Ballfangnetz ohne Dach (m) |
| `?bande=0.7`, `?abprall=0.62`, `?rollen=0.65` | Stoßzahl Bande, Stoßzahl Rasen, Rollwiderstand Rasen |
| `?dachhoehe=6`, `?torbreite=3`, `?torhoehe=2` | Käfig-Maße |
| `?<Parametername>=Wert` | jeder Wert aus `src/sim/params.js`, z. B. `?keeperDist=0.8`, `?holdMax=8` |
| `?q=0/1/2` | Grafikstufe fest: 0 niedrig, 1 mittel (Handy: Blob-Schatten unter den Menschen), 2 hoch (Echtzeit-Schatten). Ohne `?q=` Automatik: bei < ~42 fps erst Auflösung, dann Menschen-Schatten, dann alle Schatten runter |
| `?figur=kapsel` | Kapsel-Figuren statt Rocketbox-Menschen (Rückfall) |
| `?seed=4711`, `?debug`, `?play` | fester Zufall, Anzeige Bildrate/Draw-Calls, Startbildschirm überspringen |
| `?doppel=0.11`, `?tipp=0.2` | Gesten: Fenster für den 2. Druck nach dem Loslassen (s; Kinder mit langsamem Doppeltipp: `0.15`), längster Tipp (s) |
| `?laden=1` | Profi: Aufladen per Haltedauer, tipp + halten = Variante (Gesten aus Nacht 2b) |
| `?graetsche=0`, `?tackleReach=2.5`, `?slideT=0.5`, `?slideGroundT=0.6`, `?tackleShotD=11` | Grätsche aus; Reichweite (m), Rutschen/am Boden (s), bis zu dieser Torentfernung schießt der Schuss-Knopf aus der Grätsche |
| `?timinghilfe=0`, `?kickLunge=0.2`, `?tippPuffer=1.5` | strenges Luftball-Timing; Extra-Reichweite (m) für einen getippten Kick; so lange (s) bleibt ein Tipp vorgemerkt |
| `?treffpunkt=1` | Profi-Steuerung mit Treffpunkt statt Gesten (altes Modell) |
| `?passfix=0`, `?passArr=5.5`, `?passNoise=0.8` | Passsystem wie Nacht 2d (A/B); Ankunftstempo eines Tipp-Passes (m/s, + 0,15 je Meter); Grund-Streuung (°) |
| `?kegel=35`, `?innen=60`, `?hacke=120` | Pass: Zielkegel um den Stick (°), bis zu welchem Winkel Innenseite, ab welchem Hacke |
| `?chipmin=25`, `?chipmax=45` | Chip-Abflugwinkel weit/kurz (°) – `chipmin` gilt mit `?flanke=0`, `chipmax` = kurzer Chip |
| `?flanke=0` … `1` | Pass hoch: 1 = feste Flanke (Nacht 2c: bei 8 m 24°, ab 15 m 14°, 2,5 U/s Rückdrall, ≈ 30 % kürzere Flugzeit; bis 5 m steiler Chip), 0 = hoher Chip 25–45° wie Nacht 2b. Feinregler `?flankeElev=24`, `?flankeD=8`, `?flankeMin=14`, `?flankeBack=2.5` |
| `?banane=0` … `1` | Angeschnittener Schuss: 1 = feste Banane (Nacht 2c: Grundtempo wie Vollspann, ≥ 95 % im Spiel, Drall wächst mit dem Tempo bis 12 U/s), 0 = 85 % Tempo wie Nacht 2b |
| `?schusshilfe=1` | Schuss-Hilfe: > 1 = gute Lage zählt mehr (z. B. 1.5 leichter), < 1 = strenger |
| `?luft=0` | keine automatischen Luftball-Techniken (Volley, Kopfball …) |
| `?zeitlupe=0` | keine Zeitlupe bei Luftbällen |
| `?replay=0`, `?replayDelay=1` | keine Tor-Wiederholung (sonst im Pause-Menü umschaltbar); Sekunden Live-Jubel davor |
| `?challenge=torwand` | direkt in eine Übung (torwand, volley, bande, dribbel, elfmeter, doppelpass, tw_serie, tw_reaktion, tw_1gegen1) |
| `?nohelp` | Hilfekarte beim ersten Start überspringen |

## Technik
- three.js r186 als ES-Module mit Import-Map (`lib/three/`), **kein Build-Schritt**; GitHub Pages; PWA mit
  Service-Worker (Cache-Busting über Inhalts-Hash: `python3 tools/update_sw.py`).
- `src/sim/` – Physik ohne DOM (läuft auch in Node): `params.js` (alle Werte mit Quelle), `aero.js`, `ball.js`,
  `world.js` (Käfig), `player.js`, `step.js` (Spielwelt 120 Hz), `lab.js` (FIFA-Prüfverfahren als Simulation).
- `src/sim/rules.js` (letzte Hand, Torraum, Hände, 3 s, Schnellstart, Uhr), `src/sim/bots.js` (Utility-KI, Bandenpass
  mit gemessener Abprall-Kennzahl der Ballphysik), Schuss-/Pass-API `Player.kickAt({kind, target, technique})`.
- **Ballgefühl (Nacht 2b):** `src/input/gesture.js` (Gesten-Parser, reine Funktion je Spieltakt; Knopf-Flanken tragen
  den Zeitstempel des Touch-Ereignisses, damit ein kurzer Tipp auch bei langsamen Bildern kurz bleibt),
  `src/sim/kickplan.js` (Roll-/Chip-Tabellen, Flugbahn-Löser mit echter Ballphysik), `pass.js` (Laufweg-Vorhalt,
  Bande), `shot.js` (Qualität q, Eckenwahl), `technique.js` (Technik-Tabellen, Luftball-Bewertung), `air.js`
  (Luftball-Planer und -Ausführung – Bots nutzen dieselbe API), `challenges.js` (9 Übungen, Ballmaschine, Sterne).
  `src/render/training.js` (Ballmaschine, Torwand, Hütchen, Dummies, Zielmarken).
- `src/sim/replay.js` (Nacht 2d): Ringpuffer des Darstellungs-Zustands, Ablauf und Kameras der Tor-Wiederholung (ohne
  DOM, in Node getestet); `src/render/replayfx.js`: Leuchtspur und Druckwelle (je 1 Draw-Call), Kinobalken/Blitz per CSS.
- `src/render/` – Szene, Käfig, Ball/Granulat, `avatars.js` (Rocketbox-Menschen, Lauf-Blend, Leibchen, Posen), Kamera
  je Format. `src/audio/sound.js` – **stumm** seit Nacht 2e (Stub mit alter Schnittstelle, kein AudioContext).
  `src/input/` – Touch, Tastatur/Maus, Gamepad.
- **Menschen-Pipeline:** `tools/fetch_rocketbox.py` (nur benötigte Dateien, Rohdaten in `assets_src/`, gitignored) →
  `tools/rb_to_glb.py` (Blender 5.2 headless: Avatar-Export und Retargeting der Clips per Weltrotation auf das
  Referenz-Skelett, Wurzelbewegung raus, Laufzyklen mit gemessenem Tempo) → `tools/pack_avatars.mjs` (gltf-transform:
  WebP 1024²/512², Rotationen Int16, meshopt). Prüfstand: `tools/avatar_view.html` (`tests/avatar_view.py`).
- Debug-API für Tests: `window.__game` (`state()`, `info()`, `perf()`, `input()`, `kick()`, `sim()`, `human()`,
  `bots()`, `newGame()` …).
- Erstladung 6,6 MB (Budget 15 MB): 6 Menschen 1,7 MB, Bewegungen 0,9 MB.

## Entwicklung und Tests
```bash
npm test                        # alle Node-Tests: FIFA-Rasen, Aerodynamik, Käfig, Spieler (Messtabellen)
node tests/node/fifa.test.mjs   # Fall, Kanone, Rampe (M01/M02/M03/M17) wie im Labor
node tests/node/aero.test.mjs   # Drag-Crisis, Magnus-Kurve, Flatterball-Streuung, Determinismus
node tests/node/cage.test.mjs   # Bande, Netz, Dach, Tore, 1500 Zufallsschüsse: Ball bleibt im Käfig
node tests/node/player.test.mjs # Laufwerte, Zack-Zieltabelle (Peters Probe), Kurve, Ballführung, Hilfe ≤ 0,3 s, Pass, Schuss
node tests/node/agility.mjs     # Richtungswechsel-Tabelle wie Peters Probe (z. B. node tests/node/agility.mjs zack=0)
node tests/node/rules.test.mjs  # letzte Hand, Hysterese, Torraum, Hände, 3 s, Hechten, Schnellstart, Spielzeit, Golden Goal
node tests/node/selfplay.test.mjs  # 200 Bot-Spiele à 2 × 4 min: keine Hänger, Tore, beide treffen, Stärken (≈ 2 min)
node tools/calibrate.mjs        # Rasenwerte neu auf die FIFA-Ziele stellen
python3 tests/smoke.py          # Browser (Pixel 7 hoch/quer, Desktop): 0 Fehler; Training: Führen/Schuss/Bande/Dach;
                                #   3 gegen 3: Bots spielen, Tor → Anstoß, Tormann-Knöpfe, Abwurf, Wechsel, Ton aus (0 AudioContext)
python3 tests/pass_touch.py      # Nacht 2e: Pass mit echten Touch-Ereignissen (hoch/quer, Daumen bleibt drauf), Ziel-Ring, 3 min Spiel, 0 Fehler
python3 tests/test_touch.py     # echte Touch-Ereignisse: Stick, Pass, Tipp/Doppeltipp auf beiden Knöpfen, Ring
node tests/node/gesture.test.mjs    # Lade-Gesten (?laden=1: halten, tipp + halten, Grenzen, zwei Knöpfe)
node tests/node/tap.test.mjs        # Tipp-Gesten (Standard): Parser, 1000 Zufalls-Gesten, Tipp → Ballkontakt, Tipp/Doppeltipp im Spiel
node tests/node/technique.test.mjs  # Technik-Tabellen Pass/Schuss/Luftball
node tests/node/pass.test.mjs       # 500 Pass-Situationen: Ball erreicht den Laufweg (flach/hoch, p50/p95)
node tests/node/curve.test.mjs      # Banane/Flanke vorher/nachher: Tempo, Flugzeit, Scheitel, Kurve (Tabelle), kurzer Chip steil
node tests/node/shot.test.mjs       # Schussqualität q monoton, Trefferquote gute Lage, schlechte Lage langsamer/zentraler
node tests/node/air.test.mjs        # Ballmaschinen-Serie: jede Luftball-Technik gewählt und trifft, Timing zählt
node tests/node/challenge.test.mjs  # alle 9 Übungen headless mit Skript-Spieler: Sterne, untätig endet
node tests/node/magnet.test.mjs     # Ballmagnet vorher/nachher: Kinder-Stick (Ball weg je Minute), Parcours, Selbstspiel-Ballverluste, Regeln
node tests/node/dribble_probe.mjs 20 "magnet=0"  # Messwerkzeug: Parcours (Skript/Kinderhand), Ballverluste beim Führen im Selbstspiel
node tests/node/tackle.test.mjs     # Grätsche: Auslöser, Ball zuerst (Pass/Schuss/klären), Gegner zuerst (Ball frei, stolpert), Bots, keine Hänger
node tests/node/passsystem.test.mjs # Passsystem (Nacht 2e): Pass-Probe 2000 Pässe vorher/nachher (stehend/laufend/Sprint), Empfänger = gemeint, Bot-Pässe
node tests/node/pass_probe.mjs 200 "passfix=0"  # Messwerkzeug: Pässe mit Gesten wie am Handy, Tabelle je Variante
node tests/node/botpass_probe.mjs 6 # Messwerkzeug: Bot-Pässe im Bot-Spiel (kommt an, abgefangen, Passgeber selbst)
node tests/node/rueckpass.test.mjs  # kein Rückpass: Pass-Auswahl (Stick aufs eigene Tor), keine Hände nach Mitspieler-Pass, Hinweis, 6 Bot-Spiele
node tests/node/halten.test.mjs     # Tormann mit Ball (Nacht 2e): Haltezeit Median/max, keine Zwangsabwürfe, abgefangene Abwürfe vorher/nachher
node tests/node/keeper_hold_probe.mjs 8 "halten=0"  # Messwerkzeug: Haltezeit, Abwürfe, abgefangen, Rückpässe
node tests/node/keeper.test.mjs     # Auto-Torwart (hält ohne Knopf, Stick gewinnt, Abwurf nach 1 s), CPU-Tormann je Stufe (24 Spiele), Roller
node tests/node/keeper_probe.mjs 30 # Tore je Schuss gegen Stufe 1/2/3 (KEEPER_ONLY=1: nur der Tormann wechselt, DETAIL=1: nach Abstand)
node tests/node/keeper_series.mjs   # Tormann isoliert: feste Eckschuss-Serie je Stufe (mit Hechtsprüngen; SPEED=21-33 = harte Schüsse)
node tests/node/wucht.test.mjs      # Wucht vorher/nachher (Tempo, Flugzeit, Kurve, leeres Tor), Ziel-Löser, Abwehr > Fang-Grenze, Selbstspiel: Tunneln, Hechtsprünge
node tests/node/wucht_probe.mjs selfplay "wucht=1" 8   # Messwerkzeug: Schüsse, Tore, Hechtsprünge, schnellster Schuss, Ball draußen
node tests/node/stumm.test.mjs      # Ton aus: kein Audio-Erzeuger im ausgelieferten Code, Stub ohne Wirkung
node tests/node/replay.test.mjs     # Tor-Wiederholung: Ringpuffer, Kontakt-Takt, Ablauf ≤ 7 s, Überspringen, Spielzustand unverändert
python3 tests/shots5.py final       # Fotos Nacht 2d: sechs Luftball-Techniken im Kontakt (Spiel- und Seitenkamera), Hechtsprung, Wiederholung (FORMS=hoch)
python3 tests/shots4.py final   # Fotos Nacht 2c: Auto-Torwart hechtet, Grätsche, Flanke, großes Feld (hoch/quer)
python3 tests/shots3.py final   # Fotos Nacht 2b: Aufladering, Training, Torwand, Fallrückzieher, Kopfball, Ergebnis
python3 tests/perf_vergleich.py [pfad]  # Leistung je Spieltakt/Bild, z. B. gegen einen Worktree eines älteren Stands
python3 tests/perf.py           # CPU- und GPU-Zeit je Bild, Draw-Calls, Dreiecke je Format und Stufe
python3 tests/test_autoq.py     # Qualitäts-Automatik (ohne ?q=) greift, mit ?q= bleibt alles fest
python3 tests/test_live.py      # GitHub Pages: HTTP 200, Version = lokal, 0 Fehler, PWA installierbar, offline
python3 tests/shots.py final    # Fotos Training (Nacht 1) nach tests/shots/final/
python3 tests/shots2.py final   # Fotos 3 gegen 3: Anstoß, Zweikampf, Tormann mit Ball, Hechtsprung, Tor-Jubel, Pause
python3 tests/avatar_view.py    # Avatar-Prüfstand: Clips nebeneinander, Füße/Blickrichtung gemessen
python3 tools/fetch_rocketbox.py && Blender -b --python tools/rb_to_glb.py -- avatar <Name …> && … -- anims m Sports_Male_02 && … -- anims f Sports_Female_02 && node tools/pack_avatars.mjs
python3 tools/fetch_assets.py && python3 tools/make_assets.py   # Assets neu bauen
```
Browser-Tests laufen headless über die GPU (ANGLE/Metal), nie zwei Browser gleichzeitig.

## Credits
- **Himmel/Licht:** „Suburban Football Field“ von Grzegorz Wronkowski, Poly Haven, CC0.
- **Rasen-Texturen:** Grass004 und Grass005, ambientCG, CC0 (Kunstrasen umgefärbt, Faser-Normalmap selbst erzeugt).
- **Menschen und Bewegungen:** Microsoft Rocketbox Avatar Library (MIT, © 2020 Microsoft) – Sports_Male_02/03/04,
  Sports_Female_02, Male_Adult_10, Female_Adult_12 und 16 Bewegungen je Geschlecht.
- **Bibliothek:** three.js (MIT), meshoptimizer-Decoder (MIT).
- **Physik-Quellen:** Hong & Asai 2014; Asai et al. 2007; Goff & Carré 2009/2010; Cross 2002; FIFA Quality Programme
  for Football Turf (Handbook of Test Methods 2015, Test Manual 2024).

Details: [`LICENSES.md`](LICENSES.md). Code, Käfig, Ball, Leibchen, Posen, Physik, Bots: eigene Arbeit (MIT).
Keine Vereins- oder Markenlogos, keine echten Spielernamen.
