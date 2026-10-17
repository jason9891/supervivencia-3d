// Pruebas del desmembramiento (dismember-core.js + dismember.js + clips de muerte con `sever`).
// Parte pura siempre; parte con la malla real sólo si THREE_DIR apunta a three r170 (build/ + examples/jsm/).
//   Uso: THREE_DIR=$PWD/node_modules/three node tests/dismember.test.mjs
import fs from 'fs';
import * as D from '../dismember-core.js';
let fails = 0;
const check = (n, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!ok) fails++; };

// ---------------------------------------------------------------- parte pura
// subárbol y reparto de triángulos
const parents = [-1, 0, 1, 2, 2, 4, 1];   // 0 raíz; 2 tiene hijos 3 y 4; 4 tiene 5
const st = D.subtree(parents, 2);
check('subárbol de un hueso incluye a sus descendientes y no al resto', [2, 3, 4, 5].every((i) => st.has(i)) && !st.has(0) && !st.has(1) && !st.has(6));
const si = new Uint16Array([2, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0]), sw = new Float32Array([1, 0, 0, 0, 0.7, 0.3, 0, 0, 1, 0, 0, 0]);
const pw = D.partWeight(si, sw, st, 3);
check('peso de parte: suma los huesos del subárbol', Math.abs(pw[0] - 1) < 1e-6 && Math.abs(pw[1] - 0.7) < 1e-6 && pw[2] === 0);
const sp = D.splitTriangles(new Uint32Array([0, 1, 2, 0, 2, 2]), pw);
check('triángulo con 2 de 3 vértices en la parte se va con la pieza', sp.piece.length === 3 && sp.body.length === 3);
check('el reparto no pierde ni duplica triángulos', sp.piece.length + sp.body.length === 6);
const rs = D.remapSkin(new Uint16Array([3, 1, 0, 0]), new Float32Array([0.6, 0.4, 0, 0]), st, 1);
check('remapSkin: el peso de la parte pasa al hueso de unión y la suma sigue siendo 1', rs.index[1] === 1 && Math.abs(rs.weight[1] - 1) < 1e-6 && rs.weight[0] === 0);
const rs2 = D.remapSkin(new Uint16Array([3, 4, 0, 0]), new Float32Array([0.5, 0.5, 0, 0]), st, 1);
check('remapSkin: sin el hueso de unión previo, lo recibe en una ranura libre', rs2.index.includes(1) && Math.abs([...rs2.weight].reduce((a, b) => a + b) - 1) < 1e-6);

// lazo del borde: un anillo de 6 triángulos abiertos por arriba (cilindro corto) tiene 1 lazo de 8 vértices
function tube(n) {   // n lados, 2 anillos; sin tapas → 2 lazos
  const P = [], I = [];
  for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) P.push(Math.cos(k / n * 6.2832), r, Math.sin(k / n * 6.2832));
  for (let k = 0; k < n; k++) { const a = k, b = (k + 1) % n, c = n + k, d = n + (k + 1) % n; I.push(a, b, c, b, d, c); }
  return { P: new Float32Array(P), I: Uint32Array.from(I) };
}
const tb = tube(8), w = D.weldIds(tb.P);
const loops = D.openLoops(tb.I, w);
check('openLoops: un tubo abierto tiene dos lazos de 8 vértices', loops.length === 2 && loops.every((l) => l.length === 8));
const dupP = new Float32Array([...tb.P, ...tb.P.slice(0, 3)]);   // un vértice duplicado (costura de UV)
check('weldIds: vértices en la misma posición comparten id', D.weldIds(dupP)[8 * 2] === D.weldIds(dupP)[0]);
const cap = D.capFrom([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], [0, 2, 0]);
check('capFrom: eje hacia la parte y radio medio', Math.abs(cap.axis[1] - 1) < 1e-6 && Math.abs(cap.radius - 1) < 1e-6);

// cuerpo rígido: cae al suelo, rebota poco, se asienta sin atravesarlo
function cube(h) { const p = []; for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) p.push(x, y, z); return new Float32Array(p); }
const pts = cube(0.1), b = D.createRigid({ pts, pos: [0, 1.2, 0], vel: [0.8, 1.4, 0.2], angVel: [5, 1, -3], restitution: 0.2 });
let minY = 9, t = 0;
while (!b.asleep && t < 10) { b.step(1 / 60); t += 1 / 60; for (let i = 0; i < pts.length; i += 3) minY = Math.min(minY, b.world([pts[i], pts[i + 1], pts[i + 2]])[1]); }
check('pieza rígida: se duerme en pocos segundos', b.asleep && t < 6, `(${t.toFixed(2)} s)`);
check('pieza rígida: ningún vértice baja del suelo', minY > -1e-4, `(mín ${minY.toExponential(1)})`);
let lowest = 9; for (let i = 0; i < pts.length; i += 3) lowest = Math.min(lowest, b.world([pts[i], pts[i + 1], pts[i + 2]])[1]);
check('pieza rígida: en reposo apoya sobre el suelo (no flota)', lowest < 0.01, `(${lowest.toFixed(4)} m)`);
let onFloor = 0; for (let i = 0; i < pts.length; i += 3) if (b.world([pts[i], pts[i + 1], pts[i + 2]])[1] < 0.01) onFloor++;
check('pieza rígida: el cubo se asienta sobre una cara (≥4 vértices en el suelo, no sobre una arista)', onFloor >= 4, `(${onFloor} vértices a <1 cm)`);

