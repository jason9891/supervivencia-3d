/* objetos.js — objetos medievales paramétricos + poblador de salas.
 *
 *   import { crearObjeto, poblar, colocar, CATALOGO, setVariante } from './objetos.js';
 *
 *   const mesa = crearObjeto('mesa', { w: 2.4, d: 0.9 });   // cualquier tamaño dentro de los rangos
 *   scene.add(mesa.root);
 *
 *   const r = poblar(sala, pedidos, { puertas, libres, semilla: 3 });
 *   scene.add(r.root);  // en el bucle: r.anim(tiempo)
 *
 * Todo se dibuja con código (sin imágenes). Un objeto devuelve { root, anim(t), anchor }:
 * anchor es el punto de la llama (o null) por si se quiere asignarle una luz real.
 * Origen de cada objeto: centro de su huella, apoyado en el suelo. Frente = +z, espalda = -z.
 */
import * as THREE from 'three';

/* ================= utilidades ================= */
export const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const vnoise = (r, n) => { const a = Array.from({ length: n }, () => r()); return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return a[((i % n) + n) % n] * (1 - u) + a[(((i + 1) % n) + n) % n] * u; }; };
export const mixc = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';
export function canvasTex(S, draw) {
  const c = document.createElement('canvas'); c.width = S; c.height = S; draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const TC = {};

/* UV en metros para cajas */
function uvm(geo) {
  const p = geo.parameters; if (!p || p.width === undefined || p.depth === undefined) return;
  const S = [[p.depth, p.height], [p.depth, p.height], [p.width, p.depth], [p.width, p.depth], [p.width, p.height], [p.width, p.height]], uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * S[f][0], uv.getY(k) * S[f][1]); }
  uv.needsUpdate = true;
}

/* ================= texturas por código ================= */
export const PALETAS = [
  { n: 'Roble oscuro', dark: [66, 43, 24], light: [112, 78, 45], vein: '28,16,8' },
  { n: 'Pino claro', dark: [134, 101, 62], light: [176, 139, 92], vein: '72,48,22' },
  { n: 'Madera vieja gris', dark: [80, 74, 66], light: [126, 118, 106], vein: '38,34,30' }];
const PAL = PALETAS;
let V = 0;
export function setVariante(i) { V = ((i % PAL.length) + PAL.length) % PAL.length; return PAL[V].n; }
export const getVariante = () => V;

