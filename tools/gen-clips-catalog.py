#!/usr/bin/env python3
"""Lista los clips de los GLB de animación (UAL1, UAL2, Jordan) en assets/characters/clips-catalog.json para clips-lab.html.
Uso: python3 tools/gen-clips-catalog.py   (volver a correr si se agregan GLB con animaciones)"""
import json, os, struct
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = [('ual1', 'UAL 1', 'assets/characters/ual/UAL1_Standard.glb'), ('ual2', 'UAL 2', 'assets/characters/ual/UAL2_Standard.glb'),
       ('jordan', 'JORDAN', 'assets/characters/animations/locomotion-collection-jordan-3d-person-animated.glb')]
out = []
for id_, label, rel in SRC:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p): continue
    d = open(p, 'rb').read(); n = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + n])
    out.append({'id': id_, 'label': label, 'url': rel, 'mb': round(os.path.getsize(p) / 1e6, 1), 'clips': [a['name'] for a in j.get('animations', []) if a['name'] != 'A_TPose']})
json.dump({'sources': out}, open(os.path.join(ROOT, 'assets/characters/clips-catalog.json'), 'w'), indent=1, ensure_ascii=False)
print({s['id']: len(s['clips']) for s in out})
