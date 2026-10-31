/* objetos_lote5.js — techos y cornisas. Va junto a objetos.js y objetos_pro.js.
 *
 *   import { registrarPro } from './objetos_pro.js';
 *   import { registrarLote5 } from './objetos_lote5.js';
 *   registrarPro(); registrarLote5();
 *
 *   techo      w, d (huella de los muros), alt (altura de la cumbrera sobre los muros), alero (voladizo),
 *              aguas (0 dos, 1 una, 2 cuatro), cubierta (0 teja, 1 paja, 2 tablillas, 3 pizarra),
 *              roto (huecos y tejas caídas), vigas (cornisa, fascia y puntas de vigas), fronton (triángulo de tablas)
 *   cornisa    l, proy (cuánto sobresale), esp (grosor del muro), molduras (0 simple, 1 con ménsulas): remate de piedra
 *              para el borde de un muro o de un techo plano
 *
 * Origen del techo: centro de la huella, a la altura de la cara superior de los muros (la solera). La cumbrera
 * va a lo largo del lado más largo. Cada tejado son cientos de piezas sueltas fundidas en pocas mallas.
 */
import * as THREE from 'three';
import { rng, canvasTex, stoneTex, CATALOGO, HUELLA, ETIQUETAS } from './objetos.js';
import { pNuevo, RB, MATERIALES_EXTRA } from './objetos_pro.js';

const P5 = Math.PI, TC5 = {};
const h5 = (a, b, c) => { const k = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return k - Math.floor(k); };

/* ================= materiales ================= */
function tejaTex() {
  if (TC5.teja) return TC5.teja;
  return TC5.teja = canvasTex(256, (g, S) => {
    const r = rng(81); g.fillStyle = '#a4502f'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(60,20,10,.28)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(255,170,120,.14)'; g.fillRect(x + 3, 0, 4, S); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '40,14,6' : '230,150,100') + ',' + r() * .18 + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 18; i++) { const x = r() * S, y = r() * S, R = 8 + r() * 16, gr = g.createRadialGradient(x, y, 1, x, y, R); gr.addColorStop(0, 'rgba(70,90,40,.35)'); gr.addColorStop(1, 'rgba(70,90,40,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
  });
}
function pizarraTex() {
  if (TC5.pizarra) return TC5.pizarra;
  return TC5.pizarra = canvasTex(256, (g, S) => {
    const r = rng(83); g.fillStyle = '#4a4e56'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '10,12,16' : '150,155,165') + ',' + r() * .16 + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
    g.strokeStyle = 'rgba(10,12,16,.4)'; g.lineWidth = 1; for (let i = 0; i < 16; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 40; y += (r() - .2) * 12; g.lineTo(x, y); } g.stroke(); }
  });
}
MATERIALES_EXTRA.teja = () => new THREE.MeshStandardMaterial({ map: tejaTex(), roughness: .85, vertexColors: true });
MATERIALES_EXTRA.pizarra = () => new THREE.MeshStandardMaterial({ map: pizarraTex(), roughness: .7, vertexColors: true });
if (!MATERIALES_EXTRA.piedra) MATERIALES_EXTRA.piedra = () => new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .95, vertexColors: true });

/* pieza con vértices algo movidos (tejas a mano) */
function caja(w, h, d, jit, seed) {
  const g = new THREE.BoxGeometry(w, h, d), a = g.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2];
    a[i] += (h5(x * 7 + seed, y * 7, z * 7) - .5) * jit; a[i + 1] += (h5(x * 7, y * 7 + seed, z * 7 + 1.3) - .5) * jit * .6; a[i + 2] += (h5(x * 7 + 2.1, y * 7, z * 7 + seed) - .5) * jit;
  }
  g.computeVertexNormals();
  return g;
}
const orient5 = (dx, dy, dz) => { const l = Math.hypot(dx, dy, dz) || 1; return { rot: [Math.asin(dz / l), 0, Math.atan2(-dx, dy)], order: 'ZXY' }; };

