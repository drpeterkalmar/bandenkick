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

---

## Vorlagen-Etappe E2 – Nachdrall nach dem Schuss (Release 0.5.2)

Datenblatt #5 (Vorlage C, angepasst). Neu `src/sim/nachdrall.js`, eingebunden im Spiel und im freien Training.

### Was neu ist
- In den ersten **0,25 s** nach dem Schuss gibt der Stick dem fliegenden Ball **zusätzlichen Drall** – die Bahn wird nie
  verschoben, die Kurve macht die vorhandene Magnus-Physik. **Stick zur Seite** = Seitendrall (die Seite wird beim ersten
  deutlichen Ausschlag festgelegt), **zurück** = Rückdrall (der Ball steigt), **vor** = Vorwärtsdrall (er senkt sich).
- Abklingen in zehn gleich langen Abschnitten mit den Gewichten 5-4-3-2-2-2-2-1-1-1: 52 % der Wirkung in den ersten drei,
  54 % in den ersten 0,08 s.
- Gezählt wird nur die **Stick-Änderung gegenüber dem Kontakt**: wer zum Zielen den Stick zur Ecke hält und dort lässt, gibt
  keinen Nachdrall („ohne Eingabe ändert sich nichts“).
- Stärke × Wucht (voll ab 25 m/s, ein 12-m/s-Schuss bekommt gut die Hälfte). Jede Berührung (Tormann, Spieler), Bande, Pfosten
  oder Netz beendet das Fenster. Am Ende meldet das Spiel ein Ereignis `nachdrall` (Drall in U/s).
- **Bots** geben mit der Chance ihrer Stufe Nachdrall (Stufe 1/2/3: 5/15/30 % der Schüsse), immer vom Tormann weg, Stärke
  30–70 %.
- Werte: seitlich **14 U/s** bei vollem Stick (Datenblatt-Startwert 8), zurück/vor ± 5 U/s. Warum 14: der Auftrieb sättigt –
  ein 15-m-Schuss (22 m/s, 7°) bog sich mit 8 U/s nur 1,2 m, mit 12 U/s 1,4 m, mit 14 U/s 1,5 m, mit 20 U/s 1,6 m.
- Hilfe-Tabelle im Spiel: neue Zeile „gleich nach dem Schuss: Stick zur Seite = Kurve, zurück = steigt, vor = senkt sich“.
- Regler: `?nachdrall=0` (aus) … `2` (doppelt), `?nachdrallT=0.25`, `?nachdrallSeite=14`, `?nachdrallHoch=5`,
  `?nachdrallBot=1` (`0` = Bots nie).

### Messung

| Größe | Datenblatt-Ziel | gemessen |
|---|---|---|
| 15-m-Schuss (22 m/s, 7°) mit vollem Stick zur Seite: seitlicher Versatz | +1,5 … 3 m | 1,53 m links, 1,54 m rechts |
| Anteil der Wirkung in den ersten 0,08 s | ≥ 50 % | 54 % |
| halber Stick | – | halber Drall (Kurve 0,81 ×, Auftrieb sättigt) |
| Stick zurück (24 m/s, 10°): Höhe nach 15 m | Ball steigt | 0,36 → 1,53 m |
| Stick vor (24 m/s, 14°): Höhe nach 15 m | Ball senkt sich | 1,37 → 0,50 m |
| Stick schon beim Kontakt so gehalten / `?nachdrall=0` | keine Kurve | 0,00 m / 0,00 m |
| Torquote mit − ohne Nachdrall, Bot-Spiel Stufe 2 (20 Spiele) | höchstens +10 Punkte | 31,3 − 28,9 = +2,4 |
| … Stufe 1 gegen 3 (10 Spiele) / Stufen reihum (12 Spiele) | höchstens +10 Punkte | +0,6 / −3,7 |
| Nachdrall je Spiel (Bots) st2 / 1 gegen 3 / reihum | – | 4,7 / 4,1 / 6,1 |
| Hechter, Luftbälle je Spiel (st2) | ≥ 15, ≥ 9 | 21,9, 9,4 |
| Hänger / Numerik | 0 / 0 | 0 / 0 |

Die Unterschiede der Torquote liegen im Rauschen (± 2–3 Punkte je Lauf): der Nachdrall der Bots ist selten und gleicht sich aus
– er bringt den Ball vom Tormann weg, aber auch öfter neben das Tor.

