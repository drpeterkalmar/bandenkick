# Fotos der wichtigsten Ansichten für die Verschönerung (Deko), Handy hoch und quer: Startbildschirm (mit Karte und
# nur die Szene), Anstoß, Zweikampf, Tor-Jubel, Wiederholung (TV-Aufbau, Kontakt-Zoom, Fan-Cam), Training-Ergebnis.
# Aufruf: python3 tests/deko_shots.py <name> [url-zusatz] [formate …]
#   z. B. python3 tests/deko_shots.py vorher       → tests/shots/deko_raw/vorher/<form>_<szene>.png
#         python3 tests/deko_shots.py alt "&deko=0"  (altes Aussehen zum Vergleich)
import sys, json, os
sys.path.insert(0, 'tests')
from util import *
import deko_scenes as S

name = sys.argv[1] if len(sys.argv) > 1 else 'dev'
extra = sys.argv[2] if len(sys.argv) > 2 else ''
forms = sys.argv[3:] or ['hoch', 'quer']
only = os.environ.get('SZENEN', '').split(',') if os.environ.get('SZENEN') else None
sub = os.path.join('deko_raw', name)
want = lambda k: not only or k in only

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        shot = lambda n: s.shot(f'{f}_{n}', sub)
        res = {}
        if want('menu'):
            S.menu(s, extra)
            shot('01_menu')
            S.hide_cards(s); s.frames(3); shot('02_menu_szene'); S.hide_cards(s, False)
        if want('anstoss'):
            S.kickoff(s, extra); shot('03_anstoss')
        if want('spiel'):
            res['duel'] = S.duel(s, extra); shot('04_spiel')
        if want('jubel'):
            S.jubel(s, extra); shot('05_jubel')
        if want('replay'):
            res['replay'] = list(S.replay_shots(s, lambda n: shot('06_' + n), extra).keys())
        if want('effekte'):
            S.tor_konfetti(s, lambda n: shot(n), extra)
            S.schuss_spur(s, extra); shot('10_ballspur')
            S.graetsche(s, lambda n: shot(n), extra)
            S.nummern(s, extra); shot('11_nummer'); s.ev("__game.cam(null)")
            S.hechten(s, lambda n: shot(n), extra)
        if want('training'):
            res['training'] = S.training_result(s, extra); shot('07_training_ergebnis')
        info = s.ev("__game.info()")
        print(f, json.dumps(res, ensure_ascii=False))
        print('  info', json.dumps({k: info[k] for k in ['calls', 'triangles', 'textures', 'geometries', 'programs', 'dpr', 'size']}))
        print('  errors', s.errors[:6], s.ev('window.__errors'))
    s.close()
