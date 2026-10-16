#!/usr/bin/env python3
"""Genera assets/anims/monster-death.json: cinco muertes (espalda, bruces, costado D/I, rodillas) con SUELO y GRAVEDAD.
Sobre el mismo esqueleto real y el mismo IK que la caminata/carrera/golpes (tools/gen-monster-moves.py), pero la caída va dentro del clip:
  · el cuerpo vuelca como un sólido alrededor de los pies (aceleración ∝ t², rebote al tocar) en vez de girar la raíz en el juego;
  · cada fotograma se eleva lo justo para que ningún volumen del cuerpo (tronco, cabeza con hocico y mandíbula, brazos, piernas, garras) atraviese
    el suelo (se comprueba con el FK completo, y se verifica al final);
  · los brazos dejan de seguir el clip y CUELGAN por gravedad hasta apoyarse en el suelo (nada de brazos tiesos como al caminar);
  · la mandíbula obedece a la gravedad: cae abierta de espaldas, floja de lado y se cierra de bruces (el hocico toca el suelo).
Uso: python3 tools/gen-monster-death.py   (necesita numpy; ejecutar desde la raíz del repo)"""
import sys, json, importlib.util
import numpy as np

_argv = sys.argv; sys.argv = ['x']
spec = importlib.util.spec_from_file_location('gm', 'tools/gen-monster-moves.py'); gm = importlib.util.module_from_spec(spec); spec.loader.exec_module(gm)
sys.argv = _argv
gw, G, track, sm, torso, compose, continuous = gm.gw, gm.G, gm.track, gm.sm, gm.torso, gm.compose, gm.continuous
Rx, Rz, Rrest, SIDE, REST_H, apole = gm.Rx, gm.Rz, gm.Rrest, gm.SIDE, gm.REST_H, gm.apole

FR = 0.025
T = 1.9                      # duración: caída ≈1 s + reposo
PIVOT = np.array([-0.03, 0.0, 0.0])    # punto del suelo entre los pies, eje de vuelco
MARGIN = 0.004
START, LAND = 0.30, 0.95     # el vuelco arranca tras el impacto y toca el suelo en LAND

def clamp01(v): return min(1.0, max(0.0, v))
def tilt_angle(t, final):
    """Ángulo de vuelco (rad, con signo): despacio al principio, cada vez más rápido (∝u²), toca en LAND y rebota un poco."""
    u = clamp01((t - START) / (LAND - START)); g = u * u
    if t > LAND:
        b = t - LAND; g = 1 - 0.06 * np.exp(-5 * b) * abs(np.sin(11 * b))
    return final * g

# ---------- volúmenes del cuerpo (esferas a lo largo de los huesos) para no atravesar el suelo
def body_points(pose):
    Rw, Pw = gw.editor_fk(pose)
    pts = []
    def seg(a, b, r, n=2):
        for k in range(n + 1): pts.append((Pw[G(a)] + (Pw[G(b)] - Pw[G(a)]) * k / n, r))
    seg('Hips', 'Spine', 0.10); seg('Spine', 'Spine1', 0.095); seg('Spine1', 'Spine2', 0.10); seg('Spine2', 'Neck', 0.075)
    hj = Pw[G('Head')]; Rh = Rw[G('Head')]; jaw = pose['jaw']['z']
    a = hj + Rh @ (Rrest[G('Head')].T @ np.array([-0.05, 0.0, 0.0]))
    b = hj + Rh @ (Rrest[G('Head')].T @ (gm.HEAD_TIP + np.array([0.0, jaw * 0.12, 0.0])))
    for k in range(4): pts.append((a + (b - a) * k / 3, 0.12))
    for s in ('Left', 'Right'):
        seg(s + 'Arm', s + 'ForeArm', 0.05); seg(s + 'ForeArm', s + 'Hand', 0.045)
        d = Pw[G(s + 'Hand')] - Pw[G(s + 'ForeArm')]; d /= np.linalg.norm(d); pts.append((Pw[G(s + 'Hand')] + d * 0.05, 0.04))
        seg(s + 'UpLeg', s + 'Leg', 0.065); seg(s + 'Leg', s + 'Foot', 0.05)
        pts.append((Pw[G(s + 'Foot')], 0.072))
        pts.append((Pw[G(s + 'Foot')] + Rw[G(s + 'Foot')] @ (Rrest[G(s + 'Foot')].T @ np.array([0.08, -0.04, 0.0])), 0.03))
    return pts, Rw, Pw

