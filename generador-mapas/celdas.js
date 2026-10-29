// celdas.js — muros como CELDAS de 10 cm. Lo comparten el editor (dibujo/selección) y el visor 3D (geometría),
// así lo que ves en el plano es exactamente lo que se construye. Script clásico: deja todo en globalThis.Celdas.
(function () {
  const G = 0.1;                 // celda
  const T = 0.4;                 // grosor del muro = 4 celdas, centrado en la línea
  const r1 = (v) => +v.toFixed(1);
  const cellOf = (v) => r1(Math.floor(v / G + 1e-9) * G);
  const key = (x, z) => r1(x) + ',' + r1(z);

  // distancia de un punto a un segmento
  function dSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
  }
  // celdas cuyo centro queda a menos de T/2 del segmento (4 celdas de grosor si va alineado a la cuadrícula)
  function addSeg(map, ax, az, bx, bz, t) {
    const h = (t == null ? T : t) / 2 + 1e-6;
    const x0 = Math.min(ax, bx) - h, x1 = Math.max(ax, bx) + h, z0 = Math.min(az, bz) - h, z1 = Math.max(az, bz) + h;
    for (let x = cellOf(x0); x <= x1; x = r1(x + G)) for (let z = cellOf(z0); z <= z1; z = r1(z + G)) {
      if (dSeg(x + G / 2, z + G / 2, ax, az, bx, bz) <= h) map.set(key(x, z), { x, z });
    }
  }
  // Muro de trazo (polilínea). Los puntos son ORIGEN de cuadro (esquina del cuadro que se eligió).
  // Tramos rectos: banda de 4 celdas centrada en la línea, de cuadro inicial a cuadro final incluidos (extremos al ras, sin salientes).
  // Esquinas: un cuadrado de 4×4 en cada vértice interior. Diagonales: escalonadas.
  function wallCells(w, t) {
    const m = new Map(), p = w.points || [], hh = (t == null ? T : t) / 2;
    const rect = (xa, xb, za, zb) => addRect(m, xa, xb, za, zb);
    const seg = (A, B) => {
      const dx = B.x - A.x, dz = B.z - A.z;
      if (Math.abs(dx) < 1e-6) rect(A.x - hh, A.x + hh, Math.min(A.z, B.z), Math.max(A.z, B.z) + G);
      else if (Math.abs(dz) < 1e-6) rect(Math.min(A.x, B.x), Math.max(A.x, B.x) + G, A.z - hh, A.z + hh);
      else addSeg(m, A.x + G / 2, A.z + G / 2, B.x + G / 2, B.z + G / 2, t);
    };
    const n = p.length, closed = !!w.closed && n >= 3;
    for (let i = 0; i < n - 1; i++) seg(p[i], p[i + 1]);
    if (closed) seg(p[n - 1], p[0]);
    if (n === 1) rect(p[0].x - hh, p[0].x + hh, p[0].z - hh, p[0].z + hh);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      rect(p[i].x - hh, p[i].x + hh, p[i].z - hh, p[i].z + hh);
    }
    return [...m.values()];
  }
  // Rectángulo en celdas [xa,xb) × [za,zb)
  function addRect(map, xa, xb, za, zb) {
    for (let x = cellOf(xa + 1e-6); x < xb - 1e-6; x = r1(x + G)) for (let z = cellOf(za + 1e-6); z < zb - 1e-6; z = r1(z + G)) map.set(key(x, z), { x, z });
  }
  const sub = (list, lo, hi) => {                       // resta [lo,hi] a una lista de intervalos
    const out = [];
    for (const [a, b] of list) {
      if (hi <= a + 1e-6 || lo >= b - 1e-6) { out.push([a, b]); continue; }
      if (lo - a > 1e-6) out.push([a, lo]);
      if (b - hi > 1e-6) out.push([hi, b]);
    }
    return out;
  };
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  // Muros de una sala rectangular cerrada. `others` = otras salas cerradas del mismo nivel (el borde compartido no lleva muro).
  function roomWallCells(r, others) {
    const m = new Map(), ht = T / 2, E = 1e-6;
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1);
    const nb = (o) => ({ x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1), z0: Math.min(o.z0, o.z1), z1: Math.max(o.z0, o.z1) });
    const O = others.map(nb);
    const tX = (xe, side) => O.filter(o => Math.abs((side === 'left' ? o.x1 : o.x0) - xe) < E && ov(z0, z1, o.z0, o.z1) > E);
    const tZ = (ze, side) => O.filter(o => Math.abs((side === 'top' ? o.z1 : o.z0) - ze) < E && ov(x0, x1, o.x0, o.x1) > E);
    const nL = tX(x0, 'left'), nR = tX(x1, 'right'), nT = tZ(z0, 'top'), nB = tZ(z1, 'bottom');
    const lo = x0 - (nL.length ? 0 : ht), hi = x1 + (nR.length ? 0 : ht);
    [[z0, nT], [z1, nB]].forEach(([z, ne]) => {
      let segs = [[lo, hi]];
      ne.forEach(o => { segs = sub(segs, Math.max(x0, o.x0), Math.min(x1, o.x1)); });
      segs.forEach(([a, b]) => addRect(m, a, b, z - ht, z + ht));
    });
    [[x0, nL], [x1, nR]].forEach(([x, ne]) => {
      let segs = [[z0 + ht, z1 - ht]];
      ne.forEach(o => { segs = sub(segs, Math.max(z0, o.z0), Math.min(z1, o.z1)); });
      segs.forEach(([a, b]) => addRect(m, x - ht, x + ht, a, b));
    });
    return [...m.values()];
  }
  // Celdas que ocupa la abertura de una puerta (a lo largo del muro × grosor del muro)
  function doorCells(d) {
    const w = d.w || 1.5, m = new Map();
    if (d.ax === 'z') addRect(m, d.x - T / 2, d.x + T / 2, d.z - w / 2, d.z + w / 2);
    else addRect(m, d.x - w / 2, d.x + w / 2, d.z - T / 2, d.z + T / 2);
    return [...m.values()];
  }
  globalThis.Celdas = { G, T, cellOf, key, wallCells, roomWallCells, doorCells };
})();
