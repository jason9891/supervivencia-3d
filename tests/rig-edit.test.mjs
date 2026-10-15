// Pruebas de la edición de estructura (mandíbula + pivotes). Parte pura siempre; parte con three.js sólo si THREE_DIR apunta a un clon de three r170
// (build/ + examples/jsm/), porque la CDN no está disponible en Node.  Uso: THREE_DIR=/ruta/three node tests/rig-edit.test.mjs
import fs from 'fs';
import { jawWeight, mergeJaw, normalizeRigCfg, JAW_DEFAULTS } from '../rig-edit-core.js';
let fails = 0;
const check = (n, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!ok) fails++; };

// --- parte pura
const c = { ...JAW_DEFAULTS, pivot: [...JAW_DEFAULTS.pivot] };
check('punto bajo la boca y delante → mandíbula', jawWeight(0.4, 0.4, 0, c) > 0.99);
check('punto sobre el plano → cabeza', jawWeight(0.4, 0.6, 0, c) === 0);
check('punto detrás de la bisagra → no es mandíbula', jawWeight(0.2, 0.4, 0, c) === 0);
check('punto muy lateral (garra) → no es mandíbula', jawWeight(0.4, 0.4, 0.3, c) === 0);
const m = mergeJaw(new Uint16Array([3, 4, 5, 6, 1, 2, 3, 4]), new Float32Array([.4, .3, .2, .1, 1, 0, 0, 0]), new Float32Array([0.5, 0]), 65);
check('mezcla: suma 1 y el hueso nuevo entra con su peso', Math.abs([...m.weight.slice(0, 4)].reduce((a, b) => a + b) - 1) < 1e-6 && m.index.includes(65));
check('mezcla: sin mandíbula (w=0) deja los pesos intactos', m.index[4] === 1 && m.weight[4] === 1);
check('mezcla: con w=1 el vértice es sólo de la mandíbula', mergeJaw(new Uint16Array([3, 0, 0, 0]), new Float32Array([1, 0, 0, 0]), new Float32Array([1]), 65).index[0] === 65);
const nc = normalizeRigCfg({ offsets: { hips: [0, 0, 0], head: [0.01, 0, 0] }, jaw: { planeY: 0.5 } });
check('normalizar: descarta offsets nulos y rellena defectos', !('hips' in nc.offsets) && nc.offsets.head[0] === 0.01 && nc.jaw.halfWidth === 0.14 && nc.jaw.planeY === 0.5);

// --- parte con three.js
const dir = process.env.THREE_DIR;
if (!dir) { console.log('(sin THREE_DIR: se omite la prueba con el modelo real)'); console.log(fails ? fails + ' FALLARON' : 'PRUEBAS PURAS PASARON'); process.exit(fails ? 1 : 0); }
const { register } = await import('node:module');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, ctx, next){ if(s==='three') return {url:'file://${dir}/build/three.module.js', shortCircuit:true}; return next(s, ctx); }`));
globalThis.self = globalThis;
const THREE = await import('three');
const { GLTFLoader } = await import(`file://${dir}/examples/jsm/loaders/GLTFLoader.js`);
const { MeshoptDecoder } = await import(`file://${dir}/examples/jsm/libs/meshopt_decoder.module.js`);
const { RigEditor } = await import('../rig-edit.js');
await MeshoptDecoder.ready;
// quita texturas del GLB (en Node no hay decodificador de imágenes)
const glb = fs.readFileSync('assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb');
const jl = glb.readUInt32LE(12), json = JSON.parse(glb.slice(20, 20 + jl).toString());
delete json.images; delete json.textures; delete json.samplers;
for (const mt of json.materials || []) { delete mt.normalTexture; delete mt.occlusionTexture; delete mt.emissiveTexture; if (mt.pbrMetallicRoughness) { delete mt.pbrMetallicRoughness.baseColorTexture; delete mt.pbrMetallicRoughness.metallicRoughnessTexture; } }
const jb = Buffer.from(JSON.stringify(json)); const pad = (4 - (jb.length % 4)) % 4; const jbp = Buffer.concat([jb, Buffer.alloc(pad, 0x20)]);
const rest = glb.slice(20 + jl);
const hdr = Buffer.alloc(20); hdr.writeUInt32LE(0x46546c67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(20 + jbp.length + rest.length, 8); hdr.writeUInt32LE(jbp.length, 12); hdr.writeUInt32LE(0x4e4f534a, 16);
const ab = Buffer.concat([hdr, jbp, rest]);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((res, rej) => loader.parse(ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength), '', res, rej));
const model = gltf.scene; model.scale.setScalar(2.69); model.position.set(0.3, 0.2, -0.1); model.rotation.y = 0.7; model.updateMatrixWorld(true);   // como en el editor: escala + movimiento + giro
let mesh; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
const byName = new Map(mesh.skeleton.bones.map((b) => [b.name.replace(/[:.]/g, ''), b]));   // GLTFLoader quita los ':' de los nombres
const keys = { hips: byName.get('mixamorigHips'), head: byName.get('mixamorigHead'), spine2: byName.get('mixamorigSpine2'), leftArm: byName.get('mixamorigLeftArm') };
check('GLB: 65 huesos y malla con pesos', mesh.skeleton.bones.length === 65 && mesh.geometry.attributes.skinWeight.count > 1000, `(${mesh.skeleton.bones.length} huesos, ${mesh.geometry.attributes.position.count} vértices)`);

