// hero-fbx.js — el héroe nuevo (personaje_1, Tripo) con las animaciones de siempre (UAL: Idle_Loop, Walk_Loop, Jog_Fwd_Loop, Sword_Attack…).
// personaje_1.glb lo genera tools/bake-hero.py: toma las animaciones de assets/characters/ual/ y las retargetea a los huesos «mixamorig»
// del personaje (por rotaciones en el mundo respecto al reposo), con el cuerpo a 1.82 m. Los clips conservan sus nombres originales,
// así que locomotion.js e index-app.js los usan igual que antes. Devuelve lo mismo que loadHero() de hero.js.
// (Las animaciones Mixamo «sword and shield» siguen disponibles en hero-lab.html y con `bake-hero.py mixamo`.)

export const HERO_FBX_URL = './assets/characters/hero/personaje_1.glb';

export async function loadHeroFbx(THREE, GLTFLoader, urls = {}) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().load(urls.model || HERO_FBX_URL, res, undefined, rej));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.castShadow = o.receiveShadow = true;
    for (const m of [].concat(o.material)) m.side = THREE.DoubleSide;
  });
  return { model: gltf.scene, clips: gltf.animations, source: 'fbx', profile: null, kit: null };
}
