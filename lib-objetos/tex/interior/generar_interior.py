#!/usr/bin/env python3
"""Genera las texturas de interior (cocina, muebles, interiores) de esta carpeta.

Son imagenes de 512 px SIN COSTURAS (se repiten sin que se note el borde), hechas por codigo,
igual que las de lib-objetos/tex/. Para cambiar un color o una medida: edita la funcion y vuelve a correr

    python3 generar_interior.py            # escribe los .jpg junto a este archivo
    python3 generar_interior.py hoja_dir   # ademas guarda hojas de contacto (para revisar) en hoja_dir/

Necesita numpy y Pillow. La lista TEXTURAS (al final) trae id, medida en metros por repeticion,
grupo y nombre: es lo mismo que va en lib-objetos/catalogo.json.
"""
import os
import sys
import json
import numpy as np
from PIL import Image, ImageDraw

N = 512
Y, X = np.mgrid[0:N, 0:N].astype(np.float64)
AQUI = os.path.dirname(os.path.abspath(__file__))


# ------------------------------------------------------------------ utilidades
def C(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hcell(i, j, seed=0):
    s = np.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453
    return s - np.floor(s)


def pnoise(seed, fx=1.0, fy=1.0, beta=1.5):
    """Ruido periodico (se repite sin costura) de media 0 y desviacion 1.
    fx grande = suave en X (vetas largas en X); beta grande = mas suave."""
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((N, N)))
    ky = np.fft.fftfreq(N)[:, None] * N
    kx = np.fft.fftfreq(N)[None, :] * N
    k = np.sqrt((kx * fx) ** 2 + (ky * fy) ** 2)
    k[0, 0] = 1
    F = F / k ** beta
    F[0, 0] = 0
    a = np.real(np.fft.ifft2(F))
    return (a - a.mean()) / a.std()


