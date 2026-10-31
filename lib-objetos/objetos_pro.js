/* objetos_pro.js — objetos con detalle "nivel 2" (biselados, relieve, desgaste, mallas fusionadas).
 *
 *   import { registrarPro } from './objetos_pro.js';
 *   registrarPro();      // una vez; sustituye mesa, banca, barril y caja y añade mercado y establo
 *   // después todo funciona igual: crearObjeto('puesto', { w: 3 }), poblar(...), CATALOGO
 *
 * Necesita en el importmap:  "three/addons/": ".../three@0.160.0/examples/jsm/"
 * Cada objeto se fusiona en pocas mallas (una por material), así que 40 copias siguen siendo ligeras.
 * Origen: centro de la huella, apoyado en el suelo. Frente = +z, espalda = -z.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, vnoise, mixc, canvasTex, PALETAS, getVariante, ironTex, clothTex, buildCandle, CATALOGO, HUELLA, ETIQUETAS } from './objetos.js';

const V3 = THREE.Vector3;
const TCP = {};

/* ================= texturas ================= */
function maderaMapas(v) {
  const key = 'madera' + v; if (TCP[key]) return TCP[key];
  const S = 256, mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; }, cc = mk(), hc = mk(), g = cc.getContext('2d'), h = hc.getContext('2d');
  const P = PALETAS[v], r = rng(21 + v), n1 = vnoise(r, 32), n2 = vnoise(r, 64);
  for (let x = 0; x < S; x++) { const k = n1(x * .09) * .6 + n2(x * .4) * .4; g.fillStyle = mixc(P.dark, P.light, k); g.fillRect(x, 0, 1, S); const gv = Math.round(110 + k * 60); h.fillStyle = 'rgb(' + gv + ',' + gv + ',' + gv + ')'; h.fillRect(x, 0, 1, S); }
  for (let i = 0; i < 80; i++) {
    const x0 = r() * S, amp = 1 + r() * 3, f = .02 + r() * .04, ph = r() * 6.3, a = .1 + r() * .25;
    for (const o of [-S, 0, S]) {
      g.strokeStyle = 'rgba(' + P.vein + ',' + a + ')'; h.strokeStyle = 'rgba(30,30,30,' + Math.min(.9, a * 2.2) + ')';
      for (const q of [g, h]) { q.lineWidth = 1; q.beginPath(); for (let y = 0; y <= S; y += 8) { const x = x0 + o + Math.sin(y * f + ph) * amp; if (y) q.lineTo(x, y); else q.moveTo(x, y); } q.stroke(); }
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = r() * S, y = r() * S, R = 9 + r() * 8;
    let gr = g.createRadialGradient(x, y, 1, x, y, R); gr.addColorStop(0, 'rgba(' + P.vein + ',.7)'); gr.addColorStop(1, 'rgba(' + P.vein + ',0)'); g.fillStyle = gr; g.fillRect(x - R, y - R * 2, R * 2, R * 4);
    gr = h.createRadialGradient(x, y, 1, x, y, R); gr.addColorStop(0, 'rgba(20,20,20,.9)'); gr.addColorStop(.6, 'rgba(200,200,200,.5)'); gr.addColorStop(1, 'rgba(128,128,128,0)'); h.fillStyle = gr; h.fillRect(x - R, y - R * 2, R * 2, R * 4);
  }
  for (let i = 0; i < 5; i++) {
    const x = r() * S, y = r() * S, len = 50 + r() * 60; g.strokeStyle = 'rgba(' + P.vein + ',.85)'; h.strokeStyle = 'rgba(0,0,0,.9)';
    for (const q of [g, h]) { q.lineWidth = 1.2; q.beginPath(); q.moveTo(x, y); let xx = x, yy = y; for (let k = 0; k < len; k += 6) { xx += (r() - .5) * 2.2; yy += 6; q.lineTo(xx, yy); } q.stroke(); }
  }
  const hd = h.getImageData(0, 0, S, S).data, nor = new Uint8ClampedArray(S * S * 4), ht = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255, K = 3.2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (ht(x + 1, y) - ht(x - 1, y)) * K, dy = (ht(x, y + 1) - ht(x, y - 1)) * K, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nor[i] = (-dx / l * .5 + .5) * 255; nor[i + 1] = (dy / l * .5 + .5) * 255; nor[i + 2] = (1 / l * .5 + .5) * 255; nor[i + 3] = 255;
  }
  const nc = mk(); nc.getContext('2d').putImageData(new ImageData(nor, S, S), 0, 0);
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return TCP[key] = { map: T(cc, true), nor: T(nc, false), rug: T(hc, false) };
}
function strawTex() {
  if (TCP.straw) return TCP.straw;
  return TCP.straw = canvasTex(256, (g, S) => {
    const r = rng(31); g.fillStyle = '#b8984e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1500; i++) {
      const x = r() * S, y = r() * S, l = 14 + r() * 40, dy = (r() - .5) * 3; g.strokeStyle = 'rgba(' + (r() < .5 ? '235,205,120' : '110,80,34') + ',' + (.25 + r() * .4) + ')'; g.lineWidth = 1;
      for (const o of [0, -S]) { g.beginPath(); g.moveTo(x + o, y); g.lineTo(x + o + l, y + dy); g.stroke(); }
    }
  });
}
function wickerTex() {
  if (TCP.wicker) return TCP.wicker;
  return TCP.wicker = canvasTex(256, (g, S) => {
    g.fillStyle = '#4a3216'; g.fillRect(0, 0, S, S); const cw = 16, ch = 8;
    for (let row = 0; row < S / ch; row++) for (let c = 0; c <= S / cw; c++) {
      const x = c * cw + (row % 2) * cw / 2, y = row * ch; g.fillStyle = mixc([112, 80, 40], [176, 132, 72], ((row * 7 + c * 13) % 10) / 10);
      g.fillRect(x, y, cw - 1.5, ch - 1.5); g.fillRect(x - S, y, cw - 1.5, ch - 1.5);
    }
  });
}
function toldoTex() {
  if (TCP.toldo) return TCP.toldo;
  return TCP.toldo = canvasTex(256, (g, S) => {
    const n = 8, w = S / n, r = rng(41);
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#e8dcc0' : '#a3281f'; g.fillRect(i * w, 0, w, S); }
    for (let i = 0; i < S; i += 3) { g.fillStyle = 'rgba(0,0,0,' + (.04 + r() * .06) + ')'; g.fillRect(0, i, S, 1); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(40,30,20,' + r() * .12 + ')'; g.fillRect(r() * S, r() * S, 2, 1); }
  });
}

/* ================= materiales (uno por variante de madera) ================= */
const MC = {};
export const MATERIALES_EXTRA = {};   // otros módulos añaden aquí: clave -> función que crea el material
const MX = {};
function pMats() {
  const v = getVariante(); if (MC[v]) return MC[v];
  const m = maderaMapas(v), std = o => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
  return MC[v] = {
    mad: std({ map: m.map, normalMap: m.nor, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: m.rug, roughness: 1 }),
    fe: std({ map: ironTex(), roughness: .55, metalness: .4 }),
    tela: std({ map: clothTex(), roughness: 1 }),
    toldo: std({ map: toldoTex(), roughness: 1, side: THREE.DoubleSide }),
    paja: std({ map: strawTex(), roughness: 1 }),
    mimbre: std({ map: wickerTex(), roughness: .9 }),
    liso: std({ roughness: .55 }),
    agua: new THREE.MeshStandardMaterial({ color: 0x3f6572, roughness: .08, transparent: true, opacity: .82 }),
  };
}

/* ================= piezas ================= */
const RB = (w, h, d, r = .006, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.max(.001, Math.min(r, Math.min(w, h, d) / 2 - .0005)));

/* Mueve la pieza, calcula UV en metros según la veta (eje 0=x,1=y,2=z) y color por vértice:
   sombra cerca del suelo, cara inferior más oscura, aristas gastadas más claras. */
function pPrep(geo, o) {
  if (o.pos || o.rot || o.esc) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]), o.order || 'XYZ'));
    geo.applyMatrix4(new THREE.Matrix4().compose(new V3(...(o.pos || [0, 0, 0])), q, new V3(...(o.esc || [1, 1, 1]))));
  }
  const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, col = new Float32Array(n * 3), e = o.eje === undefined ? 1 : o.eje, tile = o.tile || .8, t = o.tint || 1, rgb = o.rgb || [1, 1, 1];
  const uv = o.uvEsc ? geo.attributes.uv.array.slice() : new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = [P.getX(i), P.getY(i), P.getZ(i)], nn = [N.getX(i), N.getY(i), N.getZ(i)];
    if (o.uvEsc) { uv[i * 2] *= o.uvEsc[0]; uv[i * 2 + 1] *= o.uvEsc[1]; }
    else {
      let d = 0; if (Math.abs(nn[1]) > Math.abs(nn[d])) d = 1; if (Math.abs(nn[2]) > Math.abs(nn[d])) d = 2; let u, v;
      if (d === e) { const a = [0, 1, 2].filter(k => k !== e); u = p[a[0]]; v = p[a[1]]; } else { v = p[e]; u = p[[0, 1, 2].find(k => k !== d && k !== e)]; }
      uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    }
    const mx = Math.max(Math.abs(nn[0]), Math.abs(nn[1]), Math.abs(nn[2]));
    let b = t * (.78 + .22 * Math.min(1, Math.max(0, p[1] / .5)));
    if (nn[1] < -.5) b *= .75;
    if (o.desg) b *= 1 + o.desg * Math.max(0, (.96 - mx) / .1);
    col[i * 3] = b * rgb[0]; col[i * 3 + 1] = b * .98 * rgb[1]; col[i * 3 + 2] = b * .95 * rgb[2];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function pNuevo() {
  const p = {};
  const add = (k, g, o) => { (p[k] = p[k] || []).push(pPrep(g, Object.assign({ desg: k === 'mad' ? 1.1 : 0 }, o))); };
  const fin = extra => {
    const M3 = pMats(), root = new THREE.Group();
    for (const k in p) {
      let arr = p[k]; if (arr.some(g => !g.index)) arr = arr.map(g => g.index ? g.toNonIndexed() : g);
      const mesh = new THREE.Mesh(mergeGeometries(arr, false), M3[k] || (MX[k] = MX[k] || MATERIALES_EXTRA[k]())); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    }
    return Object.assign({ root, anim: () => { }, anchor: null }, extra || {});
  };
  return { add, fin };
}
const LA = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), seg);

