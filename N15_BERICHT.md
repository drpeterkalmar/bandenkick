# N15 – Ein Kick-Knopf, der auslöst · Skill-Moves · Akrobatik-Kicks · Einfach-Modus · Version 0.11.0

Auftrag: Peter 14.11.2026 (Brief n15) mit Nachträgen 1–5 vom 16.11. (Anspielstation, Ballführung, Peters Standardwerte magnet 3 /
luft 1,1, keine Auto-Grätschen). Ausgangsstand 6416fb8 (0.10.0 + n14-Teilstand); dieser Release enthält n14 und n15 als **0.11.0**.

## Kurzfassung für Peter

Es gibt nur noch den einen Kick-Knopf, und fast jeder Druck macht jetzt etwas Sichtbares: Schuss, Pass, Kopfball oder hinlaufen und
spielen – der Ring am Spieler pulst als Bestätigung. Wer angegriffen wird, weicht oft mit einem von zehn FIFA-Tricks aus, und in der Luft
gibt es 22 neue Akrobatik- und Kampfsport-Kicks (Tornado, Flash-Kick, Handstand-Schere …). Aus der eigenen Hälfte wird nicht mehr aufs Tor
geschossen, beim Tormann-Ball sprintet ein Mitspieler nach vorn, und im Pause-Menü gibt es „Einfach“ (spielt selbst ab und schließt ab).
**Am Handy einmal neu laden** (oder die App schließen und neu öffnen), dann ist alles da.

👉 Peter: am Handy testen und sagen, ob die Akrobatik-Kicks zu oft kommen und ob dir die Kopfball-Häufigkeit mit luft 1,1 reicht (siehe
unten) – keine Frist.

## Etappen, Regler, Commits (jede Etappe einzeln live)

| Etappe | Inhalt | Regler (alter Stand) | Live |
|---|---|---|---|
| E1 | Ein Kick-Knopf, der immer auslöst; Pass-Knopf und Menü-Schalter weg, J/Enter/Maus/Gamepad = Kick, Tormann-Abwurf/Hechten auf dem Kick-Knopf, Puls als Quittung | `?kickimmer=0` | 07fdd55 |
| E2 | Kein Torschuss aus der eigenen Hälfte (Mensch, Bots, Luftbälle) – Pass, sonst hoher Befreiungsschlag ins mittlere Drittel oder in eine gegnerische Ecke | `?eigenhaelfte=0` | 07fdd55 |
| E10 (Nachtrag 2) | Ballführung/Annahme: Reichweite +50 %, Magnet lässt bei Wende weniger los, Luftannahme großzügiger, auch mit Kick-Druck | `?ballfuehrung=0` | 9f98ef9 |
| E9 (Nachtrag 1) | Anspielstation beim Tormann-Ball | `?anspiel=0` | 9f98ef9, be69c47 |
| Nachtrag 5 | Grätsche nur, wenn sinnvoll | `?graetschklug=0` | 508ac5d |
| E3 | Megaferse ohne Comic-Einblendung; Tormann-Zeitlupe beginnt mit dem Schuss | `?megafersecut=1`, `?schusscam=0` | 508ac5d |
| E7 | Mehr Effet (+28 %), höhere Flanken | `?effet2=0`, `?flankehoch=1` | 35e241a |
| E6 | Einfach-Modus (Pause-Menü, Standard aus) | `?easy=1` | f80b353 |
| E4 | Zehn Skill-Moves zum Ausweichen | `?skills=0` | be69c47 |
| E5 | 22 Akrobatik-/Tricking-/Kampfsport-Kontakte | `?akro2=0` | 5a55c44 |
| E8 | Rumpf × 0,77 – geprüft, live aktiv | `?tierform=2` | – |

Sammelregler: **`N15_AUS`** in `src/sim/params.js` stellt alle n15-Regler auf 6416fb8 zurück. Peters Standardwerte magnet 3 / luft 1,1
(Commits fd12896/afae658) bleiben stehen; `?magnet=2.4&luft=1` stellt sie zurück.

## Messungen

### E1 Knopf-Spam (`tests/node/n15_kick_probe.mjs`, 600 Drücke in ganzen Spielen, Bots Stufe 2)

Skript-Spieler jagt den Ball bzw. führt ihn, drückt alle 0,4–2,5 s (halb mit Stick, halb ohne). Gezählt: binnen 1,5 s Kick, Luftball,
Kopfball, Grätsche, Fang/Abwehr des gesteuerten Spielers (auch nach einem Wechsel).