// ---------------------------------------------------------------- clips con `sever`
const deaths = JSON.parse(fs.readFileSync(new URL('../assets/anims/monster-death.json', import.meta.url))).clips;
const SEVER = { deathArmR: 'RightArm', deathArmL: 'LeftArm', deathDecap: 'Head', deathDecapBack: 'Head' };
for (const [k, part] of Object.entries(SEVER)) {
  const c = deaths[k];
  check(k + ': existe, es un clip horneado y corta ' + part, c && c.baked === true && c.sever && c.sever.length === 1 && c.sever[0].part === part && c.cut.includes(part));
  check(k + ': el corte ocurre al empezar la caída (antes de tocar el suelo)', c.sever[0].t > 0.05 && c.sever[0].t < 0.5);
  check(k + ': dirección de salida horizontal y no nula', Math.hypot(c.sever[0].dir[0], c.sever[0].dir[2]) > 0.5 && Math.abs(c.sever[0].dir[1]) < 1e-6);
}
check('brazo D sale hacia su lado derecho (+z) y brazo I hacia el izquierdo (−z)', deaths.deathArmR.sever[0].dir[2] > 0 && deaths.deathArmL.sever[0].dir[2] < 0);
for (const k of ['death', 'deathFront', 'deathSideR', 'deathSideL', 'deathKneel']) check(k + ': las muertes normales no cortan nada', !deaths[k].sever);
// sin cabeza el cuerpo se desploma: la mandíbula ya no cuenta, el resto de la pose sigue los mismos límites
check('decapitación de bruces: el cuerpo acaba más bajo (sin hocico en el suelo)', deaths.deathDecap.keys.at(-1).pose.hips.py < 0.2);

// ---------------------------------------------------------------- parte con three.js y la malla real
const dir = process.env.THREE_DIR;
if (!dir) { console.log('(sin THREE_DIR: se omite la prueba con el modelo real)'); console.log(fails ? fails + ' FALLARON' : 'PRUEBAS PURAS PASARON'); process.exit(fails ? 1 : 0); }
const { register } = await import('node:module');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, ctx, next){ if(s==='three') return {url:'file://${dir}/build/three.module.js', shortCircuit:true}; return next(s, ctx); }`));
globalThis.self = globalThis;
const THREE = await import('three');
const { GLTFLoader } = await import(`file://${dir}/examples/jsm/loaders/GLTFLoader.js`);
const { MeshoptDecoder } = await import(`file://${dir}/examples/jsm/libs/meshopt_decoder.module.js`);
const { RigEditor } = await import('../rig-edit.js');
const { createDismember } = await import('../dismember.js');
const { createMixamoProcedural } = await import('../mixamo-procedural.js');
await MeshoptDecoder.ready;
const glb = fs.readFileSync('assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb');
const jl = glb.readUInt32LE(12), json = JSON.parse(glb.slice(20, 20 + jl).toString());
delete json.images; delete json.textures; delete json.samplers;
for (const mt of json.materials || []) { delete mt.normalTexture; delete mt.occlusionTexture; delete mt.emissiveTexture; if (mt.pbrMetallicRoughness) { delete mt.pbrMetallicRoughness.baseColorTexture; delete mt.pbrMetallicRoughness.metallicRoughnessTexture; } }
const jb = Buffer.from(JSON.stringify(json)), jbp = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]), rest = glb.slice(20 + jl);
const hdr = Buffer.alloc(20); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(20 + jbp.length + rest.length, 8); hdr.writeUInt32LE(jbp.length, 12); hdr.writeUInt32LE(0x4e4f534a, 16);
const ab = Buffer.concat([hdr, jbp, rest]);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const clips = { ...deaths };

