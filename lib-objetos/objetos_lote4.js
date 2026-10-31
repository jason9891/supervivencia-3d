/* objetos_lote4.js — estructuras: muros de bloques, torre redonda, columnas y puentes (completos o rotos).
 *
 *   import { registrarPro } from './objetos_pro.js';
 *   import { registrarLote4 } from './objetos_lote4.js';
 *   registrarPro(); registrarLote4();
 *
 * Todo se arma con BLOQUES de piedra (o tablas) colocados siguiendo una trayectoria y un perfil, no con cajas
 * rectangulares. Eso permite muros curvos, torres redondas, arcos, brechas y ruinas, y que un puente roto se vea roto
 * de verdad. Cada objeto sale en pocas mallas (una por material) y con textura propia.
 *
 *   muro_pro       largo l, alto h, grosor, estilo (0 liso, 1 almenas, 2 puerta con arco, 3 aspilleras),
 *                  talud (base más ancha), curva (-1..1), roto (borde superior en ruinas), brecha (hueco)
 *   torre          radio R, alto h, grosor, almenas, puerta, roto, brecha
 *   columna        alto h, radio r, fuste (0 cuadrada, 1 lisa, 2 estriada), ruina (0 entera .. 1 caída)
 *   puente_piedra  largo l, ancho w, cota (altura del tablero), arcos, baranda, roto
 *   puente_madera  largo l, ancho w, cota, colgante (0 sobre caballetes, 1 de cuerdas), baranda, roto
 *
 * Origen: muro y puente, centro de su largo, que va a lo largo de x; la curva se abomba hacia +z.
 * Torre y columna: centro de la base. La puerta de la torre mira a +z. La misma semilla da el mismo resultado.
 */
import * as THREE from 'three';
import { rng, stoneTex, CATALOGO, HUELLA, ETIQUETAS } from './objetos.js';
import { pNuevo, RB, LA, MATERIALES_EXTRA } from './objetos_pro.js';

const P4 = Math.PI;
/* material de piedra (el lote 3 define el mismo; así este lote funciona solo) */
if (!MATERIALES_EXTRA.piedra) MATERIALES_EXTRA.piedra = () => new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .95, vertexColors: true });
const hx = (a, b, c) => { const k = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return k - Math.floor(k); };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* bloque de piedra tallado a mano: caja con los vértices movidos un poco (iguales en las esquinas compartidas) */
function cajaBloque(len, h, e, jit, seed) {
  const g = new THREE.BoxGeometry(len, h, e), a = g.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2];
    a[i] += (hx(x * 5 + seed, y * 5, z * 5) - .5) * jit; a[i + 1] += (hx(x * 5, y * 5 + seed, z * 5 + 1.7) - .5) * jit * .7; a[i + 2] += (hx(x * 5 + 2.3, y * 5, z * 5 + seed) - .5) * jit;
  }
  g.computeVertexNormals();
  return g;
}

/* Reparte hileras de bloques sobre un perfil. solido(u, yCentro, yAlto) decide si hay piedra en esa celda.
   u = distancia a lo largo de la trayectoria (0..L). Devuelve la lista de bloques. */
