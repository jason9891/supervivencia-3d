// props-medieval.js — materiales procedurales (sin imágenes) y props medievales oscuros.
// Unidades en metros, Y arriba (igual que map1.js). Poner junto a map1.js.
import * as THREE from 'three';

/* ---------- ruido ---------- */
const hh = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return hh(xi, yi) * (1 - u) * (1 - v) + hh(xi + 1, yi) * u * (1 - v) + hh(xi, yi + 1) * (1 - u) * v + hh(xi + 1, yi + 1) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x *= 2; y *= 2; a *= 0.5; } return s; }
const sst = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// aleatorio con semilla: el mapa sale igual en cada carga
let _s = 12345;
const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647;
const R = (a) => (rnd() - 0.5) * 2 * a;

/* ---------- texturas (canvas) ---------- */
function makeTex(fn, S) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cc = mk(), cb = mk(), gc = cc.getContext('2d'), gb = cb.getContext('2d');
  const dc = gc.createImageData(S, S), db = gb.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [c, h] = fn(x, y, S), i = (y * S + x) * 4;
    dc.data[i] = c[0]; dc.data[i + 1] = c[1]; dc.data[i + 2] = c[2]; dc.data[i + 3] = 255;
    db.data[i] = db.data[i + 1] = db.data[i + 2] = h; db.data[i + 3] = 255;
  }
  gc.putImageData(dc, 0, 0); gb.putImageData(db, 0, 0);
  const map = new THREE.CanvasTexture(cc), bump = new THREE.CanvasTexture(cb);
  if ('colorSpace' in map) map.colorSpace = THREE.SRGBColorSpace; else map.encoding = THREE.sRGBEncoding;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = 4; }
  return { map, bump };
}

const woodFn = (x, y) => {
  const pl = 64, p = Math.floor(y / pl), ly = y % pl, sh = hh(p, 9) * 200, tint = 0.7 + 0.5 * hh(p, 3);
  if (ly < 2 || ly > pl - 3) return [[7, 4, 2], 15];                       // junta entre tablones
  const n = fbm((x + sh) * 0.005, y * 0.07, 4), fib = vn((x + sh) * 0.012, y * 0.8);
  const vein = sst(0.6, 0.72, fbm((x + sh) * 0.003, y * 0.04 + p * 7, 3));
  const kx = hh(p, 5) * 256, d = Math.hypot((x - kx) * 0.7, ly - 32), kn = d < 18 ? 1 - d / 18 : 0;
  const k = kn > 0 ? 0.5 + 0.5 * Math.sin(d * 0.8) : 1;                    // nudo
  const c = mixc([22, 12, 6], [80, 47, 25], (0.5 + 0.4 * n + 0.1 * fib) * tint)
    .map((v) => v * (1 - 0.35 * vein) * (1 - 0.5 * kn * (1 - k)));
  return [c, Math.min(255, n * 170 + fib * 50 + kn * 40)];
};
const ironFn = (x, y) => {
  const n = fbm(x * 0.03, y * 0.03, 5), r = sst(0.48, 0.62, n);
  return [mixc([30, 30, 34], [96, 38, 15], r), n * 255];
};
const stoneFn = (moss) => (x, y, S) => {
  const rh = 64, bw = 96, row = Math.floor(y / rh), off = (row % 2) * 48, bx = Math.floor((x + off) / bw);
  const lx = (x + off) % bw, ly = y % rh, edge = Math.min(lx, bw - lx, ly, rh - ly);
  const gr = fbm(x * 0.03, y * 0.03, 5), tint = 0.65 + 0.6 * hh(bx, row);
  if (edge < 4) return [[12, 12, 12], 20];
  let c = [58, 56, 54].map((v) => v * tint * (0.5 + gr));
  if (moss) c = mixc(c, [22, 34, 12], sst(0.3, 0.42, fbm(x * 0.02, y * 0.02) * (y / S + 0.3)));
  return [c, Math.min(255, 110 + gr * 150 + Math.min(edge, 10) * 4)];
};

/* ---------- materiales ----------
   userData.tile = metros que cubre una repetición de la textura (u, v).
   userData.grain = la veta corre a lo largo de la dimensión larga de la pieza. */
export function createMedievalMaterials({ size = 256, bump = 1 } = {}) {
  const T = { wood: makeTex(woodFn, size), iron: makeTex(ironFn, size), stone: makeTex(stoneFn(false), size), wall: makeTex(stoneFn(true), size) };
  const M = (t, o, tile, grain = false) => {
    const m = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, ...o, bumpScale: (o.bumpScale ?? 1) * bump });
    m.userData.tile = tile; m.userData.grain = grain; return m;
  };
  return {
    wood: M(T.wood, { roughness: 0.85, bumpScale: 1.2 }, [1.6, 0.8], true),
    iron: M(T.iron, { roughness: 0.6, metalness: 0.25, bumpScale: 1.2 }, [1.2, 1.2]),
    stone: M(T.stone, { roughness: 0.6, bumpScale: 3 }, [2.4, 2.4]),
    wall: M(T.wall, { roughness: 0.55, bumpScale: 3 }, [2.4, 2.4]),
  };
}

