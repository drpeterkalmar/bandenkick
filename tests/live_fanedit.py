# n6: Live-Prüfung (GitHub Pages): lädt die Seite, prüft Build, startet ein Bot-Tor mit Fan-Edit, Fehler und Ton = 0.
# Aufruf: py tests/live_fanedit.py [build]
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Session, sync_playwright, ARGS
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
URL = 'https://drpeterkalmar.github.io/bandenkick/'
with sync_playwright() as pw:
    s = Session(pw, URL, 'hoch')
    s.open(f'?nosw&nohelp&play&startprobe=0&x={int(time.time())}')
    b = s.ev("__game.build")
    s.ev("__game.newGame({bots: true, seed: 8})"); s.ev("__game.simBis(400)")
    s.pg.wait_for_function("__game.replay().active && __game.replay().edit", timeout=30000)
    seen = set()
    while s.ev("__game.replay().active"):
        r = s.ev("__game.replay()"); seen.add(r['phase']); time.sleep(0.1)
    print('build', b, 'erwartet', sys.argv[1] if len(sys.argv) > 1 else '-', '| Einstellungen', sorted(seen), '| Fehler', s.errors + s.ev("window.__errors"), '| Ton', s.ev("window.__audioCalls"))
    s.b.close()