### Bilder
`tests/shots/n7/e2_nachdrall_quer.jpg`, `e2_nachdrall_hoch.jpg` (`python3 tests/n7_e2_bilder.py quer|hoch`): derselbe Schuss
aus 16 m, Kamera steil über der Bahn, 7 Bilder (0,1 … 0,7 s) hell übereinandergelegt. Links ohne Stick: gerade Spur zur
Tormitte. Rechts Stick nach links direkt nach dem Kontakt: die Spur biegt sich gleichmäßig nach links (≈ 1,4 m bis zur
Torraumgrenze). Sichtprüfung: die Kurve ist klar zu sehen, ohne Knick (kein Versetzen, nur Drall).

### Tests E2
- Neu `tests/node/nachdrall.test.mjs` (17 Prüfungen: Gewichte, Stick-Richtung, Kurve links/rechts, halber Stick, steigen,
  senken, gehaltener Stick, Regler aus, × Wucht, Bot-Spiel mit/ohne). Alle 34 Node-Tests grün, `tests/smoke.py` 0 Fehler.

### Handy-Test für Peter (E2)
1. Aus 10–15 m scharf aufs Tor schießen und **sofort danach** mit dem Daumen den Stick zur Seite wischen: der Ball zieht eine
   Kurve in diese Richtung. Je früher, desto stärker – nach einer Viertelsekunde wirkt nichts mehr.
2. Direkt nach dem Schuss Stick zurück: der Ball steigt (Achtung Latte!), Stick vor: er senkt sich.
3. Zu stark/zu schwach? `?nachdrall=0.6` bzw. `?nachdrall=1.5`; aus: `?nachdrall=0`. Bots ohne Nachdrall: `?nachdrallBot=0`.

---

## Vorlagen-Etappe E3 – Traumpass und Geben und Gehen (Release 0.5.3)

Datenblatt #6 (Vorlage B, angepasst) und #7 (Vorlage A, angepasst). Neu `src/sim/perfekt.js`, Laufweg in `src/sim/bots.js`.

### Was neu ist
- **#6 Traumpass → Direktabnahme** (`?perfekt=1`): Bei jedem Pass zu einem Mitspieler wertet das Spiel den Treffpunkt: höchstens
  **7 m** vor der Tormitte, Pass ≥ 3 m, kein Gegner ≤ 1,5 m am Treffpunkt und ≤ 1,2 m am Passweg (auch nicht der Tormann),
  Wertung 0,67 · „Schussweg frei“ (Feldspieler des Gegners, auf 4 m) + 0,33 · „Empfänger frei“ ≥ 0,7. Dann:
  - **goldener Ring** (pulsierend) unter dem Empfänger und **goldene Ballspur**, solange der Ball zu ihm unterwegs ist;
  - schießt der Empfänger **direkt** (ohne Annahme; auch Volley/Kopfball), steigt die Schuss-Qualität um **0,4** (höchstens 1)
    und die Wucht um × 1,1 – sichtbar als ein Schuss, der platzierter und härter kommt;
  - Ereignis `perfektpass`; der Direktschuss trägt `perfekt` und zählt bei den Action-Momenten (n6) als Höhepunkt (Wertung
    ≥ 0,7, Grund „traumpass“) – keine eigene Zeitlupe, Fan-Edit/Wiederholung unverändert.
  - Bots nehmen einen Traumpass immer direkt ab (`?perfektBot=1`).
- **#7 Geben und Gehen** (`?gebengehen=1`): Nach einem Pass prüft der Passgeber (Bot, auch der eben abgegebene Spieler des
  Menschen) alle 0,5 s bis 2 s nach dem Pass, ob 4,5–7,5 m vor ihm Raum ist (Wertung √(1 − Abstand zum Tor / 24 m) × (1 − 0,3
  je Gegner ≤ 2,5 m) ≥ 0,5), und läuft dann 2 s dorthin (Einheitstempo, kein Sprint). Der Lauf endet, wenn er den Ball bekommt
  oder der Gegner ihn hat. Der Empfänger-Bot spielt ihn bevorzugt zurück an (Wert × 1,15). Ereignis `gebengehen`.
