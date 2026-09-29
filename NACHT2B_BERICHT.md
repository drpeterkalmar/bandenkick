# Bandenkick – Bericht Nacht 2b „Ballgefühl“

Live: https://drpeterkalmar.github.io/bandenkick/ (Version `f69e7e7a8f`, live geprüft: HTTP 200, Version = lokal, 0 Fehler, PWA offline)

## Was jetzt geht

- **Gesten auf beiden Knöpfen** (Handy, Tastatur, Maus, Gamepad gleich):
  | | Pass | Schuss |
  |---|---|---|
  | tippen | flach, Stärke automatisch | kurzer Schuss |
  | halten | flach, Stärke = Haltedauer (Ring →) | **Vollspann** ⚡ (Flatterball) |
  | tipp + sofort halten | **hoch** (Chip 25–45°, Rückdrall) ⌒ | **angeschnitten** ↪/↩ Innen- oder Außenrist (je nach Ballposition) |
  Halten startet ohne Verzögerung; der Modus steht beim 2. Druck fest; der Ring um den Knopf zeigt Modus und Stärke.
  Die Knopf-Flanken tragen den Zeitstempel des Touch-Ereignisses – ein 60-ms-Tipp bleibt kurz, auch wenn ein Bild ruckelt.
- **Pass in den Laufweg:** Stick zeigt auf den Mitspieler (Kegel ±35°), der Ball kommt dort an, wo er hinläuft
  (echtes Rollmodell). Technik automatisch: Innenseite, Außenrist, **Hacke** (nach hinten). Stick auf die Bande = Bandenpass.
- **Schuss immer aufs Tor**, in die Ecke weg vom Tormann; Stick seitlich = flache Ecke, schräg vor = hohe Ecke.
  Die Lage (Winkel, Entfernung, Körper, Ball vor dem Fuß, schwacher Fuß, Tempo, Aufsetzer, Gegner) ergibt eine
  Qualität q: schlechte Lage = langsamer und zentraler. Letzter Schuss mit q steht im Pause-Menü.
- **Luftbälle:** Ball in der Luft + Schuss → automatisch Volley, Dropkick, Kopfball (mit Sprung), Flugkopfball,
  Seitfallzieher, Fallrückzieher. Timing zählt. Danach ~0,8 s am Boden. Bots nutzen dieselben Techniken. Kurze Zeitlupe (abschaltbar).
- **Training** (Start oder ☰ → Training), 9 Übungen mit 1–3 Sternen, Bestwert gespeichert, Hinweiskarte, „Nochmal“:
  Schütze – Torwand, Volley-Station, Bandenpass, Dribbel-Parcours, Elfmeter, Doppelpass;
  Torwart – Ballmaschine (12 Schussarten), Reaktion, 1 gegen 1. Sichtbare Ballmaschine, Torwand, Hütchen, Dummies.
- **Hilfekarte** beim ersten Start (später ☰ → Steuerung), README mit Gesten-Tabelle und allen URL-Reglern.
- Posen: Fallrückzieher kopfüber, Seitfall, Kopfball am Kopf, Hacke, Chip, Außenrist, Brust-/Oberschenkel-Annahme.

## Zahlen (alle Tests grün)

| Prüfung | Ergebnis |
|---|---|
| Gesten-Grammatik | 28/28, 1000 Zufalls-Gesten: jeder Druck genau ein Ergebnis |
| Pass flach, 500 Lagen: Empfänger erreicht Ball ohne Stehenbleiben | **96,8 %** (Ziel ≥ 90), Fehler p50 0,07 m / p95 0,31 m |
| Pass hoch (Chip), 500 Lagen | **96,4 %** (Ziel ≥ 75), p50 0,15 m / p95 0,58 m |
| Schuss aus guter Lage aufs Tor | **96,7 %** (Ziel ≥ 85) |
| Schlechte Lage: Tempo / Abstand Ziel zur Tormitte | 48–57 % des Tempos (≤ 60), 0,42–0,60 m (≤ 0,6) |
| q monoton | 767 Tabellen-Paare + 1800 Spiel-Paare ohne Verstoß |
| Kurvenschuss (Tipp + halten) im Spiel | 18/20 Tore |
| Ballmaschinen-Serie 80 Bälle | 70 Tore; jede der 6 Techniken gewählt und trifft (Kopfball Ø 13 m/s, Volley Ø 24 m/s) |
| Timing: 0,3 s zu früh gedrückt | q 0,87 → 0,40, Tempo 18,1 → 13,7 m/s |
| Alle 9 Übungen headless mit Skript-Spieler | 3 Sterne (Doppelpass 2–3), untätig → 0 Sterne |
| Selbstspiel 200 Bot-Spiele | keine Hänger, Stärken richtig sortiert (2>1, 3>1 je 100 %, 3>2 66 %), ~19 Luftbälle je Spiel |
| Browser: echte Touch-Gesten hoch + quer, Rauchtest | grün, 0 Fehler, Knöpfe ≥ 48 px, keine Überlappung |
| Leistung (CPU je Bild bei 60 fps) | hoch 3,95 ms (Nacht 2: 4,11), quer 4,00 (4,20), Desktop 4,23 (4,32) – nicht schlechter |

Fotos: `tests/shots/final/n2b_*` (hoch/quer: Hilfe, Ring Schuss/Pass, Training, Hinweis, Torwand, Fallrückzieher, Kopfball, Ergebnis).

## Bitte am Handy testen

1. **Tipp + sofort halten** auf dem Schuss-Knopf: Ring muss ↪/↩ zeigen (nicht ⚡), der Ball dreht sichtbar ab.
   Klappt es zu selten, `?doppel=0.3` probieren; wird aus einem Doppeltipp versehentlich „halten“, `?tipp=0.15`.
2. **Pass antippen** vs. **halten:** Ein reiner Tipp wartet 0,25 s (ob noch ein 2. Druck kommt) – fühlt sich das träge an?
   Dann `?doppel=0.18`. Halten passt sofort beim Loslassen.
3. **Chip** (Pass tipp + halten) in den Lauf eines Mitspielers, **Hacke**: Stick nach hinten auf einen nahen Mitspieler.
4. **Schuss aus spitzem Winkel** oder mit dem Rücken zum Tor: deutlich schwächer? Zu streng/zu leicht → `?schusshilfe=1.5` bzw. `0.7`.
5. **Training → Volley-Station:** kommt Fallrückzieher/Seitfallzieher/Kopfball zur richtigen Flanke? Zeitlupe angenehm oder nervig (☰ → Zeitlupe)?
6. **Training quer:** alle 9 Übungen ohne Rollen sichtbar, Hilfekarte-Knopf „Verstanden“ unten immer erreichbar.

## Offene Punkte

- Posen sind prozedural (Knochen gedreht) – echte Mixamo-Clips für Volley, Seitfall-/Fallrückzieher, Kopfball, Hacke,
  Außenrist, Chip stehen auf der Liste für Nacht 4.
- Fallrückzieher im Bot-Spiel selten (0,2 je Spiel, noch kein Tor) – in der Volley-Station trifft er 14 von 16.
- Einzeltipp-Pass hat systembedingt 0,25 s Verzögerung (Gesten-Fenster); Halten ist ohne Verzögerung.
- Headless-Touch-Test braucht großzügigere Tipp-Fenster (`?tipp=0.45&doppel=0.6`), weil CDP-Ereignisse 50–250 ms brauchen;
  echte Geräte sollten mit den Standardwerten laufen – das bestätigt nur Peters Handy.
