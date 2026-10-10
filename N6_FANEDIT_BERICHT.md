# Bandenkick n6 – Tor-Wiederholung als TikTok-Fan-Edit und Action-Momente live

Peters Wünsche (09.10.2026): „Mit Fan-Cam meinte ich eigentlich so ein überdrehtes, TikTok-artiges Video mit Effekten und
Zooms usw.“ und „Bei Torschüssen oder Zweikämpfen schnelle Zoom-ins auf die Szene mit Effekten und Speed-Ramps … oder
Bullet-Time!“. Stand vorher: n5 (Version 0.3.0, ae34b43). Gearbeitet und gemessen auf **rog17 (RTX 3070 Ti, Windows 11,
Chromium headless über ANGLE/D3D11, stumm `--mute-audio`)**; Handy-Profil = Pixel 7 (DPR 2,625) mit CPU-Drosselung ×4.
Version **0.4.0**, alles live (Etappen E1–E13 einzeln gelandet). Bandenkick bleibt **lautlos** (Ton-Wächter: 0 Audio-Objekte).

## Kurz für Peter

- **Nach jedem Tor läuft jetzt ein Fan-Edit (≈ 7 s)** statt der ruhigen Wiederholung: Schnitte auf einem stummen Takt
  (128 BPM), erst ein Vorgriff aufs Tor („WARTE AB 👀“, „⏪ ZURÜCK“), dann Anlauf, Zeitlupe am Ballkontakt (≈ 0,04×) mit Blitz
  und Technik-Namen („VOLLSPANN“, „BANANE“, „FALLRÜCK-ZIEHER“), Torwart-Sicht mit km/h-Zähler, Netz-Einschlag mit „GOLAZO!“,
  Standbild mit Kontur um den Schützen, derselbe Schuss aus drei Winkeln (×1 ×2 ×3), Jubel mit Armen hoch und Nahaufnahme.
  Dazu Zoom-Punches, Wischschwenks, Wackler nur auf dem Schlag, RGB-Versatz, Leuchten an Ball und Schuhen, Kometenschweif,
  Teal/Orange, Filmkorn, Speed-Lines, Emojis, Bildunterschrift-Gag, Fortschrittsbalken, „@bandenkick #golazo“.
- **Pause-Menü:** „Tor-Wiederholung: Fan-Edit / Klassisch / Aus“ (Klassisch = die ruhige Wiederholung aus n5), „Blitze
  reduzieren“, „Clip im Hochformat“ (9:16-Ausschnitt auch auf Querformat), „🎬 Action-Momente: Aus / Selten / Oft“.
  Tippen überspringt den Clip, „↻ Clip nochmal“ startet ihn neu (auch noch 3 s nach dem Clip). Nach dem Abpfiff erscheint
  **„🏆 Tor des Spiels“**: der Fan-Edit des besten Tors (Tempo + Technik) aus einer gemerkten Kopie der Aufzeichnung.
- **Live im Spiel – Action-Momente** (ersetzen die alte Luftball-Zeitlupe): bei harten Schüssen/Volley/Fallrückzieher,
  Hechtsprüngen, Paraden, Pfostentreffern, Grätschen, Kopfball-Duellen zoomt die Kamera tief an die Szene, zeigt die letzten
  Zehntel in Zeitlupe (Rückblick: Anlauf, Ausholen, Kontakt mit Druckwelle, leuchtender Ball, Kometenschweif), dann kurz
  schneller und harter Schnitt zurück. Beim Spektakulärsten **Bullet-Time**: die Zeit steht, die Kamera fährt im Halbkreis um
  den eingefrorenen Ball. „Selten“ ≈ 5–8 Momente je Bot-Spiel, „Oft“ ≈ 17–24.
- **Bitte am Handy testen:** ein paar Tore schießen (hoch und quer, einmal mit „Clip im Hochformat“), auf Schnitte im Takt,
  Lesbarkeit der Texte und die Jubel-Szene achten; dann ein Spiel mit „Action-Momente: Oft“ – stören die Momente beim
  Spielen? Fühlt sich die Steuerung in der Zeitlupe fair an? Zum Vergleich `…/bandenkick/?edit=0` (Klassisch), `?action=0`.

## Fan-Edit (src/sim/fanedit.js)

