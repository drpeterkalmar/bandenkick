# Test-Helfer (Vorlage: Stuntbahn): eingebauter HTTP-Server (Thread, endet mit dem Skript), Playwright mit
# Pixel-7-Emulation hoch/quer bzw. Desktop, WebGL über die GPU (ANGLE/Metal), Fehler-Sammlung, Screenshots.
import os, sys, time, json, threading, socket, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
PIXEL7_HOCH = dict(viewport={"width": 412, "height": 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=UA)
PIXEL7_QUER = dict(viewport={"width": 915, "height": 412}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=UA)
DESKTOP = dict(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
DEVICES = {'hoch': PIXEL7_HOCH, 'quer': PIXEL7_QUER, 'desktop': DESKTOP}
# WebGL headless über die echte GPU (ANGLE/Metal) statt SwiftShader; SwiftShader erzwingen: WEBGL=swiftshader
GPU_ARGS = ["--use-angle=metal", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
SWIFT_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
ARGS = SWIFT_ARGS if os.environ.get('WEBGL') == 'swiftshader' else GPU_ARGS
GL_RENDERER = """() => { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return 'kein WebGL2';
  const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }"""

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

class BigQueueServer(ThreadingHTTPServer):
    request_queue_size = 128   # Standard 5 → Verbindungsabbrüche bei vielen parallelen Modulen
    daemon_threads = True

class Server:
    def __init__(self, root=ROOT):
        self.root = root
    def __enter__(self):
        s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
        self.httpd = BigQueueServer(('127.0.0.1', port), functools.partial(Quiet, directory=self.root))
        self.t = threading.Thread(target=self.httpd.serve_forever, daemon=True); self.t.start()
        self.base = f'http://127.0.0.1:{port}/'
        return self
    def __exit__(self, *a):
        self.httpd.shutdown(); self.httpd.server_close()

class Session:
    """Ein Browser, ein Kontext. Nie zwei Browser gleichzeitig (8 GB RAM)."""
    def __init__(self, pw, base, device='quer'):
        self.base = base
        self.b = pw.chromium.launch(args=ARGS)
        self.ctx = None
        self.new_context(device)
    def new_context(self, device):
        if self.ctx: self.ctx.close()
        self.device = device
        self.ctx = self.b.new_context(**DEVICES[device])
        self.pg = self.ctx.new_page()
        self.errors = []; self.console = []; self.warnings = []
        self.pg.on("pageerror", lambda e: self.errors.append("PAGEERROR " + str(e)))
        self.pg.on("requestfailed", lambda r: (self.warnings if 'ERR_ABORTED' in str(r.failure) else self.errors).append("REQFAIL " + r.url + " " + str(r.failure)))
        self.pg.on("console", lambda m: (self.console.append(m.type + ": " + m.text), self.errors.append("CONSOLE " + m.text) if m.type == "error" else None))
    def open(self, q='?nosw', timeout=120000):
        t0 = time.time()
        self.pg.goto(self.base + 'index.html' + q)
        self.pg.wait_for_function("window.__game && window.__game.ready && window.__game.frames > 3", timeout=timeout)
        self.boot_s = time.time() - t0
        self.gl = self.ev(GL_RENDERER)
        if ARGS is GPU_ARGS and 'Metal' not in str(self.gl):
            print('WARNUNG WebGL läuft nicht auf der GPU:', self.gl, file=sys.stderr, flush=True)
        errs = self.ev("window.__errors || []")
        if errs: self.errors += ['JSERR ' + e for e in errs]
    def ev(self, js, arg=None):
        return self.pg.evaluate(js, arg) if arg is not None else self.pg.evaluate(js)
    def shot(self, name, sub=''):
        d = os.path.join(ROOT, 'tests', 'shots', sub) if sub else os.path.join(ROOT, 'tests', 'shots')
        os.makedirs(d, exist_ok=True)
        # Fotos für das Repo (tests/shots/final) als JPG, Arbeitsfotos als PNG
        p = os.path.join(d, f'{name}.jpg' if sub == 'final' else f'{name}.png')
        self.pg.screenshot(path=p, **({'type': 'jpeg', 'quality': 82} if sub == 'final' else {}))
        return p
    def frames(self, n=3, timeout=60000):
        f0 = self.ev("window.__game.frames")
        self.pg.wait_for_function(f"window.__game.frames >= {f0 + n}", timeout=timeout)
    def wait_sim(self, sec, timeout=60000):
        t0 = self.ev("window.__game.game.t")
        self.pg.wait_for_function(f"window.__game.game.t >= {t0 + sec}", timeout=timeout)
    def tap(self, sel):
        el = self.pg.locator(sel).first
        el.wait_for(state='visible', timeout=20000)
        el.scroll_into_view_if_needed()  # Karten mit Rollbereich (quer): Knopf erst ins Bild holen
        box = el.bounding_box()
        try:
            self.pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        except Exception:
            self.pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        time.sleep(0.2)
    def state(self):
        return self.ev("__game.state()")
    def small_buttons(self):
        # alle sichtbaren Knöpfe < 48 px oder außerhalb des Bildes
        return self.ev("""() => { const out=[]; const W=innerWidth,H=innerHeight;
          for (const b of document.querySelectorAll('button')) { const r=b.getBoundingClientRect(); const st=getComputedStyle(b);
            if (!r.width || st.display==='none' || st.visibility==='hidden' || b.offsetParent===null) continue;
            if (r.width < 47.5 || r.height < 47.5 || r.left < -1 || r.top < -1 || r.right > W+1 || r.bottom > H+1) out.push({t:(b.textContent||'').trim().slice(0,24), w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), y:Math.round(r.top)}); }
          return out; }""")
    def overlaps(self, sels):
        # paarweise Überlappung sichtbarer Elemente (Knöpfe dürfen sich nicht überdecken)
        return self.ev("""(sels) => { const rs = sels.map(s => [s, document.querySelector(s)]).filter(([s,e]) => e && e.offsetParent !== null).map(([s,e]) => [s, e.getBoundingClientRect()]);
          const out = []; for (let i=0;i<rs.length;i++) for (let j=i+1;j<rs.length;j++) { const a=rs[i][1], b=rs[j][1];
            if (a.left < b.right-1 && b.left < a.right-1 && a.top < b.bottom-1 && b.top < a.bottom-1) out.push(rs[i][0]+' × '+rs[j][0]); } return out; }""", sels)
    def close(self):
        try: self.ctx.close()
        except Exception: pass
        self.b.close()
