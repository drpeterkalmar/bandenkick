# Bandenkick – Bericht Nacht 2: Menschen und Mannschaft (29.09.2026)

**Live:** https://drpeterkalmar.github.io/bandenkick/ (Version `b14b957df5`, live geprüft) · **Repo:** https://github.com/drpeterkalmar/bandenkick
Alle Punkte der Nacht sind umgesetzt, getestet und live. Der Kapsel-Rückfall war nicht nötig: Das sind echte
Rocketbox-Menschen. Zuerst kam wie gewünscht die zackigere Bewegung, alles andere baut darauf auf.

## Was geht
- **Bewegung „zackig“ (Nachtrag):** neues Bewegungsmodell statt „Lenkrad“: kleine Winkel sind eine Kurve
  (13 m/s² quer, Tempo bleibt), große ein **Stemmschritt** (falsche Geschwindigkeitsanteile mit 16 m/s² gebremst,
  Körper dreht sofort, Abstoß in die neue Richtung), dazu ein spritziger Antritt. Im Stemmschritt nimmt der Spieler
  den Ball mit Sohle/Außenseite mit, die Figur lehnt sich sichtbar gegen die alte Richtung. `?zack=0` = altes
  Gefühl zum Vergleichen; Regler `?wende=`, `?stemm=`, `?bremse=`, `?kurve=`, `?antritt=`.
- **3 gegen 3 mit sechs Rocketbox-Menschen** (Microsoft, MIT): Sports_Male_02/03 (Fußballtrikot), Sports_Male_04
  (Läufer), Sports_Female_02, Male_Adult_10 (Trainingsanzug), Female_Adult_12 (Hoodie). Sports_Male_01 (Badehose,
  barfuß) und Sports_Female_01 (Bikini) passen nicht auf den Kunstrasen und sind durch Adults ersetzt.
  **Trainingsleibchen** Orange/Blau werden aus dem Körpermesh jeder Figur erzeugt (Rumpf-Dreiecke +2 cm, gleiche
  Knochen) und sitzen deshalb ohne Durchstechen auch in der Bewegung.
- **Bewegungen aus Rocketbox** (16 Clips je Geschlecht): Idle, Gehen, Joggen, Laufen, Sprint, Jubeln, Klatschen,
  Warten, Hocke, Winken (Start/Stopp/Drehen sind konvertiert, siehe offene Punkte). Blend nach Tempo, alle Laufzyklen
  **phasengleich** (linker Fuß vorn = Phase 0) und mit dem **gemessenen Schrittweg** abgespielt, also ohne
  Fußgleiten. Prozedural darüber: Stemm-Neigung, Schussbein, Tormann bereit/halten/Hechtsprung.
- **„Letzte Hand“ exakt nach Plan:** Hinterster = kleinster Abstand zur eigenen Torlinie, Hysterese 0,5 m / 0,3 s,
  leuchtende Handschuhe und pulsierender Bodenring. Hände nur im eigenen Torraum (Halbkreis 4 m, `?torraum=`),
  außerhalb gibt es keine Handaktion. Ball in der Hand max. 6 s (HUD-Leiste), dabei greift niemand an. Im Torraum werden
  die Touch-Knöpfe zu **Fangen/Hechten**, mit Ball zu **Abwurf/Abschlag**. Hechtsprung vorerst als prozedurale Pose.
- **Bots** (`src/sim/bots.js`, ohne DOM): Rollen wechseln dynamisch (Ballführer/Anspielstation/Absicherung, beim
  Gegner Angreifer/Decker). Sie entscheiden nach einem Wert-Modell (Torchance, Ballbesitz, Kosten eines
  Ballverlusts) zwischen Schuss, Pass, **Bandenpass** (zum Mitspieler und zu sich selbst), Dribbeln und Befreien.
  Beim Bandenpass kommt der Zielpunkt aus der mit der echten Ballphysik gemessenen Abprall-Kennzahl (inkl. Rollspin).
  Verteidiger stellen zu, statt blind hineinzugrätschen. Drei Stärken `?bots=1…3`. Die Bots spielen über die
  Schuss-/Pass-API `Player.kickAt({kind, target, technique})`, die der Folgejob 2b ausbaut.