- Werte gemessen gewählt (Datenblatt-Startwerte in Klammern): Abstand 7 m (8), Schussweg-Maß 4 m (ohne Maß), freier Passweg
  neu, Qualität + 0,4 (+ 0,25), Laufziel 4,5–7,5 m, Rückpass-Bonus × 1,15 (+ 0,3).

### Messung (Bot-Selbstspiel Stufe 2, 40 Spiele, Seeds 1–40)

| Größe | Datenblatt-Ziel | ohne (`?perfekt=0&gebengehen=0`) | mit E3 |
|---|---|---|---|
| Traumpässe je Spiel | 2–5 | – | 3,3 |
| … davon direkt abgenommen | – | – | 61 % |
| Tore ≤ 4 s nach einem Traumpass | 40–55 % | – | 42 % |
| Geben und Gehen (Passgeber ≥ 4 m nach vorn in 3 s, Anteil der Pässe ≥ 4 m) | 30–50 % | 21 % | 31 % |
| Doppelpässe je Spiel (A → B → A in 4 s) | ≥ 3 | 20,6 | 24,4 |
| Bot-Pässe kommen an | ≥ 60 % | 63 % | 60 % |
| Tore je Schuss / Tore je Spiel | 25–35 % / ± 20 % | 28,9 % / 15,8 | 29,9 % / 16,6 |
| Pässe je Spiel | – | 84,7 | 92,8 |
| Hechter / Luftbälle je Spiel | ≥ 15 / ≥ 9 | 21,7 / 9,9 | 22,9 / 10,6 |
| Hänger / Numerik | 0 / 0 | 0 / 0 | 0 / 0 |

Einzeln: nur Traumpass (`?gebengehen=0`) 2,5 Traumpässe je Spiel, 52 % Tore danach; nur Geben und Gehen (`?perfekt=0`)
33 %, Doppelpässe 24,2. Zusammen gibt es mehr Traumpässe (die Läufer stehen frei vor dem Tor), die einzelnen sind etwas
schwerer zu verwerten.

### Bewertung
- Alle Datenblatt-Ziele erreicht; die Bot-Passquote liegt genau an der Grenze (60 %, vorher 63 %): die Läufer werden öfter
  angespielt, wenn es eng ist. Der Rückpass-Bonus selbst spielt kaum eine Rolle (× 1,3 → 59 %, × 1,15 → 60 %, ohne → 60 %).
- Tore nach Traumpass schwanken je 20 Spiele um ± 8 Punkte (≈ 70 Traumpässe), die Messung über 40 Spiele ist belastbarer.

### Bilder
`tests/shots/n7/e3_traumpass_quer.jpg`, `e3_traumpass_hoch.jpg` (`python3 tests/n7_e3_bilder.py quer|hoch`): Pass von hinten
auf den freien Mitspieler vor dem Tor, 0,15/0,3/0,45 s danach und der Direktschuss. Sichtprüfung: goldener Ring unter dem
Empfänger (pulsiert), kurze goldene Spur hinter dem Pass, der Direktschuss (150 km/h, q 0,9) mit normaler heller Spur; danach
ist der Ring weg.

### Tests E3
- Neu `tests/node/traumpass.test.mjs` (21 Prüfungen: Wertung frei/Gegner am Treffpunkt/im Schussweg/Tormann im Passweg/zu weit,
  Regler aus, Direktabnahme + 0,4 und härter, nur einmal, Lauf des Passgebers mit/ohne, Bot-Spiel mit allen Messgrößen).
  Alle 35 Node-Tests grün, `tests/smoke.py` 0 Fehler.

### Handy-Test für Peter (E3)
1. Einem Mitspieler, der frei vor dem Tor steht, zupassen: leuchtet unter ihm ein **goldener Ring** und zieht der Ball eine
   goldene Spur, ist es ein Traumpass – dann sofort **Schuss tippen**, bevor er den Ball annimmt: der Direktschuss kommt
   härter und genauer. Aus: `?perfekt=0`; leichter auszulösen: `?perfektD=8`.
2. Nach deinem Pass läuft der Spieler, den du gerade abgegeben hast, nach vorn – spiel ihn zurück an (Doppelpass). Vergleich:
   `?gebengehen=0`.

---

## Vorlagen-Etappe E4 – Kinder-Steuerung (Release 0.5.4)

