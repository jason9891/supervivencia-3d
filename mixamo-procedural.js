// mixamo-procedural.js
// Animación 100% por código para rigs Mixamo (mixamorig:*).
// No usa clips GLB: idle / walk / run / attack se calculan cada frame.
//
// Uso:
//   import { createMixamoProcedural } from './mixamo-procedural.js';
//   const anim = createMixamoProcedural(THREE, model, { height: 1.9 });
//   anim.setMode('walk'); // idle | walk | run
//   anim.attack();        // combo 2 golpes
//   anim.update(dt);

const BONE_ALIASES = {
  hips: ['mixamorig:Hips', 'mixamorig_Hips', 'Hips'],
  spine: ['mixamorig:Spine', 'mixamorig_Spine', 'Spine'],
  spine1: ['mixamorig:Spine1', 'mixamorig_Spine1', 'Spine1'],
  spine2: ['mixamorig:Spine2', 'mixamorig_Spine2', 'Spine2'],
  neck: ['mixamorig:Neck', 'mixamorig_Neck', 'Neck'],
  head: ['mixamorig:Head', 'mixamorig_Head', 'Head'],
  leftUpLeg: ['mixamorig:LeftUpLeg', 'mixamorig_LeftUpLeg', 'LeftUpLeg'],
  leftLeg: ['mixamorig:LeftLeg', 'mixamorig_LeftLeg', 'LeftLeg'],
  leftFoot: ['mixamorig:LeftFoot', 'mixamorig_LeftFoot', 'LeftFoot'],
  rightUpLeg: ['mixamorig:RightUpLeg', 'mixamorig_RightUpLeg', 'RightUpLeg'],
  rightLeg: ['mixamorig:RightLeg', 'mixamorig_RightLeg', 'RightLeg'],
  rightFoot: ['mixamorig:RightFoot', 'mixamorig_RightFoot', 'RightFoot'],
  leftShoulder: ['mixamorig:LeftShoulder', 'mixamorig_LeftShoulder', 'LeftShoulder'],
  leftArm: ['mixamorig:LeftArm', 'mixamorig_LeftArm', 'LeftArm'],
  leftForeArm: ['mixamorig:LeftForeArm', 'mixamorig_LeftForeArm', 'LeftForeArm'],
  leftHand: ['mixamorig:LeftHand', 'mixamorig_LeftHand', 'LeftHand'],
  rightShoulder: ['mixamorig:RightShoulder', 'mixamorig_RightShoulder', 'RightShoulder'],
  rightArm: ['mixamorig:RightArm', 'mixamorig_RightArm', 'RightArm'],
  rightForeArm: ['mixamorig:RightForeArm', 'mixamorig_RightForeArm', 'RightForeArm'],
  rightHand: ['mixamorig:RightHand', 'mixamorig_RightHand', 'RightHand'],
};

function norm(n) {
  return (n || '').toLowerCase().replace(/^mixamorig[:._\-\s]*/, '').replace(/[^a-z0-9]/g, '');
}

function indexAllNamed(root) {
  const byName = new Map();
  const byNorm = new Map();
  let skeletonBoneCount = 0;
  const samples = [];

  root.traverse((o) => {
    if (o.name) {
      byName.set(o.name, o);
      const k = norm(o.name);
      if (k && !byNorm.has(k)) byNorm.set(k, o);
      if (samples.length < 12 && (o.isBone || o.type === 'Bone' || /mixamo|hip|spine|arm|leg/i.test(o.name))) {
        samples.push(o.name);
      }
    }
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones) {
      skeletonBoneCount += o.skeleton.bones.length;
      for (const b of o.skeleton.bones) {
        if (!b || !b.name) continue;
        byName.set(b.name, b);
        const k = norm(b.name);
        if (k) byNorm.set(k, b);
        if (samples.length < 12) samples.push(b.name);
      }
    }
  });

  return { byName, byNorm, skeletonBoneCount, samples };
}

function collectBones(root) {
  const { byName, byNorm, skeletonBoneCount, samples } = indexAllNamed(root);
  const out = {};
  for (const [key, names] of Object.entries(BONE_ALIASES)) {
    let found = null;
    for (const n of names) {
      if (byName.has(n)) { found = byName.get(n); break; }
    }
    if (!found) {
      const k = norm(names[0]);
      if (byNorm.has(k)) found = byNorm.get(k);
    }
    out[key] = found;
  }
  return { bones: out, skeletonBoneCount, samples, namedCount: byName.size };
}

function captureRest(bones) {
  const rest = new Map();
  for (const b of Object.values(bones)) {
    if (!b) continue;
    rest.set(b, { pos: b.position.clone(), quat: b.quaternion.clone() });
  }
  return rest;
}

function restoreRest(rest) {
  for (const [b, r] of rest) {
    b.position.copy(r.pos);
    b.quaternion.copy(r.quat);
  }
}

/**
 * Animación procedural por código.
 * Ejes calibrados para T-pose Mixamo típica:
 *  - piernas: rotación en Z (adelante/atrás)
 *  - brazos: rotación en X / Z
 */