| Stand | Ballaktion binnen 1,5 s | Ball am Fuß | frei nah | hoch | beim Gegner | weit |
|---|---|---|---|---|---|---|
| 6416fb8 (`?kickimmer=0`) | 44–49 % | 83 % | 43 % | 26 % | 60 % | 10 % |
| E1 (vor Nachtrag 5) | 88–92 % | 95–97 % | 94–97 % | 82–88 % | 96–99 % | 79–94 % |
| **jetzt** (E1 + kluge Grätsche, Ausfallschritt 0,75 m) | **81 %** | 87 % | 88 % | 76 % | 78 % | 73 % |

Nicht gezählt (begründet): Ball in der Hand, Spiel ruht (Tor/Aus/Halbzeit), Ball > 1,2 s über Kopfhöhe, im Fenster von anderen gefangen,
für keinen Spieler des Teams in 1,5 s erreichbar (eigener Schuss fliegt davon …), Spieler grätscht/springt noch vom vorigen Druck.
Das Brief-Ziel 97 % ist **nicht erreicht**: mit Auto-Grätschen lag es bei ~90 %; Nachtrag 5 (Peter: keine Auto-Grätschen) nimmt die
Grätsche als Notlösung weg, der Rückgang ist nur teilweise durch Ausfallschritt/Not-Kontakt aufgefangen. Rest vor allem: hohe Bälle,
die erst nach dem Fenster herunterkommen, und Gegner, der den Ball von uns weg führt (keine Grätsche von hinten).

Wie es auslöst: Druck wird vorgemerkt (bis 3 s statt 1,5 s), ohne Stick läuft der Spieler zum Ball (mit Stick, solange er grob dorthin
zeigt), Ausfallschritt, Spitzel/Knie-Volley bis 1,05 m, unsauberer Luftkontakt statt keiner, Not-Kontakt am Körper nach 0,6 s,
kein freier Pass → Schuss bzw. Befreiung, Ball weit → Wechsel zum schnelleren Mitspieler, der den Druck übernimmt; Druck während
Grätsche/Fallen wird gemerkt; am deckenden Gegner rutscht er seitlich vorbei.

### Nachtrag 5 Grätschen (`tests/node/graetsch_probe.mjs`, 12 Spiele, gleiche Seeds)

| Stand | Grätschen gesteuerter Spieler | davon sinnvoll | freier Ball / Gegner ohne Ball | von hinten | Ballgewinne |
|---|---|---|---|---|---|
| `?graetschklug=0` | 9,80/min | 232 | 435 | 159 | 3,93/min |
| **Standard** | **1,75/min (−82 %)** | 146 | 8 | 0 | 0,84/min |

### E2 Eigene Hälfte (`tests/node/n15_haelfte_probe.mjs`, Bot-Selbstspiel)

Bots schossen schon vorher kaum aus der eigenen Hälfte (1 von 504 Schüssen in 8 Spielen) → jetzt 0. Beim Menschen war es der Ein-Knopf-Fall
„kein Mitspieler im Kegel → Schuss“ – jetzt Pass, sonst Befreiung (hoch, 55°, Landung im mittleren Drittel möglichst frei) bzw. Schuss in
eine gegnerische Ecke (32°, Abpraller). Fänge des Tormanns nach Schüssen aus ≥ 12 m: 0 → 0. (Ein erster Versuch, auch die Bot-Befreiungen
so zu schlagen, kostete 30 % Tore im Bot-Spiel – verworfen, Bots befreien wie bisher.)

### E10 Ballführung (`tests/node/n15_annahme_probe.mjs`, gegen Peters Standard magnet 3 / luft 1,1)

| | `?ballfuehrung=0` | Standard |
|---|---|---|
| Führen mit Richtungswechseln (±70°, 6 × 60 s): Ball weg je Minute | 3,83 | **1,83** |
| … davon nach einer Kehrtwende | 1,17 | 0,50 |
| Dribbel-Parcours (Skript) | 10,69 s | 10,69 s |
| Luftbälle 0,4–1,55 m sauber angenommen | 100 % | 100 % (aus 1,1 m Abstand fällt der Ball jetzt vor den Fuß) |

Haltekraft +50 % (magnetK/Acc/C) wurde gemessen und **verworfen**: Parcours +2,4 s (Gate ≤ 0,5 s). Grätschen erobern weiter
(tackle.test grün). Die Luftannahme-Probe ist leicht (beide 100 %); der eigentliche Fehler für Peter war `!this.pending`: mit Kick-Druck
wurde nie angenommen – jetzt wird angenommen, wenn kein Luft-Kick ansteht.