Ablauf in Schlägen (1 Schlag = 0,469 s; jede Einstellung beginnt genau auf einem Schlag):

| Schlag | Einstellung | Tempo / Inhalt | Effekte |
|---|---|---|---|
| 0–1 | Vorgriff hinter dem Tor | Einschlag fast Standbild | „WARTE AB 👀“, POV-Bildunterschrift Wort für Wort, Punch, Speed-Lines |
| 1–2 | Seitenlinie tief | Anlauf, Kamera auf Schütze + Ball | „⏪ ZURÜCK“, Wischschwenk, Punch |
| 2–4 | Makro Fuß/Ball | Kontakt **genau auf Schlag 3**, ≈ 0,04×, danach ruckartig schneller | Flash 1, RGB-Versatz, Wackler, Technik-Name, 😱, Druckwelle, Glow |
| 4–5 | Torwart-Sicht | Ball fliegt auf die Kamera zu | km/h-Zähler rattert hoch (langsame Schüsse: Distanz bzw. „10/10 SCHWIERIGKEIT“), Speed-Lines |
| 5–6 | hinter dem Tor | Ball auf das Netz zu | km/h-Stempel |
| 6–7 | am Pfosten | **Einschlag genau auf Schlag 6**, Netz zappelt | Flash 2, GOLAZO! + zweites Wort (BRUTAL!/KRANK!/…), 💥, Shake |
| 7–8 | Standbild | Nahaufnahme des Schützen im Einschlag-Moment | Kontur + Namensschild, Spotlight, entsättigt, Fahrt heran |
| 8–11 | derselbe Schuss ×3 | Seitenlinie / hinter dem Schützen / Gegenschuss (Reihenfolge je Tor) | ×1 ×2 ×3, Wischschwenks, Speed-Lines |
| 11–13 | Jubel frontal | Schütze steht wieder, Arme hoch (V), dreht sich zur Kamera | Flash 3, Name „MIKA #7“, 🔥, Gag-Untertitel |
| 13–15 | Jubel nah | Faust ballen/küssen (je Tor), Fahrt heran | ⚡, Abblende, „↻ Clip nochmal“ |

- Tempo je Einstellung als monotone Kurve (keine Sprünge innerhalb einer Einstellung, Standbild = flaches Stück); die
  n5-Glättung der Figuren bleibt, an jedem Schnitt werden die Figuren hart umgesetzt (kein Herüberblenden).
- Kameras ohne Verdeckung: Makro- und Jubel-Winkel werden gegen alle Spieler über die ganze Einstellung geprüft, Figuren
  direkt vor der Linse ausgeblendet, Kamera bleibt im Käfig. Ringpuffer 10 s (vorher 8 s), Live-Jubel vor dem Clip 2 s.
- Effekte im gemeinsamen Endbild-Pass (`kern/kinolook.js`, Zweig `EDIT`: RGB-Versatz, Zoom-Unschärfe, Filmkorn,
  Entsättigung; Grading „edit“ Teal/Orange), Texte/Emojis/Speed-Lines/Kontur als CSS-Overlays (Emojis und Strahlenkranz
  beim Laden in Bilder gemalt). Ohne Kino-Look (`?kino=0`, Stufe 0) übernimmt CSS den Blitz.
- **Blitze reduzieren:** statt Flash sanftes Aufhellen (≤ 0,22), kein RGB-Versatz, Wackler ×0,3, Punches ×0,5, weniger
  Speed-Lines/Puls. Standard folgt der Systemeinstellung „Bewegung reduzieren“.

### Prüfungen Fan-Edit

| Prüfung | Ergebnis |
|---|---|
| Node `tests/node/fanedit.test.mjs` (8 echte Bot-Tore) | **ALLE GRÜN 12/12**: Einstellungen auf ganzen Schlägen; Abspielen mit 30–75 fps schwankend: Schnitt höchstens **0,96 Bild** nach dem Schlag; Clip 7,03 s; Spielzeit nie rückwärts; Kontakt ≤ 0,038×; Standbild am Einschlag; **≤ 3 Flashes, längster 90 ms**; Blitze reduzieren ohne Flash/RGB; **Ball am Kontakt im Bild 480/480** (hoch, quer, 9:16); Spielzustand unverändert |
| Browser `tests/fanedit_bilder.py` – 7 Tore hoch (Vollspann, Banane, Außenrist-Banane, Volley, Fallrückzieher, Dropkick, Flugkopfball), 3 quer, 1 × 9:16 auf quer, 1 × Blitze reduziert | Schnitte gemessen: **max. 0,997 Bild** nach dem Schlag (11 Schnitte je Clip, 12 Clips); **0 JS-Fehler, Ton 0** |
| Rauchtest `tests/smoke.py` (mit `--mute-audio`) | **GRÜN** – Wiederholung (alle Einstellungen), Tippen überspringt, Ton 0 in Menü/Spiel/Wiederholung/Training |
| Collagen | `tests/shots/fanedit/hoch_seed*.jpg`, `quer_seed*.jpg`, `clip_seed*.jpg`, `hoch_sanft_seed8.jpg` |

