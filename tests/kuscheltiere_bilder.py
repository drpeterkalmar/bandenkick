# n9 Kuscheltiere: Vergleichsfotos vorher (?figuren=menschen = Rocketbox-Menschen wie bis 0.6.x) / nachher (Kuscheltiere),
# Handy hoch und quer: Menü, Spiel, Torjubel (+ nah), Tormann-Parade (nah), Zuschauer (nah), Wiederholung (Klassisch: Aufbau,
# Kontakt-Zoom, Fan-Cam), Training mit Puppe; dazu der Bewegungs-Kontaktabzug aus dem Prüfstand (tools/kuscheltier_view.html).
# Aufruf: python3 tests/kuscheltiere_bilder.py [hoch|quer …] [--nur vorher|nachher] [--bewegung] [--n10]
#   → tests/shots/kuscheltiere_raw/<variante>/<form>_<szene>.png, Collagen tests/shots/kuscheltiere/*.jpg
# n10 (--n10): vorher = ?tierform=0 (Proportionen 0.7.0), nachher = Kindchenschema → tests/shots/n10/*.jpg; der Bewegungs-
#   Kontaktabzug zeigt dann je Pose links 0.7.0, rechts neu
import sys, os, json, math
sys.path.insert(0, 'tests')
from util import *
import deko_scenes as S

args = [a for a in sys.argv[1:] if not a.startswith('--')]
forms = [a for a in args if a in ('hoch', 'quer')] or ['hoch', 'quer']
nur = sys.argv[sys.argv.index('--nur') + 1] if '--nur' in sys.argv else None
N10 = '--n10' in sys.argv
VARIANTEN = [('vorher', '&tierform=0'), ('nachher', '')] if N10 else [('vorher', '&figuren=menschen'), ('nachher', '')]
RAW = os.path.join(ROOT, 'tests', 'shots', 'n10_raw' if N10 else 'kuscheltiere_raw')
OUT = os.path.join(ROOT, 'tests', 'shots', 'n10' if N10 else 'kuscheltiere'); os.makedirs(OUT, exist_ok=True)
TITEL = ('Bandenkick n10 – {} vorher (0.7.0), {} nachher (größere Köpfe, kürzere Arme/Beine)' if N10 else
         'Bandenkick n9 – {} vorher (Menschen), {} nachher (Kuscheltiere)')
SZENEN = ['01_menu', '02_spiel', '03_jubel', '03b_jubel_nah', '04_parade_nah', '05_zuschauer', '06_replay_aufbau', '06_replay_kontakt', '06_replay_fancam', '07_training']


def nah(s, i, d=2.4, h=1.45, seite=0.9):
    """Kamera nah vor Spieler i (schaut ihm ins Gesicht)."""
    x, z, f = s.ev(f"(() => {{ const p = __game.game.players[{i}]; return [p.x, p.z, p.face]; }})()")
    s.ev(f"__game.cam([{x + math.cos(f) * d - math.sin(f) * seite}, {h}, {z + math.sin(f) * d + math.cos(f) * seite}], [{x}, 1.05, {z}])"); s.frames(4)


def fotos(s, f, var, extra):
    sub = os.path.join('kuscheltiere_raw', var)
    shot = lambda n: s.shot(f'{f}_{n}', sub)
    S.menu(s, extra); S.hide_cards(s); s.frames(3); shot('01_menu'); S.hide_cards(s, False)
    S.duel(s, extra); shot('02_spiel')
    # Zuschauer hinter dem rechten Tor, Kamera außerhalb des Käfigs
    s.ev("__game.cam([12.6, 1.7, 2.4], [17.2, 1.0, -0.2])"); s.frames(6); shot('05_zuschauer'); s.ev("__game.cam(null)")
    S.jubel(s, extra); shot('03_jubel')
    nah(s, 1, 2.6, 1.5); shot('03b_jubel_nah'); s.ev("__game.cam(null)")
    # Parade: Auto-Torwart hechtet, angehalten im Flug, Kamera seitlich vor dem Tor
    S.open_ready(s, f'?nosw&seed=11&play&q=1&nohelp&replay=0{extra}')
    hx = s.ev("__game.game.cage.hx")
    s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)"); s.frames(3)
    s.ev(f"__game.bots(true); __game.human(0); __game.placePlayer({-hx + 1.0}, -0.6, 0, 0); __game.placePlayer(-2, 5, 0, 1); __game.placePlayer(-2, -5, 0, 2); __game.kick({{from:[{-hx + 9.5}, 0.3, -2], v:[-19.5, 1.6, 6.6], w:[0,0,0]}})")
    S.freeze_when(s, "g.players[0].hand.mode === 'dive' && g.players[0].hand.t > 0.12")
    x, z = s.ev("[__game.game.players[0].x, __game.game.players[0].z]")
    s.ev(f"__game.cam([{x + 3.4}, 1.3, {z - 1.6}], [{x}, 0.75, {z}])"); s.frames(4); shot('04_parade_nah'); s.ev("__game.cam(null); __game.freeze(false)")
    S.replay_shots(s, lambda n: shot('06_' + n), extra + '&edit=0')
    # Training: Bandenpass mit Puppe (Dummy)
    S.open_ready(s, f'?nosw&seed=5&q=1&nohelp{extra}')
    s.ev("__game.challenge('bande')"); s.frames(20)
    d = s.ev("(() => { const C = __game.game.challenge; return C && C.dummies && C.dummies.length ? [C.dummies[0].x, C.dummies[0].z] : null; })()")
    if d:
        s.ev(f"__game.cam([{d[0] - 1.8}, 1.6, {d[1] - 2.4}], [{d[0]}, 1.1, {d[1]}])"); s.frames(4)  # Puppen schauen nach −z
    S.hide_cards(s); s.frames(2); shot('07_training'); S.hide_cards(s, False); s.ev("__game.cam(null)")
    return s.ev("__game.info()")


