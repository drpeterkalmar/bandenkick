# Bandenkick n8 – Bericht (Tempo, Knöpfe, Pässe)

Auftrag (Peter 26.10.2026): „Halbzeitlänge halbieren, Laufgeschwindigkeit erhöhen, Pässe fixen (gehen irgendwohin), Buttons größer
machen, und was macht dieser komische Pfeil-Knopf?“ – Nachtrag: „Spielerwechsel braucht keiner“. Etappe 1 = Tempo, Halbzeit,
Knöpfe, Wechsel (schnell live); Etappe 2 = Pässe (erst messen, dann reparieren). Alles gilt für Mensch und Bots.

„n7“ = Stand 0.6.0 (af63ccb). Messwerkzeuge laufen ohne Browser (Node), dazu Browser-Tests mit echten Touch-Ereignissen.

---

## Etappe 1 – Release VERSION_N8E1

### Halbzeit 2 min
`P.dauer` 4 → 2 (`?dauer=4` = alt). Die Bot-Messwerkzeuge (`selfplay.mjs`, `n7_probe`, `wucht_probe`, `botpass_probe`,
`dribble_probe`, `keeper_probe`, `keeper_hold_probe`) spielen weiter 2 × 4 min, damit alle Werte „je Spiel“ mit n7 vergleichbar
bleiben (`?dauer=` übersteuert).

### Lauftempo 7,0 m/s, Antritt wächst mit
`vEin` 6,0 → 7,0 m/s (+17 %), für alle. Die Antrittskurve lief bisher immer gegen 7,5 m/s (altes Sprinttempo). Mit 7,0 als
Höchsttempo hätte der Spieler dann 2,4 s bis zum vollen Tempo gebraucht und wäre auf den kurzen Wegen im Käfig kaum schneller
gewesen (+2,6 % Weg in 2 s). Neu: Ziel der Antrittskurve = `antrittF` × Lauftempo (1,15 → 8,05 m/s).

| Antritt (gerade, ohne Ball) | n7 (6,0) | nur `?ein=7` | **n8 (7,0, Antritt × 1,15)** | × 1,25 (alles genau +17 %) |
|---|---|---|---|---|
| 0 → 4 m/s | 0,60 s | 0,60 s | **0,53 s** | 0,47 s |
| 0 → 6 m/s | 1,38 s | 1,38 s | **1,16 s** | 0,96 s |
| 99 % Höchsttempo | 1,35 s | 2,36 s | **1,74 s** | 1,35 s |
| Weg in 2 s | 9,18 m | 9,42 m | **10,09 m (+10 %)** | 10,71 m |

× 1,25 wäre „alles genau 17 % schneller“, der erste Schritt mit 0,47 s aber hektisch; die Bots pressen damit härter (Pässe im Lauf
noch 2 Punkte schlechter), und in der Volley-Station erliefen die Spieler Dropkick- und Flugkopfball-Bälle. 1,15 liegt im Fenster
des Antritts-Tests (0 → 4 m/s in 0,5–0,7 s). Wenden unverändert (Kurve 13 m/s², Radius bei 7 m/s 3,8 m; Stemmschritt-Tabelle aus
Nacht 2 grün). Regler: `?ein=`, `?antrittF=`, `?vAntritt=` (fest in m/s); `?ein=6&vAntritt=7.5` = n7.

Folgen, die mitgeprüft und angepasst wurden:
- **Volley-Station:** der Flugkopfball-Ball kommt 2,6 statt 2,2 m neben dem Spieler (sonst erläuft er ihn → Seitfallzieher); alle
  sechs Techniken werden wieder gewählt.
- **Dribbel-Parcours (Test):** das Skript führt mit festem Tempo (4,5 m/s wie n7) statt mit fester Stick-Stellung ¾ – mit ¾ × 7 m/s
  verpasste es Slalom-Tore (13,0 s inkl. Strafe statt 8,0). Ein Kind nimmt den Daumen dann etwas zurück.
- **Fehler behoben:** In der Dribbel-Übung zählte ein zweites Tor-Ereignis (Ball lag nach dem Treffer noch einmal hinter der Linie)
  die nicht erreichten Hütchen-Tore doppelt (+3 s Strafe zu viel). Fiel erst mit 7 m/s auf.
- **1 gegen 1 (Tormann E1):** mit 7 m/s holt der zurücklaufende Verteidiger den Stürmer öfter ein (vereitelt auch ohne Herauslaufen
  63 %); die Tormann-Mechanik wird im Test deshalb im n7-Tempo geprüft, n8 steht als Info daneben (Stufe 1–3: 33/65/73 %).
- **Geben und Gehen (Test):** der Lauf ist mit 7 m/s nach ≈ 2 s am Ziel; gemessen wird jetzt der größte Vorsprung (4,9 m) statt
  des Abstands nach genau 2,5 s.

Bot-Selbstspiel Stufe 2 gegen 2 (40 Spiele à 2 × 4 min, `n7_probe.mjs 40 "" st2`):

| Größe | n7-Tempo | n8 |
|---|---|---|
| Tore je Schuss | 31,6 % | 32,2 % |
| Schüsse / Tore / Pässe je Spiel | 56,6 / 17,9 / 92,4 | 59,8 / 19,3 / 94,5 |
| Bot-Pässe kommen an / abgefangen | 64 / 32 % | 65 / 30 % |
| Ballverluste beim Führen je Minute | 1,63 | 1,87 |
| Grätschen je Spiel (Ballgewinn) | 14,3 (67 %) | 12,8 (61 %) |
| Hechter je Spiel, Nachschuss-Tore | 24,9, 23,5 % | 25,0, 26,9 % |
| Hänger / Numerik | 0 / 0 | 0 / 0 |

