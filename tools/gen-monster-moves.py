#!/usr/bin/env python3
"""Genera assets/anims/monster-run.json y assets/anims/monster-attack.json con el MISMO método de la caminata realista
(tools/gen-monster-walk.py): esqueleto real del monstruo (Tripo, mira hacia +X, derecha = +Z), IK de 2 huesos para piernas y
brazos, torsión/inclinación del tronco repartida por la columna, hueso de mandíbula (clave 'jaw', −Z abre).
  · run:     ciclo con fase aérea, inclinación hacia delante, rebote de cadera y brazos flexionados en oposición.
  · attack1: zarpazo derecho (anticipación → latigazo cruzando el cuerpo → remate → recuperación).
  · attack2: zarpazo izquierdo (espejo).
  · attack3: golpe a dos manos desde arriba (carga con rugido, embestida, impacto).
Cada clip lleva `hit` (segundo en que cae el golpe) y `speed` (m/s de suelo a rate 1 en el juego, escala 2.69) para sincronizar IA y animación.
Uso: python3 tools/gen-monster-moves.py   (necesita numpy; ejecutar desde la raíz del repo)"""
import json, sys, importlib.util
import numpy as np

_argv = sys.argv; sys.argv = ['x', '/dev/null']
spec = importlib.util.spec_from_file_location('gw', 'tools/gen-monster-walk.py'); gw = importlib.util.module_from_spec(spec); spec.loader.exec_module(gw)
sys.argv = _argv
G, TL, RL, Rrest, Prest, par, KEYS = gw.G, gw.TL, gw.RL, gw.Rrest, gw.Prest, gw.par, gw.KEYS
Rx, Ry, Rz, rot_from_to, ik3, euler_xyz = gw.Rx, gw.Ry, gw.Rz, gw.rot_from_to, gw.ik3, gw.euler_xyz
FR = 0.05
SCALE = 2.69   # unidades GLB → metros en el juego

# ---------- brazos: longitudes y polo del codo (hacia atrás y abajo, como en reposo)
ARM = {s: [G(s + 'Arm'), G(s + 'ForeArm'), G(s + 'Hand')] for s in ('Left', 'Right')}
a0 = {s: (Prest[ARM[s][1]] - Prest[ARM[s][0]], Prest[ARM[s][2]] - Prest[ARM[s][1]]) for s in ARM}
apole = {}
for s in ARM:
    H0, K0, A0 = (Prest[i] for i in ARM[s]); dh = (A0 - H0) / np.linalg.norm(A0 - H0); p = (K0 - H0) - ((K0 - H0) @ dh) * dh; apole[s] = p / np.linalg.norm(p)
SIDE = {'Left': -1.0, 'Right': 1.0}

def frame3(x, n):
    """Base ortonormal con eje X = dirección del hueso y Z = normal del plano del codo (proyectada): torsión determinista, sin vueltas."""
    x = x / np.linalg.norm(x); z = n - (n @ x) * x; z /= np.linalg.norm(z); y = np.cross(z, x)
    return np.stack([x, y, z], axis=1)
n0 = {}
for s_ in ARM:
    dh0 = (a0[s_][0] + a0[s_][1]); dh0 = dh0 / np.linalg.norm(dh0); n0[s_] = np.cross(dh0, apole[s_]); n0[s_] /= np.linalg.norm(n0[s_])

def sm(t): t = min(1.0, max(0.0, t)); return t * t * (3 - 2 * t)
EASE = {'sm': sm, 'in': lambda t: min(1.0, max(0.0, t)) ** 2.4, 'out': lambda t: 1 - (1 - min(1.0, max(0.0, t))) ** 2.4}

def track(keys):
    """keys = [(t, valor, easing_del_tramo_que_llega)] con valor escalar o vector; interpola entre fotogramas clave."""
    ks = [(k[0], np.array(k[1], float), k[2] if len(k) > 2 else 'sm') for k in keys]
    def f(t):
        if t <= ks[0][0]: return ks[0][1]
        for (t0, v0, _), (t1, v1, e) in zip(ks, ks[1:]):
            if t <= t1: return v0 + (v1 - v0) * EASE[e]((t - t0) / (t1 - t0))
        return ks[-1][1]
    return f