function woodTex(v, rx, ry) {
  const key = 'w' + v + '_' + rx + '_' + ry; if (TC[key]) return TC[key]; const P = PAL[v];
  const t = canvasTex(256, (g, S) => {
    const r = rng(11 + v), n1 = vnoise(r, 32), n2 = vnoise(r, 64);
    for (let x = 0; x < S; x++) { const k = n1(x * .09) * .6 + n2(x * .4) * .4; g.fillStyle = mixc(P.dark, P.light, k); g.fillRect(x, 0, 1, S); }
    g.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const x0 = r() * S, amp = 1 + r() * 3, f = .02 + r() * .04, ph = r() * 6.3; g.strokeStyle = 'rgba(' + P.vein + ',' + (.1 + r() * .25) + ')';
      for (const o of [-S, 0, S]) { g.beginPath(); for (let y = 0; y <= S; y += 8) { const x = x0 + o + Math.sin(y * f + ph) * amp; if (y) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    }
    for (let i = 0; i < 3; i++) {
      const x = r() * S, y = r() * S, gr = g.createRadialGradient(x, y, 1, x, y, 10 + r() * 8); gr.addColorStop(0, 'rgba(' + P.vein + ',.55)'); gr.addColorStop(1, 'rgba(' + P.vein + ',0)');
      g.save(); g.translate(x, y); g.scale(.55, 1.5); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - 30, y - 30, 60, 60); g.restore();
    }
  });
  t.repeat.set(rx, ry); return TC[key] = t;
}
export function ironTex() {
  if (TC.iron) return TC.iron;
  return TC.iron = canvasTex(256, (g, S) => {
    const r = rng(5); g.fillStyle = '#3c3c40'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '120,120,125') + ',' + r() * .18 + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 9; i++) { const x = r() * S, y = r() * S, R = 14 + r() * 26, gr = g.createRadialGradient(x, y, 1, x, y, R); gr.addColorStop(0, 'rgba(120,62,28,.55)'); gr.addColorStop(1, 'rgba(120,62,28,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
  });
}
export function clothTex() {
  if (TC.cloth) return TC.cloth;
  return TC.cloth = canvasTex(256, (g, S) => {
    const r = rng(9); g.fillStyle = '#9a8a6a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 3) { g.fillStyle = 'rgba(40,28,14,' + (.1 + r() * .18) + ')'; g.fillRect(0, i, S, 1); g.fillStyle = 'rgba(255,240,200,' + (.04 + r() * .1) + ')'; g.fillRect(i, 0, 1, S); }
    for (let i = 0; i < 1200; i++) { g.fillStyle = 'rgba(30,20,10,' + r() * .2 + ')'; g.fillRect(r() * S, r() * S, 2, 1); }
  });
}
export function stoneTex() {
  if (TC.stone) return TC.stone;
  return TC.stone = canvasTex(256, (g, S) => {
    const r = rng(3); g.fillStyle = '#6a6864'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 7000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '200,200,195') + ',' + r() * .14 + ')'; const s = 1 + r() * 3; g.fillRect(r() * S, r() * S, s, s); }
    g.strokeStyle = 'rgba(20,18,16,.45)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (r() - .5) * 28; y += (r() - .2) * 22; g.lineTo(x, y); } g.stroke(); }
  });
}
function llamaTex() {
  if (TC.llama) return TC.llama;
  return TC.llama = canvasTex(128, g => {
    const gota = (s, col) => {
      g.save(); g.translate(64, 170); g.scale(s, s); g.translate(-64, -170); g.beginPath(); g.moveTo(64, 6);
      g.bezierCurveTo(78, 70, 118, 120, 118, 170); g.bezierCurveTo(118, 225, 92, 250, 64, 250); g.bezierCurveTo(36, 250, 10, 225, 10, 170); g.bezierCurveTo(10, 120, 50, 70, 64, 6);
      g.closePath(); g.fillStyle = col; g.fill(); g.restore();
    };
    g.canvas.height = 256; g.clearRect(0, 0, 128, 256);
    [[1, 'rgba(255,90,10,.16)'], [.88, 'rgba(255,110,20,.22)'], [.74, 'rgba(255,150,40,.3)'], [.58, 'rgba(255,200,90,.4)'], [.4, 'rgba(255,235,170,.6)'], [.22, 'rgba(255,255,235,.85)']].forEach(a => gota(a[0], a[1]));
  });
}
const FL = () => { const t = llamaTex(); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };

/* ================= materiales y piezas ================= */
const M = o => new THREE.MeshStandardMaterial(o);
const W = (rx = 1.25, ry = 1.25) => M({ map: woodTex(V, rx, ry), roughness: .88 });
const FE = () => M({ map: ironTex(), roughness: .55, metalness: .35, side: THREE.DoubleSide });
const TE = (c = 0xffffff) => M({ map: clothTex(), color: c, roughness: 1 });
const PI = () => M({ map: stoneTex(), roughness: .95 });
function box(w, h, d, x, y, z, mat, par) { const g = new THREE.BoxGeometry(w, h, d); uvm(g); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); par.add(m); return m; }
function cil(rt, rb, h, x, y, z, mat, par, seg = 14) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); par.add(m); return m; }
function lathe(pts, mat, par, seg = 24) { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), mat); par.add(m); return m; }
function toro(R, r, x, y, z, mat, par, rx = Math.PI / 2) { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 24), mat); m.position.set(x, y, z); m.rotation.x = rx; par.add(m); return m; }
export function materialPiedra() { return PI(); }

