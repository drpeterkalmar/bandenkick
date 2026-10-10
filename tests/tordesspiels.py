# n6 „Tor des Spiels“: Bot-Spiel bis zum Abpfiff (Tore mit Fan-Edit), danach erscheint der Knopf „🏆 Tor des Spiels“;
# Tippen spielt den besten Clip aus seiner eigenen Aufzeichnung, danach läuft die normale Aufzeichnung weiter. 0 Fehler, Ton 0.
# Aufruf: py tests/tordesspiels.py
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    s.open('?nosw&nohelp&play&q=1&startprobe=0&seed=3&action=0&dauer=1.5')
    s.ev("__game.newGame({bots: true, seed: 2})")
    tore = 0
    for _ in range(12):
        r = s.ev("__game.simBis(400, 'goal')")
        if r['score'][0] + r['score'][1] > tore:
            tore = r['score'][0] + r['score'][1]
            s.pg.wait_for_function("__game.replay().active", timeout=20000)
            s.pg.wait_for_function("!__game.replay().active", timeout=30000)
        if s.ev("__game.state().rules.phase") == 'end': break
    s.ev("__game.simBis(400, 'end')"); s.frames(5)
    b = s.ev("__game.besterClip()")
    vis = s.pg.locator('.tds').is_visible()
    s.pg.locator('.tds').click()
    s.pg.wait_for_function("__game.replay().active && __game.replay().edit", timeout=10000)
    pov = s.ev("document.querySelector('.fe-pov').textContent")
    s.pg.wait_for_function("!__game.replay().active", timeout=30000)
    print({'tore': tore, 'besterClip': b, 'knopf_sichtbar': vis, 'pov': pov, 'phase': s.ev("__game.state().rules.phase"), 'fehler': s.errors + s.ev('window.__errors'), 'ton': s.ev('window.__audioCalls')})
    s.b.close()