def collage(form):
    from PIL import Image, ImageDraw, ImageFont
    fp = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font = ImageFont.truetype(fp, 22) if os.path.exists(fp) else ImageFont.load_default()
    paare = []
    for sz in SZENEN:
        a, b = [os.path.join(RAW, v, f'{form}_{sz}.png') for v, _ in VARIANTEN]
        if os.path.exists(a) and os.path.exists(b): paare.append((sz, a, b))
    if not paare: return None
    w = 380 if form == 'hoch' else 620
    ims = [[Image.open(p).convert('RGB') for p in (a, b)] for _, a, b in paare]
    h = round(ims[0][0].height * w / ims[0][0].width)
    if form == 'hoch':  # Szenen nebeneinander, oben vorher, unten nachher
        C = Image.new('RGB', (len(paare) * (w + 6) + 6, 2 * (h + 34) + 44), (16, 16, 18)); d = ImageDraw.Draw(C)
        d.text((8, 8), TITEL.format('oben', 'unten') + ' – Handy hoch', font=font, fill='white')
        for i, ((sz, _, _), pair) in enumerate(zip(paare, ims)):
            for r, im in enumerate(pair):
                x, y = 6 + i * (w + 6), 44 + r * (h + 34)
                d.text((x, y + 4), sz[3:], font=font, fill=(255, 220, 0)); C.paste(im.resize((w, h), Image.LANCZOS), (x, y + 30))
    else:               # je Zeile eine Szene: links vorher, rechts nachher
        C = Image.new('RGB', (2 * (w + 6) + 6, len(paare) * (h + 34) + 44), (16, 16, 18)); d = ImageDraw.Draw(C)
        d.text((8, 8), TITEL.format('links', 'rechts') + ' – Handy quer', font=font, fill='white')
        for i, ((sz, _, _), pair) in enumerate(zip(paare, ims)):
            for c, im in enumerate(pair):
                x, y = 6 + c * (w + 6), 44 + i * (h + 34)
                d.text((x, y + 4), sz[3:], font=font, fill=(255, 220, 0)); C.paste(im.resize((w, h), Image.LANCZOS), (x, y + 30))
    p = os.path.join(OUT, f'vergleich_{form}.jpg'); C.save(p, quality=80); return p



def bewegung():
    """Bewegungstest aus dem Prüfstand: je Pose ein Bild aller sechs Tiere → Kontaktabzug."""
    from PIL import Image, ImageDraw, ImageFont
    posen = [('laufen', 70), ('sprint', 80), ('wende', 60), ('schuss', 60), ('pass', 60), ('graetsche', 60), ('hecht', 15), ('halten', 20), ('jubel', 20), ('fallrueck', 70), ('kopf', 40), ('stehen', 20, '&nah=1')]
    if N10: posen.insert(11, ('kopfball', 40))
    d = os.path.join(RAW, 'bewegung'); os.makedirs(d, exist_ok=True)
    files = []
    tfs = ['&tierform=0', ''] if N10 else ['']
    with Server() as srv, sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': 1300, 'height': 640}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for p in posen:
            for tf in tfs:
                pg.goto(f"{srv.base}tools/kuscheltier_view.html?pose={p[0]}&yaw={p[1]}{p[2] if len(p) > 2 else ''}&tormann={1 if p[0] in ('halten', 'hecht') else 0}{tf}")
                pg.wait_for_function('window.__ready === true', timeout=90000)
                fn = os.path.join(d, f"{p[0]}{'_alt' if tf else ''}.png"); pg.screenshot(path=fn); files.append((p[0] + (' – 0.7.0' if tf else (' – neu' if N10 else '')), fn))
        b.close()
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24)
    w, h = 650, 320
    C = Image.new('RGB', (2 * w, math.ceil(len(files) / 2) * h), (16, 16, 18)); dr = ImageDraw.Draw(C)
    for i, (n, fn) in enumerate(files):
        x, y = (i % 2) * w, (i // 2) * h
        C.paste(Image.open(fn).convert('RGB').resize((w, h), Image.LANCZOS), (x, y)); dr.text((x + 8, y + 22), n, font=font, fill=(255, 220, 0))
    p = os.path.join(OUT, 'bewegungen.jpg'); C.save(p, quality=80)
    if N10:  # zusätzlich je Pose ein eigenes Vergleichsbild (links 0.7.0, rechts neu) für die Sichtprüfung
        for k in range(0, len(files), 2):
            P2 = Image.new('RGB', (2 * w, h), (16, 16, 18)); d2 = ImageDraw.Draw(P2)
            for c in range(2):
                n, fn = files[k + c]; P2.paste(Image.open(fn).convert('RGB').resize((w, h), Image.LANCZOS), (c * w, 0)); d2.text((c * w + 8, 22), n, font=font, fill=(255, 220, 0))
            P2.save(os.path.join(OUT, f"pose_{files[k][0].split(' ')[0]}.jpg"), quality=82)
    print('Bewegungen', p, 'Fehler', errs)


if '--bewegung' in sys.argv:
    bewegung(); sys.exit(0)
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        for var, extra in VARIANTEN:
            if nur and var != nur: continue
            info = fotos(s, f, var, extra)
            print(f, var, json.dumps({k: info[k] for k in ['calls', 'triangles']}), 'Fehler', s.errors[:4], s.ev('window.__errors'))
    s.close()
for f in forms: print('Collage', collage(f))
