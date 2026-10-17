import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { createPlayer, stepPlayer, WALK_SPEED, RUN_SPEED } from './course.js';
import { loadHero } from './hero.js';
import { backpedal, smoothYaw, createLocoState, stepLoco, createLoco, switchAction, BACK_SPEED } from './locomotion.js';
import {
  buildMap1, getCurrentZone, STORY_PAGE,
  distanceToPage, distanceToKey, distanceToLever, distanceToFood,
  resolveWallCollisions, resolveGround, closePassageGate, tryUnlockTowerDoor, MAP_CENTER, WALLS, getGroundHeight
} from './map1.js';
import { createEnemyRuntime } from './enemy-runtime.js';

const errorBox = document.getElementById('error');
addEventListener('error', e => { errorBox.style.display = 'block'; errorBox.textContent = 'Error: ' + (e.message || ''); });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7eb6e0);
scene.fog = new THREE.Fog(0xb8d4ea, 55, 200);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 280);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc8e4ff, 0x8a9a6a, 1.15));
const keyLight = new THREE.DirectionalLight(0xfff2d6, 2.6);
keyLight.position.set(35, 48, 18);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 140;
keyLight.shadow.camera.left = -60;
keyLight.shadow.camera.right = 60;
keyLight.shadow.camera.top = 60;
keyLight.shadow.camera.bottom = -60;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);
scene.add(new THREE.DirectionalLight(0xffe0b0, 0.85).translateX(-12).translateY(18).translateZ(8));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const mapData = buildMap1(scene);
let pageRead = false, hasKey = false, leverPulled = false, gateClosed = false, foodTaken = false;

const course = { segments: [{ a: 100, b: -100 }], gaps: 0, freeMap: true };
const player = createPlayer(course);
player.x = 6.5; player.z = 3; player.y = 0;
player.checkpoint = { x: 6.5, z: 3 };
player.facing = 0;

