import sys, os, json
sys.path.insert(0, 'tests')
from util import Server, Session, sync_playwright, ARGS
from collections import Counter
ARGS.append('--mute-audio')
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    s.open('?nosw&nohelp&play&q=1&startprobe=0&seed=7&edit=1&action=0')
    cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    s.ev("__game.newGame({bots: true, seed: 1})"); s.ev("__game.simBis(400)")
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); 
    s.pg.wait_for_function("__game.replay().wait < 0.15", timeout=30000)
    cdp.send('Profiler.start')
    s.pg.wait_for_function("__game.replay().active && __game.replay().real > 0.4", timeout=30000)
    prof = cdp.send('Profiler.stop')['profile']
    s.b.close()
nodes = {n['id']: n for n in prof['nodes']}
dts = prof['timeDeltas']; samples = prof['samples']
self_t = Counter()
for sid, dt in zip(samples, dts):
    n = nodes[sid]; cf = n['callFrame']
    self_t[(cf['functionName'] or '(anon)', cf['url'].split('/')[-1], cf['lineNumber'] + 1)] += dt
tot = sum(self_t.values())
print('gesamt ms', round(tot / 1000))
for k, v in self_t.most_common(22): print(round(v / 1000, 1), k)