- **Spielerwechsel** automatisch zum ballnächsten, nach eigenem Pass zum Empfänger, hält der eigene Tormann den Ball
  → Tormann; dazu **⇄** / C / Tab / Gamepad Y.
- **Spielablauf:** Anstoß zu Beginn und nach der Halbzeit. Nach einem Tor gibt es 1,2 s Jubel (Torschütze reißt die
  Arme hoch, Mitspieler klatschen, Gegner warten), dann laufen alle in ihre Hälfte, danach **Schnellstart**: Der
  Tormann des Gegentors hat den Ball. `?anstoss=1` = klassischer Anstoß. 2 × 4 min (`?dauer=`), Uhr steht beim
  Jubel, Golden Goal `?golden=1`, HUD „Orange 2 : 1 Blau · 2. Halbzeit · 1:37“, Pfiffe zu Halbzeit und Ende.
- **Ton** (abschaltbar im Pause-Menü, `?ton=0`): alles selbst synthetisiert und per OfflineAudioContext vorgerendert
  (0,9 s beim Start). Dazu gehören Schuss, Pass, Ballkontakt, Aufsetzer, Bandenknall (hohles Paneel), Netz, Pfosten
  (Stahlrohr), Fangen, Körper, Hechtsprung, Pfiff, Rufe „Hey!/Hier!/Ja!/Tor!“ (Formant-Stimmen) und als
  Umgebung Vögel und entfernter Verkehr. Die Handy-Freischaltung erfolgt bei pointerup/touchend/click, dazu kommt
  ein Stimmenlimit.
- **Qualitätsstufen:** 0 niedrig, 1 mittel (Handy: **Blob-Schatten** unter den Menschen, kein SSAO), 2 hoch
  (Echtzeit-Schatten). Die Automatik ohne `?q=` senkt zuerst die Auflösung, dann die Menschen-Schatten, dann alle
  Schatten.
- **Erstladung 6,6 MB** (Budget 15 MB): 6 Menschen 1,7 MB, Bewegungen 0,9 MB. Die Rohdaten (FBX/TGA, 580 MB)
  liegen nur lokal in `assets_src/`.

## Messwerte
**Bewegung „zack“ – Peters Probe** (`agility_probe.mjs`, unverändert), vorher → nachher:

| Tempo | Wechsel | Richtung erreicht | Überschießen | Ziel |
|---|---|---|---|---|
| Laufen 5,2 m/s | 90° | 1,22 → **0,33 s** | 4,4 → **0,8 m** | ≤ 0,35 s / ≤ 1,0 m ✅ |
| Laufen 5,2 m/s | 180° | 2,15 → **0,33 s** | 2,7 → **0,8 m** | ≤ 0,6 s / ≤ 1,0 m ✅ |
| Sprint 7,5 m/s | 90° | 1,75 → **0,47 s** | 9,2 → **1,76 m** | ≤ 0,5 s / ≤ 1,8 m ✅ |
| Sprint 7,5 m/s | 180° | 2,57 → **0,48 s** | 4,5 → **1,73 m** | ≤ 0,8 s / ≤ 1,8 m ✅ |

Antritt 0 → 4 m/s 0,60 s (vorher 0,70), 0 → 7 m/s 2,49 s, Höchsttempo 7,46 m/s (unverändert). Die Kurve hat
jetzt einen Radius von 4,3 m bei 7,5 m/s (vorher 9,4 m). Mit Ball 90°/180° höchstens 0,50 s, der Ball kommt in
160 von 160 Fällen mit (Laufen und Sprint, 45–180°). Der Stick reagiert im ersten Takt (0,03 s bis 0,3 m/s in die
neue Richtung). Die Hilfe gibt eine deutliche Eingabe nach 0,18 s frei.

