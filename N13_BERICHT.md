# Bandenkick n13 – Gummiwände, Spielgefühl, niedlichere Tiere, Schusskegel + Spektakel, Zufallsteams (08.11.2026, Version 0.10.0)

**Am Handy einmal neu laden** (bzw. die App einmal schließen und öffnen), dann ist alles da. Live: https://drpeterkalmar.github.io/bandenkick/

Jede Etappe ist einzeln fertig geworden und live gegangen: 0.9.2 Gummiwände · 0.9.3 Spielgefühl · 0.9.4 Tiere · 0.9.5 Schusskegel/Spektakel ·
0.10.0 Zufallsteams. Jeder Teil hat einen eigenen Schalter, mit dem du den alten Stand vergleichen kannst.

| Wunsch | Schalter für den alten Stand |
|---|---|
| Unsichtbare Gummiwände seitlich und oben | `?gummi=0` |
| Replay-Zoom weiter weg | `?replayweit=1` |
| Fan-Cam standardmäßig aus | `?fancam=1` = Fan-Cam (oder Pause-Menü) |
| Action-Szenen standardmäßig aus | `?action=1` = an (oder Pause-Menü) |
| Ballmagnet stärker | `?magnet=2.4` |
| Schwerkraft −10 % | `?g=9.81` |
| Tiere noch niedlicher | `?tierform=1` (0.9.1), `?tierform=0` (0.7.0) |
| Schusskegel, Megaferse, Lupfer, Jonglier-Fallrückzieher | `?schusskegel=0`, nur Fallrückzieher aus: `?fallrueck=0` |
| Zufallsteams + Tiernamen | `?zufallsteams=0` |

## 1. Gummiwände (zuerst, Peter 07.11. abends)
Ohne Dach verlängern unsichtbare, elastische Wände Bande und Netz bis 12 m, darüber eine unsichtbare Decke auf 12 m. Sie federn mit
Stoßzahl 0,65 zurück, kaum Reibung (Effet bleibt zu gut der Hälfte), kein Bild, kein Ton. Ursache gleich mit behoben: der Abschlag des
Tormanns flog immer mit voller Kraft (21 m/s, ≈ 30 m) – jetzt so stark, dass er im Feld landet.

12 Bot-Spiele (2 × 4 min), ohne → mit: **Aus-Bälle 30,8 → 0 je Spiel**, Abwürfe/Abschläge ins Aus 15,9 → 0 %, Unterbrechungen 4,9 → 2,0 je
Minute, Tore/Schuss 33 → 31 % (Streuung), höchster Ball 8,6 m. Abgefangene Abwürfe 8,3 % (früher mit Dach 8,5 %). Dazu: auch ohne Dach greifen
die Netze an den Fugen übereinander (800 harte Eckschüsse: 15 → 0 draußen). Die Torwartball-Regel bleibt nur als Sicherheitsnetz.

## 2. Spielgefühl (Nachtrag 1)
- **Replay-Zoom:** Kontakt-Zoom und Fan-Edit-Makro doppelt so weit weg, Blick zur Körpermitte. In 3 Bot-Toren geprüft: bei 0.9.1 nur Ball
  und Bein im Bild, jetzt Schütze und Ball ganz (`tests/shots/n13/replay_weit_quer.jpg`).
- **Fan-Cam aus:** Wiederholung standardmäßig „Normal“ (TV-Kamera, Einschlag in Zeitlupe). Pause-Menü: Normal / mit Fan-Cam / Aus.
- **Action-Szenen aus:** standardmäßig aus, im Pause-Menü wählbar. Beide Einstellungen werden neu gemerkt (deine alte Wahl aus 0.9.1 zählt nicht mehr).
- **Ballmagnet:** zuerst gemessen, woher die Ballverluste kommen: ¾ im Zweikampf, meist weil der Ball etwas zu weit (> 0,9 m) oder zu schnell
  vorgelegt war, und ein Viertel aller Verluste waren Tormänner, die den Ball vom Fuß des Dribblers griffen. Jetzt schirmt der Führende bis
  1,3 m vor dem Fuß und bei schnelleren Vorlagen ab, und der Tormann greift erst nach 0,8 s in einen Ball am Fuß. Die Feder selbst blieb (stärker
  machte den Slalom langsamer). Bot-Spiele (48 Spiele): **Ballverluste beim Führen 1,29 → 1,02 je Spielminute (−21 %), je Minute Ball am Fuß
  −33 %**; Grätschen erobern weiter (7,9 → 8,1 je Spiel), Slalom-Parcours gleich schnell (8,33 s). Das Ziel −25 % je Spielminute wurde knapp
  verfehlt, weil die Bots den Ball jetzt länger führen (weniger riskante Pässe); je Minute am Ball ist es deutlich mehr.
