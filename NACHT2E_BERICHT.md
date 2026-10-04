# Bandenkick – Bericht Nacht 2e „Ton aus, Torwart schnell, kein Rückpass, Passsystem repariert“

Live: https://drpeterkalmar.github.io/bandenkick/ (nach jeder Etappe gepusht, live geprüft: HTTP 200, Version = lokal,
0 Fehler, PWA offline). Grundlage: Peters Wünsche vom 03.10. mittags. Alles aus Nacht 2d bleibt (Wucht, Magnet, Hechten,
Fallrückzieher, Wiederholung, Eigentor-Fix, Anstoß in der Mitte).

**Am Handy:** Die App einmal ganz schließen und neu öffnen (PWA), dann ist die neue Version da. Im Pause-Menü unten steht
die Version.

## Was neu ist (4 Etappen, je ein Commit)

1. **Ton komplett aus** (`7d7403f`) – „es brutzelt noch immer ab Spielstart“
   - `src/audio/sound.js` ist ein stummer Platzhalter mit der alten Schnittstelle. Kein AudioContext, keine vorgerenderten
     Klänge, keine Umgebungsschleife (der Verkehr lief ab dem ersten Tippen dauernd), keine Effekte – auch nicht im Menü,
     im Training und in der Wiederholung. Kein `navigator.audioSession`, keine `<audio>`-Elemente.
   - Der Knopf „Ton: an/aus“ im Pause-Menü und die Ton-Zeile in den Credits sind weg (keine toten Knöpfe).
   - Prüfung: `stumm.test` sucht im ausgelieferten Code nach Audio-Erzeugern (0 Treffer). Im Browser zählt ein Wächter
     jeden Versuch, Audio zu erzeugen: 0 in Menü, Spiel, Training, Wiederholung (hoch, quer, Desktop).
   - Hinweis: three.js enthält eigene Audio-Klassen; sie werden nie benutzt (Test prüft das).
2. **Tormann gibt den Ball schnell weiter** (`99dac53`) – „nicht so lange in die Hand nehmen“
   - Bot-Tormann: nach 0,3–0,7 s Abwurf auf einen sicher freien Mitspieler; ab 0,9 s auch auf einen weniger freien, aber
     nie in einen Weg, den ein Gegner abfangen kann; spätestens nach 2 s weiter Abschlag in die freiere Hälfte (dort, wo
     weniger Gegner stehen). Nach einem Hechtsprung wirft er gleich nach dem Aufstehen.
   - Zeitregel 6 → 3 s (Leiste im HUD läuft mit). Ohne freien Mitspieler gibt es bei 3 s einen Abschlag statt eines Wurfs in
     den Gegner.
   - Auto-Torwart des Menschen: wirft nach 1 s ohne Eingabe ab (vorher 2 s), ohne freien Mitspieler 1 s später Abschlag.
   - Regler `?halten=` (Sekunden bis zum Abwurf, Standard 1,2), `?halten=0` = Nacht 2d.
3. **Kein Rückpass** (`fb80cf6`) – „erlaube keinen Rückpass“
   - Der eigene Tormann (letzte Hand im Torraum) ist kein Pass-Empfänger mehr, weder für dich noch für die Bots.
   - Zeigt der Stick aufs eigene Tor, geht der Pass zum nächsten Mitspieler im erweiterten Kegel (±70°), sonst seitlich in den
     freien Raum oder über die Bande – nie aufs eigene Tor zu.
   - Regel wie im echten Fußball: Spielt ein Mitspieler dem Tormann den Ball absichtlich zu (Pass, Schuss, Befreiung Richtung
     eigenes Tor oder nah am Torraum; Kopfball zählt nicht), nimmt er ihn nicht in die Hand, sondern spielt ihn mit dem Fuß.
     Kein Freistoß, nur einmal je Spiel der Hinweis „Rückpass – keine Hände“. Berührt danach ein anderer Spieler den Ball
     (auch ein Abpraller am Gegner), darf er wieder fangen.
   - Abwurf annehmen bleibt wie bisher. `?rueckpass=1` = alt.