function bloques(o) {
  const R = o.R, out = [], rows = Math.max(1, Math.round(o.H / o.rowH)), rh = o.H / rows, step = .1, n = Math.max(1, Math.ceil(o.L / step));
  for (let j = 0; j < rows; j++) {
    const y0 = j * rh, yc = y0 + rh / 2, yt = y0 + rh * .85; let ini = -1;
    const cerrar = i => {
      if (ini < 0) return; const a = ini * step, b = Math.min(o.L, i * step); ini = -1;
      if (b - a < .15) return;
      let pos = a, primero = true;
      while (pos < b - .05) {
        let len = o.minLen + R() * (o.maxLen - o.minLen); if (primero && j % 2) len *= .55; primero = false;
        if (b - pos - len < o.minLen * .6) len = b - pos;
        out.push({ s: pos + len / 2, y: y0, len, h: rh * (.93 + .07 * R()), yc, tint: .8 + R() * .3 }); pos += len;
      }
    };
    for (let i = 0; i < n; i++) { const sm = Math.min(o.L, (i + .5) * step); if (o.solido(sm, yc, yt)) { if (ini < 0) ini = i; } else cerrar(i); }
    cerrar(n);
  }
  return out;
}
function ponerBloques(s, lista, o) {
  lista.forEach(b => {
    if (o.quitar && o.quitar(b.s, b.y + b.h / 2)) return;
    const t = o.tr(b.s), e = o.esp(b.yc);
    s.add('piedra', cajaBloque(b.len * 1.03, b.h, e, o.jit === undefined ? .05 : o.jit, b.s * 7 + b.y * 3), { pos: [t.x, o.y0 + b.y + b.h / 2, t.z], rot: [0, t.yaw, 0], eje: 1, tile: 1.2, tint: b.tint });
  });
}
/* trayectorias */
function trRecta(L, curva, off = 0) {
  const k = curva * L * .25;
  return u => { const t = 2 * u / L - 1, zp = -curva * t, len = Math.hypot(1, zp); return { x: u - L / 2 - off * zp / len, z: k * (1 - t * t) + off / len, yaw: -Math.atan(zp) }; };
}
function trCirculo(Rm) { return u => { const f = u / Rm; return { x: Rm * Math.cos(f), z: Rm * Math.sin(f), yaw: -(f + P4 / 2) }; }; }
/* arco: ¿(u,y) está dentro de la abertura elíptica ampliada en ex? */
function enArco(u, y, uc, spr, rx, ry, ex) {
  if (y < spr) return Math.abs(u - uc) < rx + ex;
  const q = (y - spr) / (ry + ex); if (q >= 1) return false;
  return Math.abs(u - uc) < (rx + ex) * Math.sqrt(1 - q * q);
}
/* dovelas (bloques en cuña) alrededor del arco y jambas verticales */
function dovelas(s, o) {
  const { uc, spr, rx, ry, vt, tr, esp, y0, rh, quitar } = o, N = Math.max(5, Math.ceil(P4 * (rx + ry + vt) / 2 / .4)), per = P4 * (rx + ry + vt) / 2 / N;
  for (let k = 0; k < N; k++) {
    const al = P4 * (k + .5) / N, px = uc - (rx + vt / 2) * Math.cos(al), py = spr + (ry + vt / 2) * Math.sin(al), ang = Math.atan2(ry * Math.cos(al), rx * Math.sin(al));
    if (quitar && quitar(px, y0 + py)) continue;
    const t = tr(px);
    s.add('piedra', cajaBloque(per * 1.12, vt, esp(py) * 1.04, .03, k * 3.1 + uc), { pos: [t.x, y0 + py, t.z], rot: [0, t.yaw, ang], order: 'YZX', eje: 1, tile: 1.2, tint: .85 + .25 * hx(k, uc, 1) });
  }
  for (let y = 0; y < spr; y += rh) [-1, 1].forEach(sg => {
    const px = uc + sg * (rx + .2), t = tr(px), h = Math.min(rh, spr - y + .05);
    if (quitar && quitar(px, y0 + y + h / 2)) return;
    s.add('piedra', cajaBloque(.42, h, esp(y) * 1.04, .03, y * 5 + sg), { pos: [t.x, y0 + y + h / 2, t.z], rot: [0, t.yaw, 0], eje: 1, tile: 1.2, tint: .85 + .25 * hx(y, sg, 2) });
  });
}
/* perfil superior de un muro en ruinas, con brecha opcional */
function perfilFn(H, L, roto, brecha, sem) {
  const ph = [hx(sem, 1, 1) * 6, hx(sem, 2, 2) * 6], bc = L * (.3 + .4 * hx(sem, 1, 2)), bw = brecha * L * .25 + .3;
  return u => {
    let top = H;
    if (roto > 0) { const n = .5 + .5 * (.6 * Math.sin(u * .9 + ph[0]) + .4 * Math.sin(u * 2.3 + ph[1])); top = H * (1 - roto * (.1 + .7 * n)); }
    if (brecha > 0) { const d = Math.abs(u - bc) / bw * (1 + .15 * Math.sin(u * 6)); if (d < 1) top = Math.min(top, H * (.06 + .7 * d * d)); }
    return top;
  };
}

