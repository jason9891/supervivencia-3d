/* rocas/rocas.js — colección de rocas y formaciones de piedra (todo por código, con semilla).
 *
 *   import { registrarRocas } from './rocas/rocas.js';   // (registrarTodo() ya la llama)
 *
 * La misma semilla da siempre la misma roca; cambia `semilla` para tener otra parecida.
 * Origen de cada objeto: centro de su huella, en el suelo (la base queda ligeramente enterrada).
 *
 *  roca_redonda    canto rodado, liso            roca_larga       alargada (tronco de piedra)
 *  roca_ancha      baja y ancha, como una laja   roca_deformada   abultada, retorcida, irregular
 *  roca_angular    de aristas, como de cantera   laja            plancha delgada, se puede inclinar
 *  menhir          piedra alta y afilada         columnas_basalto columnas hexagonales de distinta altura
 *  estalagmita     punta de roca (cueva)         trilito          dos menhires y un dintel
 *  pila_lajas      lajas apiladas                cantos           muchas piedras pequeñas esparcidas
 *  penasco         roca grande con otras al pie  roca_hendida     roca partida con grieta
 *  GIGANTES (muros / divisores de ambientes, hasta 80 m):
 *  muro_roca       muro de roca con paso opcional   muro_estratos  muro de lajas apiladas   farallon  peñasco inmenso
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, stoneTex, CATALOGO, HUELLA, ETIQUETAS } from '../objetos.js';
import { pNuevo, MATERIALES_EXTRA } from '../objetos_pro.js';
import '../objetos_lote3.js';   // define el material 'roca' (con facetas)

const P2 = Math.PI * 2;
MATERIALES_EXTRA.roca_suave = () => new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 1, vertexColors: true });

/* ---------- ruido y utilidades ---------- */
function ruido3(x, y, z, ph) {
  return Math.sin(x * 2.1 + ph[0]) * Math.sin(y * 2.3 + ph[1]) * Math.sin(z * 2.0 + ph[2])
    + .5 * Math.sin(x * 4.7 + ph[3]) * Math.sin(y * 4.1 + ph[4]) * Math.sin(z * 5.3 + ph[5])
    + .25 * Math.sin(x * 9.3 + ph[6]) * Math.sin(y * 8.7 + ph[7]) * Math.sin(z * 9.9 + ph[8]);
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fases = (sem) => { const R = rng(Math.round(sem * 977) + 11); return { R, ph: Array.from({ length: 9 }, () => R() * 60) }; };

/* Masa de roca: elipsoide (w × h × d) deformado.
   deform 0..1 abultamiento · facetas 0..1 (cuantiza el relieve → aristas) · afinar 0..1 (más fina arriba)
   torsion (rad por m) · curva (m de desvío) · suave (true = sombreado liso) · bajo: parte enterrada (fracción del alto) */
function masa({ w, d, h, deform = .3, facetas = 0, afinar = 0, torsion = 0, curva = 0, suave = false, bajo = .35, detalle = 3, sem = 1 }) {
  let g = new THREE.IcosahedronGeometry(1, detalle);
  if (suave) { g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); }
  const { ph } = fases(sem), a = g.attributes.position.array, pasos = 1 + Math.round(facetas * 3), amp = .1 + .28 * deform;
  for (let i = 0; i < a.length; i += 3) {
    const l = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1, dx = a[i] / l, dy = a[i + 1] / l, dz = a[i + 2] / l;
    const n = ruido3(dx * 1.3, dy * 1.3, dz * 1.3, ph), q = Math.round(n * pasos) / pasos, k = 1 + amp * (n * (1 - facetas * .7) + q * facetas * .7);
    let x = dx * k * w / 2, y = dy * k * h / 2, z = dz * k * d / 2;
    y = Math.max(y, -h / 2 * (1 - bajo * 2));                      // base casi plana
    y += h / 2 * (1 - bajo * 2) - h * .02;                          // apoyada en el suelo
    const t = Math.max(0, Math.min(1, y / h));
    if (afinar) { const f = 1 - afinar * t * .85; x *= f; z *= f; }
    if (curva) x += curva * t * t;
    if (torsion) { const an = torsion * y, c = Math.cos(an), s = Math.sin(an), x2 = x * c - z * s; z = x * s + z * c; x = x2; }
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
  }
  g.computeVertexNormals();
  return g;
}
function musgoSobre(g, musgo, sem) {
  if (!musgo) return;
  const N = g.attributes.normal, C = g.attributes.color, P = g.attributes.position; if (!C) return;
  for (let i = 0; i < N.count; i++) {
    const ny = N.getY(i), m = musgo * sstep(.4, .85, ny) * (.6 + .4 * Math.sin(P.getX(i) * 6 + P.getZ(i) * 4 + sem)), sombra = ny < -.3 ? .7 : 1;
    C.setXYZ(i, (C.getX(i) * (1 - m) + .38 * m) * sombra, (C.getY(i) * (1 - m) + .52 * m) * sombra, (C.getZ(i) * (1 - m) + .22 * m) * sombra);
  }
}
const pone = (s, g, R, o = {}, mat = 'roca') => s.add(mat, g, Object.assign({ tile: 1.4, tint: .82 + .3 * R() }, o));

