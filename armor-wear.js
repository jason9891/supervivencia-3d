// armor-wear.js — armadura del héroe por conjuntos: casco, pechera, brazos, piernas (las piernas incluyen las botas).
// assets/characters/hero/armadura-sera.glb lo hornea tools/bake-armor.py: 16 piezas ajustadas al cuerpo de sera_limpio y con piel
// (pesos copiados del cuerpo), así que se doblan con cualquier animación. Aquí se enganchan al esqueleto del personaje cargado
// (los huesos se buscan por nombre) y se muestran u ocultan por conjunto.
export const ARMOR_URL = './assets/characters/hero/armadura-sera.glb';
export const ARMOR_SETS = ['casco', 'pechera', 'brazos', 'piernas'];
export const ARMOR_LABEL = { casco: 'CASCO', pechera: 'PECHERA', brazos: 'BRAZOS', piernas: 'PIERNAS' };
const LS = 'armor-worn-v1';

/** hero: el nodo raíz del personaje (el de sus huesos mixamorig…). Devuelve { sets, isWorn, wear, toggle, all, root }. */
export async function loadArmor(THREE, GLTFLoader, MeshoptDecoder, hero, { url = ARMOR_URL, worn } = {}) {
  if (MeshoptDecoder && MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const loader = new GLTFLoader(); if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const heroBones = new Map(); hero.traverse((o) => { if (o.isBone) heroBones.set(o.name, o); });
  const root = new THREE.Group(); root.name = 'armadura'; hero.add(root);
  const sets = Object.fromEntries(ARMOR_SETS.map((s) => [s, []]));
  const meshes = []; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  for (const m of meshes) {
    const bones = m.skeleton.bones.map((b) => heroBones.get(b.name));
    if (bones.some((b) => !b)) throw new Error('la armadura usa huesos que el personaje no tiene');
    m.removeFromParent();
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), new THREE.Matrix4());   // vértices en reposo del mundo, bindMatrix = I (modo «attached»)
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    for (const mat of [].concat(m.material)) mat.side = THREE.DoubleSide;
    const set = m.userData.set || m.name.split('_')[0];
    (sets[set] || (sets[set] = [])).push(m); root.add(m);
  }
  let state = {};
  try { state = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { /* sin almacenamiento */ }
  if (worn) state = { ...state, ...worn };
  const api = {
    root, sets,
    isWorn: (s) => !!state[s],
    wear(s, v) { state[s] = !!v; for (const m of sets[s] || []) m.visible = !!v; try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { /* nada */ } return !!v; },
    toggle(s) { return api.wear(s, !state[s]); },
    all(v) { for (const s of ARMOR_SETS) api.wear(s, v); },
  };
  for (const s of ARMOR_SETS) api.wear(s, !!state[s]);
  return api;
}