def gblur(a, s):
    ky = np.fft.fftfreq(N)[:, None]
    kx = np.fft.fftfreq(N)[None, :]
    g = np.exp(-2 * (np.pi * s) ** 2 * (kx ** 2 + ky ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def worley(m, seed):
    """Celdas tipo piel (m x m celdas, periodico). Devuelve distancia al punto mas cercano, al segundo y un id por celda."""
    gx, gy = X * m / N, Y * m / N
    ix, iy = np.floor(gx).astype(int), np.floor(gy).astype(int)
    f1 = np.full((N, N), 9.0)
    f2 = np.full((N, N), 9.0)
    ident = np.zeros((N, N))
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            cx, cy = ix + di, iy + dj
            px = cx + hcell(cx % m, cy % m, seed)
            py = cy + hcell(cx % m, cy % m, seed + 17)
            d = np.sqrt((gx - px) ** 2 + (gy - py) ** 2)
            nuevo = d < f1
            f2 = np.where(nuevo, f1, np.minimum(f2, d))
            ident = np.where(nuevo, hcell(cx % m, cy % m, seed + 5), ident)
            f1 = np.where(nuevo, d, f1)
    return f1, f2, ident


def madera(seed, c1, c2, nb=4, F=5, amp=1.2, nudos=0, vena=0.45, hueco=1.5, tinte=0.07):
    """Tablas horizontales (nb tablas). c1 = tono claro, c2 = tono oscuro."""
    bh = N // nb
    fila = (Y // bh).astype(int)
    v = (Y % bh) / bh
    warp = pnoise(seed, 14, 1.2, 1.3)
    fino = pnoise(seed + 1, 40, 1.5, 0.9)
    off = hcell(fila, 0, seed)
    anillos = v * F + amp * 0.5 * warp + off * 5
    nucleo = np.zeros((N, N))
    if nudos:
        r = np.random.default_rng(seed + 9)
        for _ in range(nudos):
            cx = r.uniform(0, N)
            cy = r.integers(0, nb) * bh + bh * r.uniform(0.3, 0.7)
            dx = (X - cx + N / 2) % N - N / 2
            dy = (Y - cy + N / 2) % N - N / 2
            rr = np.sqrt(dx ** 2 + (dy * 2.4) ** 2)
            anillos = anillos + 3.2 * np.exp(-(rr / 26) ** 2)
            nucleo = np.maximum(nucleo, np.exp(-(rr / 7) ** 2))
    g = (0.5 + 0.5 * np.sin(2 * np.pi * anillos)) ** 1.6
    t = np.clip(0.35 + 0.55 * g + 0.10 * fino * vena / 0.45, 0, 1)
    col = mix(c1, c2, t)
    col = col * (1 + (off - 0.5) * tinte * 2)[..., None]
    borde = np.minimum(Y % bh, bh - 1 - (Y % bh))
    col = col * np.where(borde < hueco, 0.5, 1.0)[..., None]
    col = col * (1 - 0.75 * nucleo)[..., None]
    return np.clip(col, 0, 1)


def metal_cepillado(seed, color, base=0.62, fuerza=0.09):
    z = pnoise(seed, 30, 1.0, 0.5)
    amplio = pnoise(seed + 1, 2, 2, 1.5)
    b = base + fuerza * z + 0.035 * amplio
    return np.clip(color * (b / 0.62)[..., None], 0, 1)


def marmol(seed, c1, c2, veta, k1=(2, 1), k2=(1, -3), fuerza=0.9):
    w1 = pnoise(seed, 1, 1, 1.8)
    w2 = pnoise(seed + 3, 1, 1, 1.2)
    fondo = mix(c1, c2, np.clip(0.5 + 0.18 * pnoise(seed + 5, 1, 1, 1.6), 0, 1))
    fondo = fondo + 0.012 * pnoise(seed + 6, 1, 1, 0.3)[..., None]
    a1 = (k1[0] * X + k1[1] * Y) / N
    a2 = (k2[0] * X + k2[1] * Y) / N
    s1 = (1 - np.abs(np.sin(np.pi * (a1 + 0.35 * w1 + 0.08 * w2)))) ** 16
    s2 = (1 - np.abs(np.sin(np.pi * (a2 + 0.30 * w2 + 0.10 * w1)))) ** 22
    alfa = np.clip(s1 * fuerza + s2 * fuerza * 0.55, 0, 1) * np.clip(0.55 + 0.5 * pnoise(seed + 8, 1, 1, 1.3), 0.15, 1)
    return np.clip(mix(fondo, veta, alfa), 0, 1)


def tejido(seed, col, p=4, ct=0.35, nudo=0.25, raya=0.0):
    """Tela de tejido simple (hilos de p px)."""
    wu, wv = (X // p).astype(int), (Y // p).astype(int)
    sobre = (wu + wv) % 2
    sx = np.sin(np.pi * (X % p + 0.5) / p)
    sy = np.sin(np.pi * (Y % p + 0.5) / p)
    s = np.where(sobre == 0, sx, sy)
    hilo = np.where(sobre == 0, hcell(wu, 0, seed), hcell(0, wv, seed + 1))
    irreg = np.where(sobre == 0, pnoise(seed + 2, 1, 12, 0.8), pnoise(seed + 3, 12, 1, 0.8))
    b = 0.72 + ct * (s - 0.5) + (hilo - 0.5) * 0.15 + nudo * 0.08 * irreg
    if raya:
        b = b * (1 + raya * np.where((X // 32) % 2 == 0, 1.0, -1.0) * 0.5)
    return np.clip(col * b[..., None], 0, 1)


# ------------------------------------------------------------------ COCINA
def azulejo_blanco():
    W, H = 128, 64
    fila = (Y // H).astype(int)
    xo = (fila % 2) * (W // 2)
    xx, yy = (X + xo) % W, Y % H
    col = (((X + xo) // W).astype(int)) % (N // W)
    d = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy))
    tinte = hcell(col, fila, 3)
    img = C('#f1f1ee') * (1 + (tinte - 0.5) * 0.05)[..., None]
    claro = np.minimum(xx, yy) < np.minimum(W - 1 - xx, H - 1 - yy)
    borde = ss(7, 2, d)
    img = img * (1 + 0.07 * borde * np.where(claro, 1.0, -1.0))[..., None]
    img = img + (0.012 * pnoise(4, 2, 2, 1.5))[..., None]
    return np.clip(mix(img, C('#b9b6ae'), (d < 2).astype(float)), 0, 1)


def azulejo_damero():
    S = 64
    blanco = ((X // S + Y // S) % 2).astype(float)
    d = np.minimum(np.minimum(X % S, S - 1 - X % S), np.minimum(Y % S, S - 1 - Y % S))
    img = mix(C('#17171a'), C('#ecebe6'), blanco)
    img = img * (1 - 0.06 * ss(6, 1, d))[..., None]
    img = img + (0.02 * pnoise(5, 2, 2, 1.6))[..., None] + (0.008 * pnoise(6, 1, 1, 0.3))[..., None]
    return np.clip(mix(img, C('#6c6c6c'), (d < 1.2).astype(float)), 0, 1)


def azulejo_azul():
    P = 128
    u = ((X % P) / P) * 2 - 1
    v = ((Y % P) / P) * 2 - 1
    r = np.hypot(u, v)
    th = np.arctan2(v, u)
    azul, blanco = C('#1d4f9c'), C('#f4f3ee')
    petalo = 0.62 * np.abs(np.cos(2 * th)) ** 0.7
    m = ss(0.05, 0.015, np.abs(r - petalo)) * (r > 0.18)
    m = np.maximum(m, ss(0.19, 0.17, r))
    m = np.maximum(m, ss(0.04, 0.012, np.abs(r - 0.34)) * 0.9)
    rc = np.hypot(np.abs(u) - 1, np.abs(v) - 1)
    m = np.maximum(m, ss(0.07, 0.02, np.abs(rc - 0.42)))
    m = np.maximum(m, ss(0.17, 0.12, rc))
    img = mix(blanco, azul, m * 0.92)
    d = 1 - np.maximum(np.abs(u), np.abs(v))
    img = img + (0.012 * pnoise(8, 2, 2, 1.5))[..., None]
    img = img * (1 + 0.05 * ss(0.06, 0.0, d) * np.where(u + v < 0, 1.0, -1.0))[..., None]
    return np.clip(mix(img, C('#bcbab2'), (d < 0.02).astype(float)), 0, 1)


def azulejo_terracota():
    S = 128
    cx, cy = (X // S).astype(int), (Y // S).astype(int)
    h = hcell(cx, cy, 11)
    base = C('#b8602f') * (1 + (h - 0.5) * 0.22)[..., None]
    base = base * (1 + (hcell(cx, cy, 12) - 0.5) * 0.10)[..., None] * np.array([1.0, 0.98, 0.95])
    mota = 1 + 0.07 * pnoise(12, 2, 2, 1.4) + 0.025 * pnoise(13, 1, 1, 0.3)
    img = base * mota[..., None]
    d = np.minimum(np.minimum(X % S, S - 1 - X % S), np.minimum(Y % S, S - 1 - Y % S))
    img = img * (1 - 0.18 * ss(10, 2, d))[..., None]
    return np.clip(mix(img, C('#6b5f50'), (d < 3).astype(float)), 0, 1)


def hexagonal():
    cols, filas = 9, 10
    sx, sy = N / cols, N / filas
    ap = sx / 2
    k = np.sqrt(3) * ap / sy
    mejor = np.full((N, N), 1e9)
    ident = np.zeros((N, N))
    for rj in range(-1, filas + 1):
        off = (rj % 2) * sx / 2
        cy = (rj + 0.5) * sy
        for ci in range(-1, cols + 1):
            cxp = (ci + 0.5) * sx + off
            dx, dy = X - cxp, (Y - cy) * k
            hh = np.maximum(np.abs(dx), 0.5 * np.abs(dx) + 0.866 * np.abs(dy))
            mas = hh < mejor
            ident = np.where(mas, hcell(ci % cols, rj % filas, 21), ident)
            mejor = np.where(mas, hh, mejor)
    e = ap - mejor
    img = np.where(
        (ident < 0.45)[..., None], C('#e6e3da'),
        np.where((ident < 0.80)[..., None], C('#9fa1a4'), C('#383a40')))
    img = img * (1 + (hcell(np.floor(ident * 977), 3, 4) - 0.5) * 0.06)[..., None]
    img = img * (1 - 0.10 * ss(6, 1, e))[..., None] + (0.01 * pnoise(22, 2, 2, 1.4))[..., None]
    return np.clip(mix(img, C('#58554e'), (e < 1.6).astype(float)), 0, 1)


def baldosa_beige():
    S = 256
    cx, cy = (X // S).astype(int), (Y // S).astype(int)
    base = C('#cdbfa3') * (1 + (hcell(cx, cy, 31) - 0.5) * 0.06)[..., None]
    pimienta = np.random.default_rng(32).random((N, N))
    pim = gblur((pimienta > 0.97).astype(float), 0.6) * 2.2 - gblur((pimienta < 0.03).astype(float), 0.6) * 2.2
    img = base * (1 + 0.035 * pnoise(33, 1, 1, 1.5) + 0.08 * pim)[..., None]
    d = np.minimum(np.minimum(X % S, S - 1 - X % S), np.minimum(Y % S, S - 1 - Y % S))
    return np.clip(mix(img, C('#8d8576'), (d < 3).astype(float)), 0, 1)


def encimera_granito():
    r = np.random.default_rng(41)
    u1, u2, u3 = r.random((N, N)), r.random((N, N)), r.random((N, N))
    base = C('#3b3d42') * (1 + 0.10 * pnoise(42, 1, 1, 1.5))[..., None]
    nube = np.clip(gblur((u1 > 0.90).astype(float), 0.8) * 2.0, 0, 1)
    img = mix(base, C('#cfd0d0'), nube * 0.65)
    img = mix(img, C('#8a5b4d'), np.clip(gblur((u2 > 0.95).astype(float), 0.8) * 2.2, 0, 1) * 0.7)
    img = mix(img, C('#0a0a0c'), np.clip(gblur((u3 > 0.92).astype(float), 0.8) * 2.0, 0, 1) * 0.8)
    return np.clip(img, 0, 1)


def encimera_marmol():
    return marmol(51, C('#f2f1ee'), C('#e0dedb'), C('#6f7377'))


def acero():
    return metal_cepillado(61, np.array([0.64, 0.66, 0.69]))


# ------------------------------------------------------------------ MUEBLES
def roble():
    return madera(71, C('#d9aa6b'), C('#a8742f'), nb=4, F=5)


def nogal():
    return madera(72, C('#7a4e30'), C('#3a2214'), nb=4, F=6)


def pino():
    return madera(73, C('#ecd2a0'), C('#c9975a'), nb=4, F=4, nudos=5)


def cerezo():
    return madera(74, C('#b8663a'), C('#7f3418'), nb=4, F=5)


def laca_blanca():
    veta = madera(75, C('#f4f3ef'), C('#e0ddd6'), nb=4, F=6, amp=0.8, vena=0.2, hueco=1.2, tinte=0.02)
    return np.clip(veta + 0.006 * pnoise(76, 1, 1, 0.3)[..., None], 0, 1)


def tapiz_rojo():
    return tejido(81, C('#a31c24'), p=4, ct=0.35, nudo=0.3, raya=0.12)


def lino():
    return tejido(82, C('#cdbd9c'), p=4, ct=0.25, nudo=1.6)


def terciopelo_verde():
    z = pnoise(91, 3, 3, 1.1)
    f = pnoise(92, 1, 1, 0.3)
    pliegue = pnoise(93, 1, 1, 2.2)
    b = 0.66 + 0.05 * z + 0.09 * pliegue + 0.05 * f
    return np.clip(C('#1d5a3a') * b[..., None] * 1.15, 0, 1)


def cuero_negro():
    f1, f2, ident = worley(80, 7)
    cresta = ss(0, 0.30, f2 - f1)
    h = 0.78 + 0.22 * cresta
    brillo = ss(0.80, 1.0, h) * 0.07
    img = C('#2c2c31') * (0.55 + 0.6 * h * (0.92 + 0.12 * ident))[..., None] + brillo[..., None]
    img = img * (1 + 0.10 * pnoise(8, 2, 2, 1.5))[..., None]
    return np.clip(img, 0, 1)


def capitone():
    P = 128
    fa = ((X + Y) / P) % 1
    fb = ((X - Y) / P) % 1
    h = np.sin(np.pi * fa) * np.sin(np.pi * fb)
    luz = 0.5 * (fa - fb)
    f1, f2, ident = worley(48, 14)
    grano = ss(0, 0.2, f2 - f1)
    b = 0.34 + 0.62 * h ** 0.6 + 0.22 * luz * np.sin(np.pi * np.minimum(fa, 1 - fa)) + 0.06 * (grano - 0.5)
    da, db = np.minimum(fa, 1 - fa), np.minimum(fb, 1 - fb)
    rr = np.hypot(da, db) * P / np.sqrt(2)
    boton = ss(6.5, 4.5, rr)
    aro = ss(9, 6.5, rr) * (1 - boton)
    img = C('#7b1a2b') * np.clip(b, 0, 1.3)[..., None]
    img = img * (1 - 0.5 * aro)[..., None]
    img = mix(img, C('#b9976a') * 0.9, boton)
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------ INTERIORES
def _roseton(u, v, R, k, a):
    r = np.hypot(u, v)
    th = np.arctan2(v, u)
    borde = R + a * np.cos(k * th)
    m = ss(0.012, -0.012, r - borde) * ss(-0.012, 0.012, r - 0.07)
    return m, r


def papel_damasco():
    P = 128
    u = ((X % P) / P) - 0.5
    v = ((Y % P) / P) - 0.5
    u2 = (((X + P / 2) % P) / P) - 0.5
    v2 = (((Y + P / 2) % P) / P) - 0.5
    m1, r1 = _roseton(u, v, 0.30, 6, 0.09)
    m2, r2 = _roseton(u2, v2, 0.13, 8, 0.035)
    lin = ss(0.014, 0.004, np.abs(r1 - 0.20))
    m = np.clip(np.maximum(m1, m2) - lin * m1 * 0.6, 0, 1)
    sarga = 0.5 + 0.5 * np.sin((X + Y) * np.pi / 2)
    fondo = C('#5e1a26') * (0.93 + 0.07 * sarga)[..., None]
    motivo = C('#923548') * (0.93 + 0.07 * sarga)[..., None]
    img = mix(fondo, motivo, m)
    return np.clip(img * (1 + 0.02 * pnoise(101, 1, 1, 0.4))[..., None], 0, 1)


def papel_rayas():
    S = 32
    a = ((X // S) % 2).astype(float)
    img = mix(C('#e7dfc8'), C('#aebf9d'), a)
    d = np.minimum(X % S, S - 1 - X % S)
    img = mix(img, C('#b89a52'), ss(1.6, 0.4, np.abs((X % S) - 1.5)) * 0.9)
    img = img * (1 - 0.05 * ss(4, 0, d))[..., None]
    return np.clip(img * (1 + 0.025 * pnoise(111, 1, 1, 0.4) + 0.02 * pnoise(112, 2, 2, 1.4))[..., None], 0, 1)


def papel_floral():
    P = 64
    cx, cy = (X // P).astype(int), (Y // P).astype(int)
    c = cx % (N // P)
    d = cy % (N // P)
    px = hcell(c, d, 121) * 0.3 - 0.15
    py = hcell(c, d, 122) * 0.3 - 0.15
    u = ((X % P) / P) - 0.5 - px
    v = ((Y % P) / P) - 0.5 - py
    r = np.hypot(u, v)
    th = np.arctan2(v, u)
    petalo = 0.27 * (0.55 + 0.45 * np.abs(np.cos(2.5 * th)))
    m = ss(0.012, -0.012, r - petalo)
    centro = ss(0.085, 0.06, r)
    tono = hcell(c, d, 123)
    cor = np.where((tono < 0.5)[..., None], C('#c9808c'), C('#7f9bbd'))
    img = np.broadcast_to(C('#efe8d6'), (N, N, 3)).copy()
    img = mix(img, cor, m * 0.95)
    img = mix(img, C('#e0b84c'), centro)
    v2 = (((Y + P / 2) % P) / P) - 0.5
    u2 = (((X + P / 2) % P) / P) - 0.5
    ramita = ss(0.07, 0.03, np.hypot(u2, v2 * 1.6)) * 0.55
    img = mix(img, C('#8fa070'), ramita)
    return np.clip(img * (1 + 0.025 * pnoise(124, 1, 1, 0.4))[..., None], 0, 1)


def pintura_crema():
    img = C('#e6dcc2') * (1 + 0.025 * pnoise(131, 1, 1, 1.6) + 0.012 * pnoise(132, 1, 1, 0.3))[..., None]
    return np.clip(img, 0, 1)


def parquet():
    hoja = madera(141, C('#cf9b5e'), C('#90592c'), nb=16, F=2, amp=1.0, hueco=1.5)
    sal = np.zeros((N, N, 3))
    r = np.random.default_rng(5)
    B = 128
    for bi in range(4):
        for bj in range(4):
            for p in range(4):
                fila = r.integers(0, 16)
                xo = r.integers(0, N - B + 1)
                tabla = hoja[fila * 32:(fila + 1) * 32, xo:xo + B].copy()
                tabla[:, :2] *= 0.5
                tabla[:, -2:] *= 0.5
                tabla *= 1 + r.uniform(-0.06, 0.06)
                if (bi + bj) % 2 == 0:
                    sal[bj * B + p * 32:bj * B + (p + 1) * 32, bi * B:(bi + 1) * B] = tabla
                else:
                    sal[bj * B:(bj + 1) * B, bi * B + p * 32:bi * B + (p + 1) * 32] = tabla.transpose(1, 0, 2)
    return np.clip(sal, 0, 1)


def alfombra_persa():
    P = 128
    u = ((X % P) / P) - 0.5
    v = ((Y % P) / P) - 0.5
    d = (np.abs(u) + np.abs(v)) * 2
    rojo, crema, azul, oro = C('#8a1f24'), C('#d9c9a0'), C('#1d2d4f'), C('#c49a3c')
    banda = (np.floor(np.minimum(d, 1.0) * 7).astype(int)) % 4
    pal = np.stack([rojo, crema, azul, rojo])
    dentro = pal[banda]
    dentro = np.where((d < 0.16)[..., None], oro, dentro)
    esq = (np.abs(np.abs(u) - 0.5) + np.abs(np.abs(v) - 0.5)) < 0.12
    fuera = np.where(esq[..., None], crema, rojo)
    img = np.where((d < 1.0)[..., None], dentro, fuera)
    fr = (np.minimum(d, 1.0) * 7) % 1
    img = img * (0.88 + 0.12 * ss(0, 0.12, fr))[..., None]
    lana = 1 + 0.06 * pnoise(151, 1, 1, 0.5) + 0.03 * np.sin(X * np.pi) * np.sin(Y * np.pi)
    return np.clip(img * lana[..., None], 0, 1)


def marmol_negro():
    return marmol(161, C('#141416'), C('#222225'), C('#c8a24e'), k1=(1, 2), k2=(3, 1), fuerza=0.95)


def laton():
    return metal_cepillado(171, np.array([0.80, 0.62, 0.28]), base=0.64, fuerza=0.10)


def corcho():
    base = C('#b5845a')
    z = gblur(np.random.default_rng(181).standard_normal((N, N)), 1.1)
    z = (z - z.mean()) / z.std()
    b = 0.78 + 0.16 * z + 0.04 * pnoise(182, 1, 1, 1.4)
    img = base * b[..., None]
    huecos = ss(1.6, 2.4, z)
    return np.clip(mix(img, C('#4a3220'), huecos * 0.6), 0, 1)


def lambri():
    P = 256
    hoja = madera(191, C('#6b4426'), C('#3a2112'), nb=8, F=3, amp=1.0, hueco=0.0, tinte=0.04)
    hoja2 = madera(192, C('#7a4e2c'), C('#44281a'), nb=4, F=3, amp=1.0, hueco=0.0, tinte=0.04)
    x, y = X % P, Y % P
    dx, dy = np.minimum(x, P - 1 - x), np.minimum(y, P - 1 - y)
    de = np.minimum(dx, dy)
    izq = dx < dy
    arriba_izq = np.where(izq, x < P / 2, y < P / 2)
    madera_marco = hoja
    madera_panel = np.roll(hoja2, (37, 91), axis=(0, 1))
    img = madera_marco.copy()
    zona_panel = de >= 28
    img = np.where(zona_panel[..., None], madera_panel * 1.08, img)
    ranura = (de >= 20) & (de < 28)
    img = np.where(ranura[..., None], img * (0.21 + 0.39 * ss(20, 28, de))[..., None], img)
    bisel = (de >= 28) & (de < 46)
    cara = 1 + np.where(arriba_izq, 0.22, -0.28) * ss(46, 28, de)
    img = np.where(bisel[..., None], img * cara[..., None], img)
    marco_borde = (de < 20)
    img = np.where(marco_borde[..., None], img * (0.92 + 0.10 * ss(0, 6, de))[..., None], img)
    return np.clip(img, 0, 1)


# ------------------------------------------------------------------ lista y salida
# (id, funcion, metros por repeticion, grupo, nombre, uso)
TEXTURAS = [
    ('cocina_azulejo_blanco', azulejo_blanco, 0.8, 'cocina', 'Azulejo blanco (metro)', 'Paredes de cocina, baños'),
    ('cocina_azulejo_damero', azulejo_damero, 1.6, 'cocina', 'Damero blanco y negro', 'Piso de cocina, tabernas'),
    ('cocina_azulejo_azul', azulejo_azul, 1.0, 'cocina', 'Azulejo azul estampado', 'Paredes de cocina, fogones'),
    ('cocina_azulejo_terracota', azulejo_terracota, 1.2, 'cocina', 'Baldosa de terracota', 'Piso de cocina rústica'),
    ('cocina_hexagonal', hexagonal, 1.3, 'cocina', 'Mosaico hexagonal', 'Piso de cocina o baño'),
    ('cocina_baldosa_beige', baldosa_beige, 1.5, 'cocina', 'Baldosa beige grande', 'Piso de cocina, pasillos'),
    ('cocina_encimera_granito', encimera_granito, 1.0, 'cocina', 'Encimera de granito', 'Mesadas y barras'),
    ('cocina_encimera_marmol', encimera_marmol, 2.0, 'cocina', 'Encimera de mármol blanco', 'Mesadas, mesas de amasar'),
    ('cocina_acero', acero, 0.8, 'cocina', 'Acero inoxidable', 'Campanas, mesones, fregaderos'),
    ('mueble_roble', roble, 1.0, 'mueble', 'Madera de roble', 'Mesas, sillas, armarios'),
    ('mueble_nogal', nogal, 1.0, 'mueble', 'Madera de nogal', 'Escritorios, camas, aparadores'),
    ('mueble_pino', pino, 1.0, 'mueble', 'Pino con nudos', 'Muebles rústicos, estantes'),
    ('mueble_cerezo', cerezo, 1.0, 'mueble', 'Madera de cerezo', 'Cómodas, vitrinas'),
    ('mueble_laca_blanca', laca_blanca, 1.0, 'mueble', 'Madera lacada blanca', 'Alacenas, puertas de gabinete'),
    ('mueble_tapiz_rojo', tapiz_rojo, 0.5, 'mueble', 'Tapiz rojo a rayas', 'Sillones, cojines, cortinas'),
    ('mueble_lino', lino, 0.5, 'mueble', 'Lino natural', 'Sofás, manteles, cortinas'),
    ('mueble_terciopelo_verde', terciopelo_verde, 0.6, 'mueble', 'Terciopelo verde', 'Sillones, cortinas pesadas'),
    ('mueble_cuero_negro', cuero_negro, 0.5, 'mueble', 'Cuero negro granulado', 'Sillas, asientos, correas'),
    ('mueble_capitone', capitone, 0.9, 'mueble', 'Cuero capitoné burdeos', 'Sillones, cabeceros'),
    ('interior_papel_damasco', papel_damasco, 1.0, 'interior', 'Papel damasco burdeos', 'Paredes de salón, alcobas'),
    ('interior_papel_rayas', papel_rayas, 1.0, 'interior', 'Papel de rayas', 'Paredes de dormitorio'),
    ('interior_papel_floral', papel_floral, 1.0, 'interior', 'Papel floral', 'Paredes de casa, cuarto de niños'),
    ('interior_pintura_crema', pintura_crema, 2.0, 'interior', 'Pintura crema', 'Paredes y techos lisos'),
    ('interior_parquet', parquet, 2.0, 'interior', 'Parquet de tablas', 'Pisos de salón y estudio'),
    ('interior_alfombra_persa', alfombra_persa, 2.4, 'interior', 'Alfombra persa', 'Alfombras, tapices de suelo'),
    ('interior_marmol_negro', marmol_negro, 2.5, 'interior', 'Mármol negro con vetas doradas', 'Pisos de lujo, columnas'),
    ('interior_laton', laton, 0.8, 'interior', 'Latón cepillado', 'Herrajes, lámparas, molduras'),
    ('interior_corcho', corcho, 0.6, 'interior', 'Corcho', 'Tableros, pisos, avisos'),
    ('interior_lambri', lambri, 2.0, 'interior', 'Lambrín de madera', 'Zócalos y paredes de despacho'),
]


def guardar(id_, img):
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(
        os.path.join(AQUI, id_ + '.jpg'), quality=88, optimize=True)


def hojas(dir_):
    """Hoja de contacto (miniaturas con nombre) y hoja de costura (cada imagen repetida 2 x 2)."""
    os.makedirs(dir_, exist_ok=True)
    por = 6
    th = 256
    filas = (len(TEXTURAS) + por - 1) // por
    hoja = Image.new('RGB', (por * th, filas * (th + 18)), (30, 30, 34))
    dr = ImageDraw.Draw(hoja)
    for i, (id_, *_rest) in enumerate(TEXTURAS):
        im = Image.open(os.path.join(AQUI, id_ + '.jpg')).resize((th, th), Image.LANCZOS)
        x, y = (i % por) * th, (i // por) * (th + 18)
        hoja.paste(im, (x, y))
        dr.text((x + 3, y + th + 3), id_, fill=(230, 230, 230))
    hoja.save(os.path.join(dir_, 'contacto.png'))
    for i, (id_, *_rest) in enumerate(TEXTURAS):
        im = Image.open(os.path.join(AQUI, id_ + '.jpg'))
        m = Image.new('RGB', (N * 2, N * 2))
        for a in range(2):
            for b in range(2):
                m.paste(im, (a * N, b * N))
        m.resize((512, 512), Image.LANCZOS).save(os.path.join(dir_, 'mosaico_' + id_ + '.png'))


if __name__ == '__main__':
    for id_, fn, *_ in TEXTURAS:
        guardar(id_, fn())
        print('ok', id_)
    if len(sys.argv) > 1:
        hojas(sys.argv[1])
    if '--catalogo' in sys.argv:
        print(json.dumps([{'id': i, 'archivo': 'interior/' + i + '.jpg', 'tipo': 'repetida', 'tile': t, 'grupo': g, 'nombre': n, 'uso': u}
                          for i, _f, t, g, n, u in TEXTURAS], ensure_ascii=False, indent=1))
