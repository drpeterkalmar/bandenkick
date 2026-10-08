# Foto „Fuß am Ball“ (n4 Fuß-IK): Schuss aus 9 m wie tests/deko_scenes.py replay_shots, Wiederholung im Abschnitt
# „kontakt“ bei einem festen Anteil angehalten (extremer Zoom auf Fuß und Ball). Hoch + quer.
# Aufruf: python3 tests/technik_fuss.py <name> [url-zusatz] [anteil=0.15]  → tests/shots/technik_raw/<name>/<form>_fuss.png
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import *
import deko_scenes as S
name = sys.argv[1]; extra = sys.argv[2] if len(sys.argv) > 2 else ''; fr = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(('hoch', 'quer')):
        if i: s.new_context(form)
        S.open_ready(s, '?nosw&seed=3&q=1&nohelp&play&startprobe=0' + extra)
        hx = s.ev("__game.game.cage.hx")
        s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
        s.frames(3)
        s.ev(f"__game.placePlayer({hx - 9.4}, 1.2, -0.12, 1); __game.placeBall({hx - 9.0}, 0.11, 1.15); __game.placePlayer({hx - 0.6}, -2.6, Math.PI, 3);"
             f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer(-3, 3, 0, 2)")
        s.frames(2)
        s.ev(f"__game.replayHold('kontakt', {fr}); __game.press([[0, 0.07, 'shot']], [1, -0.25], 0.3)")
        s.pg.wait_for_function("(() => { const r = __game.replay(); return r.held && r.phase === 'kontakt'; })()", timeout=40000)
        s.frames(4); s.shot(f'{form}_fuss', os.path.join('technik_raw', name))
        print(form, s.ev("__game.info().figuren"), s.errors[:3])
    s.close()
