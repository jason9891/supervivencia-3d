// weapon-wear.js — arma en la mano derecha del héroe nuevo (sera_limpio, huesos mixamorig…). Los modelos son los de equipment.js
// (Quaternius CC0: el agarre en el origen y la hoja hacia +Z; los de Tripo con su MODEL_FIX). Solo se ve con el arma desenfundada (botón ARMA).
import { WEAPON_MODEL, MODEL_DIR, MODEL_FIX } from './equipment.js';

// Cómo se pone el modelo en el hueso de la mano derecha de Mixamo (rotación XYZ en rad, posición en m dentro del hueso). Afinado a ojo con la guardia 'sas idle'.
export const HAND_FIX = { rot: [0.5, 0, 0], pos: [0, 0.08, 0], scale: 1 };

export async function loadWeapons(THREE, GLTFLoader, MeshoptDecoder, hero, { dir = MODEL_DIR } = {}) {
  let hand = null; hero.traverse((o) => { if (o.isBone && /RightHand$/.test(o.name)) hand = o; });
  if (!hand) throw new Error('el héroe no tiene mano derecha');
  if (MeshoptDecoder && MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const loader = new GLTFLoader(); if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  const holder = new THREE.Group(); holder.name = 'arma'; hand.add(holder);
  const cache = new Map(); let current = null, drawn = false;
  const apply = () => { holder.visible = drawn && !!current; };
  async function modelOf(id) {
    const nm = WEAPON_MODEL[id]; if (!nm) return null;
    if (cache.has(nm)) return cache.get(nm);
    const scene = (await loader.loadAsync(dir + nm + '.glb')).scene, fx = MODEL_FIX[nm];
    const inner = scene.clone(true);
    inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (fx && fx.metal != null && o.material) { o.material = o.material.clone(); o.material.metalness = fx.metal; o.material.roughness = fx.rough; } } });
    const wrap = new THREE.Group();
    if (fx) { inner.rotation.set(...fx.rot); inner.position.set(...fx.pos); if (fx.scale) inner.scale.setScalar(fx.scale); }
    wrap.add(inner); cache.set(nm, wrap); return wrap;
  }
  const api = {
    holder, HAND_FIX,
    get current() { return current; },
    get drawn() { return drawn; },
    /** Pone el arma `id` ('espada', 'hacha'…) en la mano, o ninguna con null. */
    async set(id) {
      holder.clear(); current = null;
      if (id) { const m = await modelOf(id); if (m) { holder.add(m.clone(true)); current = id; } }
      api.fit(); apply(); return current;
    },
    /** Desenfunda / enfunda. */
    draw(v) { drawn = !!v; apply(); },
    /** Coloca el modelo en el hueso según HAND_FIX (se puede cambiar HAND_FIX en caliente y volver a llamar). */
    fit() { holder.rotation.set(...HAND_FIX.rot); holder.position.set(...HAND_FIX.pos); holder.scale.setScalar(HAND_FIX.scale); },
  };
  return api;
}
