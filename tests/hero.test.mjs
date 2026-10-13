import * as H from '../hero.js';
import { createEquipment } from '../equipment.js';
import * as EQ from '../equipment.js';
import * as C from '../combat.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'OK   ' : 'FALLA ') + n); if (!ok) fails++; };

// --- Clips: solo se conservan las traslaciones de root/pelvis, escaladas a la cadera del humano ---
const track = (name, values) => ({ name, values: Float32Array.from(values), clone() { return track(this.name, this.values); } });
const clip = tracks => ({ name: 'c', tracks, clone() { return { name: this.name, tracks: this.tracks, clone: this.clone }; } });
const root = pos => ({ getObjectByName: n => pos[n] ? { position: pos[n] } : undefined });
const hero = root({ pelvis: { x: 0, y: 0.043, z: 0.949 }, root: { x: 0, y: 0, z: 0 } });
const donor = root({ pelvis: { x: 0, y: 0.05, z: 0.917 }, root: { x: 0, y: 0, z: 0 } });
const src = clip([
  track('pelvis.quaternion', [0, 0, 0, 1]), track('pelvis.position', [0, 0.05, 0.917]),
  track('thigh_l.position', [0.089, 0.028, 0.046]), track('hand_r.quaternion', [0, 0, 0, 1]), track('root.position', [0, 0, 1]),
]);
const out = H.adaptClips([src], hero, donor)[0];
const names = out.tracks.map(t => t.name);
check('se conservan todas las rotaciones', names.includes('pelvis.quaternion') && names.includes('hand_r.quaternion'));
check('se descartan las traslaciones de los demás huesos', !names.includes('thigh_l.position'));
check('se conservan las de pelvis y root', names.includes('pelvis.position') && names.includes('root.position'));
const pp = out.tracks.find(t => t.name === 'pelvis.position').values;
check('la cadera se escala a la altura del humano (0.917 → 0.949)', Math.abs(pp[2] - 0.949) < 1e-4 && Math.abs(pp[1] - 0.043) < 1e-4);
check('adaptar no modifica el clip original', src.tracks.length === 5 && src.tracks[1].values[2] === Float32Array.from([0.917])[0]);

// --- Equipo: todas las piezas del juego se dibujan y se cuelgan del hueso correcto ---
class Obj { constructor() { this.children = []; this.parent = null; this.position = { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
  this.rotation = { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } }; this.scale = { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; }, multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; } }; }
  add(c) { c.parent = this; this.children.push(c); return this; } remove(c) { this.children = this.children.filter(k => k !== c); }
  traverse(f) { f(this); this.children.forEach(k => k.traverse(f)); } }
class Mesh extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; this.isMesh = true; } }
const geo = (type) => class { constructor(...a) { this.type = type; this.args = a; } };
const THREE = { Group: Obj, Mesh, MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); } },
  BoxGeometry: geo('box'), CylinderGeometry: geo('cyl'), SphereGeometry: geo('sphere') };
