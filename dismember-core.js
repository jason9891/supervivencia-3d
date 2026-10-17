// dismember-core.js — reglas puras (sin three.js) para desmembrar al monstruo: qué partes se cortan, cómo se reparte la malla
// y cómo cae la pieza suelta (cuerpo rígido con suelo, rebote, rodar y reposo). Se prueba con Node sin navegador.
//
// Cortar = repartir los triángulos de la malla según los pesos de hueso:
//   · un vértice es "de la parte" si los huesos de esa parte (p. ej. el brazo y sus dedos) suman ≥ THRESHOLD de su peso;
//   · el triángulo se va con la mayoría de sus vértices (sin huecos ni solapes entre cuerpo y pieza);
//   · en el cuerpo, los pesos de esos huesos pasan al hueso donde se une la parte (hombro / cuello): el muñón queda rígido, no se estira.

export const THRESHOLD = 0.5;

// Partes que se pueden cortar. `bones`: huesos raíz (se toma todo su subárbol, mandíbula incluida);
// `attach`: hueso del cuerpo al que queda unido el muñón. Los nombres no llevan el prefijo mixamorig.
export const PARTS = {
  Head:     { bones: ['Head'],     attach: 'Neck',          label: 'cabeza',      restitution: 0.18, spurt: 46, push: 0.9, up: 1.3 },
  LeftArm:  { bones: ['LeftArm'],  attach: 'LeftShoulder',  label: 'brazo izq.',  restitution: 0.22, spurt: 26, push: 1.0, up: 1.4 },
  RightArm: { bones: ['RightArm'], attach: 'RightShoulder', label: 'brazo der.',  restitution: 0.22, spurt: 26, push: 1.0, up: 1.4 },
};

export const bareName = (n) => (n || '').replace(/^mixamorig[:._\-\s]*/i, '');

/** Índices de los huesos del subárbol de `rootIdx`. parents[i] = índice del padre (o −1). */
export function subtree(parents, rootIdx) {
  const out = new Set([rootIdx]);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = 0; i < parents.length; i++) if (!out.has(i) && out.has(parents[i])) { out.add(i); grew = true; }
  }
  return out;
}

/** Peso (0..1) que cada vértice pone en los huesos de `set` (4 influencias por vértice). */
export function partWeight(skinIndex, skinWeight, set, nVerts) {
  const out = new Float32Array(nVerts);
  for (let v = 0; v < nVerts; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) if (set.has(skinIndex[v * 4 + k])) s += skinWeight[v * 4 + k];
    out[v] = s;
  }
  return out;
}

/** Reparte los triángulos: `piece` (mayoría de vértices de la parte) y `body` (el resto). `boundary` = vértices compartidos por ambos lados. */
export function splitTriangles(index, pw, thr = THRESHOLD) {
  const body = [], piece = [];
  const inB = new Set(), inP = new Set();
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const n = (pw[a] >= thr) + (pw[b] >= thr) + (pw[c] >= thr);
    if (n >= 2) { piece.push(a, b, c); inP.add(a); inP.add(b); inP.add(c); }
    else { body.push(a, b, c); inB.add(a); inB.add(b); inB.add(c); }
  }
  const boundary = [];
  for (const v of inP) if (inB.has(v)) boundary.push(v);
  return { body: Uint32Array.from(body), piece: Uint32Array.from(piece), boundary };
}

/** Pesos del cuerpo tras el corte: lo que los huesos de `set` ponían en un vértice pasa al hueso `attachIdx` (máx. 4 influencias). */
export function remapSkin(skinIndex, skinWeight, set, attachIdx) {
  const n = skinIndex.length / 4, oi = new Uint16Array(skinIndex), ow = new Float32Array(skinWeight);
  for (let v = 0; v < n; v++) {
    let moved = 0, slot = -1, has = -1;
    for (let k = 0; k < 4; k++) {
      const i = v * 4 + k;
      if (oi[i] === attachIdx && ow[i] > 0) has = k;
      if (set.has(oi[i]) && ow[i] > 0) { moved += ow[i]; ow[i] = 0; if (slot < 0) slot = k; }
    }
    if (moved <= 0) continue;
    const k = has >= 0 ? has : slot;
    oi[v * 4 + k] = attachIdx; ow[v * 4 + k] += moved;
  }
  return { index: oi, weight: ow };
}

