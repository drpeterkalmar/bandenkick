# n13 Etappe 8/9: Fotos zur Bildprüfung – Jonglier-Fallrückzieher je Phase (Lupfen, Ball oben, Schere im Kontakt, Landung) + Replay,
# je 3 Fälle Megaferse, Lupfer → Direktabnahme, normaler Schuss im Kegel. → tests/shots/fallrueck/, tests/shots/n13/spektakel.jpg
# Aufruf: python3 tests/n13_spektakel_bilder.py [quer|hoch]
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(ROOT, 'tests', 'shots', 'fallrueck'); RAW = os.path.join(FR, 'raw'); N13 = os.path.join(ROOT, 'tests', 'shots', 'n13')
for d in (RAW, N13): os.makedirs(d, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
FORM = sys.argv[1] if len(sys.argv) > 1 else 'quer'


def szene(s, sx, sz, face, opp=None, mate=(-5, 5)):
    s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
    s.frames(2)
    o = opp or (-6, -5)
    s.ev(f"__game.placePlayer({sx}, {sz}, {face}, 1); __game.placePlayer(-9, 0, 0, 0); __game.placePlayer({mate[0]}, {mate[1]}, 0, 2);"
         f" __game.placePlayer(11, 0, Math.PI, 3); __game.placePlayer({o[0]}, {o[1]}, Math.PI, 4); __game.placePlayer(-8, 4, 0, 5);"
         f" __game.placeBall({sx} + Math.cos({face}) * 0.42, 0.11, {sz} + Math.sin({face}) * 0.42); __game.game.rules.updateKeepers(0, true)")
    s.frames(3)


def halt(s, cond, name, timeout=12000, comic=False):
    s.ev(f"__game.freezeWhen({cond!r})")
    try: s.pg.wait_for_function("__game.frozen()", timeout=timeout)
    except Exception: print('  nicht erreicht:', name); s.ev("__game.freezeWhen('false')"); return None
    s.frames(3); time.sleep(0.25); s.frames(1)
    if comic and s.ev("__game.comicNochmal()"): time.sleep(0.45)
    p = os.path.join(RAW, f'{FORM}_{name}.png'); s.pg.screenshot(path=p); print(' ', p, flush=True)
    s.ev("__game.freeze(false)")
    return p


def collage(name, bilder, titel, cols, out):
    from PIL import Image, ImageDraw, ImageFont
    fp = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font = ImageFont.truetype(fp, 18)
    ims = [Image.open(p).convert('RGB') for p, _ in bilder]
    w = 300 if ims[0].height > ims[0].width else 480
    th = [im.resize((w, round(im.height * w / im.width))) for im in ims]
    h0 = max(t.height for t in th); rows = (len(th) + cols - 1) // cols
    C = Image.new('RGB', (cols * w, rows * (h0 + 24) + 32), (14, 14, 16)); d = ImageDraw.Draw(C); d.text((8, 6), titel, font=font, fill='white')
    for i, (t, (_, lab)) in enumerate(zip(th, bilder)):
        x, y = (i % cols) * w, 32 + (i // cols) * (h0 + 24); C.paste(t, (x, y + 24)); d.text((x + 4, y + 3), lab, font=font, fill=(255, 230, 0))
    p = os.path.join(out, name + '.jpg'); C.save(p, quality=84); print(p); return p


def main():
    fr, sp = [], []
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, FORM)
        s.open('?nosw&nohelp&play&startprobe=0&q=2&seed=3&blitze=voll')
        # Jonglier-Fallrückzieher: Rücken zum Tor, frei
        szene(s, 4, 1, 'Math.PI')
        s.ev("__game.replayHold('kontakt', 0.5); __game.press([[0, 0.07, 'shot']])")
        for cond, name, lab, cm in [("g.players[1].tech === 'jongl' && g.players[1].techT > 0.1", 'fr1_lupfen', '1 Lupfen', False),
                                ("g.ball.p.y > 2.1 && g.ball.v.y < 0.4", 'fr2_oben', '2 Ball oben', False),
                                ("g.players[1].lastKick && g.players[1].lastKick.tech === 'fallrueck'", 'fr3_schere', '3 Schere im Kontakt', True),
                                ("g.players[1].fall && g.players[1].fall.t > 0.4", 'fr4_landung', '4 Landung', False)]:
            p = halt(s, cond, name, comic=cm)
            if p: fr.append((p, lab))
        try:
            s.pg.wait_for_function("(() => { const r = __game.replay(); return r.active && r.held; })()", timeout=15000)
            s.frames(3); time.sleep(0.3); p = os.path.join(RAW, f'{FORM}_fr5_replay.png'); s.pg.screenshot(path=p); fr.append((p, '5 Wiederholung')); print(' ', p)
        except Exception: print('  kein Tor/keine Wiederholung')
        s.ev("__game.replayHold(null)")
        # je 3 Fälle: Megaferse (Gegner hinter dem Schützen), Lupfer → Direktabnahme, normaler Schuss im Kegel
        for i, (x, z) in enumerate([(5, 1), (3, -2), (6, 2.5)]):
            szene(s, x, z, 'Math.PI', opp=(x + 1.1, z))
            s.ev("__game.press([[0, 0.07, 'shot']])")
            p = halt(s, "g.players[1].lastKick && g.players[1].lastKick.tech === 'megaferse' && g.players[1].techT > 0.06", f'megaferse{i}', comic=True)
            if p: sp.append((p, f'Megaferse {i + 1}'))
        for i, (x, z, mx, mz) in enumerate([(-2, 1, 6, 2.8), (-1, -1.5, 5, -3), (0, 2, 7, -2.5)]):
            szene(s, x, z, 'Math.PI', mate=(mx, mz))
            s.ev("__game.press([[0, 0.07, 'shot']])")
            p = halt(s, "g.players[2].lastKick && g.players[2].lastKick.t > g.players[1].lastKick?.t && g.players[2].techT > 0.02", f'lupfer{i}', 15000, comic=True)
            if p: sp.append((p, f'Lupfer → Direktabnahme {i + 1}'))
        for i, (x, z) in enumerate([(4, 1), (2, -3), (6, 3)]):
            szene(s, x, z, f'Math.atan2({-z}, {12 - x})')
            s.ev("__game.press([[0, 0.07, 'shot']])")
            p = halt(s, "g.players[1].lastKick && g.players[1].lastKick.kind === 'shot' && g.players[1].techT > 0.06", f'kegel{i}')
            if p: sp.append((p, f'Schuss im Kegel {i + 1}'))
        s.close()
    if fr: collage(f'fallrueck_{FORM}', fr, 'n13 Jonglier-Fallrückzieher: Lupfen, Ball oben, Schere im Kontakt, Landung, Wiederholung', 3, FR)
    if sp: collage(f'spektakel_{FORM}', sp, 'n13 Schusskegel: Megaferse, Lupfer → Direktabnahme, Schuss im Kegel (je 3)', 3, N13)


if __name__ == '__main__':
    main()
