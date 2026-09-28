# Lädt die Fremd-Assets reproduzierbar nach assets_src/ (nicht im Repo; siehe .gitignore).
# Aufruf: python3 tools/fetch_assets.py   — danach: python3 tools/make_assets.py
# Quellen (alle CC0): Poly Haven HDRI „Suburban Football Field“ (Grzegorz Wronkowski),
# Reserve „Suburban Soccer Park“; ambientCG Grass001/Grass004/Grass005.
import json, os, sys, time, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src')
os.makedirs(SRC, exist_ok=True)
UA = {'User-Agent': 'bandenkick-asset-fetch'}

def get(url, dest, size=None, tries=5):
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        return
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r, open(dest + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 16)
                    if not b: break
                    f.write(b)
            if size is not None and os.path.getsize(dest + '.part') != size:
                raise IOError('Größe falsch')
            os.replace(dest + '.part', dest)
            print('ok', os.path.basename(dest), os.path.getsize(dest), flush=True)
            return
        except Exception as e:
            print('retry', i + 1, url, e, flush=True)
            time.sleep(2 * (i + 1))
    sys.exit('Download fehlgeschlagen: ' + url)

def api(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('retry api', url, e); time.sleep(2 * (i + 1))
    sys.exit('API fehlgeschlagen: ' + url)

meta = {}
for hid, ress in [('suburban_football_field', ['1k', '4k'])]:
    f = api('https://api.polyhaven.com/files/' + hid)
    info = api('https://api.polyhaven.com/info/' + hid)
    for res in ress:
        e = f['hdri'][res]['hdr']
        get(e['url'], os.path.join(SRC, f'{hid}_{res}.hdr'), e['size'])
    meta[hid] = {'url': 'https://polyhaven.com/a/' + hid, 'authors': list(info.get('authors', {}).keys()), 'license': 'CC0'}

for gid in ['Grass001', 'Grass004', 'Grass005']:
    d = api(f'https://ambientcg.com/api/v2/full_json?id={gid}&include=downloadData')
    a = d['foundAssets'][0]
    dl = [x for c in a['downloadFolders']['default']['downloadFiletypeCategories'].values() for x in c['downloads']]
    z = next(x for x in dl if x['attribute'] == '1K-JPG')
    dest = os.path.join(SRC, f'{gid}_1K-JPG.zip')
    get(z['fullDownloadPath'] if 'fullDownloadPath' in z else z['downloadLink'], dest, z.get('size'))
    with zipfile.ZipFile(dest) as zf:
        for n in zf.namelist():
            if any(k in n for k in ['_Color.', '_NormalGL.', '_Roughness.', '_AmbientOcclusion.']):
                zf.extract(n, os.path.join(SRC, gid))
    meta[gid] = {'url': 'https://ambientcg.com/view?id=' + gid, 'authors': ['ambientCG (Lennart Demes)'], 'license': 'CC0'}
json.dump(meta, open(os.path.join(SRC, 'sources.json'), 'w'), indent=1)
print('fertig')