/* ================= fuego: llama en capas + chispas ================= */
function mkFuego(esc, brasas) {
  const g = new THREE.Group(), sp = [];
  [[.20, .42, 0xff6a10, .85], [.14, .34, 0xffa63a, .9], [.07, .2, 0xfff0b8, 1]].forEach(([w, h, c, o], i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: FL(), color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o }));
    s.center.set(.5, .08); s.userData = { w: w * esc, h: h * esc, ph: i * 2.1 }; s.scale.set(w * esc, h * esc, 1); g.add(s); sp.push(s);
  });
  const N = brasas || 0; let pts = null, pos = null; const fase = [];
  if (N) {
    pos = new Float32Array(N * 3); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa040, size: .02 * Math.max(1, esc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    pts.frustumCulled = false; g.add(pts); for (let i = 0; i < N; i++) fase.push(Math.random());
  }
  const upd = t => {
    sp.forEach(s => { const u = s.userData, f = Math.sin(t * 13 + u.ph) * .5 + Math.sin(t * 23 + u.ph * 1.7) * .5; s.scale.set(u.w * (1 + .07 * f), u.h * (1 + .16 * f + .06 * Math.sin(t * 5 + u.ph)), 1); s.material.rotation = .09 * Math.sin(t * 6.5 + u.ph); });
    if (pts) { for (let i = 0; i < N; i++) { const l = (t * .45 + fase[i]) % 1; pos[i * 3] = Math.sin(t * 2.7 + i * 1.9) * .05 * l * esc; pos[i * 3 + 1] = .05 * esc + l * .7 * esc; pos[i * 3 + 2] = Math.cos(t * 2.3 + i * 1.3) * .05 * l * esc; } pts.geometry.attributes.position.needsUpdate = true; }
  };
  return { g, upd };
}

/* ================= OBJETOS ================= */
function buildTorch() {
  const root = new THREE.Group(), h = new THREE.Group(); root.add(h);
  const mw = W(1, 3), fe = FE();
  lathe([[.026, 0], [.03, .1], [.035, .3], [.04, .38], [.049, .42], [.04, .46], [.044, .6], [.047, .8], [.05, .9]], mw, h, 16);
  lathe([[.05, .84], [.058, .88], [.07, .95], [.082, 1.0], [.078, 1.0], [.066, .95], [.05, .9]], fe, h, 20);
  toro(.07, .007, 0, .93, 0, fe, h);
  for (let i = 0; i < 5; i++) { const ga = new THREE.Group(); ga.rotation.y = i / 5 * Math.PI * 2; h.add(ga); const p = box(.014, .2, .01, .082, 1.08, 0, fe, ga); p.rotation.z = -.22; }
  const tela = TE(0x5e4c3a);
  lathe([[.0, .96], [.06, .97], [.078, 1.02], [.095, 1.1], [.092, 1.17], [.074, 1.23], [.04, 1.26], [0, 1.268]], tela, h, 20);
  [[.08, 1.03], [.094, 1.1], [.088, 1.16], [.062, 1.22]].forEach(a => toro(a[0] + .004, .006, 0, a[1], 0, M({ color: 0xb39d73, roughness: 1 }), h));
  const c = new THREE.Mesh(new THREE.CircleGeometry(.045, 14), M({ color: 0x14100c, emissive: 0xff4a00, emissiveIntensity: .8, roughness: 1 })); c.rotation.x = -Math.PI / 2; c.position.y = 1.262; h.add(c);
  const f = mkFuego(1, 14); f.g.position.y = 1.24; h.add(f.g);
  const anchor = new THREE.Object3D(); anchor.position.y = 1.32; h.add(anchor);
  return { root, anim: f.upd, anchor };
}

function buildWallTorch(p) {
  const root = new THREE.Group(), fe = FE();
  if (p.bloque) box(.9, 1.5, .26, 0, .75, -.13, PI(), root);
  box(.14, .24, .02, 0, .74, .01, fe, root);
  [[-.04, .82], [.04, .82], [-.04, .66], [.04, .66]].forEach(q => { const r = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), fe); r.position.set(q[0], q[1], .03); root.add(r); });
  box(.03, .03, .34, 0, .74, .18, fe, root);
  const piv = new THREE.Group(); piv.position.set(0, .74, .36); piv.rotation.x = .3; root.add(piv);
  toro(.058, .011, 0, 0, 0, fe, piv);
  const t = buildTorch(); t.root.position.set(0, -.5, 0); piv.add(t.root);
  box(.03, .03, .2, 0, .4, .1, fe, root);
  return { root, anim: t.anim, anchor: t.anchor };
}

