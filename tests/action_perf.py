# n6 Action-Momente: Bildrate am Handy-Profil (Pixel 7, DPR 2,625, CPU ×4, feste Stufe 1 bzw. Autopilot) – Bot gegen Bot,
# Stufe „oft“ mit festem Zufall (viele Momente), 50 s Echtzeit; Bildabstände getrennt nach „im Moment“ / „sonst“.
# Aufruf: py tests/action_perf.py [hoch|quer] [--q 1] [--sek 50] → tests/perf/<datum>_action_<form>.json
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
from fanedit_perf import auswertung
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
a = sys.argv[1:]
FORM = next((x for x in a if x in ('hoch', 'quer')), 'hoch')
STUFE = a[a.index('--q') + 1] if '--q' in a else '1'
SEK = float(a[a.index('--sek') + 1]) if '--sek' in a else 50

JS = """() => { const r = []; let last = performance.now(), on = true;
  const f = (t) => { if (!on) return; r.push([t - last, __game.aktion().aktiv ? 1 : 0]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  window.__rafStop = () => { on = false; return r; }; }"""

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, FORM)
    s.open(f'?nosw&nohelp&play&q={STUFE}&startprobe=0&action=2&seed=7')
    cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    s.ev("__game.newGame({bots: true, seed: 7}); __game.aktionZufall(0)")
    s.pg.wait_for_timeout(3000)
    s.ev(JS)
    s.pg.wait_for_timeout(int(SEK * 1000))
    d = s.ev("window.__rafStop()")[3:]
    im = [x for x, k in d if k]; so = [x for x, k in d if not k]
    out = {'form': FORM, 'stufe': STUFE, 'drossel': 4, 'sek': SEK, 'geraet': 'rog17 (RTX 3070 Ti, Windows, ANGLE/D3D11)',
           'momente': s.ev("__game.aktion().zahl"), 'log': s.ev("__game.aktion().log"), 'im_moment': auswertung(im), 'sonst': auswertung(so),
           'fehler': s.errors + s.ev("window.__errors || []"), 'ton': s.ev("window.__audioCalls || []")}
    s.b.close()
p = os.path.join(ROOT, 'tests', 'perf', f'{datetime.date.today().isoformat()}_action_{FORM}.json')
json.dump(out, open(p, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(json.dumps({k: out[k] for k in ('momente', 'im_moment', 'sonst', 'fehler', 'ton')}), '→', p)
