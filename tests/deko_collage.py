# Vergleichscollagen vorher/nachher/Abend aus den Fotos von tests/deko_shots.py (vorher = alter Stand bzw. ?deko=0,
# nachher = Tag, abend = ?licht=abend) → tests/shots/deko/vergleich_*.jpg
# Aufruf: python3 tests/deko_collage.py
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'tests', 'shots', 'deko_raw')
OUT = os.path.join(ROOT, 'tests', 'shots', 'deko')
os.makedirs(OUT, exist_ok=True)
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font = lambda s: ImageFont.truetype(FONT, s)
COLS = {'vorher': 'vorher', 'nachher': 'nachher (Tag)', 'abend': 'nachher (Abend)'}


def tile(variant, name, w=None, h=None):
    p = os.path.join(RAW, variant, name + '.png')
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert('RGB')
    if w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    elif h: im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    return im


def label(im, text, size=30, pos='tl'):
    d = ImageDraw.Draw(im)
    f = font(size)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    x, y = (12, 10) if pos == 'tl' else (12, im.height - (b - t) - 22)
    d.rounded_rectangle((x - 8, y - 6, x + r - l + 8, y + b - t + 12), 10, fill=(0, 0, 0))
    d.text((x - l, y - t + 2), text, font=f, fill=(255, 216, 74))
    return im


def grid(rows, cols, cellw, cellh, title, path, gap=8):
    """rows: Liste von (Zeilentitel, [Bild oder None je Spalte])"""
    head = 70
    W = len(cols) * cellw + (len(cols) + 1) * gap
    H = head + len(rows) * (cellh + gap) + gap
    S = Image.new('RGB', (W, H), (18, 26, 22))
    d = ImageDraw.Draw(S)
    d.text((gap, 14), title, font=font(34), fill=(255, 255, 255))
    for j, c in enumerate(cols):
        d.text((gap + j * (cellw + gap) + 6, 50), c, font=font(18), fill=(200, 210, 200))
    for i, (rt, ims) in enumerate(rows):
        for j, im in enumerate(ims):
            x, y = gap + j * (cellw + gap), head + gap + i * (cellh + gap)
            if im is None:
                d.rectangle((x, y, x + cellw, y + cellh), fill=(40, 40, 40)); continue
            im = im.copy()
            if im.size != (cellw, cellh):
                im = im.resize((cellw, round(im.height * cellw / im.width)), Image.LANCZOS).crop((0, 0, cellw, cellh))
            label(im, f'{rt} · {cols[j]}', 22)
            S.paste(im, (x, y))
    S.save(path, quality=84, optimize=True)
    print(path, S.size, round(os.path.getsize(path) / 1e3), 'KB')


if __name__ == '__main__':
    V = ['vorher', 'nachher', 'abend']
    # Querformat: Szenen untereinander, Spalten vorher / Tag / Abend
    scenes = [('Startbildschirm', 'quer_02_menu_szene'), ('Anstoß', 'quer_03_anstoss'), ('Tor-Jubel', 'quer_05_jubel'),
              ('Wiederholung Fan-Cam', 'quer_06_replay_fancam'), ('Wiederholung TV', 'quer_06_replay_aufbau')]
    rows = [(t, [tile(v, n, w=780) for v in V]) for t, n in scenes]
    grid(rows, [COLS[v] for v in V], 780, 351, 'Bandenkick – Verschönerung: Querformat (Handy 915 × 412)', os.path.join(OUT, 'vergleich_quer.jpg'))
    # Hochformat: Szenen nebeneinander, Zeilen vorher / Tag / Abend
    hs = [('Start', 'hoch_02_menu_szene'), ('Anstoß', 'hoch_03_anstoss'), ('Tor-Jubel', 'hoch_05_jubel'), ('Fan-Cam', 'hoch_06_replay_fancam'), ('TV', 'hoch_06_replay_aufbau')]
    cw, ch = 300, 666
    head, gap = 70, 8
    W = len(hs) * (cw + gap) + gap + 120; H = head + 3 * (ch + gap) + gap
    S = Image.new('RGB', (W, H), (18, 26, 22)); d = ImageDraw.Draw(S)
    d.text((gap, 14), 'Bandenkick – Verschönerung: Hochformat (Handy 412 × 915)', font=font(30), fill=(255, 255, 255))
    for i, v in enumerate(V):
        y = head + gap + i * (ch + gap)
        d.text((gap, y + ch // 2 - 12), COLS[v].replace(' (', '\n('), font=font(20), fill=(255, 216, 74))
        for j, (t, n) in enumerate(hs):
            im = tile(v, n, w=cw)
            x = 120 + gap + j * (cw + gap)
            if im is None: d.rectangle((x, y, x + cw, y + ch), fill=(40, 40, 40)); continue
            im = im.crop((0, 0, cw, ch)); label(im, t, 20); S.paste(im, (x, y))
    p = os.path.join(OUT, 'vergleich_hoch.jpg'); S.save(p, quality=84, optimize=True); print(p, S.size, round(os.path.getsize(p) / 1e3), 'KB')
    # Effekte (quer und hoch): vorher / nachher
    eff = [('Tor: Konfetti + Jubel', '08_konfetti_a'), ('harter Schuss: Ballspur', '10_ballspur'), ('Grätsche: Rasenfetzen', '09_graetsche_a'),
           ('Rutschspur danach', '09_graetsche_b'), ('Rückennummer', '11_nummer'), ('Training: Ergebnis', '07_training_ergebnis')]
    rows = [(t, [tile(v, 'quer_' + n, w=900) for v in ['vorher', 'nachher']]) for t, n in eff]
    grid(rows, ['vorher', 'nachher'], 900, 405, 'Bandenkick – Effekte und Rückmeldung (quer)', os.path.join(OUT, 'vergleich_effekte_quer.jpg'))
    rows = [(t, [tile(v, 'hoch_' + n, w=340) for v in ['vorher', 'nachher', 'abend']]) for t, n in eff[:3]]
    grid(rows, ['vorher', 'nachher (Tag)', 'nachher (Abend)'], 340, 755, 'Effekte (hoch)', os.path.join(OUT, 'vergleich_effekte_hoch.jpg'))
