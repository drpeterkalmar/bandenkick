# Fotos Nacht 2c (hoch/quer): Auto-Torwart hechtet, Grätsche, feste Flanke, großes Feld 24 × 15.
# Aufruf: python3 tests/shots4.py [final]  → tests/shots/final/n2c_*.jpg (sonst tests/shots/dev)
import sys, time
sys.path.insert(0, 'tests')
from util import *
sub = sys.argv[1] if len(sys.argv) > 1 else 'dev'

def freeze_shot(s, name, setup, cond, timeout=12000):
    s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
    s.frames(3)
    s.ev(setup)
    s.ev(f"__game.freezeWhen({cond!r})")
    try: s.pg.wait_for_function("__game.frozen()", timeout=timeout)
    except Exception: print('  (nicht eingefroren)', name)
    s.frames(4)
    p = s.shot(name, sub); print(p)
    s.ev("__game.freeze(false)")

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer']):
        if i: s.new_context(form)
        s.open('?nosw&seed=11&play&q=2&nohelp')
        hx = s.ev("__game.game.cage.hx")
        # 1) Auto-Torwart hechtet (Mensch = Orange 0, keine Knöpfe)
        freeze_shot(s, f'n2c_hechten_{form}',
            f"__game.bots(true); __game.human(0); __game.placePlayer({-hx + 1.0}, -0.6, 0, 0); __game.placePlayer(-2, 5, 0, 1); __game.placePlayer(-2, -5, 0, 2); __game.kick({{from:[{-hx + 9.5}, 0.3, -2], v:[-19.5, 1.6, 6.6], w:[0,0,0]}})",
            "g.players[0].hand.mode === 'dive' && g.players[0].hand.t > 0.16")
        # 2) Grätsche: Orange 1 grätscht Blau 4 den Ball weg (Schuss-Knopf)
        freeze_shot(s, f'n2c_graetsche_{form}',
            "__game.human(1); __game.placePlayer(-2.2, 0.4, 0, 1); __game.placePlayer(0.4, 0.5, 0, 4); __game.placeBall(0.0, 0.11, 0.45); __game.game.lastTouch = 4; __game.press([[0, 0.07, 'shot']])",
            "g.players[1].slide && g.players[1].slide.phase === 'slide' && g.players[1].slide.t > 0.22")
        # 3) Feste Flanke: Orange 1 vom Flügel (Doppeltipp Pass) auf Orange 2 im Torraum
        freeze_shot(s, f'n2c_flanke_{form}',
            f"__game.human(1); __game.placePlayer({hx - 7.5}, 5.2, -0.9, 1); __game.placeBall({hx - 7.1}, 0.11, 4.9); __game.placePlayer({hx - 2.6}, 0.3, 0, 2); __game.placePlayer({hx - 1}, 0, Math.PI, 3); __game.press([[0, 0.06, 'pass'], [0.14, 0.2, 'pass']], [{5.0}, {-4.8}], 0.3)",
            "g.players[1].lastKick && g.players[1].lastKick.chip && g.ball.p.y > 0.9 && g.ball.v.y < 0.3")
        # 4) Großes Feld mit Bots
        s.ev("__game.freeze(false); __game.newGame(); __game.human(-1)")
        s.wait_sim(5.0, timeout=120000)
        print(s.shot(f'n2c_feld_{form}', sub))
    errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
    print('Fehler:', errs[:3])
    s.close()