/* ================= mesa, banca, barril, caja (nivel 2) ================= */
function mesaPro(p) {
  const { w, d, h } = p, s = pNuevo(), R = rng(5), a = s.add;
  const lw = Math.max(.06, Math.min(.1, .05 + .012 * w)), ins = .04, n = Math.max(2, Math.round(d / .2)), pw = d / n;
  for (let i = 0; i < n; i++) {
    const j = R() - .5, z = -d / 2 + pw * (i + .5);
    a('mad', RB(w, .05, pw - .006, .009, 3), { pos: [0, h - .025 + j * .004, z], rot: [0, j * .008, 0], eje: 0, tint: .85 + R() * .25 });
    [-1, 1].forEach(sx => [-1, 1].forEach(q => a('fe', new THREE.CylinderGeometry(.007, .007, .005, 8), { pos: [sx * (w / 2 - .05), h + .001 + j * .004, z + q * pw * .28], eje: 1 })));
  }
  const lx = w / 2 - ins - lw / 2, lz = d / 2 - ins - lw / 2, lh = h - .05, inX = w - 2 * (ins + lw), inZ = d - 2 * (ins + lw);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    a('mad', RB(lw, .14, lw, .01, 3), { pos: [sx * lx, lh - .07, sz * lz], eje: 1 });
    a('mad', RB(lw, .07, lw, .01, 3), { pos: [sx * lx, .035, sz * lz], eje: 1 });
    const L = lh - .21, pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, anillo = [.2, .5, .8].some(c => Math.abs(t - c) < .035) ? .78 : 1; pts.push([lw * .42 * anillo * (1 + .1 * Math.sin(t * Math.PI * 3)) * (1 - .12 * t), t * L]); }
    pts.unshift([0, 0]); pts.push([0, L]);
    a('mad', LA(pts, 14), { pos: [sx * lx, .07, sz * lz], uvEsc: [lw * 1.3 / .8, L / .8] });
  }));
  [-1, 1].forEach(sg => {
    a('mad', RB(inX, .08, .035), { pos: [0, lh - .05, sg * lz], eje: 0 });
    a('mad', RB(.035, .08, inZ), { pos: [sg * lx, lh - .05, 0], eje: 2 });
    a('mad', RB(inX, .04, .035), { pos: [0, Math.min(.25, lh * .3), sg * lz], eje: 0 });
  });
  if (p.vela) {
    const c = buildCandle(1.3); c.root.position.set(w * .2, h, d * .05);
    a('liso', LA([[0, 0], [.06, 0], [.08, .06], [.07, .16], [.04, .2], [.045, .23], [.038, .23], [.033, .2], [.06, .16], [.07, .06], [0, .04]], 16), { pos: [-w * .25, h, -d * .12], rgb: [.48, .29, .17], uvEsc: [1, 1] });
    const r = s.fin({ anim: c.anim, anchor: c.anchor }); r.root.add(c.root); return r;
  }
  return s.fin();
}