function skinned() { model.updateMatrixWorld(true); mesh.skeleton.update(); const P = mesh.geometry.attributes.position, out = new Float32Array(P.count * 3), v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); out.set([v.x, v.y, v.z], i * 3); } return out; }
const maxDiff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
const base = skinned();
const ed = new RigEditor(model, mesh, keys);
const nJaw = ed.allowed.reduce((a, b) => a + b, 0);
console.log('vértices candidatos a mandíbula:', nJaw);

// 1) Sólo reconstruir sin cambios no mueve la malla
ed.build({ jaw: { enabled: false } });
check('reconstruir sin cambios deja la malla igual', maxDiff(base, skinned()) < 1e-5);
// 2) Añadir la mandíbula en reposo no mueve la malla
const jaw = ed.build({});
check('mandíbula añadida: 66 huesos y malla en reposo igual', mesh.skeleton.bones.length === 66 && maxDiff(base, skinned()) < 1e-4, `(dif ${maxDiff(base, skinned()).toExponential(2)})`);
const nj = ed.jawW.reduce((a, w) => a + (w > 0.5 ? 1 : 0), 0);
check('zona de mandíbula razonable (cientos de vértices)', nj > 150 && nj < 3000, `(${nj})`);
// 3) Girar la mandíbula mueve sólo la zona de mandíbula (+Z cierra, −Z abre)
const restQ = jaw.quaternion.clone();
const rot = (deg) => { jaw.quaternion.copy(restQ).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, deg * Math.PI / 180))); return skinned(); };
const open = rot(-30);
let movedIn = 0, movedOut = 0, maxOut = 0;
for (let i = 0; i < ed.n; i++) { const d = Math.hypot(open[i * 3] - base[i * 3], open[i * 3 + 1] - base[i * 3 + 1], open[i * 3 + 2] - base[i * 3 + 2]); if (ed.jawW[i] > 0.5) { if (d > 0.02) movedIn++; } else if (ed.jawW[i] === 0) { movedOut += d > 1e-4 ? 1 : 0; maxOut = Math.max(maxOut, d); } }
check('girar la mandíbula mueve su zona', movedIn > nj * 0.8, `(${movedIn}/${nj})`);
check('…y no mueve el resto de la malla', movedOut === 0, `(${movedOut} vértices movidos, máx ${maxOut.toExponential(1)})`);
const my = (P) => { let a = 0, k = 0; for (let i = 0; i < ed.n; i++) if (ed.jawW[i] > 0.5) { a += P[i * 3 + 1]; k++; } return a / k; };
check('−Z abre la boca (la mandíbula baja) y +Z la cierra (sube)', my(open) < my(base) - 0.05 && my(rot(15)) > my(base), `(abre ${(my(open) - my(base)).toFixed(3)} m, cierra ${(my(rot(15)) - my(base)).toFixed(3)} m)`);
jaw.quaternion.copy(restQ);
// 4) Reubicar pivotes: la malla en reposo no cambia; el hueso sí se mueve; los hijos se quedan
const wp = (b) => { model.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); };
const headBefore = wp(keys.head), spine2Before = wp(keys.spine2);
ed.build({ offsets: { spine2: [0.02, -0.01, 0.015], jaw: [0.01, 0.005, 0] } });
const s2 = wp(keys.spine2), hd = wp(keys.head);
check('reubicar Spine2: la malla en reposo no cambia', maxDiff(base, skinned()) < 1e-4, `(dif ${maxDiff(base, skinned()).toExponential(2)})`);
check('el pivote de Spine2 se movió (≈0.02 nativo × 2.69)', s2.distanceTo(spine2Before) > 0.05, `(${s2.distanceTo(spine2Before).toFixed(3)} m)`);
check('su hijo (Head) se queda donde estaba', hd.distanceTo(headBefore) < 1e-4, `(${hd.distanceTo(headBefore).toExponential(1)})`);
check('pivote de la mandíbula movido con su desplazamiento', wp(ed.jaw).distanceTo(wp(keys.head).clone()) > 0 && ed.cfg.offsets.jaw[0] === 0.01);
// 5) Rotar el Spine2 reubicado hace girar sobre el pivote nuevo
const sq = keys.spine2.quaternion.clone(); keys.spine2.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.3)));
check('rotar el hueso reubicado deforma la malla', maxDiff(base, skinned()) > 0.01); keys.spine2.quaternion.copy(sq);
// 6) Quitar la mandíbula devuelve el original
ed.build({ jaw: { enabled: false } });
check('desactivar mandíbula + sin offsets → 65 huesos y malla igual', mesh.skeleton.bones.length === 65 && maxDiff(base, skinned()) < 1e-5);
console.log(fails ? fails + ' FALLARON' : 'TODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