/* tipos de cubierta: tamaño de cada pieza, solape entre hileras y material */
const CUBIERTAS = [
  { key: 'teja', tw: .3, tl: .42, th: .035, pitch: .3, jit: .012, stagger: true, rz: .05 },
  { key: 'paja', tw: .55, tl: .55, th: .14, pitch: .34, jit: .09, stagger: true, rz: .18 },
  { key: 'mad', tw: .22, tl: .4, th: .02, pitch: .26, jit: .008, stagger: true, rz: .03 },
  { key: 'pizarra', tw: .34, tl: .44, th: .02, pitch: .3, jit: .012, stagger: true, rz: .04 },
];

/* ================= techo ================= */
function techoPro(p) {
  const { w, d, alt, alero: a0, aguas, cubierta, roto, vigas, fronton, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 89 + w * 3 + d * 5)), f = Math.round(aguas);
  const W = Math.max(w, d), D = Math.min(w, d), yaw0 = d > w ? P5 / 2 : 0, a = a0, spec0 = CUBIERTAS[Math.max(0, Math.min(3, Math.round(cubierta)))];
  const cy = Math.cos(yaw0), sy = Math.sin(yaw0), rotY = (v, ps) => [v[0] * Math.cos(ps) + v[2] * Math.sin(ps), v[1], -v[0] * Math.sin(ps) + v[2] * Math.cos(ps)];
  /* añade una pieza: pos y rot en el marco local del tejado (con yaw ps del plano), luego giro global yaw0 */
  const A = (k, g, o) => { const ps = o.psi || 0, pl = rotY(o.pos || [0, 0, 0], ps), pw = rotY(pl, yaw0), r = o.rot || [0, 0, 0]; s.add(k, g, Object.assign({}, o, { pos: pw, rot: [r[0], r[1] + ps + yaw0, r[2]], order: o.order && o.order !== 'XYZ' ? o.order : 'YXZ' })); };

  /* definir los planos de agua */
  let planos = [], th = 0, alt0 = alt;
  if (f === 1) {                       /* un agua */
    th = Math.atan2(alt, D); planos = [{ psi: 0, th, eaveZ: D / 2 + a, yE: -a * Math.tan(th), Lv: (D + 2 * a) / Math.cos(th), wE: W + 2 * a, wT: W + 2 * a }];
  } else if (f === 2) {                /* cuatro aguas */
    th = Math.atan2(alt, D / 2); const Lv = (D / 2 + a) / Math.cos(th), yE = -a * Math.tan(th);
    planos = [{ psi: 0, th, eaveZ: D / 2 + a, yE, Lv, wE: W + 2 * a, wT: Math.max(0, W - D) }, { psi: P5, th, eaveZ: D / 2 + a, yE, Lv, wE: W + 2 * a, wT: Math.max(0, W - D) },
      { psi: P5 / 2, th, eaveZ: W / 2 + a, yE, Lv, wE: D + 2 * a, wT: 0 }, { psi: -P5 / 2, th, eaveZ: W / 2 + a, yE, Lv, wE: D + 2 * a, wT: 0 }];
  } else {                             /* dos aguas */
    th = Math.atan2(alt, D / 2); const Lv = (D / 2 + a) / Math.cos(th), yE = -a * Math.tan(th);
    planos = [{ psi: 0, th, eaveZ: D / 2 + a, yE, Lv, wE: W + 2 * a, wT: W + 2 * a }, { psi: P5, th, eaveZ: D / 2 + a, yE, Lv, wE: W + 2 * a, wT: W + 2 * a }];
  }
  /* si hay demasiadas piezas, se agrandan para cuidar el rendimiento */
  const est = planos.reduce((t, q) => t + q.Lv / spec0.pitch * ((q.wE + q.wT) / 2) / spec0.tw, 0), k = Math.max(1, Math.sqrt(est / 4500));
  const sp = Object.assign({}, spec0, { tw: spec0.tw * k, tl: spec0.tl * k, th: spec0.th * k, pitch: spec0.pitch * k });

  planos.forEach((q, qi) => {
    const c = Math.cos(q.th), sn = Math.sin(q.th), P = (u, v, n) => [u, q.yE + v * sn + c * n, q.eaveZ - v * c + sn * n];
    const huecos = []; if (roto > 0) for (let i = 0, m = Math.round(roto * 5 + 1); i < m; i++) huecos.push({ u: (R() - .5) * q.wE * .7, v: (.2 + .6 * R()) * q.Lv, r: .5 + roto * 1.3 * R() });
    /* tablero bajo las tejas */
    const sh = new THREE.Shape(); sh.moveTo(-q.wE / 2, 0); sh.lineTo(q.wE / 2, 0); sh.lineTo(q.wT / 2, q.Lv); sh.lineTo(-q.wT / 2, q.Lv); sh.lineTo(-q.wE / 2, 0);
    const dk = new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: false }); dk.translate(0, 0, -.05);
    A('mad', dk, { pos: P(0, 0, 0), rot: [q.th - P5 / 2, 0, 0], psi: q.psi, eje: 0, tint: .8 });
    /* hileras de piezas */
    const nR = Math.ceil(q.Lv / sp.pitch), off = sp.th / 2 + .02;
    for (let j = 0; j < nR; j++) {
      const v = j * sp.pitch + sp.tl * .3, wv = q.wE + (q.wT - q.wE) * Math.min(1, v / q.Lv);
      if (wv < sp.tw * .6 || v > q.Lv + sp.tl * .2) continue;
      const n = Math.max(1, Math.round(wv / sp.tw)), tw = wv / n, shift = sp.stagger && j % 2 ? tw / 2 : 0;
      for (let i = 0; i < n; i++) {
        let u = -wv / 2 + (i + .5) * tw + shift; if (u + tw / 2 > wv / 2 + .02) { if (!shift) continue; u = wv / 2 - tw / 2; if (i < n - 1) continue; }
        if (roto > 0 && (h5(i + qi * 31, j, semilla) < roto * .05 || huecos.some(hh => Math.hypot(u - hh.u, v - hh.v) < hh.r * (.8 + .4 * h5(i, j, qi))))) continue;
        A(sp.key, caja(tw * 1.04, sp.th, sp.tl, sp.jit, i * 3 + j * 7 + qi), { pos: P(u + (R() - .5) * .02, v, off + j * .0015), rot: [q.th, 0, (R() - .5) * sp.rz], psi: q.psi, eje: 2, tile: 1, tint: .75 + R() * .4 });
      }
    }
    if (vigas >= .5) {
      for (let u = -q.wE / 2 + .3; u < q.wE / 2 - .2; u += .6) { if (q.wT === 0 && Math.abs(u) > q.wE / 2 - .3) continue; A('mad', RB(.08, .12, .55, .008, 1), { pos: P(u, .2, -.1), rot: [q.th, 0, 0], psi: q.psi, eje: 2 }); }
      A('mad', RB(q.wE + .02, .2, .04, .006, 1), { pos: P(0, -.01, -.02), rot: [q.th, 0, 0], psi: q.psi, eje: 0 });
    }
    if (f !== 2) [-1, 1].forEach(sg => A('mad', RB(.04, .2, q.Lv, .006, 1), { pos: P(sg * (q.wE / 2), q.Lv / 2, .02), rot: [q.th, 0, 0], psi: q.psi, eje: 2 }));
  });

  /* remates: cumbrera y limatesas */
  const capKey = spec0.key === 'paja' ? 'paja' : spec0.key === 'pizarra' ? 'pizarra' : spec0.key === 'mad' ? 'mad' : 'teja';
  if (f === 0) A(capKey, new THREE.CylinderGeometry(.11, .11, W + 2 * a + .06, 8), { pos: [0, alt + .04, 0], rot: [0, 0, P5 / 2], eje: 0, tint: .9 });
  if (f === 2) {
    const L = Math.max(0, W - D), yR = alt + .04;
    if (L > .05) A(capKey, new THREE.CylinderGeometry(.1, .1, L + .2, 8), { pos: [0, yR, 0], rot: [0, 0, P5 / 2], eje: 0 });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const e0 = rotY([sx * L / 2, yR, 0], yaw0), e1 = rotY([sx * (W / 2 + a), -a * Math.tan(th) + .04, sz * (D / 2 + a)], yaw0), dx = e1[0] - e0[0], dy = e1[1] - e0[1], dz = e1[2] - e0[2], len = Math.hypot(dx, dy, dz);
      s.add(capKey, new THREE.CylinderGeometry(.07, .07, len, 6), Object.assign({ pos: [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, (e0[2] + e1[2]) / 2], eje: 1 }, orient5(dx, dy, dz)));
    });
  }
  if (f === 1) A('mad', RB(W + 2 * a, .16, .2, .01, 1), { pos: [0, alt + a * Math.tan(th) + .02, -(D / 2 + a)], eje: 0 });
  /* viga cumbrera, solera y frontones */
  if (vigas >= .5) {
    if (f !== 1) A('mad', RB(W + .2, .18, .16, .01, 1), { pos: [0, alt - .12, 0], eje: 0 });
    [-1, 1].forEach(sg => { A('mad', RB(W + .1, .16, .14, .01, 1), { pos: [0, .08, sg * D / 2], eje: 0 }); A('mad', RB(.14, .16, D - .14, .01, 1), { pos: [sg * W / 2, .08, 0], eje: 2 }); });
  }
  if (f === 0 && fronton >= .5) [-1, 1].forEach(sg => {
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, alt); tri.lineTo(-D / 2, 0);
    A('mad', new THREE.ExtrudeGeometry(tri, { depth: .1, bevelEnabled: false }), { pos: [sg * W / 2 - .05, 0, 0], rot: [0, P5 / 2, 0], eje: 1, tint: .85 });
  });
  return s.fin();
}