async function fresh(seed = 7) {
  const gltf = await new Promise((res, rej) => loader.parse(ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength), '', res, rej));
  const root = new THREE.Group(); root.add(gltf.scene); const model = gltf.scene;
  model.scale.setScalar(2.69);   // como en enemy-lab.html: el monstruo mide ≈1.9 m (nativo 0.7); la física de la pieza está calibrada para esa escala
  model.updateMatrixWorld(true);
  const anim = createMixamoProcedural(THREE, model, { height: 1.9 });
  anim.useClips(clips);
  let mesh; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  anim.attachJaw(new RigEditor(model, mesh, anim.bones).build());
  const dis = createDismember({ model, mesh, seed }); anim.attachDismember(dis);
  const scene = new THREE.Scene(); scene.add(root);
  return { anim, dis, mesh, model, root, scene };
}
const worldVerts = (mesh, idx) => { const v = new THREE.Vector3(), out = []; for (const i of idx) { mesh.getVertexPosition(i, v); out.push(v.clone().applyMatrix4(mesh.matrixWorld)); } return out; };

for (const [name, part] of Object.entries(SEVER)) {
  const { anim, dis, mesh, model, root } = await fresh();
  const tris0 = mesh.geometry.index.count / 3;
  anim.die(name);
  check(name + ': el clip anuncia la parte que corta', anim.deathSevers.join() === part);
  let sawCut = -1;
  for (let i = 0; i < 60 * 4; i++) { anim.update(1 / 60); if (sawCut < 0 && dis.isSevered(part)) sawCut = i / 60; }
  const rec = dis.pieces[0];
  check(name + ': se corta una sola pieza, en el instante del clip', dis.pieces.length === 1 && sawCut >= deaths[name].sever[0].t - 0.05 && sawCut < deaths[name].sever[0].t + 0.1, `(corta a ${sawCut.toFixed(2)} s)`);
  const tris1 = mesh.geometry.index.count / 3, trisP = rec.piece.geometry.index.count / 3;
  check(name + ': el cuerpo pierde triángulos y la pieza los gana (sin perder ninguno)', tris1 < tris0 && trisP > 100 && tris1 + trisP === tris0, `(cuerpo ${tris1}, pieza ${trisP}, original ${tris0})`);
  check(name + ': el tamaño de la pieza es razonable', part === 'Head' ? trisP / tris0 > 0.05 && trisP / tris0 < 0.45 : trisP / tris0 > 0.03 && trisP / tris0 < 0.35, `(${(100 * trisP / tris0).toFixed(1)} % de la malla)`);
  check(name + ': tapa de carne en el muñón del cuerpo y en la pieza', !!rec.capBody && rec.piece.children.length === 1);
  // la pieza acabó quieta, sobre el suelo y sin atravesarlo
  const floor = rec.floorY; let low = 9, lowBody = 9;
  const P = rec.piece.geometry.attributes.position; const v = new THREE.Vector3();
  rec.piece.updateMatrixWorld(true);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(rec.piece.matrixWorld); low = Math.min(low, v.y); }
  check(name + ': la pieza suelta se detuvo (durmió)', rec.body.asleep);
  check(name + ': la pieza no atraviesa el suelo y descansa sobre él', low > floor - 0.002 && low < floor + 0.06, `(punto más bajo ${(low - floor).toFixed(4)} m sobre el suelo)`);
  // el cuerpo no queda por debajo del suelo tras quitar la parte (sólo se mira la malla visible del cuerpo)
  const used = [...new Set(mesh.geometry.index.array)];
  for (const p of worldVerts(mesh, used)) lowBody = Math.min(lowBody, p.y);
  check(name + ': el cuerpo cae sin atravesar el suelo', lowBody > floor - 0.01, `(punto más bajo ${(lowBody - floor).toFixed(3)} m)`);
  // la pieza no se mete dentro del cuerpo: se lanza un rayo desde cada vértice de la pieza; un número IMPAR de cruces con la malla cerrada (cuerpo + muñón) = está dentro
  const rc = new THREE.Raycaster(); const targets = [mesh, rec.capBody].filter(Boolean); const oldSide = targets.map((t) => t.material.side); targets.forEach((t) => { t.material.side = THREE.DoubleSide; });
  model.updateMatrixWorld(true); mesh.skeleton.update();
  let inside = 0, tested = 0; const dirRay = new THREE.Vector3(0.31, 0.93, 0.19).normalize();
  for (let i = 0; i < P.count; i += 25) { v.fromBufferAttribute(P, i).applyMatrix4(rec.piece.matrixWorld); rc.set(v, dirRay); const hits = rc.intersectObjects(targets, false); tested++; if (hits.length % 2 === 1) inside++; }
  targets.forEach((t, k) => { t.material.side = oldSide[k]; });
  check(name + ': la pieza no se mete dentro del cuerpo (≤3 % de sus vértices dentro)', inside / tested <= 0.03, `(${inside}/${tested} dentro)`);
  // sangre
  check(name + ': salió sangre (partículas) y sigue visible', dis.dropCount > 10 && dis.dropPoints.parent !== null);
  // revivir deja el monstruo entero
  anim.revive();
  check(name + ': revivir devuelve la malla completa y quita la pieza', mesh.geometry.index.count / 3 === tris0 && dis.pieces.length === 0 && !dis.isSevered(part) && !rec.piece.parent && !rec.capBody.parent);
  // y se puede volver a cortar
  anim.die(name); for (let i = 0; i < 60; i++) anim.update(1 / 60);
  check(name + ': tras revivir se puede cortar otra vez', dis.pieces.length === 1 && mesh.geometry.index.count / 3 < tris0);
}