def compose(frame):
    """frame: dict con d_hips, torso{hips,spine,spine1,spine2,neck,head → matriz 3x3 delta de mundo}, hand{Left,Right → posición objetivo
    relativa a la articulación del hombro en el MODELO (se le aplica la rotación del tórax)}, ank{Left,Right → (offset tobillo, cabeceo)}, jaw.
    → pose Euler de los 20 huesos + 'jaw'."""
    d_hips, T = frame['d_hips'], frame['torso']
    Rwd = {G(n): T[k] for k, n in (('hips', 'Hips'), ('spine', 'Spine'), ('spine1', 'Spine1'), ('spine2', 'Spine2'), ('neck', 'Neck'), ('head', 'Head'))}
    Rdes = {i: Rwd[i] @ Rrest[i] for i in Rwd}
    P = {}
    P[G('Hips')] = Prest[G('Hips')] + d_hips
    for ch in ('Spine', 'Spine1', 'Spine2'):
        i = G(ch); P[i] = P[par[i]] + Rdes[par[i]] @ TL[i]
    Rs = Rdes[G('Spine2')]
    for s in ('Left', 'Right'):
        sh = G(s + 'Shoulder'); Rdes[sh] = Rwd[G('Spine2')] @ Rrest[sh]
        P[sh] = P[G('Spine2')] + Rdes[G('Spine2')] @ TL[sh]
        ids = ARM[s]; Pa = P[sh] + Rdes[sh] @ TL[ids[0]]
        tgt = Pa + Rwd[G('Spine2')] @ frame['hand'][s]
        l1, l2 = np.linalg.norm(a0[s][0]), np.linalg.norm(a0[s][1])
        pl = frame.get('pole', {}).get(s, apole[s])
        pole = Rwd[G('Spine2')] @ (pl / np.linalg.norm(pl))
        K = ik3(Pa, tgt, l1, l2, pole)
        dh = (tgt - Pa) / np.linalg.norm(tgt - Pa); nn = np.cross(dh, pole); nn /= np.linalg.norm(nn)
        F0a, F0f = frame3(a0[s][0], n0[s]), frame3(a0[s][1], n0[s])
        Rdes[ids[0]] = frame3(K - Pa, nn) @ F0a.T @ Rrest[ids[0]]
        Rf = frame3(tgt - K, nn) @ F0f.T
        Rdes[ids[1]] = Rf @ Rrest[ids[1]]
        Rdes[ids[2]] = Rf @ Rrest[ids[2]]
    Hips = G('Hips')
    for s in ('Left', 'Right'):
        ids = gw.LEG[s]; dA, pitch = frame['ank'][s]
        Hj = P[Hips] + Rdes[Hips] @ TL[ids[0]]
        Atar = gw.ANK0[s] + dA
        K = ik3(Hj, Atar, np.linalg.norm(gw.t0[s][0]), np.linalg.norm(gw.t0[s][1]), gw.pole0[s])
        Rdes[ids[0]] = rot_from_to(gw.t0[s][0], K - Hj) @ Rrest[ids[0]]
        Rdes[ids[1]] = rot_from_to(gw.t0[s][1], Atar - K) @ Rrest[ids[1]]
        Rdes[ids[2]] = Rz(pitch) @ Rrest[ids[2]]
    out = {}
    for key, nm in KEYS.items():
        i = G(nm); Rpar = Rdes[par[i]] if par[i] in Rdes else Rrest[par[i]]
        x, y, z = euler_xyz(RL[i].T @ Rpar.T @ Rdes[i]); out[key] = {'x': round(float(x), 4), 'y': round(float(y), 4), 'z': round(float(z), 4)}
    h = out['hips']; h['px'], h['py'], h['pz'] = (round(float(v), 4) for v in d_hips)
    out['jaw'] = {'x': 0, 'y': 0, 'z': round(float(frame['jaw']), 4)}
    return out

