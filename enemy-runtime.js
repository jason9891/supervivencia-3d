// enemy-runtime.js — monstruo GLB + IA + anim.
// Activa solo al cruzar la puerta del establo; mira hacia el jugador; no atraviesa paredes.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { createMixamoProcedural } from './mixamo-procedural.js';
import {
  createEnemy, stepEnemy, resolveEnemyStrike, resolveHit, separate, ENEMIES,
} from './combat.js';

const ENEMY_URL = './assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb';
const TARGET_HEIGHT = 0.95; // ~mitad de la altura del personaje
// corregir perfil izquierdo → de frente
const FACE_OFFSET = Math.PI + Math.PI / 2;

const STABLE_DOOR = { minX: 44.5, maxX: 55.5, minZ: 42.0, maxZ: 48.5 };

function inDoor(x, z) {
  return (
    x >= STABLE_DOOR.minX && x <= STABLE_DOOR.maxX &&
    z >= STABLE_DOOR.minZ && z <= STABLE_DOOR.maxZ
  );
}

function fitModel(model, height) {
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());
  if (!isFinite(size.y) || size.y < 1e-4) return;
  const scale = height / size.y;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
}

function createHpBar() {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;z-index:22;width:70px;height:8px;background:#000a;border:1px solid #000;' +
    'border-radius:4px;transform:translate(-50%,-50%);pointer-events:none;display:none;overflow:hidden';
  const fill = document.createElement('i');
  fill.style.cssText = 'display:block;height:100%;width:100%;background:#c0392b;';
  el.appendChild(fill);
  document.body.appendChild(el);
  return { el, fill };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function resolveWalls(x, z, radius, walls) {
  if (!walls || !walls.length) return { x, z };
  let px = x, pz = z;
  const r = radius || 0.4;
  for (let pass = 0; pass < 3; pass++) {
    for (const w of walls) {
      const nx = Math.max(w.minX, Math.min(px, w.maxX));
      const nz = Math.max(w.minZ, Math.min(pz, w.maxZ));
      let dx = px - nx, dz = pz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-10) {
        const left = Math.abs(px - w.minX);
        const right = Math.abs(w.maxX - px);
        const down = Math.abs(pz - w.minZ);
        const up = Math.abs(w.maxZ - pz);
        const m = Math.min(left, right, down, up);
        if (m === left) px = w.minX - r;
        else if (m === right) px = w.maxX + r;
        else if (m === down) pz = w.minZ - r;
        else pz = w.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        px += dx * push;
        pz += dz * push;
      }
    }
  }
  return { x: px, z: pz };
}