// UV en escala real: una piedra o un tablón mide lo mismo en una pared de 20 m que en una pata de 0.1 m.
export function worldUV(geo, w, h, d, mat) {
  const tile = mat && mat.userData && mat.userData.tile, uv = geo.attributes.uv;
  if (!tile || !uv || geo.type !== 'BoxGeometry') return;
  const grain = mat.userData.grain, ou = grain ? rnd() * 2 : 0, ov = grain ? rnd() * 2 : 0;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];            // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f], sw = grain && b > a;
    for (let i = 0; i < 4; i++) {
      const j = f * 4 + i, u = uv.getX(j), v = uv.getY(j);
      if (sw) uv.setXY(j, v * b / tile[0] + ou, u * a / tile[1] + ov);
      else uv.setXY(j, u * a / tile[0] + ou, v * b / tile[1] + ov);
    }
  }
  uv.needsUpdate = true;
}

/* ---------- piezas ---------- */
function box(g, w, h, d, x, y, z, m, tilt = 0) {
  const geo = new THREE.BoxGeometry(w, h, d); worldUV(geo, w, h, d, m);
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  if (tilt) o.rotation.set(R(tilt), R(tilt), R(tilt));
  o.castShadow = o.receiveShadow = true; g.add(o); return o;
}
function halfCylX(g, r, len, x, y, z, m) {                                   // medio cilindro, arco hacia arriba
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, false, 0, Math.PI), m);
  o.rotation.z = Math.PI / 2; o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o;
}

export function buildChest(M) {
  const g = new THREE.Group();
  box(g, 1, 0.5, 0.6, 0, 0.25, 0, M.wood, 0.004);
  for (const x of [-0.33, 0.33]) box(g, 0.08, 0.5, 0.64, x, 0.25, 0, M.iron);
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); g.add(lid);   // bisagra en el borde trasero
  halfCylX(lid, 0.3, 1, 0, 0, 0.3, M.wood);
  box(lid, 1, 0.03, 0.6, 0, 0.015, 0.3, M.wood);
  for (const x of [-0.33, 0.33]) halfCylX(lid, 0.32, 0.08, x, 0, 0.3, M.iron);
  box(g, 0.12, 0.14, 0.04, 0, 0.47, 0.33, M.iron);                             // cerradura
  g.userData = { lid, solid: [1.0, 0.6] };
  return g;
}
// 0 = cerrado, 1 = abierto
export function setChestOpen(chest, amount) { chest.userData.lid.rotation.x = -Math.min(1, Math.max(0, amount)) * 1.9; }

export function buildTable(M) {
  const g = new THREE.Group();
  box(g, 1.6, 0.09, 0.8, 0, 0.765, 0, M.wood, 0.006);
  for (const x of [-0.68, 0.68]) for (const z of [-0.28, 0.28]) box(g, 0.12, 0.72, 0.12, x, 0.36, z, M.wood, 0.01);
  for (const z of [-0.28, 0.28]) box(g, 1.3, 0.06, 0.06, 0, 0.25, z, M.wood);
  box(g, 0.06, 0.06, 0.5, 0, 0.25, 0, M.wood);
  g.userData = { solid: [1.6, 0.8] };
  return g;
}

export function buildChair(M) {                                              // respaldo hacia -Z
  const g = new THREE.Group();
  box(g, 0.5, 0.06, 0.5, 0, 0.45, 0, M.wood, 0.008);
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.22, 0.22]) box(g, 0.06, 0.45, 0.06, x, 0.225, z, M.wood, 0.01);
    box(g, 0.06, 0.55, 0.06, x, 0.725, -0.22, M.wood, 0.01);
  }
  for (const y of [0.75, 0.92]) box(g, 0.44, 0.1, 0.04, 0, y, -0.22, M.wood, 0.01);
  g.userData = { solid: [0.5, 0.5] };
  return g;
}

/* ---------- antorcha de pared: el origen es la pared, sale hacia +Z local ---------- */
const torches = [];
const NEW_LIGHTS = parseInt(THREE.REVISION, 10) >= 155;                      // luces físicas: la intensidad cambia de escala
export function buildTorch(M, { light = true } = {}) {
  const g = new THREE.Group();
  box(g, 0.1, 0.1, 0.18, 0, -0.25, 0, M.iron);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 10), M.wood);
  stick.position.set(0, 0, 0.12); stick.rotation.x = -0.25; g.add(stick);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffa545 }));
  flame.scale.set(1, 1.6, 1); flame.position.set(0, 0.3, 0.18); g.add(flame);
  if (light) {
    const base = NEW_LIGHTS ? 25 : 1.6;
    const l = new THREE.PointLight(0xff7a2a, base, 11, 2); l.position.set(0, 0.55, 0.3); g.add(l);
    torches.push({ l, flame, base, ph: rnd() * 10 });
  }
  return g;
}
export function updateTorches(t) {                                           // llamar cada frame con segundos
  for (const o of torches) {
    o.l.intensity = o.base * (1 + 0.15 * Math.sin(t * 13 + o.ph) + 0.12 * Math.sin(t * 7.3 + o.ph));
    o.flame.scale.y = 1.6 + 0.2 * Math.sin(t * 17 + o.ph);
  }
}

/* ---------- colocar en el mapa (y registrar colisión con tu addWall) ---------- */
export function placeProp(scene, g, x, y, z, rotY = 0, addWall = null) {
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  const f = g.userData.solid;
  if (f && addWall) {
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const hw = (f[0] * c + f[1] * s) / 2, hd = (f[0] * s + f[1] * c) / 2;
    addWall(x - hw, x + hw, z - hd, z + hd);
  }
  return g;
}
