import sys, os, json
sys.path.insert(0, 'tests')
from util import Server, Session, sync_playwright, ARGS
ARGS.append('--mute-audio')
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    s.open('?nosw&nohelp&play&q=1&startprobe=0&seed=7&edit=1&action=0')
    cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    s.ev("__game.newGame({bots: true, seed: 1})"); s.ev("__game.simBis(400)")
    s.b.start_tracing(page=s.pg, path='tests/out/trace_clip.json', categories=['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'gpu', 'disabled-by-default-devtools.timeline.frame'])
    s.pg.wait_for_function("__game.replay().active && __game.replay().real > 1.2", timeout=30000)
    s.b.stop_tracing()
    s.b.close()
d = json.load(open('tests/out/trace_clip.json', encoding='utf-8'))
ev = d['traceEvents'] if isinstance(d, dict) else d
# Haupt-Thread des Renderers: Thread mit den meisten 'RunTask'
from collections import Counter
c = Counter((e.get('pid'), e.get('tid')) for e in ev if e.get('name') == 'RunTask')
main = c.most_common(1)[0][0]
long = [e for e in ev if (e.get('pid'), e.get('tid')) == main and e.get('ph') == 'X' and e.get('name') == 'RunTask' and e.get('dur', 0) > 60000]
print('lange Tasks', [(round(e['ts']/1000), round(e['dur']/1000)) for e in long][:10])
for L in long[:4]:
    t0, t1 = L['ts'], L['ts'] + L['dur']
    sub = Counter()
    for e in ev:
        if (e.get('pid'), e.get('tid')) == main and e.get('ph') == 'X' and t0 <= e.get('ts', 0) < t1 and e is not L:
            sub[e['name']] += e.get('dur', 0)
    print(round(L['dur']/1000), 'ms:', [(k, round(v/1000)) for k, v in sub.most_common(12)])
    fn = [e for e in ev if (e.get('pid'), e.get('tid')) == main and e.get('ph') == 'X' and t0 <= e.get('ts', 0) < t1 and e.get('name') in ('FunctionCall', 'V8.Execute', 'EvaluateScript') ]
    for e in sorted(fn, key=lambda e: -e.get('dur', 0))[:3]: print('   ', e['name'], round(e['dur']/1000), (e.get('args') or {}).get('data', {}).get('functionName', ''), (e.get('args') or {}).get('data', {}).get('url', '')[-40:], (e.get('args') or {}).get('data', {}).get('lineNumber', ''))