/** Identificador de vértice por posición (las costuras de UV duplican vértices: aquí valen lo mismo). positions = x,y,z. */
export function weldIds(positions, q = 1e5) {
  const n = positions.length / 3, ids = new Int32Array(n), seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(positions[i * 3] * q) + ',' + Math.round(positions[i * 3 + 1] * q) + ',' + Math.round(positions[i * 3 + 2] * q);
    let id = seen.get(k); if (id === undefined) { id = seen.size; seen.set(k, id); }
    ids[i] = id;
  }
  return ids;
}

/**
 * Lazos del borde abierto de un conjunto de triángulos (las aristas que solo tiene un triángulo): son el contorno del corte.
 * Devuelve listas de índices de vértice (uno por posición soldada), en el orden en que se recorre cada lazo.
 */
export function openLoops(tris, weld) {
  const edges = new Map();   // "a|b" (a<b) → cuenta
  const rep = new Map();     // id soldado → un índice de vértice
  for (let t = 0; t < tris.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const va = tris[t + k], vb = tris[t + (k + 1) % 3], a = weld[va], b = weld[vb];
      if (a === b) continue;
      if (!rep.has(a)) rep.set(a, va); if (!rep.has(b)) rep.set(b, vb);
      const key = a < b ? a + '|' + b : b + '|' + a;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const [key, c] of edges) if (c === 1) { const [a, b] = key.split('|').map(Number); link(a, b); link(b, a); }
  const loops = [], used = new Set();
  const ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  for (const start of adj.keys()) {
    for (const first of adj.get(start)) {
      if (used.has(ek(start, first))) continue;
      const loop = [start]; let prev = start, cur = first; used.add(ek(start, first));
      while (cur !== start) {
        loop.push(cur);
        let next = null;
        for (const nb of adj.get(cur)) if (nb !== prev && !used.has(ek(cur, nb))) { next = nb; break; }
        if (next === null) break;
        used.add(ek(cur, next)); prev = cur; cur = next;
      }
      if (loop.length >= 3) loops.push(loop.map((id) => rep.get(id)));
    }
  }
  return loops.sort((a, b) => b.length - a.length);
}

/** Normales suaves por posición soldada (así no se ve la costura de UV en la pieza suelta). positions = x,y,z; index = triángulos. */
export function weldedNormals(positions, index, weld) {
  const nW = (weld.length ? Math.max(...weld) : -1) + 1, acc = new Float64Array(nW * 3), n = positions.length / 3, out = new Float32Array(n * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = cross(e1, e2);   // proporcional al área: los triángulos grandes pesan más
    for (const v of [index[t], index[t + 1], index[t + 2]]) { const w = weld[v] * 3; acc[w] += f[0]; acc[w + 1] += f[1]; acc[w + 2] += f[2]; }
  }
  for (let v = 0; v < n; v++) {
    const w = weld[v] * 3, l = Math.hypot(acc[w], acc[w + 1], acc[w + 2]) || 1;
    out[v * 3] = acc[w] / l; out[v * 3 + 1] = acc[w + 1] / l; out[v * 3 + 2] = acc[w + 2] / l;
  }
  return out;
}

/** Pesos de piel promedio de varios vértices (máx. 4 influencias, normalizadas): para el vértice central de una tapa. */
export function averageSkin(skinIndex, skinWeight, verts) {
  const acc = new Map();
  for (const v of verts) for (let k = 0; k < 4; k++) { const w = skinWeight[v * 4 + k]; if (w > 0) acc.set(skinIndex[v * 4 + k], (acc.get(skinIndex[v * 4 + k]) || 0) + w); }
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = top.reduce((t, e) => t + e[1], 0) || 1;
  const idx = [0, 0, 0, 0], wt = [0, 0, 0, 0];
  top.forEach(([i, w], k) => { idx[k] = i; wt[k] = w / s; });
  return { idx, wt };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Tapa del corte: centro, eje (del corte hacia la parte) y radio, a partir de los vértices del borde y el centroide de la parte. */
export function capFrom(boundaryPts, partCentroid) {
  const n = boundaryPts.length || 1;
  const c = [0, 0, 0];
  for (const p of boundaryPts) { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; }
  const axis = norm(sub(partCentroid, c));
  let r = 0;
  for (const p of boundaryPts) {
    const d = sub(p, c), a = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
    r += Math.hypot(d[0] - axis[0] * a, d[1] - axis[1] * a, d[2] - axis[2] * a) / n;   // distancia al eje, promedio
  }
  return { center: c, axis, radius: r };
}

// ---------------------------------------------------------------- cuerpo rígido (pieza suelta)
export const GRAVITY = 9.8;
const rot = (q, v) => {   // rota v por el cuaternión q = [x,y,z,w]
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 162 direcciones (icosaedro subdividido dos veces, separación ≈16°): los puntos más extremos aproximan la envolvente convexa con precisión (~1 % del radio).
const DIRS = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < 2; l++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { cache.set(k, V.length); V.push(norm([V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]])); } return cache.get(k); };
    for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = nf;
  }
  return V;
})();