def torso(yaw=0.0, roll=0.0, lean=0.0, twist_share=(0.0, 0.25, 0.7, 0.9), lean_share=(0.0, 0.2, 0.35, 0.45), head_lean=0.0, head_yaw=0.0):
    """Reparte giro (yaw, +gira hacia la izquierda), balanceo (roll) e inclinación (lean, + hacia delante) por la columna.
    La cadera recibe su propio giro; el tórax lo contrarresta con `twist_share` (>0 acompaña la cadera, <0 contragira)."""
    sh = twist_share; ls = lean_share
    return {
        'hips': Ry(yaw * sh[0]) @ Rx(roll) @ Rz(-lean * ls[0]),
        'spine': Ry(yaw * sh[1]) @ Rx(-0.4 * roll) @ Rz(-lean * ls[1]),
        'spine1': Ry(yaw * sh[2]) @ Rx(-0.6 * roll) @ Rz(-lean * ls[2]),
        'spine2': Ry(yaw * sh[3]) @ Rx(-0.6 * roll) @ Rz(-lean * ls[3]),
        'neck': Ry(yaw * 0.2 + head_yaw * 0.5) @ Rz(lean * 0.25 * 0 + head_lean * 0.5),
        'head': Ry(head_yaw * 0.5) @ Rz(head_lean * 0.5),
    }

def continuous(keys):
    """Euler XYZ tiene dos tripletas por rotación: elige la más cercana al fotograma anterior (y desenrolla 2π) para que interpolar no dé vueltas."""
    prev = {}
    for kf in keys:
        for k, e in kf['pose'].items():
            c = np.array([e['x'], e['y'], e['z']])
            if k in prev:
                alt = np.array([c[0] + np.pi, np.pi - c[1], c[2] + np.pi])
                def un(v, ref): return v - 2 * np.pi * np.round((v - ref) / (2 * np.pi))
                c1, c2 = un(c, prev[k]), un(alt, prev[k])
                c = c1 if np.abs(c1 - prev[k]).sum() <= np.abs(c2 - prev[k]).sum() else c2
            prev[k] = c
            e['x'], e['y'], e['z'] = (round(float(v), 4) for v in c)
    return keys

def bake(name, dur, frame_at, loop, extra=None, fr=FR):
    n = round(dur / fr)
    keys = []
    for f in range(n + 1):
        t = round(f * fr, 4)
        ph = (f % n) / n if loop else f / n
        keys.append({'t': round(t, 3), 'pose': compose(frame_at(t, ph))})
    clip = {'name': name, 'duration': round(dur, 4), 'keys': continuous(keys)}
    clip.update(extra or {})
    return clip

# ======================================================= CARRERA
def run_clip():
    T = 0.45
    gw.S, gw.STANCE, gw.LIFT, gw.HEEL = 0.09, 0.34, 0.06, 0.02
    def frame(t, ph):
        th = 2 * np.pi * ph
        bob = -0.011 * np.cos(4 * np.pi * (ph - 0.17)) - 0.006        # más bajo en el apoyo, sube en la fase aérea
        sway = -0.008 * np.sin(2 * np.pi * (ph - 0.05))
        d = np.array([0.004 * np.cos(4 * np.pi * ph), bob, sway])
        yaw = -0.16 * np.cos(th); roll = 0.04 * np.sin(2 * np.pi * (ph - 0.05))
        lean = 0.24 + 0.015 * np.cos(4 * np.pi * ph)                   # inclinación de carrera
        ank = {}
        for s, off in (('Left', 0.0), ('Right', 0.5)):
            ank[s] = gw.foot((ph + off) % 1.0)
        hand = {}
        for s, off in (('Left', 0.0), ('Right', 0.5)):                 # brazo en oposición a la pierna del mismo lado
            sw = np.cos(th + np.pi * off * 2 + np.pi)
            sg = SIDE[s]
            hand[s] = np.array([0.04 + 0.12 * sw, -0.12 + 0.045 * max(0.0, sw) , sg * (0.15 - 0.02 * sw)])
        jaw = -0.17 + 0.06 * np.sin(4 * np.pi * (ph - 0.2))            # jadeo: la boca abierta marca el ritmo
        return {'d_hips': d, 'torso': torso(yaw, roll, lean, (1.0, 0.3, -0.5, -0.8), (0.0, 0.3, 0.55, 0.8), head_lean=-lean * 0.5, head_yaw=-0.1 * yaw), 'hand': hand, 'ank': ank, 'jaw': jaw}
    speed = (2 * gw.S) / (gw.STANCE * T) * SCALE
    return bake('run', T, frame, True, {'speed': round(float(speed), 2)}, fr=0.025)

# ======================================================= GOLPES
REST_H = np.array([0.012, -0.19, 0.18])    # mano en reposo respecto al hombro (z se multiplica por el lado)

