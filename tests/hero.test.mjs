import * as H from '../hero.js';
import { createEquipment } from '../equipment.js';
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
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
