import * as THREE from 'three';

const T_SLAB = 0.3;
const T_WALL = 0.1;
const EPS = 1e-6;
const GRID = 0.1;
const cellOf = (v) => Math.floor(v / GRID + 1e-9) * GRID;

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

export function construirMapa(scene, json) {
  const matWall = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 });
  matWall.polygonOffset = true; matWall.polygonOffsetFactor = 1; matWall.polygonOffsetUnits = 1;
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const matRampa = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
  const matEscalera = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.7 });
  const matHighFloor = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8 });
  const matDoorFrame = new THREE.MeshStandardMaterial({ color: 0x4a2e15, roughness: 0.9 });
  const matDoorPanel = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.6, metalness: 0.1 });
  const matDoorHole = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const root = new THREE.Group();
  scene.add(root);
  const cutDoors = new Set();

  function createBox(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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
    }
  }

  const allHoles = (json.holes || []).map(norm);
  const isPoly = (r) => r.points && r.points.length > 2;
  const isElev = (r) => r.type === 'rampa' || r.type === 'escalera';
  const rects = (json.rooms || []).filter(r => !isPoly(r)).map(norm);
  const holesAt = (y) => allHoles.filter(h => Math.abs(h.y - y) < 0.1);
  const floorPieces = new Map();
  rects.forEach(r => { if (isElev(r)) return; floorPieces.set(r, rectSubtract(r, holesAt(r.y))); });

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
    (floorPieces.get(r) || []).forEach(p => slabBox(p, r.y, floorMat));
    if (r.y2 != null) {
      const cutters = holesAt(r.y).slice();
      rects.forEach(o => {
        if (o === r || isElev(o)) return;
        if (Math.abs(o.y - r.y2) < 0.1) cutters.push(...(floorPieces.get(o) || []));
      });
      rectSubtract(r, cutters).forEach(p => slabBox(p, r.y2, matRoof));
    }
  });

  function crearMuroDesdeLinea(w, thickness) {
    const height = w.h || 3, y0 = w.y || 0, half = thickness / 2;
    const EQ = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;
    let pts = [];
    (w.points || []).forEach(p => {
      if (!pts.length || !EQ(p, pts[pts.length - 1])) pts.push({ x: +p.x, z: +p.z });
    });
    let closed = !!w.closed;
    if (pts.length > 2 && EQ(pts[0], pts[pts.length - 1])) { pts.pop(); closed = true; }
    if (pts.length < 2) return;
    if (pts.length < 3) closed = false;
    const n = pts.length;
    const segCount = closed ? n : n - 1;
    const OVERLAP = thickness;

    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 1e-9) continue;
      const ux = dx / len, uz = dz / len;
      const nx = -uz, nz = ux;

      const doors = [];
      (json.doors || []).forEach(dr => {
        if (Math.abs((dr.y || 0) - y0) > 0.5) return;
        const alongX = Math.abs(uz) < 1e-3, alongZ = Math.abs(ux) < 1e-3;
        if (!alongX && !alongZ) return;
        if (alongX && dr.ax === 'z') return;
        if (alongZ && dr.ax !== 'z') return;
        const s = (dr.x - a.x) * ux + (dr.z - a.z) * uz;
        const off = Math.abs((dr.x - a.x) * nx + (dr.z - a.z) * nz);
        if (off > half + 0.3 || s < -0.01 || s > len + 0.01) return;
        doors.push({ dr, s });
      });
      doors.sort((p, q) => p.s - q.s);

      const emitBox = (s0, s1, yB, yT) => {
        const segLen = s1 - s0;
        const h = yT - yB;
        if (segLen < 0.02 || h < 0.02) return;
        const mx = a.x + ux * ((s0 + s1) / 2);
        const mz = a.z + uz * ((s0 + s1) / 2);
        const my = (yB + yT) / 2;
        const geo = new THREE.BoxGeometry(thickness, h, segLen);
        const mesh = new THREE.Mesh(geo, matWall);
        mesh.position.set(mx, my, mz);
        mesh.rotation.y = Math.atan2(ux, uz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
      };

      // Siempre solapar extremos: cierra huecos entre muros consecutivos dibujados aparte
      const extendStart = OVERLAP;
      const extendEnd = OVERLAP;

      if (!doors.length) {
        emitBox(-extendStart, len + extendEnd, y0, y0 + height);
        continue;
      }

      let cur = -extendStart;
      doors.forEach(({ dr, s }) => {
        cutDoors.add(dr);
        const ow = dr.w || 1.5, oh = dr.h || 3.6, sill = dr.sill || 0;
        const lo = Math.max(0, s - ow / 2), hi = Math.min(len, s + ow / 2);
        if (lo > cur) emitBox(cur, lo, y0, y0 + height);
        if (sill > 0.02) emitBox(lo, hi, y0, y0 + sill);
        if (height - sill - oh > 0.02) emitBox(lo, hi, y0 + sill + oh, y0 + height);
        cur = Math.max(cur, hi);
      });
      if (cur < len + extendEnd) emitBox(cur, len + extendEnd, y0, y0 + height);
    }
  }

  function mergeWalls(walls) {
    if (!walls || !walls.length) return [];
    const near = (a, b, t = 0.15) => a && b && Math.abs(a.x - b.x) < t && Math.abs(a.z - b.z) < t;
    const used = new Array(walls.length).fill(false);
    const out = [];
    for (let i = 0; i < walls.length; i++) {
      if (used[i]) continue;
      const w = walls[i];
      if (!w.points || w.points.length < 2) { used[i] = true; continue; }
      let pts = w.points.map(p => ({ x: +p.x, z: +p.z }));
      const y = w.y || 0, h = w.h || 3;
      used[i] = true;
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < walls.length; j++) {
          if (used[j]) continue;
          const o = walls[j];
          if (!o.points || o.points.length < 2) continue;
          if (Math.abs((o.y || 0) - y) > 0.05 || Math.abs((o.h || 3) - h) > 0.05) continue;
          const op = o.points.map(p => ({ x: +p.x, z: +p.z }));
          const a0 = pts[0], a1 = pts[pts.length - 1];
          const b0 = op[0], b1 = op[op.length - 1];
          if (near(a1, b0)) { pts = pts.concat(op.slice(1)); used[j] = true; changed = true; }
          else if (near(a1, b1)) { pts = pts.concat(op.slice(0, -1).reverse()); used[j] = true; changed = true; }
          else if (near(a0, b1)) { pts = op.slice(0, -1).concat(pts); used[j] = true; changed = true; }
          else if (near(a0, b0)) { pts = op.slice(1).reverse().concat(pts); used[j] = true; changed = true; }
        }
      }
      const clean = [pts[0]];
      for (let k = 1; k < pts.length - 1; k++) {
        const p = clean[clean.length - 1], c = pts[k], n2 = pts[k + 1];
        const cross = (c.x - p.x) * (n2.z - p.z) - (c.z - p.z) * (n2.x - p.x);
        if (Math.abs(cross) > 1e-4) clean.push(c);
      }
      clean.push(pts[pts.length - 1]);
      out.push({ ...w, points: clean, y, h });
    }
    return out;
  }

  mergeWalls(json.walls || []).forEach(w => crearMuroDesdeLinea(w, T_WALL));

  (json.blocks || []).forEach(b => {
    if (!b || !isFinite(b.x) || !isFinite(b.z)) return;
    const x = +cellOf(b.x).toFixed(1), z = +cellOf(b.z).toFixed(1);
    const y = b.y || 0, h = b.h > 0 ? b.h : 4;
    createBox(GRID, h, GRID, x + GRID / 2, y + h / 2, z + GRID / 2, matWall);
  });

  if (json.doors) json.doors.forEach(d => createDoor(d, !cutDoors.has(d)));
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
