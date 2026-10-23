// hero-fbx.js — el héroe nuevo (sera_limpio) con las animaciones que se eligieron en clips-lab.html.
// sera_limpio-anim.glb lo crea clips-lab.html (botón CREAR GLB): personaje a 1.82 m, huesos «mixamorig…» y los clips elegidos ya fijos,
// con nombres normalizados ('idle loop', 'walk loop', 'sprint loop', 'sword attack', 'jump start'…) que locomotion.js e index-app.js
// usan igual que con el humano anterior. Devuelve lo mismo que loadHero() de hero.js.

import { decodeName } from './clip-categories.js';

export const HERO_FBX_URL = './assets/characters/hero/sera_limpio-anim.glb';

export async function loadHeroFbx(THREE, GLTFLoader, urls = {}) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().load(urls.model || HERO_FBX_URL, res, undefined, rej));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = o.receiveShadow = true;
    for (const m of [].concat(o.material)) m.side = THREE.DoubleSide;
  });
  // grupos de animación (clips-lab los escribe como sufijo del nombre): se dejan los nombres normales y se devuelve el grupo de cada uno
  const categories = {}; let explicit = false;
  for (const c of gltf.animations) { const d = decodeName(c.name); c.name = d.name; categories[d.name] = d.cat; explicit = explicit || d.explicit; }
  const byCat = (cat) => gltf.animations.filter((c) => categories[c.name] === cat);
  // combo de ataque: los clips del grupo «ataque», en el orden del GLB (solo si el GLB ya trae grupos; si no, el juego usa su ataque de siempre)
  const combo = explicit ? byCat('ataque').map((c) => ({ key: c.name.toLowerCase(), dur: c.duration, hit: c.duration * 0.4 })) : [];
  return { model: gltf.scene, clips: gltf.animations, source: 'fbx', profile: null, kit: null, categories, combo, triggers: explicit ? byCat('mapa').map((c) => c.name) : [] };
}
