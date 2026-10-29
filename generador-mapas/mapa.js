import * as THREE from 'three';

const T_SLAB = 0.3;
const T_WALL = 0.1;
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

const overlapLen = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

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

  function celdasDeMuros() {
    const C = globalThis.Celdas;
    if (!C) return [];
    const out = new Map();
    const put = (c, y, h) => {
      const k = C.key(c.x, c.z) + '|' + y;
      const o = out.get(k);
      if (!o || o.h < h) out.set(k, { x: c.x, z: c.z, y, h, muro: true });
    };
    (json.walls || []).forEach(w => {
      if (!w.points || w.points.length < 2) return;
      C.wallCells(w).forEach(c => put(c, w.y || 0, w.h || 3));
    });
    const salas = rects.filter(r => r.type === 'sala' && !r.open);
    salas.forEach(r => {
      const others = salas.filter(o => o !== r && overlapY(r, o));
      C.roomWallCells(r, others).forEach(c => put(c, r.y + T_SLAB / 2, topOf(r) - r.y - T_SLAB / 2));
    });
    return [...out.values()];
  }

  function crearBloques(list) {
    const G = GRID;
    const OVER = 0.002;
    const cells = (list || []).filter(b => b && isFinite(b.x) && isFinite(b.z))
      .map(b => ({
        x: +cellOf(b.x).toFixed(1),
        z: +cellOf(b.z).toFixed(1),
        y: +(b.y || 0).toFixed(3),
        h: +((b.h > 0 ? b.h : 4)).toFixed(3),
        muro: !!b.muro
      }));
    if (!cells.length) return;
    const doors = json.doors || [];

    const cellDoors = (c) => doors.filter(dr => {
      const dy = dr.y == null ? 0 : dr.y;
      if (dy < c.y - 0.5 || dy >= c.y + c.h) return false;
      const ow = dr.w || 1.5;
      if (dr.ax === 'z') {
        return dr.x >= c.x - 0.05 && dr.x <= c.x + G + 0.05 &&
          Math.min(c.z + G, dr.z + ow / 2) - Math.max(c.z, dr.z - ow / 2) > 0.02;
      }
      return dr.z >= c.z - 0.05 && dr.z <= c.z + G + 0.05 &&
        Math.min(c.x + G, dr.x + ow / 2) - Math.max(c.x, dr.x - ow / 2) > 0.02;
    });

    const solid = [];
    const withDoor = [];
    cells.forEach(c => {
      const ds = cellDoors(c);
      if (ds.length) withDoor.push({ c, ds });
      else solid.push(c);
    });

    const groups = new Map();
    solid.forEach(c => {
      const gk = c.y + '|' + c.h;
      if (!groups.has(gk)) groups.set(gk, new Map());
      groups.get(gk).set(c.x + ',' + c.z, c);
    });
    groups.forEach((occMap) => {
      const used = new Set();
      [...occMap.keys()].forEach(k0 => {
        if (used.has(k0)) return;
        const c = occMap.get(k0);
        let x1 = c.x;
        for (;;) {
          const nx = +(x1 + G).toFixed(1);
          if (!occMap.has(nx + ',' + c.z) || used.has(nx + ',' + c.z)) break;
          x1 = nx;
        }
        let z1 = c.z;
        for (;;) {
          const nz = +(z1 + G).toFixed(1);
          let ok = true;
          for (let x = c.x; x <= x1 + 1e-9; x = +(x + G).toFixed(1)) {
            if (!occMap.has(x + ',' + nz) || used.has(x + ',' + nz)) { ok = false; break; }
          }
          if (!ok) break;
          z1 = nz;
        }
        for (let x = c.x; x <= x1 + 1e-9; x = +(x + G).toFixed(1))
          for (let z = c.z; z <= z1 + 1e-9; z = +(z + G).toFixed(1))
            used.add(x + ',' + z);
        const bw = +(x1 - c.x + G).toFixed(1);
        const bd = +(z1 - c.z + G).toFixed(1);
        createBox(bw + OVER, c.h, bd + OVER, c.x + bw / 2, c.y + c.h / 2, c.z + bd / 2, matWall);
      });
    });

    withDoor.forEach(({ c, ds }) => {
      let boxes = [{ x0: c.x, x1: c.x + G, z0: c.z, z1: c.z + G, y0: c.y, y1: c.y + c.h }];
      ds.forEach(dr => {
        cutDoors.add(dr);
        const ow = dr.w || 1.5, oh = dr.h || 3.6, sill = dr.sill || 0;
        const ys = (dr.y || 0) + sill, yt = ys + oh;
        const ax = dr.ax === 'z' ? 'z' : 'x';
        const a = (ax === 'x' ? dr.x : dr.z) - ow / 2;
        const b = a + ow;
        const next = [];
        boxes.forEach(bx => {
          const lo = ax === 'x' ? 'x0' : 'z0';
          const hi = ax === 'x' ? 'x1' : 'z1';
          const ca = Math.max(a, bx[lo]), cb = Math.min(b, bx[hi]);
          if (cb - ca <= 0.02 || Math.min(yt, bx.y1) - Math.max(ys, bx.y0) <= 0.02) {
            next.push(bx); return;
          }
          if (ca - bx[lo] > 0.02) next.push({ ...bx, [hi]: ca });
          if (bx[hi] - cb > 0.02) next.push({ ...bx, [lo]: cb });
          const mid = { ...bx, [lo]: ca, [hi]: cb };
          if (ys - mid.y0 > 0.02) next.push({ ...mid, y1: Math.min(ys, mid.y1) });
          if (mid.y1 - yt > 0.02) next.push({ ...mid, y0: Math.max(yt, mid.y0) });
        });
        boxes = next;
      });
      boxes.forEach(bx => {
        const bw = bx.x1 - bx.x0, bd = bx.z1 - bx.z0, bh = bx.y1 - bx.y0;
        if (bw < 0.02 || bd < 0.02 || bh < 0.02) return;
        createBox(bw + OVER * 0.5, bh, bd + OVER * 0.5, bx.x0 + bw / 2, bx.y0 + bh / 2, bx.z0 + bd / 2, matWall);
      });
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
