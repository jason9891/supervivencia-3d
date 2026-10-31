/* piedras.js — convierte muros lisos en muros de piedras apiladas.
 *
 *   import { cubrirMuros } from './piedras.js';
 *   const root = construirMapa(scene, json);          // mapa.js (los muros ya vienen marcados)
 *   const piedras = cubrirMuros(root, { tam: 0.9, semilla: 3 });
 *   piedras.quitar();  piedras.poner();                // para comparar con el muro liso
 *
 * Las piedras sobresalen a ambos lados y se superponen, así no se ve una pared plana.
 * El muro original queda dentro como núcleo oscuro (opciones.nucleo: 'oscuro' | 'visible' | 'oculto').
 * Todas las piedras de un mapa se dibujan en solo `variantes` mallas instanciadas (pocas llamadas de dibujo).
 *
 * Opciones: tam (diámetro medio en m, 0.9), semilla, lados (2 o 1), detalle (0 = ligera, 1 = normal),
 *           variantes (4), tono (brillo, 1), maxPiedras (6000), nucleo,
 *           filtro (función opcional: recibe la malla del muro y devuelve true si debe llevar piedras).
 * También se puede usar suelta: crearLote(opts).tramo(ax,az,bx,bz,y0,alto,grosor) ... .cerrar()
 */
import * as THREE from 'three';

const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* Piedra irregular: icosaedro con los vértices desplazados + color por cara
   (arriba con musgo, abajo oscura). Radio base 0.5, así que la escala = diámetro. */
function geoPiedra(seed, detalle) {
  const g = new THREE.IcosahedronGeometry(.5, detalle), a = g.attributes.position.array, n = a.length;
  for (let i = 0; i < n; i += 3) {
    const l = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1, dx = a[i] / l, dy = a[i + 1] / l, dz = a[i + 2] / l;
    const r = Math.sin(dx * 3.7 + seed) * Math.cos(dy * 3.1 + seed * 1.7) + Math.sin(dz * 4.3 + seed * .6) * .6 + Math.sin((dx + dy) * 7.1 + seed) * .25;
    const k = .5 * (1 + r * .15);
    a[i] = dx * k; a[i + 1] = dy * k; a[i + 2] = dz * k;
  }
  const col = new Float32Array(n);
  for (let i = 0; i < n; i += 9) {
    const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2], vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2];
    const nx = uy * vz - uz * vy, ny0 = uz * vx - ux * vz, nz = ux * vy - uy * vx, ny = ny0 / (Math.hypot(nx, ny0, nz) || 1);
    let r, gg, b;
    if (ny > .55) { r = .62; gg = .7; b = .45; }
    else if (ny < -.4) { r = .4; gg = .38; b = .36; }
    else { const t = .72 + ny * .2; r = t; gg = t * .97; b = t * .93; }
    for (let k = 0; k < 3; k++) { col[i + k * 3] = r; col[i + k * 3 + 1] = gg; col[i + k * 3 + 2] = b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function crearLote(opciones = {}) {
  const o = Object.assign({ tam: .9, detalle: 1, semilla: 1, lados: 2, variantes: 4, tono: 1, maxPiedras: 6000 }, opciones);
  const R = rng(o.semilla), geos = [], datos = [];
  for (let v = 0; v < o.variantes; v++) { geos.push(geoPiedra(v * 7.3 + o.semilla, o.detalle)); datos.push([]); }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, roughness: 1 });
  const dummy = new THREE.Object3D();
  let total = 0, truncado = false;

  /* Un tramo recto de muro: de (ax,az) a (bx,bz), base en y0, alto H, grosor T. */
  function tramo(ax, az, bx, bz, y0, H, T) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < .05 || H < .05) return;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    const cols = Math.max(1, Math.round(L / (o.tam * .7)));
    for (let c = 0; c <= cols; c++) {
      const s = Math.max(0, Math.min(L, (c + (c === 0 || c === cols ? 0 : (R() - .5) * .6)) / cols * L));
      const px = ax + ux * s, pz = az + uz * s;
      for (let k = 0; k < o.lados; k++) {
        const lado = o.lados === 1 ? 0 : (k ? 1 : -1), Hc = H * (.9 + .1 * R());
        let y = 0;
        while (y < Hc - .05) {
          if (total >= o.maxPiedras) { truncado = true; return; }
          const sz = Math.min(o.tam * (.55 + R() * .6), Math.max(.25, (Hc - y) * 1.5)), hr = sz * (.62 + R() * .2);
          const lat = lado * (T / 2 - sz * .08) + (R() - .5) * T * .3;
          dummy.position.set(px + nx * lat, y0 + y + hr * .45, pz + nz * lat);
          dummy.rotation.set((R() - .5) * .35, R() * 6.28, (R() - .5) * .35);
          dummy.scale.set(sz * (1 + R() * .35), hr, sz * (1 + R() * .3));
          dummy.updateMatrix();
          const col = new THREE.Color().setHSL(.07 + R() * .07, .06 + R() * .12, Math.min(.9, (.55 + R() * .2) * o.tono));
          datos[Math.floor(R() * o.variantes)].push({ m: dummy.matrix.clone(), c: col });
          total++; y += hr * .8;
        }
      }
    }
  }

  function cerrar() {
    const g = new THREE.Group();
    geos.forEach((geo, v) => {
      const d = datos[v]; if (!d.length) return;
      const im = new THREE.InstancedMesh(geo, mat, d.length);
      d.forEach((e, i) => { im.setMatrixAt(i, e.m); im.setColorAt(i, e.c); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; g.add(im);
    });
    g.name = 'piedras_de_muro';
    return g;
  }
  return { tramo, cerrar, get total() { return total; }, get truncado() { return truncado; } };
}

/* Recorre un mapa construido con mapa.js y cubre de piedras todos los muros (superficie 'muro'). */
export function cubrirMuros(root, opciones = {}) {
  const lote = crearLote(opciones), nucleo = opciones.nucleo || 'oscuro', tocados = [];
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 1 });
  root.traverse(m => {
    if (!m.isMesh || !m.userData || m.userData.superficie !== 'muro') return;
    if (opciones.filtro && !opciones.filtro(m)) return;
    const u = m.userData, L = u.linea, p = m.geometry && m.geometry.parameters;
    if (L && L.points) {
      for (let i = 0; i < L.points.length - 1; i++) lote.tramo(L.points[i].x, L.points[i].z, L.points[i + 1].x, L.points[i + 1].z, L.y, L.height, L.thickness);
    } else if (p && p.width !== undefined && p.depth !== undefined) {
      const q = m.position, y0 = q.y - p.height / 2;
      if (p.width >= p.depth) lote.tramo(q.x - p.width / 2, q.z, q.x + p.width / 2, q.z, y0, p.height, p.depth);
      else lote.tramo(q.x, q.z - p.depth / 2, q.x, q.z + p.depth / 2, y0, p.height, p.width);
    } else return;
    tocados.push({ m, mat: m.material });
    if (nucleo === 'oscuro') m.material = oscuro; else if (nucleo === 'oculto') m.visible = false;
  });
  const grupo = lote.cerrar(); root.add(grupo);
  const aplicar = (si) => {
    grupo.visible = si;
    tocados.forEach(t => { if (nucleo === 'oscuro') t.m.material = si ? oscuro : t.mat; else if (nucleo === 'oculto') t.m.visible = !si; });
  };
  return { grupo, total: lote.total, truncado: lote.truncado, quitar: () => aplicar(false), poner: () => aplicar(true) };
}