const bones = {}; const model = new Obj(); model.getObjectByName = n => bones[n] || (bones[n] = new Obj());
const store = {}; const eq = createEquipment(THREE, H.PROFILES.hero);
const loadout = { weapon: 'espada', casco: 'placas', pechera: 'placas', grebas: 'placas', escudo: 'torre' };
eq.apply(model, loadout, store);
const on = (b) => bones[b] ? bones[b].children.length : 0;
check('el arma va en la mano derecha y el escudo en el antebrazo izquierdo', on('hand_r') === 1 && on('lowerarm_l') === 1);
check('casco en la cabeza, peto en spine_02, hombreras en los brazos', on('Head') === 1 && on('spine_02') === 1 && on('upperarm_l') === 1 && on('upperarm_r') === 1);
check('grebas en muslos y pantorrillas', ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'].every(b => on(b) === 1));
eq.apply(model, { ...loadout, pechera: 'cuero' }, store);
check('al cambiar a peto de cuero se quitan las hombreras', on('upperarm_l') === 0 && on('spine_02') === 1);
eq.apply(model, { weapon: 'hacha', casco: null, pechera: null, grebas: null, escudo: null }, store);
check('sin piezas solo queda el arma', on('hand_r') === 1 && on('Head') === 0 && on('spine_02') === 0 && on('thigh_l') === 0);

// Casco: la cúpula envuelve la cabeza con un margen pequeño (no flota ni queda dentro)
for (const tier of Object.keys(C.ARMOR.casco).filter(t => t !== 'ninguno')) {
  const m2 = new Obj(); const b2 = {}; m2.getObjectByName = n => b2[n] || (b2[n] = new Obj());
  createEquipment(THREE, H.PROFILES.hero).apply(m2, { casco: tier }, {});
  let dome = null; b2.Head.traverse(o => { if (o.isMesh && o.geometry.type === 'sphere' && !dome) dome = o; });
  const h = H.PROFILES.hero.head;
  const hx = dome.scale.x, hy = dome.scale.y;
  check(`casco ${tier}: ancho de la cúpula entre 0 y 4 cm más que la cabeza`, hx - h.hx > 0.005 && hx - h.hx < 0.04);
  check(`casco ${tier}: altura de la cúpula cubre la cabeza con margen pequeño`, hy * 2 - (h.y1 - h.y0) > 0.02 && hy * 2 - (h.y1 - h.y0) < 0.1);
}
// unidades: un modelo escalado compensa el tamaño de las piezas
const m3 = new Obj(); const b3 = {}; m3.getObjectByName = n => b3[n] || (b3[n] = new Obj());
createEquipment(THREE, H.PROFILES.hero).apply(m3, { weapon: 'espada' }, {}, 1 / 1.1);
check('con unit=1/1.1 las piezas se reducen para quedar en metros reales', Math.abs(b3.hand_r.children[0].children[0].scale.x - 1 / 1.1) < 1e-9 || Math.abs(b3.hand_r.children[0].scale.x - 1 / 1.1) < 1e-9);

// --- Modelos GLB de armas y escudos (Quaternius, CC0) ---
import fs from 'node:fs';
const readGlb = f => { const b = fs.readFileSync(f); const jl = b.readUInt32LE(12); return { magic: b.toString('latin1', 0, 4), json: JSON.parse(b.toString('utf8', 20, 20 + jl)) }; };
for (const [id, nm] of Object.entries(EQ.WEAPON_MODEL)) {
  const g = readGlb(`assets/weapons/${nm}.glb`), x = g.json.nodes[0].extras;
  check(`${id} (${nm}.glb): GLB válido, largo 0.35–1.7 m, hoja hacia +Z con el agarre en el origen`, g.magic === 'glTF' && x.size[2] > 0.35 && x.size[2] < 1.7 && x.min[2] < -0.05 && x.max[2] > 0.3);
}
for (const [id, nm] of Object.entries(EQ.SHIELD_MODEL)) {
  const g = readGlb(`assets/weapons/${nm}.glb`), x = g.json.nodes[0].extras;
  check(`${id} (${nm}.glb): escudo de 0.35–0.8 m, fino en X (cara hacia -X)`, g.magic === 'glTF' && x.size[1] > 0.35 && x.size[1] < 0.8 && x.size[0] < 0.2 && Math.abs(x.max[0] - ({ Shield_Round: .07, Shield_Heater: .06, Shield_Heater_2: .04 })[nm]) < 0.011);
}
class FakeLoader { async loadAsync(url) { if (url.endsWith('/Axe.glb')) throw new Error('404'); const sc = new Obj(); sc.add(new Mesh({ type: 'glb' }, {})); sc.clone = () => { const c = new Obj(); c.add(new Mesh({ type: 'glb' }, {})); return c; }; return { scene: sc }; } }
const mq = new Obj(), bq = {}; mq.getObjectByName = n => bq[n] || (bq[n] = new Obj());
const eqm = createEquipment(THREE, H.PROFILES.hero);
check('loadModels cuenta los GLB cargados y tolera los que fallan (14 de 15)', await eqm.loadModels(FakeLoader) === 14);
const stq = {}; eqm.apply(mq, { weapon: 'espada', escudo: 'torre' }, stq);
let glbs = 0; mq.traverse?.(() => {}); [bq.hand_r, bq.lowerarm_l].forEach(b => b.traverse(o => { if (o.geometry?.type === 'glb') glbs++; }));
check('espada y escudo torre usan el modelo GLB', glbs === 2);
check('el escudo con modelo queda por fuera del antebrazo (x negativo) y a media altura', bq.lowerarm_l.children[0].position.x < -0.05 && Math.abs(bq.lowerarm_l.children[0].position.y - 0.14) < 1e-9);
eqm.apply(mq, { weapon: 'hacha' }, stq);
let sim = 0; bq.hand_r.traverse(o => { if (o.geometry?.type === 'cyl') sim++; });
check('si el modelo del hacha no cargó, se usa la forma simple', sim >= 1);
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
