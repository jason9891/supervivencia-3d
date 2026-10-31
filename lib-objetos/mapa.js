import * as THREE from 'three';

const T_SLAB = 0.3;   // grosor de pisos y techos (centrados en su Y)
const T_WALL = 0.4;   // grosor de muros de sala
const EPS = 1e-6;

// ---------- utilidades geométricas ----------
const norm = (o) => ({
  ...o,
  x0: Math.min(o.x0, o.x1), x1: Math.max(o.x0, o.x1),
  z0: Math.min(o.z0, o.z1), z1: Math.max(o.z0, o.z1),
});

// Resta una lista de rectángulos a un rectángulo y devuelve los trozos restantes.
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

// Resta el intervalo [lo,hi] a una lista de intervalos [a,b].
function subtractInterval(list, lo, hi) {
  const out = [];
  for (const [a, b] of list) {
    if (hi <= a + EPS || lo >= b - EPS) { out.push([a, b]); continue; }
    if (lo - a > EPS) out.push([a, lo]);
    if (b - hi > EPS) out.push([hi, b]);
  }
  return out;
}

// UV en metros: la textura se repite según el tamaño real de cada cara (1 repetición = `tile` m).
function uvMetros(geo) {
  const p = geo.parameters;
  if (!p || p.width === undefined || p.depth === undefined || !geo.attributes.uv) return;
  const S = [[p.depth, p.height], [p.depth, p.height], [p.width, p.depth], [p.width, p.depth], [p.width, p.height], [p.width, p.height]];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * S[f][0], uv.getY(k) * S[f][1]);
  }
  uv.needsUpdate = true;
}

const overlapLen = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

/* opciones.material(dueno, superficie, base) -> material | null
 *   dueno      = id de la sala (o de la puerta / muro libre)
 *   superficie = 'piso' | 'techo' | 'muro' | 'escalera' | 'rampa' | 'marco' | 'hoja'
 *   base       = material base que se usaría; devuelve null para dejarlo.
 * Cada malla lleva mesh.userData = { dueno, superficie } para poder elegirla y cambiarla después. */