function bancoPro(p) {
  const { w, d, h, resp } = p, s = pNuevo(), a = s.add;
  a('mad', RB(w, .05, d, .008, 3), { pos: [0, h - .025, 0], eje: 0 });
  [-1, 1].forEach(x => a('mad', RB(.05, h - .05, d * .88, .006), { pos: [x * (w / 2 - .06), (h - .05) / 2, 0], eje: 1 }));
  a('mad', RB(w - .2, .04, .04), { pos: [0, h * .4, 0], eje: 0 });
  if (resp >= .5) {
    [-1, 1].forEach(x => a('mad', RB(.05, .5, .05, .008), { pos: [x * (w / 2 - .05), h + .25, -d / 2 + .04], eje: 1 }));
    a('mad', RB(w - .06, .13, .025), { pos: [0, h + .34, -d / 2 + .04], eje: 0 });
    a('mad', RB(w - .06, .1, .025), { pos: [0, h + .17, -d / 2 + .04], eje: 0 });
  }
  return s.fin();
}

function barrilPro(p) {
  const { r, h } = p, s = pNuevo(), R = rng(8), a = s.add, kx = r / .335, rEnd = .25 * kx, rad = y => rEnd + (r - rEnd) * (1 - Math.pow(2 * y / h - 1, 2));
  const hoopY = [.15, .33, .6, .77].map(f => f * h / .9), N = 22, SG = 8, th = .03;
  for (let k = 0; k < N; k++) {
    const an = (k + .5) / N * Math.PI * 2, tint = .82 + R() * .3;
    for (let j = 0; j < SG; j++) {
      const y0 = j / SG * h, y1 = (j + 1) / SG * h, ym = (y0 + y1) / 2, rm = rad(ym), slope = (rad(y1) - rad(y0)) / (y1 - y0), wd = 2 * Math.PI * rm / N * .96, seg = (y1 - y0) * 1.04 / Math.cos(Math.atan(slope));
      a('mad', new RoundedBoxGeometry(wd, seg, th, 1, .005), { pos: [Math.cos(an) * (rm - th / 2), ym, Math.sin(an) * (rm - th / 2)], rot: [Math.atan(slope), Math.PI / 2 - an, 0], order: 'YXZ', eje: 1, tint });
    }
  }
  hoopY.forEach(y => {
    const ro = rad(y) + .012, ri = rad(y) - .002, bw = .045;
    a('fe', LA([[ri, -bw / 2], [ro, -bw / 2], [ro, bw / 2], [ri, bw / 2], [ri, -bw / 2]], 40), { pos: [0, y, 0], uvEsc: [3, .3] });
    for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2 + y; a('fe', new THREE.SphereGeometry(.009, 6, 4), { pos: [Math.cos(an) * (ro + .002), y, Math.sin(an) * (ro + .002)] }); }
  });
  a('mad', new THREE.CylinderGeometry(rEnd - .012, rEnd - .012, .03, 24), { pos: [0, h - .03, 0], eje: 0 });
  a('mad', new THREE.CylinderGeometry(.026, .026, .02, 10), { pos: [rEnd * .4, h - .012, rEnd * .2], eje: 0, tint: .6 });
  return s.fin();
}