/* ================= muro / torre ================= */
function armarMuro(c) {
  const { s, R, L, H, talud, tr, semilla } = c, esp = yc => c.esp * (1 + talud * .6 * (1 - yc / H)), perfil = perfilFn(H, L, c.roto, c.brecha, semilla);
  const uc = c.uc === undefined ? L / 2 : c.uc, aw = Math.min(L * .35, 2.8), ah = Math.min(H * .7, 3.3), rx = aw / 2, ry = Math.min(rx, ah * .45), spr = ah - ry, vt = .45, ex = .6 * vt;
  const puerta = c.puerta && L > 1.8 && H > 1.4;
  const slits = []; if (c.aspill) for (let u = 1.2; u < L - .8; u += 2.4) slits.push(u);
  const abierto = (u, y) => (puerta && enArco(u, y, uc, spr, rx, ry, ex)) || (slits.length && y > H * .3 && y < H * .62 && slits.some(q => Math.abs(u - q) < .11));
  const lista = bloques({ L, H, rowH: .42, minLen: .7, maxLen: 1.25, R, solido: (u, yc, yt) => yt <= perfil(u) + .02 && !abierto(u, yc) });
  ponerBloques(s, lista, { tr, esp, y0: 0 });
  if (puerta) dovelas(s, { uc, spr, rx, ry, vt, tr, esp, y0: 0, rh: .42, quitar: (u, y) => y > perfil(u) + .3 });
  if (c.almenas) for (let u = .4; u + .4 < L; u += 1.3) {
    if (perfil(u - .4) < H - .02 || perfil(u + .4) < H - .02 || abierto(u, H - .1)) continue;
    const t = tr(u); s.add('piedra', cajaBloque(.7, .85, esp(H) * .92, .04, u * 3), { pos: [t.x, H + .425, t.z], rot: [0, t.yaw, 0], eje: 1, tile: 1.2, tint: .85 + .25 * hx(u, 3, 4) });
  }
  if (c.brecha > 0 || c.roto > 0) {   /* escombros caídos al pie */
    const bc = L * (.3 + .4 * hx(semilla, 1, 2)), n = Math.round(c.brecha * 14 + c.roto * 8);
    for (let i = 0; i < n; i++) {
      const u = Math.max(.2, Math.min(L - .2, bc + (R() - .5) * (c.brecha * L * .5 + 2))), t = tr(u), side = R() < .5 ? -1 : 1, d = (c.esp / 2 + .3 + R() * 1.1) * side, sz = .25 + R() * .4;
      s.add('piedra', cajaBloque(sz * (1 + R() * .6), sz * .7, sz, .06, i * 5 + 1), { pos: [t.x - Math.sin(t.yaw) * d, sz * .3, t.z - Math.cos(t.yaw) * d], rot: [R() * .5, R() * 6.28, R() * .5], eje: 1, tile: 1.2, tint: .75 + R() * .3 });
    }
  }
}
function muroPro(p) {
  const { l, h, esp, estilo, talud, curva, roto, brecha, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 73 + l * 3 + h)), e = Math.round(estilo);
  armarMuro({ s, R, L: l, H: h, esp, talud, roto, brecha, semilla, tr: trRecta(l, curva), almenas: e === 1, puerta: e === 2, aspill: e === 3 });
  return s.fin();
}
function torrePro(p) {
  const { R: radio, h, esp, almenas, puerta, roto, brecha, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 79 + radio * 5 + h)), Rm = radio - esp / 2, L = 2 * P4 * Rm;
  armarMuro({ s, R, L, H: h, esp, talud: .15, roto, brecha, semilla, tr: trCirculo(Rm), almenas: almenas >= .5, puerta: puerta >= .5, uc: Rm * P4 / 2 });
  return s.fin();
}