### E9 Anspielstation (`tests/node/n15_anspiel_probe.mjs`, 6 Bot-Spiele)

| | `?anspiel=0` | Standard |
|---|---|---|
| Tormann-Bälle mit Anspielstation vorn (sprintet nach vorn bzw. über der Mittellinie) | 34 % | **94 %** |
| Abwurf erreicht Mitspieler | 98 % | 95 % |
| Konter-Tore je Spiel (≤ 8 s nach Abwurf) | 4,0 | 3,3 |

Der Abwurf in den Lauf wird nur gespielt, wenn jeder Gegner ≥ 0,25 s später am Treffpunkt wäre (gemessen: wenige, aber fast alle kommen an);
sonst sicher kurz zum zweiten Mitspieler, der sich am freiesten Punkt anbietet. Gate „mindestens so oft wie vorher“ knapp verfehlt
(95 statt 98 %); halten.test (abgefangene Abwürfe) in der Grenze.

### E3 Schuss-Zeitlupe (`tests/n15_schusscam.py`, Bildserien in `tests/shots/n15/schusscam_*`)

Ursache: Löste eine Parade/ein Hechtsprung kurz nach dem Schuss die Zeitlupe aus, zeigte die Tormann-Kamera nur den Tormann. Jetzt
beginnt sie mit dem Rückblick auf den Schuss (Schütze, Kontakt, Ballflug), der Tormann kommt danach. Serie Hochformat 6 und Querformat 7
Momente (Bot-Spiel, Action „oft“): auf allen Bildern Schütze und Ball beim Kontakt sichtbar, Ballflug sichtbar (per Bild geprüft).
Pixel-7-Format (412 × 915 / 915 × 412) statt 390 × 844.

### E4 Skill-Moves (`tests/node/n15_skills_probe.mjs`, 6 Bot-Spiele)

Liste nach gamesradar.com „FC 26 skill moves guide“, redbull.com „EA FC 26 skillmoves tricks guide“, operationsports.com „The best
skill moves in FC 26“: Marseille-Roulette, Elastico, Regenbogen (Rainbow Flick), Hacke-Hacke (Heel to Heel), McGeady, Sohlenroller
(Ball Roll), Übersteiger, Tunnel (Bridge), La Croqueta, Zieher mit Drehung (Drag Back/Berba).

| | `?skills=0` | Standard |
|---|---|---|
| Versuche je Spiel (Bots seltener: 15 %, Mensch 70 % der Angriffe) | 0 | 14 |
| gelungen | – | 51 % (Ziel 40–60 %) |
| danach Ball behalten (≥ 1 s) | – | 84 % |
| Ballverluste beim Führen je Minute | 0,87 | 1,1 (Streuung der kurzen Messung ±0,2) |
| Tore je Spiel | 28,7 | 24,8 |

### E5 Akrobatik-Kontakte (`tests/node/n15_akro_probe.mjs`, 20 Bot-Spiele; Bilder `tests/shots/n15/akro_*.jpg`)

22 neue Kontakte (Tricking: Butterfly, Tornado, 540, Rad, Aerial, Flash-Kick, Corkscrew, Webster, Shaolin-Whirlwind; Kampfsport: Dollyo,
Neryo, Twio Dwit Chagi, Spinning Hook, Yop Chagi, Mawashi Geri, Teep, Flying Knee, Meia Lua de Compasso, Armada, Queixada, Martelo,
Handstand-Schere), je mit Höhen-/Winkel-Fenster, Körperteil (Spann, Ferse, Sohle, Knie, Außenrist – nie Hand/Arm), Sprung, Drehung,
Tempo/Streuung, Zeit am Boden und eigener Pose. Wahl wie alle Luftbälle (Erfolg zuerst, unter fast gleich guten die spektakulärste,
je Szene feste Zufallsreihenfolge unter den neuen).

| | `?akro2=0` | Standard |
|---|---|---|
| Luftkontakte je Spiel | 23,3 | 29,0 |
| verschiedene neue Techniken je Spiel | 0 | 6–13 (Ø 9,6; Ziel ≥ 8) |
| neue Technik nie in 20 Spielen | – | keine |
| Tore je Spiel | 25,9 | 25,3 |
| Kopfbälle (20 Spiele) | 45 | 35 |

Bildfolgen (Absprung, kurz vor dem Kontakt, Kontakt, Nahaufnahme): Bewegungen erkennbar und unterschiedlich; das Kontaktbild zeigt den
Ball oft knapp neben dem treffenden Fuß (ein Takt nach dem Kontakt). fps-Budget nicht eigens gemessen (Posen kosten nichts zusätzlich).