Datenblatt #8 (Stick-Ruhe), #9 (Wechsel-Glättung); #11 („Sprint mit Ball dreht schlechter“) entfällt seit Etappe 0.
Umsetzung als Filter auf den Stick des Menschen (`Game.kinderStick` in `src/sim/step.js`), im Spiel, im freien Training und in
den Übungen.

### Was neu ist
- **#9 Wechsel-Glättung** (`?wechselGlatt=0.3`, Standard an): nach einem Spielerwechsel läuft der neue Spieler im ersten Takt
  halb mit seinem eigenen Schwung, halb nach dem Stick; in 0,3 s gilt ganz der Stick. Kein Ruck mehr, wenn der Daumen noch in
  die Richtung des alten Spielers zeigt. Nicht bei der Empfänger-Sperre nach dem eigenen Pass (die regelt das schon).
- **#8 Stick-Ruhe** (`?stickruhe=0.1`, **Standard aus**): die Laufrichtung folgt dem Stick mit 0,1 s Zeitkonstante; Zucken
  unter 1,8° und Richtungswechsel ab 25° gehen sofort durch, die Stärke bleibt ungefiltert.
- **Zielen immer mit dem rohen Stick:** Pass- und Schussrichtung nehmen den ungefilterten Stick (`zielX/zielZ`), die Filter
  wirken nur aufs Laufen.

### Messung und Entscheidung
| Größe | Datenblatt-Ziel | ohne E4 | Standard (Wechsel-Glättung) | mit `?stickruhe=0.1` |
|---|---|---|---|---|
| Kinderhand-Führen allein, Ball weg je Minute (120 × 60 s) | ≤ 3,5 (n6: 4,9) | 3,48 | 3,48 (kein Wechsel) | 3,64 (Schwelle 117°), 3,20 (25°) |
| … gegen Stufe-2-Bot | – | 6,18 | 6,18 | 6,34 (117°), 6,30 (25°) |
| … Tempo mit Ball | – | 4,07 m/s | 4,07 m/s | 4,27 m/s (117°) |
| Pässe im Lauf kommen an, Weg frei (500 je Variante, Tipp / Halten) | ≥ 90 % (heute 88 %) | 87 / 85 % | 87 / 85 % | erst 75 / 75 % – Zielen mit gefiltertem Stick; mit rohem Stick 87 / 85 % |
| Dribbel-Parcours Skript | nicht langsamer | 11,5 s | 11,5 s | 16,4 s mit 117°, unverändert mit 25° |
| Kurvenradius bei 2 m/s (`player.test`) | 0,2–0,45 m | 0,28 m | 0,28 m | 0,79 m mit 25° (Daumen dreht gleichmäßig 15° voraus) |

- **Stick-Ruhe: kein messbarer Nutzen, aber träger.** Mit der Datenblatt-Schwelle (117°) wurden auch gewollte Richtungswechsel
  verzögert: Slalom 11,5 → 16,4 s, Kurven bei langsamem Tempo fast dreimal so weit. Mit 25° glättet sie das Zittern
  (± 8° → ± 0,7°), verlangsamt aber gleichmäßige Kurven; mit 10° glättet sie kaum noch. Die Ballverluste mit dem zappeligen
  Kinder-Stick ändern sich in keiner Variante über das Rauschen hinaus (± 0,2 je Minute). Peters „zackig“ hat Vorrang → aus,
  zum Ausprobieren `?stickruhe=0.1`.
- **Wechsel-Glättung:** Pässe, Kinderhand, Parcours und Selbstspiel unverändert (die Bots nutzen sie nicht), der Wechsel
  wirkt nur weicher – bleibt an.
- Das Ziel „Pässe im Lauf ≥ 90 %“ erreicht E4 nicht (87 %); die Ziele dafür liegen beim Passsystem, nicht beim Stick.

### Tests E4
- Neu `tests/node/kinderstick.test.mjs` (13 Prüfungen: Zittern, 45°-Wechsel und Kehrtwende sofort, Zielen roh, Wechsel halb/
  0,15 s/0,3 s, Regler aus, Kinderhand allein/gegen Bot/Tempo). Alle 36 Node-Tests grün, `tests/smoke.py` 0 Fehler.

### Handy-Test für Peter (E4)
1. Mit dem Ball laufen und den Spieler wechseln lassen (Ball verloren, Mitspieler näher): der neue Spieler „ruckt“ nicht mehr,
   er übernimmt kurz seinen eigenen Schwung. Vergleich `?wechselGlatt=0`.
