// Exporta una muestra de la malla REAL del monstruo con su skinning (posición de reposo + 4 huesos y pesos por vértice, incluida la mandíbula).
// La muestra son los vértices más extremos de cada hueso (envolvente) más uno de cada cinco: lo bastante densa para hallar el punto más bajo del cuerpo en cualquier pose.
// La usa tools/gen-monster-death.py: deforma estos vértices con el MISMO skinning lineal que el motor, así el cuerpo apoya en el suelo con su volumen verdadero (cadera, cola,
// hombros, garras, mandíbula…) y no con esferas aproximadas.
//   Uso (desde la raíz del repo):  THREE_DIR=$PWD/node_modules/three node tools/export-monster-hull.mjs
// Salida: assets/anims/monster-hull.json
//   v2: { bones: [nombres, el último es 'Jaw'], rest: { hueso: [x,y,z] }, n, p: [x,y,z…], i: [h0,h1,h2,h3…], w: [w0,w1,w2,w3…] }  (unidades GLB, reposo, marco del mundo)
import fs from 'fs';
const dir = process.env.THREE_DIR;
if (!dir) { console.error('Falta THREE_DIR (clon de three r170 con build/ y examples/jsm/), p. ej. $PWD/node_modules/three'); process.exit(1); }
const { register } = await import('node:module');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, ctx, next){ if(s==='three') return {url:'file://${dir}/build/three.module.js', shortCircuit:true}; return next(s, ctx); }`));
globalThis.self = globalThis;
const THREE = await import('three');
const { GLTFLoader } = await import(`file://${dir}/examples/jsm/loaders/GLTFLoader.js`);
const { MeshoptDecoder } = await import(`file://${dir}/examples/jsm/libs/meshopt_decoder.module.js`);
const { RigEditor } = await import('../rig-edit.js');
await MeshoptDecoder.ready;

const glb = fs.readFileSync('assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb');
const jl = glb.readUInt32LE(12), json = JSON.parse(glb.slice(20, 20 + jl).toString());
delete json.images; delete json.textures; delete json.samplers;
for (const mt of json.materials || []) { delete mt.normalTexture; delete mt.occlusionTexture; delete mt.emissiveTexture; if (mt.pbrMetallicRoughness) { delete mt.pbrMetallicRoughness.baseColorTexture; delete mt.pbrMetallicRoughness.metallicRoughnessTexture; } }
const jb = Buffer.from(JSON.stringify(json)), jbp = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]), rest = glb.slice(20 + jl);
const hdr = Buffer.alloc(20); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(20 + jbp.length + rest.length, 8); hdr.writeUInt32LE(jbp.length, 12); hdr.writeUInt32LE(0x4e4f534a, 16);
const ab = Buffer.concat([hdr, jbp, rest]);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((res, rej) => loader.parse(ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength), '', res, rej));
const model = gltf.scene; model.updateMatrixWorld(true);
let mesh; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
mesh.skeleton.update();
const bare = (n) => n.replace(/^mixamorig[:._\-\s]*/i, '');

// 162 direcciones: icosaedro subdividido dos veces (separación ≈16°: el punto más bajo de una pieza girada queda a ≈1 % de su radio)
function icosphere(levels) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  V = V.map(nrm);
  for (let l = 0; l < levels; l++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (!cache.has(k)) { cache.set(k, V.length); V.push(nrm(V[a].map((x, i) => x + V[b][i]))); } return cache.get(k); };
    for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    F = nf;
  }
  return V;
}
const DIRS = icosphere(2);


// RigEditor añade la mandíbula (hueso Jaw, hijo de Head): el skinning exportado ya la incluye como el último hueso
const byName = new Map(mesh.skeleton.bones.map((b) => [b.name.replace(/[:.]/g, ''), b]));
const ed = new RigEditor(model, mesh, { hips: byName.get('mixamorigHips'), head: byName.get('mixamorigHead'), spine2: byName.get('mixamorigSpine2'), leftArm: byName.get('mixamorigLeftArm') });
ed.build({}); model.updateMatrixWorld(true); mesh.skeleton.update();
const bones2 = mesh.skeleton.bones;

const names = bones2.map((b) => bare(b.name));
const restPos = {}; bones2.forEach((b, i) => { const bp = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); restPos[names[i]] = [bp.x, bp.y, bp.z].map((x) => Math.round(x * 1e5) / 1e5); });
const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, n = mesh.geometry.attributes.position.count;   // ya con la mandíbula (hueso 65)
const P = new Float32Array(n * 3), v = new THREE.Vector3();
for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); P.set([v.x, v.y, v.z], i * 3); }
const wOf = (i, k) => [sw.getX, sw.getY, sw.getZ, sw.getW][k].call(sw, i), bOf = (i, k) => [si.getX, si.getY, si.getZ, si.getW][k].call(si, i);
const keep = new Set();
for (let i = 0; i < n; i += 5) keep.add(i);
const perBone = bones2.map(() => []);
for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) if (wOf(i, k) >= 0.3) perBone[bOf(i, k)].push(i);
for (const list of perBone) {
  if (list.length < 3) continue;
  for (const d of DIRS) { let best = -1, bv = -Infinity; for (const i of list) { const sc = P[i * 3] * d[0] + P[i * 3 + 1] * d[1] + P[i * 3 + 2] * d[2]; if (sc > bv) { bv = sc; best = i; } } keep.add(best); }
}
const ids = [...keep].sort((a, b) => a - b);
const r3 = (x) => Math.round(x * 1e4) / 1e4, r2 = (x) => Math.round(x * 100) / 100;
const out = { bones: names, rest: restPos, n: ids.length, p: [], i: [], w: [] };
for (const i of ids) {
  out.p.push(r3(P[i * 3]), r3(P[i * 3 + 1]), r3(P[i * 3 + 2]));
  let tot = 0; const ws = [0, 1, 2, 3].map((k) => wOf(i, k)); for (const w of ws) tot += w;
  for (let k = 0; k < 4; k++) { out.i.push(bOf(i, k)); out.w.push(r2(ws[k] / (tot || 1))); }
}
fs.writeFileSync('assets/anims/monster-hull.json', JSON.stringify(out));
console.log('escrito assets/anims/monster-hull.json:', ids.length, 'de', n, 'vértices,', names.length, 'huesos (último:', names.at(-1) + ')');
