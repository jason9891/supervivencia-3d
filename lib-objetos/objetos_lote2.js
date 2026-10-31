/* objetos_lote2.js — segundo lote de objetos (nivel 2). Va junto a objetos.js y objetos_pro.js.
 *
 *   import { registrarPro } from './objetos_pro.js';
 *   import { registrarLote2 } from './objetos_lote2.js';
 *   registrarPro(); registrarLote2();
 *
 * Objetos: taburete, tinaja, leña apilada, rastrillo, pala, silla de montar con caballete,
 *          balanza, ristra (ajos/cebollas), quesos, farol (con luz), tocón con hacha.
 * Origen: centro de la huella, en el suelo. Frente = +z. Los de 'ancla borde' (rastrillo, pala, ristra)
 * se apoyan en una pared: su origen queda pegado a ella.
 */
import * as THREE from 'three';
import { rng, canvasTex, buildCandle, CATALOGO, HUELLA, ETIQUETAS } from './objetos.js';
import { pNuevo, RB, LA, MATERIALES_EXTRA } from './objetos_pro.js';

const PIM = Math.PI, TC2 = {};

/* ================= materiales nuevos ================= */
function barroTex() {
  if (TC2.barro) return TC2.barro;
  return TC2.barro = canvasTex(256, (g, S) => {
    const r = rng(51); g.fillStyle = '#a85c38'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 4) { g.fillStyle = 'rgba(' + (r() < .5 ? '60,24,10' : '230,150,100') + ',' + (.04 + r() * .08) + ')'; g.fillRect(0, y, S, 2); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '40,16,8' : '220,140,90') + ',' + r() * .16 + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  });
}
function cueroTex() {
  if (TC2.cuero) return TC2.cuero;
  return TC2.cuero = canvasTex(256, (g, S) => {
    const r = rng(61); g.fillStyle = '#5c3a1e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3500; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '20,10,4' : '150,100,60') + ',' + r() * .15 + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 2); }
    g.strokeStyle = 'rgba(20,10,4,.35)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - .5) * 30; y += (r() - .5) * 30; g.lineTo(x, y); } g.stroke(); }
  });
}
MATERIALES_EXTRA.barro = () => new THREE.MeshStandardMaterial({ map: barroTex(), roughness: .85, vertexColors: true });
MATERIALES_EXTRA.cuero = () => new THREE.MeshStandardMaterial({ map: cueroTex(), roughness: .75, vertexColors: true });
MATERIALES_EXTRA.vidrio = () => new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .26, roughness: .05, depthWrite: false });

/* orienta un cilindro (eje y) para ir en la dirección (dx,dy,dz) */
const orient = (dx, dy, dz) => { const l = Math.hypot(dx, dy, dz) || 1; return { rot: [Math.asin(dz / l), 0, Math.atan2(-dx, dy)], order: 'ZXY' }; };
const cadena = (a, A, B) => a('fe', new THREE.CylinderGeometry(.003, .003, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), 4), Object.assign({ pos: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2] }, orient(B[0] - A[0], B[1] - A[1], B[2] - A[2])));
/* herramientas apoyadas en la pared: inclinadas hacia -z, base separada para que la punta toque la pared */
const lean = h => { const th = -.14; return { th, P: t => [0, t * Math.cos(th), t * Math.sin(th) + Math.abs(Math.sin(th)) * h + .03] }; };

/* ================= objetos ================= */
function tabletePro(p) {
  const { d, h } = p, s = pNuevo(), a = s.add, R = rng(Math.round(d * 100 + h * 10));
  a('mad', new THREE.CylinderGeometry(d / 2, d / 2 * .96, .05, 16), { pos: [0, h - .025, 0], eje: 1 });
  const L = h - .05, rt = d * .32, rb = d * .43, al = Math.atan2(rb - rt, L);
  for (let k = 0; k < 3; k++) {
    const th = k * 2 * PIM / 3 + .5, rc = (rt + rb) / 2;
    a('mad', new THREE.CylinderGeometry(.022, .018, L / Math.cos(al), 8), { pos: [rc * Math.sin(th), L / 2, rc * Math.cos(th)], rot: [-al, th, 0], order: 'YXZ', eje: 1, tint: .9 + R() * .2 });
  }
  a('mad', new THREE.TorusGeometry(d * .37, .011, 6, 18), { pos: [0, h * .35, 0], rot: [PIM / 2, 0, 0], uvEsc: [3, .3] });
  return s.fin();
}

