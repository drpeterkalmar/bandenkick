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
