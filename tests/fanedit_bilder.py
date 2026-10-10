# n6 Fan-Edit: Bot gegen Bot (feste Seeds mit Toren unterschiedlicher Technik), je Tor der Clip angehalten in festen
# Schritten auf dem Taktraster → Bildfolge (16 Bilder) als Collage; dazu ein Durchlauf ohne Anhalten: Schnitt-Bilder
# gegen das Taktraster (Abweichung in Bildern), JS-Fehler, Tonausgabe (muss 0 bleiben).
# Aufruf: py tests/fanedit_bilder.py [hoch|quer|clip] [seed,seed,…] [--sanft]   → tests/shots/fanedit/*.jpg, *_mess.json
import os, sys, json, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'fanedit')
RAW = os.path.join(ROOT, 'tests', 'shots', 'fanedit_raw')
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
FORM = args[0] if args else 'hoch'
# Seeds (tests/node/fanedit.test.mjs-Bedingungen: Bots Stufe 2, kein Mensch): erstes Tor je Seed
SEEDS = [int(x) for x in args[1].split(',')] if len(args) > 1 else [1, 2, 4, 8, 11, 30, 57]
SANFT = '--sanft' in sys.argv
B = 60 / 128
SCHLAEGE = [0.5, 1.5, 2.5, 3.25, 3.7, 4.4, 5.4, 6.22, 6.7, 7.5, 8.5, 9.5, 10.5, 11.5, 12.7, 14.4]
SCHLAEGE_B = [0.5, 1.5, 2.5, 3.25, 3.7, 4.5, 5.5, 6.5, 7.5, 8.22, 8.7, 9.5, 10.5, 11.5, 12.5, 13.6]  # Vorlage B (14 Schläge)


def collage(name, bilder, titel):
    from PIL import Image, ImageDraw, ImageFont
    fonts = ['C:/Windows/Fonts/arialbd.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
    fp = next((f for f in fonts if os.path.exists(f)), None)
    font = (lambda n: ImageFont.truetype(fp, n)) if fp else (lambda n: ImageFont.load_default())
    ims = [Image.open(p).convert('RGB') for p, _ in bilder]
    w = 230 if ims[0].height > ims[0].width else 360
    cols = 8 if ims[0].height > ims[0].width else 4
    th = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
    h0 = max(t.height for t in th)
    rows = math.ceil(len(th) / cols)
    C = Image.new('RGB', (cols * w, rows * (h0 + 22) + 34), (14, 14, 16))
    d = ImageDraw.Draw(C); d.text((8, 6), titel, font=font(20), fill='white')
    for i, (t, (_, lab)) in enumerate(zip(th, bilder)):
        x, y = (i % cols) * w, 34 + (i // cols) * (h0 + 22)
        C.paste(t, (x, y + 22)); d.text((x + 4, y + 3), lab, font=font(14), fill=(255, 230, 0))
    p = os.path.join(OUT, name + '.jpg'); C.save(p, quality=82); return p


def main():
    dev = 'quer' if FORM in ('quer', 'clip') else 'hoch'
    q = '?nosw&nohelp&play&startprobe=0&q=2&seed=3&edit=1' + ('&clip=hoch' if FORM == 'clip' else '&clip=quer') + ('&blitze=sanft' if SANFT else '&blitze=voll')
    mess = {'form': FORM, 'sanft': SANFT, 'clips': []}
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, dev)
        s.open(q)
        for seed in SEEDS:
            # 1) Durchlauf ohne Anhalten: Schnitte gegen das Taktraster
            s.ev(f"__game.editHalt(null); __game.newGame({{bots: true, seed: {seed}}})")
            s.ev("__game.editMessStart()")
            r = s.ev("__game.simBis(400)")
            s.pg.wait_for_function("__game.replay().active", timeout=30000)
            info = s.ev("__game.replay()")
            s.pg.wait_for_function("!__game.replay().active", timeout=30000)
            d = s.ev("__game.editMessDaten()") or []
            cuts, last_i = [], 0
            for k in range(1, len(d)):
                if d[k][1] != last_i:
                    fdt = (d[k][3] - d[k - 1][3]) / 1000
                    b0 = round(d[k][0] / B)  # Schlag, auf dem der Schnitt liegen soll
                    cuts.append({'schlag': b0, 'abw_ms': round((d[k][0] - b0 * B) * 1000, 2), 'bild_ms': round(fdt * 1000, 2), 'abw_bild': round((d[k][0] - b0 * B) / max(1e-6, fdt), 3)})
                    last_i = d[k][1]
            ft = [(d[k][3] - d[k - 1][3]) for k in range(1, len(d))]
            ft.sort()
            clip = {'seed': seed, 'tech': info['edit']['tech'] if info.get('edit') else None, 'kmh': info['edit']['kmh'] if info.get('edit') else None,
                    'tor_t': r['t'], 'bilder': len(d), 'cuts': cuts, 'max_abw_bild': max([c['abw_bild'] for c in cuts] or [0]),
                    'bild_ms_p50': ft[len(ft) // 2] if ft else None, 'bild_ms_p95': ft[int(len(ft) * 0.95)] if ft else None}
            # 2) derselbe Clip noch einmal, angehalten in festen Schritten
            SL = SCHLAEGE_B if info.get('edit') and info['edit'].get('ablauf') == 1 else SCHLAEGE
            clip['ablauf'] = 'B' if SL is SCHLAEGE_B else 'A'
            s.ev(f"__game.editHalt({SL[0] * B})")
            s.ev("__game.clipNochmal()")
            bilder = []
            for j, sb in enumerate(SL):
                s.ev(f"__game.editHalt({sb * B})")
                try: s.pg.wait_for_function("(() => { const r = __game.replay(); return r.active && r.held; })()", timeout=15000)
                except Exception: print('  nicht erreicht', seed, sb); continue
                s.frames(2); time.sleep(0.42); s.frames(1)
                p = os.path.join(RAW, f'{FORM}{"_sanft" if SANFT else ""}_{seed}_{j:02d}.png')
                s.pg.screenshot(path=p)
                cam = s.ev("__game.replay().edit.cam")
                bilder.append((p, f'{sb:g} · {cam}'))
            s.ev("__game.editHalt(null)")
            s.pg.wait_for_function("!__game.replay().active", timeout=30000)
            if bilder:
                clip['collage'] = os.path.relpath(collage(f'{FORM}{"_sanft" if SANFT else ""}_seed{seed}', bilder, f"Fan-Edit seed {seed} · Ablauf {clip['ablauf']} · {clip['tech']} · {clip['kmh']} km/h · {FORM}{' · Blitze reduziert' if SANFT else ''}"), ROOT).replace(os.sep, '/')
            mess['clips'].append(clip)
            print(json.dumps({k: v for k, v in clip.items() if k != 'cuts'}), flush=True)
        mess['fehler'] = s.errors + s.ev("window.__errors || []")
        mess['ton'] = s.ev("window.__audioCalls || []")
        s.b.close()
    p = os.path.join(OUT, f'{FORM}{"_sanft" if SANFT else ""}_mess.json')
    json.dump(mess, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('Fehler:', mess['fehler'][:5], 'Ton:', mess['ton'], '→', p)


if __name__ == '__main__':
    main()
