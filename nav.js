// nav.js — ruta para los enemigos: A* sobre una rejilla local (lógica pura, sin three.js; se prueba con Node).
// `blocked(x, z)` dice si un punto no se puede pisar (muros del piso del enemigo con su radio). La rejilla no se guarda: se calcula
// sólo sobre la zona entre el enemigo y su objetivo, así vale aunque el mapa cambie (la reja que cae, props, etc.).

/** ¿El segmento a→b está libre? Se muestrea cada `step` metros. */
export function lineClear(ax, az, bx, bz, blocked, step = 0.25) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
  return true;
}

/**
 * Camino de (sx,sz) a (gx,gz) como lista de puntos del mundo (sin el de salida; el último es la meta o lo más cercano que se pudo llegar).
 * Devuelve null si no hay camino dentro de la zona. Ruta alisada: se quitan los puntos que sobran en tramos libres.
 */
export function findPath(sx, sz, gx, gz, blocked, { cell = 0.4, pad = 7, maxNodes = 9000 } = {}) {
  const minX = Math.min(sx, gx) - pad, minZ = Math.min(sz, gz) - pad;
  const W = Math.ceil((Math.abs(gx - sx) + 2 * pad) / cell) + 1, H = Math.ceil((Math.abs(gz - sz) + 2 * pad) / cell) + 1;
  const toI = (x, z) => [Math.round((x - minX) / cell), Math.round((z - minZ) / cell)];
  const wx = (i) => minX + i * cell, wz = (j) => minZ + j * cell;
  const free = new Int8Array(W * H).fill(-1);   // -1 sin calcular, 0 bloqueado, 1 libre
  const isFree = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= H) return false; const k = j * W + i; if (free[k] < 0) free[k] = blocked(wx(i), wz(j)) ? 0 : 1; return free[k] === 1; };
  let [si, sj] = toI(sx, sz), [gi, gj] = toI(gx, gz);
  // la meta (el jugador) puede quedar dentro de un obstáculo: se usa la casilla libre más cercana
  if (!isFree(gi, gj)) {
    let best = null, bd = Infinity;
    for (let r = 1; r <= 8 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !isFree(gi + di, gj + dj)) continue;
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = [gi + di, gj + dj]; }
    }
    if (!best) return null;
    [gi, gj] = best;
  }
  const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const h = (i, j) => { const a = Math.abs(i - gi), b = Math.abs(j - gj); return (a + b) + (Math.SQRT2 - 2) * Math.min(a, b); };
  const heap = [];   // montículo mínimo de [f, k]
  const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = sj * W + si; g[s] = 0; push(h(si, sj), s);
  let goal = -1, nodes = 0, bestK = s, bestH = h(si, sj);
  while (heap.length && nodes++ < maxNodes) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
    const i = k % W, j = (k / W) | 0;
    if (i === gi && j === gj) { goal = k; break; }
    const hh = h(i, j); if (hh < bestH) { bestH = hh; bestK = k; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj; if (!isFree(ni, nj)) continue;
      if (di && dj && (!isFree(i + di, j) || !isFree(i, j + dj))) continue;   // sin cortar esquinas
      const nk = nj * W + ni, ng = g[k] + (di && dj ? Math.SQRT2 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + h(ni, nj), nk); }
    }
  }
  const end = goal >= 0 ? goal : bestK;   // sin camino completo: lo más cerca posible
  if (end === s) return null;
  const pts = []; for (let k = end; k !== -1 && k !== s; k = from[k]) pts.push([wx(k % W), wz((k / W) | 0)]);
  pts.reverse();
  // alisado: desde cada punto se salta al más lejano al que se ve en línea recta
  const out = []; let cx = sx, cz = sz, idx = 0;
  while (idx < pts.length) {
    let far = idx;
    for (let k = pts.length - 1; k > idx; k--) if (lineClear(cx, cz, pts[k][0], pts[k][1], blocked)) { far = k; break; }
    out.push({ x: pts[far][0], z: pts[far][1] }); cx = pts[far][0]; cz = pts[far][1]; idx = far + 1;
  }
  if (goal >= 0 && out.length) {   // la meta exacta (no el centro de su casilla) si se llega en línea recta desde el punto anterior
    const prev = out.length > 1 ? out[out.length - 2] : { x: sx, z: sz };
    if (lineClear(prev.x, prev.z, gx, gz, blocked)) out[out.length - 1] = { x: gx, z: gz };
  }
  out.reached = goal >= 0;                               // false = no hay camino dentro de la zona: la ruta lleva solo lo más cerca que se pudo llegar
  return out;
}

/** Siguiente punto al que ir: el primero de `path` a más de `min` metros de (x,z). Quita los ya alcanzados. */
export function nextWaypoint(path, x, z, min = 0.5) {
  while (path.length > 1 && Math.hypot(path[0].x - x, path[0].z - z) < min) path.shift();
  return path[0] || null;
}
