# Baut die ausgelieferten Assets aus assets_src/ (vorher: python3 tools/fetch_assets.py).
#  - assets/hdri/env_1k.hdr   Umgebungslicht (Poly Haven, CC0, unverändert)
#  - assets/hdri/sky.jpg      Himmel/Horizont (obere Halbkugel + 8° darunter), tonemapped (Khronos PBR Neutral)
#  - assets/hdri/sky.json     Sonnenrichtung aus dem hellsten Bereich, Horizont-/Bodenfarbe
#  - assets/tex/turf_*.jpg    Kunstrasen: ambientCG Grass005 umgefärbt + eigene Faser-Normalmap
#  - assets/tex/grass_*.jpg   Naturrasen außerhalb des Käfigs: ambientCG Grass004
#  - icons/*.png              App-Icons (eigene Zeichnung)
import json, os, re, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src')
OUT = os.path.join(ROOT, 'assets')
os.makedirs(os.path.join(OUT, 'hdri'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'tex'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'icons'), exist_ok=True)
rng = np.random.default_rng(4711)

def blur(a, sigma, wrap=False):
    # separierbarer Gauß (numpy), optional kachelbar (wrap)
    r = int(3 * sigma + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    mode = 'wrap' if wrap else 'edge'
    for ax in (0, 1):
        pad = [(0, 0), (0, 0)]; pad[ax] = (r, r)
        b = np.pad(a, pad, mode=mode)
        a = sum(k[i] * np.take(b, range(i, i + a.shape[ax]), axis=ax) for i in range(2 * r + 1))
    return a

def read_hdr(path):
    data = open(path, 'rb').read(); i = 0
    while True:
        j = data.index(b'\n', i); line = data[i:j].decode('ascii', 'ignore'); i = j + 1
        if line == '': break
    j = data.index(b'\n', i); res = data[i:j].decode(); i = j + 1
    m = re.match(r'-Y (\d+) \+X (\d+)', res); H, W = int(m.group(1)), int(m.group(2))
    buf = np.frombuffer(data, dtype=np.uint8, offset=i); out = np.zeros((H, W, 4), np.uint8); p = 0
    for y in range(H):
        if buf[p] == 2 and buf[p + 1] == 2:
            p += 4
            for c in range(4):
                x = 0; row = out[y, :, c]
                while x < W:
                    n = int(buf[p]); p += 1
                    if n > 128:
                        n -= 128; row[x:x + n] = buf[p]; p += 1
                    else:
                        row[x:x + n] = buf[p:p + n]; p += n
                    x += n
        else:
            out[y] = buf[p:p + W * 4].reshape(W, 4); p += W * 4
    rgb = out[..., :3].astype(np.float32); e = out[..., 3].astype(np.float32)
    f = np.where(e > 0, np.ldexp(1.0, (e - 136).astype(np.int32)), 0.0)
    return rgb * f[..., None]

def neutral_tonemap(c):
    # Khronos PBR Neutral (wie THREE.NeutralToneMapping)
    start, desat = 0.8 - 0.04, 0.15
    x = c.min(axis=-1, keepdims=True)
    offset = np.where(x < 0.08, x - 6.25 * x * x, 0.04)
    c = c - offset
    peak = c.max(axis=-1, keepdims=True)
    d = 1 - start
    newPeak = 1 - d * d / (peak + d - start)
    scaled = c * (newPeak / np.maximum(peak, 1e-6))
    g = 1 - 1 / (desat * (peak - newPeak) + 1)
    mixed = scaled * (1 - g) + newPeak * g
    return np.where(peak < start, c, mixed)

def to_srgb(t):
    t = np.clip(t, 0, 1)
    return np.where(t <= 0.0031308, 12.92 * t, 1.055 * np.power(t, 1 / 2.4) - 0.055)

# ---------------- HDRI ----------------
hid = 'suburban_football_field'
img = read_hdr(os.path.join(SRC, f'{hid}_4k.hdr'))
H, W, _ = img.shape
lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
# „Sonne aus dem hellsten Pixel“: bei Bewölkung den hellsten Bereich (weich gefiltert) nehmen
small = lum.reshape(H // 8, 8, W // 8, 8).mean(axis=(1, 3))
small = blur(small, 3)
sy, sx = np.unravel_index(np.argmax(small[: small.shape[0] // 2]), small.shape)
u, v = (sx + 0.5) / small.shape[1], (sy + 0.5) / small.shape[0]
elev = 90 - v * 180
peak = float(lum.max())
print('hellster Bereich u,v', round(u, 4), round(v, 4), 'Höhe', round(elev, 1), '° Peak', round(peak, 2))
exposure = 1.0
cut = int(H * (0.5 + 8 / 180))
sky = to_srgb(neutral_tonemap(img[:cut] * exposure))
im = Image.fromarray((sky * 255 + 0.5).astype(np.uint8), 'RGB').resize((3072, int(3072 * cut / W)), Image.LANCZOS)
im.save(os.path.join(OUT, 'hdri', 'sky.jpg'), quality=82, optimize=True, progressive=True)
band = lambda a, b: to_srgb(neutral_tonemap(img[int(H * a):int(H * b)].reshape(-1, 3).mean(0)[None] * exposure))[0]
horizon = band(0.5 - 3 / 180, 0.5)          # Himmel knapp über dem Horizont
ground = band(0.5 + 1 / 180, 0.5 + 6 / 180)  # Boden knapp darunter (Nebelfarbe)
# Verhältnis direkt/diffus grob: Helligkeit des hellsten Bereichs zum Mittel der oberen Halbkugel
upper = float(lum[: H // 2].mean())
json.dump({'u': float(u), 'v': float(v), 'elevation': float(elev), 'cutV': cut / H, 'peak': peak, 'upperMean': upper,
           'horizon': [float(x) for x in horizon], 'ground': [float(x) for x in ground], 'source': hid},
          open(os.path.join(OUT, 'hdri', 'sky.json'), 'w'), indent=1)
import shutil
shutil.copyfile(os.path.join(SRC, f'{hid}_1k.hdr'), os.path.join(OUT, 'hdri', 'env_1k.hdr'))
print('sky.jpg', im.size, os.path.getsize(os.path.join(OUT, 'hdri', 'sky.jpg')), 'Horizont', horizon, 'Boden', ground)

# ---------------- Kunstrasen ----------------
def load(g, kind):
    return np.asarray(Image.open(os.path.join(SRC, g, f'{g}_1K-JPG_{kind}.jpg')).convert('RGB')).astype(np.float32) / 255

col = load('Grass005', 'Color')
lin = np.power(col, 2.2)
l = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
l = l / l.mean()
# Kunstrasen: einheitliches, leicht bläuliches Grün, zwei Fasertöne, geringere Streuung als Naturrasen
base = np.array([0.062, 0.175, 0.045], np.float32)    # linear ≈ sRGB (71, 117, 60)
alt = np.array([0.090, 0.200, 0.040], np.float32)     # heller/gelblicher Faserton
mixw = np.clip((l - 0.85) * 1.6, 0, 1)[..., None]
turf = (base * (1 - mixw) + alt * mixw) * (0.72 + 0.28 * np.clip(l, 0.3, 2.0))[..., None]
# Granulat dazwischen (schwarzes SBR): dunkle Tupfen, wo die Vorlage am dunkelsten ist
dark = np.clip((0.62 - l) * 3.0, 0, 1)[..., None]
turf = turf * (1 - 0.55 * dark) + np.array([0.012, 0.012, 0.012], np.float32) * 0.55 * dark
out = (np.power(np.clip(turf, 0, 1), 1 / 2.2) * 255 + 0.5).astype(np.uint8)
Image.fromarray(out).resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, 'tex', 'turf_color.jpg'), quality=86, optimize=True)

# Faser-Normalmap (kachelbar): liegende Kunstrasen-Fasern als Höhenfeld, dazu die Halm-Normalen der Vorlage
N = 1024
hf = np.zeros((N, N), np.float32)
himg = Image.new('F', (N, N), 0.0)
dr = ImageDraw.Draw(himg)
for _ in range(9000):
    x, y = rng.uniform(0, N), rng.uniform(0, N)
    ang = rng.uniform(0, math.pi) if rng.random() < 0.5 else rng.normal(0.35 * math.pi, 0.4)  # leichte Vorzugsrichtung (Bürsten)
    ln = rng.uniform(18, 42)
    h = rng.uniform(0.4, 1.0)
    dx, dy = math.cos(ang) * ln, math.sin(ang) * ln
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            dr.line([(x + ox, y + oy), (x + dx + ox, y + dy + oy)], fill=float(h), width=3)
hf = blur(np.asarray(himg, np.float32), 1.2, wrap=True)
gy, gx = np.gradient(np.pad(hf, 1, mode='wrap'))
gx, gy = gx[1:-1, 1:-1], gy[1:-1, 1:-1]
strength = 2.2
nx, ny, nz = -gx * strength, gy * strength, np.ones_like(gx)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nf = np.stack([nx / ln, ny / ln, nz / ln], -1)
ng = load('Grass005', 'NormalGL') * 2 - 1
ng = np.asarray(Image.fromarray(((ng * 0.5 + 0.5) * 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)).astype(np.float32) / 255 * 2 - 1
n = nf * 0.7 + ng * 0.3
n = n / np.linalg.norm(n, axis=-1, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'tex', 'turf_normal.jpg'), quality=88, optimize=True)

# ---------------- Naturrasen außen ----------------
g4 = Image.open(os.path.join(SRC, 'Grass004', 'Grass004_1K-JPG_Color.jpg')).convert('RGB')
g4.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, 'tex', 'grass_color.jpg'), quality=82, optimize=True)
Image.open(os.path.join(SRC, 'Grass004', 'Grass004_1K-JPG_NormalGL.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'tex', 'grass_normal.jpg'), quality=85, optimize=True)

# ---------------- Icons ----------------
def icon(size, maskable=False):
    im = Image.new('RGB', (size, size), (20, 74, 40))
    d = ImageDraw.Draw(im)
    s = size / 512
    pad = 60 * s if maskable else 0
    # Kunstrasen-Streifen
    for i in range(8):
        if i % 2: d.rectangle([0, i * size / 8, size, (i + 1) * size / 8], fill=(24, 86, 46))
    # Bande
    d.rounded_rectangle([70 * s + pad * 0.5, 300 * s, 442 * s - pad * 0.5, 360 * s], radius=10 * s, fill=(16, 66, 50), outline=(210, 230, 215), width=int(4 * s))
    # Netz
    for i in range(9):
        x = (80 + i * 44) * s
        d.line([x, 150 * s, x, 300 * s], fill=(180, 200, 190), width=max(1, int(2 * s)))
    for j in range(5):
        y = (150 + j * 37) * s
        d.line([70 * s, y, 442 * s, y], fill=(180, 200, 190), width=max(1, int(2 * s)))
    # Ball
    cx, cy, r = 256 * s, 250 * s, 92 * s
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(250, 250, 248), outline=(30, 30, 30), width=int(5 * s))
    pts = [(cx + 0.42 * r * math.cos(-math.pi / 2 + k * 2 * math.pi / 5), cy + 0.42 * r * math.sin(-math.pi / 2 + k * 2 * math.pi / 5)) for k in range(5)]
    d.polygon(pts, fill=(25, 25, 25))
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5
        p0 = (cx + 0.42 * r * math.cos(a), cy + 0.42 * r * math.sin(a))
        p1 = (cx + 0.98 * r * math.cos(a), cy + 0.98 * r * math.sin(a))
        d.line([p0, p1], fill=(30, 30, 30), width=int(5 * s))
    return im
icon(192).save(os.path.join(ROOT, 'icons', 'icon-192.png'))
icon(512).save(os.path.join(ROOT, 'icons', 'icon-512.png'))
icon(512, True).save(os.path.join(ROOT, 'icons', 'icon-maskable-512.png'))
icon(180).save(os.path.join(ROOT, 'icons', 'apple-touch-icon.png'))
for f in sorted(os.listdir(os.path.join(OUT, 'tex'))) + ['../hdri/sky.jpg', '../hdri/env_1k.hdr']:
    p = os.path.join(OUT, 'tex', f)
    print(f, os.path.getsize(p))