def swipe_frame(side, T, hit):
    """Zarpazo de un solo brazo (side='Right' o 'Left'). Anticipación atrás-arriba, latigazo cruzando hacia el lado contrario."""
    sg = SIDE[side]; other = 'Left' if side == 'Right' else 'Right'
    ta = hit - 0.2                        # fin de la anticipación; el latigazo dura 0.2 s (≥4 fotogramas, sin saltos de pose)
    rec = hit + 0.12
    wind = np.array([-0.06, 0.08, 0.21 * sg]); mid = np.array([0.15, 0.06, 0.08 * sg]); strike = np.array([0.25, -0.10, -0.06 * sg]); over = np.array([0.21, -0.14, -0.09 * sg])
    hand_t = track([(0, REST_H * [1, 1, sg]), (ta, wind, 'sm'), (hit - 0.1, mid, 'in'), (hit, strike, 'out'), (hit + 0.07, over, 'out'), (T, REST_H * [1, 1, sg], 'sm')])
    off_t = track([(0, REST_H * [1, 1, SIDE[other]]), (ta, np.array([0.02, -0.07, 0.17 * SIDE[other]]), 'sm'), (hit, np.array([0.08, -0.12, 0.15 * SIDE[other]]), 'sm'), (T, REST_H * [1, 1, SIDE[other]], 'sm')])
    yaw_t = track([(0, 0.0), (ta, -0.38 * sg, 'sm'), (hit, 0.30 * sg, 'in'), (hit + 0.12, 0.34 * sg, 'out'), (T, 0.0, 'sm')])   # +yaw gira a la izquierda
    lean_t = track([(0, 0.0), (ta, -0.08, 'sm'), (hit, 0.28, 'in'), (hit + 0.12, 0.25, 'out'), (T, 0.0, 'sm')])
    hip_t = track([(0, [0, 0, 0]), (ta, [-0.012, -0.018, 0.0], 'sm'), (hit, [0.03, -0.02, -0.01 * sg], 'in'), (hit + 0.12, [0.028, -0.018, 0], 'out'), (T, [0, 0, 0], 'sm')])
    jaw_t = track([(0, -0.10), (ta, -0.20, 'sm'), (hit, -0.34, 'in'), (hit + 0.12, -0.30, 'out'), (T, -0.10, 'sm')])
    head_t = track([(0, 0.0), (ta, 0.06, 'sm'), (hit, -0.14, 'in'), (hit + 0.12, -0.11, 'out'), (T, 0.0, 'sm')])
    def pole(s, t):
        o = np.array([-0.5, -0.85, 0.0]); k = float(sm(t / max(ta, 1e-6))) * (1 - float(sm((t - hit - 0.1) / max(1e-6, T - hit - 0.1))))
        return apole[s] * (1 - k) + o * k
    def frame(t, ph):
        yaw, lean = float(yaw_t(t)), float(lean_t(t))
        hands = {side: hand_t(t), other: off_t(t)}
        ank = {s: (np.array([0.0, 0.0, 0.0]), 0.0) for s in ('Left', 'Right')}
        # pie adelantado en el impacto (zancada de ataque) sin despegar el otro
        step = float(sm((t - ta) / max(1e-6, hit - ta))) * (1 - float(sm((t - hit - 0.1) / max(1e-6, T - hit - 0.1))))
        lead = other     # al girar a la izquierda con el brazo derecho, avanza el pie contrario
        ank[lead] = (np.array([0.035 * step, 0.0, 0.0]), 0.0)
        return {'d_hips': hip_t(t), 'torso': torso(yaw, 0.0, lean, (0.45, 0.5, 0.7, 0.9), (0.1, 0.3, 0.55, 0.8), head_lean=float(head_t(t)), head_yaw=-yaw * 0.6),
                'hand': hands, 'ank': ank, 'jaw': float(jaw_t(t)), 'pole': {s_: pole(s_, t) for s_ in ('Left', 'Right')}}
    return frame