function cajaPro(p) {
  const { w, h, d } = p, s = pNuevo(), a = s.add, ns = Math.max(2, Math.round(h / .09)), hs = h / ns - .008;
  for (let i = 0; i < ns; i++) {
    const y = hs / 2 + i * (h / ns) + .01;
    [-1, 1].forEach(z => a('mad', RB(w, hs, .02, .004, 1), { pos: [0, y, z * (d / 2 - .01)], eje: 0 }));
    [-1, 1].forEach(x => a('mad', RB(.02, hs, d - .04, .004, 1), { pos: [x * (w / 2 - .01), y, 0], eje: 2 }));
  }
  [-1, 1].forEach(x => [-1, 1].forEach(z => a('mad', RB(.045, h + .02, .045, .006), { pos: [x * (w / 2 - .022), (h + .02) / 2, z * (d / 2 - .022)], eje: 1 })));
  a('mad', RB(w - .04, .02, d - .04, .004, 1), { pos: [0, .012, 0], eje: 0 });
  [-.23, .23].forEach(f => a('fe', RB(.04, .015, d + .02, .003, 1), { pos: [f * w, h + .03, 0] }));
  a('mad', RB(w + .02, .035, d + .02, .005), { pos: [0, h + .0175, 0], eje: 0, tint: .9 });
  return s.fin();
}

/* ================= mercado ================= */
function puestoPro(p) {
  const { w, d, h, H, tono } = p, s = pNuevo(), R = rng(13), a = s.add, tint = [[1, 1, 1], [.55, .78, 1.15], [.7, 1.05, .6]][Math.min(2, Math.round(tono))];
  a('mad', RB(w, .06, d, .008, 3), { pos: [0, h, 0], eje: 0 });
  const n = Math.max(3, Math.round(w / .18)), bw = w / n;
  for (let i = 0; i < n; i++) a('mad', RB(bw - .008, h - .06, .025, .005, 1), { pos: [-w / 2 + bw * (i + .5), (h - .06) / 2, d / 2 - .02], eje: 1, tint: .85 + R() * .25 });
  [-1, 1].forEach(x => a('mad', RB(.025, h - .06, d - .05, .005, 1), { pos: [x * (w / 2 - .015), (h - .06) / 2, 0], eje: 1 }));
  a('mad', RB(w - .05, .03, d - .05, .005, 1), { pos: [0, .3, 0], eje: 0 });
  [-1, 1].forEach(x => {
    a('mad', RB(.08, H, .08, .01), { pos: [x * (w / 2 - .02), H / 2, -d / 2 + .04], eje: 1 });
    a('mad', RB(.07, H - .25, .07, .01), { pos: [x * (w / 2 - .02), (H - .25) / 2, d / 2 + .4], eje: 1 });
  });
  const dz = d + .36, dy = .25, len = Math.hypot(dz, dy), ang = Math.atan2(dy, dz), zm = (d / 2 + .4 + (-d / 2 + .04)) / 2;
  a('toldo', new THREE.BoxGeometry(w + .3, .012, len + .1), { pos: [0, H - .125 + .02, zm], rot: [ang, 0, 0], eje: 2, rgb: tint });
  a('toldo', new THREE.BoxGeometry(w + .3, .12, .012), { pos: [0, H - .25 - .04, d / 2 + .45], eje: 1, rgb: tint });
  [-1, 1].forEach(x => a('mad', RB(.04, .04, len, .006), { pos: [x * (w / 2 - .02), H - .125 - .01, zm], rot: [ang, 0, 0], eje: 2 }));
  return s.fin();
}

