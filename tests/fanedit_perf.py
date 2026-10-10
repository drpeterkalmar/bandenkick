# n6 Fan-Edit: Bildrate am Handy-Profil (Pixel 7 hoch/quer, DPR 2,625, CPU-Drosselung ×4, Autopilot wie am Handy) während
# der Tor-Wiederholung – Fan-Edit gegen Klassisch (?edit=0) an denselben Bot-Toren. Bildabstände je Bild (rAF) über den
# ganzen Clip: p50/p95/max, schlechtestes 0,5-s-Fenster (fps), Anteil Bilder > 33,4 ms.
# Aufruf: py tests/fanedit_perf.py [hoch|quer] [--drossel 4] [--seeds 1,8,11] [--sanft]  → tests/perf/<datum>_fanedit_<form>.json
import os, sys, json, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
a = sys.argv[1:]
FORM = next((x for x in a if x in ('hoch', 'quer')), 'hoch')
STUFE = a[a.index('--q') + 1] if '--q' in a else None  # feste Grafikstufe (Autopilot aus), sonst Autopilot wie am Handy
DROSSEL = float(a[a.index('--drossel') + 1]) if '--drossel' in a else 4
SEEDS = [int(x) for x in a[a.index('--seeds') + 1].split(',')] if '--seeds' in a else [1, 8, 11]
SANFT = '--sanft' in a

PERF_JS = """() => { const r = []; let last = performance.now(), on = true;
  const f = (t) => { if (!on) return; r.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  window.__rafStop = () => { on = false; return r; }; }"""


def auswertung(ft):
    if not ft: return {}
    s = sorted(ft)
    # schlechtestes 0,5-s-Fenster
    worst, i, acc = 999, 0, 0.0
    for j, x in enumerate(ft):
        acc += x
        while acc - ft[i] >= 500 and i < j: acc -= ft[i]; i += 1
        if acc >= 480: worst = min(worst, 1000 * (j - i + 1) / acc)
    return {'n': len(ft), 'p50': round(s[len(s) // 2], 2), 'p95': round(s[int(len(s) * 0.95)], 2), 'max': round(s[-1], 1),
            'fps_mittel': round(1000 * len(ft) / sum(ft), 1), 'fps_schlechtestes_0_5s': round(worst, 1), 'anteil_ueber_33ms': round(sum(1 for x in ft if x > 33.4) / len(ft), 3)}


def main():
    out = {'form': FORM, 'drossel': DROSSEL, 'seeds': SEEDS, 'sanft': SANFT, 'geraet': 'rog17 (RTX 3070 Ti, Windows, ANGLE/D3D11)', 'laeufe': []}
    with Server() as srv, sync_playwright() as pw:
        for art in ('klassisch', 'edit'):
            s = Session(pw, srv.base, FORM)
            s.open(f"?nosw&nohelp&play&edit={'1' if art == 'edit' else '0'}" + ('&blitze=sanft' if SANFT else '') + (f'&q={STUFE}&startprobe=0' if STUFE else ''))
            cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': DROSSEL})
            for seed in SEEDS:
                s.ev(f"__game.newGame({{bots: true, seed: {seed}}})"); s.ev("__game.simBis(400)"); s.ev("__game.editMessStart()")
                s.pg.wait_for_function("__game.replay().active", timeout=60000)
                s.ev(PERF_JS)
                s.pg.wait_for_function("!__game.replay().active", timeout=60000)
                ft = s.ev("window.__rafStop()")[2:]
                em = s.ev("__game.editMessDaten()") or []
                gaps = sorted(((em[k][3] - em[k - 1][3], em[k][0], em[k][1]) for k in range(1, len(em))), reverse=True)[:3]
                inf = s.ev("__game.info()")
                r = {'art': art, 'seed': seed, **auswertung(ft), 'stufe': inf['quality']['level'], 'skala': inf['kino']['scale'] if inf.get('kino') else None,
                     'groesste_luecken_ms_bei_clipzeit': [[round(g, 1), round(t, 2), i] for g, t, i in gaps]}
                out['laeufe'].append(r); print(json.dumps(r), flush=True)
            out.setdefault('fehler', []).extend(s.errors + s.ev("window.__errors || []"))
            out.setdefault('ton', []).extend(s.ev("window.__audioCalls || []"))
            s.b.close()
    d = datetime.date.today().isoformat()
    p = os.path.join(ROOT, 'tests', 'perf', f'{d}_fanedit_{FORM}{"_sanft" if SANFT else ""}.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('Fehler', out['fehler'][:3], 'Ton', out['ton'], '→', p)


if __name__ == '__main__':
    main()
