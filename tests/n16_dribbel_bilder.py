# n16 Dribbeltricks: Bildfolge eines freien Tricks aus der Standard-Spielkamera (Pixel 7 quer, wie Peters Handy) – je Trick 4 Bilder
# (u ≈ 0,15 / 0,4 / 0,65 / 0,9 der Trickdauer), dazu Ausschnitt um den Spieler. Prüffrage (Vision): Ball und Fuß im Trick sichtbar?
# Aufruf: py tests/n16_dribbel_bilder.py [Versuche=7] → tests/shots/n16/trick_<id>.jpg (Collage), trick_alle.jpg
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'n16'); RAW = os.path.join(OUT, 'raw'); os.makedirs(RAW, exist_ok=True)
TRICKS = ['uebersteiger', 'croqueta', 'elastico', 'sohle', 'hackehacke', 'roulette', 'mcgeady']
N = int(sys.argv[1]) if len(sys.argv) > 1 else 7
res = {}
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'quer')
    s.open('?nosw&nohelp&play&startprobe=0&seed=3&action=0&replay=0')
    W, H = s.pg.viewport_size['width'], s.pg.viewport_size['height']
    for v in range(N):
        s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
        s.ev("""(() => { const g = __game.game, P = g.P, me = g.players[g.human]; P.dribbelMensch = 1; P.dribbelAnnahme = 99;
          let k = 0; for (const p of g.players) if (p !== me) { p.place(p.team === me.team ? -9 : 8, -5 + 3.3 * (k++ % 4), Math.PI); }
          me.place(-4, 0.5, 0); g.ball.place(-3.62, g.ball.r, 0.5); g.ball.held = -1; g.lastTouch = me.id; g.lastTouchT = g.t; me.besitzT = -5; me.dribbelEp = null; me.skill2 = null; })()""")
        s.ev(f"window.BK_TRICK_NUR = {TRICKS[v % len(TRICKS)]!r}; document.querySelector('.banner').classList.remove('on')")
        s.ev("__game.input({ sx: 1, sy: 0 }, 3)")
        fr = []; tid = None
        for u in (0.15, 0.4, 0.65, 0.9):
            s.ev(f"__game.freezeWhen('g.players[g.human].skill2 && g.players[g.human].skill2.frei && g.players[g.human].skill2.t >= {u} * g.players[g.human].skill2.dur')")
            try: s.pg.wait_for_function("__game.frozen()", timeout=8000)
            except Exception: s.ev("__game.freezeWhen('false')"); break
            s.frames(3)
            info = s.ev("(() => { const g = __game.game, me = g.players[g.human]; return { id: me.skill2.id, x: me.x, z: me.z, bx: g.ball.p.x, bz: g.ball.p.z }; })()")
            tid = info['id']
            p = os.path.join(RAW, f'trick{v}_{len(fr)}.png'); s.pg.screenshot(path=p)
            # Bildposition des Spielers für den Ausschnitt
            sp = s.ev(f"__game.project ? __game.project([{info['x']}, 0.8, {info['z']}]) : null")
            fr.append((p, u, sp))
            s.ev("__game.freeze(false)")
        if len(fr) == 4 and tid not in res:
            ims = []
            for p, u, sp in fr:
                im = Image.open(p).convert('RGB'); sc = im.width / W
                cx, cy = (sp[0] * sc, sp[1] * sc) if sp else (im.width / 2, im.height / 2)
                box = (int(cx - 240), int(cy - 200), int(cx + 240), int(cy + 160))
                ims.append(im.crop(box).resize((360, 270)))
            C = Image.new('RGB', (1440, 300), (14, 14, 16)); d = ImageDraw.Draw(C)
            d.text((6, 4), f'{tid} (Ausschnitt aus der Spielkamera, Handy quer)', fill='white')
            for i, (im, (_, u, _s)) in enumerate(zip(ims, fr)): C.paste(im, (i * 360, 26)); d.text((i * 360 + 6, 28), f'u={u}', fill=(255, 230, 0))
            C.save(os.path.join(OUT, f'trick_{tid}.jpg'), quality=85)
            Image.open(fr[1][0]).convert('RGB').save(os.path.join(OUT, f'trick_{tid}_voll.jpg'), quality=80)
            res[tid] = True
        print(v, tid, len(fr), flush=True)
    s.close()
json.dump(res, open(os.path.join(OUT, 'tricks.json'), 'w'))