2. Wer es ruhiger mag: `?stickruhe=0.1` glättet das Daumen-Zittern (größere Richtungswechsel bleiben sofort).

---

## Vorlagen-Etappe E5 – Abgeschrägte Käfig-Ecken (Release 0.5.5)

Datenblatt #10 (Vorlage D, angepasst).

### Was neu ist
- Jede Käfig-Ecke hat eine **45°-Schräge** (Schenkel **1,5 m**, `?eckschraege=1.5`, `0` = eckig): Bande und Netz bis oben folgen
  der Schräge, Längs- und Stirnseiten werden entsprechend kürzer; das Gestell (Eck-Pfosten, Oberrahmen, Bandenkante) läuft
  schräg mit. Kollision = Bild (dieselben Flächen in `world.js` und `render/field.js`).
- Physik: die Schräge ist eine echte Bande (gleicher Abprall wie die übrige Bande); unterhalb der Bandenoberkante gilt sie als
  harte Wand über die ganze Ecke – ein Ball, der von oben ins Ecknetz fällt und es eindellt, kann nicht hinter die Bande rutschen
  (im Selbstspiel 2 von 200 Spielen an der Fuge Stirnbande/Schräge, danach 0).
- Spieler bleiben vor der Schräge (Körperradius), der Ballmagnet drückt den Ball nicht hinein.
- Warum 1,5 m statt 1,0 m: Ballkontakte in den Ecken (2,5 × 2,5 m) im Bot-Spiel mit 1,0 m −23 %, mit 1,5 m −39 % (Ziel −30 %);
  am Bild sehen beide natürlich aus, 1,5 m ist immer noch kleiner als in der Vorlage (≈ 2 m).

### Messung
| Größe | Datenblatt-Ziel | eckig (`?eckschraege=0`) | 1,0 m | 1,5 m (Standard) |
|---|---|---|---|---|
| Ballkontakte in den Ecken je Spiel (Stufe 2, 20 Spiele) | −30 % | 109,5 | 84,1 (−23 %) | 66,8 (−39 %) |
| Ball in der Ecke eingeklemmt / Hänger | 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Ball diagonal in die Ecke (8 m/s): Abpraller, Weg aus der Ecke nach 3 s | – | 2×, 1,0 m | – | 1×, 2,7 m |
| Tore je Schuss (st2) | 25–35 % | 30,6 % | 32,6 % | 30,3 % |
| 800 harte Schüsse (30–52 m/s) in die Ecken: Ball draußen | 0 | – | – | 0 (449 trafen Eck-Bande/-Netz) |
| `cage.test` (52 m/s, 2 × 1500 Zufallsschüsse) | grün | grün | grün | grün |
| Bildzeit Handy-Profil (CPU ×4, DPR 2,6), Spiel, p95 hoch/quer, 2 Läufe | ≤ +2 % | 15 / 7, 9,9 / 13 ms | – | 12 / 13,5, 8,4 / 8,9 ms |

Bildzeit: die Läufe streuen stärker als jeder Unterschied (Mittel p95 eckig 11,2 ms, mit Schrägen 10,7 ms); Draw-Calls und
Dreiecke unverändert (+ 8 kleine Flächen, + 12 Rohre).

### Bilder
`tests/shots/n7/e5_ecken_quer.jpg`, `e5_ecken_hoch.jpg` (`python3 tests/n7_e5_bilder.py`): Spalten eckig / 1 m / 1,5 m, oben
von schräg oben, unten von innen. Sichtprüfung: Bande und Netz knicken sauber in die Schräge, Gestell folgt, keine Lücken,
keine Überlappungen; die Fugen der Bandenbretter laufen durch.

### Tests E5
- Neu `tests/node/eckschraege.test.mjs` (12 Prüfungen). `cage.test`: Zufallsbeschuss startet nicht mehr hinter einer Schräge
  (dort ist kein Feld mehr). `wucht.test`: Tore je Spiel Grenze 18 → 21 (mehr Schüsse und Nachschüsse seit Etappe 0, Tore je
  Schuss unverändert 32,5 %). Alle 37 Node-Tests grün, `tests/smoke.py` 0 Fehler.

