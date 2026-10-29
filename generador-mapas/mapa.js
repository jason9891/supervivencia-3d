import * as THREE from 'three';

const T_SLAB = 0.3;   // grosor de pisos y techos (centrados en su Y)
const T_WALL = 0.1;   // grosor de muros (1 celda, v23)
const EPS = 1e-6;
const GRID = 0.1;
const cellOf = (v) => Math.floor(v / GRID + 1e-9) * GRID;
const cellKey = (x, z) => (+x.toFixed(1)) + ',' + (+z.toFixed(1));

const norm = (o) => ({
  ...o,
  x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1),
  z0: Math.min(o.z0, o.z1), z1: Math.max(o.z0, o.z1),
});

function rectSubtract(rect, cutters) {
  let pieces = [rect];
  for (const c of cutters) {
    const next = [];
    for (const p of pieces) {
      const ix0 = Math.max(p.x0, c.x0), ix1 = Math.min(p.x1, c.x1);
      const iz0 = Math.max(p.z0, c.z0), iz1 = Math.min(p.z1, c.z1);
      if (ix1 - ix0 <= EPS || iz1 - iz0 <= EPS) { next.push(p); continue; }
      if (iz0 - p.z0 > EPS) next.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: iz0 });
      if (p.z1 - iz1 > EPS) next.push({ x0: p.x0, x1: p.x1, z0: iz1, z1: p.z1 });
      if (ix0 - p.x0 > EPS) next.push({ x0: p.x0, x1: ix0, z0: iz0, z1: iz1 });
      if (p.x1 - ix1 > EPS) next.push({ x0: ix1, x1: p.x1, z0: iz0, z1: iz1 });
    }
    pieces = next;
  }
  return pieces;
}

function subtractInterval(list, lo, hi) {
  const out = [];
  for (const [a, b] of list) {
    if (hi <= a + EPS || lo >= b - EPS) { out.push([a, b]); continue; }
    if (lo - a > EPS) out.push([a, lo]);
    if (b - hi > EPS) out.push([hi, b]);
  }
  return out;
}

const overlapLen = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