const FRUTAS = [
  [[.8, .1, .08], [.9, .25, .1], [.7, .5, .12]],
  [[.95, .5, .08], [1, .62, .15], [.9, .42, .06]],
  [[.5, .7, .15], [.62, .8, .2], [.7, .75, .25]]];

/* Deja caer frutas al azar: cada una reposa sobre las que ya hay debajo, así se forma un montón irregular.
   o: { rs, n, ymax, x0,x1,z0,z1, y0, en(x,z,rs), fruta (0 manzana, 1 naranja, 2 verde, 3 mezcla) } */
function apilar(a, R, o) {
  const fr = [], tipoFijo = Math.round(o.fruta);
  let tries = 0;
  while (fr.length < o.n && tries < o.n * 12) {
    tries++;
    const rs = o.rs * (.85 + R() * .3), x = o.x0 + R() * (o.x1 - o.x0), z = o.z0 + R() * (o.z1 - o.z0);
    if (!o.en(x, z, rs)) continue;
    let y = o.y0 + rs;
    for (const f of fr) { const dd = Math.hypot(x - f.x, z - f.z), m = rs + f.rs; if (dd < m) y = Math.max(y, f.y + Math.sqrt(m * m - dd * dd)); }
    if (y > o.ymax) continue;
    fr.push({ x, y, z, rs });
  }
  fr.forEach(f => {
    const tipo = tipoFijo >= 3 ? Math.floor(R() * 3) : tipoFijo, pal = FRUTAS[Math.min(2, tipo)], c = pal[R() < .55 ? 0 : R() < .8 ? 1 : 2], mag = R() < .08 ? .55 : 1;
    a('liso', new THREE.SphereGeometry(1, 7, 5), { pos: [f.x, f.y, f.z], esc: [f.rs, f.rs * (.88 + R() * .1), f.rs], rgb: c.map(v => v * mag), tint: .88 + R() * .24 });
  });
  return fr.length;
}

function cajonFrutaPro(p) {
  const { w, d, h } = p, llen = Math.max(0, Math.min(1, p.llenado)), s = pNuevo(), R = rng(Math.round(w * 1000 + d * 100 + h * 10 + llen * 100 + p.fruta * 7)), a = s.add, ns = Math.max(2, Math.round(h / .07)), hs = h / ns - .006;
  for (let i = 0; i < ns; i++) {
    const y = hs / 2 + i * (h / ns) + .01;
    [-1, 1].forEach(z => a('mad', RB(w, hs, .016, .003, 1), { pos: [0, y, z * (d / 2 - .008)], eje: 0 }));
    [-1, 1].forEach(x => a('mad', RB(.016, hs, d - .032, .003, 1), { pos: [x * (w / 2 - .008), y, 0], eje: 2 }));
  }
  [-1, 1].forEach(x => [-1, 1].forEach(z => a('mad', RB(.035, h + .02, .035, .005, 1), { pos: [x * (w / 2 - .0175), (h + .02) / 2, z * (d / 2 - .0175)], eje: 1 })));
  a('mad', RB(w - .03, .014, d - .03, .003, 1), { pos: [0, .012, 0], eje: 0 });
  const rs = .034, ymax = h + .04 + .03 * llen, lim = { x0: -(w / 2 - .03 - rs), x1: w / 2 - .03 - rs, z0: -(d / 2 - .03 - rs), z1: d / 2 - .03 - rs };
  const cap = (w - .06) * (d - .06) / (Math.PI * rs * rs * 1.3) * Math.max(1, (ymax - .02) / (rs * 1.55));
  if (llen < .06) {       /* cajón vacío: a lo sumo una fruta caída y un poco de paja */
    if (R() < .5) apilar(a, R, Object.assign({ rs, n: 1, ymax, y0: .02, en: () => true, fruta: p.fruta }, lim));
    for (let k = 0; k < 2; k++) a('paja', new THREE.SphereGeometry(.07, 6, 4), { pos: [(R() - .5) * (w - .15), .03, (R() - .5) * (d - .15)], esc: [1.6, .18, 1.1], eje: 0 });
  } else apilar(a, R, Object.assign({ rs, n: Math.min(90, Math.round(llen * cap)), ymax, y0: .02, en: () => true, fruta: p.fruta }, lim));
  return s.fin();
}