export function buildCandle(esc = 1, par) {
  const g = par || new THREE.Group(), cera = M({ color: 0xe8dcbc, roughness: .55 });
  lathe([[0, 0], [.021, 0], [.022, .03], [.019, .15], [.015, .17], [.004, .172]].map(q => [q[0] * esc, q[1] * esc]), cera, g, 14);
  const d = new THREE.Mesh(new THREE.SphereGeometry(.007 * esc, 8, 6), cera); d.scale.set(1, 2.6, 1); d.position.set(.019 * esc, .12 * esc, 0); g.add(d);
  cil(.0015 * esc, .0015 * esc, .02 * esc, 0, .182 * esc, 0, M({ color: 0x1a1410 }), g, 5);
  const f = mkFuego(.16 * esc, 0); f.g.position.y = .186 * esc; g.add(f.g);
  const a = new THREE.Object3D(); a.position.y = .22 * esc; g.add(a);
  return { root: g, anim: f.upd, anchor: a };
}
function buildVela(p) { const b = new THREE.Group(), c = buildCandle(p.esc); b.add(c.root); return { root: b, anim: c.anim, anchor: c.anchor }; }

function buildCandelabro() {
  const root = new THREE.Group(), fe = FE(), an = [];
  lathe([[0, 0], [.12, 0], [.13, .02], [.07, .06], [.035, .12], [.03, .4], [.045, .43], [.03, .46], [.028, .6]], fe, root, 20);
  const ux = [-.26, 0, .26], uy = [.78, .86, .78];
  ux.forEach((x, i) => {
    const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .55, 0), new THREE.Vector3(x * .45, .5, 0), new THREE.Vector3(x, .58, 0), new THREE.Vector3(x, uy[i] - .1, 0)]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(cur, 16, .011, 6, false), fe));
    lathe([[.0, uy[i] - .1], [.03, uy[i] - .1], [.036, uy[i] - .07], [.03, uy[i] - .07]], fe, root, 12).position.x = x;
    const c = buildCandle(1.3); c.root.position.set(x, uy[i] - .09, 0); root.add(c.root); an.push(c);
  });
  return { root, anim: t => an.forEach((c, i) => c.anim(t + i * .7)), anchor: an[1].anchor };
}

function buildMesa(p) {
  const { w, d, h } = p, root = new THREE.Group(), wd = W();
  const lw = Math.max(.06, Math.min(.1, .05 + .012 * w)), ins = .04, n = Math.max(2, Math.round(d / .2)), pw = d / n;
  for (let i = 0; i < n; i++) { const t = box(w, .05, pw - .004, 0, h - .025 + (i % 2) * .003, -d / 2 + pw * (i + .5), wd, root); t.rotation.y = (i - n / 2) * .002; }
  const lx = w / 2 - ins - lw / 2, lz = d / 2 - ins - lw / 2, lh = h - .05;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => box(lw, lh, lw, s[0] * lx, lh / 2, s[1] * lz, wd, root));
  const inX = w - 2 * (ins + lw), inZ = d - 2 * (ins + lw);
  [-1, 1].forEach(s => {
    box(inX, .08, .04, 0, lh - .05, s * lz, wd, root);
    box(.04, .08, inZ, s * lx, lh - .05, 0, wd, root);
    box(inX, .04, .035, 0, Math.min(.25, lh * .3), s * lz, wd, root);
  });
  if (p.vela) {
    const c = buildCandle(1.3); c.root.position.set(w * .2, h, d * .05); root.add(c.root);
    const j = new THREE.Group(); lathe([[0, 0], [.06, 0], [.08, .06], [.07, .16], [.04, .2], [.045, .23], [.04, .23]], M({ color: 0x7a4a2c, roughness: .7, side: THREE.DoubleSide }), j, 16); j.position.set(-w * .25, h, -d * .12); root.add(j);
    return { root, anim: c.anim, anchor: c.anchor };
  }
  return { root, anim: () => { }, anchor: null };
}

function buildSilla(p) {
  const { w, d, h } = p, root = new THREE.Group(), wd = W(), sh = h * .48, hx = w / 2 - .03, hz = d / 2 - .03;
  box(w, .045, d, 0, sh, 0, wd, root);
  [[-1, 1], [1, 1]].forEach(s => box(.04, sh - .02, .04, s[0] * hx, (sh - .02) / 2, hz, wd, root));
  [-1, 1].forEach(s => box(.04, h, .04, s * hx, h / 2, -hz, wd, root));
  box(w, .07, .03, 0, h - .05, -hz, wd, root);
  const hs = h - sh - .17;
  [-.22, .22].forEach(f => box(.05, hs, .02, f * w, sh + .05 + hs / 2, -hz, wd, root));
  [-hz, hz].forEach(z => box(w - .06, .025, .025, 0, sh * .6, z, wd, root));
  box(.025, .025, d - .06, -hx, sh * .6, 0, wd, root); box(.025, .025, d - .06, hx, sh * .6, 0, wd, root);
  return { root, anim: () => { }, anchor: null };
}