### E6 Einfach-Modus (`tests/node/n15_easy_probe.mjs`, Skript-Spieler wie einknopf_probe, 6 Spiele, gleiche Seeds)

| | aus | Einfach |
|---|---|---|
| Tore : Gegentore | 31 : 102 | **68 : 80** |
| Einfach-Pässe (davon abgefangen) | – | 11 (1) |
| Pässe insgesamt abgefangen | 29 % | 32 % (Rest = Pässe des Skripts per Knopf) |

### E7 Effet und Flanken (`tests/node/n11_probe.mjs` physik, `tests/node/n15_flanke_probe.mjs`)

Innenseit-Schuss 25 m/s über 20 m: 9,9 → **12,7 m** (+28 %). Flanken in festen Lagen: Scheitel 2,45 → 2,75 m (+12 %, Ziel +40–60 % nicht
erreicht: höhere Bahnen wären abfangbar – Abfang-Schutz zählt zuerst), Ankunft 1,41 → 1,65 m, Reserve 0,25 → 0,18 s.

### Kopfbälle mit luft 1,1 (Nachtrag 3/4)

Bot-Selbstspiel je 12 Spiele (`/tmp`-Messung mit `n15_akro_probe.akroProbe`):

| | luft 1 | luft 1,1 (Peters Standard) |
|---|---|---|
| ohne neue Kontakte (`akro2=0`): Kopfball / Flugkopfball / Fallrückzieher | 28 / 31 / 13 | 32 / 27 / 11 |
| mit neuen Kontakten (Standard): Kopfball / Flugkopfball / Fallrückzieher | 26 / 19 / 0 | 24 / 17 / 1 |

luft 1,1 nimmt keine Kopfbälle weg (32 statt 28 ohne neue Kontakte). Deutlich weniger werden Kopf- und vor allem Fallrückzieher durch die
22 neuen Kontakte (sie liegen in denselben Höhen): Kopfball −25 %, Fallrückzieher fast weg. Ein Kopfball hat Vorrang, wenn er ≥ 70 % so
gut ist wie der beste neue Kontakt. 👉 Peter entscheidet, ob das so bleiben soll (`?akro2=0` zum Vergleich am Handy).

### E8 Torso

Live geprüft: `assets/kuscheltiere/kuscheltiere.json` auf drpeterkalmar.github.io hat für alle sechs Tiere `rumpf 0.77`, Standard
`tierform 3`; Bilder alt/neu aus n14: `tests/shots/n14/`.

## Tests

- Node: alle Testdateien laufen; neu `tests/node/n15.test.mjs` (in run_all). Angepasst mit Begründung: tackle (kluge Grätsche,
  `graetschklug=0` für die Mechanik), magnet (Mechanik ohne E10-Zusätze, Parcours ≤ fd12896 + 0,5 s), keeper/tormann_e1 (Tore je Schuss
  seit n14 höher), wechsel (≥ 99,5 %), air (klassische Stationen mit `akro2=0`), n11/n13/n14 (Lagen ab der Mittellinie, Peters magnet 3,
  n14-Effet-Schritt mit `effet2=0`), smoke (Torpause abwarten).
- Schon vorher rot und nicht hier gelöst (Nachtrag 3): magnet „Gegner 0,3 m am Ball: schwächer“, nachdrall, traumpass, eckschraege
  (je „Tore je Schuss“-Gates).
- Rauchtest im Browser grün (Pixel 7 hoch/quer, Desktop); `tests/test_live.py` gegen die Live-Seite grün (Version 0.11.0, Build edc0d29c7b; Schuss-Lage dort auf die gegnerische Hälfte verlegt – E2).

Gesamtlauf `node tests/node/run_par.mjs 4` (alle 48 Testdateien): grün bis auf die vier vorbestehenden (magnet „Gegner 0,3 m“,
traumpass; nachdrall und eckschraege liefen im Gesamtlauf grün). Nachgezogen und grün: n10, n12, n14, tormann_e1.
perf_gate (Pixel-7-Profil, CPU × 4, hoch, je 8 s): spiel_s1 p50 4,2 → 3,7–5,0 ms (Streuung, Mittel gleich), spiel_auto 5,6 → 5,4 ms –
im Budget.

Handy-Hinweis: nach dem Update **einmal neu laden** (Service-Worker/Cache-Busting über `sw.js`/BUILD).