/* ================= columna ================= */
function fusteGeo(r, h, flautas, ruina, sem) {
  const g = new THREE.CylinderGeometry(r * .9, r, h, flautas ? 40 : 28, 6, false), a = g.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2], th = Math.atan2(z, x), t = (y + h / 2) / h;
    let f = 1 + .05 * Math.sin(P4 * t); if (flautas) f *= 1 - .045 * (.5 + .5 * Math.cos(12 * th));
    a[i] = x * f; a[i + 2] = z * f;
    if (ruina > 0 && t > .55) a[i + 1] = y - ruina * .22 * h * ss(.55, 1, t) * (.5 + .5 * (.6 * Math.sin(th * 2 + sem) + .4 * Math.sin(th * 5 + sem * 1.7)));
  }
  g.computeVertexNormals();
  return g;
}
function columnaPro(p) {
  const { h, r, fuste, ruina, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 83 + h * 11 + r * 100)), a = s.add, ru = ruina;
  const hb = .3 * r, tb = .4 * r, hc = .8 * r, sh = Math.max(.3 * r, h - hb - tb - hc), sinCap = ru > .35, y0 = hb + tb, shEf = sinCap ? sh * (1 - .35 * ru) + hc * .5 : sh, f = Math.round(fuste);
  a('piedra', RB(2.5 * r, hb, 2.5 * r, .03 * r, 1), { pos: [0, hb / 2, 0], eje: 1, tile: 1.2 });
  a('piedra', LA([[0, hb], [1.3 * r, hb], [1.28 * r, hb + .12 * r], [1.1 * r, hb + .22 * r], [1.12 * r, hb + .3 * r], [r, hb + tb], [0, hb + tb]], 24), { uvEsc: [3 * r / 1.2, 1], tile: 1.2 });
  if (f === 0) a('piedra', RB(1.7 * r, shEf, 1.7 * r, .03 * r, 1), { pos: [0, y0 + shEf / 2, 0], eje: 1, tile: 1.2 });
  else a('piedra', fusteGeo(r, shEf, f >= 2, sinCap ? ru : ru * .8, semilla), { pos: [0, y0 + shEf / 2, 0], eje: 1, tile: 1.2 });
  if (!sinCap) {
    const y1 = y0 + sh;
    a('piedra', LA([[0, y1], [.95 * r, y1], [1.05 * r, y1 + .1 * r], [1.3 * r, y1 + .35 * r], [1.45 * r, y1 + .5 * r], [0, y1 + .5 * r]], 24), { uvEsc: [3 * r / 1.2, 1], tile: 1.2 });
    a('piedra', RB(3 * r, .3 * r, 3 * r, .03 * r, 1), { pos: [0, y1 + .5 * r + .15 * r, 0], eje: 1, tile: 1.2 });
  }
  if (ru > .15) {
    const nT = ru > .5 ? 3 : 2;
    for (let i = 0; i < nT; i++) {
      const an = R() * 6.28, d = r * (1.8 + R() * 1.4), l = r * (.8 + R() * 1.2);
      a('piedra', new THREE.CylinderGeometry(r * .93, r * .96, l, 16), { pos: [Math.cos(an) * d, r * .9, Math.sin(an) * d], rot: [P4 / 2 + (R() - .5) * .3, R() * 6.28, (R() - .5) * .3], order: 'YXZ', eje: 1, tile: 1.2, tint: .8 + R() * .3 });
    }
    for (let i = 0; i < 5; i++) { const an = R() * 6.28, d = r * (1.4 + R() * 2), sz = r * (.2 + R() * .35); a('piedra', cajaBloque(sz * 1.3, sz * .8, sz, .05, i * 7), { pos: [Math.cos(an) * d, sz * .35, Math.sin(an) * d], rot: [R(), R() * 6, R()], eje: 1, tile: 1.2, tint: .75 + R() * .3 }); }
  }
  return s.fin();
}