### Handy-Test für Peter (E5)
1. Den Ball in eine Ecke spielen oder dort dribbeln: die Ecke ist schräg, der Ball springt zurück ins Feld statt zwischen zwei
   Banden hin und her. Gefällt die Größe? `?eckschraege=1` (kleiner), `?eckschraege=2` (größer), `?eckschraege=0` (eckig).

---

## Abschluss n7 (Release 0.6.0)

### Gesamtmessung: Datenblatt-Ziel / vorher / nachher
Bot-Selbstspiel Stufe 2 gegen 2, 20 Spiele (Seeds 1–20), und Stufe 1 gegen 3, 10 Spiele. „vorher“ = alle Vorlagen-Regler auf 0
(`?muede=0&winkel=0&raus=0&stolpern=0&nachdrall=0&perfekt=0&gebengehen=0&wechselGlatt=0&eckschraege=0`) mit sonst gleichem
Stand (= Etappe 0 / Release 0.5.0 plus die nebenbei behobenen Fehler), „nachher“ = Release 0.6.0.

| # | Messgröße | Datenblatt-Ziel | vorher st2 / 1:3 | nachher st2 / 1:3 | erreicht |
|---|---|---|---|---|---|
| 1 | Tore je Schuss | 25–35 %, Unterschied zu `?muede=0` sichtbar | 28,3 / 35,7 % | 32,6 / 33,8 % | ja |
| 2 | Nachschuss-Tore (Anteil aller Tore) | ≥ 10 % | 24,1 / 16,1 % | 23,4 / 13,0 % | ja (kommt aus Etappe 0) |
| 3 | Tormann-Energie: Minimum je Spiel; Zeit unter 60 | 30–60; 10–25 % bei Dauerdruck | 100; 0 % | 47 / 71; 3,3 % | Minimum ja, Dauerdruck-Zeit nein (siehe E1) |
| 4 | Tore aus spitzem Winkel | −30 % gegenüber `?winkel=0` | 15,5 / 19,0 % | 14,9 / 18,8 % | nein (≈ −5 %, siehe E1) |
| 5 | 1 gegen 1 vereitelt (je 40 Szenen, Stufe 1/2/3) | 35–50 % | Ø 33 % | Ø 48 % (20/63/63 %) | ja |
| 6 | Nachdrall: 15-m-Schuss, voller Stick; Anteil in 0,08 s | +1,5 … 3 m; ≥ 50 % | – | 1,53 m; 54 % | ja |
| 7 | Torquote mit − ohne Nachdrall | ≤ +10 Punkte | – | +2,4 / +0,6 / −3,7 Punkte | ja |
| 8 | Traumpässe je Spiel; Tore danach | 2–5; 40–55 % | 0 | 3,6 / 3,6; 39 / 50 % (40 Spiele: 3,3; 42 %) | ja (Stichprobe streut) |
| 9 | Geben und Gehen; Doppelpässe; Bot-Pässe kommen an | 30–50 %; ≥ 3; ≥ 60 % | 19,6 / 28,3 %; 19,9 / 17,8; 64,9 / 63,9 % | 32,3 / 37,2 %; 25,9 / 20,9; 63,8 / 62,6 % | ja |
| 10 | Kinder-Stick-Ballverluste je Minute | ≤ 3,5 (n6: 4,9) | 3,48 | 3,48 (Stick-Ruhe ohne Nutzen → aus) | ja (dank Etappe 0) |
| 11 | Pässe im Lauf (Weg frei) | ≥ 90 % | 87 % | 87 % | nein (unverändert) |
| 12 | Ball in der Ecke eingeklemmt; Ballkontakte in den Ecken | 0; −30 % | 0; 111 / 95 | 0; 66 / 63 (−40 / −33 %) | ja |
| 13 | Hechter ≥ 15, Luftbälle ≥ 9 je Spiel, Tore je Spiel ± 20 % | – | 23,1, 9,7, 16,1 | 25,1, 9,7, 18,1 (+12 %) | ja (Luftbälle 1:3: 7,4) |
| 14 | Regler auf 0 → Werte wie E0 (± 5 %) | – | E0: 28,0 % / 15,8 / 22,6 Hechter / 20,1 Doppelpässe | aus: 28,3 % / 16,1 / 23,1 / 19,9 | ja (Nachschuss-Anteil 24 statt 28 % – Rauschen und der Pass-Fix aus E1) |
| – | Hänger / Numerik-Fehler (auch 200 Spiele `selfplay.test`) | 0 / 0 | 0 / 0 | 0 / 0 | ja |

