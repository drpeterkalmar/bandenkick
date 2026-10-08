# Fotos für die Technik-Abnahme (n4): dieselben festen Szenen wie die Deko (tests/deko_scenes.py), aber mit wählbarer
# Grafikstufe und URL-Zusatz – Kino-Look gegen ?kino=0, Tag gegen Abend, Stufe 1 gegen 2, Fuß am Ball im Replay-Zoom.
# Aufruf: python3 tests/technik_shots.py <name> [url-zusatz] [stufe] [formate …]
#   z. B. python3 tests/technik_shots.py alt "&kino=0&ik=0&cull=0&schattenkam=0" 1 hoch quer
#         SZENEN=replay,spiel python3 tests/technik_shots.py abend "&licht=abend" 1
#   → tests/shots/technik_raw/<name>/<form>_<szene>.png
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import *
import deko_scenes as S

name = sys.argv[1] if len(sys.argv) > 1 else 'dev'
extra = sys.argv[2] if len(sys.argv) > 2 else ''
stufe = sys.argv[3] if len(sys.argv) > 3 else '1'
forms = sys.argv[4:] or ['hoch', 'quer']
only = os.environ.get('SZENEN', '').split(',') if os.environ.get('SZENEN') else None
sub = os.path.join('technik_raw', name)
want = lambda k: not only or k in only

# Die Deko-Szenen setzen q=1 fest → Stufe tauschen; Kurzmessung aus (Startbild sonst je Lauf anders)
_open = S.open_ready
S.open_ready = lambda s, q: _open(s, q.replace('&q=1', f'&q={stufe}') + '&startprobe=0')

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        shot = lambda n: s.shot(f'{f}_{n}', sub)
        res = {}
        if want('menu'):
            S.menu(s, extra); S.hide_cards(s); s.frames(3); shot('01_menu_szene'); S.hide_cards(s, False)
        if want('anstoss'):
            S.kickoff(s, extra); shot('03_anstoss')
        if want('spiel'):
            res['duel'] = S.duel(s, extra); shot('04_spiel')
        if want('jubel'):
            S.jubel(s, extra); shot('05_jubel')
        if want('replay'):
            res['replay'] = list(S.replay_shots(s, lambda n: shot('06_' + n), extra).keys())
        if want('graetsche'):
            S.graetsche(s, lambda n: shot(n), extra)
        if want('hechten'):
            S.hechten(s, lambda n: shot(n), extra)
        info = s.ev("__game.info()")
        print(f, json.dumps(res, ensure_ascii=False))
        print('  info', json.dumps({k: info.get(k) for k in ['calls', 'triangles', 'dpr', 'size', 'kino', 'shadow']}, ensure_ascii=False))
        print('  Fehler', s.errors[:6], s.ev('window.__errors'))
    s.close()
