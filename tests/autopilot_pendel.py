# n5 Punkt 7: Pendelt der Qualitäts-Autopilot (n4) am Mittelklasse-Profil zwischen Stufen? 45 s Spiel Bot gegen Bot mit
# Autopilot (ohne ?q), CPU ×4, hoch und quer; Bildabstände (rAF) p50/p95/p99, Stufen- und Skalenwechsel aus dem Log.
# Aufruf: py tests/autopilot_pendel.py [wurzel=.] [name]   → Zeile je Gerät (+ tests/perf/autopilot_<name>.json)
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
import deko_scenes as S
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
wurzel = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[2] if len(sys.argv) > 2 else 'stand'
zusatz = sys.argv[3] if len(sys.argv) > 3 else ''
SEK = 45
MESS = """(sek) => new Promise((res) => { const t = []; let last = performance.now(); const t0 = last;
  const k = (now) => { t.push(now - last); last = now; if (now - t0 < sek * 1000) requestAnimationFrame(k); else res(t.slice(1)); };
  requestAnimationFrame(k); })"""
erg = {}
with Server(wurzel) as srv, sync_playwright() as pw:
    for geraet in ('hoch', 'quer'):
        s = Session(pw, srv.base, geraet)
        S.open_ready(s, '?nosw&seed=5&play&nohelp&licht=tag' + zusatz)
        cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        s.ev("__game.human(-1)")
        a0 = s.ev("__game.info().auto")
        t = sorted(s.ev(MESS, SEK))
        a1 = s.ev("__game.info().auto")
        q = lambda p: round(t[min(len(t) - 1, int(p * len(t)))], 1)
        log = (a1.get('log') or [])
        stufen = [x for x in log if isinstance(x, dict) and ('stufe' in json.dumps(x, ensure_ascii=False) or 'level' in json.dumps(x))]
        erg[geraet] = {'bilder': len(t), 'fps': round(1000 * len(t) / sum(t), 1), 'p50': q(0.5), 'p95': q(0.95), 'p99': q(0.99),
                       'autopilot_vorher': a0.get('autopilot'), 'autopilot_nachher': a1.get('autopilot'), 'log': log[-20:], 'schritte': a1.get('steps')}
        print(geraet, {k: v for k, v in erg[geraet].items() if k not in ('log',)}, flush=True)
        print('  Log:', json.dumps(log[-12:], ensure_ascii=False)[:900], flush=True)
        s.close()
json.dump(erg, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'perf', f'autopilot_{name}.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