### Pässe mit 7 m/s (Pass-Probe, 500 Pässe je Variante, echte Gesten, Weg frei beim Abspiel)

| | n7 (6,0) | n8 Etappe 1 (7,0) |
|---|---|---|
| stehend | 92,6 % | 91,3 % |
| laufend (Stick ¾) | 86,1 % | 81,2 % |
| voller Stick | 84,1 % | 77,3 % |
| alle Pässe (auch Weg zu) | 75,5 % | 71,5 % |

Im Lauf werden Pässe mit 7 m/s schlechter – das hatte n7 schon gezeigt (deshalb damals 6,0). Etappe 1 geht trotzdem mit 7,0 live,
weil Etappe 2 genau dort ansetzt; der Pass-Test hat für diese Zwischenversion die Grenzen laufend/voller Stick 75/72 % statt 85/80 %.

### Größere Knöpfe, kein ⇄
Schuss 100 → **128 px**, Pass 80 → **104 px** (+28 / +30 %), Symbol und Schrift größer. Der ⇄-Knopf ist weg (`?wechsel=1` = da,
dann 56 px links neben dem Schuss bzw. darüber). Hochformat: Schuss in der Ecke, Pass schräg darüber auf dem frei gewordenen Platz
(die untere Mitte bleibt dem Stick); Querformat: Pass links neben dem Schuss.

| Pixel 7 | Schuss: Mitte ↔ Ecke | Pass: Mitte ↔ Ecke | Abstand der Knopfränder | in die linke Hälfte (Stick) |
|---|---|---|---|---|
| hoch n7 | 143 px (100 px) | 198 px (80 px) | – | 20 px (Pass) |
| **hoch n8** | **119 px (128 px)** | **250 px (104 px)** | **21 px** | **0** |
| quer n7 | 134 px | 198 px | – | 0 |
| **quer n8** | **134 px** | **224 px** | **19 px** | **0** |
| hoch 375 × 740 (schmal) | 119 px | 250 px | 21 px | 0 |

Geprüft mit `tests/n8_hud.py` (Rechtecke überlappen nicht, Abstand der Ränder ≥ 18 px = beide Aufladeringe frei, der Grundkreis des
Sticks berührt in Ruhelage und an neun typischen Daumenlagen keinen Knopf, ⇄ nur mit `?wechsel=1`). Fotos `tests/shots/n8/hud_neu_*.jpg`,
selbst angesehen: nichts verdeckt Spieler im Bild, Ring und Beschriftung „Schuss“ passen, Pass sitzt im Hochformat über dem Schuss.

### Spielerwechsel automatisch (belegt)
Die Automatik gab es schon (`Game.autoSwitch`): nach dem eigenen Pass sofort der Empfänger, sonst der Mitspieler mit der kürzesten
Laufzeit zum Ball (Ball 0,3 s vorausgesagt, Hysterese 0,18 s, frühestens 0,6 s nach dem letzten Wechsel; nicht weg, solange man den
Ball führt oder ein Tipp vorgemerkt ist), beim Ball in der Hand des eigenen Tormanns der Tormann. Neu ist nur der Beleg
(`tests/node/wechsel.test.mjs`, 6 ganze Spiele mit einem Skript-Menschen, der nie wechselt):

| Messung | Wert |
|---|---|
| Ball frei bzw. beim Gegner, Mitspieler näher: Wechsel ohne Eingabe | nach 0,008 s |
| eigener Pass → Steuerung beim Empfänger | 446 von 446 (10 weitere gleich am Fuß geblockt) |
| automatische Wechsel je Minute | 37 |
| Ball frei/beim Gegner: Gesteuerter ist der ballnächste eigene Spieler (± 0,2 s) | 90 % |
| längste Zeit, in der ein Mitspieler klar näher war (≥ 0,5 s Laufzeit) | 0,59 s |
| Tastatur C/Tab, Gamepad Y | wechseln weiter |

### Tests Etappe 1
- Node alle grün (`node tests/node/run_par.mjs 6`), neu `wechsel.test.mjs`; angepasst wie oben beschrieben (`player.test`
  Antrittsfenster 0 → 6 m/s, `air`-Station, Parcours-Skript, `tormann_e1` 1 gegen 1, `traumpass` Geben und Gehen, Messbasis 2 × 4 min).
- Browser: `smoke.py` grün (Tempo-Messung mit mehr Anlauf, ohne Auto-Wechsel während der Messung), `test_touch.py` grün,
  `n8_hud.py` grün.
- `pass_touch.py` (echte Touch-Ereignisse) war **schon bei n7 rot** (7/12 und 8/12): der Test ließ per CDP den Stick-Finger statt des
  Pass-Fingers los, der Pass-Knopf blieb 1 s „gehalten“. Behoben → hoch 11/12, quer 12/12.

### Handy-Test für Peter (Etappe 1)
1. Spiel starten: oben steht **2:00**. Laufen fühlt sich flotter an? Zum Vergleich `?ein=6&vAntritt=7.5` (wie vorher) oder `?ein=6.5`.
2. Rechts unten nur noch **Schuss** (groß, in der Ecke) und **Pass** (darüber bzw. quer links daneben) – gut mit dem Daumen
   erreichbar, nichts liegt auf dem Stick?
3. Ohne ⇄: Steuerst du immer den Richtigen? (Nach deinem Pass sofort den Empfänger, sonst den, der am schnellsten am Ball ist.)
   Falls doch gewünscht: `?wechsel=1`.