function sacoPro(p) {
  const { r, h } = p, s = pNuevo(), R = rng(Math.round(r * 100 + h * 10));
  const pts = [[0, 0], [.78 * r, 0], [.98 * r, .06 * h], [1.04 * r, .3 * h], [1.0 * r, .5 * h], [.8 * r, .7 * h], [.45 * r, .84 * h], [.2 * r, .9 * h], [.26 * r, .95 * h], [.34 * r, h], [.1 * r, .98 * h], [0, .96 * h]];
  const g = LA(pts, 18), ar = g.attributes.position.array;
  for (let i = 0; i < ar.length; i += 3) { ar[i] += Math.sin(ar[i + 1] * 9 + ar[i + 2] * 5) * r * .05; ar[i + 2] += Math.sin(ar[i + 1] * 7 + ar[i] * 4) * r * .05; }
  g.computeVertexNormals();
  s.add('tela', g, { uvEsc: [2 * Math.PI * r / .5, h / .5], rgb: [.95, .82, .6], tint: .9 + R() * .15 });
  s.add('tela', new THREE.TorusGeometry(.2 * r, .012, 6, 12), { pos: [0, .9 * h, 0], rot: [Math.PI / 2, 0, 0], rgb: [.6, .5, .35] });
  return s.fin();
}

function canastaPro(p) {
  const { r, h } = p, llen = Math.max(0, Math.min(1, p.llenado)), s = pNuevo(), R = rng(Math.round(r * 1000 + h * 100 + llen * 50)), a = s.add;
  a('mimbre', LA([[0, 0], [.72 * r, 0], [.8 * r, .02 * h], [r, h], [.93 * r, h], [.7 * r, .08 * h], [0, .05 * h]], 20), { uvEsc: [2 * Math.PI * r / .35, h / .35] });
  a('mimbre', new THREE.TorusGeometry(r * .97, .014, 6, 20), { pos: [0, h, 0], rot: [Math.PI / 2, 0, 0], uvEsc: [3, .3] });
  a('mimbre', new THREE.TorusGeometry(r * .97, .012, 6, 18, Math.PI), { pos: [0, h, 0], uvEsc: [3, .3] });
  if (p.fruta >= .5 && llen > .05) {
    const rs = .03, ymax = h * .92 + .02, cap = (r * .78) * (r * .78) / (rs * rs * 1.3) * Math.max(1, (ymax - .05 * h) / (rs * 1.55));
    apilar(a, R, { rs, n: Math.min(70, Math.round(llen * cap)), ymax, x0: -r * .75, x1: r * .75, z0: -r * .75, z1: r * .75, y0: .05 * h + .01, en: (x, z, q) => Math.hypot(x, z) <= r * .78 - q * .3, fruta: Math.floor(R() * 3) });
  }
  return s.fin();
}

function carretaPro(p) {
  const { w, l } = p, s = pNuevo(), a = s.add, y0 = .6, wy = .42, wz = -.1;
  a('mad', RB(w, .04, l, .006), { pos: [0, y0, 0], eje: 2 });
  [-1, 1].forEach(x => a('mad', RB(.03, .28, l, .005), { pos: [x * (w / 2 - .015), y0 + .16, 0], eje: 2 }));
  a('mad', RB(w, .28, .03, .005), { pos: [0, y0 + .16, -l / 2 + .015], eje: 0 });
  a('mad', RB(w, .14, .03, .005), { pos: [0, y0 + .09, l / 2 - .015], eje: 0 });
  [-1, 1].forEach(x => a('mad', RB(.06, .06, l + .9, .008), { pos: [x * (w / 2 - .1), y0 - .05, .45], eje: 2 }));
  a('fe', new THREE.CylinderGeometry(.025, .025, w + .18, 8), { pos: [0, wy, wz], rot: [0, 0, Math.PI / 2] });
  [-1, 1].forEach(x => {
    const X = x * (w / 2 + .06);
    a('mad', new THREE.TorusGeometry(.38, .035, 8, 24), { pos: [X, wy, wz], rot: [0, Math.PI / 2, 0], eje: 1 });
    a('fe', new THREE.TorusGeometry(.415, .008, 6, 24), { pos: [X, wy, wz], rot: [0, Math.PI / 2, 0] });
    a('mad', new THREE.CylinderGeometry(.06, .06, .08, 10), { pos: [X, wy, wz], rot: [0, 0, Math.PI / 2], eje: 0 });
    for (let k = 0; k < 10; k++) { const an = k / 10 * Math.PI * 2; a('mad', RB(.03, .34, .03, .006), { pos: [X, wy + Math.cos(an) * .2, wz + Math.sin(an) * .2], rot: [an, 0, 0], eje: 1 }); }
  });
  return s.fin();
}