4. **Passsystem repariert** (`680e869`) – „die Pässe gehen irgendwo hin“ (Abschnitt unten). `?passfix=0` = Nacht 2d.

## Messwerte vorher/nachher

**Tormann mit Ball** (6 Bot-Spiele à 2 × 4 min, Stufe 2, `keeper_hold_probe.mjs`):

| | Nacht 2d | Nacht 2e |
|---|---|---|
| Haltezeit Median | 3,4 s | **1,1 s** (Ziel ≤ 1,2 s) |
| Haltezeit 90 % / längste | 4,4 s / 4,4 s | **2,0 s / 2,0 s** (Ziel ≤ 2 s) |
| abgefangene Abwürfe/Abschläge | 20,5 % | **9,4 %** (darf nicht steigen) |
| Zwangsabwurf (Zeitregel) | 0 | 0 |
| Pässe zum eigenen Tormann im Torraum | 90 | **0** |
| Ball nach Rückpass in die Hand genommen | 69 | **0** |

- Der Rückpass-Test (`rueckpass.test`) misst zusätzlich 6 Bot-Spiele mit `?rueckpass=1` als Vergleich: 137 → 0 Rückpässe,
  94 → 0 Hand-Aufnahmen.
- Tormann-Stufen (Tore je Schuss, je 48 Spiele): **44 / 28 / 21 %** (Nacht 2d: 47 / 31 / 22 %). Das Tor-Fenster bleibt.

**Passsystem** – Messprobe `tests/node/pass_probe.mjs`: echtes 3 gegen 3 mit Bots, Gesten wie am Handy über den echten
Gesten-Parser, je Variante 200 Pässe, fester Seed:

- Gesten: Tipp oder Halten, mit Stick (Daumenfehler σ 8°) oder ohne (Blick), stehend, laufend oder im Sprint.
- Danach den Daumen loslassen oder auf dem Stick lassen (wie Kinder es tun).
- „Gemeint“ ist der Mitspieler, auf den Stick bzw. Blick beim Druck zeigt.
- „Weg frei“: Beim Abspiel steht kein Gegner näher als 1,5 m am Weg, und der Empfänger hat 1,5 m Platz.

| Variante | kommt an, Weg frei: vorher → nachher | alle Pässe | Empfänger = gemeint | abgefangen |
|---|---|---|---|---|
| steht, Tipp, Daumen los | 77 → **95 %** | 71 → 86 % | 97 → 99 % | 17 → 13 % |
| steht, Halten, Daumen bleibt | **19 → 92 %** | 18 → 87 % | 99 → 100 % | 65 → 14 % |
| ohne Stick, Tipp | 73 → **90 %** | 67 → 84 % | 97 → 100 % | 24 → 16 % |
| ohne Stick, Halten | 71 → **91 %** | 63 → 83 % | 95 → 99 % | 25 → 16 % |
| läuft, Tipp, Daumen los | 49 → **84 %** | 36 → 61 % | 85 → 95 % | 41 → 32 % |
| läuft, Tipp, Daumen bleibt | **15 → 88 %** | 9 → 68 % | 86 → 92 % | 48 → 22 % |
| läuft, Halten, Daumen bleibt | **14 → 92 %** | 11 → 73 % | 88 → 97 % | 37 → 22 % |
| Sprint, Tipp, Daumen los | 67 → **86 %** | 49 → 64 % | 85 → 89 % | 29 → 29 % |
| Sprint, Tipp, Daumen bleibt | **9 → 82 %** | 9 → 69 % | 86 → 92 % | 46 → 27 % |
| Sprint, Halten, Daumen bleibt | **10 → 82 %** | 7 → 67 % | 81 → 92 % | 54 → 22 % |
| **gesamt** | **45 → 89 %** | **37 → 75 %** | 91 → 96 % | 38 → 21 % |

- Zusammengefasst (`passsystem.test`), Weg frei: stehend 59 → **92 %** (Ziel ≥ 90), laufend 26 → **88 %**, Sprint 29 → **83 %**
  (Ziel ≥ 80).