- **Schwerkraft 8,8 statt 9,81** für Ball und Sprünge; alles, was damit rechnet (Pass-/Schussplanung, Bots, Tormann, Effekte), zieht mit. Hohe
  Pässe fliegen dadurch länger – die Bots passen deshalb etwas vorsichtiger: Bot-Pässe kommen an 84 → 89 %, abgefangen 15 → 9 %, **hohe Pässe
  beim Mitspieler in Volley-/Brust-/Kopfhöhe 70 → 77 %**, dafür 54 → 45 Pässe je Spiel. Tore je Schuss 31 → 31 %. Ball verlässt den Käfig nie.

## 3. Tiere noch niedlicher (Nachtrag 2)
Zweite Stufe Kindchenschema für alle sechs Tiere (und die Zuschauer, Trainingspuppe mit größerem Kopf): Kopf × 1,3 statt 1,11, Ärmchen und
Beinchen × 0,62 statt 0,75 und etwas dicker, rundes Bäuchlein, große Knopfaugen tiefer im Gesicht, kurze Schnauze, runde Pfoten. Nur Optik.
Damit die Tatzen beim Laufen nicht gleiten, bekam der Laufzyklus einen eigenen Schrittfaktor; der gehaltene Ball liegt näher an den kürzeren
Ärmchen, beim Seitfallzieher kippt die Hüfte tiefer an den Ball. Gleich viele Dreiecke, gleiche Dateigröße, kein zusätzliches Laden.
Alle Bewegungen geprüft (Laufen, Sprint, Schuss, Grätsche, Hechtsprung, Halten, Jubel, Fallrückzieher, Kopfball): keine Füße im Boden, kein
Kopf in der Schulter, keine Ärmchen durch den Bauch. Vorher/Nachher: `tests/shots/n13/tiere_vorher_nachher.jpg`, Bewegungen: `tiere_bewegungen.jpg`.
(Etappe 6 „Dach sichtbar“ entfiel laut deiner Nachricht.)

## 4. Schusskegel + Spektakel (Nachtrag 3 und 4)
**So habe ich es ausgelegt** (bitte korrigieren, wenn du es anders meinst): Gemessen wird der Winkel zwischen Lauf- (ab 1,5 m/s) bzw. Blickrichtung
und der Richtung zur Tormitte. Liegt das Tor im Kegel ±60° (also 120°) vor dir, schießt der eine Tipp wie bisher. Außerhalb wählt er selbst:
- **Lupfer-Pass** zu einem freien Mitspieler höchstens 9 m vor dem Tor, nur über einen sicheren hohen Weg – der nimmt ihn direkt aus der Luft
  (Volley, Seitfall-, Fallrückzieher), Einblendung „WUMMS!“.
- **Rücken zum Tor** (≥ 120°): wenn kein Gegner vor dem Treffpunkt bei dir wäre (mit seiner echten Antrittskurve gemessen, der Tormann im Torraum
  zählt nicht), der **Jonglier-Fallrückzieher**: Fußspitze lupft den Ball senkrecht auf 2,2 m, nach 1,1 s Fallrückzieher über den Kopf aufs Tor,
  liegen, aufrappeln – „FALLRÜCKZIEHER!“, selten „RIVALDO!“. Erobert ein Gegner den Ball vorher, bricht der Trick sauber ab.
- Ist ein Gegner zu nah: die **Megaferse** – Fersenschuss rückwärts mit 27 statt ≤ 19 m/s, „MEGAFERSE!“.
- Sonst (Tor seitlich, niemand besser postiert): blitzschnelle Drehung zum Tor, dann der normale Schuss.

