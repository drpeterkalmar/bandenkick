# n14 (Peter 13.11.2026: „Spielfiguren bekommen kürzeren Torso“): Bewegungs-Kontaktabzug aus dem Prüfstand (tools/kuscheltier_view.html),
# je Pose links 0.10.0 (?tierform=2), rechts n14 (kürzerer Rumpf) – Laufen, Schuss, Kopfball (Stand und Luft), Fallrückzieher,
# Seitfallzieher, Salto-Hacke, Hechtsprung, Ball halten, Jubel, Gesichter nah. Ein Browser, stumm.
# Aufruf: python3 tests/n14_tiere_bilder.py   → tests/shots/n14/tiere_bewegungen.jpg (+ je Pose pose_<name>.jpg)
import sys, os, math
sys.path.insert(0, 'tests')
from util import *

RAW = os.path.join(ROOT, 'tests', 'shots', 'n14_raw'); os.makedirs(RAW, exist_ok=True)
OUT = os.path.join(ROOT, 'tests', 'shots', 'n14'); os.makedirs(OUT, exist_ok=True)
POSEN = [('laufen', 70), ('schuss', 60), ('kopfball', 40), ('kopf', 40), ('fallrueck', 70), ('seitfall', 60), ('salto', 70), ('hecht', 15), ('halten', 20), ('jubel', 20), ('stehen', 20, '&nah=1')]


def main():
    from PIL import Image, ImageDraw, ImageFont
    files = []
    with Server() as srv, sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1300, 'height': 640}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for p in POSEN:
            for tf, tag in (('&tierform=2', '0.10.0'), ('', 'n14')):
                pg.goto(f"{srv.base}tools/kuscheltier_view.html?pose={p[0]}&yaw={p[1]}{p[2] if len(p) > 2 else ''}&tormann={1 if p[0] in ('halten', 'hecht') else 0}{tf}")
                pg.wait_for_function('window.__ready === true', timeout=90000)
                fn = os.path.join(RAW, f"{p[0]}_{tag}.png"); pg.screenshot(path=fn); files.append((f"{p[0]} – {tag}", fn))
        b.close()
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24)
    w, h = 650, 320
    C = Image.new('RGB', (2 * w, math.ceil(len(files) / 2) * h), (16, 16, 18)); dr = ImageDraw.Draw(C)
    for i, (n, fn) in enumerate(files):
        x, y = (i % 2) * w, (i // 2) * h
        C.paste(Image.open(fn).convert('RGB').resize((w, h), Image.LANCZOS), (x, y)); dr.text((x + 8, y + 22), n, font=font, fill=(255, 220, 0))
    p = os.path.join(OUT, 'tiere_bewegungen.jpg'); C.save(p, quality=80)
    for k in range(0, len(files), 2):
        P2 = Image.new('RGB', (2 * w, h), (16, 16, 18)); d2 = ImageDraw.Draw(P2)
        for c in range(2):
            n, fn = files[k + c]; P2.paste(Image.open(fn).convert('RGB').resize((w, h), Image.LANCZOS), (c * w, 0)); d2.text((c * w + 8, 22), n, font=font, fill=(255, 220, 0))
        P2.save(os.path.join(OUT, f"pose_{files[k][0].split(' ')[0]}.jpg"), quality=82)
    print('Bewegungen', p, 'Fehler', errs)


if __name__ == '__main__':
    main()
