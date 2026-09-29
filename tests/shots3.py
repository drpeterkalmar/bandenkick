# Fotos Nacht 2b (Ballgefühl): Aufladering mit Modus (Schuss angeschnitten, Pass hoch), Training-Menü, Hinweiskarte,
# Torwand, Fallrückzieher, Kopfball, Hilfekarte, Ergebnis – Handy hoch/quer (Desktop optional).
# Aufruf: python3 tests/shots3.py [unterordner] [formate…]   (Standard: final, hoch quer)
import sys, json
sys.path.insert(0, 'tests')
from util import *
sub = sys.argv[1] if len(sys.argv) > 1 else 'final'
forms = sys.argv[2:] or ['hoch', 'quer']

def freeze_at(s, cond, sec=90):
    s.ev(f"__game.freezeWhen({json.dumps(cond)})")
    t0 = s.ev("__game.game.t")
    s.pg.wait_for_function(f"__game.frozen() || __game.game.t > {t0 + sec}", timeout=int(sec / 0.3 * 1000))
    s.frames(4)
    return s.ev("__game.frozen()")

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        q = '2' if f == 'desktop' else '1'
        res = {}
        # 1) Hilfekarte beim ersten Start
        s.open(f'?nosw&solo=1&seed=3&q={q}')
        s.tap('[data-act="play"]'); s.frames(3)
        s.shot(f'n2b_{f}_01_hilfe', sub)
        s.tap('[data-act="helpok"]'); s.frames(3)
        # 2) Aufladering: Schuss tipp + halten (angeschnitten), Pass tipp + halten (hoch)
        s.ev("__game.bots(false); __game.placePlayer(-4, 1.5, 0); __game.placeBall(-3.6, 0.11, 1.5)"); s.frames(3)
        s.ev("__game.press([[0, 0.05, 'shot'], [0.12, 2.0, 'shot']])")
        s.wait_sim(0.7); s.ev("__game.freeze(true)"); s.frames(4)
        res['ring_schuss'] = s.ev("document.querySelector('#bShot .sym').textContent")
        s.shot(f'n2b_{f}_02_ring_schuss', sub)
        s.ev("__game.freeze(false)"); s.wait_sim(1.8)
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0)"); s.frames(3)
        s.ev("__game.press([[0, 0.05, 'pass'], [0.12, 1.0, 'pass']])")
        s.wait_sim(0.45); s.ev("__game.freeze(true)"); s.frames(4)
        res['ring_pass'] = s.ev("document.querySelector('#bPass .sym').textContent")
        s.shot(f'n2b_{f}_03_ring_pass', sub)
        s.ev("__game.freeze(false)"); s.wait_sim(1.0)
        # 3) Training-Menü und Hinweiskarte
        s.ev("document.querySelector('.iconbtn').click()"); s.frames(3)
        s.tap('[data-act="trainmenu"]:visible'); s.frames(3)
        s.shot(f'n2b_{f}_04_training', sub)
        res['small_training'] = s.small_buttons()
        s.tap('[data-act="challenge"][data-id="torwand"]'); s.frames(3)
        s.shot(f'n2b_{f}_05_hinweis_torwand', sub)
        # 4) Torwand: Skript-Spieler schießt, Foto mit Ball im Flug
        s.tap('[data-act="chgo"]'); s.frames(3)
        s.ev("__game.autoplay(true)")
        res['torwand'] = freeze_at(s, "g.challenge && Math.hypot(g.ball.v.x, g.ball.v.y, g.ball.v.z) > 10 && Math.hypot(g.ball.p.x - g.players[0].x, g.ball.p.z - g.players[0].z) > 4", 40)
        s.shot(f'n2b_{f}_06_torwand', sub)
        s.ev("__game.freeze(false)")
        # 5) Volley-Station: Fallrückzieher und Kopfball kurz vor dem Treffpunkt
        s.ev("__game.autoplay(false); __game.challenge('volley')"); s.frames(3)
        s.ev("__game.autoplay(true)")
        res['fallrueck'] = freeze_at(s, "g.players[0].air && g.players[0].air.go && g.players[0].air.tech === 'fallrueck' && g.players[0].air.tc - g.t < 0.03", 120)
        s.shot(f'n2b_{f}_07_fallrueckzieher', sub)
        s.ev("__game.freeze(false)")
        res['kopf'] = freeze_at(s, "g.players[0].air && g.players[0].air.go && g.players[0].air.tech === 'kopf' && g.players[0].air.tc - g.t < 0.03", 120)
        s.shot(f'n2b_{f}_08_kopfball', sub)
        s.ev("__game.freeze(false)")
        # 6) Ergebnis mit Sternen: Serie zu Ende spielen
        s.pg.wait_for_function("__game.state().mode === 'result'", timeout=400000)
        s.frames(3)
        s.shot(f'n2b_{f}_09_ergebnis', sub)
        res['small_result'] = s.small_buttons()
        s.ev("__game.autoplay(false)")
        print(f, json.dumps(res, ensure_ascii=False))
        print('  errors', s.errors[:6], s.ev('window.__errors'))
    s.close()
