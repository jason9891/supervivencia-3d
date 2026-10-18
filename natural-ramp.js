// natural-ramp.js v3 — rampa de campo abierto con recinto cerrado.
//  · Este: pila de peñascos contra el muro de la plaza, hasta el nivel del piso de la plaza.
//  · Oeste y fondo del inicio: acantilado de tierra con estratos y rocas.
//  · Pasto: casi pelado en el sendero, alto a los costados.
// Es visual. Devuelve también `colliders` (muros de contención) para registrarlos con addWall(...c).
// La física de la rampa sigue en addRamp / sampleRampY.
import * as THREE from 'three';

const hh = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return hh(xi, yi) * (1 - u) * (1 - v) + hh(xi + 1, yi) * u * (1 - v) + hh(xi, yi + 1) * (1 - u) * v + hh(xi + 1, yi + 1) * u * v;
}
function fbm(x, y, o = 3) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x *= 2; y *= 2; a *= 0.5; } return s; }
const sst = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

let _s = 1;
const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647;

const uni = { uTime: { value: 0 }, uWind: { value: 1 } };
/** Llamar cada frame con el tiempo en segundos (mueve el pasto con el viento). */
export function updateNaturalRamp(t) { uni.uTime.value = t; }

function bladeGeometry() {
  const w = [0.05, 0.04, 0.022], h = [0, 0.35, 0.7], P = [], N = [];
  for (let i = 0; i < 3; i++) P.push(-w[i], h[i], 0, w[i], h[i], 0);
  P.push(0, 1, 0);
  for (let i = 0; i < 7; i++) N.push(0, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  return g;
}

function cragGeometry(sd, det) {
  const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.7 + 0.6 * vn(x * 1.6 + sd * 7, z * 1.6 + y * 1.6) + 0.12 * vn(x * 5 + sd, z * 5);
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * def: el mismo objeto de addRamp (sx, sz, ex, ez, y0, y1, halfWidth); la rampa va a lo largo de +Z.
 * opts: detail (0.5 para móviles), zMin/zMax (inicio y fin del recinto), halfZone (media anchura del recinto: 6.75).
 */
export function buildNaturalRamp(scene, def, { detail = 1, seed = 7, zMin = 0, zMax = 72, halfZone = 6.75 } = {}) {
  const W = def.halfWidth, HW = halfZone, LEN = def.ez - def.sz, RISE = def.y1 - def.y0;
  const ZS = zMin - def.sz, ZE = zMax - def.sz, CL = 5, CW = 3.2;     // locales: a = x - def.sx, z = z del juego - def.sz
  const baseY = z => def.y0 + (z <= 0 ? 0 : z >= LEN ? RISE : (RISE * z) / LEN);
  const pathA = z => Math.sin(Math.min(1, Math.max(0, z / LEN)) * 6) * 0.8;

  function hY(a, z) {
    const cw = a < -HW ? sst(0, 1, (-HW - a) / CW) * (CL + (fbm(a * 0.3, z * 0.3) - 0.4) * 2.2) : 0;
    const cs = z < ZS ? sst(0, 1, (ZS - z) / CW) * (CL + (fbm(a * 0.3 + 7, z * 0.3) - 0.4) * 2.2) : 0;
    return baseY(z) + Math.max(cw, cs);
  }

  function gcol(a, z, y) {
    const n = fbm(a * 0.2, z * 0.2);
    const cliff = Math.max(a < -HW ? sst(0, 1, (-HW - a) / 0.8) : 0, z < ZS ? sst(0, 1, (ZS - z) / 0.8) : 0);
    let c = mix([0.08, 0.19, 0.06], [0.15, 0.26, 0.07], sst(0.35, 0.65, n));
    c = mix(c, [0.34, 0.28, 0.19], (1 - sst(0.9, 1.9, Math.abs(a - pathA(z)))) * (0.7 + 0.3 * n));
    c = mix(c, [0.3, 0.29, 0.27], sst(LEN - 0.5, LEN + 0.5, z) * (0.8 + 0.3 * n));          // descanso de piedra arriba
    const rise = y - baseY(z), st = 0.5 + 0.5 * Math.sin(y * 2.4 + fbm(a * 0.4, z * 0.4) * 5);
    let e = mix([0.24, 0.17, 0.11], [0.42, 0.36, 0.3], st * 0.7 + 0.3 * fbm(a * 0.5 + 3, z * 0.5));
    e = mix(e, [0.13, 0.23, 0.08], sst(0.8, 1, rise / CL) * 0.75);
    return mix(c, e, Math.min(1, cliff * 1.3));
  }

  const group = new THREE.Group();
  group.position.set(def.sx, 0, def.sz);

  /* ---- terreno ---- */
  {
    const A0 = -13, NS = 40, Z0 = ZS - 5, ST = 0.5, NL = Math.round((ZE - Z0) / ST), P = [], C = [], I = [];
    for (let i = 0; i <= NL; i++) {
      const z = Z0 + i * ST;
      for (let j = 0; j <= NS; j++) {
        const a = A0 + ((HW - A0) * j) / NS, y = hY(a, z), c = gcol(a, z, y);
        P.push(a, y, z); C.push(c[0], c[1], c[2]);
      }
    }
    for (let i = 0; i < NL; i++) for (let j = 0; j < NS; j++) {
      const a = i * (NS + 1) + j, b = a + 1, c = a + NS + 1, d = c + 1;
      I.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    group.add(m);
  }

  /* ---- rocas ---- */
  {
    const rocks = [], rk = (a, y, z, r, det) => rocks.push([a, y, z, r, det]);
    _s = 77 + seed * 13;
    const top = def.y1;                                       // nivel del piso de la plaza
    for (let z = ZS; z < ZE; z += 1.7 + rnd() * 0.6) {         // este: pila hasta el nivel de la plaza
      let y = baseY(z) - 0.3;
      for (let g = 0; g < 7; g++) {
        const r = 1 + rnd() * 0.7, a = HW - 0.8 + (rnd() - 0.5) * 0.6;
        const yc = Math.min(y + r * 0.7, top + 0.15 - r * 0.8);
        rk(a, yc, z + (rnd() - 0.5) * 0.6, r, g === 0 ? 2 : 1);
        y = yc + r * 0.55;
        if (yc + r * 0.8 >= top + 0.1) break;
      }
    }
    for (let z = ZS - 2; z < ZE; z += 1.8 + rnd() * 0.5) { const r = 1.2 + rnd(), a = -HW - 0.3 + (rnd() - 0.5) * 0.8; rk(a, hY(a, z) + r * 0.25, z, r, 2); }
    for (let z = ZS - 2; z < ZE; z += 2.8 + rnd()) { const r = 1 + rnd() * 0.8, a = -HW - 1.8 - rnd() * 1.2; rk(a, hY(a, z) + r * 0.25, z, r, 1); }
    for (let z = ZS - 2; z < ZE; z += 3.4 + rnd() * 1.5) { const r = 0.8 + rnd() * 0.9, a = -HW - 3.8 - rnd() * 1.4; rk(a, hY(a, z) + r * 0.3, z, r, 1); }
    for (let a = -HW; a < HW; a += 1.8 + rnd() * 0.5) { const r = 1.2 + rnd(), z = ZS - 0.3 + (rnd() - 0.5) * 0.8; rk(a, hY(a, z) + r * 0.25, z, r, 2); }
    for (let a = -HW; a < HW; a += 2.8 + rnd()) { const r = 1 + rnd() * 0.8, z = ZS - 1.8 - rnd() * 1.2; rk(a, hY(a, z) + r * 0.25, z, r, 1); }
    for (let a = -HW - 2; a < HW; a += 3.4 + rnd() * 1.5) { const r = 0.8 + rnd() * 0.9, z = ZS - 3.8 - rnd() * 1.4; rk(a, hY(a, z) + r * 0.3, z, r, 1); }
    for (const sg of [-1, 1]) for (let i = 0; i < 24; i++) {
      const z = ZS + rnd() * (ZE - ZS), a = sg * (W - 0.2 + rnd() * 0.7), r = 0.2 + rnd() * 0.35;
      rk(a, hY(a, z) + r * 0.3, z, r, 1);
    }
    const groups = {};
    rocks.forEach((e, i) => { const k = e[4] + '_' + (i % 3); (groups[k] = groups[k] || []).push(e); });
    const d = new THREE.Object3D(), c = new THREE.Color(), j = () => (rnd() - 0.5) * 0.8;
    for (const [k, arr] of Object.entries(groups)) {
      const [det, v] = k.split('_').map(Number);
      const m = new THREE.InstancedMesh(cragGeometry(v, det), new THREE.MeshLambertMaterial({ flatShading: true }), arr.length);
      arr.forEach((e, i) => {
        const [a, y, z, r] = e;
        d.position.set(a, y, z); d.rotation.set(j(), rnd() * 6.28, j());
        d.scale.set(r * (0.9 + 0.3 * rnd()), r * (0.8 + 0.4 * rnd()), r * (0.9 + 0.3 * rnd())); d.updateMatrix();
        m.setMatrixAt(i, d.matrix); m.setColorAt(i, c.setHSL(0.09 + 0.02 * rnd(), 0.06, 0.2 + rnd() * 0.14));
      });
      m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
  }

  /* ---- pasto ---- */
  {
    const gMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    gMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uni.uTime; sh.uniforms.uWind = uni.uWind;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;uniform float uWind;varying float vH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH=position.y;\nvec2 ip=vec2(instanceMatrix[3][0],instanceMatrix[3][2]);\nfloat sw=sin(uTime*1.7+ip.x*.45+ip.y*.35)*.5+sin(uTime*2.9+ip.x*.9)*.25;\nfloat b=position.y*position.y*.3*uWind;\ntransformed.x+=sw*b;transformed.z+=sw*.4*b;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=mix(.35,1.25,vH);');
    };
    _s = 4242 + seed;
    const area = 2 * HW * (ZE - ZS), N = Math.min(120000, Math.round(20 * detail * area * 0.75));
    const mesh = new THREE.InstancedMesh(bladeGeometry(), gMat, N), d = new THREE.Object3D(), col = new THREE.Color(), fp = [];
    let n = 0, guard = 0;
    while (n < N && guard++ < N * 6) {
      const z = ZS + 0.8 + rnd() * (ZE - ZS - 1.3), a = (rnd() * 2 - 1) * HW, dd = Math.abs(a - pathA(z));
      if (rnd() > 0.1 + 0.9 * sst(0.9, 2.2, dd)) continue;
      const cl = fbm(a * 0.22, z * 0.22, 3), z0 = sst(1.2, 3.2, dd), z1 = sst(W - 1.8, W + 0.8, Math.abs(a));
      const h = Math.min(0.95, (0.07 + 0.2 * z0 + 0.7 * z1 * (0.5 + 0.5 * cl)) * (0.75 + 0.5 * rnd())), y = hY(a, z);
      d.position.set(a, y - 0.03, z); d.rotation.set((rnd() - 0.5) * 0.35, rnd() * 6.28, (rnd() - 0.5) * 0.35);
      d.scale.set(0.8 + 0.9 * rnd(), h, 1); d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      mesh.setColorAt(n, col.setHSL(0.2 + 0.1 * cl + rnd() * 0.03, 0.5 + 0.15 * rnd(), 0.2 + 0.18 * cl + rnd() * 0.05));
      if (rnd() < 0.012) fp.push(a, y + h * 0.8, z);
      n++;
    }
    mesh.count = n; mesh.frustumCulled = false; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    const fn = fp.length / 3;
    if (fn) {
      const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshLambertMaterial({}), fn);
      const pal = [[1, 0.98, 0.9], [1, 0.85, 0.3], [0.78, 0.62, 0.95]];
      for (let i = 0; i < fn; i++) {
        d.position.set(fp[i * 3], fp[i * 3 + 1], fp[i * 3 + 2]); d.rotation.set(0, 0, 0); d.scale.setScalar(0.8 + rnd() * 0.8); d.updateMatrix();
        fm.setMatrixAt(i, d.matrix); const p = pal[Math.floor(rnd() * 3)]; fm.setColorAt(i, col.setRGB(p[0], p[1], p[2]));
      }
      fm.frustumCulled = false; group.add(fm);
    }
  }
  scene.add(group);

  /* ---- muros de contención: [minX, maxX, minZ, maxZ, minY, maxY] ---- */
  const x0 = def.sx - HW, x1 = def.sx + HW;
  const colliders = [
    [x0 - 2, def.sx - W, def.sz, def.ez, -5, 30],          // oeste de la rampa
    [def.sx + W, x1 - 0.4, def.sz, def.ez, -5, 30],        // este de la rampa (hasta el muro de la plaza)
    [x0 - 2, x0, zMin - 2, def.sz, -5, 30],                // oeste de la zona de arranque
    [x0 - 2, x1, zMin - 2, zMin, -5, 30],                  // fondo del inicio
    [x0 - 2, x0, def.ez, zMax + 0.4, -5, 30],              // oeste del descanso
  ];
  return { group, colliders, heightAt: (x, z) => hY(x - def.sx, z - def.sz) };
}
