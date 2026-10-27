# Version beim Zusammenführen vergeben (Queue: erst nach dem Rebase unter der Push-Sperre, damit zwei Jobs nicht dieselbe Nummer
# nehmen): package.json-Version um eins erhöhen (patch, oder: minor), Platzhalter (z. B. VERSION_N8E1) in README.md und *_BERICHT.md
# durch die Nummer ersetzen, sw.js/build.js neu (tools/update_sw.py), alles committen.
# Aufruf: python3 tools/version_setzen.py PLATZHALTER "Commit-Text" [patch|minor]
import json, os, subprocess, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
ph, msg = sys.argv[1], sys.argv[2]
art = sys.argv[3] if len(sys.argv) > 3 else 'patch'
p = json.load(open('package.json', encoding='utf-8'))
v = [int(x) for x in p['version'].split('.')]
v = [v[0], v[1] + 1, 0] if art == 'minor' else [v[0], v[1], v[2] + 1]
p['version'] = '.'.join(map(str, v))
open('package.json', 'w', encoding='utf-8', newline='\n').write(json.dumps(p, indent=2, ensure_ascii=False) + '\n')
for f in ['README.md'] + glob.glob('*_BERICHT.md'):
    s = open(f, encoding='utf-8').read()
    if ph in s: open(f, 'w', encoding='utf-8', newline='\n').write(s.replace(ph, p['version']))
subprocess.run([sys.executable, 'tools/update_sw.py'], check=True)
subprocess.run(['git', 'add', '-A', 'package.json', 'README.md', 'sw.js', 'src/build.js'] + glob.glob('*_BERICHT.md'), check=True)
subprocess.run(['git', 'commit', '-m', f"{msg}; Release {p['version']}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"], check=True)
print('Version', p['version'])
