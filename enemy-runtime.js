// enemy-runtime.js — monstruo GLB + IA + anim.
// Activa solo al cruzar la puerta del establo; mira hacia el jugador; no atraviesa paredes.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { createMixamoProcedural } from './mixamo-procedural.js';
import { equipMonster } from './monster-moves.js';
import {
  createEnemy, stepEnemy, resolveEnemyStrike, resolveHit, separate, ENEMIES,
} from './combat.js';

const ENEMY_URL = './assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb';
const TARGET_HEIGHT = 0.95;
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

// Elige cómo muere: de espaldas (lo más común), de bruces, de costado (D/I), de rodillas, o perdiendo un brazo o la cabeza.
const DEATH_PICKS = [['death', 0.28], ['deathFront', 0.20], ['deathSideR', 0.10], ['deathSideL', 0.10], ['deathKneel', 0.12],
  ['deathArmR', 0.05], ['deathArmL', 0.05], ['deathDecap', 0.06], ['deathDecapBack', 0.04]];   // las últimas cuatro desmiembran (brazo o cabeza)
export function pickDeath(rand = Math.random) {
  let r = rand(), acc = 0;
  for (const [name, w] of DEATH_PICKS) { acc += w; if (r < acc) return name; }
  return 'death';
}
function killAnim(unit) { if (unit.anim && !unit.anim.isDead) unit.anim.die(pickDeath()); }

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

// Combo de 3 golpes (zarpazo D → zarpazo I → golpe a dos manos). Los instantes de impacto salen de los clips (anim.attackTimeline());
// estos son los de respaldo si no cargan los clips.
export const COMBO = [
  { at: 0.26, mult: 0.7, reach: 1.0 },
  { at: 0.74, mult: 0.7, reach: 1.0 },
  { at: 1.42, mult: 1.6, reach: 1.25 },   // golpe fuerte final
];
export const COMBO_END = 1.68;
export const COMBO_PAUSE = 1.1;           // respiro tras el 3.er golpe antes de repetir
export const RUN_DIST = 2.4;              // más lejos que esto corre; cerca avanza caminando
export const RUN_RATE = 1.5, WALK_RATE = 3.0;   // velocidad de reproducción del ciclo (la del suelo sale del propio clip: pies sin deslizar)
export const RUN_SPEED = 2.4, WALK_SPEED = 0.55;   // de respaldo (sin clips)

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
    await equipMonster(anim, model);
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
      killAnim(unit);
      return;
    }
    if (!activated) {
      anim.setMode('idle');
      unit.lastState = 'idle';
      return;
    }
    if (unit.combo) { unit.lastState = e.state; return; }   // el combo maneja la animación
    const far = Math.hypot(player.x - e.x, player.z - e.z) > RUN_DIST;
    if (e.state === 'chase') { anim.setMode(far ? 'run' : 'walk'); anim.setRate(far ? RUN_RATE : WALK_RATE); }
    else if (e.state === 'recover') { anim.setMode('walk'); anim.setRate(WALK_RATE); }
    else anim.setMode('idle');
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

      if (e.dead) unit.combo = null;
      const strikes = [];
      if (unit.combo) {
        const c = unit.combo;
        c.t += dt;
        e.t = 0;                       // mantiene 'windup': stepEnemy no dispara su golpe único
        e.state = 'windup';
        e.facing = Math.atan2(player.x - e.x, player.z - e.z);
        const dist = Math.hypot(player.x - e.x, player.z - e.z);
        const tl = unit.anim ? unit.anim.attackTimeline() : { hits: COMBO.map((k) => k.at), end: COMBO_END };
        if (c.i < COMBO.length && c.t >= tl.hits[c.i]) { strikes.push(COMBO[c.i]); c.i++; }
        if (c.i < COMBO.length && dist > e.def.reach * 1.8) {   // el jugador huyó: corta el combo
          unit.combo = null; e.state = 'chase'; e.t = 0;
          if (unit.anim) { unit.anim.setMode('run'); unit.anim.setRate(RUN_RATE); }
        } else if (c.t >= tl.end) {
          unit.combo = null; e.state = 'recover'; e.t = -(COMBO_PAUSE - e.def.recover);
          if (unit.anim) unit.anim.setMode('idle');
        }
      } else {
        const d0 = Math.hypot(player.x - e.x, player.z - e.z);
        const an = unit.anim, far0 = d0 > RUN_DIST;
        e.def.speed = an && an.hasClips ? an.groundSpeed(far0 ? 'run' : 'walk') * (far0 ? RUN_RATE : WALK_RATE) : (far0 ? RUN_SPEED : WALK_SPEED);
        stepEnemy(e, player, onPlat, dt);   // sus eventos de golpe único se ignoran: los golpes vienen del combo
        if (e.state === 'windup' && !e.dead) {
          unit.combo = { t: 0, i: 0 };
          if (unit.anim) { unit.anim.setMode('idle'); unit.anim.attack(); }
        }
      }
      const ev = strikes.map((st) => ({ type: 'enemyStrike', enemy: e, st }));
      for (const x of ev) {
        const baseDmg = e.def.dmg, baseReach = e.def.reach;
        e.def.dmg = baseDmg * x.st.mult;
        e.def.reach = baseReach * x.st.reach;
        const r = resolveEnemyStrike(e, player, pstats);
        e.def.dmg = baseDmg; e.def.reach = baseReach;
        if (r) {
          events.push({ type: 'playerHurt', result: r, enemy: e });
          if (r.killed) onHint('Has ca\u00eddo...');
          else if (r.blocked) onHint('Bloqueaste el golpe');
          else onHint('\u00a1Te golpe\u00f3 el monstruo! (-' + r.damage + ')');
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
      unit.root.rotation.x = 0;

      if (e.dead) {
        const t = Math.min(1, e.deadT / 1.35);
        const ease = t * t * (3 - 2 * t);
        if (unit.anim && unit.anim.isDead && unit.anim.deathBaked) {
          // la caída ya está en el clip (apoyada en el suelo): la raíz no gira ni se hunde
        } else {
          const tl = unit.anim && unit.anim.isDead ? unit.anim.deathTilt : { axis: 'z', angle: 1.35 };   // respaldo: vuelco de la raíz
          if (tl.axis === 'x') unit.root.rotateX(ease * tl.angle); else unit.root.rotateZ(ease * tl.angle);
          unit.root.position.y = e.y - ease * (unit.anim && unit.anim.hasDeathClip ? 0.03 : 0.2);
        }
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
        killAnim(unit);
        onHint((e.def.name || 'Enemigo') + ' derrotado');
      }
    }
    return hits;
  }

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

  /** Levanta a todos los monstruos en su punto de aparición (laboratorio / pruebas). */
  function revive() {
    for (const unit of units) {
      const e = unit.data;
      e.hp = e.maxHp; e.dead = false; e.deadT = 0; e.state = activated ? 'chase' : 'idle'; e.t = 0; e.hitstun = 0;
      e.x = e.spawn.x; e.z = e.spawn.z; unit.combo = null; unit.lastState = 'idle';
      unit.root.rotation.z = 0; unit.root.rotation.x = 0;
      if (unit.anim) { unit.anim.revive(); unit.anim.setMode('idle'); }
    }
  }

  return {
    spawn,
    revive,
    update,
    tryPlayerHit,
    resolveAgainstPlayer,
    get activated() { return activated; },
    get units() { return units; },
    ENEMIES,
  };
}
