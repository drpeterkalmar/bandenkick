# n13 Etappe 1 (Peter 07.11.: „replayzoom weiter entfernt“): Kontakt-Zeitlupe der Tor-Wiederholung, Bot gegen Bot (feste Seeds),
# je Tor angehalten am Ballkontakt – klassisch (Kamera 'zoom') und Fan-Edit (Kamera 'makro'), ?replayweit=1 (0.9.1) gegen den
# Standard (2). Collage nach tests/shots/n13/replay_weit.jpg, Einzelbilder nach tests/shots/n13/raw/.
# Aufruf: python3 tests/n13_replay_bilder.py [hoch|quer] [seed,seed,…]
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'n13'); RAW = os.path.join(OUT, 'raw')
os.makedirs(RAW, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORM = args[0] if args else 'quer'
SEEDS = [int(x) for x in args[1].split(',')] if len(args) > 1 else [1, 2, 4]


def collage(name, bilder, titel, cols):
    from PIL import Image, ImageDraw, ImageFont
    fp = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font = (lambda n: ImageFont.truetype(fp, n)) if os.path.exists(fp) else (lambda n: ImageFont.load_default())
    ims = [Image.open(p).convert('RGB') for p, _ in bilder]
    w = 300 if ims[0].height > ims[0].width else 480
    th = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
    h0 = max(t.height for t in th); rows = (len(th) + cols - 1) // cols
    C = Image.new('RGB', (cols * w, rows * (h0 + 24) + 34), (14, 14, 16))
    d = ImageDraw.Draw(C); d.text((8, 6), titel, font=font(20), fill='white')
    for i, (t, (_, lab)) in enumerate(zip(th, bilder)):
        x, y = (i % cols) * w, 34 + (i // cols) * (h0 + 24)
        C.paste(t, (x, y + 24)); d.text((x + 4, y + 3), lab, font=font(15), fill=(255, 230, 0))
    p = os.path.join(OUT, name + '.jpg'); C.save(p, quality=84); return p


def main():
    bilder = []
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, FORM)
        for weit in ['1', '2']:
            for art in ['klassisch', 'edit']:
                s.open(f'?nosw&nohelp&play&startprobe=0&q=2&seed=3&blitze=sanft&replayweit={weit}&fancam={"1" if art == "edit" else "0"}')
                for seed in SEEDS:
                    s.ev(f"__game.replayHold(null); __game.editHalt(null); __game.replayArt('{art}'); __game.newGame({{bots: true, seed: {seed}}})")
                    if art == 'klassisch': s.ev("__game.replayHold('kontakt', 0.55)")
                    s.ev("__game.simBis(400)")
                    s.pg.wait_for_function("__game.replay().active", timeout=30000)
                    if art == 'edit':
                        # bis die Makro-Einstellung läuft, dann kurz danach anhalten
                        s.pg.wait_for_function("(() => { const r = __game.replay(); return !r.active || (r.edit && r.edit.cam === 'makro'); })()", timeout=30000, polling=16)
                        r = s.ev("__game.replay()")
                        if not r['active']: print('  kein Makro', seed); continue
                        s.ev(f"__game.editHalt({r['real'] + 0.12})")
                    try: s.pg.wait_for_function("(() => { const r = __game.replay(); return r.active && r.held; })()", timeout=20000)
                    except Exception: print('  nicht angehalten', weit, art, seed); continue
                    s.frames(3); time.sleep(0.4); s.frames(1)
                    r = s.ev("__game.replay()")
                    p = os.path.join(RAW, f'{FORM}_{art}_w{weit}_s{seed}.png'); s.pg.screenshot(path=p)
                    bilder.append((p, f"{'Fan-Edit' if art == 'edit' else 'Normal'} weit={weit} Seed {seed} {(r.get('label') or '')[:34]}"))
                    print(' ', p, r.get('phase'), r.get('label'), flush=True)
                    s.ev("__game.replayHold(null); __game.editHalt(null)")
                    try: s.ev("__game.skipReplay && __game.skipReplay()")
                    except Exception: pass
        s.close()
    # Reihen: je Art und Seed weit=1 neben weit=2
    paare = []
    for art in ['Normal', 'Fan-Edit']:
        for seed in SEEDS:
            for w in ['1', '2']:
                paare += [b for b in bilder if b[1].startswith(f'{art} weit={w} Seed {seed} ')]
    print(collage(f'replay_weit_{FORM}', paare, 'n13 Replay-Kontakt: links ?replayweit=1 (0.9.1), rechts Standard 2', 4))


if __name__ == '__main__':
    main()