/* ================= cornisa ================= */
function cornisaPro(p) {
  const { l, proy, esp, molduras } = p, s = pNuevo(), a = s.add, R = rng(Math.round(l * 13 + proy * 50));
  const t = (y, h, e, k) => a('piedra', RB(l, h, e, .012, 1), { pos: [0, y, 0], eje: 0, tile: 1.2, tint: .85 + .25 * h5(k, l, 1) });
  t(.06, .12, esp + 2 * proy * .25, 1); t(.19, .14, esp + 2 * proy * .6, 2); t(.34, .16, esp + 2 * proy, 3);
  a('piedra', RB(l, .08, esp + 2 * proy * 1.04, .01, 1), { pos: [0, .46, 0], eje: 0, tile: 1.2, tint: .9 });
  if (Math.round(molduras) === 1) for (let x = -l / 2 + .45; x < l / 2 - .2; x += .9) [-1, 1].forEach(sg => {
    a('piedra', RB(.28, .22, proy * .9, .01, 1), { pos: [x, -.05, sg * (esp / 2 + proy * .45)], eje: 1, tile: 1.2, tint: .8 + .3 * R() });
    a('piedra', RB(.2, .2, proy * .5, .01, 1), { pos: [x, -.22, sg * (esp / 2 + proy * .25)], eje: 1, tile: 1.2, tint: .8 + .3 * R() });
  });
  return s.fin();
}

