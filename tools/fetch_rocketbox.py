# Holt ausgewählte Dateien aus Microsoft Rocketbox (MIT, github.com/microsoft/Microsoft-Rocketbox) nach
# assets_src/rocketbox/ (gitignored) – nur die benötigten Avatare und Animationen, nicht das ganze Repo (~4 GB).
# Dateiliste und Größen aus dem Git-Baum (GitHub-API), Download über raw.githubusercontent.com mit Wiederholung
# und Größenprüfung. Aufruf: python3 tools/fetch_rocketbox.py [avatar ...]   (ohne Angabe: alle aus AVATARS)
import json, os, subprocess, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'assets_src', 'rocketbox')
REPO = 'microsoft/Microsoft-Rocketbox'
RAW = f'https://raw.githubusercontent.com/{REPO}/master/'

# Spieler (Sports) + Erwachsene für Vielfalt. Ordner unter Assets/Avatars/…
AVATARS = {
    'Sports_Male_01': 'Professions', 'Sports_Male_02': 'Professions', 'Sports_Male_03': 'Professions',
    'Sports_Male_04': 'Professions', 'Sports_Female_01': 'Professions', 'Sports_Female_02': 'Professions',
}
# Bewegungen (selbes Biped-Skelett „Bip01“), männlich (m_) und weiblich (f_)
ANIMS = [
    'idle_neutral_01', 'idle_breathe_01', 'walk_neutral_01', 'run_slow_01', 'run_neutral_01', 'run_fast_01',
    'run_start', 'run_stop', 'turn_left_90', 'turn_left_180', 'turn_right_90', 'turn_right_180',
    'cheer_01', 'cheer_02', 'cheer_03', 'claphands_01', 'idle_waiting_01', 'crouch_idle', 'wave_01',
]


def tree():
    p = os.path.join(DST, 'tree.json')
    if not os.path.exists(p):
        os.makedirs(DST, exist_ok=True)
        out = subprocess.run(['gh', 'api', f'repos/{REPO}/git/trees/master?recursive=1'], capture_output=True, check=True, timeout=120).stdout
        open(p, 'wb').write(out)
    t = json.load(open(p))['tree']
    return {x['path']: x.get('size') for x in t if x['type'] == 'blob'}


def get(path, size):
    out = os.path.join(DST, path)
    if os.path.exists(out) and os.path.getsize(out) == size:
        return False
    os.makedirs(os.path.dirname(out), exist_ok=True)
    url = RAW + urllib.parse.quote(path)
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'bandenkick-fetch'}), timeout=120) as r:
                data = r.read()
            if len(data) != size:
                raise IOError(f'Größe {len(data)} statt {size}')
            open(out, 'wb').write(data)
            return True
        except Exception as e:  # Netz wackelt → mit Pause neu versuchen
            print('  Wiederholung', i + 1, path, e, flush=True)
            time.sleep(2 + 3 * i)
    raise SystemExit('Download fehlgeschlagen: ' + path)


def main():
    sizes = tree()
    want = sys.argv[1:] or list(AVATARS)
    files = []
    for a in want:
        base = f'Assets/Avatars/{AVATARS.get(a, "Adults")}/{a}/'
        files += [p for p in sizes if p.startswith(base) and (p.endswith(f'Export/{a}.fbx') or '/Textures/' in p or p.endswith(f'{a}.png'))]
    for n in ANIMS:
        for g in 'mf':
            files += [p for p in sizes if p.startswith('Assets/Animations/') and p.endswith(f'/{g}_{n}.max.fbx')]
    files += ['LICENSE.md', 'README.md']
    tot = 0
    for p in files:
        if get(p, sizes[p]):
            tot += sizes[p]
            print(f'  {sizes[p] / 1e6:6.2f} MB  {p}', flush=True)
    print(f'{len(files)} Dateien, neu geladen {tot / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