// --- Boot + cinemática de intro ---
const bootEl = document.getElementById('boot');
const bootFill = document.getElementById('bootFill');
const bootMsg = document.getElementById('bootMsg');
const bootState = { hero: false, enemy: false, started: false };
let introPlaying = true;
let introT = 0;
const INTRO_DUR = 5.6;
function setBoot(pct, msg) {
  if (bootFill) bootFill.style.width = Math.max(8, Math.min(100, pct)) + '%';
  if (bootMsg && msg) bootMsg.textContent = msg;
}
function tryStartIntro() {
  if (bootState.started) return;
  if (!bootState.hero) return;
  bootState.started = true;
  setBoot(100, 'Listo');
  document.body.classList.add('intro-lock');
  setTimeout(() => {
    if (bootEl) bootEl.classList.add('hide');
    introT = 0;
    introPlaying = true;
    document.getElementById('hint').textContent = '…llegas a casa';
  }, 450);
}
function easeInOut(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function updateIntroCamera(dt) {
  introT += dt;
  const px = player.x, py = player.y, pz = player.z;
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  let cam = new THREE.Vector3();
  let look = new THREE.Vector3(px, py + 1.0, pz);
  if (introT < 1.4) {
    const u = easeInOut(introT / 1.4);
    cam.set(px + fx * 2.2, py + 0.15 + 0.9 * u, pz + fz * 2.2);
    look.set(px, py + 0.4 + 1.0 * u, pz);
    document.getElementById('hint').textContent = 'El regreso…';
  } else if (introT < 2.6) {
    const u = easeInOut((introT - 1.4) / 1.2);
    cam.set(px + fx * (2.0 - 0.3 * u), py + 1.05 + 0.55 * u, pz + fz * (2.0 - 0.3 * u));
    look.set(px, py + 1.4 + 0.35 * u, pz);
    document.getElementById('hint').textContent = 'Todo parece en calma…';
  } else if (introT < 4.6) {
    const u = (introT - 2.6) / 2.0;
    const ang = player.facing + u * Math.PI * 2;
    const r = 2.8;
    cam.set(px + Math.sin(ang) * r, py + 1.55, pz + Math.cos(ang) * r);
    look.set(px, py + 1.45, pz);
    document.getElementById('hint').textContent = 'El pueblo te espera';
  } else if (introT < INTRO_DUR) {
    const u = easeInOut((introT - 4.6) / (INTRO_DUR - 4.6));
    const ang = player.facing;
    const orbit = new THREE.Vector3(
      px + Math.sin(ang) * 2.8,
      py + 1.55,
      pz + Math.cos(ang) * 2.8
    );
    const gameplay = new THREE.Vector3(
      px - Math.sin(visYaw) * CAM_DIST,
      py + CAM_HEIGHT,
      pz - Math.cos(visYaw) * CAM_DIST
    );
    cam.lerpVectors(orbit, gameplay, u);
    look.set(px, py + CAM_LOOK_Y, pz);
  } else {
    introPlaying = false;
    document.body.classList.remove('intro-lock');
    document.getElementById('hint').textContent = 'Avanza · algo no está bien…';
    return false;
  }
  camera.position.copy(cam);
  camera.lookAt(look);
  return true;
}
setBoot(12, 'Cargando mapa…');
document.body.classList.add('intro-lock');

const statBox = document.getElementById('stat');
let lastStat = '';
function updateStat() {
  const zone = getCurrentZone(player.x, player.z) || 'exterior';
  let t = zone.toUpperCase();
  if (hasKey) t += ' · LLAVE';
  if (pageRead) t += ' · NOTAS';
  if (leverPulled) t += ' · PALANCA';
  if (t !== lastStat) { statBox.textContent = t; lastStat = t; }
}

const storyEl = document.getElementById('story');
document.getElementById('storyClose').addEventListener('pointerdown', () => { storyEl.style.display = 'none'; });
function showStoryPage() {
  if (pageRead) return;
  document.getElementById('storyTitle').textContent = STORY_PAGE.title;
  document.getElementById('storyText').textContent = STORY_PAGE.text;
  storyEl.style.display = 'flex';
  pageRead = true;
  if (mapData.pageMesh) mapData.pageMesh.visible = false;
}

let enemyRt = null;
let playerHitArmed = false;
createEnemyRuntime({
  scene, camera, player,
  getGroundY: (x, z) => getGroundHeight(x, z),
  walls: WALLS,
  onHint: (t) => { document.getElementById('hint').textContent = t; },
}).then(async (rt) => {
  enemyRt = rt;
  setBoot(55, 'Colocando criaturas…');
  await rt.spawn('soldado', 30, 52);
  bootState.enemy = true;
  setBoot(70, 'Personaje…');
  tryStartIntro();
}).catch((e) => {
  console.warn('enemy runtime', e);
  bootState.enemy = true;
  tryStartIntro();
});

const actor = new THREE.Group(); scene.add(actor);
const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const skin = mat(0x98694f);
function addM(p, geo, m, pos) {
  const o = new THREE.Mesh(geo, m); o.position.set(...pos); o.castShadow = true; p.add(o); return o;
}
addM(actor, new THREE.CapsuleGeometry(0.24, 0.45, 6, 10), skin, [0, 1.5, 0]);
addM(actor, new THREE.SphereGeometry(0.22, 12, 10), skin, [0, 1.85, 0]);
const locomotionActor = new THREE.Group(); scene.add(locomotionActor); locomotionActor.visible = false;
let locomotionMixer = null, walkAction = null, runAction = null, idleAction = null, activeAction = null;
let attackAction = null, attacking = false, armed = false;
let attackUntil = 0;
const clipMap = new Map(), locoState = createLocoState(); let loco = null, visYaw = 0;
const gltfLoader = new GLTFLoader();
const normName = n => (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function findClip(clips, names) {
  for (const n of names) { const c = clips.find(i => normName(i.name) === n); if (c) return c; }
}
function selectLocomotion(next) {
  if (!next) return;
  const host = { get active() { return activeAction; }, set active(v) { activeAction = v; } };
  switchAction(THREE, host, next, { fade: 0.12 });
}
function setupLocomotion(gltf, label) {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (size.y > 0) {
    const f = 1.82 / size.y;
    model.scale.setScalar(f);
    model.position.set(-center.x * f, -bounds.min.y * f, -center.z * f);
  }
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  locomotionActor.add(model);
  locomotionMixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations || [];
  for (const c of clips) clipMap.set(normName(c.name), c);
  loco = createLoco(THREE, locomotionMixer, clipMap, { get active() { return activeAction; }, set active(v) { activeAction = v; } });
  const idleC = findClip(clips, ['idle loop', 'idle standing', 'idle']);
  const walkC = findClip(clips, ['walk loop', 'walk formal loop', 'walk']);
  const runC = findClip(clips, ['sprint loop', 'jog fwd loop', 'run']);
  const atkC = findClip(clips, ['sword attack', 'sword regular a', 'melee hook', 'attack']);
  if (idleC) idleAction = locomotionMixer.clipAction(idleC);
  if (walkC) walkAction = locomotionMixer.clipAction(walkC);
  if (runC) runAction = locomotionMixer.clipAction(runC);
  if (atkC) { attackAction = locomotionMixer.clipAction(atkC); attackAction.setLoop(THREE.LoopOnce, 1); attackAction.clampWhenFinished = true; }
  locomotionMixer.addEventListener('finished', e => {
    if (e.action === attackAction) {
      attacking = false;
      attackUntil = 0;
      if (loco) loco.reset();
    }
  });
  const ini = idleAction || walkAction;
  if (ini) { ini.setEffectiveWeight(1); ini.play(); activeAction = ini; }
  actor.visible = false;
  locomotionActor.visible = true;
  document.getElementById('hint').textContent = label + ' · JOYSTICK v3';
}
loadHero(THREE, GLTFLoader)
  .then(i => {
    setBoot(85, 'Animaciones del caballero…');
    setupLocomotion({ scene: i.model, animations: i.clips }, i.source === 'hero' ? 'HUMANO' : 'MANIQUÍ');
    bootState.hero = true;
    setBoot(95, 'Preparando cinemática…');
    tryStartIntro();
  })
  .catch(() => {
    gltfLoader.load(
      './assets/characters/animations/locomotion-collection-jordan-3d-person-animated.glb',
      g => {
        setupLocomotion(g, 'RESPALDO');
        bootState.hero = true;
        tryStartIntro();
      },
      undefined,
      () => {
        bootState.hero = true;
        tryStartIntro();
      }
    );
  });

function attack() {
  if (introPlaying) return;
  if (!player.grounded) return;
  playerHitArmed = true;
  setTimeout(() => {
    if (enemyRt && playerHitArmed) {
      enemyRt.tryPlayerHit({ reach: 2.4, dmg: 16 });
      playerHitArmed = false;
    }
  }, 220);
  if (!attackAction && locomotionMixer) {
    for (const n of ['sword attack', 'sword regular a', 'melee hook', 'attack']) {
      const c = clipMap.get(n);
      if (c) {
        attackAction = locomotionMixer.clipAction(c);
        attackAction.setLoop(THREE.LoopOnce, 1);
        attackAction.clampWhenFinished = true;
        break;
      }
    }
  }
  if (!attackAction) return;
  const now = performance.now() / 1000;
  if (attacking && now < attackUntil - 0.2) return;
  attacking = true;
  attackUntil = now + 0.85;
  attackAction.reset();
  attackAction.setEffectiveWeight(1);
  attackAction.play();
  if (activeAction && activeAction !== attackAction) activeAction.crossFadeTo(attackAction, 0.08, false);
  activeAction = attackAction;
}
function toggleArm() { if (introPlaying) return; armed = !armed; document.getElementById('arm').classList.toggle('on', armed); }
document.getElementById('atk').addEventListener('pointerdown', e => { e.preventDefault(); attack(); });
document.getElementById('arm').addEventListener('pointerdown', e => { e.preventDefault(); toggleArm(); });

const joy = { x: 0, y: 0, active: false };
const joyBase = document.getElementById('joyBase');
const joyKnob = document.getElementById('joyKnob');
const JOY_R = 36;
function setJoy(nx, ny) {
  const m = Math.hypot(nx, ny) || 1;
  const c = Math.min(1, m);
  joy.x = nx * c;
  joy.y = ny * c;
  joyKnob.style.transform = `translate(${joy.x * JOY_R}px, ${-joy.y * JOY_R}px)`;
}
function resetJoy() {
  joy.x = 0; joy.y = 0; joy.active = false;
  joyKnob.style.transform = 'translate(0,0)';
}
function joyFromEvent(e) {
  const r = joyBase.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  setJoy((e.clientX - cx) / JOY_R, -(e.clientY - cy) / JOY_R);
}
const endJoy = () => resetJoy();
joyBase.addEventListener('pointerdown', e => {
  e.preventDefault();
  joy.active = true;
  joyBase.setPointerCapture(e.pointerId);
  joyFromEvent(e);
});
joyBase.addEventListener('pointermove', e => {
  if (!joy.active) return;
  joyFromEvent(e);
});
joyBase.addEventListener('pointerup', endJoy);
joyBase.addEventListener('pointercancel', endJoy);
joyBase.addEventListener('lostpointercapture', endJoy);

let runToggle = false;
function setRunToggle(on) {
  runToggle = on;
  document.getElementById('run').classList.toggle('on', on);
}
const runButton = document.getElementById('run');
runButton.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (introPlaying) return;
  setRunToggle(!runToggle);
});
const keys = {};
addEventListener('keydown', e => {
  if (introPlaying) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'm' && !e.repeat) document.getElementById('mapView')?.dispatchEvent(new PointerEvent('pointerdown'));
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
let jumpQueued = false;
document.getElementById('jump').addEventListener('pointerdown', e => { e.preventDefault(); if (!introPlaying) jumpQueued = true; });

const clock = new THREE.Clock();
const CAM_DIST = 4.2;
const CAM_HEIGHT = 2.4;
const CAM_LOOK_Y = 1.35;
const CAM_MIN_DIST = 1.15;
const CAM_RADIUS = 0.28;
let mapOverview = false;

function cameraBlockedDist(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return 0;
  const steps = 14;
  let best = len;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    const z = from.z + dz * t;
    for (const w of WALLS) {
      if (
        x + CAM_RADIUS >= w.minX && x - CAM_RADIUS <= w.maxX &&
        z + CAM_RADIUS >= w.minZ && z - CAM_RADIUS <= w.maxZ &&
        y >= 0.2 && y <= 14
      ) {
        best = Math.min(best, (i - 1) / steps * len);
        break;
      }
    }
  }
  return Math.max(CAM_MIN_DIST, best);
}
const overview = { x: MAP_CENTER.x, z: MAP_CENTER.z, h: 95, yaw: 0 };
const mapBtn = document.getElementById('mapView');
if (mapBtn) mapBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (introPlaying) return;
  mapOverview = !mapOverview;
  mapBtn.classList.toggle('on', mapOverview);
  if (mapOverview) {
    overview.x = MAP_CENTER.x;
    overview.z = MAP_CENTER.z;
    overview.h = 95;
    document.getElementById('hint').textContent = 'VISTA MAPA · joystick mueve · CORRER acerca · SALTAR aleja';
  } else {
    document.getElementById('hint').textContent = 'JOYSTICK v3 · correr toggle';
  }
});
camera.position.set(player.x + 2.2, 0.2, player.z + 2.2);
camera.lookAt(player.x, player.y + 0.5, player.z);
document.addEventListener('contextmenu', e => e.preventDefault());

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);

  let f = 0, side = 0, intentFwd = 0, intentSide = 0, tank = false;
  let lockFacing = null;
  if (!mapOverview && !introPlaying) {
    if (joy.active && (Math.abs(joy.x) > 0.12 || Math.abs(joy.y) > 0.12)) {
      if (Math.abs(joy.x) > 0.18) player.facing -= joy.x * 1.15 * dt;
      lockFacing = player.facing;
      const fwd = joy.y; intentFwd = fwd; tank = true;
      side = Math.sin(player.facing) * fwd;
      f = Math.cos(player.facing) * fwd;
    } else {
      f = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      side = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      intentFwd = f; intentSide = side;
    }
  }
  const running = !!(runToggle || keys.shift);
  const speed = running ? RUN_SPEED : WALK_SPEED;

  const canMove = !introPlaying && !attacking && !mapOverview;
  const backNow = canMove && player.grounded && backpedal({ fwd: intentFwd, strafe: intentSide, facing: player.facing, tank });
  const keepFacing = player.facing;
  stepPlayer(player, course, { f: mapOverview ? 0 : f, side: mapOverview ? 0 : side, speed: backNow ? Math.min(speed, WALK_SPEED * BACK_SPEED) : speed, running: running && !backNow, jump: mapOverview ? false : jumpQueued, canMove }, dt);
  if (lockFacing !== null) player.facing = lockFacing; else if (backNow) player.facing = keepFacing;
  if (!mapOverview) jumpQueued = false;
  resolveWallCollisions(player);
  if (enemyRt && enemyRt.resolveAgainstPlayer) enemyRt.resolveAgainstPlayer(player);
  resolveWallCollisions(player);
  resolveGround(player);

  if (!gateClosed && player.x > 30 && player.x < 40 && player.z > 64 && player.z < 72) {
    closePassageGate(mapData);
    gateClosed = true;
    document.getElementById('hint').textContent = 'La reja cae... algo anda mal';
  }
  if (!pageRead && distanceToPage(player.x, player.y, player.z) < 2.2) showStoryPage();
  if (!hasKey && distanceToKey(player.x, player.y, player.z) < 1.8) {
    hasKey = true;
    if (mapData.keyMesh) mapData.keyMesh.visible = false;
    document.getElementById('hint').textContent = 'Llave obtenida';
    tryUnlockTowerDoor(mapData, hasKey);
  }
  if (!foodTaken && distanceToFood(player.x, player.y, player.z) < 1.6) {
    foodTaken = true;
    if (mapData.foodMesh) mapData.foodMesh.visible = false;
    document.getElementById('hint').textContent = 'Comida en el establo...';
  }
  if (!leverPulled && distanceToLever(player.x, player.y, player.z) < 2.0) {
    leverPulled = true;
    if (mapData.leverArm) mapData.leverArm.rotation.x = 0.8;
    document.getElementById('hint').textContent = 'La gran reja responde... (cinemática jefe)';
  }

  actor.position.set(player.x, player.y, player.z);
  visYaw = smoothYaw(visYaw, player.facing, dt);
  actor.rotation.y = visYaw;
  locomotionActor.position.copy(actor.position);
  locomotionActor.rotation.y = actor.rotation.y;

  if (attacking && performance.now() / 1000 >= attackUntil) {
    attacking = false;
    attackUntil = 0;
    if (loco) loco.reset();
  }
  if (locomotionMixer) {
    const moving = !!((f || side) && canMove);
    const pk = stepLoco(locoState, { grounded: player.grounded, moving, running, back: backNow }, dt, n => clipMap.has(n));
    if (!attacking && loco) loco.apply(pk);
    locomotionMixer.update(dt);
  }

  if (introPlaying && bootState.started) {
    updateIntroCamera(dt);
  } else if (mapOverview) {
    const ox = joy.active ? -joy.x : ((keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0));
    const oz = joy.active ? joy.y : ((keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0));
    overview.x += ox * 40 * dt;
    overview.z += oz * 40 * dt;
    if (runToggle || keys.shift) overview.h = Math.max(40, overview.h - 25 * dt);
    if (jumpQueued) { overview.h = Math.min(140, overview.h + 25 * dt); jumpQueued = false; }
    camera.position.set(overview.x, overview.h, overview.z);
    camera.lookAt(overview.x, 0, overview.z);
  } else {
    const fx = Math.sin(visYaw), fz = Math.cos(visYaw);
    const look = new THREE.Vector3(player.x, player.y + CAM_LOOK_Y, player.z);
    const ideal = new THREE.Vector3(
      player.x - fx * CAM_DIST,
      player.y + CAM_HEIGHT,
      player.z - fz * CAM_DIST
    );
    const free = cameraBlockedDist(look, ideal);
    const scale = free / CAM_DIST;
    const targetCam = new THREE.Vector3(
      player.x - fx * CAM_DIST * scale,
      player.y + CAM_HEIGHT * (0.55 + 0.45 * scale),
      player.z - fz * CAM_DIST * scale
    );
    camera.position.lerp(targetCam, Math.min(1, dt * 5));
    camera.lookAt(look);
  }
  if (enemyRt) enemyRt.update(dt);
  updateStat();
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
});
animate();