**Selbstspiel** (`tests/node/selfplay.test.mjs`, 200 Spiele à 2 × 4 min, alle 9 Stärke-Paarungen, 115 s Rechenzeit =
915-facher Zeitraffer):

| Prüfung | Ergebnis |
|---|---|
| Hänger (Ball liegt fest / in der Ecke eingeklemmt / Bot läuft im Kreis) | **0 / 0 / 0** |
| Numerik-Fehler, Spiele regulär beendet | 0, 200/200 |
| Tore | Ø 15,6 je Spiel (1,8/min), 0 Spiele ohne Tor, max. 33, 21 Remis |
| Beide Mannschaften treffen | in 99,5 % der Spiele (Orange 1547, Blau 1578 Tore gesamt) |
| Je Spiel | 83 Schüsse (Verwertung 19 %), 244 Pässe, 26 Bandenpässe zum Mitspieler + 77 zu sich selbst, 120 Befreiungen |
| Tormann je Spiel | 67 Fänge, 16 Abwehren, 4,5 Hechtsprünge, 78 Abwürfe, 3,6 Abschläge; Ball max. 4,6 s in der Hand |
| Letzte Hand wechselt (Hysterese) | 1,4× je Spiel |
| Stärke 2 vs. 1 / 3 vs. 1 / 3 vs. 2 | stärkere Bots gewinnen 60 % / 77 % / 64 % |

Beim Selbstspiel gefunden und behoben: Tormann fing den eigenen Abwurf sofort wieder, der Ball blieb auf dem Kopf
eines Spielers in der Netzecke liegen (Körper stützte ihn nach oben), ein Spieler drückte ihn über der Bande gegen die
Netze, ein Bot befreite nach hinten durch den eigenen Körper, ein „Decker“ blockierte die Ecke, und nach jedem Gegentor
fingen die Torschützen den Abwurf am Torraum ab (jetzt laufen alle während des Jubels zurück).

**Regeln** (`tests/node/rules.test.mjs`, 28/28 grün): letzte Hand = hinterster, Wechsel bei 0,6 m Vorsprung nach
genau 0,30 s, bei 0,4 m nie, kein Flackern bei ±0,3 m Pendeln, 0,25 s Überholen zählt nicht; Torraum-Grenzen (3,9 m
drin, 4,1 m draußen, schräg 4,03 m draußen, `?torraum=5`); Hände nur letzte Hand + eigener Torraum; automatischer
Abwurf nach 6,00 s, Gegner kommt beim Halten nicht an den Ball; Abwurf erreicht den Mitspieler; Hechtsprung 1,7 m
seitlich fängt, außerhalb unmöglich; Schnellstart nach 2,6 s mit dem Tormann im Torraum, Uhr steht beim Jubel;
`?anstoss=1`; Halbzeit/Ende nach gespielter Zeit; Golden Goal. Dazu Spieler-Tests 45/45 (inkl. Zack-Zieltabelle),
FIFA 16/16, Aero 24/24, Käfig 18/18.

**Leistung** (headless über Metal/M1, 6 animierte Menschen, Bots spielen, Ton an; Gate Arbeit je Bild ≤ 16 ms):

| Format | Stufe | Auflösung | CPU je Bild Ø / p95 | GPU je Bild Ø / p95 | Draw-Calls | Dreiecke |
|---|---|---|---|---|---|---|
| hoch | 0 | 412×915 (DPR 1) | 5,5 / 7,4 ms | 1,0 / 1,2 ms | 48 | 66.176 |
| hoch | 1 | 618×1372 (DPR 1,5) | 5,6 / 7,7 ms | 2,7 / 3,0 ms | 54 | 69.320 |
| hoch | 2 | 824×1830 (DPR 2) | 6,5 / 8,4 ms | 4,4 / 4,9 ms | 70 | 122.236 |
| quer | 1 | 1372×618 (DPR 1,5) | 6,6 / 8,0 ms | 2,9 / 3,1 ms | 54 | 68.808 |
| quer | 2 | 1830×824 (DPR 2) | 6,4 / 8,1 ms | 4,9 / 5,4 ms | 69 | 120.508 |
| Desktop | 2 | 1280×720 | 6,3 / 8,1 ms | 3,4 / 3,7 ms | 68 | 121.388 |

