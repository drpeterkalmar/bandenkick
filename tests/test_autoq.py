# Qualitäts-Automatik: ohne ?q= senkt das Spiel bei zu langsamer Bildfolge die Auflösung (headless ist der
# Bildtakt ohnehin gedrosselt → die Automatik muss greifen), mit ?q= bleibt alles fest.
import sys, time
sys.path.insert(0, 'tests')
from util import *
fails = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'quer')
    s.open('?nosw&seed=1')
    d0 = s.ev("__game.info().dpr")
    s.ev("__game.start()")
    s.wait_sim(7.5)
    i = s.ev("__game.info()")
    rate = s.ev("__game.perf().rafMs")
    print('ohne ?q=: DPR', d0, '→', i['dpr'], 'Schritte', i['auto']['steps'], f'(Bildabstand {rate:.0f} ms)')
    if rate > 24 and not i['auto']['steps']: fails.append('Automatik hat nicht reagiert')
    s.new_context('quer')
    s.open('?nosw&seed=1&q=1')
    s.ev("__game.start()"); s.wait_sim(4)
    i2 = s.ev("__game.info()")
    print('mit ?q=1: DPR', i2['dpr'], 'Schritte', i2['auto']['steps'])
    if i2['auto']['steps']: fails.append('Automatik trotz ?q= aktiv')
    if s.errors: fails.append(str(s.errors[:2]))
    s.close()
print('AUTOMATIK', 'GRÜN' if not fails else 'ROT ' + str(fails))
sys.exit(1 if fails else 0)
