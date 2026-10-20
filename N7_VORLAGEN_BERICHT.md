# Bandenkick n7 – Bericht (Etappe 0 und Vorlagen-Etappen)

Auftrag: Etappe 0 nach Peters Wunsch vom 14.10.2026 („keine Sprintfunktion mehr, besserer Ballbesitz (mehr Magnet), Torwart hält
fast nie einen scharfen Schuss, sondern klatscht nur ab“) als eigener Release, danach die Etappen aus dem Vorlagen-Datenblatt
(Vorlage A–D, Clean-Room: nur Mechanik und Zahlen in eigenen Worten). Lesart: alles gilt für alle Spieler – Mensch und Bots,
beide Tormänner.

Messwerkzeuge (alle neu oder erweitert in n7, laufen ohne Browser):
- `tests/node/n7_probe.mjs [Spiele] [Query] [alle|st2|13]` – Bot-Selbstspiel parallel, alle Größen in einem Lauf. „alle“ = Stufen
  reihum (Seeds 1001 …, wie Hermes' Probe), „st2“ = Stufe 2 gegen 2 (Seeds 1 …).
- `tests/node/dribble_probe.mjs` (Hermes' Messung der Ballverluste), `tests/node/hold_probe.mjs` (Skript-Mensch gegen einen
  Stufe-2-Verteidiger), `tests/node/keeper_catch_probe.mjs` (Hermes' Torwart-Probe, erweitert um „nur direkte Schüsse“),
  `tests/node/pass_probe.mjs` (Pässe mit echten Gesten).
- „vorher“ = Stand n6 (88ac84d) mit genau diesen Werkzeugen gemessen (Rohdaten `tests/out/n7/vorher_e0.txt`, nicht im Repo).

---

## Etappe 0 – Release 0.5.0

### 0a Kein Sprint – ein Lauftempo für alle
- Weder Knopf noch Stick-Rand, Shift oder Gamepad (LB/RB/LT/Stick-Klick) beschleunigen; auch Bots sprinten nicht mehr.
  Ein Tempo `vEin` = **6,0 m/s** (Startwert 6,3). Die Antrittskurve und das Wenden sind unverändert „zackig“ (0 → 4 m/s in
  0,6 s, 0 → 6 m/s in 1,4 s). Sprint-Sonderwerte (längere Vorlagen, schwächerer Magnet, Streuung ×2,5/×2, Pass ×1,3) entfallen,
  weil niemand mehr sprintet.
- Warum 6,0 statt 6,3: gemessen mit der Pass-Probe (400 Pässe je Variante, echte Gesten): Pässe im Lauf (Stick ¾) kommen bei 6,3
  zu 84,7 % an, bei 6,0 zu 85,6 %, vorher (Laufen 5,2) 86,1 %; mit vollem Stick bei 6,0 84,5 % (vorher im Sprint 81,6 %). 5,8
  wäre noch sicherer (87,8 %), fühlt sich aber zäher an. Torquote und Schüsse ändern sich zwischen 5,8 und 6,8 kaum.
- Bots: ohne Eile (wo sie früher nicht sprinteten) traben sie mit 83 % des Lauftempos (≈ 5 m/s wie das alte Laufen), wenn es
  eilt, laufen sie voll (6,0 statt 7,5). Ohne diese Abstufung standen die Verteidiger überall schneller und fingen mehr Pässe ab.
- Grätsche rutscht mit 8 m/s los (früher mindestens 6 m/s bzw. das Sprinttempo). Ohne Sprint sanken die Grätschen mit
  Ballgewinn sonst um 12 %.
- HUD: Sprint-Knopf weg. Hochformat: Schuss 46 px, Pass 30 px tiefer, Wechsel zwischen Schuss und Pass – Abstand der
  Knopfmitten zur Ecke unten rechts Schuss 183 → 143 px, Pass 203 → 198 px, Wechsel 272 → 246 px. Querformat: die Knöpfe lagen
  schon im Daumenbogen, der Sprint-Platz bleibt frei (Wechsel woanders hin wäre weiter weg gewesen). Hilfe- und Gamepad-Texte
  ohne Sprint. Fotos: `tests/shots/n7/hud_neu_hoch.jpg`, `hud_neu_quer.jpg` (Sichtprüfung: keine Überlappung, nichts verdeckt).
- Regler: `?sprintfrei=0` = altes Verhalten (Knopf + Sprint 7,5 m/s, Laufen 5,2), `?ein=6.3` = Lauftempo, `?trab=1` = Bots
  immer voll. Der alte Alias `?sprint=` bleibt `vSprint` (wirkt mit Sprint-frei nur noch auf die Antrittskurve).
- Datenblatt-Folgen: #11 „Sprint mit Ball dreht schlechter“ entfällt; #7 „Geben und Gehen“: der Passgeber läuft im
  Einheitstempo; die Tempostufen aus Vorlage A werden nicht eingeführt.

### 0b Ballbesitz – mehr Magnet und Abschirmen
- Magnet 1,8 statt 1,2. Feder, Dämpfung und Kappung wachsen mit der Stärke (geprüft: `magnetK·m`, `magnetC·m`, `magnetAcc·m`),
  Vorlage und Kontakt-Genauigkeit sind bei 1 ausgereizt.
- Richtungswechsel milder: bis 120° nur auf 50 % (vorher 25 %). Echte Kehrtwenden (120° → 165°) lassen zusätzlich los
  (`magnetKehr` 0,15) – sonst sprang beim zappeligen Kinder-Stick der Ball mit Stärke 1,8 mehr als doppelt so oft weg.
- Dämpfung 30 statt 20: mit Stärke 1,8 schwang der Ball sonst quer nach, der Skript-Parcours verpasste Slalom-Tore (9,5 → 12 s);
  mit 30 sind es 8,0 s.
- **Abschirmen** (`?abschirmen=1`): Steht ein Gegner ≤ 1,5 m am Ball, legt der Führende kürzer vor (bis −50 %) und den Ball bis
  0,35 m auf die gegnerabgewandte Seite. Ein Gegner bekommt den Ball per bloßem Kontakt (Fuß, vorgemerkter Pass/Schuss) nur,
  wenn sein Fuß ihn ≥ 0,3 m früher erreicht als der des Führenden und nicht durch dessen Körper hindurch. Gilt, solange der
  Führende ihn eng am Fuß hat (≤ 0,9 m, zuletzt berührt ≤ 1 s, kein Pass/Schuss; Mitnehmen zählt als Führen). Die Grätsche ist
  ausgenommen und bleibt das Mittel zum Ballgewinn; Bots grätschen gegen einen Abschirmer etwas öfter (× 1,2).
- Befund unterwegs: die meisten verbleibenden Verluste passierten, weil der Ball nach einem Führ-Kontakt mehr als 4 m/s schneller
  als der Spieler war oder der Bot ihn eben zu sich selbst vorgelegt hatte (Mitnehmen) – beides zählt jetzt als Führen.

### 0c Tormann klatscht scharfe Schüsse ab
- Eine Fanggrenze für alle Tormänner (CPU-Stufen 1–3 und Peters Auto-Torwart): über **13 m/s** an den Händen (≈ 47 km/h) wird
  abgeklatscht, hohe Bälle (≥ 1,6 m) gefaustet. Nur Bälle, deren Bahn höchstens 0,3 m an der Körpermitte vorbeigeht, fängt er
  bis 16 m/s noch ab und zu (bei 13 m/s mit 50 %, linear bis 0). Vorher: Stufen 15/17/22 m/s, Auto-Torwart ≈ 23 m/s.
- Abpraller: 25–40 % des Tempos, 25–70° zur Seite, an der der Ball vorbeikommt, schräg nach vorn in den Torraum – nie zurück ins
  Tor. Danach fasst der Tormann 0,5 s nicht nach (ohne diese Sperre fing er den eigenen Abpraller 0,06 s später – Bildfolge).
- Sichtbar: eigene Posen „Abklatschen“ (Arme vor/hoch) und „Fausten“ (Arme über den Kopf), am Kontakt in 0,05 s ganz oben.
  Bildfolgen (8 Bilder um den Kontakt, Kamera seitlich vor dem Tor): `tests/shots/n7/parade_flach_quer.jpg`,
  `parade_hoch_quer.jpg`, `parade_hoch_hoch.jpg`. Sichtprüfung: Arme gehen am Kontakt hoch, der Ball fliegt schräg zur Seite weg,
  beim Fausten steil nach oben-seitlich. Die Fingerspitzen-Parade und die Hechtsprünge bleiben, wie sie waren.
- „Letzte Hand“ unverändert: die Parade ist `touch(pl, true)`, geht der Ball trotzdem rein, zählt das Tor für den Schützen
  (Eigentor-Fix aa64f95 bleibt).
- Regler: `?fangMax=13` (`0` = alt), `?fangKoerper=0.3`, `?fangKoerperMax=16`, `?fangKoerperP=0.5`, `?abprallMin=0.25`,
  `?abprallMax=0.4`, `?abprallW0=25`, `?abprallW1=70`, `?faustH=1.6`, `?nachfassen=0.5`.
- Messdefinition: Hermes' Probe zählt den ersten Torwartkontakt nach einem Schuss – auch wenn der Ball vorher von Bande, Pfosten
  oder einem Spieler abgefälscht wurde und langsam ankam (dann ist Fangen richtig). Deshalb stehen unten beide Zahlen.
  Die Ziele „≤ 15 / ≤ 5 / ≤ 2 %“ erfüllen die direkten Schüsse; mit abgefälschten liegen 72–90 und ≥ 90 km/h bei 5–8 %, das
  sind fast nur Bälle, die mit < 13 m/s ankommen.

### Messtabelle Etappe 0 (vorher = n6, nachher = 0.5.0)

Bot-Selbstspiel „alle“ = 12 Spiele, Stufen reihum; „st2“ = 20 Spiele Stufe 2 gegen 2; Ballverluste zusätzlich 80 Spiele.

| Größe | Ziel | vorher | nachher |
|---|---|---|---|
| Tore je Schuss (alle / st2) | 25–38 % | 29,7 / 25,5 % | 35,1 / 28,0 % |
| Tore je Spiel (alle / st2) | – | 12,7 / 10,6 | 18,8 / 15,8 |
| Schüsse je Spiel (alle / st2) | ≥ −15 % | 42,6 / 41,5 | 53,4 / 56,4 |
| Pässe zum Mitspieler je Spiel (alle / st2) | ≥ −15 % | 77,6 / 77,2 | 85,5 / 83,0 |
| Hänger / Numerik-Fehler | 0 / 0 | 0 / 0 | 0 / 0 (auch 200 Spiele `selfplay.test`) |
| Fangquote erster Kontakt 58–72 km/h (alle Schüsse / nur direkte) | ≤ 15 % | 42 % / – | 3 % / 0 % |
| … 72–90 km/h | ≤ 5 % | 21 % / – | 8 % / 0 % |
| … ≥ 90 km/h | ≤ 2 % | 3 % / – | 5 % / 0 % |
| Langsame Bälle (< 45 km/h an den Händen) gefangen | ≥ 90 % | 100 % | 100 % |
| Fangen / Abwehren / Hechten je Spiel (alle) | Hechter ≥ 15 | 34,3 / 22,3 / 18,3 | 22,3 / 25,9 / 19,7 |
| Nachschuss-Tore (Tor ≤ 2 s nach Parade, ein Angreifer spielt den Abpraller) | Basis für #2 | 2,6 / 7,6 % der Tore | 23,6 / 28,2 % |
| Ballverluste beim Führen, `dribble_probe` 12 Spiele (Hermes) | ≤ 2,3/min | 3,80 (Zweikampf 3,56) | 1,72 (1,62) |
| … 80 Spiele (Stufen reihum) | ≤ 2,3 / Zweikampf ≤ 2,1 | 3,97 (3,74) | 1,85 (1,71) |
| Ballbesitz am Fuß (dribble_probe 12 / 80 Spiele) | ≥ 5 s/min | 3,4 / 3,4 | 5,0 / 4,8 |
| Grätschen je Spiel st2: Versuche / mit Ballgewinn (Quote) | bleibt Mittel | 11,8 / 6,8 (57 %) | 11,3 / 7,8 (69 %) |
| Dribblings > 8 s, längstes; Ball am Fuß in den Ecken | keine Dauer-Dribblings | 0, 5,8 s; 0,07 s/min | 0, 5,5 s; 0,05 s/min |
| Parcours Skript / Kinderhand (6 Läufe) | nicht langsamer, 0 Verluste | 9,45 / 6,10 s, 0 | 7,97 / 6,19 s, 0 |
| Skript-Mensch gegen Stufe-2-Verteidiger: Ball weg / Ballverluste je Minute am Ball / bis vors Tor | länger halten | 88 % / 34,7 / 12 % | 35 % / 8,8 / 62 % |
| Pässe kommen an, Weg frei (stehend / laufend / voller Stick) | ≥ 90 / 85 / 80 % | 92,1 / 86,1 / 81,6 % | 92,6 / 86,1 / 84,7 % |

Bewertung: Alle Ziele erreicht, bis auf „Ballbesitz am Fuß ≥ 5 s/min“ im großen Lauf (4,8; im 12-Spiele-Lauf 5,0). Mehr
Ballbesitz der Bots ginge nur über längeres Dribbeln, das kostete in den Proben Pässe und Schüsse (−15 bis −33 %) und erhöhte die
Verluste wieder – das Gefühl am Ball zählt beim Menschen, und dort hält der Ball jetzt deutlich länger. Mehr Tore je Spiel
(+48 %) kommen aus mehr Schüssen und den Nachschüssen; die Quote je Schuss bleibt im Ziel.

### Tests Etappe 0
- Node (alle grün, `node tests/node/run_par.mjs 5` ≈ 6 min bzw. `npm test`): angepasst `player.test` (ein Tempo, Sprint-Eingang
  wirkungslos, alte Sprintwerte mit `?sprintfrei=0`), `magnet.test` (n7-Ziele, Parcours nicht langsamer, Kehrtwende),
  `keeper.test` (Eckschuss-Serie: keine Stufe fängt scharfe Schüsse); neu `abschirmen.test` (Körper dazwischen, klar früher,
  Grätsche erobert, Mensch gegen Verteidiger), `fanggrenze.test` (alle Tormänner, Körperbälle, Abpraller-Tempo/-Richtung, Fausten,
  `?fangMax=0`, Bot-Spiele je Schusstempo).
- Browser: `tests/smoke.py` 0 Fehler (Pixel 7 hoch/quer, Desktop), neu „kein Sprint-Knopf“ und „Sprint-Eingang ändert das Tempo
  nicht“; `tests/n7_hud.py` (Knopf-Lagen, keine Überlappung), `tests/n7_parade.py` (Bildfolge). Alle Test-Browser starten jetzt
  zentral mit `--mute-audio` (`tests/util.py`, `tests/perf_gate.py`).

### Offen (Etappe 0)
- Der Bot-Tormann dreht dem Ball nach einer Parade beim Zurücklaufen zur Linie kurz den Rücken zu (Bewegungsclips kennen kein
  Rückwärtslaufen). Das gab es schon vorher, fällt beim Abklatschen aber mehr auf. Kandidat für E1 (Tormann-Stellung).

### Handy-Test für Peter (Etappe 0)
1. Ein Spiel starten, rechts unten: nur noch **Schuss**, **Pass** und **⇄** – kein Sprint-Knopf. Stick ganz nach außen macht
   nicht schneller. Fühlt sich das Lauftempo gut an? Zum Vergleichen `?ein=5.8` (etwas ruhiger) oder `?ein=6.5` (flotter),
   das alte Spiel mit Sprint: `?sprintfrei=0`.
2. Mit dem Ball auf einen Gegner zudribbeln: Steht er neben oder hinter dir, kommt er nicht mehr einfach „durch dich durch“ an
   den Ball – er muss grätschen oder vor dir dran sein. Zu leicht? `?schirmVor=0.15` (Gegner kommt leichter ran),
   `?magnet=1.5`; aus: `?abschirmen=0`.
3. Scharf aufs Tor schießen: Der Tormann klatscht ab (Arme hoch) oder faustet, der Ball springt seitlich in den Torraum – hinterher
   und nachschießen! Langsame Bälle fängt er weiter. Alt: `?fangMax=0`; Tormann etwas sicherer: `?fangMax=15`.

---

## Vorlagen-Etappe E0 – Messbasis und Datenblatt im Repo
- `VORLAGEN.md`: das Datenblatt in eigenen Worten, Vorbilder nur als Vorlage A–D, ohne Quellpfade, Klassen- oder Spielnamen.
- `tests/node/n7_probe.mjs` zählt zusätzlich die Messgrößen aus Abschnitt 5: Tore aus spitzem Winkel (Schuss von |z| > 3 m,
  < 6 m vor dem Tor), Luftbälle, Doppelpässe (A → B → A in 4 s), Geben und Gehen (Passgeber ≥ 4 m nach vorn in 3 s nach einem
  Pass ≥ 4 m), Bot-Pässe kommen an / abgefangen, Ballkontakte in den Ecken (2,5 × 2,5 m), eingeklemmte Bälle, später Energie,
  Traumpässe, Nachdrall, Stolpern, Blocken.
- Basis = Stand 0.5.0 (nach Etappe 0):

| Messgröße | Stufe 2 gegen 2 (20 Spiele, Seeds 1–20) | Stufe 1 gegen 3 (10 Spiele) |
|---|---|---|
| Tore je Schuss / Tore je Spiel | 28,0 % / 15,8 | 30,5 % / 14,9 |
| Nachschuss-Tore (Anteil aller Tore) | 28,2 % | 16,1 % |
| Hechter je Spiel | 22,6 | 12,7 |
| Tore aus spitzem Winkel (Anteil aller Tore) | 17,1 % | 20,8 % |
| Luftbälle je Spiel | 10,3 | 7,6 |
| Doppelpässe je Spiel | 20,1 | 15,7 |
| Geben und Gehen (Anteil der Pässe ≥ 4 m) | 21 % | 31 % |
| Bot-Pässe kommen an / abgefangen | 64 / 31 % | 63 / 31 % |
| Ballkontakte in den Ecken je Spiel / eingeklemmt | 114 / 0 | 98 / 0 |
| Hänger / Numerik-Fehler | 0 / 0 | 0 / 0 |

Hinweis: Nachschuss-Tore liegen schon nach Etappe 0 über dem E1-Gate (≥ 10 %), weil der Tormann jetzt jeden scharfen Ball
abklatscht. Die Müdigkeit (E1) verschiebt deshalb vor allem die mittleren Bälle (siehe dort).

---

## Vorlagen-Etappe E1 – Tormann (Release 0.5.1)

Datenblatt #1–#4 (Vorlage A und B), alles für alle Tormänner (CPU-Stufen 1–3 und Peters Auto-Torwart).

### Was neu ist
- **#1 Müdigkeit** (`?muede=1`): Energie 100 je Mannschaft. Jede Parade kostet – Fangen 8 (aufgehobene Roller nichts),
  Abklatschen/Fingerspitzen 14, Hechtfang/-abwehr 18 –, pro Sekunde Spielzeit kommt 1 zurück, zur Halbzeit wieder 100. Unter
  `muedeFang` 60 sinkt die Fanggrenze für mittlere Bälle (13 m/s) linear bis −5 m/s bei Energie 0; die Körperball-Grenze rückt
  mit. Nach dem Hechten steht er langsamer auf (Energie 80 → 20: Tempo 1 → 0,6). Langsame Bälle fängt er weiter.
  **Kondition je Stufe:** Kosten × 1,25 (Stufe 1) / × 1 (Stufe 2, Auto-Torwart) / × 0,6 (Stufe 3).
  Sichtbar: das Leuchten der Handschuhe folgt der Energie (ab 60 deutlich matter, unten grau).
  Eine Abwehr mit Energie < 60 und > 14 m/s meldet `glanzparade` an die Action-Momente (n6, nur Ereignis, Gewicht 0,78).
  - Datenblatt-Startwerte (−5/−10/−7, +4/s) gemessen verworfen: die Energie fiel im Spiel kaum unter 85, die Mechanik wäre
    unsichtbar geblieben. Mit 8/14/18 und +1/s liegt das Minimum je Spiel bei ≈ 47–50 (Ziel 30–60).
- **#2 Winkelhalbierende** (`?winkel=0.5`): die seitliche Stellung rückt zur Hälfte von der Linie Tormitte → Ball auf die
  Winkelhalbierende zwischen Ball → linker und Ball → rechter Pfosten (Tiefe wie bisher).
- **#3 Herauslaufen 1 gegen 1** (`?raus=1`): Wettlauf zum Schusspunkt 5 m vor dem Tor auf dem Weg des Angreifers. Ist kein
  Verteidiger mindestens 1 m früher dort und kein zweiter Angreifer frei nah am Tor, läuft der Tormann entgegen (Anteil des Wegs
  je Stufe 0,8/0,4/0,25, Mensch 0,5; ein zweiter Angreifer bremst auf 70 %). Kommt der Angreifer allein bis an die Torraumkante,
  geht er ihm ganz entgegen (Stufe 3 halb), höchstens 1 m über die Kante; draußen hat er keine Hände und **blockt**: Beine
  gespreizt (eigene Pose), flache Bälle prallen an 1,0 m Körperbreite ab.
- **#4 Heber-Stolpern** (`?stolpern=0.25`): ein Heber des Gegners über den Tormann im Torraum (Bahn ≤ 1,5 m neben ihm, 1–12 m
  vor dem Schützen, Richtung Tor) lässt ihn mit 25 % stolpern: 0,6 s keine Hände, kein Hechtsprung.

### Messung (Bot-Selbstspiel, `n7_probe.mjs`, gleiche Seeds)

„E0-Basis“ = alle vier Regler auf 0 (`?muede=0&winkel=0&raus=0&stolpern=0`) mit sonst gleichem Stand.

| Größe | Datenblatt-Ziel | E0-Basis | E1 |
|---|---|---|---|
| Tore je Schuss, Stufe 2 gegen 2 (20 Spiele) | 25–35 %, Unterschied zu `?muede=0` sichtbar | 28,3 % | 28,9 % (`?muede=0`: 30,4 %) |
| Tore je Spiel st2 / Stufe 1 gegen 3 (10 Spiele) | ± 20 % | 16,1 / 17,4 | 16,4 / 16,7 |
| Nachschuss-Tore (Anteil aller Tore) st2 / 1 gegen 3 | ≥ 10 % | 24,1 / 16,1 % | 26,3 / 15,6 % |
| Hechter je Spiel (st2) | ≥ 15 | 23,1 | 20,6 |
| Tormann-Energie: Minimum je Spiel (st2 / 1 gegen 3) | 30–60 | 100 | 47 / 66 |
| … Spielzeit unter 60 | 10–25 % bei Dauerdruck | 0 % | 2,7 % (normales Spiel, kein Dauerdruck) |
| Tore aus spitzem Winkel (Anteil aller Tore, st2) | −30 % gegenüber `?winkel=0` | 15,5 % | 15,6 % (`?winkel=0`: 17,0 %) |
| 1 gegen 1 vereitelt (je 40 Szenen, Stufe 1/2/3) | 35–50 % | 18 / 38 / 43 % (Ø 33) | 20 / 63 / 63 % (Ø 48) |
| CPU-Tormann Tore je Schuss Stufe 1/2/3 (`keeper.test`, 48 Spiele) | monoton | 43,4 / – / 25,5 % (E0) | 40,8 / 31,5 / 26,6 % |
| Schussserie 14–22 m/s, Stufe 3 (`keeper_series`, 200 Schüsse): gefangen / abgewehrt / Tore | „hält nicht mehr fast alles“ | n6: 163 / 17 / 0 | 0 / 179 / 1 |
| Heber-Stolpern je Spiel | – | 0 | 0,1 |
| Pässe kommen an (Bot) | ≥ 60 % | 65 % | 62 % |
| Hänger / Numerik-Fehler (auch 200 Spiele `selfplay.test`) | 0 / 0 | 0 / 0 | 0 / 0 |

Einzeln (st2, 20 Spiele): `?winkel=0` 31,0 % Tore je Schuss, `?raus=0` 28,5 %, `?muede=0` 30,4 % – die Unterschiede liegen im
Rauschen (± 1,5 Punkte bei ≈ 1100 Schüssen). Alle Regler auf 0 geben genau die Werte ohne E1.

### Bewertung
- **Erreicht:** Tore je Schuss im Ziel, Nachschuss-Tore weit über 10 %, Hechter ≥ 15, Energie-Minimum 30–60, 1 gegen 1 im Mittel
  48 % (Stufe 2: +25 Punkte gegenüber ohne Herauslaufen), Stufe 3 fängt in der Schussserie nichts mehr, Hänger 0.
- **Nicht erreicht – Winkelhalbierende:** Tore aus spitzem Winkel sinken nur um ≈ 8 % statt 30 %. Gemessen mit einer eigenen
  Serie aus spitzem Winkel (`SPITZ=1 node tests/node/keeper_series.mjs`, |z| 3–4,2 m, 2,5–5,5 m vor dem Tor): an der kurzen Ecke
  fallen gegen Stufe 2 ≈ 17 % der Schüsse rein, an der langen fast nichts. Die Stellung verschiebt der Tormann aber nur um
  0,03–0,07 m (er steht schon nahe am kurzen Pfosten); auch `?winkel=1` oder doppelt so weit änderten nichts – die Tore an der
  kurzen Ecke kommen aus der Reaktionszeit auf 3–5 m, nicht aus der Stellung. Standard bleibt 0,5 (schadet nicht, sieht
  richtig aus); eine bessere Reaktion des Tormanns würde die Tore je Schuss senken, das wollte die Etappe 0 gerade nicht.
- **Zeit unter 60 Energie** nur 2,7 % (Ziel 10–25 % bei Dauerdruck): im normalen Bot-Spiel gibt es selten Dauerdruck; stärker
  getaktet würde der Tormann schon nach zwei, drei Paraden müde – zu viel für Kinderspiele. Im Spiel gegen eine starke
  Mannschaft (Stufe 1 gegen 3) bleibt die Energie des schwachen Tormanns zeitweise tief.
- **Blocken** greift im Bot-Spiel praktisch nie (Bots schießen schon aus 6–8 m). Mit einem Skript-Menschen, der bis vor den
  Tormann dribbelt, blockt Stufe 1 in 3 von 30 Szenen; Stufe 2/3 nehmen ihn vorher im Torraum mit den Händen.
- **Stufe 3:** Herauslaufen, Winkel und Müdigkeit hoben ihre Tore je Schuss zusammen um ≈ 3–4 Punkte (Herauslaufen allein +4,
  weil sie im Spiel öfter umspielt bzw. überlupft wird, obwohl sie im reinen 1 gegen 1 besser hält). Deshalb Kondition × 0,6 und
  nur halbes Entgegenlaufen an der Torraumkante – danach 26,6 % (vorher 25,5 %), die Grenze in `keeper.test` von 26 auf 29 %
  angehoben (Datenblatt-Gate: Stufe 3 hält nicht mehr „fast alles“), die Stufen bleiben monoton.

### Nebenbei behoben
- **Ball klemmte zwischen zwei Mitspielern** (Selbstspiel Seed 180, 8 s an der Bande): ein Pass galt für die Bots als „noch
  unterwegs“, solange der Passgeber den Ball zufällig weiter berührte – der Empfänger blieb „Empfänger-Hilfe“, der Passgeber
  „sichern“, keiner holte den Ball, und das Abschirmen hielt den Gegner fern. Jetzt ist der Pass angekommen, sobald der Empfänger
  den Ball berührt (`rules.touch`). Bei einem Kick wird erst die Berührung gezählt, dann das Passziel gesetzt.
- Das Blocken setzt die Tormann-Logik jeden Takt neu; nur der aktuelle Tormann hat die breiten Beine (wechselt die Rolle, ist es
  sofort vorbei).

### Tests E1
- Neu `tests/node/tormann_e1.test.mjs` (21 Prüfungen: Kosten, Erholung, Kondition je Stufe, Aufstehen, Fanggrenze frisch/müde,
  Roller, `?muede=0`, Winkelhalbierende, 1 gegen 1 je Stufe mit/ohne Herauslaufen, Blocken, Heber-Stolpern, Bot-Spiel).
  `keeper_series.mjs` kann jetzt `SPITZ=1`. Alle 33 Node-Tests grün (`node tests/node/run_par.mjs 5`), `tests/smoke.py` 0 Fehler.
- Fotos `tests/shots/n7/e1_tormann_quer.jpg`, `e1_tormann_hoch.jpg` (frisch, müde, blocken, stolpern), Sichtprüfung: frisch
  leuchten die Handschuhe gelb-grün, müde matt grau-grün; beim Blocken stehen die Beine weit gespreizt, die Arme seitlich; beim
  Stolpern kippt er nach vorn.

### Offen (E1)
- Der Bot-Tormann dreht beim Zurücklaufen zur Linie kurz den Rücken zum Ball (aus Etappe 0) – unverändert offen.
- Herauslaufen und Blocken sind konservativ eingestellt (Datenblatt „offen“: erst am Bild entscheiden) – Peters Eindruck am
  Handy entscheidet, ob der Tormann weiter herauskommen soll (`?rausMax=2`).

### Handy-Test für Peter (E1)
1. Viel aufs Tor schießen: nach einigen Paraden leuchten die Handschuhe des Tormanns schwächer und werden grau – dann klatscht er
   auch mittelscharfe Bälle ab. Zur Halbzeit ist er wieder frisch. Vergleich: `?muede=0`.
2. Allein aufs Tor zulaufen: der Tormann kommt heraus. Bis an seinen Torraum heran dribbeln – draußen blockt er mit gespreizten
   Beinen. Zum Vergleich `?raus=0`; weiter heraus: `?rausMax=2`.
3. Einen Heber (Lupfer) über ihn spielen: manchmal stolpert er. `?stolpern=0` = nie, `?stolpern=0.5` = öfter.