Gate **bestanden** (schlechtester Fall 13,5 ms). Zur Ehrlichkeit: Der Bildtakt headless ist gedrosselt (75–85 ms),
deshalb holt jedes Bild ~10 Sim-Takte nach und die CPU-Zeit wirkt höher als bei echten 60 fps. Aufgeteilt heißt das:
Avatare 1,1 ms, Rendering 2,5 ms, Simulation ~0,12 ms je Takt. Bei 60 fps (2 Takte) sind das rund 4 ms CPU je Bild
auf dem M1.

**Browser-Tests:** Rauchtest hoch/quer/Desktop grün (Training wie Nacht 1; 3 gegen 3: Bots spielen, Tor →
Jubel → Schnellstart, Tormann-Knöpfe „Abwurf/Abschlag“, Abwurf, Wechsel per Taste, Ton vorgerendert, Knöpfe ≥ 48 px,
keine Überlappung, 0 Fehler), Touch-Test mit echten Touch-Ereignissen grün, Qualitäts-Automatik grün, Live-Test grün.

**Fotos** (`tests/shots/final/n2_*`, mit Vision geprüft): hoch, quer, Desktop jeweils Anstoß, Zweikampf, Tormann mit
Ball im Torraum, Hechtsprung, Tor-Jubel (+ Nahaufnahme), Pause. Gefunden und behoben:
- unsichtbare Menschen: `skeleton.pose()` zerstört quantisierte Skelette
- im Kreis wandernde Hand: der three.js-Mischer schreibt statische Spuren nicht neu, dadurch addierten sich prozedurale Drehungen auf
- Tormann-Arme über Kreuz über dem Ball
- Stemm-Neigung mit falschem Vorzeichen (lehnte sich *mit* der Bewegung)
- Handschuhe wie Tennisbälle
- „Eigentor“ ohne Torschützen
- Mensch startete als Tormann statt in der Mitte

## Offene Punkte / Grenzen
- **Echtes Handy ungetestet**, Leistung nur headless gemessen.
- **Viele Tore** (Ø 15,6 in 8 min zwischen Bots): Käfig-Fußball mit Direktabnahmen aus 4–7 m. Wenn es Peter zu viel
  ist, kann ich die Tormänner verstärken oder die Bots vorsichtiger schießen lassen.
- **Stärke 1 vs. 2** unterscheidet sich eher mäßig (60 % Siege), 3 ist klar stärker.
- **Start/Stopp/Drehen-Clips** sind konvertiert, im Spiel aber durch Lauf-Blend + Stemm-Pose ersetzt. Die
  Rocketbox-Clips dauern 0,6–2,4 s, die zackige Bewegung ist schneller. **Schuss, Pass, Fangen, Hechten, Abwurf** sind
  prozedurale Posen, die sauberen Clips kommen mit Mixamo in Nacht 4.
- Bandenpass: Die Abprall-Kennzahl ist gemessen (inkl. Rollspin), gezieltes **Effet** für Bandenpässe nutzen die Bots
  noch nicht (passt zu 2b).
- **Hochformat:** Beim Anstoß steht der eigene Tormann ganz unten hinter dem Pass-Knopf. Sobald es aufs Tor geht,
  folgt die Kamera dem Ball und der Torraum ist frei.