**Bewertung „wirkt das wie ein überdrehter TikTok-Fan-Edit?“** (unabhängiger Prüfer, Bildfolgen à 16 Standbilder, 10 Runden mit
Nachbesserung dazwischen): Start 5–6/10 → 7–7,5 → bestes Einzelergebnis 8,5/10 (hoch Volley, hoch Dropkick), mehrere Clips
8/10; **Durchschnitt zuletzt 6,5–7,75 – das Ziel ≥ 8/10 für alle Clips habe ich nicht verlässlich erreicht.** Der Prüfer
betont selbst, dass Standbilder Bewegung, Schnittrhythmus und Flashes nicht zeigen. Restkritik der letzten Runden: einzelne
×1–×3-Winkel zeigen den Schützen klein oder angeschnitten, der Ablauf ist bei jedem Tor gleich (Reihenfolge der Winkel,
Gags, Jubelwörter, Jubelbewegung variieren schon), Fang-/Kopfball-Tore wirken weniger spektakulär.

## Action-Momente live (src/sim/action.js)

- **Auslöser mit Spektakel-Wertung 0…1:** Schuss ≥ 90 km/h oder Technik (Fallrückzieher 0,95, Seitfall, Flugkopf, Volley,
  Banane …), +0,12 aufs Tor, +0,15 Kreuzeck; Pfosten/Latte; Hechtsprung bei hartem Ball aufs Tor; Parade/Fang nur mit
  Hechtsprung; Grätsche (Ball erobert / Gegner getroffen); Kopfball-Duell (Gegner springt mit). *Tunnel* erkennt die
  Simulation nicht als Ereignis – nicht umgesetzt.
- **Dosierung:** „Selten“ Wertung ≥ 0,8, Zufall 35 %, Abkühlzeit 45 s; „Oft“ ≥ 0,5, 75 %, 12 s; Bullet-Time höchstens alle
  40 s. Nie, wenn ein Gegner am langsamen Ball dicht (< 9 m) vor dem eigenen Tor ist; nicht nach einem Tor.
- **Speed-Ramp (1,18 s):** Weißblitz < 120 ms + Speed-Lines, Zoom-Punch tief an die Szene (seitlich leicht von vorn nach der
  Blickrichtung des Schützen, Bildmitte zwischen Schütze und Ball; Torwart frontal vom Feld her), **Rückblick** aus dem
  Ringpuffer: 0,45 s Echtzeit für die letzten 0,25 s (Schuss) bzw. 0,16 s (Parade) vor dem Auslösen, bremst bis zum Kontakt
  fast zum Stand – die Simulation steht so lange; am Kontakt Druckwelle, leuchtender Ball, Kometenschweif. Dann live 0,12× mit
  Fahrt heran, kurz 1,5×, harter Schnitt zurück mit Wischunschärfe und Wackler. Sättigung/Vignette hoch, Knöpfe gedimmt
  (bleiben bedienbar), Markierungsringe aus, Figuren vor der Linse ausgeblendet.
- **Bullet-Time (1,45 s):** Zeit steht ≈ 1,15 s (Simulation pausiert und setzt exakt fort), Kamera fährt einen Halbkreis um
  Ball + nächsten Spieler (Radius schrumpft an der Bande, bleibt im Käfig), leichter RGB-Versatz, dann ruckartig zurück.
- Die alte Luftball-Zeitlupe (Nacht 2) ist darin aufgegangen; `?zeitlupe=0` bzw. die alte Einstellung „Zeitlupe: aus“ = Aus.

### Prüfungen Action-Momente