/* ================= registro ================= */
const DEFS_L5 = {
  techo: { nombre: 'Techo', f: techoPro, params: { w: [2, 40, 10, .5], d: [2, 30, 6, .5], alt: [.5, 8, 2.2, .1], alero: [0, 2, .6, .05], aguas: [0, 2, 0, 1], cubierta: [0, 3, 0, 1], roto: [0, 1, 0, .05], vigas: [0, 1, 1, 1], fronton: [0, 1, 1, 1], semilla: [1, 60, 1, 1] } },
  cornisa: { nombre: 'Cornisa de piedra', f: cornisaPro, params: { l: [1, 40, 8, .5], proy: [.1, .8, .3, .02], esp: [.2, 1.5, .6, .05], molduras: [0, 1, 0, 1] } },
};
const HUELLAS_L5 = { techo: p => [p.w + 2 * p.alero, p.d + 2 * p.alero], cornisa: p => [p.l, p.esp + 2 * p.proy] };
export const TIPOS_LOTE5 = Object.keys(DEFS_L5);

export function registrarLote5() {
  for (const k in DEFS_L5) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS_L5[k]);
  Object.assign(HUELLA, HUELLAS_L5);
  Object.assign(ETIQUETAS, { alt: 'Altura de la cumbrera', alero: 'Alero (voladizo)', aguas: 'Aguas (0 dos, 1 una, 2 cuatro)', vigas: 'Vigas y cornisa (0/1)', fronton: 'Frontón (0/1)', proy: 'Saliente', cubierta: 'Cubierta (0 teja, 1 paja, 2 tablillas, 3 pizarra)', molduras: 'Molduras (0 simple, 1 ménsulas)' });
}