function tinajaPro(p) {
  const { r, h, tapa, asas } = p, s = pNuevo(), a = s.add, R = rng(Math.round(r * 100 + h * 10));
  const pts = [[0, 0], [.45 * r, 0], [.8 * r, .08 * h], [r, .35 * h], [.95 * r, .6 * h], [.6 * r, .8 * h], [.42 * r, .9 * h], [.5 * r, .95 * h], [.46 * r, .98 * h], [.4 * r, .96 * h], [.36 * r, .85 * h], [.55 * r, .6 * h], [.88 * r, .35 * h], [.7 * r, .1 * h], [0, .04 * h]];
  a('barro', LA(pts, 22), { uvEsc: [2 * PIM * r / .5, h / .5], tint: .85 + R() * .3 });
  if (tapa >= .5) {
    a('barro', new THREE.CylinderGeometry(.5 * r, .5 * r, .03, 16), { pos: [0, .99 * h, 0], eje: 1 });
    a('barro', new THREE.SphereGeometry(.07 * r + .015, 8, 6), { pos: [0, .99 * h + .035, 0] });
  }
  if (asas >= .5) [-1, 1].forEach(x => a('barro', new THREE.TorusGeometry(.12 * h, .014, 6, 10, PIM), { pos: [x * .72 * r, .66 * h, 0], rot: [0, 0, -x * PIM / 2] }));
  return s.fin();
}

function lenaPro(p) {
  const { w, h } = p, s = pNuevo(), a = s.add, R = rng(Math.round(w * 100 + h * 10)), len = .5, dx = .16, dy = .135;
  const rows = Math.max(1, Math.ceil(h / dy)), cols = Math.max(2, Math.floor((w - .1) / dx));
  for (let k = 0; k < rows; k++) {
    const n = cols - (k % 2), off = (k % 2) * dx / 2;
    for (let i = 0; i < n; i++) {
      const rr = .062 + R() * .02;
      a('mad', new THREE.CylinderGeometry(rr, rr, len + (R() - .5) * .06, 8), { pos: [-((cols - 1) * dx) / 2 + off + i * dx + (R() - .5) * .01, .08 + k * dy, (R() - .5) * .04], rot: [PIM / 2, 0, 0], eje: 2, tint: .8 + R() * .35 });
    }
  }
  [-1, 1].forEach(x => a('mad', RB(.05, rows * dy + .1, .05, .008), { pos: [x * (w / 2 + .02), (rows * dy + .1) / 2, 0], eje: 1 }));
  return s.fin();
}

function rastrilloPro(p) {
  const { h } = p, s = pNuevo(), a = s.add, { th, P } = lean(h);
  a('mad', new THREE.CylinderGeometry(.016, .02, h, 8), { pos: P(h / 2), rot: [th, 0, 0], eje: 1 });
  a('fe', RB(.42, .03, .03, .006, 1), { pos: P(h - .03), rot: [th, 0, 0] });
  for (let i = 0; i < 7; i++) a('fe', new THREE.CylinderGeometry(.004, .005, .09, 5), { pos: P(h - .03 - .06).map((v, k) => k === 0 ? (i - 3) * .06 : v), rot: [th, 0, 0] });
  return s.fin();
}

function palaPro(p) {
  const { h } = p, s = pNuevo(), a = s.add, { th, P } = lean(h);
  a('mad', new THREE.CylinderGeometry(.016, .02, h - .25, 8), { pos: P((h + .25) / 2), rot: [th, 0, 0], eje: 1 });
  a('mad', RB(.18, .025, .025, .006, 1), { pos: P(h), rot: [th, 0, 0], eje: 0 });
  a('fe', RB(.2, .3, .012, .004, 1), { pos: P(.15), rot: [th, 0, 0] });
  return s.fin();
}