/* ---------- constructores ---------- */
function redonda(p) {
  const { w, d, h, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w, d, h, deform: .15, suave: true, bajo: .3, sem: semilla }); pone(s, g, R, {}, 'roca_suave'); musgoSobre(g, musgo, semilla); return s.fin();
}
function larga(p) {
  const { w: largo, d: ancho, h, deform, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w: largo, d: ancho, h, deform, curva: (R() - .5) * largo * .15, bajo: .3, sem: semilla }); pone(s, g, R); musgoSobre(g, musgo, semilla); return s.fin();
}
function ancha(p) {
  const { w, d, h, deform, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w, d, h, deform, bajo: .25, sem: semilla }); pone(s, g, R); musgoSobre(g, musgo, semilla); return s.fin();
}
function deformada(p) {
  const { w, d, h, deform, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w, d, h, deform, afinar: R() * .5, torsion: (R() - .5) * 1.6, curva: (R() - .5) * w * .4, bajo: .3, sem: semilla }); pone(s, g, R); musgoSobre(g, musgo, semilla); return s.fin();
}
function angular(p) {
  const { w, d, h, facetas, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w, d, h, deform: .55, facetas, detalle: 2, bajo: .3, sem: semilla }); pone(s, g, R, { desg: .5 }); musgoSobre(g, musgo, semilla); return s.fin();
}
function geoLaja(w, d, h, inclin, sem) {
  const g = new THREE.BoxGeometry(1, 1, 1, 8, 2, 8), a = g.attributes.position.array, { ph, R } = fases(sem), ang = inclin * Math.PI / 180;
  for (let i = 0; i < a.length; i += 3) {
    let x = a[i], y = a[i + 1], z = a[i + 2];
    const n = ruido3(x * 2, y * 2, z * 2, ph), borde = Math.max(Math.abs(x), Math.abs(z)) * 2;
    const r = Math.hypot(x, z) * 2, red = 1 - .22 * sstep(.75, 1.4, r);            // esquinas redondeadas
    x *= red * w * (1 + .06 * n); z *= red * d * (1 + .06 * n); y = y * h * (1 - .25 * sstep(.6, 1, borde)) + .04 * n * h;
    const c = Math.cos(ang), s = Math.sin(ang), x2 = x * c - y * s; y = x * s + y * c; x = x2;
    a[i] = x; a[i + 1] = y + h * .5 + Math.abs(Math.sin(ang)) * w * .5; a[i + 2] = z;
  }
  g.computeVertexNormals(); return g;
}
function laja(p) {
  const { w, d, h, inclin, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = geoLaja(w, d, h, inclin, semilla); pone(s, g, R, { eje: 1 }); musgoSobre(g, musgo, semilla); return s.fin();
}
function menhir(p) {
  const { w, d, h, inclin, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w, d, h, deform: .35, facetas: .6, afinar: .55, torsion: (R() - .5) * .5, curva: Math.tan(inclin * Math.PI / 180) * h * .5, detalle: 3, bajo: .15, sem: semilla });
  pone(s, g, R, { desg: .4 }); musgoSobre(g, musgo, semilla); return s.fin();
}
function basalto(p) {
  const { n, r, h, semilla } = p, s = pNuevo(), { R } = fases(semilla), N = Math.max(1, Math.round(n));
  const celdas = [[0, 0]]; for (let anillo = 1; celdas.length < N; anillo++) for (let k = 0; k < 6 * anillo && celdas.length < N; k++) { const a = (k / (6 * anillo)) * P2; celdas.push([Math.cos(a) * anillo * r * 1.72, Math.sin(a) * anillo * r * 1.72]); }
  celdas.slice(0, N).forEach(([x, z], i) => {
    const alto = h * (.45 + .55 * R()) * (1 - .06 * Math.hypot(x, z) / r), g = new THREE.CylinderGeometry(r * .97, r, alto, 6, 1);
    const a = g.attributes.position.array; for (let j = 0; j < a.length; j += 3) if (a[j + 1] > 0) a[j + 1] += (R() - .5) * r * .35;      // tapa inclinada
    g.rotateY(R() * 1); g.translate(x, alto / 2 - .05, z); g.computeVertexNormals(); pone(s, g, R, { eje: 1, tile: 1.2, desg: .8 });
  });
  return s.fin();
}
function estalagmita(p) {
  const { r, h, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w: r * 2, d: r * 2, h, deform: .5, facetas: .3, afinar: .95, curva: (R() - .5) * h * .15, bajo: .1, sem: semilla }); pone(s, g, R, { desg: .3 }); musgoSobre(g, musgo, semilla); return s.fin();
}
function trilito(p) {
  const { w, h, semilla } = p, s = pNuevo(), { R } = fases(semilla), sep = w * .5;
  [-1, 1].forEach((k, i) => { const g = masa({ w: w * .28, d: w * .22, h, deform: .3, facetas: .5, afinar: .15, bajo: .12, sem: semilla + i * 7 }); g.translate(k * sep, 0, 0); pone(s, g, R); });
  const g = geoLaja(w * 1.05, w * .3, h * .16, (R() - .5) * 6, semilla + 3); g.translate(0, h * .985, 0); pone(s, g, R, { eje: 1 });
  return s.fin();
}
function pilaLajas(p) {
  const { w, n, semilla } = p, s = pNuevo(), { R } = fases(semilla); let y = 0;
  for (let i = 0; i < Math.round(n); i++) {
    const k = 1 - i * .12, ww = w * k * (.85 + .3 * R()), dd = w * k * (.6 + .3 * R()), hh = .09 + .1 * R();
    const g = geoLaja(ww, dd, hh, (R() - .5) * 5, semilla + i); g.rotateY(R() * Math.PI); g.translate((R() - .5) * w * .12, y, (R() - .5) * w * .12); pone(s, g, R, { eje: 1 }); y += hh * .95;
  }
  return s.fin();
}
function cantos(p) {
  const { n, r, area, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  for (let i = 0; i < Math.round(n); i++) {
    const rr = r * (.4 + .9 * R()), an = R() * P2, dist = Math.sqrt(R()) * area, ang = Math.abs(R()) > .5;
    const g = masa({ w: rr * 2, d: rr * (1.2 + R()), h: rr * (.8 + .5 * R()), deform: .35, facetas: ang ? .6 : 0, detalle: 1, bajo: .35, sem: semilla + i * 1.7 });
    g.rotateY(R() * Math.PI); g.translate(Math.cos(an) * dist, 0, Math.sin(an) * dist); pone(s, g, R); musgoSobre(g, musgo, i);
  }
  return s.fin();
}
function penasco(p) {
  const { r, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masa({ w: r * 2, d: r * 1.7, h: r * 1.5, deform: .6, facetas: .35, afinar: .25, torsion: (R() - .5) * .8, bajo: .3, sem: semilla }); pone(s, g, R, { desg: .3 }); musgoSobre(g, musgo, semilla);
  for (let i = 0; i < 4; i++) {
    const rr = r * (.25 + .3 * R()), an = R() * P2, h2 = masa({ w: rr * 2, d: rr * 1.6, h: rr * 1.3, deform: .5, facetas: .4, detalle: 2, bajo: .3, sem: semilla + i * 5 });
    h2.rotateY(R() * 3); h2.translate(Math.cos(an) * r * (.95 + .4 * R()), 0, Math.sin(an) * r * (.85 + .4 * R())); pone(s, h2, R); musgoSobre(h2, musgo, i + semilla);
  }
  return s.fin();
}
function hendida(p) {
  const { w, h, grieta, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  [-1, 1].forEach((k, i) => {
    const g = masa({ w: w * .55, d: w * .8, h: h * (i ? .95 : 1), deform: .45, facetas: .6, detalle: 2, bajo: .3, sem: semilla + i * 4 });
    g.rotateZ(k * -.03 * (R() + .5)); g.translate(k * (w * .27 + grieta / 2), 0, 0); pone(s, g, R, { desg: .5 }); musgoSobre(g, musgo, semilla + i);
  });
  return s.fin();
}

/* ---------- GIGANTES: muros y peñascos de roca de 10–80 m ----------
   El relieve se mide en METROS (no en fracción del tamaño), así una roca de 30 m no sale lisa.
   Para usarlas de límite o divisor de ambientes: son sólidas en el recorrido a pie (como cualquier objeto) y
   se pueden juntar o solapar unas con otras sin que se note la unión. */
const rl = (x, y, z, ph, L) => ruido3(x / L, y / L, z / L, ph);
const ond = (x, ph, L) => .5 * Math.sin(x / L + ph[0]) + .3 * Math.sin(x / (L * .43) + ph[1]) + .2 * Math.sin(x / (L * .19) + ph[2]);

/* Muro de roca: caja subdividida y deformada. Largo en X, grosor en Z, alto en Y (base enterrada).
   cresta 0..1 (cuánto varía la altura a lo largo) · borde 0..1 (cuánto bajan y se afinan los extremos)
   curva (m, abombado en planta) · inclin (° hacia un lado) · res (m por segmento) · cx / W (posición y largo total si es un tramo) */
function geoMuro({ w, d, h, deform = .5, facetas = .3, cresta = .3, borde = .5, curva = 0, inclin = 0, res = .9, sink, cx = 0, W, sem = 1 }) {
  W = W || w;
  const sx = Math.min(72, Math.max(6, Math.round(w / res))), sy = Math.min(26, Math.max(4, Math.round(h / res))), sz = Math.min(10, Math.max(2, Math.round(d / res)));
  let g = new THREE.BoxGeometry(1, 1, 1, sx, sy, sz);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4);          // soldar bordes: no se abren al deformar
  const a = g.attributes.position.array, { ph } = fases(sem), ph2 = ph.map(v => v * 1.7 + 3), pasos = 1 + Math.round(facetas * 3);
  const hund = sink != null ? sink : Math.min(1.2, .06 * h + .2), tg = Math.tan(inclin * Math.PI / 180);
  const amp = (.15 + .85 * deform) * Math.min(1.2, .06 * Math.min(w, h) + .25);
  for (let i = 0; i < a.length; i += 3) {
    const ux = a[i], uy = a[i + 1], uz = a[i + 2], tx = ux + .5, ty = uy + .5, XA = ux * w + cx;
    const fin = Math.min(tx, 1 - tx) * w, tap = sstep(0, 2.5 + .07 * w, fin), fe = 1 - borde * (1 - tap);
    const alto = Math.max(.2 * h, h * (1 + cresta * (.55 * ond(XA, ph, 5 + .1 * W) + .45 * ond(XA, ph2, 2.3))) * fe);
    const ancho = (1 + .22 * deform * ond(XA, ph2, 6)) * (1 - .45 * borde * (1 - tap)) * (1 + .2 * (1 - ty)) * (1 - .12 * ty);   // más ancho al pie
    let Y = ty * alto, Z = uz * d * ancho;
    const tw = (XA / W) + .5; Z += curva * (1 - (2 * tw - 1) * (2 * tw - 1)) + tg * Y;
    const wx = Math.abs(ux) > .499 ? Math.sign(ux) : 0, wy = uy > .499 ? 1 : 0, wz = Math.abs(uz) > .499 ? Math.sign(uz) : 0;
    const n = .6 * rl(XA, Y, Z, ph, 3.4) + .4 * rl(XA, Y, Z, ph2, 1.4), q = Math.round(n * pasos) / pasos, nn = Math.max(-1.2, Math.min(1.2, n * (1 - facetas * .6) + q * facetas * .6));
    a[i] = XA + wx * amp * nn; a[i + 1] = Y + wy * amp * nn - hund; a[i + 2] = Z + wz * amp * nn * 1.4;
  }
  g.computeVertexNormals();
  return g;
}

/* Masa grande (peñasco): como masa() pero con relieve en metros y 5 120 caras (detalle 15 = 16 divisiones por arista). */
function masaGig({ w, d, h, deform = .5, facetas = .4, afinar = .15, bajo = .22, sem = 1 }) {
  const H = h / (1 - bajo);                                   // para que el alto final sea h (la base plana se come una parte)
  const g = new THREE.IcosahedronGeometry(1, 15), a = g.attributes.position.array, { ph } = fases(sem), ph2 = ph.map(v => v * 1.7 + 3), pasos = 1 + Math.round(facetas * 3);
  for (let i = 0; i < a.length; i += 3) {
    const l = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1, dx = a[i] / l, dy = a[i + 1] / l, dz = a[i + 2] / l, px = dx * w / 2, py = dy * H / 2, pz = dz * d / 2;
    const n = .62 * ruido3(dx * 1.3, dy * 1.3, dz * 1.3, ph) + .38 * (.6 * rl(px, py, pz, ph2, 5) + .4 * rl(px, py, pz, ph, 2.2)), q = Math.round(n * pasos) / pasos;
    const k = 1 + (.12 + .3 * deform) * (n * (1 - facetas * .6) + q * facetas * .6);
    let x = dx * k * w / 2, y = dy * k * H / 2, z = dz * k * d / 2;
    y = Math.max(y, -H / 2 * (1 - bajo * 2)); y += H / 2 * (1 - bajo * 2) - H * .02;
    const t = Math.max(0, Math.min(1, y / h)); if (afinar) { const f = 1 - afinar * t * .85; x *= f; z *= f; }
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
  }
  g.computeVertexNormals();
  return g;
}

function muroRoca(p) {
  const { w, d, h, paso, pos_paso, deform, facetas, cresta, curva, inclin, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const gap = Math.min(Math.max(0, paso), w - 4), tramos = [];
  if (gap > .5) { const util = w - gap, izq = Math.max(2, util * (1 + pos_paso) / 2), der = Math.max(2, util - izq); tramos.push([-w / 2, -w / 2 + izq], [w / 2 - der, w / 2]); }
  else tramos.push([-w / 2, w / 2]);
  tramos.forEach(([x0, x1], i) => {
    const g = geoMuro({ w: x1 - x0, d, h, deform, facetas, cresta, borde: .5, curva, inclin, cx: (x0 + x1) / 2, W: w, sem: semilla + i * 5 });
    pone(s, g, R, { tile: 4, desg: .5 }); musgoSobre(g, musgo, semilla + i);
  });
  return s.fin();
}
function muroEstratos(p) {
  const { w, d, h, capas, desfase, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla), N = Math.max(2, Math.round(capas));
  const hs = Array.from({ length: N }, () => .7 + .6 * R()), tot = hs.reduce((u, v) => u + v, 0); let y = 0;
  for (let i = 0; i < N; i++) {
    const hh = h * hs[i] / tot, g = geoMuro({ w: w * (.9 + .1 * R()), d: d * (.8 + .45 * R()), h: hh * 1.15, deform: .95, facetas: .5, cresta: .12, borde: .35, res: 1.2, sink: i ? .04 : undefined, sem: semilla + i * 3 });
    g.translate((R() - .5) * desfase * Math.min(w * .15, 3), y, (R() - .5) * desfase * .6);
    pone(s, g, R, { tile: 3, tint: .78 + .38 * R(), desg: .5 }); musgoSobre(g, musgo, semilla + i); y += hh * .88;
  }
  return s.fin();
}
function farallon(p) {
  const { w, d, h, deform, facetas, afinar, escombro, musgo, semilla } = p, s = pNuevo(), { R } = fases(semilla);
  const g = masaGig({ w, d, h, deform, facetas, afinar, sem: semilla }); pone(s, g, R, { tile: 4, desg: .4 }); musgoSobre(g, musgo, semilla);
  for (let i = 0; i < Math.round(escombro * 6); i++) {
    const rr = Math.min(w, d) * (.05 + .07 * R()), an = R() * P2, m = masa({ w: rr * 2, d: rr * (1.3 + R() * .5), h: rr * (1 + .5 * R()), deform: .5, facetas: .5, detalle: 2, bajo: .3, sem: semilla + i * 5 });
    m.rotateY(R() * 3); m.translate(Math.cos(an) * w * (.5 + .12 * R()), 0, Math.sin(an) * d * (.5 + .12 * R())); pone(s, m, R, { tile: 2 }); musgoSobre(m, musgo, i + semilla);
  }
  return s.fin();
}

/* ---------- catálogo ---------- */
const G = 'rocas', C = (n, f, params, extra) => Object.assign({ nombre: n, f, params, grupo: G }, extra || {});
const sem = [1, 80, 1, 1], mus = [0, 1, .3, .05];
export const DEFS_ROCAS = {
  roca_redonda: C('Roca redonda (canto rodado)', redonda, { w: [.3, 3, 1.1, .05], d: [.3, 3, .9, .05], h: [.2, 2.5, .7, .05], musgo: mus, semilla: sem }),
  roca_larga: C('Roca larga', larga, { w: [.8, 6, 2.6, .1], d: [.25, 1.5, .6, .05], h: [.2, 1.5, .5, .05], deform: [0, 1, .35, .05], musgo: mus, semilla: sem }),
  roca_ancha: C('Roca ancha y baja', ancha, { w: [.8, 6, 2.4, .1], d: [.6, 5, 1.8, .1], h: [.15, 1.2, .45, .05], deform: [0, 1, .4, .05], musgo: mus, semilla: sem }),
  roca_deformada: C('Roca deformada', deformada, { w: [.5, 4, 1.4, .05], d: [.4, 4, 1.1, .05], h: [.4, 3, 1.1, .05], deform: [0, 1, .8, .05], musgo: mus, semilla: sem }),
  roca_angular: C('Roca angular (aristas)', angular, { w: [.4, 4, 1.3, .05], d: [.4, 4, 1, .05], h: [.3, 3, .9, .05], facetas: [0, 1, .7, .05], musgo: mus, semilla: sem }),
  laja: C('Laja (plancha de piedra)', laja, { w: [.4, 4, 1.6, .05], d: [.3, 3, 1.1, .05], h: [.05, .6, .15, .01], inclin: [-45, 45, 0, 1], musgo: [0, 1, .15, .05], semilla: sem }),
  menhir: C('Menhir (piedra alta)', menhir, { w: [.3, 2, .8, .05], d: [.2, 1.5, .5, .05], h: [1, 7, 2.8, .1], inclin: [-15, 15, 4, 1], musgo: mus, semilla: sem }),
  columnas_basalto: C('Columnas de basalto', basalto, { n: [1, 19, 7, 1], r: [.15, .8, .35, .01], h: [.6, 6, 2.2, .1], semilla: sem }),
  estalagmita: C('Estalagmita / punta de roca', estalagmita, { r: [.15, 1.5, .5, .05], h: [.5, 5, 1.8, .1], musgo: [0, 1, 0, .05], semilla: sem }),
  trilito: C('Trilito (dolmen)', trilito, { w: [1.5, 6, 3, .1], h: [1.2, 4, 2.2, .1], semilla: sem }),
  pila_lajas: C('Pila de lajas', pilaLajas, { w: [.5, 3, 1.4, .05], n: [2, 9, 5, 1], semilla: sem }),
  cantos: C('Cantos (piedras pequeñas)', cantos, { n: [3, 60, 18, 1], r: [.04, .3, .12, .01], area: [.3, 6, 1.5, .1], musgo: [0, 1, .1, .05], semilla: sem }),
  penasco: C('Peñasco con piedras al pie', penasco, { r: [.6, 4, 1.6, .05], musgo: [0, 1, .4, .05], semilla: sem }),
  roca_hendida: C('Roca hendida', hendida, { w: [.8, 4, 1.8, .05], h: [.6, 3.5, 1.5, .05], grieta: [.03, .5, .12, .01], musgo: mus, semilla: sem }),
  // Gigantes (muros y divisores de ambientes): w hasta 80 m, h hasta 40 m
  muro_roca: C('Gigante · Muro de roca', muroRoca, { w: [4, 80, 24, .5], d: [1, 16, 4, .25], h: [2, 40, 7, .5], paso: [0, 12, 0, .25], pos_paso: [-1, 1, 0, .05], deform: [0, 1, .5, .05], facetas: [0, 1, .35, .05], cresta: [0, 1, .3, .05], curva: [-20, 20, 0, .5], inclin: [-20, 20, 0, 1], musgo: mus, semilla: sem }),
  muro_estratos: C('Gigante · Muro de lajas apiladas', muroEstratos, { w: [4, 60, 20, .5], d: [1, 12, 3.5, .25], h: [2, 30, 6, .5], capas: [2, 14, 6, 1], desfase: [0, 2, .6, .05], musgo: [0, 1, .15, .05], semilla: sem }),
  farallon: C('Gigante · Peñasco inmenso', farallon, { w: [4, 60, 18, .5], d: [4, 60, 14, .5], h: [3, 40, 12, .5], deform: [0, 1, .5, .05], facetas: [0, 1, .5, .05], afinar: [0, 1, .15, .05], escombro: [0, 1, .5, .05], musgo: [0, 1, .25, .05], semilla: sem }),
};
export const TIPOS_ROCAS = Object.keys(DEFS_ROCAS);
const HUELLAS = {
  roca_redonda: p => [p.w, p.d], roca_larga: p => [p.w, p.d], roca_ancha: p => [p.w, p.d], roca_deformada: p => [p.w * 1.1, p.d * 1.1], roca_angular: p => [p.w, p.d],
  laja: p => [p.w, p.d], menhir: p => [p.w, p.d], columnas_basalto: p => { const k = Math.ceil(Math.sqrt(p.n)) * p.r * 1.8; return [k, k]; }, estalagmita: p => [p.r * 2, p.r * 2],
  trilito: p => [p.w * 1.05, p.w * .35], pila_lajas: p => [p.w, p.w * .8], cantos: p => [p.area * 2, p.area * 2], penasco: p => [p.r * 3.4, p.r * 3], roca_hendida: p => [p.w + p.grieta, p.w * .8],
  muro_roca: p => [p.w, p.d + Math.abs(p.curva) * 2], muro_estratos: p => [p.w * 1.05, p.d * 1.3], farallon: p => [p.w * 1.2, p.d * 1.2],
};
export function registrarRocas() {
  for (const k in DEFS_ROCAS) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS_ROCAS[k]);
  Object.assign(HUELLA, HUELLAS);
  Object.assign(ETIQUETAS, { paso: 'Paso (m, 0 = muro seguido)', pos_paso: 'Posición del paso (−1 … 1)', cresta: 'Cresta irregular', curva: 'Curvatura (m)', capas: 'Capas', desfase: 'Desfase de capas', escombro: 'Piedras caídas al pie', deform: 'Deformación', facetas: 'Aristas (facetas)', inclin: 'Inclinación (°)', grieta: 'Grieta (m)', area: 'Radio del área', musgo: 'Musgo', n: 'Cantidad', semilla: 'Semilla' });
}
