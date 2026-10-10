# n6 Action-Momente live: Bot gegen Bot, Stufe „oft“ mit festem Zufall → Momente kommen von selbst; jeder Moment wird in
# festen Schritten angehalten (≥ 12 Bilder, Simulation steht dabei) → Collage. Dazu: Eingabe-Test während der Zeitlupe
# (Mensch schießt im Moment), Häufigkeit über eine Minute echte Spielzeit, JS-Fehler, Tonausgabe (muss 0 bleiben).
# Aufruf: py tests/action_bilder.py [hoch|quer] [anzahl] → tests/shots/action/*.jpg, *_mess.json
import os, sys, json, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'action'); RAW = os.path.join(ROOT, 'tests', 'shots', 'action_raw')
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORM = args[0] if args else 'hoch'
ANZ = int(args[1]) if len(args) > 1 else 3
ZEITEN = {'ramp': [0.03, 0.07, 0.12, 0.2, 0.3, 0.42, 0.55, 0.66, 0.75, 0.85, 0.95, 1.05, 1.15],
          'bullet': [0.03, 0.07, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.15, 1.24, 1.3, 1.4]}


def collage(name, bilder, titel):
    from PIL import Image, ImageDraw, ImageFont
    fp = 'C:/Windows/Fonts/arialbd.ttf' if os.path.exists('C:/Windows/Fonts/arialbd.ttf') else None
    font = (lambda n: ImageFont.truetype(fp, n)) if fp else (lambda n: ImageFont.load_default())
    ims = [Image.open(p).convert('RGB') for p, _ in bilder]
    hochf = ims[0].height > ims[0].width
    w = 210 if hochf else 340; cols = 7 if hochf else 4
    th = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
    h0 = max(t.height for t in th); rows = math.ceil(len(th) / cols)
    C = Image.new('RGB', (cols * w, rows * (h0 + 22) + 34), (14, 14, 16)); d = ImageDraw.Draw(C)
    d.text((8, 6), titel, font=font(20), fill='white')
    for i, (t, (_, lab)) in enumerate(zip(th, bilder)):
        x, y = (i % cols) * w, 34 + (i // cols) * (h0 + 22)
        C.paste(t, (x, y + 22)); d.text((x + 4, y + 3), lab, font=font(14), fill=(255, 230, 0))
    p = os.path.join(OUT, name + '.jpg'); C.save(p, quality=82); return p


def main():
    mess = {'form': FORM, 'momente': []}
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, FORM)
        s.open('?nosw&nohelp&play&startprobe=0&q=2&seed=3&action=2&replay=0')
        # 1) Eingabe während der Zeitlupe: Mensch mit Ball, Moment starten, Schuss tippen → Schuss kommt im Moment
        hx = s.ev("__game.game.cage.hx")
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
        s.frames(2)
        s.ev(f"__game.placePlayer({hx - 7.4}, 0.6, 0, 1); __game.placeBall({hx - 7.0}, 0.11, 0.6); __game.placePlayer({hx - 0.6}, -2.8, Math.PI, 3)")
        s.frames(3)
        s.ev("__game.aktionStart('ramp')")
        s.pg.wait_for_function("__game.aktion().aktiv && __game.aktion().real > 0.12", timeout=10000)
        s.ev("__game.press([[0, 0.07, 'shot']], [1, -0.1], 0.3)")
        geschossen, real_bei = False, None
        for _ in range(80):
            r = s.ev("({ aktiv: __game.aktion().aktiv, real: __game.aktion().real, v: Math.hypot(...__game.state().ball.v) })")
            if r['aktiv'] and r['v'] > 5: geschossen, real_bei = True, r['real']; break
            if not r['aktiv']: break
            time.sleep(0.03)
        mess['eingabe_in_zeitlupe'] = {'schuss_waehrend_moment': geschossen, 'echtzeit_im_moment_beim_schuss': real_bei}
        print('Eingabe:', mess['eingabe_in_zeitlupe'], flush=True)
        s.pg.wait_for_function("!__game.aktion().aktiv", timeout=10000)
        # 2) Bot gegen Bot: Momente von selbst, Bildfolgen
        s.ev("__game.newGame({bots: true, seed: 7}); __game.aktionZufall(0); __game.aktionStufe('oft')")
        for n in range(ANZ):
            s.ev(f"__game.aktionHalt({ZEITEN['ramp'][0]})")
            try: s.pg.wait_for_function("__game.aktion().aktiv", timeout=90000)
            except Exception: print('kein Moment mehr'); break
            info = s.ev("__game.aktion()")
            zs = ZEITEN[info['art']]
            bilder = []
            for j, z in enumerate(zs):
                s.ev(f"__game.aktionHalt({z})")
                s.pg.wait_for_function(f"__game.aktion().real >= {z} - 1e-6", timeout=10000)
                s.frames(3)
                p = os.path.join(RAW, f'{FORM}_{n}_{j:02d}.png'); s.pg.screenshot(path=p)
                bilder.append((p, f"{z:.2f} s · {s.ev('__game.aktion().v ? __game.aktion().v.rate.toFixed(2) : 0')}×"))
            s.ev("__game.aktionHalt(null)")
            s.pg.wait_for_function("!__game.aktion().aktiv", timeout=10000)
            c = collage(f'{FORM}_{n}_{info["art"]}', bilder, f"Action-Moment {n + 1}: {info['art']} · {info['grund']} · {FORM}")
            mess['momente'].append({'art': info['art'], 'grund': info['grund'], 'collage': os.path.relpath(c, ROOT).replace(os.sep, '/')})
            print(mess['momente'][-1], flush=True)
        # 3) Bullet-Time erzwingen (am Ball, mitten im Spiel)
        s.ev("__game.aktionStufe('aus'); __game.aktionHalt(0.03)")
        s.pg.wait_for_function("(() => { const g = __game.game, b = g.ball.p; return g.ball.held < 0 && Math.abs(b.z) < g.cage.hz - 2.5 && Math.abs(b.x) < g.cage.hx - 2 && g.players.some((p) => Math.hypot(p.x - b.x, p.z - b.z) < 1.2); })()", timeout=60000)
        s.ev("__game.aktionStart('bullet')")
        bilder = []
        for j, z in enumerate(ZEITEN['bullet']):
            s.ev(f"__game.aktionHalt({z})")
            s.pg.wait_for_function(f"__game.aktion().real >= {z} - 1e-6", timeout=10000)
            s.frames(3)
            p = os.path.join(RAW, f'{FORM}_bullet_{j:02d}.png'); s.pg.screenshot(path=p)
            bilder.append((p, f"{z:.2f} s · {s.ev('__game.aktion().v ? __game.aktion().v.rate.toFixed(2) : 0')}×"))
        s.ev("__game.aktionHalt(null)")
        s.pg.wait_for_function("!__game.aktion().aktiv", timeout=10000)
        c = collage(f'{FORM}_bullet', bilder, f"Action-Moment: Bullet-Time (erzwungen am Ball) · {FORM}")
        mess['momente'].append({'art': 'bullet', 'grund': 'erzwungen', 'collage': os.path.relpath(c, ROOT).replace(os.sep, '/')})
        mess['fehler'] = s.errors + s.ev("window.__errors || []")
        mess['ton'] = s.ev("window.__audioCalls || []")
        s.b.close()
    p = os.path.join(OUT, f'{FORM}_mess.json'); json.dump(mess, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('Fehler', mess['fehler'][:3], 'Ton', mess['ton'], '→', p)


if __name__ == '__main__':
    main()