def need(pose):
    pts, _, _ = body_points(pose)
    return max(0.0, max(r - p[1] for p, r in pts) + MARGIN)

# ---------- mandíbula por gravedad (−z abre): de espaldas cae abierta (relajada), de lado queda floja, de bruces el hocico toca el suelo y se CIERRA
JAW_REST = {'back': -0.46, 'side': -0.12, 'front': -0.02, 'kneel': -0.20}
def jaw_target(mode, Pw, Rw):
    """Objetivo de la mandíbula en reposo. Si el hocico queda cerca del suelo (cabeza hacia abajo) el contacto la cierra, sea cual sea la variante."""
    hj = Pw[G('Head')]; tip = hj + Rw[G('Head')] @ (Rrest[G('Head')].T @ gm.HEAD_TIP)
    close = clamp01((0.20 - tip[1]) / 0.10) * clamp01((hj[1] - tip[1]) / 0.05)   # solo si el hocico apunta hacia el suelo y está cerca de él
    return JAW_REST[mode] * (1 - close) + JAW_REST['front'] * close

def limp(t, kind='arm'):
    s = lambda v: sm(clamp01(v))
    return float(s((t - 0.2) / 0.5)) if kind == 'arm' else float(0.8 * s((t - 0.8) / 0.5))

# ---------- variantes: pistas de colapso (lean, yaw, roll, caderas, mandíbula del clip, cabeza, brazos del clip, pies)
def _drag(a, b):
    def f(t):
        step = float(sm((t - 0.05) / 0.3)) * (1 - float(sm((t - 0.5) / 0.3)))
        return np.array([a * step, 0.0, 0.0]), np.array([b * step, 0.0, 0.0])
    return f

def arms_back(s):
    k = SIDE[s]
    return track([(0, REST_H * [1, 1, k]), (0.12, np.array([-0.07, 0.10, 0.22 * k]), 'out'), (0.40, np.array([-0.04, 0.05, 0.23 * k]), 'sm'), (0.85, np.array([0.06, -0.20, 0.13 * k]), 'sm')])
def arms_front(s):
    k = SIDE[s]
    return track([(0, REST_H * [1, 1, k]), (0.14, np.array([0.02, 0.0, 0.26 * k]), 'out'), (0.5, np.array([0.17, -0.17, 0.12 * k]), 'in'), (0.9, np.array([0.20, -0.22, 0.14 * k]), 'out')])
def arms_side(sg):
    def f(s):
        k = SIDE[s]
        if k == sg: return track([(0, REST_H * [1, 1, k]), (0.2, np.array([0.02, -0.02, 0.27 * k]), 'out'), (0.6, np.array([0.04, -0.18, 0.22 * k]), 'in')])
        return track([(0, REST_H * [1, 1, k]), (0.2, np.array([-0.04, 0.10, 0.20 * k]), 'out'), (0.7, np.array([0.02, -0.12, 0.14 * k]), 'sm')])
    return f
def arms_kneel(s):
    k = SIDE[s]
    return track([(0, REST_H * [1, 1, k]), (0.2, np.array([-0.02, 0.06, 0.22 * k]), 'out'), (0.65, np.array([0.05, -0.22, 0.14 * k]), 'sm')])