/* ================= puente de piedra ================= */
function puentePiedraPro(p) {
  const { l: L, w: W, cota: H, arcos, baranda, roto, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 61 + L * 7 + W)), n = Math.max(1, Math.round(arcos));
  const ends = 1.1, span = (L - 2 * ends) / n, pt = Math.max(.5, span * .2), rx = (span - pt) / 2, deckT = .32, crown = Math.max(.9, H - deckT - .35), ry = Math.min(rx, Math.max(.45, crown * .8)), spr = Math.max(.1, crown - ry), vt = .4;
  const arcosL = []; for (let i = 0; i < n; i++) arcosL.push(ends + span * (i + .5));
  const gc = L * (.3 + .4 * hx(semilla, 3, 5)), gh = roto > 0 ? roto * L * .2 + .5 : 0, bd = 1.6;
  const quitar = (u, y) => {
    if (roto <= 0) return false; const d = Math.abs(u - gc);
    if (d < gh * (.8 + .4 * hx(u * 3, y * 3, 1))) return true;
    return d < gh + bd && hx(u * 4, y * 4, 2) < (1 - (d - gh) / bd) * .7 && y > crown * .5;
  };
  const tr = off => trRecta(L, 0, off), esp = () => W * .92;
  const cuerpo = bloques({ L, H: H - deckT, rowH: .4, minLen: .8, maxLen: 1.3, R, solido: (u, yc) => !arcosL.some(uc => enArco(u, yc, uc, spr, rx, ry, .27)) });
  ponerBloques(s, cuerpo, { tr: tr(0), esp, y0: 0, quitar });
  arcosL.forEach(uc => dovelas(s, { uc, spr, rx, ry, vt, tr: tr(0), esp, y0: 0, rh: .4, quitar }));
  [-1, 0, 1].forEach(k => ponerBloques(s, bloques({ L, H: deckT, rowH: deckT, minLen: .8, maxLen: 1.4, R, solido: () => true }), { tr: tr(k * W / 3), esp: () => W / 3 * 1.02, y0: H - deckT, quitar: (u, y) => quitar(u, H) }));
  if (baranda >= .5) [-1, 1].forEach(sg => {
    const off = sg * (W / 2 - .16);
    ponerBloques(s, bloques({ L, H: .8, rowH: .4, minLen: .7, maxLen: 1.2, R, solido: () => true }), { tr: tr(off), esp: () => .32, y0: H, quitar: (u, y) => quitar(u, H + y * 2) });
    ponerBloques(s, bloques({ L, H: .14, rowH: .14, minLen: .9, maxLen: 1.4, R, solido: () => true }), { tr: tr(off), esp: () => .44, y0: H + .8, quitar: (u, y) => quitar(u, H + 1) });
  });
  if (roto > 0) for (let i = 0, m = Math.round(8 + roto * 24); i < m; i++) {
    const u = gc + (R() - .5) * 2 * (gh + 1.6), sz = .3 + R() * .45, t = tr(0)(Math.max(.3, Math.min(L - .3, u)));
    s.add('piedra', cajaBloque(sz * (1 + R() * .7), sz * .7, sz, .06, i * 3), { pos: [t.x, sz * .3, (R() - .5) * W * 1.3], rot: [R() * .5, R() * 6.28, R() * .5], eje: 1, tile: 1.2, tint: .75 + R() * .3 });
  }
  return s.fin();
}