- Rufe sind Formant-Synthese, sie klingen eher nach fernen Stimmen als nach Aufnahmen. Die Trikots von
  Sports_Male_02/03 tragen einen fiktiven Rocketbox-Sponsor („FYA Motors“), vorn verdeckt ihn das Leibchen.
- Der menschliche Tormann fängt Bälle auf den Körper (≤ 55 cm) automatisch (`?fanghilfe=0` aus). Volle Reichweite
  und Hechtsprung gibt es nur mit den Knöpfen.

## Bitte am Android-Handy testen
1. **Zackig?** Laufen, dann Stick scharf um 90° bzw. 180° drehen, einmal mit und einmal ohne Sprint. Fühlt sich das
   jetzt nach Mensch an statt Auto? Zum Vergleich `?zack=0`, feiner mit `?stemm=14` (weicher) oder `?stemm=18`.
2. **Mit Ball Haken schlagen:** Kommt der Ball im Stemmschritt mit? Sieht man das Stemmen (Körper lehnt sich zurück)?
3. **Leibchen am Handy:** Orange und Blau sofort unterscheidbar, hoch und quer? Wer ist die letzte Hand (leuchtende
   Handschuhe, Ring)?
4. **Tormann spielen:** Wenn der Ball aufs eigene Tor kommt, wechselst du oft zum Tormann. Werden die Knöpfe grün
   („Fangen/Hechten“)? Probiere Fangen halten, Hechten tippen (mit Stick-Richtung) und mit Ball Abwurf bzw. Abschlag.
   Zeigt die Leiste die 6 s?
5. **Spielgefühl gegen Bots:** `?bots=1` (leicht), Standard 2, `?bots=3`. Sind Tore/Schüsse zu häufig? Nutzen die
   Bots die Bande sichtbar?
6. **Wechsel:** Passt der automatische Wechsel, oder springt er zu oft? Hilft **⇄**?
7. **Ton:** Knall an der Bande, Netz, Pfosten, Vögel/Verkehr im Hintergrund. Schalte ihn im Pause-Menü aus und wieder
   an. Ist es zu laut oder zu leise?
8. **Flüssig?** Ruckelt es mit sechs Menschen? Die Version steht unten im ☰-Menü. Zur Not `?q=0`.
9. Nach einem Tor: Jubel, alle laufen zurück, dein Tormann bzw. der gegnerische hat den Ball. Ist der Schnellstart zu
   schnell oder zu langsam (`?anstoss=1` zum Vergleich)?

## Vorschlag Nacht 3 – Multiplayer
1. Lobby mit 3 Wörtern (Wortliste wie Spielebox), Platzwahl Orange/Blau, freie Plätze füllen die Bots aus Nacht 2
   (gleiches Eingabe-Format wie der Mensch → Bot-Übernahme bei Abbruch ohne Sonderweg).
2. Host-authoritativ mit 120 Hz, Zustand 30×/s über einen eigenen unzuverlässigen DataChannel
   (`ordered:false, maxRetransmits:0`), Trystero-Actions nur für Lobby und Ereignisse. Der Sim-Kern ist
   deterministisch und ohne DOM, also sofort netzfähig.
3. Client-Vorhersage für den eigenen Spieler **und den Ball** (Nachrechnen ab dem Host-Zustand, bei 100 ms ~12 Takte;
   mit ~10 µs je Takt billig), andere Spieler interpoliert, Korrekturen über 100–150 ms geglättet.
4. Letzte Hand/Torraum/Schnellstart laufen beim Host (`rules.js`). Clients bekommen Rollen, Ereignisse und die
   Spielzeit mit, Ton und Animation laufen lokal aus den Ereignissen.
5. Gate: Node-Netzsimulation (80 ms Ping, 2 % Verlust, Jitter), 2-Minuten-Spiel ohne Absturz, Korrektur p95 < 10 cm;
   Ping-Anzeige aus `getStats()`; danach Test Peter gegen ein zweites Gerät.
