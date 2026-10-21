#!/usr/bin/env python3
"""Hornea assets/characters/hero/personaje_1.fbx + las animaciones FBX en personaje_1.glb y personaje_1.meta.json.
Requisitos: python3 con playwright y chromium (en este entorno: /opt/pw-browsers/chromium) y `npm i three` en la raíz.
Uso:  python3 tools/bake-hero.py [ual|mixamo]   (por defecto ual: las animaciones de siempre sobre el personaje)
Antes:  node tools/gen-hero-manifest.mjs && python3 tools/bake-hero.py
"""
import base64, json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = os.environ.get('THREE_DIR', os.path.join(ROOT, 'node_modules', 'three')) + '/'
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
OUT = os.path.join(ROOT, 'assets', 'characters', 'hero')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k): pass
handler = functools.partial(Quiet, directory=ROOT)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page()
    pg.on('pageerror', lambda e: print('error de página:', e))
    pg.route('**/cdn.jsdelivr.net/npm/three@0.170.0/**', lambda r: r.fulfill(path=THREE + r.request.url.split('three@0.170.0/')[1]))
    pg.goto(f'http://127.0.0.1:{port}/tools/bake-hero.html')
    pg.wait_for_function('window.__ready', timeout=60000)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'ual'      # ual = animaciones de siempre sobre el personaje · mixamo = las FBX
    res = pg.evaluate('m => window.__bake(m)', mode)
    open(os.path.join(OUT, 'personaje_1.glb' if mode == 'ual' else 'personaje_1-mixamo.glb'), 'wb').write(base64.b64decode(res['glb64']))
    tex = pg.evaluate('window.__tex')
    if os.environ.get('SAVE_TEX'): open(os.environ['SAVE_TEX'], 'wb').write(base64.b64decode(tex.split(',')[1]))
    json.dump(res['meta'], open(os.path.join(OUT, 'personaje_1.meta.json' if mode == 'ual' else 'personaje_1-mixamo.meta.json'), 'w'), indent=1, ensure_ascii=False)
    print('GLB', round(res['meta']['glbBytes'] / 1e6, 2), 'MB ·', res['meta']['verts'], 'vértices ·', len(res['meta']['clips']), 'animaciones')
    b.close()