Torquote je Versuch gegen den Tormann (Szenen-Probe, Tormann Stufe 2): **Fallrückzieher 26–31 %**, normaler Schuss im Kegel 23–26 %, **Megaferse
≈ 20 %**, **Lupfer → Direktabnahme 23–27 %** – spektakulär, aber nicht übermächtig. Dafür ist der Tormann vom Trick kurz überrascht (0,12 s);
ohne das hielt er fast jeden Fallrückzieher, weil er sich während des Hochlupfens in Ruhe stellen konnte.
Comic: große Einblendung mit Speed-Linien und eine kurze Zeitlupe mit Zoom genau im Trefferpunkt – auch wenn die Action-Szenen aus sind, weil es
kurz ist; „Blitze reduzieren“ zeigt sie ohne Linien und ohne Ruck. Die Wiederholung zeigt den Fallrückzieher mit ganzem Körper und Ball.
Bots: Megaferse ≈ 5 je Spiel, Lupfer ≈ 1 je Spiel; den Fallrückzieher wählen sie selten bis nie – mit dem Rücken zum Tor stehen sie im Spiel fast immer
unter Druck (in allen gemessenen Fällen war ein Gegner rechtzeitig da). Selbstspiel: Tore/Spiel 20,1 → 19,3, Pass-Abfangquote 8,5 → 8,9 % (Streuung).
Fotos: `tests/shots/fallrueck/fallrueck_quer.jpg` (Lupfen, Ball oben, Schere im Kontakt, Landung, Wiederholung), `tests/shots/n13/spektakel_quer.jpg`
(je 3 × Megaferse, Lupfer → Direktabnahme, Schuss im Kegel).

## 5. Zufallsteams + Tiernamen
Bei jedem neuen Match werden die sechs Tiere gemischt: drei nach Orange, drei nach Blau, auch welches du steuerst; Halbzeit und Tor mischen nicht.
Leibchen und Rückennummer folgen der Mannschaft (Teddy kann Blau tragen) – zur Laufzeit umgefärbt, ohne Neuladen und ohne Ruckler. Beim Anpfiff
steht kurz „Du bist Fuchs“ mit der Aufstellung. Namen in Tor-Einblendung, Wiederholung und Fan-Edit („PANDA (DU)“); mit `?figuren=menschen`
bleiben die alten Namen. Einen Online-Modus gibt es im Spiel nicht – das Mitschicken der Verteilung entfällt.
Geprüft: 20 Matches per Seed → jede Verteilung 3/3, jedes Tier in beiden Farben; im Browser zwei Matches mit verschiedener Verteilung, Leibchenfarbe =
Mannschaft, Tiername in der Wiederholung, `?zufallsteams=0` = feste Besetzung, 0 Seitenfehler (`tests/shots/zufallsteams/zufallsteams_quer.jpg`).

## Tests
- Node: alle Testdateien grün (`node tests/node/run_par.mjs 6`), neu `tests/node/n13.test.mjs` (Gummiwände, Replay, Magnet/Schwerkraft gegen
  0.9.2, Schusskegel/Spektakel, Zufallsteams). Die Spielgefühl-Messungen laufen wieder im Standard-Käfig ohne Dach; Ziele, die sich dadurch oder
  durch vorsichtigere Bot-Pässe verschoben, habe ich mit Begründung im Test neu gesetzt (Eck-Kontakte ≤ 0,8 statt 0,73, Luftkontakte ≥ 1,4 statt
  1,5 × 0.8.0, Traumpass-Stichprobe 32 statt 20 Spiele, zwei n12-Fenster wegen Streuung bei 16 Spielen).
- Browser: Rauchtest grün (Standard und `?figuren=menschen`), Zufallsteams-Prüfung grün, Live-Prüfung je Etappe grün; 0.10.0 live geprüft
  (Build ff2f2d2692: Version, Boot hoch/quer ohne Fehler, Schuss, PWA, offline).
- Neue Werkzeuge: `tests/node/n13_gummi_probe.mjs`, `tests/node/n13_spektakel_probe.mjs`, `tests/n13_replay_bilder.py`,
  `tests/n13_spektakel_bilder.py`, `tests/n13_zufallsteams_bilder.py`.

## Offen / zum Ausprobieren
1. Fallrückzieher: gefällt dir der Ablauf (1,1 s, Ball auf 2,2 m)? Wenn er öfter kommen soll, kann der Abstand zu den Gegnern lockerer werden.
2. Megaferse kommt bei den Bots oft (≈ 5 je Spiel) – zu viel?
3. Ballmagnet: −21 % je Spielminute statt −25 % – reicht das Gefühl am Handy?