| Prüfung | Ergebnis |
|---|---|
| Node `tests/node/action.test.mjs` | **ALLE GRÜN 15/15**: Ramp 1,18 s (langsamstes 0,12×, schnellstes 1,5×), Bullet 1,45 s mit 1,15 s Pause, Blitz 80 ms, Blitze reduzieren ohne Blitz/RGB; Abkühlzeit eingehalten; Sicherheitsregel; **Simulation unverändert** (Hash = Zwilling ohne Regie) |
| **Häufigkeit** (3 ganze Bot-Spiele à 2 × 4 min je Stufe, Seeds 3/7/11) | **Selten 6,7 je Spiel (5/7/8), 0,77 je Spielminute**, davon 10 von 20 Bullet-Time (meist Hechtsprünge); **Oft 19,3 je Spiel (17/17/24), 2,24 je Minute**, 6 Bullet-Time. (Bot-Spiele schießen viel; mit Mensch vermutlich weniger.) |
| Eingabe in der Zeitlupe (`tests/action_bilder.py`) | Mensch tippt Schuss in der Zeitlupe → **Schuss fällt noch im Moment** (hoch und quer, nach 0,82 s Echtzeit) |
| Bildfolgen (≥ 12 Bilder je Moment) | `tests/shots/action/hoch_*`, `quer_*` (3 automatische Momente + erzwungene Bullet-Time je Format); 0 Fehler, Ton 0 |

**Bewertung „filmisch-spektakulär, Bullet-Time erkennbar?“** (8 Runden): Start 3–6/10 (Ø ≈ 4,8) → zuletzt **5–7/10
(Ø ≈ 6,4)**; Bullet-Time wird in allen Runden klar erkannt (6–7/10). Das Ziel ≥ 8/10 ist **nicht erreicht**. Restkritik:
Ball und Schütze rutschen um den Kontakt an den Bildrand, der Kometenschweif wirkt aus manchen Winkeln wie ein flacher Keil,
Bullet-Time an beliebiger Stelle hat keinen „Helden“ (in den Testbildern erzwungen), Farbsäume an hellen Linien.

## Bildrate (gemessen auf rog17, Handy-Profil CPU ×4, Stufe 1 fest, Pixel 7 hoch/quer)

`tests/fanedit_perf.py` (je 3 Bot-Tore, Fan-Edit gegen Klassisch, Bildabstände über den ganzen Clip) und
`tests/action_perf.py` (90 s Bot-Spiel „Oft“), Rohdaten `tests/perf/2026-10-10_*.json`:

| Messung | Mittel fps | schlechtestes 0,5-s-Fenster | Bilder > 33 ms |
|---|---|---|---|
| Klassisch hoch (3 Clips) | 51,7 / 58,8 / 60,0 | 40,7 / 54 / 60 | 0–2 % |
| **Fan-Edit hoch** (1. Clip / 2. / 3.) | 45,1 / 52,7 / 51,1 | **19,4** / 44,5 / 42,6 | 4–6 % |
| Klassisch quer | 49,7 / 54,4 / 56,1 | 42 / 48 / 52 | 1–3 % |
| **Fan-Edit quer** | 39,6 / 45,0 / 45,3 | **16,0** / 36,0 / 37,5 | 7–8 % |
| **Action-Momente hoch** (4 Momente) | 53,6 | 35,2 | 4 % |
| **Action-Momente quer** (4 Momente) | 51,6 | 30,0 | 3 % |

- Der Fan-Edit kostet ab dem zweiten Clip ≈ 7–10 fps gegenüber Klassisch, bleibt aber über 30 fps (schlechtestes Fenster ≥ 36).
- **Zweite Messreihe 15:40 (nach E9–E12, rog17 spürbar stärker ausgelastet – auch Klassisch ≈ 10 fps schlechter; die JSON-Dateien
  enthalten diese Reihe):** Klassisch hoch 40,7/49,7/55,1 fps (schlechtestes Fenster 34/38/48), Fan-Edit hoch 36,1/43,4/42,8
  (13,6/33,8/34,8); quer Klassisch 42,4/48,5/48,5 (37/40/43), Fan-Edit 34,6/40,6/41,0 (13,5/32,9/30,0). Action-Momente hoch
  37,4 fps im Moment gegen 46,0 sonst (schlechtestes Fenster 18,0), quer 37,2 gegen 48,2 (16,0). **Unter dieser Last fallen
  die Action-Momente (mit Rückblick und Kometenschweif) und der erste Clip kurz unter 30 fps – offen.**