export function construirMapa(scene, json) {
  const matWall = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 });
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const matRampa = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
  const matEscalera = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.7 });
  const matWallTrazo = matWall.clone();
  matWallTrazo.polygonOffset = true; matWallTrazo.polygonOffsetFactor = -1; matWallTrazo.polygonOffsetUnits = -2;
  const matHighFloor = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8 });
  const matDoorFrame = new THREE.MeshStandardMaterial({ color: 0x4a2e15, roughness: 0.9 });
  const matDoorPanel = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.6, metalness: 0.1 });
  const matDoorHole = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const root = new THREE.Group();
  scene.add(root);

  function createBox(w, h, d, x, y, z, mat) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  function slabBox(rc, y, mat) {
    const w = rc.x1 - rc.x0, d = rc.z1 - rc.z0;
    if (w <= EPS || d <= EPS) return;
    createBox(w, T_SLAB, d, rc.x0 + w / 2, y, rc.z0 + d / 2, mat);
  }

  function crearMuroDesdeLinea(w, thickness) {
    const height = w.h || 3, y = w.y || 0, half = thickness / 2;
    const EQ = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
    let pts = [];
    (w.points || []).forEach(p => { if (!pts.length || !EQ(p, pts[pts.length - 1])) pts.push({ x: p.x, z: p.z }); });
    let closed = !!w.closed;
    if (pts.length > 2 && EQ(pts[0], pts[pts.length - 1])) { pts.pop(); closed = true; }
    if (pts.length < 2) return;
    if (pts.length < 3) closed = false;
    const n = pts.length;
    const segCount = closed ? n : n - 1;
    const segs = [];
    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      segs.push({ a, b, len, ux: dx / len, uz: dz / len, nx: -dz / len, nz: dx / len });
    }
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const prev = closed ? segs[(i - 1 + segCount) % segCount] : segs[i - 1];
      const next = closed ? segs[i % segCount] : segs[i];
      let mx, mz, k = 1;
      if (!prev) { mx = next.nx; mz = next.nz; }
      else if (!next) { mx = prev.nx; mz = prev.nz; }
      else {
        mx = prev.nx + next.nx; mz = prev.nz + next.nz;
        const ml = Math.hypot(mx, mz);
        if (ml < 1e-6) { mx = prev.nx; mz = prev.nz; } else { mx /= ml; mz /= ml; }
        k = 1 / Math.max(0.25, mx * prev.nx + mz * prev.nz);
      }
      const o = half * k;
      L.push({ x: pts[i].x + mx * o, z: pts[i].z + mz * o });
      R.push({ x: pts[i].x - mx * o, z: pts[i].z - mz * o });
    }
    const piece = (seg, i, sa, sb, y0, y1) => {
      if (sb - sa < 0.02 || y1 - y0 < 0.02) return;
      const j = (i + 1) % n;
      const at = (s, side, P, V) => (s <= 1e-9 ? P : s >= seg.len - 1e-9 ? V
        : { x: seg.a.x + seg.ux * s + side * seg.nx * half, z: seg.a.z + seg.uz * s + side * seg.nz * half });
      const l0 = at(sa, 1, L[i], L[j]), l1 = at(sb, 1, L[i], L[j]);
      const r0 = at(sa, -1, R[i], R[j]), r1 = at(sb, -1, R[i], R[j]);
      const shape = new THREE.Shape();
      shape.moveTo(l0.x, -l0.z); shape.lineTo(l1.x, -l1.z); shape.lineTo(r1.x, -r1.z); shape.lineTo(r0.x, -r0.z); shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false }), matWallTrazo);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = y0;
      mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    };
    segs.forEach((seg, i) => {
      const alongX = Math.abs(seg.uz) < 1e-3, alongZ = Math.abs(seg.ux) < 1e-3;
      const found = [];
      if (alongX || alongZ) (json.doors || []).forEach(dr => {
        if (Math.abs((dr.y || 0) - y) > 0.5) return;
        if (alongX && dr.ax === 'z') return;
        if (alongZ && dr.ax !== 'z') return;
        const s = (dr.x - seg.a.x) * seg.ux + (dr.z - seg.a.z) * seg.uz;
        const off = Math.abs((dr.x - seg.a.x) * seg.nx + (dr.z - seg.a.z) * seg.nz);
        if (off > half + 0.3 || s < -0.01 || s > seg.len + 0.01) return;
        found.push({ dr, s });
      });
      found.sort((p, q) => p.s - q.s);
      let cur = 0;
      found.forEach(({ dr, s }) => {
        cutDoors.add(dr);
        const ow = dr.w || 1.5, oh = dr.h || 3.6, sill = dr.sill || 0;
        const lo = Math.max(0, s - ow / 2), hi = Math.min(seg.len, s + ow / 2);
        if (lo > cur) piece(seg, i, cur, lo, y, y + height);
        if (sill > 0.02) piece(seg, i, lo, hi, y, y + sill);
        if (height - sill - oh > 0.02) piece(seg, i, lo, hi, y + sill + oh, y + height);
        cur = Math.max(cur, hi);
      });
      if (cur < seg.len) piece(seg, i, cur, seg.len, y, y + height);
    });
  }

  function createDoor(d, fill = true) {
    const w = d.w || 1.5; const h = d.h || 3.6; const y = (d.y || 0) + (d.sill || 0);
    const mode = d.panel || (d.double ? 'double' : 'single');
    const isDouble = mode === 'double'; const panelW = isDouble ? w / 2 : w;
    const frameThick = d.fw != null ? d.fw : 0.1; const frameDepth = d.depth || 0.5;
    const openAngle = ((d.angle != null ? d.angle : 72) * Math.PI) / 180;
    if (d.ax === 'z') {
      createBox(frameDepth, h, frameThick, d.x, y + h / 2, d.z - w / 2, matDoorFrame);
      createBox(frameDepth, h, frameThick, d.x, y + h / 2, d.z + w / 2, matDoorFrame);
      createBox(frameDepth, frameThick, w, d.x, y + h, d.z, matDoorFrame);
      if (fill && mode !== 'none') createBox(0.1, h, w, d.x, y + h / 2, d.z, matDoorHole);
      if (mode === 'none') return;
      const hingeZ = d.hinge === 'left' ? d.z - w / 2 + frameThick / 2 : d.z + w / 2 - frameThick / 2;
      const dir = d.hinge === 'left' ? 1 : -1;
      const angle = d.swing === 'in' ? openAngle : -openAngle;
      const pivot = new THREE.Group();
      pivot.position.set(d.x, y, hingeZ); pivot.rotation.y = dir * angle; root.add(pivot);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.1, panelW), matDoorPanel);
      panel.position.set(0, h / 2, dir * panelW / 2); panel.castShadow = true; pivot.add(panel);
      if (isDouble) {
        const pivot2 = new THREE.Group(); pivot2.position.set(d.x, y, d.z + w / 2 - frameThick / 2);
        pivot2.rotation.y = -dir * angle; root.add(pivot2);
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.1, panelW), matDoorPanel);
        panel2.position.set(0, h / 2, -dir * panelW / 2); panel2.castShadow = true; pivot2.add(panel2);
      }
    } else {
      createBox(frameThick, h, frameDepth, d.x - w / 2, y + h / 2, d.z, matDoorFrame);
      createBox(frameThick, h, frameDepth, d.x + w / 2, y + h / 2, d.z, matDoorFrame);
      createBox(w, frameThick, frameDepth, d.x, y + h, d.z, matDoorFrame);
      if (fill && mode !== 'none') createBox(w, h, 0.1, d.x, y + h / 2, d.z, matDoorHole);
      if (mode === 'none') return;
      const hingeX = d.hinge === 'left' ? d.x - w / 2 + frameThick / 2 : d.x + w / 2 - frameThick / 2;
      const dir = d.hinge === 'left' ? 1 : -1;
      const angle = d.swing === 'in' ? -openAngle : openAngle;
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, y, d.z); pivot.rotation.y = dir * angle; root.add(pivot);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h - 0.1, 0.08), matDoorPanel);
      panel.position.set(dir * panelW / 2, h / 2, 0); panel.castShadow = true; pivot.add(panel);
      if (isDouble) {
        const pivot2 = new THREE.Group(); pivot2.position.set(d.x + w / 2 - frameThick / 2, y, d.z);
        pivot2.rotation.y = -dir * angle; root.add(pivot2);
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(panelW, h - 0.1, 0.08), matDoorPanel);
        panel2.position.set(-dir * panelW / 2, h / 2, 0); panel2.castShadow = true; pivot2.add(panel2);
      }
    }
  }

  const allHoles = (json.holes || []).map(norm);
  const isPoly = (r) => r.points && r.points.length > 2;
  const isElev = (r) => r.type === 'rampa' || r.type === 'escalera';
  const rects = (json.rooms || []).filter(r => !isPoly(r)).map(norm);
  const holesAt = (y) => allHoles.filter(h => Math.abs(h.y - y) < 0.1);
  const floorPieces = new Map();
  rects.forEach(r => { if (isElev(r)) return; floorPieces.set(r, rectSubtract(r, holesAt(r.y))); });
  const topOf = (r) => (r.y2 != null ? r.y2 : r.y + 4);
  const overlapY = (a, b) => overlapLen(a.y, topOf(a), b.y, topOf(b)) > 0.1;
  const cutDoors = new Set();

  // Polilíneas / piso libre: misma altura Y que losas rectangulares (centrado)
  (json.rooms || []).filter(isPoly).forEach(r => {
    const cleanPoints = [];
    for (let i = 0; i < r.points.length; i++) {
      const p = r.points[i];
      const last = cleanPoints[cleanPoints.length - 1];
      if (!last || last.x !== p.x || last.z !== p.z) cleanPoints.push(p);
    }
    if (cleanPoints.length > 2 && cleanPoints[0].x === cleanPoints[cleanPoints.length - 1].x && cleanPoints[0].z === cleanPoints[cleanPoints.length - 1].z) cleanPoints.pop();
    if (cleanPoints.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(cleanPoints[0].x, -cleanPoints[0].z);
    for (let i = 1; i < cleanPoints.length; i++) shape.lineTo(cleanPoints[i].x, -cleanPoints[i].z);
    holesAt(r.y).forEach(h => {
      const path = new THREE.Path();
      path.moveTo(h.x0, -h.z0); path.lineTo(h.x1, -h.z0); path.lineTo(h.x1, -h.z1); path.lineTo(h.x0, -h.z1); path.lineTo(h.x0, -h.z0);
      shape.holes.push(path);
    });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T_SLAB, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, matFloor);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = r.y - T_SLAB / 2;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  });

  rects.forEach(r => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const cx = r.x0 + w / 2, cz = r.z0 + d / 2;
    const dir = r.dir || '+x';
    const half = T_SLAB / 2;
    if (r.type === 'rampa') {
      const rise = (r.y2 != null ? r.y2 : r.y + 3) - r.y;
      const length = dir.includes('z') ? d : w;
      const theta = Math.atan2(rise, length);
      const hypot = Math.sqrt(length * length + rise * rise);
      const geo = new THREE.BoxGeometry(dir.includes('z') ? w : hypot, T_SLAB, dir.includes('z') ? hypot : d);
      const ramp = new THREE.Mesh(geo, matRampa);
      ramp.position.set(cx, r.y + rise / 2 + half - half / Math.cos(theta), cz);
      if (dir === '+z') ramp.rotation.x = -theta;
      if (dir === '-z') ramp.rotation.x = theta;
      if (dir === '+x') ramp.rotation.z = theta;
      if (dir === '-x') ramp.rotation.z = -theta;
      ramp.castShadow = true; ramp.receiveShadow = true; root.add(ramp);
      return;
    }
    if (r.type === 'escalera') {
      const y2 = r.y2 != null ? r.y2 : r.y + 3;
      const surf0 = r.y + half, surf1 = y2 + half;
      const rise = surf1 - surf0;
      const steps = r.steps || Math.max(4, Math.min(40, Math.round(Math.abs(y2 - r.y) / 0.25)));
      const length = dir.includes('z') ? d : w;
      const stepD = length / steps;
      const baseY = r.y - half;
      for (let i = 0; i < steps; i++) {
        const topY = surf0 + ((i + 1) / steps) * rise;
        const offset = i * stepD + stepD / 2;
        let sx = cx, sz = cz;
        if (dir === '+z') sz = r.z0 + offset;
        if (dir === '-z') sz = r.z1 - offset;
        if (dir === '+x') sx = r.x0 + offset;
        if (dir === '-x') sx = r.x1 - offset;
        const sw = dir.includes('z') ? w : stepD;
        const sd = dir.includes('z') ? stepD : d;
        const h = topY - baseY;
        createBox(sw, h, sd, sx, baseY + h / 2, sz, matEscalera);
      }
      return;
    }
    const floorMat = r.y > 3 ? matHighFloor : matFloor;
    floorPieces.get(r).forEach(p => slabBox(p, r.y, floorMat));
    if (r.y2 != null) {
      const cutters = holesAt(r.y).slice();
      rects.forEach(o => {
        if (o === r || isElev(o)) return;
        if (Math.abs(o.y - r.y2) < 0.1) cutters.push(...floorPieces.get(o));
      });
      rectSubtract(r, cutters).forEach(p => slabBox(p, r.y2, matRoof));
    }
  });

  // Muros de trazo (herramienta Muro) — grosor 1 celda
  (json.walls || []).forEach(w => crearMuroDesdeLinea(w, T_WALL));

  function celdasDeMuros() {
    const C = globalThis.Celdas, out = new Map(), put = (c, y, h) => {
      const k = C.key(c.x, c.z) + '|' + y; const o = out.get(k);
      if (!o || o.h < h) out.set(k, { x: c.x, z: c.z, y, h, muro: true });
    };
    (json.walls || []).forEach(w => {
      if (!w.points || w.points.length < 2) return;
      C.wallCells(w).forEach(c => put(c, w.y || 0, w.h || 3));
    });
    // Solo salas antiguas con open:false generan muro auto; piso v23.4 no
    const salas = rects.filter(r => r.type === 'sala' && !r.open);
    salas.forEach(r => {
      const others = salas.filter(o => o !== r && overlapY(r, o));
      C.roomWallCells(r, others).forEach(c => put(c, r.y + T_SLAB / 2, topOf(r) - r.y - T_SLAB / 2));
    });
    return [...out.values()];
  }

  function crearBloques(list) {
    const G = GRID;
    const cells = (list || []).filter(b => b && isFinite(b.x) && isFinite(b.z))
      .map(b => ({ x: +cellOf(b.x).toFixed(1), z: +cellOf(b.z).toFixed(1), y: b.y || 0, h: b.h > 0 ? b.h : 4, muro: !!b.muro }));
    if (!cells.length) return;
    cells.forEach(c => {
      createBox(G, c.h, G, c.x + G / 2, c.y + c.h / 2, c.z + G / 2, c.muro ? matWall : matWall);
    });
  }
  crearBloques([...(json.blocks || []), ...celdasDeMuros()]);

  if (json.doors) {
    json.doors.forEach(d => createDoor(d, !cutDoors.has(d)));
  }
  return root;
}

export function destruirMapa(scene, root) {
  if (!root) return;
  scene.remove(root);
  const mats = new Set();
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) mats.add(o.material);
  });
  mats.forEach(m => m.dispose());
}