/* ================= puente de madera ================= */
function puenteMaderaPro(p) {
  const { l: L, w: W, cota: H, colgante, baranda, roto, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 67 + L * 5 + W)), a = s.add, col = colgante >= .5;
  const gc = L * (.3 + .4 * hx(semilla, 7, 1)), gh = roto > 0 ? roto * L * .3 + .3 : 0, nPl = Math.max(3, Math.round(L / .22)), pw = L / nPl;
  const enBrecha = (u, i) => roto > 0 && (Math.abs(u - gc) < gh * (.85 + .3 * hx(i, 3, 1)) || hx(i, 9, 2) < roto * .1);
  const sag = Math.min(L * .1, 2.5), yAt = x => col ? H - sag * (1 - Math.pow(2 * x / L, 2)) : H, slope = x => col ? 4 * sag * (2 * x / L) / L : 0;
  for (let i = 0; i < nPl; i++) {
    const u = (i + .5) * pw, x = u - L / 2;
    if (enBrecha(u, i)) continue;
    const cerca = roto > 0 && Math.abs(u - gc) < gh + .5 && hx(i, 5, 5) < .6, wd = cerca ? W * (.35 + .45 * hx(i, 6, 6)) : W, zc = cerca ? (hx(i, 7, 7) - .5) * (W - wd) : 0;
    a('mad', RB(pw * .9, .06, wd, .006, 1), { pos: [x, yAt(x), zc], rot: [0, (R() - .5) * .04, Math.atan(slope(x))], eje: 2, tint: .8 + R() * .35 });
  }
  const piezas = roto > 0 ? [[0, Math.max(.2, gc - gh)], [Math.min(L - .2, gc + gh), L]] : [[0, L]];
  if (!col) {
    piezas.forEach(([u0, u1]) => { if (u1 - u0 < .3) return; [-1, 0, 1].forEach(k => a('mad', RB(u1 - u0, .18, .14, .01, 1), { pos: [(u0 + u1) / 2 - L / 2, H - .15, k * (W / 2 - .15)], eje: 0 })); });
    const nT = Math.max(2, Math.ceil(L / 3));
    if (H > .35) for (let i = 0; i <= nT; i++) {
      const x = -L / 2 + i * L / nT, u = x + L / 2, roto1 = roto > 0 && Math.abs(u - gc) < gh + .3, cae = roto > 0 && Math.abs(u - gc) < gh + 1.2 && hx(i, 2, 8) < .6;
      if (roto1) continue;
      [-1, 1].forEach(sg => a('mad', RB(.2, H - .25, .2, .012, 1), { pos: [x + (cae ? .1 : 0), (H - .25) / 2, sg * (W / 2 - .12)], rot: [0, 0, cae ? .22 * (u < gc ? 1 : -1) : 0], eje: 1 }));
      a('mad', RB(.16, .2, W, .01, 1), { pos: [x, H - .3, 0], eje: 2 });
      if (H > 1) [-1, 1].forEach(sg => a('mad', RB(.1, Math.hypot(H * .6, W * .1) , .1, .01, 1), { pos: [x, H * .45, sg * (W / 2 - .12)], rot: [0, 0, (hx(i, 1, 1) < .5 ? 1 : -1) * .5], eje: 1 }));
    }
  } else {
    [-1, 1].forEach(sg => { const x0 = sg * (L / 2 + .25); [-1, 1].forEach(z => a('mad', RB(.28, H + 1.4, .28, .02, 1), { pos: [x0, (H + 1.4) / 2 - .2, z * (W / 2 + .05)], eje: 1 })); a('mad', RB(.2, .2, W + .5, .01, 1), { pos: [x0, H + 1, 0], eje: 2 }); });
  }
  /* cuerdas o barandas */
  const tramo = (xa, ya, xb, yb, z, r, key, rgb) => { const len = Math.hypot(xb - xa, yb - ya); a(key, new THREE.CylinderGeometry(r, r, len, 5), { pos: [(xa + xb) / 2, (ya + yb) / 2, z], rot: [0, 0, Math.atan2(yb - ya, xb - xa) - P4 / 2], eje: 1, rgb }); };
  const cuerda = [.55, .42, .28];
  if (col) {
  [-1, 1].forEach(sg => {
    const z = sg * (W / 2 + .05), pasos = Math.max(2, Math.round(L / .5));
    for (let k = 0; k < pasos; k++) {
      const xa = -L / 2 + k * L / pasos, xb = -L / 2 + (k + 1) * L / pasos, um = (k + .5) * L / pasos;
      if (roto > 0 && Math.abs(um - gc) < gh && (sg > 0 || hx(k, 4, 4) < .7)) continue;
      tramo(xa, yAt(xa), xb, yAt(xb), z, .03, 'tela', cuerda); if (baranda >= .5) tramo(xa, yAt(xa) + .95, xb, yAt(xb) + .95, z, .022, 'tela', cuerda);
    }
    if (baranda >= .5) for (let k = 0; k <= Math.round(L / 1.1); k++) { const x = -L / 2 + k * L / Math.round(L / 1.1), um = x + L / 2; if (roto > 0 && Math.abs(um - gc) < gh) continue; a('tela', new THREE.CylinderGeometry(.014, .014, .95, 4), { pos: [x, yAt(x) + .475, z], eje: 1, rgb: cuerda }); }
    if (roto > 0) [gc - gh, gc + gh].forEach((um, q) => { const x = um - L / 2; a('tela', new THREE.CylinderGeometry(.03, .03, 2.2 + R(), 5), { pos: [x, yAt(x) - 1.1, z], rot: [0, 0, (q ? .15 : -.15)], eje: 1, rgb: cuerda }); });
  });
  } else if (baranda >= .5) {
    const nP = Math.max(2, Math.round(L / 1.5));
    [-1, 1].forEach(sg => {
      const z = sg * (W / 2 - .05);
      for (let k = 0; k <= nP; k++) { const x = -L / 2 + k * L / nP, um = x + L / 2; if (roto > 0 && Math.abs(um - gc) < gh) continue; a('mad', RB(.1, .95, .1, .01, 1), { pos: [x, H + .475, z], rot: [0, 0, roto > 0 && Math.abs(um - gc) < gh + 1 ? (um < gc ? .25 : -.25) : 0], eje: 1 }); }
      piezas.forEach(([u0, u1]) => { if (u1 - u0 < .3) return;[.9, .5].forEach(yy => a('mad', RB(u1 - u0, .07, .07, .008, 1), { pos: [(u0 + u1) / 2 - L / 2, H + yy, z], eje: 0 })); });
    });
  }
  if (roto > 0) for (let i = 0, m = Math.round(3 + roto * 8); i < m; i++) {
    const x = gc - L / 2 + (R() - .5) * 2 * (gh + .8);
    a('mad', RB(.9 + R(), .06, .2, .006, 1), { pos: [x, .05, (R() - .5) * W * 1.2], rot: [0, R() * 6.28, (R() - .5) * .3], eje: 0, tint: .7 + R() * .3 });
  }
  return s.fin();
}

