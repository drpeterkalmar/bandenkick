# n7 Etappe 0: Knöpfe ohne Sprint im 3 gegen 3 (Pixel 7 hoch und quer) – Fotos für die Sichtprüfung, Knopf-Lagen (Abstand
# zur unteren rechten Ecke = Daumenbogen), keine Überlappung. Aufruf: python3 tests/n7_hud.py [Zusatz-Query, z. B. "&sprintfrei=0"]
import sys, json
sys.path.insert(0, 'tests')
from util import *
q = sys.argv[1] if len(sys.argv) > 1 else ''
tag = 'alt' if 'sprintfrei=0' in q else 'neu'
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer']):
        if i: s.new_context(form)
        s.open('?nosw&seed=5&play&nohelp&q=1' + q)
        s.ev("document.body.classList.add('touch')")
        s.wait_sim(2.5, timeout=120000)
        lag = s.ev("""() => { const W = innerWidth, H = innerHeight; const o = {};
          for (const id of ['bShot', 'bPass', 'bSwitch', 'bSprint']) { const e = document.getElementById(id); const r = e.getBoundingClientRect();
            if (getComputedStyle(e).display === 'none') { o[id] = 'aus'; continue; }
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2; o[id] = { mitte: [Math.round(W - cx), Math.round(H - cy)], ecke: Math.round(Math.hypot(W - cx, H - cy)), d: Math.round(r.width) }; }
          return o; }""")
        print(form, json.dumps(lag, ensure_ascii=False))
        print('  Überlappung:', s.overlaps(['#bShot', '#bPass', '#bSprint', '#bSwitch', '.score', '.iconbtn']), '· Fehler:', s.errors[:3])
        p = s.shot(f'hud_{tag}_{form}', 'n7'); from PIL import Image; im = Image.open(p).convert('RGB'); im.thumbnail((1100, 1100)); im.save(p[:-4] + '.jpg', quality=82); os.remove(p); print('  Foto:', p[:-4] + '.jpg')
    s.close()