function sillaMontarPro() {
  const s = pNuevo(), a = s.add;
  a('mad', RB(.9, .08, .08, .01), { pos: [0, .75, 0], eje: 0 });
  [-1, 1].forEach(x => [-1, 1].forEach(z => a('mad', RB(.06, .8, .06, .008), { pos: [x * .38, .38, z * .16], rot: [-z * .2, 0, 0], eje: 1 })));
  a('mad', RB(.7, .04, .04, .006), { pos: [0, .3, 0], eje: 0 });
  a('cuero', new THREE.SphereGeometry(1, 12, 8), { pos: [0, .84, 0], esc: [.22, .07, .14] });
  a('cuero', new THREE.SphereGeometry(1, 8, 6), { pos: [0, .9, .14], esc: [.05, .07, .04] });
  a('cuero', new THREE.SphereGeometry(1, 8, 6), { pos: [0, .9, -.13], esc: [.2, .08, .04] });
  [-1, 1].forEach(x => {
    a('cuero', RB(.04, .3, .22, .01, 1), { pos: [x * .2, .66, 0], rot: [0, 0, x * .12] });
    a('cuero', new THREE.CylinderGeometry(.008, .008, .2, 5), { pos: [x * .27, .46, 0] });
    a('fe', new THREE.TorusGeometry(.05, .008, 6, 10), { pos: [x * .27, .33, 0], rot: [0, PIM / 2, 0] });
  });
  return s.fin();
}

function balanzaPro(p) {
  const { h } = p, s = pNuevo(), a = s.add;
  a('mad', RB(.3, .04, .2, .008), { pos: [0, .02, 0], eje: 0 });
  a('mad', RB(.04, h, .04, .006), { pos: [0, h / 2, 0], eje: 1 });
  a('fe', RB(.5, .025, .025, .005, 1), { pos: [0, h, 0] });
  a('fe', new THREE.SphereGeometry(.02, 8, 6), { pos: [0, h + .02, 0] });
  const dish = [[0, 0], [.09, 0], [.11, .025], [.105, .025], [.085, .008], [0, .008]];
  [-1, 1].forEach(x => {
    const py = h - .2;
    a('fe', LA(dish, 14), { pos: [x * .22, py, 0], uvEsc: [2, 1] });
    for (let k = 0; k < 3; k++) { const an = k * 2 * PIM / 3; cadena(a, [x * .22, h, 0], [x * .22 + Math.cos(an) * .1, py + .025, Math.sin(an) * .1]); }
  });
  return s.fin();
}

function ristraPro(p) {
  const { largo, tipo } = p, s = pNuevo(), a = s.add, R = rng(Math.round(largo * 100 + tipo * 7)), col = tipo >= .5 ? [.78, .45, .2] : [.93, .9, .8], n = Math.max(2, Math.round(largo / .1));
  a('tela', new THREE.CylinderGeometry(.008, .008, largo, 5), { pos: [0, largo / 2, .04], rgb: [.7, .55, .35] });
  a('fe', new THREE.TorusGeometry(.02, .004, 5, 8), { pos: [0, largo, .025] });
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), rs = .05 - .012 * t, y = largo - .08 - i * ((largo - .12) / n);
    a('liso', new THREE.SphereGeometry(1, 7, 5), { pos: [(i % 2 ? .03 : -.03) * (1 - t * .5), y, .04 + (R() - .5) * .03], esc: [rs, rs * .85, rs], rgb: col.map(v => v * (.9 + R() * .2)), tint: .9 + R() * .2 });
  }
  for (let k = 0; k < 3; k++) a('paja', new THREE.CylinderGeometry(.003, .003, .12, 4), { pos: [(k - 1) * .02, largo + .05, .04], rot: [0, 0, (k - 1) * .2], eje: 1 });
  return s.fin();
}

function quesosPro(p) {
  const { n } = p, s = pNuevo(), a = s.add, R = rng(Math.round(n * 13)), cnt = Math.max(1, Math.round(n));
  a('mad', RB(.55, .03, .35, .006), { pos: [0, .015, 0], eje: 0 });
  for (let i = 0; i < cnt; i++) {
    const layer = Math.floor(i / 2), x = (i % 2 ? .12 : -.12) + (R() - .5) * .01;
    a('liso', new THREE.CylinderGeometry(.11, .11, .07, 14), { pos: [x, .03 + layer * .07 + .035, (R() - .5) * .02], rgb: [.9, .74, .34], tint: .9 + R() * .15 });
  }
  return s.fin();
}

