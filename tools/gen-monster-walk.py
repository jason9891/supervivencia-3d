#!/usr/bin/env python3
"""Genera assets/anims/monster-walk.json: caminata editable para el esqueleto REAL del monstruo (Tripo, 65 huesos, mira hacia +X).
Método: pies plantados con IK de 2 huesos en 3D sobre las medidas reales del GLB, subida/bajada de cadera, balanceo lateral,
torsión de pelvis con contragiro del tórax, brazos en oposición y mandíbula entreabierta que respira.
Cada fotograma (0.05 s) lleva los ángulos Euler XYZ que usa anim-lab.html (pose = reposo × Euler) y la traslación px/py/pz de la cadera.
Uso: python3 tools/gen-monster-walk.py [salida.json]   (necesita numpy)"""
import json, struct, sys, numpy as np

GLB = 'assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/anims/monster-walk.json'
T, FR = 1.2, 0.05                 # ciclo de 1.2 s = 24 fotogramas
S = 0.05                          # semi-zancada (unidades GLB; ×2.69 en el juego)
STANCE = 0.6                      # fracción del ciclo con el pie en el suelo
LIFT = 0.035                      # altura del pie en vuelo

# ---------- esqueleto real
b = open(GLB, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]
nodes = json.loads(b[20:20 + jl])['nodes']
byname = {n['name'].replace('mixamorig:', ''): i for i, n in enumerate(nodes)}
par = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
TL = {i: np.array(n.get('translation', [0, 0, 0])) for i, n in enumerate(nodes)}
RL = {i: qmat(n.get('rotation', [0, 0, 0, 1])) for i, n in enumerate(nodes)}   # la escala de los huesos es ≈1: se ignora
def fk(local_rot, local_pos):
    Rw, Pw = {}, {}
    def go(i):
        if i in Rw: return
        if i in par:
            go(par[i]); Rw[i] = Rw[par[i]] @ local_rot[i]; Pw[i] = Pw[par[i]] + Rw[par[i]] @ local_pos[i]
        else: Rw[i] = local_rot[i]; Pw[i] = local_pos[i]
    for i in range(len(nodes)): go(i)
    return Rw, Pw
Rrest, Prest = fk(RL, TL)
G = lambda n: byname[n]

KEYS = {'hips': 'Hips', 'spine': 'Spine', 'spine1': 'Spine1', 'spine2': 'Spine2', 'neck': 'Neck', 'head': 'Head',
        'leftShoulder': 'LeftShoulder', 'leftArm': 'LeftArm', 'leftForeArm': 'LeftForeArm', 'leftHand': 'LeftHand',
        'rightShoulder': 'RightShoulder', 'rightArm': 'RightArm', 'rightForeArm': 'RightForeArm', 'rightHand': 'RightHand',
        'leftUpLeg': 'LeftUpLeg', 'leftLeg': 'LeftLeg', 'leftFoot': 'LeftFoot', 'rightUpLeg': 'RightUpLeg', 'rightLeg': 'RightLeg', 'rightFoot': 'RightFoot'}

def Rx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def Ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def Rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def rot_from_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = a @ b
    if c < -0.999999: return Rz(np.pi)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + K + K @ K / (1 + c)
def euler_xyz(R):   # misma descomposición que THREE.Euler 'XYZ'
    y = np.arcsin(np.clip(R[0, 2], -1, 1))
    if abs(R[0, 2]) < 0.9999999: return np.arctan2(-R[1, 2], R[2, 2]), y, np.arctan2(-R[0, 1], R[0, 0])
    return np.arctan2(R[2, 1], R[1, 1]), y, 0.0
def from_euler_xyz(x, y, z): return Rx(x) @ Ry(y) @ Rz(z)

def ik3(H, A, l1, l2, pole):
    """Rodilla K para cadera H y tobillo A (3D), con la rodilla hacia `pole`."""
    d = A - H; D = np.linalg.norm(d); D = min(D, (l1 + l2) * 0.999); dh = d / np.linalg.norm(d)
    a = (l1*l1 - l2*l2 + D*D) / (2*D); h = np.sqrt(max(l1*l1 - a*a, 1e-12))
    p = pole - (pole @ dh) * dh; p /= np.linalg.norm(p)
    return H + a * dh + h * p

LEG = {s: [G(s + 'UpLeg'), G(s + 'Leg'), G(s + 'Foot')] for s in ('Left', 'Right')}
t0 = {s: (Prest[LEG[s][1]] - Prest[LEG[s][0]], Prest[LEG[s][2]] - Prest[LEG[s][1]]) for s in LEG}
pole0 = {}
for s in LEG:
    H0, K0, A0 = (Prest[i] for i in LEG[s]); dh = (A0 - H0) / np.linalg.norm(A0 - H0); p = (K0 - H0) - ((K0 - H0) @ dh) * dh; pole0[s] = p / np.linalg.norm(p)
ANK0 = {s: Prest[LEG[s][2]].copy() for s in LEG}

HEEL = 0.015     # cuánto sube el tobillo al despegar (el talón se levanta y la punta se queda en el suelo)
def foot(p):
    """Tobillo relativo al reposo y cabeceo del pie para la fase p∈[0,1): contacto en p=0, despegue en p=STANCE."""
    sm = lambda t: t * t * (3 - 2 * t)
    if p < STANCE:
        u = p / STANCE; lift = HEEL * sm(max(0.0, (u - 0.7) / 0.3))
        return np.array([S * (1 - 2 * u), lift, 0]), np.radians(8) * (1 - min(1.0, u / 0.3)) - lift / 0.10   # punta arriba al apoyar; talón arriba al despegar
    u = (p - STANCE) / (1 - STANCE); e = 0.5 - 0.5 * np.cos(np.pi * u)          # suave: arranca y termina lento
    return np.array([-S + 2 * S * e, HEEL * (1 - u) ** 2 + LIFT * np.sin(np.pi * u) ** 1.2, 0]), -HEEL / 0.10 * (1 - u) ** 2 + np.radians(8) * u ** 3

