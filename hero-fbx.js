// hero-fbx.js — el héroe nuevo (sera_limpio) con las animaciones que se eligieron en clips-lab.html.
// sera_limpio-anim.glb lo crea clips-lab.html (botón CREAR GLB): personaje a 1.82 m, huesos «mixamorig…» y los clips elegidos ya fijos,
// con nombres normalizados ('idle loop', 'walk loop', 'sprint loop', 'sword attack', 'jump start'…) que locomotion.js e index-app.js
// usan igual que con el humano anterior. Devuelve lo mismo que loadHero() de hero.js.

export const HERO_FBX_URL = './assets/characters/hero/sera_limpio-anim.glb';

export async function loadHeroFbx(THREE, GLTFLoader, urls = {}) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().load(urls.model || HERO_FBX_URL, res, undefined, rej));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = o.receiveShadow = true;
    for (const m of [].concat(o.material)) m.side = THREE.DoubleSide;
  });
  return { model: gltf.scene, clips: gltf.animations, source: 'fbx', profile: null, kit: null };
}
