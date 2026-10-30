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
      // Prisma inclinado: techo y base paralelos (grosor vertical constante) con los extremos
      // cortados en VERTICAL: empieza en Y y termina exactamente en Y final (a ras con los pisos).
      const yEnd = r.y2 != null ? r.y2 : r.y + 3;
      const t = T_SLAB;
      const along = dir.includes('z') ? 'z' : 'x';
      const fwd = dir[0] === '+';
      const a0 = along === 'x' ? r.x0 : r.z0, a1 = along === 'x' ? r.x1 : r.z1;
      const o0 = along === 'x' ? r.z0 : r.x0, o1 = along === 'x' ? r.z1 : r.x1;
      const ys = (fwd ? [r.y, yEnd] : [yEnd, r.y]).map(v => v + half); // altura del techo en a0 y en a1
      const P = (a, y, o) => along === 'x' ? [a, y, o] : [o, y, a];
      const v = {
        t00: P(a0, ys[0], o0), t01: P(a0, ys[0], o1), t10: P(a1, ys[1], o0), t11: P(a1, ys[1], o1),
        b00: P(a0, ys[0] - t, o0), b01: P(a0, ys[0] - t, o1), b10: P(a1, ys[1] - t, o0), b11: P(a1, ys[1] - t, o1),
      };
      const quads = [
        ['t00', 't01', 't11', 't10'], ['b00', 'b10', 'b11', 'b01'],
        ['t00', 'b00', 'b01', 't01'], ['t10', 't11', 'b11', 'b10'],
        ['t00', 't10', 'b10', 'b00'], ['t01', 'b01', 'b11', 't11'],
      ];
      const pos = [], uv = [];
      quads.forEach(q => [0, 1, 2, 0, 2, 3].forEach(i => { const p = v[q[i]]; pos.push(p[0], p[1], p[2]); uv.push(p[0] + p[2], p[1]); }));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.computeVertexNormals();
      const ramp = new THREE.Mesh(geo, matRampa);
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
    if (r.y2 != null) rectSubtract(r, holesAt(r.y)).forEach(p => slabBox(p, r.y2, matRoof));
  });

  // Muros: cajas por segmento; closed une ultimo con primero
  // Hueco de puerta: se corta el tramo donde cae la puerta
  (json.walls || []).forEach(w => {
    const height = w.h || 3, y0 = w.y || 0, half = T_WALL / 2;
    let pts = (w.points || []).map(p => ({ x: +p.x, z: +p.z }));
    if (pts.length < 2) return;
    let closed = !!w.closed;
    if (pts.length > 2) {
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6) {
        pts = pts.slice(0, -1);
        closed = true;
      }
    }
    const n = pts.length;
    const segCount = closed && n >= 3 ? n : n - 1;

    const emitSeg = (a, ux, uz, s0, s1, yB, yT) => {
      const segLen = s1 - s0, h = yT - yB;
      if (segLen < 0.02 || h < 0.02) return;
      const mx = a.x + ux * ((s0 + s1) / 2);
      const mz = a.z + uz * ((s0 + s1) / 2);
      const my = (yB + yT) / 2;
      const geo = new THREE.BoxGeometry(T_WALL, h, segLen);
      const mesh = new THREE.Mesh(geo, matWall);
      mesh.position.set(mx, my, mz);
      mesh.rotation.y = Math.atan2(ux, uz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      root.add(mesh);
    };

    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
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

      const pad = T_WALL * 0.5;
      if (!doors.length) {
        emitSeg(a, ux, uz, -pad, len + pad, y0, y0 + height);
        continue;
      }

      let cur = -pad;
      doors.forEach(({ dr, s }) => {
        cutDoors.add(dr);
        const ow = dr.w || 1.5, oh = dr.h || 3.6, sill = dr.sill || 0;
        const lo = Math.max(0, s - ow / 2), hi = Math.min(len, s + ow / 2);
        if (lo > cur) emitSeg(a, ux, uz, cur, lo, y0, y0 + height);
        if (sill > 0.02) emitSeg(a, ux, uz, lo, hi, y0, y0 + sill);
        if (height - sill - oh > 0.02) emitSeg(a, ux, uz, lo, hi, y0 + sill + oh, y0 + height);
        cur = Math.max(cur, hi);
      });
      if (cur < len + pad) emitSeg(a, ux, uz, cur, len + pad, y0, y0 + height);
    }
  });

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
