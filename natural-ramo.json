// natural-ramp.js — rampa de campo abierto: ladera de pasto con terraplén, sendero, rocas y hierba.
// Solo visual: la física sigue en addRamp / sampleRampY (el plano central de la rampa no cambia).
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

function grainTexture() {                       // grano fino que se multiplica con el color de vértice
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), d = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 120 + 135 * fbm(x * 0.18, y * 0.18, 3), i = (y * S + x) * 4;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; return t;
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + 0.5 * vn(x * 2 + seed, z * 2 + y * 2);
    p.setXYZ(i, x * k, y * k * 0.7, z * k);
  }
  g.computeVertexNormals(); return g;
}

/**
 * def: el mismo objeto que le pasas a addRamp (sx, sz, ex, ez, y0, y1, halfWidth).
 * opciones: side = ancho del terraplén a cada lado, detail = 0.5 para móviles, groundY = altura del terreno base.
 */
export function buildNaturalRamp(scene, def, { groundY = -0.8, side = 9, detail = 1, seed = 7 } = {}) {
  _s = 1000 + seed * 997;
  const dx = def.ex - def.sx, dz = def.ez - def.sz, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
  const W = def.halfWidth, S = W + side;
  const pos = (t, a) => [def.sx + ux * len * t + px * a, def.sz + uz * len * t + pz * a];
  const pathA = (t) => Math.sin(t * 6) * 0.8;                                  // el sendero serpentea

  const heightAt = (t, a) => {
    const base = def.y0 + (def.y1 - def.y0) * t, ab = Math.abs(a);
    if (ab <= W) return base;                                                  // plano de la rampa: no se toca
    const k = (ab - W) / side, [x, z] = pos(t, a);
    return base + (groundY - base) * sst(0, 1, k) + (fbm(x * 0.15, z * 0.15) - 0.35) * 1.6 * k;
  };

  /* ---- superficie ---- */
  const NL = Math.max(8, Math.round(len)), NS = 40, P = [], C = [], UV = [], I = [];
  const grass = [0.25, 0.42, 0.18], dry = [0.4, 0.38, 0.2], dirt = [0.36, 0.29, 0.2], rock = [0.4, 0.39, 0.36];
  for (let i = 0; i <= NL; i++) {
    const t = i / NL;
    for (let j = 0; j <= NS; j++) {
      const a = -S + (2 * S * j) / NS, [x, z] = pos(t, a), ab = Math.abs(a);
      P.push(x, heightAt(t, a), z); UV.push(x / 4, z / 4);
      const n = fbm(x * 0.2, z * 0.2);
      let c = mix(grass, dry, sst(0.35, 0.65, n));
      const path = 1 - sst(1.2, 2.6, Math.abs(a - pathA(t)));
      c = mix(c, dirt, path * (0.6 + 0.4 * n));
      const slope = sst(0.25, 0.8, (ab - W) / side);
      const patch = sst(0.62, 0.75, fbm(x * 0.35 + 9, z * 0.35)) * (ab > W * 0.6 ? 1 : 0.3);
      c = mix(c, rock, Math.min(1, slope * 0.6 + patch * 0.7));
      C.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < NL; i++) for (let j = 0; j < NS; j++) {
    const a = i * (NS + 1) + j, b = a + 1, c = a + NS + 1, d = c + 1;
    I.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(I); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grainTexture(), roughness: 1 }));
  ground.receiveShadow = true;

  const group = new THREE.Group(); group.add(ground);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const place = () => {                                                        // punto aleatorio sobre la ladera
    const t = rnd(), a = (rnd() * 2 - 1) * S * 0.95;
    return { t, a, x: pos(t, a)[0], z: pos(t, a)[1] };
  };

  /* ---- rocas: 3 formas, instanciadas ---- */
  const nR = Math.round(80 * detail), per = Math.ceil(nR / 3);
  for (let k = 0; k < 3; k++) {
    const mesh = new THREE.InstancedMesh(rockGeometry(k * 5.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), per);
    for (let n = 0; n < per; n++) {
      const t = rnd(), sg = rnd() < 0.5 ? -1 : 1, a = sg * (W * 0.6 + Math.pow(rnd(), 1.2) * (S - W * 0.6) * 0.95);
      const s = Math.abs(a) < W ? 0.12 + rnd() * 0.3 : 0.4 + rnd() * 1.4;      // sobre el camino solo piedras chicas
      const [x, z] = pos(t, a);
      dummy.position.set(x, heightAt(t, a) + s * 0.2, z);
      dummy.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); dummy.scale.setScalar(s);
      dummy.updateMatrix(); mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, col.setHSL(0.1, 0.05, 0.26 + rnd() * 0.16));
    }
    mesh.instanceColor.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }

  /* ---- matas de hierba: 3 conos por mata ---- */
  const nT = Math.round(650 * detail);
  const tg = new THREE.ConeGeometry(0.045, 0.5, 4); tg.translate(0, 0.25, 0);
  const tufts = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), nT * 3);
  let m = 0;
  for (let n = 0; n < nT; n++) {
    let { t, a } = place();
    if (Math.abs(a - pathA(t)) < 1.4) a += (a < pathA(t) ? -1 : 1) * 1.8;     // sin hierba alta sobre el sendero
    for (let q = 0; q < 3; q++) {
      const aa = a + (rnd() - 0.5) * 0.3, [x, z] = pos(t, aa), s = 0.6 + rnd() * 0.9;
      dummy.position.set(x + (rnd() - 0.5) * 0.15, heightAt(t, aa), z + (rnd() - 0.5) * 0.15);
      dummy.rotation.set((rnd() - 0.5) * 0.5, rnd() * 6, (rnd() - 0.5) * 0.5); dummy.scale.set(s, s, s);
      dummy.updateMatrix(); tufts.setMatrixAt(m, dummy.matrix);
      tufts.setColorAt(m++, col.setHSL(0.24 + rnd() * 0.07, 0.45, 0.2 + rnd() * 0.14));
    }
  }
  tufts.instanceColor.needsUpdate = true; group.add(tufts);

  scene.add(group);
  return { group, heightAt };
}