/** Puntos de contacto: los vértices más extremos en cada dirección (sin repetir). `pts` = Float32Array x,y,z relativo al centro de masa. */
export function hullSamples(pts) {
  const n = pts.length / 3, used = new Set();
  for (const d of DIRS) {
    let best = -1, bv = -Infinity;
    for (let i = 0; i < n; i++) { const v = pts[i * 3] * d[0] + pts[i * 3 + 1] * d[1] + pts[i * 3 + 2] * d[2]; if (v > bv) { bv = v; best = i; } }
    if (best >= 0) used.add(best);
  }
  return [...used].map((i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]);
}

/**
 * Cuerpo rígido con suelo plano en y=floorY. `pts`: vértices relativos al centro de masa (Float32Array).
 * Estado en `.p` (posición), `.q` (cuaternión x,y,z,w), `.v`, `.w`. step(dt) lo avanza; `.asleep` cuando queda quieto.
 */
export function createRigid({ pts, pos, quat = [0, 0, 0, 1], vel = [0, 0, 0], angVel = [0, 0, 0], floorY = 0, restitution = 0.22, friction = 0.65, gravity = GRAVITY }) {
  const samples = hullSamples(pts);
  let r2 = 0; const n = pts.length / 3;
  for (let i = 0; i < n; i++) r2 += pts[i * 3] ** 2 + pts[i * 3 + 1] ** 2 + pts[i * 3 + 2] ** 2;
  const inertia = Math.max(1e-6, (2 / 3) * (r2 / n));   // masa 1: I ≈ (2/3)·media(|r|²) (nube de puntos)
  const b = { p: [...pos], q: [...quat], v: [...vel], w: [...angVel], floorY, samples, inertia, asleep: false, quiet: 0, contact: false, since: 9, ground: 0, bounces: 0, t: 0, stuck: 0, obDeepStep: 0 };

  // impulso de contacto en el punto r (relativo al centro de masa) con normal n (unitaria): rebote + rozamiento de Coulomb
  function contactImpulse(r, n, rest) {
    const vp = [b.v[0] + b.w[1] * r[2] - b.w[2] * r[1], b.v[1] + b.w[2] * r[0] - b.w[0] * r[2], b.v[2] + b.w[0] * r[1] - b.w[1] * r[0]];
    const vn = dot(vp, n);
    if (vn >= 0) return;
    const rn = cross(r, n), kn = 1 + dot(rn, rn) / inertia;
    const e = -vn > 0.9 ? rest : 0;   // rebota solo si llega con fuerza; si no, se apoya
    if (e > 0) b.bounces++;
    const jn = -(1 + e) * vn / kn, J = [n[0] * jn, n[1] * jn, n[2] * jn], tq = cross(r, J);
    for (let i = 0; i < 3; i++) { b.v[i] += J[i]; b.w[i] += tq[i] / inertia; }
    const vt = [vp[0] - n[0] * vn, vp[1] - n[1] * vn, vp[2] - n[2] * vn], vtl = Math.hypot(vt[0], vt[1], vt[2]);
    if (vtl > 1e-6) {
      const td = [-vt[0] / vtl, -vt[1] / vtl, -vt[2] / vtl], rt = cross(r, td), kt = 1 + dot(rt, rt) / inertia, jt = Math.min(friction * jn, vtl / kt);
      const Jt = [td[0] * jt, td[1] * jt, td[2] * jt], tq2 = cross(r, Jt);
      for (let i = 0; i < 3; i++) { b.v[i] += Jt[i]; b.w[i] += tq2[i] / inertia; }
    }
  }

  function substep(h) {
    b.v[1] -= gravity * h;
    for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * h;
    const [wx, wy, wz] = b.w, q = b.q;   // q += ½·h·(0,ω)·q
    const dq = [0.5 * h * (wx * q[3] + wy * q[2] - wz * q[1]), 0.5 * h * (-wx * q[2] + wy * q[3] + wz * q[0]), 0.5 * h * (wx * q[1] - wy * q[0] + wz * q[3]), 0.5 * h * (-wx * q[0] - wy * q[1] - wz * q[2])];
    q[0] += dq[0]; q[1] += dq[1]; q[2] += dq[2]; q[3] += dq[3];
    const l = Math.hypot(q[0], q[1], q[2], q[3]); q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
    // el cuerpo (obstáculo fijo): nubes de puntos con radio; la pieza no lo atraviesa. Se activa cuando ya se separó del muñón.
    const ob = b.obstacles;
    b.obDeepStep = 0;
    if (ob && ob.armed) {
      for (let pass = 0; pass < 2; pass++) {
        let deep = 0, dn = null;
        for (const s of samples) {
          const r = rot(b.q, s), wx2 = b.p[0] + r[0], wy2 = b.p[1] + r[1], wz2 = b.p[2] + r[2];
          for (let j = 0, nO = ob.pts.length / 3; j < nO; j++) {
            if (ob.ignore[j]) continue;
            const dx = wx2 - ob.pts[j * 3], dy = wy2 - ob.pts[j * 3 + 1], dz = wz2 - ob.pts[j * 3 + 2], d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= ob.r * ob.r) continue;
            const d = Math.sqrt(d2) || 1e-6, n = d2 > 1e-12 ? [dx / d, dy / d, dz / d] : [0, 1, 0];
            contactImpulse(r, n, 0.1);
            if (ob.r - d > deep) { deep = ob.r - d; dn = n; }
          }
        }
        if (deep > b.obDeepStep) b.obDeepStep = deep;
        if (dn) { b.p[0] += dn[0] * deep; b.p[1] += dn[1] * deep; b.p[2] += dn[2] * deep; b.touching = true; } else break;
      }
    }
    b.contact = false;
    let deepest = 0;
    for (let pass = 0; pass < 3; pass++) {
      for (const s of samples) {
        const r = rot(b.q, s), y = b.p[1] + r[1] - b.floorY;
        if (y >= 0) continue;
        b.contact = true; deepest = Math.max(deepest, -y);
        contactImpulse(r, [0, 1, 0], restitution);
      }
    }
    if (deepest > 0) b.p[1] += deepest;   // nunca por debajo del suelo
    b.since = b.contact ? 0 : b.since + h;
    if (b.heavy) { const k = Math.exp(-18 * h); b.v[0] *= k; b.v[1] *= k; b.v[2] *= k; b.w[0] *= k; b.w[1] *= k; b.w[2] *= k; }
    if (b.since < 0.12) {   // sobre el suelo (con un pequeño margen para el contacto que parpadea): rueda y se frena
      const k = Math.exp(-2.2 * h); b.w[0] *= k; b.w[1] *= k; b.w[2] *= k; b.v[0] *= Math.exp(-0.5 * h); b.v[2] *= Math.exp(-0.5 * h);
      if (Math.hypot(b.v[0], b.v[2]) < 0.6 && Math.hypot(b.w[0], b.w[1], b.w[2]) < 2.5) {   // casi parada: amortiguación fuerte para que se asiente en vez de temblar
        const r = Math.exp(-7 * h); b.v[0] *= r; b.v[2] *= r; b.w[0] *= r; b.w[1] *= r; b.w[2] *= r;
      }
    }
  }

  /**
   * Cuerpo fijo contra el que choca la pieza: nube de puntos `pts` (Float32Array x,y,z del mundo) de radio `r`. Se vuelve a pasar cada cuadro (el cuerpo se mueve);
   * a los `armAfter` segundos los puntos que ya solapaban a la pieza (el borde del muñón) se ignoran para siempre, y desde entonces choca con el resto.
   */
  b.setObstacle = function setObstacle(pts, r, armAfter = 0.15) {
    const ob = b.obstacles || (b.obstacles = { pts: new Float32Array(0), from: null, target: null, r, armed: false, ignore: new Uint8Array(0) });
    ob.r = r;
    // El cuerpo se mueve rápido (cae animado, ~10 cm por fotograma) y la pieza se simula a 240 Hz: los puntos del cuerpo se interpolan entre fotogramas dentro de los subpasos
    // (si no, un punto de la pieza "salta" al interior hueco del torso, donde ningún punto de superficie queda a menos de `r`, y atraviesa sin chocar).
    if (!ob.target || ob.target.length !== pts.length) { ob.from = pts; ob.pts = Float32Array.from(pts); }
    else ob.from = ob.target;
    ob.target = pts;
    if (ob.ignore.length !== pts.length / 3) ob.ignore = new Uint8Array(pts.length / 3);
    if (!ob.armed && b.t >= armAfter) {
      for (const s of samples) {
        const w = b.world(s);
        for (let j = 0; j < pts.length / 3; j++) if (Math.hypot(w[0] - pts[j * 3], w[1] - pts[j * 3 + 1], w[2] - pts[j * 3 + 2]) < r * 1.6) ob.ignore[j] = 1;
      }
      ob.armed = true;
    }
  };
  /** Penetración máxima (m) de los puntos de contacto de la pieza en la nube `pts` de radio `r` (0 si no se tocan). Sirve para comprobar una pieza dormida. */
  b.penetration = function penetration(pts, r) {
    let deep = 0;
    for (const s of samples) {
      const w = b.world(s);
      for (let j = 0; j < pts.length / 3; j++) {
        if (b.obstacles && b.obstacles.ignore[j]) continue;
        const d = Math.hypot(w[0] - pts[j * 3], w[1] - pts[j * 3 + 1], w[2] - pts[j * 3 + 2]);
        if (r - d > deep) deep = r - d;
      }
    }
    return deep;
  };
  /** Desliza la pieza en horizontal (dirección unitaria `dir` = [x,z]) a `speed` m/s y la despierta: así sale de debajo de un cuerpo que la aplasta. */
  b.squeezeOut = function squeezeOut(dir, speed, dt) {
    b.p[0] += dir[0] * speed * dt; b.p[2] += dir[1] * speed * dt;
    b.v[0] = dir[0] * speed * 0.5; b.v[2] = dir[1] * speed * 0.5; b.asleep = false; b.quiet = 0; b.ground = 0;
  };
  b.step = function step(dt) {
    if (b.asleep) return b;
    const n2 = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n2;
    const ob0 = b.obstacles;
    for (let i = 0; i < n2; i++) {
      if (ob0 && ob0.target) { const k = (i + 1) / n2, a = ob0.from, c = ob0.target, o = ob0.pts; for (let j = 0; j < o.length; j++) o[j] = a[j] + (c[j] - a[j]) * k; }
      substep(h);
    }
    b.t += dt;
    // encajada: lleva un rato penetrando el cuerpo (p. ej. el torso animado cae sobre ella y no hay forma de resolverlo con impulsos)
    const ob2 = b.obstacles;
    if (ob2 && ob2.armed && b.obDeepStep > ob2.r * 0.45) b.stuck += dt; else b.stuck = Math.max(0, b.stuck - dt * 2);
    const sp = Math.hypot(b.v[0], b.v[1], b.v[2]), wsp = Math.hypot(b.w[0], b.w[1], b.w[2]);
    if (b.since < 0.12 && sp < 0.45 && wsp < 1.6) b.quiet += dt; else b.quiet = 0;
    if (b.since < 0.12) b.ground += dt;
    if (b.quiet > 0.3 || (b.ground > 1.0 && sp < 1.2)) {   // quieto, o lleva ≥1 s en el suelo sin gran velocidad (las piezas largas se balancean más)
      // asentarse: un segundo de caída sobreamortiguada lleva la pieza a una postura estable (en vez de dormirse a medio balanceo)
      b.heavy = true; for (let i = 0; i < 240; i++) substep(1 / 240); b.heavy = false;
      b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0];
    }
    return b;
  };
  /** Posición en el mundo de un punto local. */
  b.world = (pt) => { const r = rot(b.q, pt); return [b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]]; };
  /** Eleva la pieza lo justo para que NINGÚN vértice (no solo los de contacto) quede bajo el suelo. Devuelve cuánto subió. */
  b.settle = function settle(all) {
    let low = 0;
    for (let i = 0; i < all.length; i += 3) { const y = b.p[1] + rot(b.q, [all[i], all[i + 1], all[i + 2]])[1] - b.floorY; if (y < low) low = y; }
    if (low < 0) b.p[1] -= low;
    return -low;
  };
  return b;
}