def slam_frame(T, hit):
    """Golpe a dos manos desde arriba: carga con la espalda arqueada y rugido, embestida y martillazo."""
    ta = hit - 0.28
    up = np.array([-0.02, 0.21, 0.13]); down = np.array([0.25, -0.11, 0.08]); low = np.array([0.22, -0.15, 0.10]); gather = np.array([0.0, 0.05, 0.16])
    def hand(s):
        sg = SIDE[s]
        return track([(0, REST_H * [1, 1, sg]), (hit * 0.3, gather * [1, 1, sg], 'sm'), (ta, up * [1, 1, sg], 'sm'), (hit - 0.16, up * [1, 1, sg] + [0.06, -0.03, 0], 'sm'), (hit, down * [1, 1, sg], 'out'), (hit + 0.10, low * [1, 1, sg], 'out'), (T, REST_H * [1, 1, sg], 'sm')])
    ht = {s: hand(s) for s in ('Left', 'Right')}
    lean_t = track([(0, 0.0), (ta, -0.22, 'sm'), (hit - 0.16, -0.25, 'sm'), (hit, 0.42, 'in'), (hit + 0.12, 0.39, 'out'), (T, 0.0, 'sm')])
    hip_t = track([(0, [0, 0, 0]), (ta, [-0.02, 0.012, 0], 'sm'), (hit - 0.16, [-0.02, 0.014, 0], 'sm'), (hit, [0.05, -0.03, 0], 'in'), (hit + 0.12, [0.047, -0.028, 0], 'out'), (T, [0, 0, 0], 'sm')])
    jaw_t = track([(0, -0.10), (ta * 0.5, -0.20, 'sm'), (ta, -0.50, 'sm'), (hit - 0.16, -0.52, 'sm'), (hit, -0.32, 'in'), (hit + 0.15, -0.2, 'out'), (T, -0.10, 'sm')])
    head_t = track([(0, 0.0), (ta, 0.18, 'sm'), (hit - 0.16, 0.20, 'sm'), (hit, -0.20, 'in'), (hit + 0.12, -0.16, 'out'), (T, 0.0, 'sm')])
    kp = lambda t: float(sm(t / max(ta, 1e-6))) * (1 - float(sm((t - hit - 0.12) / max(1e-6, T - hit - 0.12))))
    def frame(t, ph):
        lean = float(lean_t(t))
        step = float(sm((t - ta) / max(1e-6, hit - ta))) * (1 - float(sm((t - hit - 0.12) / max(1e-6, T - hit - 0.12))))
        ank = {'Left': (np.array([0.05 * step, 0.0, 0.0]), 0.0), 'Right': (np.array([-0.015 * step, 0.0, 0.0]), 0.0)}
        return {'d_hips': hip_t(t), 'torso': torso(0.0, 0.0, lean, (0, 0, 0, 0), (0.1, 0.3, 0.55, 0.85), head_lean=float(head_t(t))),
                'hand': {s: ht[s](t) for s in ht}, 'ank': ank, 'jaw': float(jaw_t(t)),
                'pole': {s_: apole[s_] * (1 - kp(t)) + np.array([-0.5, -0.85, 0.0]) * kp(t) for s_ in ('Left', 'Right')}}
    return frame

def attack_clips():
    specs = [('attack1', 0.80, 0.40), ('attack2', 0.80, 0.40), ('attack3', 1.15, 0.64)]
    out = {}
    for name, T, hit in specs:
        fr = slam_frame(T, hit) if name == 'attack3' else swipe_frame('Right' if name == 'attack1' else 'Left', T, hit)
        out[name] = bake(name, T, fr, False, {'hit': hit, 'chain': round(T if name == 'attack3' else hit + 0.24, 3), 'speed': 0.0}, fr=0.025)   # 40 fotogramas/s: los latigazos son rápidos
    return out