/* ================= registro ================= */
const DEFS_L4 = {
  muro_pro: { nombre: 'Muro de bloques', f: muroPro, params: { l: [1, 40, 8, .5], h: [1, 15, 4, .25], esp: [.3, 2, .8, .05], estilo: [0, 3, 0, 1], talud: [0, 1, 0, .05], curva: [-1, 1, 0, .05], roto: [0, 1, 0, .05], brecha: [0, 1, 0, .05], semilla: [1, 60, 1, 1] } },
  torre: { nombre: 'Torre redonda', f: torrePro, params: { R: [1.5, 6, 3, .1], h: [4, 25, 10, .5], esp: [.5, 1.5, .9, .05], almenas: [0, 1, 1, 1], puerta: [0, 1, 1, 1], roto: [0, 1, 0, .05], brecha: [0, 1, 0, .05], semilla: [1, 60, 1, 1] } },
  columna: { nombre: 'Columna', f: columnaPro, params: { h: [.5, 12, 3, .1], r: [.15, 1, .35, .01], fuste: [0, 2, 2, 1], ruina: [0, 1, 0, .05], semilla: [1, 60, 1, 1] } },
  puente_piedra: { nombre: 'Puente de piedra', f: puentePiedraPro, params: { l: [4, 30, 10, .5], w: [1.5, 6, 3, .1], cota: [1, 6, 3, .25], arcos: [1, 5, 2, 1], baranda: [0, 1, 1, 1], roto: [0, 1, 0, .05], semilla: [1, 60, 1, 1] } },
  puente_madera: { nombre: 'Puente de madera', f: puenteMaderaPro, params: { l: [3, 25, 8, .5], w: [1, 3.5, 1.6, .1], cota: [0, 6, 1.2, .1], colgante: [0, 1, 0, 1], baranda: [0, 1, 1, 1], roto: [0, 1, 0, .05], semilla: [1, 60, 1, 1] } },
};
const HUELLAS_L4 = {
  muro_pro: p => [p.l, p.esp + .6 + Math.abs(p.curva) * p.l * .25], torre: p => [p.R * 2 + .4, p.R * 2 + .4], columna: p => [p.r * 3, p.r * 3],
  puente_piedra: p => [p.l, p.w + .6], puente_madera: p => [p.l, p.w + .6],
};
export const TIPOS_LOTE4 = Object.keys(DEFS_L4);

export function registrarLote4() {
  for (const k in DEFS_L4) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS_L4[k]);
  Object.assign(HUELLA, HUELLAS_L4);
  Object.assign(ETIQUETAS, { esp: 'Grosor', estilo: 'Estilo (0 liso, 1 almenas, 2 puerta, 3 aspilleras)', talud: 'Talud (base más ancha)', curva: 'Curvatura', roto: 'Ruina / rotura', brecha: 'Brecha', almenas: 'Almenas (0/1)', puerta: 'Puerta (0/1)', R: 'Radio', fuste: 'Fuste (0 cuadrada, 1 lisa, 2 estriada)', ruina: 'Ruina', cota: 'Altura del tablero', arcos: 'Arcos', baranda: 'Baranda (0/1)', colgante: 'Colgante (0/1)' });
}