export function construirMapa(scene, json, opciones = {}) {
  const pick = (dueno, sup, base) => (opciones.material && opciones.material(dueno, sup, base)) || base;
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

  function createBox(w, h, d, x, y, z, mat, dueno, sup) {
    const geo = new THREE.BoxGeometry(w, h, d);
    uvMetros(geo);
    const mesh = new THREE.Mesh(geo, dueno ? pick(dueno, sup, mat) : mat);
    mesh.userData = { dueno: dueno || null, superficie: sup || null };
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // Caja a partir de un rectángulo en planta {x0,x1,z0,z1}
  function slabBox(rc, y, mat, dueno, sup) {
    const w = rc.x1 - rc.x0, d = rc.z1 - rc.z0;
    if (w <= EPS || d <= EPS) return;
    createBox(w, T_SLAB, d, rc.x0 + w / 2, y, rc.z0 + d / 2, mat, dueno, sup);
  }

  // --- GENERADOR DE MUROS CONTINUOS (POLILÍNEAS CON GROSOR) ---
  function crearMuroDesdeLinea(points, thickness, height, y, dueno) {
    const half = thickness / 2;
    const leftSide = [];
    const rightSide = [];

    const pts = [];
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || points[i].x !== points[i - 1].x || points[i].z !== points[i - 1].z) {
        pts.push(points[i]);
      }
    }
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let nx = 0, nz = 0;

      if (i === 0) {
        const dx = pts[1].x - p.x; const dz = pts[1].z - p.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        nx = -dz / len; nz = dx / len;
      } else if (i === pts.length - 1) {
        const dx = p.x - pts[i - 1].x; const dz = p.z - pts[i - 1].z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        nx = -dz / len; nz = dx / len;
      } else {
        const dx1 = p.x - pts[i - 1].x; const dz1 = p.z - pts[i - 1].z;
        const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1) || 1;
        const nx1 = -dz1 / len1; const nz1 = dx1 / len1;

        const dx2 = pts[i + 1].x - p.x; const dz2 = pts[i + 1].z - p.z;
        const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2) || 1;
        const nx2 = -dz2 / len2; const nz2 = dx2 / len2;

        nx = (nx1 + nx2) / 2; nz = (nz1 + nz2) / 2;
        const nLen = Math.sqrt(nx * nx + nz * nz) || 1;
        nx /= nLen; nz /= nLen;
      }

      leftSide.push(new THREE.Vector2(p.x + nx * half, -(p.z + nz * half)));
      rightSide.push(new THREE.Vector2(p.x - nx * half, -(p.z - nz * half)));
    }

    const shape = new THREE.Shape();
    shape.moveTo(leftSide[0].x, leftSide[0].y);
    for (let i = 1; i < leftSide.length; i++) shape.lineTo(leftSide[i].x, leftSide[i].y);
    for (let i = rightSide.length - 1; i >= 0; i--) shape.lineTo(rightSide[i].x, rightSide[i].y);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, pick(dueno, 'muro', matWall));
    mesh.userData = { dueno, superficie: 'muro', linea: { points: pts, thickness, height, y } };
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
  }

  // --- GENERADOR DE PUERTAS ---
  // Medidas propias de cada puerta (las define el diseñador del editor):
  //   w/h = abertura, sill = alféizar, fw = grosor del marco, depth = profundidad del marco,
  //   panel = 'single' | 'double' | 'none' (arco sin hoja), angle = apertura de la hoja en grados.
  // fill = true tapa la abertura en negro (solo cuando la puerta NO está en un muro de sala,
  // porque en los muros de sala el motor abre un hueco real).
  function createDoor(d, fill = true) {
    const w = d.w || 1.5; const h = d.h || 3.6; const y = (d.y || 0) + (d.sill || 0);
    const mode = d.panel || (d.double ? 'double' : 'single');
    const isDouble = mode === 'double'; const panelW = isDouble ? w / 2 : w;
    const frameThick = d.fw != null ? d.fw : 0.1; const frameDepth = d.depth || 0.5;
    const openAngle = ((d.angle != null ? d.angle : 72) * Math.PI) / 180;

    if (d.ax === 'z') {
      createBox(frameDepth, h, frameThick, d.x, y + h / 2, d.z - w / 2, matDoorFrame, d.id, 'marco');
      createBox(frameDepth, h, frameThick, d.x, y + h / 2, d.z + w / 2, matDoorFrame, d.id, 'marco');
      createBox(frameDepth, frameThick, w, d.x, y + h, d.z, matDoorFrame, d.id, 'marco');
      if (fill && mode !== 'none') createBox(0.1, h, w, d.x, y + h / 2, d.z, matDoorHole);
      if (mode === 'none') return;

      const hingeZ = d.hinge === 'left' ? d.z - w / 2 + frameThick / 2 : d.z + w / 2 - frameThick / 2;
      const dir = d.hinge === 'left' ? 1 : -1;
      const angle = d.swing === 'in' ? openAngle : -openAngle;

      const pivot = new THREE.Group();
      pivot.position.set(d.x, y, hingeZ); pivot.rotation.y = dir * angle; root.add(pivot);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.1, panelW), pick(d.id, 'hoja', matDoorPanel)); panel.userData = { dueno: d.id, superficie: 'hoja' };
      panel.position.set(0, h / 2, dir * panelW / 2); panel.castShadow = true; pivot.add(panel);

      if (isDouble) {
        const pivot2 = new THREE.Group(); pivot2.position.set(d.x, y, d.z + w / 2 - frameThick / 2);
        pivot2.rotation.y = -dir * angle; root.add(pivot2);
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, h - 0.1, panelW), pick(d.id, 'hoja', matDoorPanel)); panel2.userData = { dueno: d.id, superficie: 'hoja' };
        panel2.position.set(0, h / 2, -dir * panelW / 2); panel2.castShadow = true; pivot2.add(panel2);
      }
    } else {
      createBox(frameThick, h, frameDepth, d.x - w / 2, y + h / 2, d.z, matDoorFrame, d.id, 'marco');
      createBox(frameThick, h, frameDepth, d.x + w / 2, y + h / 2, d.z, matDoorFrame, d.id, 'marco');
      createBox(w, frameThick, frameDepth, d.x, y + h, d.z, matDoorFrame, d.id, 'marco');
      if (fill && mode !== 'none') createBox(w, h, 0.1, d.x, y + h / 2, d.z, matDoorHole);
      if (mode === 'none') return;

      const hingeX = d.hinge === 'left' ? d.x - w / 2 + frameThick / 2 : d.x + w / 2 - frameThick / 2;
      const dir = d.hinge === 'left' ? 1 : -1;
      const angle = d.swing === 'in' ? -openAngle : openAngle;

      const pivot = new THREE.Group();
      pivot.position.set(hingeX, y, d.z); pivot.rotation.y = dir * angle; root.add(pivot);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h - 0.1, 0.08), pick(d.id, 'hoja', matDoorPanel)); panel.userData = { dueno: d.id, superficie: 'hoja' };
      panel.position.set(dir * panelW / 2, h / 2, 0); panel.castShadow = true; pivot.add(panel);

      if (isDouble) {
        const pivot2 = new THREE.Group(); pivot2.position.set(d.x + w / 2 - frameThick / 2, y, d.z);
        pivot2.rotation.y = -dir * angle; root.add(pivot2);
        const panel2 = new THREE.Mesh(new THREE.BoxGeometry(panelW, h - 0.1, 0.08), pick(d.id, 'hoja', matDoorPanel)); panel2.userData = { dueno: d.id, superficie: 'hoja' };
        panel2.position.set(-dir * panelW / 2, h / 2, 0); panel2.castShadow = true; pivot2.add(panel2);
      }
    }
  }

  // ---------- PREPARACIÓN: salas rectangulares, huecos y losas ----------
  const allHoles = (json.holes || []).map(norm);
  const isPoly = (r) => r.points && r.points.length > 2;
  const isElev = (r) => r.type === 'rampa' || r.type === 'escalera';

  const rects = (json.rooms || []).filter(r => !isPoly(r)).map(norm);
  const holesAt = (y) => allHoles.filter(h => Math.abs(h.y - y) < 0.1);

  // Trozos de piso de cada sala (rectángulo menos sus huecos)
  const floorPieces = new Map();
  rects.forEach(r => {
    if (isElev(r)) return;
    floorPieces.set(r, rectSubtract(r, holesAt(r.y)));
  });

  const topOf = (r) => (r.y2 != null ? r.y2 : r.y + 4);
  const overlapY = (a, b) => overlapLen(a.y, topOf(a), b.y, topOf(b)) > 0.1;

  // Puertas que caen sobre un muro de sala: ahí se abre un hueco real (sin tapa negra)
  const cutDoors = new Set();

  // ---------- SALAS POLIGONALES (patios libres) ----------
  (json.rooms || []).filter(isPoly).forEach(r => {
    const cleanPoints = [];
    for (let i = 0; i < r.points.length; i++) {
      const p = r.points[i];
      const last = cleanPoints[cleanPoints.length - 1];
      if (!last || last.x !== p.x || last.z !== p.z) cleanPoints.push(p);
    }
    if (cleanPoints.length > 2 &&
        cleanPoints[0].x === cleanPoints[cleanPoints.length - 1].x &&
        cleanPoints[0].z === cleanPoints[cleanPoints.length - 1].z) cleanPoints.pop();

    const shape = new THREE.Shape();
    shape.moveTo(cleanPoints[0].x, -cleanPoints[0].z);
    for (let i = 1; i < cleanPoints.length; i++) shape.lineTo(cleanPoints[i].x, -cleanPoints[i].z);

    holesAt(r.y).forEach(h => {
      const path = new THREE.Path();
      path.moveTo(h.x0, -h.z0); path.lineTo(h.x1, -h.z0); path.lineTo(h.x1, -h.z1); path.lineTo(h.x0, -h.z1); path.lineTo(h.x0, -h.z0);
      shape.holes.push(path);
    });

    const geo = new THREE.ExtrudeGeometry(shape, { depth: T_SLAB, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, pick(r.id, 'piso', matFloor));
    mesh.userData = { dueno: r.id, superficie: 'piso' };
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = r.y;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  });

  // ---------- SALAS RECTANGULARES, RAMPAS Y ESCALERAS ----------
  rects.forEach(r => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const cx = r.x0 + w / 2, cz = r.z0 + d / 2;
    const dir = r.dir || '+x';

    // Superficie caminable de un piso = y + T_SLAB/2
    const half = T_SLAB / 2;

    if (r.type === 'rampa') {
      const rise = (r.y2 != null ? r.y2 : r.y + 3) - r.y;
      const length = dir.includes('z') ? d : w;
      const theta = Math.atan2(rise, length);
      const hypot = Math.sqrt(length * length + rise * rise);
      const geo = new THREE.BoxGeometry(dir.includes('z') ? w : hypot, T_SLAB, dir.includes('z') ? hypot : d);
      uvMetros(geo);
      const ramp = new THREE.Mesh(geo, pick(r.id, 'rampa', matRampa));
      ramp.userData = { dueno: r.id, superficie: 'rampa' };
      // La cara superior va de (y + half) a (y2 + half): enrasada con los pisos
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
      const baseY = r.y - half; // los escalones son sólidos hasta la base
      for (let i = 0; i < steps; i++) {
        // El último escalón queda exactamente a la altura del piso superior
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
        createBox(sw, h, sd, sx, baseY + h / 2, sz, matEscalera, r.id, 'escalera');
      }
      return;
    }

    // --- Piso (ya sin huecos) ---
    const floorMat = r.y > 3 ? matHighFloor : matFloor;
    floorPieces.get(r).forEach(p => slabBox(p, r.y, floorMat, r.id, 'piso'));

    // --- Techo: se le resta lo que ya cubre el piso de otra sala en esa misma altura ---
    if (r.y2 != null) {
      const cutters = holesAt(r.y).slice();
      rects.forEach(o => {
        if (o === r || isElev(o)) return;
        if (Math.abs(o.y - r.y2) < 0.1) cutters.push(...floorPieces.get(o));
      });
      rectSubtract(r, cutters).forEach(p => slabBox(p, r.y2, matRoof, r.id, 'techo'));
    }

    // --- Paredes: sin muros entre salas cerradas que comparten borde ---
    if (r.type === 'sala' && !r.open) {
      const wh = topOf(r) - r.y;
      const ht = T_WALL / 2;
      const others = rects.filter(o => o !== r && o.type === 'sala' && !o.open && overlapY(r, o));

      const touchesX = (xEdge, side) => others.filter(o =>
        Math.abs((side === 'left' ? o.x1 : o.x0) - xEdge) < EPS && overlapLen(r.z0, r.z1, o.z0, o.z1) > EPS);
      const touchesZ = (zEdge, side) => others.filter(o =>
        Math.abs((side === 'top' ? o.z1 : o.z0) - zEdge) < EPS && overlapLen(r.x0, r.x1, o.x0, o.x1) > EPS);

      const nL = touchesX(r.x0, 'left'), nR = touchesX(r.x1, 'right');
      const nT = touchesZ(r.z0, 'top'), nB = touchesZ(r.z1, 'bottom');

      // Puertas colocadas sobre un borde de esta sala (ax 'x' = muro a lo largo de X, 'z' = a lo largo de Z)
      const doorsOnEdge = (ax, coord, a0, a1) => (json.doors || []).filter(dr => {
        if (Math.abs((dr.y || 0) - r.y) > 0.5) return false;
        return ax === 'x'
          ? dr.ax !== 'z' && Math.abs(dr.z - coord) < 0.3 && dr.x >= a0 - EPS && dr.x <= a1 + EPS
          : dr.ax === 'z' && Math.abs(dr.x - coord) < 0.3 && dr.z >= a0 - EPS && dr.z <= a1 + EPS;
      });
      // Emite los tramos de muro recortando la abertura de cada puerta; deja dintel (arriba) y antepecho (abajo)
      const emitWall = (segs, ds, ax, make) => {
        let rest = segs;
        ds.forEach(dr => {
          cutDoors.add(dr);
          const ow = dr.w || 1.5, oh = dr.h || 3.6, sill = dr.sill || 0;
          const c = ax === 'x' ? dr.x : dr.z;
          const dlo = c - ow / 2, dhi = c + ow / 2;
          const before = rest;
          rest = subtractInterval(rest, dlo, dhi);
          before.forEach(([a, b]) => {
            const lo2 = Math.max(a, dlo), hi2 = Math.min(b, dhi);
            if (hi2 - lo2 <= 0.05) return;
            const yb = r.y + sill, yt = r.y + sill + oh;
            if (sill > 0.02) make(lo2, hi2, r.y, yb);
            if (r.y + wh - yt > 0.02) make(lo2, hi2, yt, r.y + wh);
          });
        });
        rest.forEach(([a, b]) => make(a, b, r.y, r.y + wh));
      };

      // Muros horizontales (a lo largo de X): se alargan en las esquinas libres
      const lo = r.x0 - (nL.length ? 0 : ht);
      const hi = r.x1 + (nR.length ? 0 : ht);
      [[r.z0, nT], [r.z1, nB]].forEach(([z, neigh]) => {
        let segs = [[lo, hi]];
        neigh.forEach(o => { segs = subtractInterval(segs, Math.max(r.x0, o.x0), Math.min(r.x1, o.x1)); });
        emitWall(segs, doorsOnEdge('x', z, r.x0, r.x1), 'x', (a, b, y0, y1) => {
          if (b - a > 0.05 && y1 - y0 > 0.02) createBox(b - a, y1 - y0, T_WALL, (a + b) / 2, (y0 + y1) / 2, z, matWall, r.id, 'muro');
        });
      });

      // Muros verticales (a lo largo de Z): entre las esquinas, para no duplicar volumen
      [[r.x0, nL], [r.x1, nR]].forEach(([x, neigh]) => {
        let segs = [[r.z0 + ht, r.z1 - ht]];
        neigh.forEach(o => { segs = subtractInterval(segs, Math.max(r.z0, o.z0), Math.min(r.z1, o.z1)); });
        emitWall(segs, doorsOnEdge('z', x, r.z0, r.z1), 'z', (a, b, y0, y1) => {
          if (b - a > 0.05 && y1 - y0 > 0.02) createBox(T_WALL, y1 - y0, b - a, x, (y0 + y1) / 2, (a + b) / 2, matWall, r.id, 'muro');
        });
      });
    }
  });

  // --- PROCESAR MUROS CONTINUOS (WALLS) ---
  if (json.walls) {
    json.walls.forEach(w => {
      if (w.points && w.points.length >= 2) {
        crearMuroDesdeLinea(w.points, T_WALL, w.h || 3, w.y || 0, w.id);
      }
    });
  }

  // --- PROCESAR PUERTAS (DOORS) ---
  if (json.doors) {
    json.doors.forEach(d => createDoor(d, !cutDoors.has(d)));
  }

  return root;
}

// Quita un mapa de la escena liberando memoria (para recargas en vivo)
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