function buildBanca(p) {
  const { w, d, h } = p, root = new THREE.Group(), wd = W();
  box(w, .05, d, 0, h - .025, 0, wd, root);
  [-1, 1].forEach(s => { box(.05, h - .05, d, s * (w / 2 - .05), (h - .05) / 2, 0, wd, root); });
  box(w - .15, .04, .05, 0, h * .45, 0, wd, root);
  return { root, anim: () => { }, anchor: null };
}

function buildBarril(p) {
  const { r, h } = p, root = new THREE.Group(), w = W(3, 1), fe = FE(), kx = r / .335, ky = h / .9;
  lathe([[0, 0], [.25, 0], [.29, .15], [.335, .45], [.29, .75], [.25, .9], [0, .9]].map(q => [q[0] * kx, q[1] * ky]), w, root, 24);
  [[.15, .29], [.33, .332], [.6, .332], [.77, .285]].forEach(a => toro(a[1] * kx + .004, .014, 0, a[0] * ky, 0, fe, root));
  const l = new THREE.Mesh(new THREE.CircleGeometry(.245 * kx, 20), W(1, 1)); l.rotation.x = -Math.PI / 2; l.position.y = h; root.add(l);
  return { root, anim: () => { }, anchor: null };
}

function buildCaja(p) {
  const { w, h, d } = p, root = new THREE.Group(), wd = W(), fe = FE();
  box(w - .02, h, d - .02, 0, h / 2, 0, wd, root);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => box(.05, h + .02, .05, s[0] * (w / 2 - .025), (h + .02) / 2, s[1] * (d / 2 - .025), wd, root));
  box(w + .02, .04, d + .02, 0, h + .02, 0, wd, root);
  [-.23, .23].forEach(f => box(.05, .02, d + .02, f * w, h + .045, 0, fe, root));
  box(.04, .08, .01, 0, h * .85, d / 2 + .005, fe, root);
  return { root, anim: () => { }, anchor: null };
}

function buildEstante(p) {
  const { w, h, d } = p, root = new THREE.Group(), wd = W();
  [-1, 1].forEach(s => box(.05, h, d, s * (w / 2 - .025), h / 2, 0, wd, root));
  const n = Math.max(2, Math.round(h / .55)), ys = [];
  for (let i = 0; i < n; i++) { const y = .15 + i * (h - .17) / (n - 1); ys.push(y); box(w - .05, .04, d, 0, y, 0, wd, root); }
  box(w - .05, h, .02, 0, h / 2, -d / 2 + .01, wd, root);
  const vi = M({ color: 0x4a6a5a, roughness: .4, transparent: true, opacity: .85 }), ar = M({ color: 0x8a5a3a, roughness: .8 }), r = rng(7 + Math.round(w * 10));
  const cols = [0x6a2a2a, 0x2a3a5a, 0x4a3a22, 0x3a4a2a];
  ys.forEach((y, i) => {
    if (i === n - 1) return;
    const k = Math.floor((w - .2) / .24);
    for (let j = 0; j < k; j++) {
      const x = (j - (k - 1) / 2) * .24;
      if (i % 2 === 0) lathe([[0, 0], [.045, 0], [.05, .08], [.025, .14], [.025, .18], [.03, .19], [0, .19]], r() < .6 ? vi : ar, root, 12).position.set(x, y + .02, 0);
      else box(.05 + r() * .04, .17 + r() * .06, Math.min(.18, d - .06), x, y + .02 + .1, 0, M({ color: cols[Math.floor(r() * 4)], roughness: .9 }), root);
    }
  });
  return { root, anim: () => { }, anchor: null };
}