export function createMixamoProcedural(THREE, root, opts = {}) {
  const height = opts.height || 1.9;
  const { bones, skeletonBoneCount, samples, namedCount } = collectBones(root);
  const rest = captureRest(bones);
  const boneCount = Object.values(bones).filter(Boolean).length;
  const foundKeys = Object.entries(bones).filter(([, b]) => b).map(([k]) => k);

  const skinned = [];
  root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });

  let mode = 'idle';
  let time = 0;
  let attackPhase = 0;
  let attackT = 0;

  const qDelta = new THREE.Quaternion();
  const eTmp = new THREE.Euler();

  function applyLocalRot(bone, ax, ay, az) {
    if (!bone || !rest.has(bone)) return;
    const r = rest.get(bone);
    eTmp.set(ax, ay, az, 'XYZ');
    qDelta.setFromEuler(eTmp);
    bone.quaternion.copy(r.quat).multiply(qDelta);
  }

  function setMode(next) {
    if (next === 'attack') {
      attackPhase = 1;
      attackT = 0;
      return;
    }
    mode = next || 'idle';
    attackPhase = 0;
  }

  function flushSkeleton() {
    root.updateMatrixWorld(true);
    for (const mesh of skinned) {
      if (mesh.skeleton) mesh.skeleton.update();
    }
  }

  function update(dt) {
    if (boneCount < 4) return;
    time += dt;
    restoreRest(rest);

    if (attackPhase > 0) {
      attackT += dt;
      const dur = 0.42;
      const t = Math.min(1, attackT / dur);
      const wave = Math.sin(t * Math.PI);

      if (attackPhase === 1) {
        // Brazo derecho hacia adelante
        applyLocalRot(bones.rightArm, -0.35 * wave, 0.2 * wave, -1.5 * wave);
        applyLocalRot(bones.rightForeArm, -1.0 * wave, 0, 0);
        applyLocalRot(bones.spine1, 0, 0.25 * wave, 0);
        applyLocalRot(bones.hips, 0, 0.08 * wave, 0);
      } else {
        // Brazo izquierdo también hacia adelante (mismo signo en Z que el derecho)
        applyLocalRot(bones.leftArm, -0.35 * wave, -0.2 * wave, -1.5 * wave);
        applyLocalRot(bones.leftForeArm, -1.0 * wave, 0, 0);
        applyLocalRot(bones.spine1, 0, -0.25 * wave, 0);
        applyLocalRot(bones.hips, 0, -0.08 * wave, 0);
      }

      if (t >= 1) {
        attackT = 0;
        if (attackPhase === 1) attackPhase = 2;
        else attackPhase = 0;
      }
      flushSkeleton();
      return;
    }

    if (mode === 'idle') {
      const b = Math.sin(time * 1.7) * 0.04;
      applyLocalRot(bones.spine, 0.02 + b * 0.3, 0, 0);
      applyLocalRot(bones.spine1, b, 0, 0);
      applyLocalRot(bones.head, -b * 0.4, Math.sin(time * 0.5) * 0.06, 0);
      applyLocalRot(bones.leftArm, 0.05, 0, 0.08 + b);
      applyLocalRot(bones.rightArm, 0.05, 0, -0.08 - b);
      applyLocalRot(bones.leftForeArm, 0.2, 0, 0);
      applyLocalRot(bones.rightForeArm, 0.2, 0, 0);
      flushSkeleton();
      return;
    }

    const run = mode === 'run';
    const freq = run ? 8.5 : 5.0;
    const legAmp = run ? 0.75 : 0.5;
    const phase = time * freq;
    const L = Math.sin(phase) * legAmp;
    const R = Math.sin(phase + Math.PI) * legAmp;
    const kneeL = Math.max(0, -Math.sin(phase)) * (run ? 1.15 : 0.8);
    const kneeR = Math.max(0, -Math.sin(phase + Math.PI)) * (run ? 1.15 : 0.8);

    if (bones.hips && rest.has(bones.hips)) {
      const rp = rest.get(bones.hips).pos;
      bones.hips.position.y =
        rp.y + Math.abs(Math.sin(phase * 2)) * (run ? 0.045 : 0.028) * height;
    }
    applyLocalRot(bones.hips, 0, Math.sin(phase) * 0.06, 0);

    applyLocalRot(bones.leftUpLeg, 0, 0, L);
    applyLocalRot(bones.rightUpLeg, 0, 0, -R);
    applyLocalRot(bones.leftLeg, 0, 0, kneeL);
    applyLocalRot(bones.rightLeg, 0, 0, -kneeR);
    applyLocalRot(bones.leftFoot, 0, 0, -L * 0.35 - kneeL * 0.15);
    applyLocalRot(bones.rightFoot, 0, 0, R * 0.35 + kneeR * 0.15);

    const armAmp = run ? 0.7 : 0.45;
    applyLocalRot(bones.leftArm, -R * armAmp, 0, 0.1);
    applyLocalRot(bones.rightArm, -L * armAmp, 0, -0.1);
    applyLocalRot(bones.leftForeArm, 0.25 + Math.max(0, -R) * 0.45, 0, 0);
    applyLocalRot(bones.rightForeArm, 0.25 + Math.max(0, -L) * 0.45, 0, 0);

    applyLocalRot(bones.spine, Math.sin(phase * 2) * 0.03, Math.sin(phase) * 0.05, 0);
    applyLocalRot(bones.spine1, run ? 0.12 : 0.04, 0, 0);
    applyLocalRot(bones.head, -0.04, Math.sin(phase) * 0.03, 0);

    flushSkeleton();
  }

  return {
    bones,
    boneCount,
    foundKeys,
    skinnedCount: skinned.length,
    skeletonBoneCount,
    namedCount,
    samples,
    get mode() {
      if (attackPhase === 1) return 'attack-R';
      if (attackPhase === 2) return 'attack-L';
      return mode;
    },
    setMode,
    attack() { setMode('attack'); },
    update,
    isReady() { return boneCount >= 4 && skinned.length > 0; },
  };
}

export const MIXAMO_MODES = ['idle', 'walk', 'run', 'attack'];
