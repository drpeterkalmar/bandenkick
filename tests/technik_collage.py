# Vergleichscollagen vorher/nachher für die Technik (n4) aus den Fotos von tests/technik_shots.py:
#   vorher = Stand vor n4 (im alten Stand fotografiert), nachher = jetzt (Kino-Look, Autopilot-Stufe 1 fest, Fuß-IK).
# → tests/shots/technik/<thema>_<form>.jpg   Aufruf: python3 tests/technik_collage.py
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'tests', 'shots', 'technik_raw')
OUT = os.path.join(ROOT, 'tests', 'shots', 'technik')
os.makedirs(OUT, exist_ok=True)
FONTS = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
FONT = next((f for f in FONTS if os.path.exists(f)), None)
font = lambda s: ImageFont.truetype(FONT, s) if FONT else ImageFont.load_default()

# Thema → (Titel, [(Ordner, Szene, Beschriftung)] je Spalte), Formate
THEMEN = {
    'abend_flutlicht': ('Flutlicht-Abend (Startbildschirm)', [('vorher_abend', '01_menu_szene', 'vorher'), ('nachher_abend', '01_menu_szene', 'nachher')]),
    'abend_spiel': ('Abend im Spiel', [('vorher_abend', '03_anstoss', 'vorher'), ('nachher_abend', '03_anstoss', 'nachher')]),
    'tag_spiel': ('Tag im Spiel', [('vorher', '03_anstoss', 'vorher'), ('nachher', '03_anstoss', 'nachher')]),
    'replay_kontakt': ('Tor-Wiederholung: Kontakt-Zoom', [('vorher', '06_replay_kontakt', 'vorher'), ('nachher', '06_replay_kontakt', 'nachher (Tiefenschärfe)')]),
    'replay_fancam': ('Tor-Wiederholung: Fan-Cam', [('vorher', '06_replay_fancam', 'vorher'), ('nachher', '06_replay_fancam', 'nachher (Tiefenschärfe)')]),
    'fuss_am_ball': ('Fuß am Ball (Replay, Kontakt angehalten)', [('vorher_fuss', 'fuss', 'vorher (ohne IK)'), ('nachher_fuss', 'fuss', 'nachher (Fuß-IK)')]),
    'tribuene': ('Zuschauer / Anlage (Startbildschirm)', [('vorher', '01_menu_szene', 'vorher'), ('nachher', '01_menu_szene', 'nachher')]),
}


def tile(folder, name, form, w):
    p = os.path.join(RAW, folder, f'{form}_{name}.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGB')
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def label(im, text, size):
    d = ImageDraw.Draw(im); f = font(size)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.rounded_rectangle((8, 8, 8 + r - l + 20, 8 + b - t + 16), 8, fill=(0, 0, 0, 160))
    d.text((18, 14 - t), text, font=f, fill='white')


n = 0
for key, (titel, cols) in THEMEN.items():
    for form in ('hoch', 'quer'):
        w = 560 if form == 'hoch' else 900
        tiles = [tile(fo, sz, form, w) for fo, sz, _ in cols]
        if any(t is None for t in tiles): continue
        for t, (_, _, lab) in zip(tiles, cols): label(t, lab, 26 if form == 'hoch' else 24)
        top = 54; H = max(t.height for t in tiles)
        C = Image.new('RGB', (len(tiles) * w + 10 * (len(tiles) - 1), H + top), (24, 24, 24))
        ImageDraw.Draw(C).text((12, 12), titel + f' – {form}', font=font(28), fill='white')
        for k, t in enumerate(tiles): C.paste(t, (k * (w + 10), top))
        C.save(os.path.join(OUT, f'{key}_{form}.jpg'), quality=84); n += 1
print(n, 'Collagen →', os.path.relpath(OUT, ROOT))
