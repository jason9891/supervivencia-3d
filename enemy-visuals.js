// enemy-visuals.js — dibuja a los enemigos de arena.js: el mismo humano (CC0) teñido, con su arma y armadura, sus animaciones,
// un destello rojo al preparar el golpe y una barra de vida. Solo navegador (usa three.js); la lógica está en arena.js.
import * as A from './arena.js';
import { createLoco, smoothYaw } from './locomotion.js';
import { tintModel } from './equipment.js';

// hero: { model, profile } de loadHero · clips: Map nombre-normalizado → clip · unit: compensación de escala del modelo (modelUnit).
export function createEnemyVisuals({ THREE, scene, camera, SkeletonUtils, hero, clips, unit = 1, createEquipment, GLTFLoader }) {
  const equip = createEquipment(THREE, hero.profile);
  const template = SkeletonUtils.clone(hero.model);   // copia limpia (el modelo del jugador luego lleva su equipo puesto)
  const views = new Map();
  equip.loadModels(GLTFLoader).then(() => { for (const v of views.values()) v.equipKey = ''; }).catch(() => { });
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:18;overflow:hidden';
  document.body.appendChild(layer);
  const tmp = new THREE.Vector3();
  const has = n => clips.has(n);

  function build(e) {
    const L = A.LOOKS[e.kind] || A.LOOKS.soldado;
    const group = new THREE.Group();
    const model = SkeletonUtils.clone(template);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    tintModel(model, e.def.tint);                                  // clona los materiales: cada enemigo tiene el suyo
    group.add(model); group.scale.setScalar(e.def.scale || 1);
    scene.add(group);
    const mixer = new THREE.AnimationMixer(model);
    const host = { active: null };
    const loco = createLoco(THREE, mixer, clips, host);
    const mats = []; model.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.emissive) mats.push(m); });
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;width:54px;height:6px;margin:-3px 0 0 -27px;background:#000a;border:1px solid #0009;border-radius:3px;display:none';
    const fill = document.createElement('i'); fill.style.cssText = 'display:block;height:100%;width:100%;background:#c0392b;border-radius:2px';
    bar.appendChild(fill); layer.appendChild(bar);
    const v = { e, group, model, mixer, loco, mats, bar, fill, yaw: e.facing, store: {}, equipKey: '', L };
    views.set(e, v);
    return v;
  }
  function dress(v) {
    v.equipKey = 'ok';
    equip.apply(v.model, { weapon: v.L.weapon, ...v.L.equip }, v.store, unit);
  }
  function drop(v) {
    scene.remove(v.group); if (v.bar.remove) v.bar.remove(); views.delete(v.e);
  }

  function update(arena, dt) {
    for (const [e, v] of views) if (!arena.enemies.includes(e)) drop(v);
    for (const e of arena.enemies) {
      const v = views.get(e) || build(e);
      if (!v.equipKey) dress(v);
      v.group.position.set(e.x, e.y || 0, e.z);
      v.yaw = smoothYaw(v.yaw, e.facing, dt, 12);
      v.group.rotation.y = v.yaw;
      v.loco.apply(A.pick(e, has));
      v.mixer.update(dt);
      // Aviso: el cuerpo se enrojece mientras prepara el golpe y destella al ser golpeado.
      const k = Math.max(A.windupProgress(e), e.hurtT > 0 ? 0.8 : 0);
      for (const m of v.mats) m.emissive.setRGB(k * 0.9, k * 0.05, 0);
      // Barra de vida sobre la cabeza.
      tmp.set(e.x, (e.y || 0) + 2.15 * (e.def.scale || 1), e.z).project(camera);
      const show = !e.dead && tmp.z < 1 && e.hp < e.maxHp;
      v.bar.style.display = show ? 'block' : 'none';
      if (show) {
        v.bar.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px'; v.bar.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px';
        v.fill.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
      }
    }
  }
  function clearAll() { for (const v of [...views.values()]) drop(v); }
  return { update, clearAll, get count() { return views.size; } };
}
