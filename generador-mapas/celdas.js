// celdas.js — muros como CELDAS de 10 cm. Lo comparten el editor y el visor 3D.
// v22.1: grosor muro = 1 celda exacta (raster por celdas, no distancia a línea).
(function () {
  const G = 0.1;
  const T = 0.1;
  const r1 = (v) => +v.toFixed(1);
  const cellOf = (v) => r1(Math.floor(v / G + 1e-9) * G);
  const key = (x, z) => r1(x) + ',' + r1(z);

  // Rasteriza un segmento en celdas de 1 de grosor.
  // Normaliza a centros de celda → siempre 1 celda en tramos alineados.
  function addSeg(map, ax, az, bx, bz) {
    const acx = cellOf(ax) + G / 2, acz = cellOf(az) + G / 2;
    const bcx = cellOf(bx) + G / 2, bcz = cellOf(bz) + G / 2;

    let cx = cellOf(acx), cz = cellOf(acz);
    const x1 = cellOf(bcx), z1 = cellOf(bcz);

    const dx = r1(x1 - cx), dz = r1(z1 - cz);
    const sx = dx > 0 ? G : dx < 0 ? -G : 0;
    const sz = dz > 0 ? G : dz < 0 ? -G : 0;
    let adx = Math.abs(Math.round(dx / G));
    let adz = Math.abs(Math.round(dz / G));

    map.set(key(cx, cz), { x: cx, z: cz });
    if (adx === 0 && adz === 0) return;

    if (adx === 0) {
      for (let i = 0; i < adz; i++) {
        cz = r1(cz + sz);
        map.set(key(cx, cz), { x: cx, z: cz });
      }
      return;
    }
    if (adz === 0) {
      for (let i = 0; i < adx; i++) {
        cx = r1(cx + sx);
        map.set(key(cx, cz), { x: cx, z: cz });
      }
      return;
    }

    let err = adx - adz;
    let steps = adx + adz;
    for (let i = 0; i < steps; i++) {
      const e2 = 2 * err;
      if (e2 > -adz) { err -= adz; cx = r1(cx + sx); }
      if (e2 < adx)  { err += adx; cz = r1(cz + sz); }
      map.set(key(cx, cz), { x: cx, z: cz });
    }
  }

  function wallCells(w, t) {
    const m = new Map(), p = w.points || [];
    for (let i = 0; i < p.length - 1; i++)
      addSeg(m, p[i].x, p[i].z, p[i + 1].x, p[i + 1].z);
    if (w.closed && p.length >= 3)
      addSeg(m, p[p.length - 1].x, p[p.length - 1].z, p[0].x, p[0].z);
    return [...m.values()];
  }

  function addRect(map, xa, xb, za, zb) {
    for (let x = cellOf(xa + 1e-6); x < xb - 1e-6; x = r1(x + G))
      for (let z = cellOf(za + 1e-6); z < zb - 1e-6; z = r1(z + G))
        map.set(key(x, z), { x, z });
  }

  const sub = (list, lo, hi) => {
    const out = [];
    for (const [a, b] of list) {
      if (hi <= a + 1e-6 || lo >= b - 1e-6) { out.push([a, b]); continue; }
      if (lo - a > 1e-6) out.push([a, lo]);
      if (b - hi > 1e-6) out.push([hi, b]);
    }
    return out;
  };
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

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

    const cx0 = cellOf(x0), cx1 = cellOf(x1 - E);
    const cz0 = cellOf(z0), cz1 = cellOf(z1 - E);

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
      const zLo = cz0 + G, zHi = cz1;
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
