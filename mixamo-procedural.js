// mixamo-procedural.js — idle/walk/run/attack para rigs Mixamo
// Uso: const anim = createMixamoProcedural(THREE, model); anim.setMode('walk'); anim.update(dt);

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
        if (!b) continue;
        if (b.name) {
          byName.set(b.name, b);
          const k = norm(b.name);
          if (k) byNorm.set(k, b);
          if (samples.length < 12) samples.push(b.name);
        }
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
  let attackT = 0;
  let attackActive = false;

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
    if (next === 'attack') { attackActive = true; attackT = 0; return; }
    mode = next || 'idle';
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

    if (attackActive) {
      attackT += dt;
      const t = Math.min(1, attackT / 0.55);
      const swing = Math.sin(t * Math.PI) * 1.6;
      applyLocalRot(bones.rightArm, -0.4, 0, -swing);
      applyLocalRot(bones.rightForeArm, -swing * 0.7, 0, 0);
      applyLocalRot(bones.spine1, 0, swing * 0.2, 0);
      if (t >= 1) attackActive = false;
      flushSkeleton();
      return;
    }

    if (mode === 'idle') {
      const b = Math.sin(time * 1.8) * 0.06;
      const s = Math.sin(time * 1.1) * 0.04;
      applyLocalRot(bones.spine, s * 0.5, 0, 0);
      applyLocalRot(bones.spine1, b, 0, 0);
      applyLocalRot(bones.head, -b * 0.5, Math.sin(time * 0.6) * 0.08, 0);
      applyLocalRot(bones.leftArm, 0.12 + b, 0, 0.1);
      applyLocalRot(bones.rightArm, 0.12 - b, 0, -0.1);
      applyLocalRot(bones.leftForeArm, 0.25, 0, 0);
      applyLocalRot(bones.rightForeArm, 0.25, 0, 0);
    } else if (mode === 'walk' || mode === 'run') {
      const run = mode === 'run';
      const freq = run ? 9.0 : 5.5;
      const amp = run ? 1.0 : 0.7;
      const phase = time * freq;
      const L = Math.sin(phase) * amp;
      const R = Math.sin(phase + Math.PI) * amp;
      const kneeL = Math.max(0, -Math.sin(phase)) * (run ? 1.3 : 0.9);
      const kneeR = Math.max(0, -Math.sin(phase + Math.PI)) * (run ? 1.3 : 0.9);

      if (bones.hips && rest.has(bones.hips)) {
        const rp = rest.get(bones.hips).pos;
        bones.hips.position.y = rp.y + Math.abs(Math.sin(phase * 2)) * (run ? 0.05 : 0.03) * height;
      }

      applyLocalRot(bones.leftUpLeg, L, 0, 0);
      applyLocalRot(bones.rightUpLeg, R, 0, 0);
      applyLocalRot(bones.leftLeg, kneeL, 0, 0);
      applyLocalRot(bones.rightLeg, kneeR, 0, 0);
      applyLocalRot(bones.leftFoot, -L * 0.4 - kneeL * 0.25, 0, 0);
      applyLocalRot(bones.rightFoot, -R * 0.4 - kneeR * 0.25, 0, 0);

      const armAmp = run ? 0.85 : 0.55;
      applyLocalRot(bones.leftArm, -R * armAmp, 0, 0.12);
      applyLocalRot(bones.rightArm, -L * armAmp, 0, -0.12);
      applyLocalRot(bones.leftForeArm, 0.25 + Math.max(0, -R) * 0.5, 0, 0);
      applyLocalRot(bones.rightForeArm, 0.25 + Math.max(0, -L) * 0.5, 0, 0);

      applyLocalRot(bones.spine, Math.sin(phase * 2) * 0.05, Math.sin(phase) * 0.06, 0);
      applyLocalRot(bones.spine1, run ? 0.15 : 0.06, 0, 0);
      applyLocalRot(bones.head, -0.06, Math.sin(phase) * 0.04, 0);
    }

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
    get mode() { return attackActive ? 'attack' : mode; },
    setMode,
    attack() { setMode('attack'); },
    update,
    isReady() { return boneCount >= 4 && skinned.length > 0; },
  };
}

export const MIXAMO_MODES = ['idle', 'walk', 'run', 'attack'];