VARIANTS = {
    'death': dict(axis='z', mode='back', arms=arms_back, drag=_drag(-0.025, 0.02),
        lean=track([(0, 0.0), (0.12, -0.34, 'out'), (0.30, -0.30, 'sm'), (0.85, 0.30, 'in')]),
        yaw=track([(0, 0.0), (0.12, 0.26, 'out'), (0.85, -0.18, 'sm')]), roll=track([(0, 0.0), (0.2, 0.08, 'sm'), (0.85, -0.10, 'sm')]),
        hip=track([(0, [0, 0, 0]), (0.12, [-0.025, 0.006, 0], 'out'), (0.30, [-0.03, -0.01, 0], 'sm'), (0.85, [-0.03, -0.05, 0.01], 'in')]),
        jaw=track([(0, -0.10), (0.12, -0.45, 'out'), (0.40, -0.40, 'sm')]), head=track([(0, 0.0), (0.12, 0.30, 'out'), (0.30, 0.20, 'sm'), (0.85, -0.10, 'in')])),
    'deathFront': dict(axis='z', mode='front', arms=arms_front, drag=_drag(0.03, -0.02),
        lean=track([(0, 0.0), (0.14, 0.12, 'out'), (0.5, 0.40, 'in'), (0.95, 0.60, 'in')]),
        yaw=track([(0, 0.0), (0.14, -0.20, 'out'), (0.6, 0.12, 'sm')]), roll=track([(0, 0.0), (0.3, -0.06, 'sm'), (1.0, 0.10, 'sm')]),
        hip=track([(0, [0, 0, 0]), (0.14, [0.012, 0.004, 0], 'out'), (0.5, [0.03, -0.04, 0], 'in'), (0.95, [0.04, -0.06, 0], 'in')]),
        jaw=track([(0, -0.10), (0.14, -0.40, 'out'), (0.6, -0.20, 'sm')]), head=track([(0, 0.0), (0.14, 0.18, 'out'), (0.6, -0.10, 'sm'), (1.0, -0.20, 'sm')])),
    'deathSideR': dict(axis='x', sg=1, mode='side', arms=arms_side(1), drag=_drag(0.0, 0.0),
        lean=track([(0, 0.0), (0.2, -0.12, 'out'), (0.7, 0.14, 'sm')]), yaw=track([(0, 0.0), (0.2, -0.22, 'out'), (0.8, 0.15, 'sm')]),
        roll=track([(0, 0.0), (0.25, -0.12, 'sm'), (0.8, 0.20, 'in')]),
        hip=track([(0, [0, 0, 0]), (0.2, [-0.015, 0.0, -0.01], 'out'), (0.8, [0.0, -0.05, 0.03], 'in')]),
        jaw=track([(0, -0.10), (0.2, -0.40, 'out'), (0.8, -0.24, 'sm')]), head=track([(0, 0.0), (0.2, 0.22, 'out'), (0.8, -0.10, 'sm')])),
    'deathSideL': dict(axis='x', sg=-1, mode='side', arms=arms_side(-1), drag=_drag(0.0, 0.0),
        lean=track([(0, 0.0), (0.2, -0.12, 'out'), (0.7, 0.14, 'sm')]), yaw=track([(0, 0.0), (0.2, 0.22, 'out'), (0.8, -0.15, 'sm')]),
        roll=track([(0, 0.0), (0.25, 0.12, 'sm'), (0.8, -0.20, 'in')]),
        hip=track([(0, [0, 0, 0]), (0.2, [-0.015, 0.0, 0.01], 'out'), (0.8, [0.0, -0.05, -0.03], 'in')]),
        jaw=track([(0, -0.10), (0.2, -0.40, 'out'), (0.8, -0.24, 'sm')]), head=track([(0, 0.0), (0.2, 0.22, 'out'), (0.8, -0.10, 'sm')])),
    'deathKneel': dict(axis='z', mode='kneel', arms=arms_kneel, drag=_drag(0.0, 0.0),
        lean=track([(0, 0.0), (0.2, -0.10, 'out'), (0.65, 0.10, 'sm'), (0.95, 0.20, 'sm'), (1.35, 0.50, 'in')]),
        yaw=track([(0, 0.0), (0.2, 0.12, 'out'), (1.35, 0.0, 'sm')]), roll=track([(0, 0.0), (0.4, 0.05, 'sm'), (1.35, -0.05, 'sm')]),
        hip=track([(0, [0, 0, 0]), (0.2, [-0.01, 0.0, 0], 'out'), (0.65, [-0.01, -0.12, 0], 'in'), (0.95, [0.0, -0.135, 0], 'out'), (1.35, [0.03, -0.14, 0], 'sm')]),
        jaw=track([(0, -0.10), (0.2, -0.38, 'out'), (0.65, -0.20, 'sm')]), head=track([(0, 0.0), (0.2, 0.14, 'out'), (0.65, -0.10, 'sm'), (0.95, -0.12, 'sm'), (1.35, -0.40, 'in')])),
}

def base_frame(v, t, jaw):
    lt, rt_ = v['drag'](t)
    pole = {s: apole[s] * (1 - clamp01(t / 0.2)) + np.array([-0.5, -0.85, 0.0]) * clamp01(t / 0.2) for s in ('Left', 'Right')}
    return {'d_hips': v['hip'](t), 'torso': torso(float(v['yaw'](t)), float(v['roll'](t)), float(v['lean'](t)), (0.5, 0.5, 0.7, 0.9), (0.1, 0.3, 0.55, 0.85), head_lean=float(v['head'](t))),
            'hand': {s: v['arms'](s)(t) for s in ('Left', 'Right')}, 'ank': {'Left': (lt, 0.0), 'Right': (rt_, 0.0)}, 'jaw': jaw, 'pole': pole}

def Rtilt(axis, a): return Rz(a) if axis == 'z' else Rx(a)

