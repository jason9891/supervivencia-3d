// celdas.js — muros como CELDAS de 10 cm. Lo comparten el editor (dibujo/selección) y el visor 3D (geometría),
// así lo que ves en el plano es exactamente lo que se construye. Script clásico: deja todo en globalThis.Celdas.
//
// v22: grosor de muro = 1 celda (T = 0.1). Todo trabaja en ocupación de celdas, no en vértices.
(function () {
  const G = 0.1;                 // celda (10 cm)
  const T = 0.1;                 // grosor del muro = 1 celda
  const r1 = (v) => +v.toFixed(1);
  const cellOf = (v) => r1(Math.floor(v / G + 1e-9) * G);
  const key = (x, z) => r1(x) + ',' + r1(z);

  // distancia de un punto a un segmento
  function dSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
  }

  // Celdas cuyo centro queda a menos de T/2 + epsilon del segmento.
  // Con T = 0.1 y trazo alineado a la rejilla produce exactamente 1 celda de grosor
  // cuando el segmento pasa por el centro de la celda (o muy cerca).
  function addSeg(map, ax, az, bx, bz, t) {
    const h = (t == null ? T : t) / 2 + 1e-6;
    const x0 = Math.min(ax, bx) - h, x1 = Math.max(ax, bx) + h;
    const z0 = Math.min(az, bz) - h, z1 = Math.max(az, bz) + h;
    for (let x = cellOf(x0); x <= x1 + 1e-9; x = r1(x + G))
      for (let z = cellOf(z0); z <= z1 + 1e-9; z = r1(z + G)) {
        if (dSeg(x + G / 2, z + G / 2, ax, az, bx, bz) <= h)
          map.set(key(x, z), { x, z });
      }
  }

  // Muro de trazo (polilínea) → celdas. Los puntos se interpretan como posiciones
  // (idealmente centros de celda). Cada tramo genera 1 celda de grosor.
  function wallCells(w, t) {
    const m = new Map(), p = w.points || [];
    for (let i = 0; i < p.length - 1; i++)
      addSeg(m, p[i].x, p[i].z, p[i + 1].x, p[i + 1].z, t);
    if (w.closed && p.length >= 3)
      addSeg(m, p[p.length - 1].x, p[p.length - 1].z, p[0].x, p[0].z, t);
    return [...m.values()];
  }

  // Rectángulo en celdas [xa, xb) × [za, zb)
  function addRect(map, xa, xb, za, zb) {
    for (let x = cellOf(xa + 1e-6); x < xb - 1e-6; x = r1(x + G))
      for (let z = cellOf(za + 1e-6); z < zb - 1e-6; z = r1(z + G))
        map.set(key(x, z), { x, z });
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

  // Muros de una sala rectangular cerrada.
  // v22: 1 celda de grosor. Las paredes se colocan EN el borde de la sala
  // (celda interior del perímetro). El borde compartido con otra sala no lleva muro.
  function roomWallCells(r, others) {
    const m = new Map(), E = 1e-6;
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1);
    const z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1);

    if (x1 - x0 < G * 1.5 || z1 - z0 < G * 1.5) return [];

    const nb = (o) => ({
      x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1),
      z0: Math.min(o.z0, o.z1), z1: Math.max(o.z0, o.z1)
    });
    const O = others.map(nb);

    const tX = (xe, side) => O.filter(o =>
      Math.abs((side === 'left' ? o.x1 : o.x0) - xe) < E && ov(z0, z1, o.z0, o.z1) > E);
    const tZ = (ze, side) => O.filter(o =>
      Math.abs((side === 'top' ? o.z1 : o.z0) - ze) < E && ov(x0, x1, o.x0, o.x1) > E);

    const nL = tX(x0, 'left'), nR = tX(x1, 'right');
    const nT = tZ(z0, 'top'), nB = tZ(z1, 'bottom');

    const cx0 = cellOf(x0);
    const cx1 = cellOf(x1 - E);
    const cz0 = cellOf(z0);
    const cz1 = cellOf(z1 - E);

    [[cz0, nT], [cz1, nB]].forEach(([cz, ne]) => {
      if (ne.length) {
        let segs = [[x0, x1]];
        ne.forEach(o => { segs = sub(segs, Math.max(x0, o.x0), Math.min(x1, o.x1)); });
        segs.forEach(([a, b]) => addRect(m, a, b, cz, cz + G));
      } else {
        addRect(m, x0, x1, cz, cz + G);
      }
    });

    [[cx0, nL], [cx1, nR]].forEach(([cx, ne]) => {
      const zLo = cz0 + G;
      const zHi = cz1;
      if (zHi <= zLo + E) return;
      if (ne.length) {
        let segs = [[zLo, zHi]];
        ne.forEach(o => { segs = sub(segs, Math.max(z0, o.z0), Math.min(z1, o.z1)); });
        segs.forEach(([a, b]) => addRect(m, cx, cx + G, a, b));
      } else {
        addRect(m, cx, cx + G, zLo, zHi);
      }
    });

    return [...m.values()];
  }

  function doorCells(d) {
    const w = d.w || 1.5, m = new Map();
    if (d.ax === 'z') addRect(m, d.x - T / 2, d.x + T / 2, d.z - w / 2, d.z + w / 2);
    else addRect(m, d.x - w / 2, d.x + w / 2, d.z - T / 2, d.z + T / 2);
    return [...m.values()];
  }

  globalThis.Celdas = { G, T, cellOf, key, wallCells, roomWallCells, doorCells };
})();