# ======================================================= MUERTE
def death_clip():
    """Golpe de gracia: sacudida hacia atrás con rugido, las rodillas ceden (cadera baja con los pies clavados), el cuerpo se desploma y queda inerte.
    El vuelco lateral lo hace la raíz en el juego (enemy-runtime) a lo largo de los mismos 1.35 s."""
    T = 1.35
    hit_t, buck, slump = 0.30, 0.85, 1.25
    lean_t = track([(0, 0.0), (0.12, -0.34, 'out'), (hit_t, -0.30, 'sm'), (buck, 0.30, 'in'), (slump, 0.55, 'out'), (T, 0.55, 'sm')])
    yaw_t = track([(0, 0.0), (0.12, 0.26, 'out'), (buck, -0.18, 'sm'), (T, -0.22, 'sm')])
    roll_t = track([(0, 0.0), (0.2, 0.08, 'sm'), (buck, -0.10, 'sm'), (T, -0.22, 'sm')])
    hip_t = track([(0, [0, 0, 0]), (0.12, [-0.025, 0.006, 0], 'out'), (hit_t, [-0.03, -0.01, 0], 'sm'), (buck, [-0.035, -0.095, 0.01], 'in'), (slump, [0.0, -0.125, 0.015], 'out'), (T, [0.0, -0.13, 0.015], 'sm')])
    jaw_t = track([(0, -0.10), (0.12, -0.45, 'out'), (hit_t + 0.1, -0.40, 'sm'), (buck, -0.22, 'sm'), (slump, -0.34, 'sm'), (T, -0.36, 'sm')])
    head_t = track([(0, 0.0), (0.12, 0.30, 'out'), (hit_t, 0.20, 'sm'), (buck, -0.30, 'in'), (T, -0.45, 'sm')])
    def arm(s):
        sg = SIDE[s]
        return track([(0, REST_H * [1, 1, sg]), (0.12, np.array([-0.07, 0.10, 0.22 * sg]), 'out'), (hit_t + 0.1, np.array([-0.04, 0.05, 0.23 * sg]), 'sm'),
                      (buck, np.array([0.06, -0.20, 0.13 * sg]), 'sm'), (T, np.array([0.04, -0.24, 0.12 * sg]), 'sm')])
    at = {s: arm(s) for s in ('Left', 'Right')}
    kp = lambda t: float(sm(t / 0.2))
    def frame(t, ph):
        step = float(sm((t - 0.05) / 0.3)) * (1 - float(sm((t - 0.5) / 0.3)))
        ank = {'Left': (np.array([-0.025 * step, 0.0, 0.0]), 0.0), 'Right': (np.array([0.02 * step, 0.0, 0.0]), 0.0)}   # un pie se arrastra al recular
        return {'d_hips': hip_t(t), 'torso': torso(float(yaw_t(t)), float(roll_t(t)), float(lean_t(t)), (0.5, 0.5, 0.7, 0.9), (0.1, 0.3, 0.55, 0.85), head_lean=float(head_t(t))),
                'hand': {s: at[s](t) for s in at}, 'ank': ank, 'jaw': float(jaw_t(t)),
                'pole': {s_: apole[s_] * (1 - kp(t)) + np.array([-0.5, -0.85, 0.0]) * kp(t) for s_ in ('Left', 'Right')}}
    return bake('death', T, frame, False, {'speed': 0.0}, fr=0.025)

def check(clip, label):
    """Comprobaciones numéricas: saltos de Euler entre fotogramas y pies/manos con el FK real del editor."""
    keys = clip['keys']; worst = 0.0; wk = None
    for a, b in zip(keys, keys[1:]):
        for k in a['pose']:
            for c in 'xyz':
                d = abs(b['pose'][k][c] - a['pose'][k][c])
                if d > worst: worst, wk = d, (a['t'], k, c)
    print(f'{label}: salto máx. de ángulo entre fotogramas {worst:.2f} rad en {wk}')
    miny = 9
    for kf in keys:
        Rw, Pw = gw.editor_fk(kf['pose'])
        miny = min(miny, Pw[G('LeftFoot')][1] - gw.ANK0['Left'][1], Pw[G('RightFoot')][1] - gw.ANK0['Right'][1])
    print(f'{label}: tobillo más bajo respecto al reposo {miny:+.3f} (≈0 → pies sobre el suelo, no lo atraviesan)')

if __name__ == '__main__':
    note = 'Generada por tools/gen-monster-moves.py con el mismo método que la caminata realista (IK sobre el esqueleto real, mandíbula).'
    run = run_clip(); check(run, 'run')
    json.dump({'version': 2, 'rig': 'mixamo', 'note': 'Carrera realista del monstruo. ' + note, 'clips': {'run': run}}, open('assets/anims/monster-run.json', 'w'), separators=(',', ':'))
    atk = attack_clips()
    for k, c in atk.items(): check(c, k)
    json.dump({'version': 2, 'rig': 'mixamo', 'note': 'Golpes realistas del monstruo (zarpazo D, zarpazo I, golpe a dos manos). ' + note, 'clips': atk}, open('assets/anims/monster-attack.json', 'w'), separators=(',', ':'))
    death = death_clip(); check(death, 'death')
    json.dump({'version': 2, 'rig': 'mixamo', 'note': 'Muerte realista del monstruo. ' + note, 'clips': {'death': death}}, open('assets/anims/monster-death.json', 'w'), separators=(',', ':'))
    print('run speed', run['speed'], 'm/s')