function buildArmas(p) {
  const { w } = p, root = new THREE.Group(), wd = W(), fe = FE();
  box(w, .06, .4, 0, .03, 0, wd, root);
  [-1, 1].forEach(s => box(.06, 1.3, .06, s * (w / 2 - .05), .68, -.12, wd, root));
  box(w - .1, .05, .05, 0, 1.0, -.12, wd, root); box(w - .1, .05, .05, 0, .5, -.12, wd, root);
  const k = Math.max(1, Math.floor((w - .3) / .3)), lim = w > 1 ? k - 1 : k;
  for (let i = 0; i < lim; i++) {
    const x = (i - (lim - 1) / 2) * .3 - (w > 1 ? .12 : 0), s = new THREE.Group(); s.position.set(x, .06, -.05); s.rotation.z = (i - (lim - 1) / 2) * .04; root.add(s);
    cil(.014, .016, 1.6, 0, .8, 0, W(1, 3), s, 8);
    const b = new THREE.Mesh(new THREE.ConeGeometry(.04, .26, 4), fe); b.scale.set(1, 1, .25); b.position.y = 1.73; s.add(b);
  }
  if (w > 1) {
    const e = new THREE.Group(); e.position.set(w / 2 - .22, .98, -.04); e.rotation.z = Math.PI; root.add(e);
    box(.05, .8, .012, 0, .4, 0, fe, e); box(.22, .03, .03, 0, .02, 0, fe, e); cil(.014, .014, .18, 0, -.08, 0, W(1, 2), e, 8);
  }
  return { root, anim: () => { }, anchor: null };
}

function buildBrasero() {
  const root = new THREE.Group(), fe = FE();
  lathe([[0, .42], [.17, .42], [.29, .54], [.32, .58], [.3, .58], [.16, .47], [0, .47]], fe, root, 20);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .4, l = cil(.016, .02, .48, Math.cos(a) * .17, .24, Math.sin(a) * .17, fe, root, 6); l.rotation.z = Math.cos(a) * .18; l.rotation.x = -Math.sin(a) * .18; }
  toro(.15, .01, 0, .2, 0, fe, root);
  const r = rng(2), br = M({ color: 0x301008, emissive: 0xff4a10, emissiveIntensity: 1.1, roughness: 1 });
  for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(.035 + r() * .02), br); const a = r() * 6.28, d = r() * .2; c.position.set(Math.cos(a) * d, .5 + r() * .03, Math.sin(a) * d); root.add(c); }
  const f = mkFuego(2.1, 24); f.g.position.y = .52; root.add(f.g);
  const a = new THREE.Object3D(); a.position.y = .8; root.add(a);
  return { root, anim: f.upd, anchor: a };
}

function buildAltar(p) {
  const { w, d, h } = p, root = new THREE.Group(), pi = PI(), an = [];
  box(w, .06, d, 0, .03, 0, pi, root);
  box(w * .84, h - .16, d * .78, 0, .06 + (h - .16) / 2, 0, pi, root);
  box(w * 1.1, .1, d * 1.05, 0, h - .05, 0, pi, root);
  box(w * .5, .012, d * 1.05, 0, h + .006, 0, TE(0x8a1c1c), root);
  [-1, 1].forEach(s => { const c = buildCandle(1.3); c.root.position.set(s * w * .34, h + .012, 0); root.add(c.root); an.push(c); });
  lathe([[0, 0], [.05, 0], [.015, .05], [.015, .1], [.05, .14], [.052, .19], [.045, .19], [.04, .15]], M({ color: 0xc9a23a, roughness: .3, metalness: .7, side: THREE.DoubleSide }), root, 14).position.set(0, h + .012, 0);
  return { root, anim: t => an.forEach((c, i) => c.anim(t + i)), anchor: an[0].anchor };
}

