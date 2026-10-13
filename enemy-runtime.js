// enemy-runtime.js — monstruo GLB + IA + anim. Mira al jugador, aggro en establo.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { createMixamoProcedural } from './mixamo-procedural.js';
import {
  createEnemy, stepEnemy, resolveEnemyStrike, resolveHit, separate, ENEMIES,
} from './combat.js';

const ENEMY_URL = './assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb';
const TARGET_HEIGHT = 1.85;
// Mixamo suele mirar +Z; si el modelo avanza de espaldas, dejar Math.PI.
const FACE_OFFSET = Math.PI;

// Zona establo (map1 ZONES.stable)
const STABLE = { minX: 13.5, maxX: 54, minZ: 43, maxZ: 63 };

function inStable(x, z) {
  return x >= STABLE.minX && x <= STABLE.maxX && z >= STABLE.minZ && z <= STABLE.maxZ;
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

export async function createEnemyRuntime(opts) {
  const { scene, camera, player } = opts;
  const getGroundY = opts.getGroundY || (() => 0);
  const onPlat = opts.onPlat || (() => true);
  const onHint = opts.onHint || (() => {});

  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const units = [];
  let alertedOnce = false;

  function loadGlb(url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
  }

  async function spawn(kind, x, z) {
    const data = createEnemy(kind || 'soldado', x, z);
    data.def = {
      ...data.def,
      speed: 2.85,
      aggro: 22,
    };
    data.y = getGroundY(x, z);

    let gltf;
    try {
      gltf = await loadGlb(ENEMY_URL);
    } catch (e) {
      console.warn('enemy glb fail', e);
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.1, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x7a2f27 })
      );
      mesh.position.y = 0.9;
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
    if (e.state === 'windup') {
      if (unit.lastState !== 'windup') anim.attack();
    } else if (e.state === 'recover') {
      // breve
    } else if (e.state === 'chase') {
      anim.setMode('walk');
    } else if (e.state === 'hurt') {
      anim.setMode('hurt');
    } else {
      anim.setMode('idle');
    }
    unit.lastState = e.state;
  }

  function facePlayer(e) {
    const dx = player.x - e.x;
    const dz = player.z - e.z;
    if (Math.hypot(dx, dz) < 0.05) return;
    e.facing = Math.atan2(dx, dz);
  }

  function update(dt) {
    const pstats = { defense: 4, blockFrac: 0 };
    const events = [];
    const playerInStable = inStable(player.x, player.z);

    for (const unit of units) {
      const e = unit.data;

      if (!e.dead && playerInStable && e.state === 'idle') {
        e.state = 'chase';
        e.def.aggro = 40;
        if (!alertedOnce) {
          alertedOnce = true;
          onHint('\u00a1El monstruo te ha visto!');
        }
      }

      if (!e.dead && (e.state === 'chase' || e.state === 'windup' || e.state === 'recover' || e.state === 'hurt')) {
        facePlayer(e);
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

      if (!e.dead && e.state !== 'idle') facePlayer(e);

      e.y = getGroundY(e.x, e.z);
      unit.root.position.set(e.x, e.y, e.z);

      let dYaw = wrapAngle(e.facing - unit.visYaw);
      unit.visYaw = wrapAngle(unit.visYaw + dYaw * Math.min(1, dt * 10));
      unit.root.rotation.y = unit.visYaw + FACE_OFFSET;
      unit.root.rotation.z = 0;

      if (e.dead) {
        const t = Math.min(1, e.deadT / 0.9);
        unit.root.rotation.z = t * 1.2;
        unit.root.position.y = e.y - t * 0.25;
      }

      syncAnim(unit);
      if (unit.anim) unit.anim.update(dt);

      const bar = unit.hpBar;
      if (e.dead || e.hp <= 0) {
        bar.el.style.display = 'none';
      } else {
        const s = toScreen(e.x, e.y + 2.15, e.z);
        if (s) {
          bar.el.style.display = 'block';
          bar.el.style.left = s.x + 'px';
          bar.el.style.top = s.y + 'px';
          bar.fill.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
        } else bar.el.style.display = 'none';
      }
    }

    separate(units.map((u) => u.data), onPlat, 1.1);
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

  return {
    spawn,
    update,
    tryPlayerHit,
    get units() { return units; },
    ENEMIES,
  };
}