- Abflug = Vorschau: ohne Streuung p90 **0,6°** (Ziel ≤ 3°); mit Streuung p90 2,3 → 1,6°.
- Pässe, die gar nicht zustande kamen: 12 → 7 %. Der Rest sind echte Ballverluste, weil der Gegner den Ball direkt nach dem
  Tipp wegspitzelt.
- **Bot-Pässe im Bot-Spiel** kommen an: 33 → **60 %**. Der Passgeber spielt seinen Pass selbst wieder: 22 → 3 %.
- **Am Bildschirm mit echten Touch-Ereignissen** (`tests/pass_touch.py`, Pixel 7): Stick zum Mitspieler, Pass tippen, Daumen
  bleibt 1 s drauf → hoch 11/12 und 12/12 (zwei Läufe), quer 12/12.

### Ursachen der Pass-Fehler (nach Größe)

1. **Der Daumen steuert nach dem Pass den Empfänger.**
   - Nach dem Pass wechselt die Steuerung zum Empfänger. Bleibt der Daumen in Pass-Richtung auf dem Stick, läuft der
     Empfänger vom Ball weg. Der Ball kommt nie an oder der Gegner nimmt ihn.
   - Vorher kamen so nur 9–19 % an.
   - Jetzt zählt der Stick, solange der Ball unterwegs ist und der Daumen grob in der alten Richtung bleibt, nur zum Zielen
     (Direktpass geht). Gelaufen wird mit der Empfänger-Hilfe.
   - Loslassen oder eine deutlich andere Richtung (> 50°) gibt die Steuerung sofort zurück.
2. **Der Passgeber jagt seinem eigenen Pass nach.**
   - Die Bot-Logik sah den Passgeber nach einem weichen Pass weiter als Ballführer, oder er war am schnellsten am Ball.
   - Dann spielte er den Ball selbst wieder (14 % der Pässe des Menschen, 22 % der Bot-Pässe, auch bei jedem Anstoß).
   - Ein anderer Mitspieler fing 10 % ab.
   - Jetzt gilt: Pass unterwegs → der Empfänger nimmt an. Wer hinter ihm steht, sichert ab; wer vor ihm steht, bietet sich an.
3. **Im Lauf kam der Pass nicht zustande.**
   - Zeigte der Stick beim Tipp nach hinten (Mitspieler hinter dem Läufer), lief der Spieler in Stick-Richtung los und ließ
     den Ball liegen.
   - Oder der Ball rollte beim Drehen kurz weg, die Steuerung sprang zum Mitspieler und der Pass verfiel.
   - Oder aus dem Tipp wurde eine Grätsche, weil ein Gegner näher am vorgelegten Ball war.
   - Jetzt: Mit vorgemerktem Tipp läuft der Spieler zum Ball und dreht sich zum Ziel auf (Innenseite statt langsamer Hacke).
     Er behält die Steuerung, und als Ballführer grätscht der Tipp nie.
4. **Die Empfänger-Wahl überging den gemeinten Mitspieler.**
   - War sein Weg etwas zugestellt, bekam ein anderer im Kegel ±35° mehr Punkte, auch über die Bande. 9–19 % im Lauf
     gingen so zum falschen.
   - Jetzt gewinnt, auf wen der Stick am genauesten zeigt. Nur bei fast gleichem Winkel (< 10°) entscheidet der freie Weg.
   - Ist sein Weg zu, geht der Pass über die Bande **zu ihm**.
   - Zu einem anderen über die Bande nur, wenn der Stick klar aufs Spiegelbild zeigt (nur mit Stick, nicht mit dem Blick).
   - Der beim Tipp gewählte und angezeigte Empfänger bleibt bis zum Kontakt (Hysterese), außer der Stick dreht > 25°.
5. **Abgefangen am Weg.**
   - Vier von fünf abgefangenen Pässen gingen im ersten Wegstück verloren, meist an den Gegner, der den Passgeber presst.
   - Der Empfänger läuft flachen Pässen jetzt entgegen, zum frühesten erreichbaren Punkt der Rollbahn.
   - Pässe kommen etwas zügiger an (8 m: 6,7 statt 5,3 m/s, `?passArr=`).
   - Das bringt nur wenige Punkte. Gegen pressende Bots bleibt ein Pass in den Lauf des Gegners verloren (Spiel, kein Fehler).
