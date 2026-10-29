// celdas.js v23 — SOLO ocupación de celdas (sin vértices ni líneas con grosor)
// Celda = 10 cm. Muro = 1 celda. Suelo = conjunto de celdas.
(function () {
  const G = 0.1;
  const r1 = (v) => +v.toFixed(1);
  const cellOf = (v) => r1(Math.floor(v / G + 1e-9) * G);
  const key = (x, z) => r1(x) + ',' + r1(z);
  const parseKey = (k) => { const [x, z] = k.split(',').map(Number); return { x, z }; };
  const neighbors4 = (x, z) => [
    { x: r1(x - G), z }, { x: r1(x + G), z },
    { x, z: r1(z - G) }, { x, z: r1(z + G) }
  ];

  function rectCells(x0, z0, x1, z1) {
    const out = [];
    const xa = cellOf(Math.min(x0, x1)), xb = cellOf(Math.max(x0, x1) - 1e-9);
    const za = cellOf(Math.min(z0, z1)), zb = cellOf(Math.max(z0, z1) - 1e-9);
    for (let x = xa; x <= xb + 1e-9; x = r1(x + G))
      for (let z = za; z <= zb + 1e-9; z = r1(z + G))
        out.push({ x, z });
    return out;
  }

  function roomFloorCells(r) {
    return rectCells(r.x0, r.z0, r.x1, r.z1);
  }

  // Muros = celdas del perímetro que limitan con vacío (no con otra sala)
  function roomWallCells(r, others) {
    const floors = new Set(roomFloorCells(r).map(c => key(c.x, c.z)));
    if (floors.size === 0) return [];
    const otherFloors = new Set();
    (others || []).forEach(o => {
      roomFloorCells(o).forEach(c => otherFloors.add(key(c.x, c.z)));
    });
    const walls = new Map();
    floors.forEach(k => {
      const { x, z } = parseKey(k);
      let needsWall = false;
      neighbors4(x, z).forEach(n => {
        const nk = key(n.x, n.z);
        if (!floors.has(nk) && !otherFloors.has(nk)) needsWall = true;
      });
      if (needsWall) walls.set(k, { x, z });
    });
    return [...walls.values()];
  }

  function wallCellsFromPoints(points, closed) {
    const m = new Map();
    const pts = (points || []).map(p => ({ x: cellOf(p.x), z: cellOf(p.z) }));
    const addLine = (a, b) => {
      let cx = a.x, cz = a.z;
      const x1 = b.x, z1 = b.z;
      const dx = r1(x1 - cx), dz = r1(z1 - cz);
      const sx = dx > 0 ? G : dx < 0 ? -G : 0;
      const sz = dz > 0 ? G : dz < 0 ? -G : 0;
      let adx = Math.abs(Math.round(dx / G));
      let adz = Math.abs(Math.round(dz / G));
      m.set(key(cx, cz), { x: cx, z: cz });
      if (adx === 0 && adz === 0) return;
      if (adx === 0) {
        for (let i = 0; i < adz; i++) { cz = r1(cz + sz); m.set(key(cx, cz), { x: cx, z: cz }); }
        return;
      }
      if (adz === 0) {
        for (let i = 0; i < adx; i++) { cx = r1(cx + sx); m.set(key(cx, cz), { x: cx, z: cz }); }
        return;
      }
      let err = adx - adz, steps = adx + adz;
      for (let i = 0; i < steps; i++) {
        const e2 = 2 * err;
        if (e2 > -adz) { err -= adz; cx = r1(cx + sx); }
        if (e2 < adx) { err += adx; cz = r1(cz + sz); }
        m.set(key(cx, cz), { x: cx, z: cz });
      }
    };
    for (let i = 0; i < pts.length - 1; i++) addLine(pts[i], pts[i + 1]);
    if (closed && pts.length >= 3) addLine(pts[pts.length - 1], pts[0]);
    return [...m.values()];
  }

  function wallCells(w) {
    return wallCellsFromPoints(w.points || [], !!w.closed);
  }

  function doorCells(d) {
    const w = d.w || 1.5, m = new Map();
    if (d.ax === 'z') {
      const z0 = cellOf(d.z - w / 2), z1 = cellOf(d.z + w / 2 - 1e-9);
      const x = cellOf(d.x);
      for (let z = z0; z <= z1 + 1e-9; z = r1(z + G)) m.set(key(x, z), { x, z });
    } else {
      const x0 = cellOf(d.x - w / 2), x1 = cellOf(d.x + w / 2 - 1e-9);
      const z = cellOf(d.z);
      for (let x = x0; x <= x1 + 1e-9; x = r1(x + G)) m.set(key(x, z), { x, z });
    }
    return [...m.values()];
  }

  globalThis.Celdas = {
    G, T: G, cellOf, key, parseKey, neighbors4,
    rectCells, roomFloorCells, roomWallCells, wallCells, wallCellsFromPoints, doorCells
  };
})();