/* ================= catálogo ================= */
/* params: nombre: [mínimo, máximo, valor por defecto, paso] */
export const CATALOGO = {
  mesa: { nombre: 'Mesa', f: buildMesa, params: { w: [.6, 4, 1.6, .05], d: [.4, 1.6, .8, .05], h: [.5, 1.1, .76, .02], vela: [0, 1, 1, 1] }, enSala: { vela: 0 } },
  silla: { nombre: 'Silla', f: buildSilla, params: { w: [.3, .6, .42, .02], d: [.3, .6, .42, .02], h: [.6, 1.3, .95, .02] } },
  banca: { nombre: 'Banca', f: buildBanca, params: { w: [.6, 3.5, 1.5, .05], d: [.2, .5, .3, .02], h: [.3, .6, .46, .02] } },
  barril: { nombre: 'Barril', f: buildBarril, params: { r: [.2, .5, .335, .01], h: [.5, 1.3, .9, .02] } },
  caja: { nombre: 'Caja de madera', f: buildCaja, params: { w: [.3, 1.4, .64, .02], h: [.2, .9, .42, .02], d: [.25, .9, .48, .02] } },
  estante: { nombre: 'Estante con frascos', f: buildEstante, params: { w: [.6, 2, 1.05, .05], h: [1, 2.4, 1.7, .05], d: [.2, .5, .3, .02] } },
  armas: { nombre: 'Soporte de armas', f: buildArmas, params: { w: [.6, 2.4, 1.3, .05] } },
  altar: { nombre: 'Altar con velas', f: buildAltar, params: { w: [1, 3, 1.6, .05], d: [.5, 1.2, .7, .05], h: [.7, 1.1, .9, .02] } },
  vela: { nombre: 'Vela', f: buildVela, params: { esc: [.6, 3, 1.4, .1] } },
  candelabro: { nombre: 'Candelabro', f: buildCandelabro, params: {} },
  brasero: { nombre: 'Brasero', f: buildBrasero, params: {} },
  antorcha: { nombre: 'Antorcha de mano', f: buildTorch, params: {} },
  antorcha_pared: { nombre: 'Antorcha de pared', f: buildWallTorch, params: { bloque: [0, 1, 1, 1] }, enSala: { bloque: 0 }, ancla: 'borde', elev: 1.0 },
};
export const ETIQUETAS = { w: 'Ancho', d: 'Fondo', h: 'Alto', r: 'Radio', esc: 'Escala', vela: 'Con vela (0/1)', bloque: 'Bloque de pared (0/1)' };
export const HUELLA = {
  mesa: p => [p.w, p.d], silla: p => [p.w, p.d], banca: p => [p.w, p.d], barril: p => [p.r * 2, p.r * 2], caja: p => [p.w, p.d],
  estante: p => [p.w, p.d], armas: p => [p.w, .4], altar: p => [p.w * 1.1, p.d * 1.05], vela: () => [.12, .12], candelabro: () => [.5, .3],
  brasero: () => [.7, .7], antorcha_pared: () => [.35, .4], antorcha: () => [.2, .2],
};
export const huella = (tipo, p) => HUELLA[tipo](p);

export function paramsPorDefecto(tipo, extra) {
  const p = {}, d = CATALOGO[tipo]; for (const k in d.params) p[k] = d.params[k][2];
  return Object.assign(p, extra || {});
}
export function crearObjeto(tipo, params) {
  const d = CATALOGO[tipo]; if (!d) throw new Error('Objeto desconocido: ' + tipo);
  const p = paramsPorDefecto(tipo, params), o = d.f(p); o.tipo = tipo; o.params = p; return o;
}

/* ================= poblador de salas ================= */
/* sala: {x0,x1,z0,z1,y}  (mismos datos que el editor)
   pedidos: [{ tipo, n, modo:'pared'|'centro'|'esquina', params:{ clave: número | [min,max] }, sillas }]
   opts: { puertas:[{x,z,w}], libres:[{x0,x1,z0,z1}], semilla }
   Devuelve [{ tipo, params, x, y, z, giro }]  (giro en radianes alrededor de Y). Es lógica pura: no usa Three. */