export async function createEnemyRuntime(opts) {
  const { scene, camera, player } = opts;
  const getGroundY = opts.getGroundY || (() => 0);
  const walls = opts.walls || [];
  const onHint = opts.onHint || (() => {});

  const onPlat = (x, z) => {
    const r = 0.4;
    for (const w of walls) {
      const nx = Math.max(w.minX, Math.min(x, w.maxX));
      const nz = Math.max(w.minZ, Math.min(z, w.maxZ));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  };

  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const units = [];
  let activated = false;

  function loadGlb(url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  async function spawn(kind, x, z) {
    const data = createEnemy(kind || 'soldado', x, z);
    data.def = { ...data.def, speed: 5.2, aggro: 18 };
    data.state = 'idle';
    data.y = getGroundY(x, z);

    let gltf;
    try {
      gltf = await loadGlb(ENEMY_URL);
    } catch (e) {
      console.warn('enemy glb fail', e);
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.55, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x7a2f27 })
      );
      mesh.position.y = 0.5;
      root.add(mesh);
      root.position.set(x, data.y, z);
      scene.add(root);
      const unit = {
        data, root, anim: null, hpBar: createHpBar(),
        lastState: 'idle', visYaw: data.facing,
      };
      units.push(unit);
      return unit;
    }

    const model = gltf.scene;
    fitModel(model, TARGET_HEIGHT * (data.def.scale || 1));
    const root = new THREE.Group();
    root.add(model);
    root.position.set(x, data.y, z);
    scene.add(root);

    const anim = createMixamoProcedural(THREE, model, { height: TARGET_HEIGHT });
    anim.setMode('idle');

    const unit = {
      data, root, anim, hpBar: createHpBar(),
      lastState: 'idle', visYaw: data.facing,
    };
    units.push(unit);
    return unit;
  }

  const tmp = new THREE.Vector3();
  function toScreen(x, y, z) {
    tmp.set(x, y, z).project(camera);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight };
  }

  function syncAnim(unit) {
    const e = unit.data;
    const anim = unit.anim;
    if (!anim) return;
    if (e.dead) {
      if (!anim.isDead) anim.die();
      return;
    }
    if (!activated) {
      anim.setMode('idle');
      unit.lastState = 'idle';
      return;
    }
    if (e.state === 'windup' || e.state === 'recover') {
      if (unit.lastState !== 'windup' && e.state === 'windup') anim.attack();
      else if (anim.mode === 'idle' || anim.mode === 'walk') anim.attack();
    } else if (e.state === 'chase') {
      if (anim.mode && String(anim.mode).startsWith('attack')) {
      } else {
        anim.setMode('walk');
      }
    } else if (e.state === 'hurt') {
      anim.setMode('hurt');
    } else {
      anim.setMode('idle');
    }
    unit.lastState = e.state;
  }

  function update(dt) {
    const pstats = { defense: 4, blockFrac: 0 };
    const events = [];

    if (!activated && inDoor(player.x, player.z)) {
      activated = true;
      onHint('\u00a1Algo se mueve en el establo!');
      for (const unit of units) {
        if (!unit.data.dead) {
          unit.data.state = 'chase';
          unit.data.def.aggro = 40;
        }
      }
    }

    for (const unit of units) {
      const e = unit.data;

      if (!activated) {
        e.state = 'idle';
        e.y = getGroundY(e.x, e.z);
        unit.root.position.set(e.x, e.y, e.z);
        syncAnim(unit);
        if (unit.anim) unit.anim.update(dt);
        const bar = unit.hpBar;
        const s0 = toScreen(e.x, e.y + 1.15, e.z);
        if (s0 && !e.dead) {
          bar.el.style.display = 'block';
          bar.el.style.left = s0.x + 'px';
          bar.el.style.top = s0.y + 'px';
          bar.fill.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
        } else bar.el.style.display = 'none';
        continue;
      }

      const ev = stepEnemy(e, player, onPlat, dt);
      for (const x of ev) {
        if (x.type === 'enemyStrike') {
          const r = resolveEnemyStrike(e, player, pstats);
          if (r) {
            events.push({ type: 'playerHurt', result: r, enemy: e });
            if (r.killed) onHint('Has ca\u00eddo...');
            else if (r.blocked) onHint('Bloqueaste el golpe');
            else onHint('\u00a1Te golpe\u00f3 el monstruo! (-' + r.damage + ')');
          }
        }
      }

      if (!e.dead) {
        const dx = player.x - e.x, dz = player.z - e.z;
        if (Math.hypot(dx, dz) > 0.05) e.facing = Math.atan2(dx, dz);
      }

      const fixed = resolveWalls(e.x, e.z, e.radius || 0.35, walls);
      e.x = fixed.x;
      e.z = fixed.z;

      e.y = getGroundY(e.x, e.z);
      unit.root.position.set(e.x, e.y, e.z);

      let dYaw = wrapAngle(e.facing - unit.visYaw);
      unit.visYaw = wrapAngle(unit.visYaw + dYaw * Math.min(1, dt * 14));
      unit.root.rotation.y = unit.visYaw + FACE_OFFSET;
      unit.root.rotation.z = 0;

      if (e.dead) {
        const t = Math.min(1, e.deadT / 1.35);
        const ease = t * t * (3 - 2 * t);
        unit.root.rotation.z = ease * 1.35;
        unit.root.position.y = e.y - ease * 0.2;
      }

      syncAnim(unit);
      if (unit.anim) unit.anim.update(dt);

      const bar = unit.hpBar;
      if (e.dead || e.hp <= 0) {
        bar.el.style.display = 'none';
      } else {
        const s = toScreen(e.x, e.y + 1.15, e.z);
        if (s) {
          bar.el.style.display = 'block';
          bar.el.style.left = s.x + 'px';
          bar.el.style.top = s.y + 'px';
          bar.fill.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
        } else bar.el.style.display = 'none';
      }
    }

    if (activated) separate(units.map((u) => u.data), onPlat, 0.9);
    return events;
  }

  function tryPlayerHit(optsHit = {}) {
    const reach = optsHit.reach ?? 2.2;
    const dmg = optsHit.dmg ?? 14;
    const hits = [];
    for (const unit of units) {
      const e = unit.data;
      if (e.dead) continue;
      const dx = e.x - player.x;
      const dz = e.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach + e.radius) continue;
      const ang = Math.atan2(dx, dz);
      let diff = wrapAngle(ang - player.facing);
      if (Math.abs(diff) > 1.1) continue;

      const fakeAttack = { data: { dmg }, mult: 1, stagger: dist < 1.2 };
      const r = resolveHit(
        { x: player.x, z: player.z, facing: player.facing, fury: 0 },
        e,
        fakeAttack,
        e.stats
      );
      hits.push({ enemy: e, result: r });
      if (r.killed) {
        if (unit.anim) unit.anim.die();
        onHint((e.def.name || 'Enemigo') + ' derrotado');
      }
    }
    return hits;
  }

  /** Empuja jugador y monstruo para que no se traspasen (cuerpos sólidos). */
  function resolveAgainstPlayer(player) {
    if (!player) return;
    const pr = 0.42;
    for (const unit of units) {
      const e = unit.data;
      if (e.dead) continue;
      const er = (e.radius || 0.4) * 0.95;
      let dx = player.x - e.x;
      let dz = player.z - e.z;
      let dist = Math.hypot(dx, dz);
      const minD = pr + er;
      if (dist >= minD) continue;
      if (dist < 1e-5) {
        dx = Math.sin(player.facing || 0);
        dz = Math.cos(player.facing || 0);
        dist = 1;
      }
      const push = (minD - dist) / dist;
      player.x += dx * push * 0.6;
      player.z += dz * push * 0.6;
      e.x -= dx * push * 0.4;
      e.z -= dz * push * 0.4;
      const fixed = resolveWalls(e.x, e.z, er, walls);
      e.x = fixed.x;
      e.z = fixed.z;
      unit.root.position.x = e.x;
      unit.root.position.z = e.z;
    }
  }

  return {
    spawn,
    update,
    tryPlayerHit,
    resolveAgainstPlayer,
    get activated() { return activated; },
    get units() { return units; },
    ENEMIES,
  };
}
