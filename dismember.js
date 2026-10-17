// dismember.js — desmembramiento del monstruo (cabeza o brazo) sobre su SkinnedMesh real.
// No toca el mapa ni el modelo visual del héroe: solo la malla del monstruo, y todo es reversible (restore()).
//
//   const dis = createDismember({ model, mesh });  dis.sever('Head' | 'LeftArm' | 'RightArm'); dis.update(dt); dis.restore();
//
// Cortar = repartir los triángulos por pesos de hueso (dismember-core.js):
//   · la pieza suelta es una malla rígida con la pose congelada del instante del corte, con su propia física (suelo, rebote, rodar, reposo);
//   · el cuerpo conserva su malla animada; el muñón queda rígido al hueso de unión y se cierra con un parche de carne que sigue el contorno real del corte;
//   · un chorro de partículas sale del muñón y de la pieza, y salpica el suelo.
import * as THREE from 'three';
import * as D from './dismember-core.js';

const FLESH = 0x6d0f0f;
const MAX_DROPS = 220;

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createDismember({ model, mesh, seed = 7 }) {
  const g = mesh.geometry, sk = mesh.skeleton, bones = sk.bones;
  const nV = g.attributes.position.count;
  const parents = bones.map((b) => bones.indexOf(b.parent));
  const boneIdx = (name) => bones.findIndex((b) => D.bareName(b.name) === name);
  const pos0 = g.attributes.position.array.slice();
  const weld = D.weldIds(pos0);
  const snap = { index: g.index.array.slice(), si: g.attributes.skinIndex.array.slice(), sw: g.attributes.skinWeight.array.slice() };
  const cur = { index: snap.index.slice(), si: snap.si.slice(), sw: snap.sw.slice() };
  const severed = new Map();       // parte → { piece, capBody, ... }
  const pieces = [];
  const rand = mulberry32(seed);
  const scene = () => { let s = model; while (s.parent) s = s.parent; return s; };
  const mat = [].concat(mesh.material)[0];
  const redMat = () => new THREE.MeshStandardMaterial({ color: FLESH, roughness: 0.38, metalness: 0.0, side: THREE.DoubleSide });

  // ---- gotas de sangre (un solo Points compartido)
  const drops = { p: new Float32Array(MAX_DROPS * 3), v: new Float32Array(MAX_DROPS * 3), life: new Float32Array(MAX_DROPS), floor: new Float32Array(MAX_DROPS), n: 0, cursor: 0 };
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(drops.p, 3));
  const dropPts = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0x8a1010, size: 0.045, sizeAttenuation: true }));
  dropPts.frustumCulled = false; dropPts.visible = false;
  const emitters = [];
  function emit(p, dir, speed, floorY) {
    const i = drops.cursor; drops.cursor = (drops.cursor + 1) % MAX_DROPS; drops.n = Math.min(MAX_DROPS, drops.n + 1);
    const s = speed * (0.55 + 0.9 * rand());
    drops.p.set([p.x, p.y, p.z], i * 3);
    drops.v.set([dir.x * s + (rand() - 0.5) * 0.9, dir.y * s + (rand() - 0.3) * 0.9, dir.z * s + (rand() - 0.5) * 0.9], i * 3);
    drops.life[i] = 4 + rand() * 2; drops.floor[i] = floorY;
  }
  function stepDrops(dt) {
    let alive = 0;
    for (let i = 0; i < drops.n; i++) {
      if (drops.life[i] <= 0) continue;
      alive++;
      drops.life[i] -= dt;
      const b = i * 3;
      if (drops.life[i] <= 0) { drops.p[b + 1] = -1000; continue; }
      if (drops.v[b + 1] === 0 && drops.v[b] === 0 && drops.v[b + 2] === 0) continue;   // ya en el suelo
      drops.v[b + 1] -= D.GRAVITY * dt;
      drops.p[b] += drops.v[b] * dt; drops.p[b + 1] += drops.v[b + 1] * dt; drops.p[b + 2] += drops.v[b + 2] * dt;
      if (drops.p[b + 1] <= drops.floor[i] + 0.004) { drops.p[b + 1] = drops.floor[i] + 0.004; drops.v[b] = drops.v[b + 1] = drops.v[b + 2] = 0; }
    }
    dropGeo.attributes.position.needsUpdate = true;
    dropGeo.setDrawRange(0, drops.n);
    dropPts.visible = alive > 0;
  }

  // ---- geometría auxiliar
  const _v = new THREE.Vector3();
  function skinnedWorld(vIdx) { mesh.getVertexPosition(vIdx, _v); return _v.applyMatrix4(mesh.matrixWorld).clone(); }

  function patchGeometry(loops, getPos) {
    // abanico desde el centroide de cada lazo: cierra el agujero siguiendo el contorno real del corte
    const P = [], I = [], src = [];
    for (const loop of loops) {
      if (loop.length < 3) continue;
      const c = [0, 0, 0]; for (const v of loop) { const p = getPos(v); c[0] += p[0] / loop.length; c[1] += p[1] / loop.length; c[2] += p[2] / loop.length; }
      const base = P.length / 3;
      for (const v of loop) { P.push(...getPos(v)); src.push(v); }
      P.push(...c); src.push(-1 - loop[0]);   // centro: se marca con índice negativo (usa el promedio del lazo)
      const ci = base + loop.length;
      for (let k = 0; k < loop.length; k++) I.push(base + k, base + (k + 1) % loop.length, ci);
    }
    return { P: new Float32Array(P), I: Uint32Array.from(I), src, loops };
  }

  // ---- el cuerpo como obstáculo: ~1400 vértices de su superficie (con la pose del momento) que la pieza no puede atravesar
  let collIdx = new Int32Array(0);
  const COLL_N = 1400;   // puntos de la superficie del cuerpo: densos para que la pieza no se apoye entre los dedos ni entre las espinas
  function pickCollidersFrom(index) {
    const seen = new Set(index), all = [...seen], stride = Math.max(1, Math.floor(all.length / COLL_N));
    collIdx = Int32Array.from(all.filter((_, i) => i % stride === 0));
  }
  const collPts = () => new Float32Array(collIdx.length * 3);
  function fillColliders(out) {
    for (let i = 0; i < collIdx.length; i++) { mesh.getVertexPosition(collIdx[i], _v); _v.applyMatrix4(mesh.matrixWorld); out[i * 3] = _v.x; out[i * 3 + 1] = _v.y; out[i * 3 + 2] = _v.z; }
    return out;
  }
  const worldScale = () => model.getWorldScale(new THREE.Vector3()).x;   // metros por unidad nativa del GLB

  // ---- cortar
  function sever(partName, opts = {}) {
    const def = D.PARTS[partName];
    if (!def || severed.has(partName)) return null;
    const rootI = boneIdx(def.bones[0]), attachI = boneIdx(def.attach);
    if (rootI < 0 || attachI < 0) return null;
    model.updateMatrixWorld(true); mesh.updateMatrixWorld(true);
    const set = D.subtree(parents, rootI);
    const pw = D.partWeight(cur.si, cur.sw, set, nV);
    const sp = D.splitTriangles(cur.index, pw);
    if (!sp.piece.length) return null;
    const loops = D.openLoops(sp.piece, weld);

    // 1) pieza suelta: vértices usados, en el mundo, con la pose del instante del corte
    const used = new Map(); const order = [];
    for (const v of sp.piece) if (!used.has(v)) { used.set(v, order.length); order.push(v); }
    const wp = new Map();   // posición en el mundo por vértice (la pieza y el parche la reutilizan)
    const worldOf = (v) => { let p = wp.get(v); if (!p) { p = skinnedWorld(v); wp.set(v, p); } return p; };
    const com = new THREE.Vector3();
    for (const v of order) com.add(worldOf(v));
    com.multiplyScalar(1 / order.length);
    const pPos = new Float32Array(order.length * 3), pUv = new Float32Array(order.length * 2);
    const uv = g.attributes.uv;
    order.forEach((v, k) => {
      const p = worldOf(v); pPos.set([p.x - com.x, p.y - com.y, p.z - com.z], k * 3);
      if (uv) pUv.set([uv.getX(v), uv.getY(v)], k * 2);
    });
    const pIdx = Uint32Array.from(sp.piece, (v) => used.get(v));
    const pWeld = Int32Array.from(order, (v) => weld[v]);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pg.setAttribute('normal', new THREE.BufferAttribute(D.weldedNormals(pPos, pIdx, pWeld), 3));
    if (uv) pg.setAttribute('uv', new THREE.BufferAttribute(pUv, 2));
    pg.setIndex(new THREE.BufferAttribute(pIdx, 1));
    const pm = new THREE.Mesh(pg, mat.clone());
    pm.castShadow = true; pm.receiveShadow = true; pm.frustumCulled = false;
    pm.position.copy(com);
    // tapa de la pieza (en su marco local)
    const pcap = patchGeometry(loops, (v) => { const p = worldOf(v); return [p.x - com.x, p.y - com.y, p.z - com.z]; });
    if (pcap.I.length) {
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(pcap.P, 3)); cg.setIndex(new THREE.BufferAttribute(pcap.I, 1)); cg.computeVertexNormals();
      const cm = new THREE.Mesh(cg, redMat()); cm.frustumCulled = false; cm.castShadow = true; pm.add(cm);
    }
    // contorno del corte: centro y eje (del corte hacia la parte), para el chorro y la dirección de salida
    const ring = loops.length ? loops[0].map((v) => { const p = worldOf(v); return [p.x, p.y, p.z]; }) : [[com.x, com.y, com.z]];
    const cap = D.capFrom(ring, [com.x, com.y, com.z]);

    // 2) cuerpo: sin los triángulos de la pieza; el muñón pasa a seguir al hueso de unión
    const rs = D.remapSkin(cur.si, cur.sw, set, attachI);
    cur.index = sp.body; cur.si = rs.index; cur.sw = rs.weight;
    g.setIndex(new THREE.BufferAttribute(cur.index, 1));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(cur.si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(cur.sw, 4));
    // parche del cuerpo: SkinnedMesh con el mismo esqueleto (posiciones de reposo del lazo)
    const bcap = patchGeometry(loops, (v) => [pos0[v * 3], pos0[v * 3 + 1], pos0[v * 3 + 2]]);
    let capBody = null;
    if (bcap.I.length) {
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(bcap.P, 3));
      const n = bcap.P.length / 3, ci = new Uint16Array(n * 4), cw = new Float32Array(n * 4);
      let o = 0;
      for (const loop of loops) {
        if (loop.length < 3) continue;
        for (const v of loop) { for (let k = 0; k < 4; k++) { ci[o * 4 + k] = cur.si[v * 4 + k]; cw[o * 4 + k] = cur.sw[v * 4 + k]; } o++; }
        const a = D.averageSkin(cur.si, cur.sw, loop);
        for (let k = 0; k < 4; k++) { ci[o * 4 + k] = a.idx[k]; cw[o * 4 + k] = a.wt[k]; } o++;
      }
      cg.setAttribute('skinIndex', new THREE.BufferAttribute(ci, 4)); cg.setAttribute('skinWeight', new THREE.BufferAttribute(cw, 4));
      cg.setIndex(new THREE.BufferAttribute(bcap.I, 1)); cg.computeVertexNormals();
      capBody = new THREE.SkinnedMesh(cg, redMat());
      capBody.name = 'muñón-' + partName;
      capBody.position.copy(mesh.position); capBody.quaternion.copy(mesh.quaternion); capBody.scale.copy(mesh.scale);
      capBody.frustumCulled = false; capBody.castShadow = true;
      (mesh.parent || model).add(capBody);
      capBody.updateMatrixWorld(true);
      capBody.bindMode = mesh.bindMode;
      capBody.bind(sk, mesh.bindMatrix.clone());
    }

    // 3) física de la pieza
    const rootObj = model.parent || model;
    const floorY = rootObj.getWorldPosition(new THREE.Vector3()).y + (opts.floorOffset || 0);
    const hips = bones[boneIdx('Hips')] || bones[0], hp = hips.getWorldPosition(new THREE.Vector3());
    const out = new THREE.Vector3(com.x - hp.x, 0, com.z - hp.z);
    if (out.lengthSq() < 1e-4) out.set(Math.sin(rootObj.rotation.y), 0, Math.cos(rootObj.rotation.y));
    out.normalize();
    if (opts.dirLocal) {   // hacia dónde sale, en el marco del monstruo (x = delante, z = su lado derecho): se gira con el modelo
      const dw = new THREE.Vector3(opts.dirLocal[0], 0, opts.dirLocal[2]).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()));
      if (dw.x * dw.x + dw.z * dw.z > 1e-6) out.set(dw.x, 0, dw.z).normalize();
    }
    const push = opts.push ?? def.push ?? 1.0, up = opts.up ?? def.up ?? 1.4;
    const vel = [out.x * push + (rand() - 0.5) * 0.4, up, out.z * push + (rand() - 0.5) * 0.4];
    const spinAxis = new THREE.Vector3(0, 1, 0).cross(out).normalize();
    const spin = opts.spin ?? 6;
    const ang = [spinAxis.x * spin + (rand() - 0.5) * 3, (rand() - 0.5) * 4, spinAxis.z * spin + (rand() - 0.5) * 3];
    const body = D.createRigid({ pts: pPos, pos: [com.x, com.y, com.z], vel, angVel: ang, floorY, restitution: def.restitution });
    pickCollidersFrom(cur.index);   // ya sin los triángulos de esta pieza (cur.index es el cuerpo)
    body.obstacleR = 0.027 * worldScale();   // ≈ 7 cm en el laboratorio (el monstruo mide 1.9 m): algo mayor que el hueco medio entre los puntos de colisión del cuerpo
    pm.userData.part = partName;
    scene().add(pm);
    if (!dropPts.parent) scene().add(dropPts);

    // 4) sangre: chorro desde el muñón (sigue al hueso de unión) y un hilo desde la pieza
    const attachBone = bones[attachI];
    const centerLocal = attachBone.worldToLocal(new THREE.Vector3(...cap.center));
    const axisW = new THREE.Vector3(...cap.axis);
    const axisLocal = axisW.clone().transformDirection(new THREE.Matrix4().copy(attachBone.matrixWorld).invert());
    emitters.push({ obj: attachBone, local: centerLocal, axis: axisLocal, sign: 1, left: def.spurt, time: 0, dur: 0.9, floorY, speed: 2.4 });
    emitters.push({ obj: pm, local: pm.worldToLocal(new THREE.Vector3(...cap.center)), axis: pm.worldToLocal(new THREE.Vector3(...cap.center).add(axisW)).sub(pm.worldToLocal(new THREE.Vector3(...cap.center))), sign: -1, left: Math.round(def.spurt * 0.4), time: 0, dur: 0.5, floorY, speed: 1.2 });

    const rec = { part: partName, piece: pm, body, capBody, all: pPos, cap, floorY, def };
    pieces.push(rec); severed.set(partName, rec);
    return rec;
  }

  const _p = new THREE.Vector3(), _d = new THREE.Vector3(), hipsW = new THREE.Vector3(), hipsBone = bones[boneIdx('Hips')] || bones[0];
  function update(dt) {
    if (!pieces.length && !drops.n) return;
    let coll = null;
    for (const r of pieces) {
      if (r.body.asleep && r.checked) continue;
      if (!coll) { model.updateMatrixWorld(true); mesh.updateMatrixWorld(true); coll = fillColliders(collPts()); }
      r.body.setObstacle(coll, r.body.obstacleR);
      if (r.body.asleep) {   // se durmió: comprobar que no lo hizo metida en el cuerpo; si es así se despierta y sale (más abajo)
        if (r.body.penetration(coll, r.body.obstacleR) > r.body.obstacleR * 0.45) r.body.stuck = 1; else { r.checked = true; continue; }
      } else r.body.step(dt);
      if (r.body.stuck > 0.3) {   // encajada bajo el cuerpo: se desliza hacia fuera (lejos de la cadera) hasta quedar libre
        const hp = hipsW.setFromMatrixPosition(hipsBone.matrixWorld);
        let ax = r.body.p[0] - hp.x, az = r.body.p[2] - hp.z; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
        r.body.squeezeOut([ax, az], 1.1, dt);
      }
      r.body.settle(r.all);
      r.piece.position.set(...r.body.p); r.piece.quaternion.set(...r.body.q);
    }
    for (let i = emitters.length - 1; i >= 0; i--) {
      const e = emitters[i];
      e.time += dt;
      if (e.time > e.dur || e.left <= 0) { emitters.splice(i, 1); continue; }
      e.obj.updateMatrixWorld(true);
      const fall = 1 - e.time / e.dur;                       // el chorro pierde fuerza
      const k = Math.min(e.left, Math.max(1, Math.round((e.left / Math.max(0.05, e.dur - e.time + dt)) * dt)));
      for (let j = 0; j < k; j++) {
        _p.copy(e.local).applyMatrix4(e.obj.matrixWorld);
        _d.copy(e.axis).transformDirection(e.obj.matrixWorld).multiplyScalar(e.sign);
        emit(_p, _d, e.speed * (0.4 + 0.6 * fall), e.floorY);
      }
      e.left -= k;
    }
    stepDrops(dt);
  }

  function dispose(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c !== o) c.material.dispose(); }); if (o.material) o.material.dispose(); }
  function restore() {
    for (const r of pieces) {
      if (r.piece.parent) r.piece.parent.remove(r.piece); dispose(r.piece);
      if (r.capBody) { if (r.capBody.parent) r.capBody.parent.remove(r.capBody); r.capBody.geometry.dispose(); r.capBody.material.dispose(); }
    }
    pieces.length = 0; severed.clear(); emitters.length = 0;
    drops.n = 0; drops.cursor = 0; drops.life.fill(0); dropPts.visible = false;
    cur.index = snap.index.slice(); cur.si = snap.si.slice(); cur.sw = snap.sw.slice();
    g.setIndex(new THREE.BufferAttribute(cur.index, 1));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(cur.si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(cur.sw, 4));
  }

  return {
    sever, update, restore,
    isSevered: (p) => severed.has(p),
    get pieces() { return pieces; },
    get parts() { return Object.keys(D.PARTS); },
    get dropCount() { return drops.n; },
    dropPoints: dropPts,
  };
}