export function colocar(sala, pedidos, opts = {}) {
  const R = rng(opts.semilla || 1), rand = (a, b) => a + (b - a) * R(), T = .2;
  const D = { x0: sala.x0 + T, x1: sala.x1 - T, z0: sala.z0 + T, z1: sala.z1 - T };
  const libres = (opts.libres || []).slice();
  (opts.puertas || []).forEach(d => { const r = (d.w || 1.5) / 2 + .9; libres.push({ x0: d.x - r, x1: d.x + r, z0: d.z - r, z1: d.z + r }); });
  const ocup = [], out = [], EPS = 1e-6;
  const solapa = (a, b, m) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
  const rect = (cx, cz, fw, fd, giro) => { const s = Math.abs(Math.sin(giro)) > .5, hw = (s ? fd : fw) / 2, hd = (s ? fw : fd) / 2; return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd }; };
  for (const ped of pedidos) {
    const tipo = ped.tipo, def = CATALOGO[tipo]; if (!def) continue;
    const resolver = () => {
      const p = Object.assign({}, def.enSala || {});
      for (const k in def.params) {
        const v = ped.params && ped.params[k];
        if (Array.isArray(v)) p[k] = rand(v[0], v[1]); else if (typeof v === 'number') p[k] = v; else if (p[k] === undefined) p[k] = def.params[k][2];
      }
      return p;
    };
    for (let i = 0; i < (ped.n || 1); i++) {
      for (let intento = 0; intento < 80; intento++) {
        const p = resolver(), [fw, fd0] = HUELLA[tipo](p), sill = ped.sillas || 0, fd = fd0 + (sill ? 1.1 : 0), borde = def.ancla === 'borde', modo = ped.modo || 'pared';
        let ox, oz, giro = 0, rc;
        if (modo === 'pared') {
          const w = Math.floor(R() * 4);
          if (w < 2) {
            if (D.x1 - D.x0 < fw) continue;
            const x = rand(D.x0 + fw / 2, D.x1 - fw / 2), nz = w === 0 ? 1 : -1, wz = w === 0 ? D.z0 : D.z1; giro = w === 0 ? 0 : Math.PI;
            ox = x; oz = borde ? wz + nz * .02 : wz + nz * (fd / 2 + .03); rc = rect(x, borde ? wz + nz * fd / 2 : oz, fw, fd, 0);
          } else {
            if (D.z1 - D.z0 < fw) continue;
            const z = rand(D.z0 + fw / 2, D.z1 - fw / 2), nx = w === 2 ? 1 : -1, wx = w === 2 ? D.x0 : D.x1; giro = w === 2 ? Math.PI / 2 : -Math.PI / 2;
            oz = z; ox = borde ? wx + nx * .02 : wx + nx * (fd / 2 + .03); rc = rect(borde ? wx + nx * fd / 2 : ox, z, fw, fd, Math.PI / 2);
          }
        } else if (modo === 'esquina') {
          const c = Math.floor(R() * 4); ox = (c & 1) ? D.x1 - fw / 2 - .03 : D.x0 + fw / 2 + .03; oz = (c & 2) ? D.z1 - fd / 2 - .03 : D.z0 + fd / 2 + .03;
          giro = R() < .5 ? 0 : Math.PI / 2; rc = rect(ox, oz, fw, fd, giro);
        } else {
          giro = R() < .5 ? 0 : Math.PI / 2; const s = Math.abs(Math.sin(giro)) > .5, hw = (s ? fd : fw) / 2 + .8, hd = (s ? fw : fd) / 2 + .8;
          if (D.x1 - D.x0 < 2 * hw || D.z1 - D.z0 < 2 * hd) continue;
          ox = rand(D.x0 + hw, D.x1 - hw); oz = rand(D.z0 + hd, D.z1 - hd); rc = rect(ox, oz, fw, fd, giro);
        }
        if (rc.x0 < D.x0 - EPS || rc.x1 > D.x1 + EPS || rc.z0 < D.z0 - EPS || rc.z1 > D.z1 + EPS) continue;
        if (ocup.some(o => solapa(rc, o, .1)) || libres.some(o => solapa(rc, o, 0))) continue;
        ocup.push(rc);
        const y = (sala.y || 0) + .15 + (def.elev || 0);
        out.push({ tipo, params: p, x: ox, y, z: oz, giro });
        if (sill) {
          const n2 = Math.ceil(sill / 2), sd = CATALOGO.silla.params;
          for (let c = 0; c < sill; c++) {
            const side = c % 2 ? 1 : -1, idx = Math.floor(c / 2), lx = (idx - (n2 - 1) / 2) * Math.min(.6, p.w / n2), lz = side * (p.d / 2 + .28);
            out.push({ tipo: 'silla', params: paramsPorDefecto('silla'), x: ox + lx * Math.cos(giro) + lz * Math.sin(giro), y, z: oz - lx * Math.sin(giro) + lz * Math.cos(giro), giro: giro + (side > 0 ? Math.PI : 0) });
          }
        }
        break;
      }
    }
  }
  return out;
}

export function poblar(sala, pedidos, opts) {
  const col = colocar(sala, pedidos, opts), root = new THREE.Group(), objs = [];
  col.forEach(c => { const o = crearObjeto(c.tipo, c.params); o.root.position.set(c.x, c.y, c.z); o.root.rotation.y = c.giro; root.add(o.root); objs.push(o); });
  return { root, objs, colocados: col, anclas: objs.filter(o => o.anchor), anim: t => objs.forEach((o, i) => o.anim(t + i * .37)) };
}