Nicht erreicht: #3 Zeit unter 60 Energie (im Bot-Spiel kein Dauerdruck), #4 spitzer Winkel (die Tore an der kurzen Ecke kommen aus
der Reaktionszeit, nicht aus der Stellung), #11 Pässe im Lauf (keine der Vorlagen-Mechaniken setzt dort an). Ballbesitz am Fuß im
Bot-Spiel 4,6 s/min (Etappe-0-Ziel 5, siehe dort).

### Releases
0.5.0 Etappe 0 · 0.5.1 E1 Tormann · 0.5.2 E2 Nachdrall · 0.5.3 E3 Traumpass + Geben und Gehen · 0.5.4 E4 Kinder-Steuerung ·
0.5.5 E5 Eck-Schrägen · 0.6.0 Abschluss (Bericht, Endmessung).

### Alle neuen Regler (0 bzw. aus = vorheriges Verhalten)
| Regler | Standard | Wirkung |
|---|---|---|
| `?sprintfrei=0`, `?ein=`, `?trab=` | an, 6,0 m/s, 0,83 | Etappe 0: Sprint, Lauftempo, Bot-Trab |
| `?abschirmen=0`, `?magnet=` | an, 1,8 | Etappe 0: Abschirmen, Ballmagnet |
| `?fangMax=0`, `?nachfassen=` | 13 m/s, 0,5 s | Etappe 0: Fanggrenze, Abklatschen |
| `?muede=0`, `?muedeFang=`, `?muedeErh=`, `?muedeSenk=` | an, 60, 1/s, 5 m/s | E1 Tormann-Müdigkeit |
| `?winkel=0` | 0,5 | E1 Winkelhalbierende |
| `?raus=0`, `?rausMax=` | an, 1 m | E1 Herauslaufen und Blocken |
| `?stolpern=0` | 0,25 | E1 Heber-Stolpern |
| `?nachdrall=0`, `?nachdrallSeite=`, `?nachdrallBot=0` | 1, 14 U/s, 1 | E2 Nachdrall |
| `?perfekt=0`, `?perfektD=`, `?perfektQ=` | an, 7 m, 0,4 | E3 Traumpass |
| `?gebengehen=0`, `?laufT=` | an, 2 s | E3 Geben und Gehen |
| `?wechselGlatt=0`, `?stickruhe=0.1` | 0,3 s, aus | E4 Kinder-Steuerung |
| `?eckschraege=0` | 1,5 m | E5 Eck-Schrägen |

### Handy-Test für Peter (alles auf einen Blick)
1. **Laufen und Ballbesitz:** ein Tempo, kein Sprint-Knopf; der Gegner kommt nicht durch dich durch an den Ball.
2. **Tormann:** klatscht scharfe Schüsse ab (hinterher!), wird nach vielen Paraden müde (Handschuhe grau), kommt beim 1 gegen 1
   heraus und blockt, stolpert manchmal bei einem Heber.
3. **Nachdrall:** direkt nach dem Schuss den Stick zur Seite wischen → Kurve; zurück → steigt, vor → senkt sich.
4. **Traumpass:** goldener Ring unter dem freien Mitspieler vor dem Tor → sofort Schuss tippen (Direktschuss, härter, genauer).
   Nach deinem Pass läuft der abgegebene Spieler nach vorn → Doppelpass.
5. **Spielerwechsel** ohne Ruck; **Ecken** schräg, der Ball kommt zurück ins Feld.
Zum Vergleichen jeweils den Regler auf 0 setzen (Tabelle oben).

### Offen
- Der Bot-Tormann dreht beim Zurücklaufen zur Linie kurz den Rücken zum Ball (seit Etappe 0 bekannt).
- Herauslaufen/Blocken konservativ – Peters Eindruck entscheidet (`?rausMax=2`).
- Eck-Schräge 1,5 m – Peter entscheidet nach Sicht (`?eckschraege=1` / `2`).
- Pässe im Lauf 87 % (Ziel 90 %) – Thema fürs Passsystem, nicht für die Vorlagen.
- Fan-Edit/Wiederholung wurden nicht angefasst; neue Höhepunkte (Glanzparade, Traumpass-Direktschuss) gehen nur als Ereignis an
  die Action-Momente.