/* ================= establo ================= */
function pesebrePro(p) {
  const { w, d, h } = p, s = pNuevo(), R = rng(9), a = s.add, yb = h - .22;
  [-1, 1].forEach(x => [-1, 1].forEach(z => a('mad', RB(.07, h - .02, .07, .01), { pos: [x * (w / 2 - .05), (h - .02) / 2, z * (d / 2 - .05)], eje: 1 })));
  a('mad', RB(w, .03, d, .005), { pos: [0, yb, 0], eje: 0 });
  [-1, 1].forEach(z => a('mad', RB(w, .24, .03, .005), { pos: [0, yb + .12, z * (d / 2 - .015)], rot: [z * .12, 0, 0], eje: 0 }));
  [-1, 1].forEach(x => a('mad', RB(.03, .24, d - .04, .005), { pos: [x * (w / 2 - .015), yb + .12, 0], eje: 2 }));
  [-1, 1].forEach(x => a('mad', RB(.04, .04, d - .1), { pos: [x * (w / 2 - .05), .22, 0], eje: 2 }));
  for (let k = 0; k < Math.max(3, Math.round(w * 4)); k++) a('paja', new THREE.SphereGeometry(.09, 8, 6), { pos: [(R() - .5) * (w - .2), yb + .1, (R() - .5) * (d - .15)], esc: [1.5, .7, 1.2], tint: .9 + R() * .2, eje: 0 });
  return s.fin();
}

function abrevaderoPro(p) {
  const { w, d, h } = p, s = pNuevo(), a = s.add, t = .07;
  [-1, 1].forEach(x => a('mad', RB(.1, .1, d + .1, .01), { pos: [x * (w / 2 - .2), .05, 0], eje: 2 }));
  a('mad', RB(w - .02, .05, d - .02, .005), { pos: [0, .125, 0], eje: 0 });
  [-1, 1].forEach(z => a('mad', RB(w, h - .1, t, .008), { pos: [0, .1 + (h - .1) / 2, z * (d / 2 - t / 2)], eje: 0 }));
  [-1, 1].forEach(x => a('mad', RB(t, h - .1, d - 2 * t, .008), { pos: [x * (w / 2 - t / 2), .1 + (h - .1) / 2, 0], eje: 1 }));
  [-.3, .3].forEach(f => a('fe', RB(.03, h + .012, d + .02, .004, 1), { pos: [f * w, (h + .012) / 2 + .02, 0] }));
  a('agua', new THREE.BoxGeometry(w - 2 * t - .02, .01, d - 2 * t - .02), { pos: [0, h - .14, 0] });
  return s.fin();
}

function fardoPro(p) {
  const { w, h, d } = p, s = pNuevo(), R = rng(Math.round(w * 100 + h * 10)), a = s.add;
  a('paja', RB(w, h, d, .02, 3), { eje: 0, pos: [0, h / 2, 0], tint: .9 + R() * .2 });
  [-.28, .28].forEach(f => a('tela', RB(.016, h + .014, d + .014, .004, 1), { pos: [f * w, h / 2, 0], rgb: [.8, .65, .45] }));
  for (let i = 0; i < 6; i++) a('paja', new THREE.CylinderGeometry(.004, .004, .18 + R() * .12, 4), { pos: [(R() - .5) * w, h + .003, (R() - .5) * d], rot: [Math.PI / 2, 0, R() * 3], eje: 0 });
  return s.fin();
}

function horcaPro(p) {
  const { h } = p, s = pNuevo(), a = s.add, th = -.14, c = Math.cos(th), sn = Math.sin(th), zo = Math.abs(sn) * h + .03;
  a('mad', new THREE.CylinderGeometry(.016, .02, h, 8), { pos: [0, c * h / 2, sn * h / 2 + zo], rot: [th, 0, 0], eje: 1 });
  const hy = c * h, hz = sn * h + zo;
  a('fe', RB(.2, .022, .022, .005, 1), { pos: [0, hy, hz], rot: [th, 0, 0] });
  [-.09, 0, .09].forEach(x => a('fe', new THREE.CylinderGeometry(.005, .006, .24, 6), { pos: [x, hy + c * .12, hz + sn * .12], rot: [th, 0, 0] }));
  return s.fin();
}