function farolPro() {
  const s = pNuevo(), a = s.add;
  a('fe', new THREE.CylinderGeometry(.07, .07, .02, 10), { pos: [0, .01, 0] });
  [-1, 1].forEach(x => [-1, 1].forEach(z => a('fe', RB(.012, .2, .012, .003, 1), { pos: [x * .05, .12, z * .05] })));
  a('fe', new THREE.ConeGeometry(.085, .07, 4), { pos: [0, .265, 0], rot: [0, PIM / 4, 0] });
  a('fe', new THREE.TorusGeometry(.03, .005, 5, 12, PIM), { pos: [0, .3, 0] });
  a('vidrio', new THREE.BoxGeometry(.09, .19, .09), { pos: [0, .12, 0] });
  const c = buildCandle(.9); c.root.position.set(0, .02, 0);
  const r = s.fin({ anim: c.anim, anchor: c.anchor }); r.root.add(c.root); return r;
}

function toconHachaPro(p) {
  const { r, h } = p, s = pNuevo(), a = s.add;
  a('mad', new THREE.CylinderGeometry(r * .95, r, h, 14), { pos: [0, h / 2, 0], eje: 1 });
  [0, 2.1, 4.2].forEach(an => a('mad', new THREE.CylinderGeometry(.03, .05, .1, 6), { pos: [Math.cos(an) * r * .95, .04, Math.sin(an) * r * .95], rot: [0, 0, Math.cos(an) * .5], eje: 1 }));
  a('mad', new THREE.CylinderGeometry(.018, .016, .6, 7), { pos: [.04, h + .24, 0], rot: [0, 0, -.25], eje: 1 });
  a('fe', RB(.025, .1, .14, .006, 1), { pos: [0, h + .03, 0], rot: [0, 0, -.25] });
  return s.fin();
}

/* ================= registro ================= */
const DEFS_L2 = {
  taburete: { nombre: 'Taburete', f: tabletePro, params: { diam: [.25, .4, .32, .01], h: [.3, .6, .45, .01] } },
  tinaja: { nombre: 'Tinaja', f: tinajaPro, params: { r: [.15, .45, .3, .01], h: [.4, 1.2, .8, .02], tapa: [0, 1, 0, 1], asas: [0, 1, 1, 1] } },
  lena: { nombre: 'Leña apilada', f: lenaPro, params: { w: [.6, 2, 1.2, .05], h: [.3, 1, .6, .02] } },
  rastrillo: { nombre: 'Rastrillo', f: rastrilloPro, params: { h: [1.2, 2, 1.7, .05] }, ancla: 'borde' },
  pala: { nombre: 'Pala', f: palaPro, params: { h: [1, 1.7, 1.4, .05] }, ancla: 'borde' },
  silla_montar: { nombre: 'Silla de montar', f: sillaMontarPro, params: {} },
  balanza: { nombre: 'Balanza', f: balanzaPro, params: { h: [.3, .7, .45, .02] } },
  ristra: { nombre: 'Ristra de ajos/cebollas', f: ristraPro, params: { largo: [.4, 1, .7, .05], tipo: [0, 1, 0, 1] }, ancla: 'borde', elev: 1.2 },
  quesos: { nombre: 'Tabla de quesos', f: quesosPro, params: { n: [1, 6, 3, 1] } },
  farol: { nombre: 'Farol', f: farolPro, params: {} },
  tocon_hacha: { nombre: 'Tocón con hacha', f: toconHachaPro, params: { r: [.18, .4, .26, .01], h: [.3, .6, .42, .01] } },
};
const HUELLAS_L2 = {
  taburete: p => [p.diam, p.diam], tinaja: p => [p.r * 2, p.r * 2], lena: p => [p.w + .1, .7], rastrillo: () => [.5, .5], pala: () => [.4, .4],
  silla_montar: () => [.95, .5], balanza: () => [.55, .3], ristra: () => [.3, .3], quesos: () => [.6, .4], farol: () => [.2, .2], tocon_hacha: p => [p.r * 2 + .1, p.r * 2 + .1],
};
export const TIPOS_LOTE2 = Object.keys(DEFS_L2);

export function registrarLote2() {
  for (const k in DEFS_L2) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS_L2[k]);
  Object.assign(HUELLA, HUELLAS_L2);
  Object.assign(ETIQUETAS, { diam: 'Diámetro', largo: 'Largo', tapa: 'Con tapa (0/1)', asas: 'Asas (0/1)', tipo: 'Tipo (0 ajo, 1 cebolla)', n: 'Cantidad' });
}
