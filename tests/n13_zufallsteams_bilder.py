# n13 Zufallsteams + Tiernamen: zwei Matches (Seed) mit verschiedener Verteilung, Leibchenfarbe = Mannschaft, Wiederholung mit
# Tiername in der Einblendung, ?zufallsteams=0 = feste Besetzung, 0 Seitenfehler. → tests/shots/zufallsteams/
# Aufruf: python3 tests/n13_zufallsteams_bilder.py [quer|hoch]
import os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'zufallsteams'); os.makedirs(OUT, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
FORM = sys.argv[1] if len(sys.argv) > 1 else 'quer'
FARBE = {0: 0xff6a13, 1: 0x1f6fff}
fails = []
def ok(c, m):
    print(('  ✅ ' if c else '  ❌ ') + m, flush=True)
    if not c: fails.append(m)


def aufstellung(s):
    # alle sechs nebeneinander vor der Kamera (Orange links, Blau rechts), Blick zur Kamera
    s.ev("__game.bots(false); __game.game.rules.phase = 'play'")
    for i in range(6):
        x = -3.2 + i * 1.3 + (0.5 if i >= 3 else 0)
        s.ev(f"__game.placePlayer({x}, 4.6, Math.PI / 2, {i})")
    s.ev("__game.placeBall(0, 0.11, 2)"); s.frames(4); time.sleep(0.4); s.frames(2)


def main():
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, FORM)
        errs = []
        s.pg.on('pageerror', lambda e: errs.append(str(e)))
        s.open('?nosw&nohelp&play&startprobe=0&q=2&seed=5&fancam=0')
        verteilungen = []
        for m in range(2):
            s.ev("__game.newGame()"); s.frames(3)
            T = s.ev("__game.teams()")
            verteilungen.append([t['tier'] for t in T])
            ok(sum(1 for t in T[:3] if t['team'] == 0) == 3 and sum(1 for t in T[3:] if t['team'] == 1) == 3, f"Match {m + 1}: 3 Orange / 3 Blau: {[t['tier'] for t in T]}")
            ok(all(t['farbe'] == FARBE[t['team']] for t in T), f"Match {m + 1}: Leibchenfarbe = Mannschaft")
            ok(T[1]['name'] and '(du)' in T[1]['name'], f"Match {m + 1}: du bist {T[1]['name']}")
            aufstellung(s)
            s.pg.screenshot(path=os.path.join(OUT, f'{FORM}_match{m + 1}.png'))
        ok(verteilungen[0] != verteilungen[1], 'zwei Matches, verschiedene Verteilung')
        # Wiederholung mit Tiername: Bot-Tor, klassische Wiederholung, angehalten im Kontakt
        s.ev("__game.replayHold(null); __game.replayArt('klassisch'); __game.newGame({bots: true, seed: 4})")
        s.ev("__game.replayHold('kontakt', 0.5)")
        s.ev("__game.simBis(400)")
        try:
            s.pg.wait_for_function("(() => { const r = __game.replay(); return r.active && r.held; })()", timeout=30000)
            s.frames(3); time.sleep(0.4)
            r = s.ev("__game.replay()"); T = s.ev("__game.teams()")
            s.pg.screenshot(path=os.path.join(OUT, f'{FORM}_replay.png'))
            ok(any(t['tier'] and r['label'].startswith(t['tier']) for t in T), f"Wiederholung zeigt den Tiernamen: „{r['label']}“")
        except Exception as e: ok(False, f'Wiederholung nicht erreicht: {e}')
        s.ev("__game.replayHold(null)")
        s.close()
        # ?zufallsteams=0: feste Besetzung wie 0.9.x
        s = Session(pw, srv.base, FORM)
        s.pg.on('pageerror', lambda e: errs.append(str(e)))
        s.open('?nosw&nohelp&play&startprobe=0&q=1&zufallsteams=0')
        for m in range(2):
            s.ev("__game.newGame()"); s.frames(2)
            T = s.ev("__game.teams()")
            ok([t['tier'] for t in T] == ['Teddy', 'Fuchs', 'Katze', 'Hase', 'Panda', 'Elefant'], f"?zufallsteams=0 Match {m + 1}: {[t['tier'] for t in T]}")
        s.close()
        ok(not errs, f'0 Seitenfehler {errs[:3]}')
    from PIL import Image, ImageDraw, ImageFont
    ims = [(os.path.join(OUT, f'{FORM}_{n}.png'), l) for n, l in [('match1', 'Match 1'), ('match2', 'Match 2'), ('replay', 'Wiederholung')] if os.path.exists(os.path.join(OUT, f'{FORM}_{n}.png'))]
    w = 640; th = [Image.open(p).convert('RGB') for p, _ in ims]; th = [i.resize((w, round(i.height * w / i.width))) for i in th]
    C = Image.new('RGB', (w * len(th), th[0].height + 30), (14, 14, 16)); d = ImageDraw.Draw(C); f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
    for k, (t, (_, l)) in enumerate(zip(th, ims)): C.paste(t, (k * w, 30)); d.text((k * w + 6, 6), l, font=f, fill=(255, 230, 0))
    C.save(os.path.join(OUT, f'zufallsteams_{FORM}.jpg'), quality=84)
    print('ROT' if fails else 'GRÜN', len(fails))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