// robustez: la salida de la pieza lleva algo de azar (semilla); con otras semillas tampoco debe acabar dentro del cuerpo ni quedarse sin asentarse
for (const [name, part] of Object.entries(SEVER)) {
  let worst = 0, asleepAll = true;
  for (const seed of [11, 99, 1234]) {
    const { anim, dis, mesh, model } = await fresh(seed); anim.die(name);
    for (let i = 0; i < 60 * 3.5; i++) anim.update(1 / 60);
    const rec = dis.pieces[0]; asleepAll = asleepAll && rec.body.asleep;
    const rc = new THREE.Raycaster(), targets = [mesh, rec.capBody]; const old = targets.map((t) => t.material.side); targets.forEach((t) => { t.material.side = THREE.DoubleSide; });
    model.updateMatrixWorld(true); mesh.skeleton.update(); rec.piece.updateMatrixWorld(true);
    const P = rec.piece.geometry.attributes.position, v = new THREE.Vector3(), d = new THREE.Vector3(0.31, 0.93, 0.19).normalize(); let inside = 0, tested = 0;
    for (let i = 0; i < P.count; i += 25) { v.fromBufferAttribute(P, i).applyMatrix4(rec.piece.matrixWorld); rc.set(v, d); tested++; if (rc.intersectObjects(targets, false).length % 2 === 1) inside++; }
    targets.forEach((t, k) => { t.material.side = old[k]; }); worst = Math.max(worst, inside / tested);
  }
  check(name + ': con otras 3 semillas la pieza siempre se asienta y no se mete en el cuerpo (≤3 %)', asleepAll && worst <= 0.03, `(peor ${(100 * worst).toFixed(1)} %)`);
}

// barrido de TODO el clip con la malla real: ningún vértice del cuerpo baja del suelo (comprueba lo que el generador mide con su muestra de la malla)
for (const name of Object.keys(deaths)) {
  const { anim, dis, mesh } = await fresh();
  anim.die(name);
  let low = 9, floating = 9; const v = new THREE.Vector3();
  for (let i = 0; i < 60 * 3; i++) {
    anim.update(1 / 60);
    if (i % 3) continue;
    const used = [...new Set(mesh.geometry.index.array)]; let lowF = 9;
    for (let k = 0; k < used.length; k += 4) { mesh.getVertexPosition(used[k], v); v.applyMatrix4(mesh.matrixWorld); lowF = Math.min(lowF, v.y); }
    if (i / 60 > 0.2) low = Math.min(low, lowF);   // el primer instante aún está en pie con la raíz fuera del suelo
    if (i === 60 * 3 - 3) floating = lowF;
  }
  check(name + ': en todo el clip la malla real no atraviesa el suelo (≤ 1 cm)', low > -0.01, `(peor ${(low * 100).toFixed(1)} cm)`);
  check(name + ': y al final el cuerpo APOYA en el suelo (no flota más de 3 cm)', floating > -0.01 && floating < 0.03, `(punto más bajo a ${(floating * 100).toFixed(1)} cm)`);
}

// la cabeza cortada se lleva la mandíbula (el hueso Jaw cuelga de Head): su malla va con la pieza
{
  const { anim, dis, mesh } = await fresh();
  anim.die('deathDecap'); for (let i = 0; i < 90; i++) anim.update(1 / 60);
  const jawIdx = mesh.skeleton.bones.findIndex((b) => /jaw/i.test(b.name));
  let stillJaw = 0; const si2 = mesh.geometry.attributes.skinIndex, sw2 = mesh.geometry.attributes.skinWeight;
  for (const v of new Set(mesh.geometry.index.array)) for (let k = 0; k < 4; k++) if (si2.getX(v) === jawIdx && k === 0 && sw2.getX(v) > 0.5) stillJaw++;
  check('decapitación: ningún vértice del cuerpo sigue dominado por la mandíbula', jawIdx > 0 && stillJaw === 0, `(${stillJaw})`);
  check('decapitación: la pieza es más grande que un brazo (cabeza + mandíbula)', dis.pieces[0].piece.geometry.index.count > 1500);
}
console.log(fails ? fails + ' FALLARON' : 'TODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