def pose_at(ph):
    """→ (rotaciones absolutas de mundo por nodo, traslación de la cadera) del fotograma con fase ph∈[0,1)."""
    th = 2 * np.pi * ph
    bob = -0.007 * np.cos(4 * np.pi * (ph - 0.05)); sway = -0.008 * np.sin(2 * np.pi * (ph - 0.05)); surge = 0.003 * np.cos(4 * np.pi * ph)
    d_hips = np.array([surge, bob, sway])
    yaw = -0.07 * np.cos(th); roll = 0.03 * np.sin(2 * np.pi * (ph - 0.05)); nod = 0.025 * np.sin(4 * np.pi * (ph - 0.05))
    Rwd = {}
    Rwd[G('Hips')] = Ry(yaw) @ Rx(roll)
    Rwd[G('Spine')] = Ry(-0.25 * yaw) @ Rx(-0.4 * roll)
    Rwd[G('Spine1')] = Ry(-0.7 * yaw) @ Rx(-0.6 * roll) @ Rz(nod * 0.5)
    Rwd[G('Spine2')] = Ry(-0.9 * yaw) @ Rx(-0.6 * roll) @ Rz(nod)
    Rwd[G('Neck')] = Ry(-0.6 * yaw) @ Rx(-0.3 * roll) @ Rz(-nod * 0.4)
    Rwd[G('Head')] = Ry(-0.3 * yaw) @ Rz(-nod * 0.8)
    A = 0.22
    for s, sg in (('Left', -1), ('Right', 1)):
        sh = Rwd[G('Spine2')]
        Rwd[G(s + 'Shoulder')] = sh
        arm = sg * A * np.cos(th); fore = sg * 0.7 * A * np.cos(th - 0.6)
        Rwd[G(s + 'Arm')] = sh @ Rz(arm); Rwd[G(s + 'ForeArm')] = sh @ Rz(fore); Rwd[G(s + 'Hand')] = sh @ Rz(fore * 0.6)
    Rdes = {i: Rwd[i] @ Rrest[i] for i in Rwd}
    Hips = G('Hips'); Phips = Prest[Hips] + d_hips
    info = {}
    for s, off in (('Left', 0.0), ('Right', 0.5)):
        ids = LEG[s]; p = (ph + off) % 1.0
        dA, pitch = foot(p)
        Hj = Phips + Rdes[Hips] @ TL[ids[0]]                      # articulación de la cadera con la pelvis ya movida
        Atar = ANK0[s] + dA
        K = ik3(Hj, Atar, np.linalg.norm(t0[s][0]), np.linalg.norm(t0[s][1]), pole0[s])
        Rdes[ids[0]] = rot_from_to(t0[s][0], K - Hj) @ Rrest[ids[0]]
        Rdes[ids[1]] = rot_from_to(t0[s][1], Atar - K) @ Rrest[ids[1]]
        Rdes[ids[2]] = Rz(pitch) @ Rrest[ids[2]]
        info[s] = (Atar, p < STANCE)
    return Rdes, d_hips, info

def euler_pose(ph):
    Rdes, d_hips, info = pose_at(ph)
    out = {}
    for key, nm in KEYS.items():
        i = G(nm); Rpar = Rdes[par[i]] if par[i] in Rdes else Rrest[par[i]]
        Dm = RL[i].T @ Rpar.T @ Rdes[i]
        x, y, z = euler_xyz(Dm); out[key] = {'x': round(float(x), 4), 'y': round(float(y), 4), 'z': round(float(z), 4)}
    h = out['hips']; h['px'], h['py'], h['pz'] = (round(float(v), 4) for v in d_hips)
    out['jaw'] = {'x': 0, 'y': 0, 'z': round(float(-0.10 + 0.04 * np.sin(4 * np.pi * (ph - 0.15))), 4)}   # boca entreabierta que respira (−Z abre)
    return out

def editor_fk(pose):
    """Reproduce lo que hace anim-lab.html con la pose (reposo × Euler, traslación de la cadera) para comprobar el resultado."""
    lr, lp = dict(RL), {i: v.copy() for i, v in TL.items()}
    for key, nm in KEYS.items():
        e = pose[key]; lr[G(nm)] = RL[G(nm)] @ from_euler_xyz(e['x'], e['y'], e['z'])
    h = pose['hips']; lp[G('Hips')] = TL[G('Hips')] + np.array([h['px'], h['py'], h['pz']])
    return fk(lr, lp)

if __name__ == '__main__':
    n = round(T / FR); keys = []
    for f in range(n + 1):
        keys.append({'t': round(f * FR, 2), 'pose': euler_pose((f % n) / n)})
    clip = {'name': 'walk', 'duration': T, 'keys': keys}
    json.dump({'version': 2, 'rig': 'mixamo', 'note': 'Caminata realista del monstruo (pies plantados con IK, rebote y balanceo de cadera, contragiro de tórax, brazos en oposición). Generada por tools/gen-monster-walk.py; editable en anim-lab.html.', 'clips': {'walk': clip}}, open(OUT, 'w'), separators=(',', ':'))
    print('escrito', OUT, len(keys), 'keys')