function cuboPro(p) {
  const { r, h } = p, s = pNuevo(), a = s.add;
  a('mad', LA([[0, 0], [.78 * r, 0], [r, h], [.9 * r, h], [.72 * r, .1 * h], [0, .1 * h]], 18), { uvEsc: [2 * Math.PI * r / .5, h / .5] });
  [.25, .75].forEach(f => { const rr = .78 * r + (r - .78 * r) * f + .004; a('fe', new THREE.TorusGeometry(rr, .007, 6, 18), { pos: [0, f * h, 0], rot: [Math.PI / 2, 0, 0] }); });
  a('fe', new THREE.TorusGeometry(r * .95, .007, 6, 16, Math.PI), { pos: [0, h, 0] });
  return s.fin();
}

function posteAmarrePro(p) {
  const { h } = p, s = pNuevo(), a = s.add;
  a('mad', RB(.12, h, .12, .015), { pos: [0, h / 2, 0], eje: 1 });
  a('mad', new THREE.SphereGeometry(.075, 10, 8), { pos: [0, h, 0], eje: 1 });
  a('fe', RB(.05, .06, .012, .004, 1), { pos: [0, h * .7 + .05, .064] });
  a('fe', new THREE.TorusGeometry(.05, .008, 6, 14), { pos: [0, h * .7, .08] });
  return s.fin();
}

/* ================= registro ================= */
const DEFS = {
  mesa: { f: mesaPro },
  banca: { f: bancoPro, params: { w: [.6, 3.5, 1.5, .05], d: [.2, .5, .3, .02], h: [.3, .6, .46, .02], resp: [0, 1, 0, 1] } },
  barril: { f: barrilPro },
  caja: { f: cajaPro },
  puesto: { nombre: 'Puesto de mercado', f: puestoPro, params: { w: [1.4, 4, 2.4, .1], d: [.8, 1.6, 1.1, .05], h: [.8, 1.1, .95, .02], H: [2, 3, 2.5, .05], tono: [0, 2, 0, 1] } },
  cajon_fruta: { nombre: 'Cajón de fruta', f: cajonFrutaPro, params: { w: [.3, .8, .5, .02], d: [.25, .5, .35, .02], h: [.12, .3, .18, .01], fruta: [0, 3, 3, 1], llenado: [0, 1, .75, .05] } },
  saco: { nombre: 'Saco', f: sacoPro, params: { r: [.15, .3, .22, .01], h: [.4, 1, .7, .02] } },
  canasta: { nombre: 'Canasta', f: canastaPro, params: { r: [.15, .4, .25, .01], h: [.15, .4, .25, .01], fruta: [0, 1, 1, 1], llenado: [0, 1, .75, .05] } },
  carreta: { nombre: 'Carreta de mano', f: carretaPro, params: { w: [.8, 1.4, 1.1, .05], l: [1.2, 2.4, 1.8, .05] } },
  pesebre: { nombre: 'Pesebre', f: pesebrePro, params: { w: [.8, 3, 1.6, .05], d: [.3, .6, .45, .02], h: [.4, .9, .7, .02] } },
  abrevadero: { nombre: 'Abrevadero', f: abrevaderoPro, params: { w: [1, 3.5, 2, .05], d: [.4, .8, .55, .02], h: [.4, .8, .6, .02] } },
  fardo: { nombre: 'Fardo de heno', f: fardoPro, params: { w: [.6, 1.2, .9, .02], h: [.3, .6, .4, .02], d: [.3, .6, .45, .02] } },
  horca: { nombre: 'Horca', f: horcaPro, params: { h: [1.2, 2, 1.7, .05] }, ancla: 'borde' },
  cubo: { nombre: 'Cubo', f: cuboPro, params: { r: [.1, .2, .14, .01], h: [.18, .4, .28, .01] } },
  poste_amarre: { nombre: 'Poste de amarre', f: posteAmarrePro, params: { h: [.9, 1.6, 1.2, .05] } },
};
const HUELLAS_PRO = {
  banca: p => [p.w, p.d], puesto: p => [p.w, p.d + .7], cajon_fruta: p => [p.w, p.d], saco: p => [p.r * 2, p.r * 2], canasta: p => [p.r * 2, p.r * 2],
  carreta: p => [p.w + .3, p.l + 1.0], pesebre: p => [p.w, p.d], abrevadero: p => [p.w, p.d], fardo: p => [p.w, p.d], horca: () => [.5, .5], cubo: p => [p.r * 2, p.r * 2], poste_amarre: () => [.2, .2],
};
export const TIPOS_PRO = Object.keys(DEFS);

export function registrarPro() {
  for (const k in DEFS) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS[k]);
  Object.assign(HUELLA, HUELLAS_PRO);
  Object.assign(ETIQUETAS, { H: 'Alto toldo', tono: 'Color toldo', fruta: 'Fruta (0-3, 3 = mezcla)', resp: 'Respaldo (0/1)', l: 'Largo', llenado: 'Llenado' });
}

/* piezas para otros módulos de objetos */
export { pNuevo, RB, LA };