6. **Streuung** war klein (p90 2–4°), zählte aber bei 10 m bis 0,7 m. Jetzt 0,8° statt 1,1° Grundwert, im Sprint × 1,3
   statt × 1,6 (`?passNoise=`).
7. **Vorschau ↔ Abflug** wichen ohne Streuung schon vorher kaum ab (p90 ≤ 1°). Das war keine Ursache.

**Ziel-Markierung:**

- Der Ring am Empfänger ist dicker.
- Er bleibt sichtbar und pulsiert, bis der Empfänger den Ball hat. Vorher war er nur ~0,2 s zu sehen, bis zum Kontakt.
- Schon beim Führen zeigt ein schwacher Ring, wer den Pass jetzt bekäme.
- Fotos: `tests/shots/final/n2e_pass_unterwegs_{hoch,quer}.jpg`, `n2e_pass_vorschau_{hoch,quer}.jpg`, selbst angesehen.
  Der Ring ist hoch und quer gut zu sehen. Im Vorschau-Foto hoch steht der Ziel-Mitspieler am linken Bildrand.

## Tests

- `npm test`: **23 Dateien grün**.
  - Neu: `stumm`, `halten`, `rueckpass`, `passsystem`.
  - Angepasst:
    - `rules`/`keeper`/`selfplay`: 3 s statt 6 s, Auto-Torwart 1 s.
    - `keeper`: Tormann-Stufen aus zwei Spielserien statt einer (eine Serie streut ±2–3 Punkte). Die Grenze für langsame
      Schüsse liegt bei 18 % statt 8 %, weil schon Nacht 2d je Seed zwischen 8 und 16 % lag (Stichprobe nur ~60 Schüsse).
- Alle bisherigen Pass-Tests sind grün: Laufweg, Chip, Bande, Kegel, Technik; Übung Bandenpass 3 Sterne.
- 200 Selbstspiele ohne Hänger. Ø 13,9 Tore je Spiel.
- Browser:
  - `smoke.py` und `test_touch.py` hoch, quer und Desktop grün, mit Ton-Wächter (0 Audio-Objekte).
  - `pass_touch.py`: Touch-Pässe; 3 min Spiel, Wiederholung und Training (Doppelpass) hoch, quer und Desktop mit 0 JS-Fehlern.
  - `perf.py`: schlechtester Fall 12,7 ms je Bild, bestanden.

## Bitte am Handy testen

1. **Ton:** Es sollte komplett still sein, auch nach dem ersten Tippen.
2. **Torwart:** Wirft er jetzt schnell genug ab?
   - Mehr Zeit: `?halten=1.6`.
   - Wie früher: `?halten=0`.
3. **Rückpass:** Den Ball zum eigenen Torwart spielen geht nicht mehr. Kommt er doch hin (z. B. Stick aufs eigene Tor),
   spielt er ihn mit dem Fuß. Erlauben: `?rueckpass=1`.
4. **Pässe:** Stick auf den Mitspieler, Pass tippen – auch im Laufen und mit dem Daumen auf dem Stick.
   - Der schwache Ring zeigt vorher, wer den Pass bekommt.
   - Der helle Ring zeigt, wohin er gerade rollt.
   - Wie früher zum Vergleich: `?passfix=0`.

## Offene Punkte

- **Laufend 88 % statt 90 %:** Ziel knapp verfehlt; mit Halten-Geste 92 %, mit Tipp 84–88 %. Der Rest sind Pässe, die
  pressende Bots am Weg erwischen, obwohl beim Abspiel 1,5 m Platz war (Bots der Stufe 2 reagieren in 0,16 s). Ein
  automatischer Lupfer über den Presser oder ein Pass-Winkel, der den Presser umspielt, wäre der nächste Schritt.
- Pässe im Lauf, bei denen der Gegner direkt nach dem Tipp den Ball wegspitzelt, zählen als „kein Pass“ (7 %). Das ist ein
  Ballverlust und gehört zum Spiel.
- Ton kommt nur auf ausdrücklichen Wunsch zurück. Der alte Synthese-Code steckt im Git-Stand `d20ab10`.
