#!/usr/bin/env python3
"""Hornea assets/characters/hero/sera_limpio.fbx en sera_limpio.glb (malla simplificada, metros, textura 2048, sin animaciones).
Uso:  python3 tools/bake-sera.py [triangulos]   (por defecto 45000)
Requisitos: python3 + playwright + chromium (/opt/pw-browsers/chromium) y `npm i three` en la raíz."""
import base64, json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = os.environ.get('THREE_DIR', os.path.join(ROOT, 'node_modules', 'three')) + '/'
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
OUT = os.path.join(ROOT, 'assets', 'characters', 'hero')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]
tris = int(sys.argv[1]) if len(sys.argv) > 1 else 45000
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=4096'])
    pg = b.new_page(); pg.set_default_timeout(900000)
    pg.on('pageerror', lambda e: print('error de página:', e)); pg.on('console', lambda m: print(' ·', m.text[:160]))
    pg.route('**/cdn.jsdelivr.net/npm/three@0.170.0/**', lambda r: r.fulfill(path=THREE + r.request.url.split('three@0.170.0/')[1]))
    pg.goto(f'http://127.0.0.1:{port}/tools/bake-sera.html'); pg.wait_for_function('window.__ready')
    res = pg.evaluate('t => window.__bake(t)', tris)
    open(os.path.join(OUT, 'sera_limpio.glb'), 'wb').write(base64.b64decode(res['glb64']))
    json.dump(res['meta'], open(os.path.join(OUT, 'sera_limpio.meta.json'), 'w'), indent=1)
    print(res['meta']); b.close()