- **Offen:** Im allerersten Clip nach dem Laden stockt das erste Bild ≈ 230–300 ms (und einzelne Bilder bis 130 ms) – danach
  nicht mehr. Per JS-Profil gefunden und behoben: erzwungenes Layout beim Neustart der Text-Animationen (−100 ms), Shader
  der erst im Clip sichtbaren Effekte (Ballspur, Druckwelle, Leuchten: 170 → 70 ms, jetzt einmal beim Start vorgezeichnet),
  Farb-Emojis rastern (150 ms → weg), Shader-Varianten erst beim Tor übersetzen (bis > 1 s, jetzt im Ladebildschirm).
  Danach (E13) per Programm-Vergleich gefunden: die Endbild-Varianten wurden für das falsche Ziel vorgewärmt (Bildschirm = sRGB-
  Variante; im ersten Action-Moment 130 → 0 ms Shader-Warten), die Deko-Effekte (Konfetti, Rutschspuren, Blitzlichter) wurden
  erst beim ersten harten Schuss übersetzt (jetzt beim Start), Chromes Rasterer übersetzte beim ersten Standbild Verlauf/
  Weichschatten (146 ms → weg, Stile beim Laden unsichtbar vorgemalt). **Erster Clip jetzt: schlechtestes 0,5-s-Fenster 28 fps
  (vorher 13,6) unter Last**; Rest ≈ 190 ms beim allerersten Clip-Bild (Layout ≈ 100 ms + Skript ≈ 115 ms unter ×4-Drosselung).
- Unabhängig von n6 gefunden: Im Bot-Spiel (Seed 7) stockt bei Spielzeit ≈ 28 s ein Bild 1,0–1,6 s – auch mit
  `?replay=0&action=0` (Gegenprobe), also älter. JS-Profil: Ball-Physik (`aero` 0,7 s, `substep` 0,3 s, `integrateOrientation`,
  `clOf`, `netForces` in `src/sim/ball.js`) – vermutlich sehr viele Unterschritte, wenn der Ball im Netz hängt. Simulation,
  nicht Teil dieses Auftrags (für den Mac).
- Hinweis zur Messung: zwei gedrosselte Browser gleichzeitig verfälschen die Zahlen stark (anfangs passiert) – alle Werte
  oben sind nacheinander gemessen.

## URL-Schalter (neu)

`?edit=0` Klassisch · `?edit=1` Fan-Edit · `?clip=hoch|quer` 9:16-Ausschnitt · `?blitze=sanft|voll` · `?action=0|1|2`
(aus/selten/oft) · bestehend: `?replay=0`, `?zeitlupe=0` (= Action-Momente aus), `?rcam=alt`, `?glatt=0`.

## Offen (für den Mac)

1. Bewertungsziel ≥ 8/10 nicht erreicht (Fan-Edit Ø ≈ 7–7,75, Action-Momente 4–7). Nächste Hebel: Winkel nach
   Sichtbarkeit des Schützen wählen (statt fester Liste), mehr Abwechslung im Ablauf je Tor, Action-Momente bei Schüssen
   früher auslösen bzw. den Rückblick verlängern, Farbsäume an hellen Linien dämpfen.
2. Start-Hänger beim allerersten Clip-Bild (≈ 0,19 s unter ×4-Drosselung: Layout des Overlays + Skript) und der ältere
   1–1,6-s-Hänger bei Spielzeit 28 s (auch ohne n6).
3. „Tor des Spiels“ ist umgesetzt (E14, `tests/tordesspiels.py`: Bot-Spiel bis zum Abpfiff, Knopf sichtbar, Clip läuft,
   0 Fehler); gemerkt wird nur ein Tor je Spiel (≈ 1 MB Kopie), nur aus gezeigten Fan-Edits (nicht bei „Klassisch“/„Aus“).
4. Tunnel als Auslöser für Action-Momente fehlt (kein Ereignis in der Simulation).
5. Nicht am echten Handy geprüft (nur Profil auf rog17); perf_gate gegen ae34b43 nicht gelaufen (eigene A/B-Messung
   Klassisch ↔ Fan-Edit stattdessen).