def final_angle(v):
    """Ángulo con el que el tronco queda tendido: espalda/bruces/costado según la dirección del tronco (cadera→hombros) en la pose final del colapso."""
    f = base_frame(v, 0.95, -0.2); pose = compose(f); Rw, Pw = gw.editor_fk(pose)
    d = Pw[G('Spine2')] - Pw[G('Hips')]
    if v['axis'] == 'x': return v['sg'] * np.pi / 2
    al = float(np.arctan2(d[1], d[0]))                    # ángulo del tronco sobre el plano XY (x = hacia delante)
    if v['mode'] == 'back': return np.pi - al             # el tronco acaba apuntando hacia atrás, tendido
    if v['mode'] == 'front': return -al                   # tendido hacia delante, boca abajo
    return -al * 0.55                                      # de rodillas: se inclina sobre las piernas sin llegar a tenderse

def build(name, v):
    fin = final_angle(v); n = round(T / FR); frames = []
    for f in range(n + 1):
        t = f * FR
        a = tilt_angle(t, fin)
        Rt = Rtilt(v['axis'], a)
        wj = float(sm(clamp01((t - 0.35) / 0.5)))
        # paso 0: sin manos al suelo, para conocer hombros, cabeza y gravedad de la mandíbula
        fr = base_frame(v, t, float(v['jaw'](t))); fr['tilt'] = (Rt, PIVOT)
        pose0 = compose(fr); Rw0, Pw0 = gw.editor_fk(pose0)
        jaw = (1 - wj) * float(v['jaw'](t)) + wj * jaw_target(v['mode'], Pw0, Rw0)
        # los brazos cuelgan: la mano cae hacia el suelo bajo el hombro (se extiende hacia delante si el hombro ya está bajo)
        fr = base_frame(v, t, jaw); fr['tilt'] = (Rt, PIVOT); fr['hand_world'] = {}
        wa = limp(t, 'arm')
        for s in ('Left', 'Right'):
            sh = Pw0[G(s + 'Arm')]; low = clamp01((0.38 - sh[1]) / 0.3)
            fr['hand_world'][s] = (np.array([sh[0] + 0.03 + 0.20 * low, 0.095, sh[2] + SIDE[s] * 0.03]), wa)
        frames.append((t, fr))
    # elevar cada fotograma lo justo para no atravesar el suelo (suavizado para evitar tirones, sin quedar nunca por debajo de lo necesario)
    needs = np.array([need(compose(dict(fr))) for _, fr in frames])
    k = np.exp(-0.5 * (np.arange(-6, 7) / 2.0) ** 2); k /= k.sum()
    smooth = np.convolve(np.pad(needs, 6, mode='edge'), k, mode='valid')
    lifts = np.maximum(needs, smooth)
    keys = []
    for (t, fr), lf in zip(frames, lifts):
        fr = dict(fr); fr['lift'] = float(lf)
        # el cuerpo entero sube rígido: los puntos del mundo a los que cae la mano suben con él
        fr['hand_world'] = {s: (p + np.array([0.0, float(lf), 0.0]), w) for s, (p, w) in fr['hand_world'].items()}
        keys.append({'t': round(t, 3), 'pose': compose(fr)})
    return {'name': name, 'duration': round(T, 4), 'keys': continuous(keys), 'speed': 0.0, 'tilt': {'axis': 'z', 'angle': 0.0}, 'baked': True}

def verify(clip):
    """Peor penetración del suelo en todo el clip (debe ser ≈0) y altura final del cuerpo."""
    worst = 0.0
    for kf in clip['keys']:
        pts, _, _ = body_points(kf['pose']); worst = max(worst, max(r - p[1] for p, r in pts))
    last = clip['keys'][-1]['pose']; pts, _, _ = body_points(last)
    return worst, min(p[1] - r for p, r in pts), max(p[1] for p, r in pts)

if __name__ == '__main__':
    out = {}
    for name, v in VARIANTS.items():
        c = build(name, v); out[name] = c
        pen, low, high = verify(c)
        print(f'{name}: ángulo final {np.degrees(final_angle(v)):6.1f}°  peor penetración {pen:+.4f}  punto más alto final {high:.3f}')
    note = 'Muertes realistas con suelo y gravedad (caída dentro del clip, brazos que cuelgan, mandíbula por gravedad). Generada por tools/gen-monster-death.py.'
    json.dump({'version': 2, 'rig': 'mixamo', 'note': note, 'clips': out}, open('assets/anims/monster-death.json', 'w'), separators=(',', ':'))
