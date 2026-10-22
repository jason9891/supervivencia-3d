#!/usr/bin/env python3
"""Hornea assets/characters/hero/armadura.glb sobre sera_limpio.glb → armadura-sera.glb (4 conjuntos: casco, pechera, brazos, piernas).
Uso: python3 tools/bake-armor.py     (requiere playwright + chromium y `three` en node_modules, igual que bake-hero.py)"""
import base64, json, os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = os.environ.get('THREE_DIR', os.path.join(ROOT, 'node_modules', 'three')) + '/'
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
OUT = os.path.join(ROOT, 'assets', 'characters', 'hero')
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(); pg.set_default_timeout(300000)
    pg.on('pageerror', lambda e: print('error de página:', e)); pg.on('console', lambda m: print(' ·', m.text[:160]))
    pg.route('**/cdn.jsdelivr.net/npm/three@0.170.0/**', lambda r: r.fulfill(path=THREE + r.request.url.split('three@0.170.0/')[1]))
    pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/bake-armor.html'); pg.wait_for_function('window.__ready')
    res = pg.evaluate('o => window.__bake(o)', {'grow': float(os.environ.get('GROW', '1'))})
    open(os.path.join(OUT, 'armadura-sera.glb'), 'wb').write(base64.b64decode(res['glb64']))
    json.dump(res['meta'], open(os.path.join(OUT, 'armadura-sera.meta.json'), 'w'), indent=1)
    print(round(res['meta']['bytes'] / 1e6, 2), 'MB'); print('\n'.join(res['meta']['report'])); b.close()
