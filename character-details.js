import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export const CHARACTER_DETAILS_VERSION = '1.4-face-volume';

const cleanName = value => (value || '')
  .toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * PRUEBA 3: elimina la lámina facial 2D y construye rasgos volumétricos.
 * Los rasgos se agrupan bajo el hueso Head para seguir la animación.
 */
export function addHeadFaceTexture(model, modelScale = 1) {
  let head = null;
  model.traverse(node => {
    if (!head && node.isBone) {
      const name = cleanName(node.name);
      if (name.split(' ').includes('head') && !name.includes('end')) head = node;
    }
  });
  if (!head) {
    console.warn('character-details: no se encontró el hueso Head; se conserva el modelo original.');
    return false;
  }

  const inv = 1 / Math.max(modelScale, 0.0001);
  const group = new THREE.Group();
  group.name = 'CharacterFaceDetails3D';
  // Base de rostro con volumen; no se usa textura facial ni un plano rectangular.
  const faceSkin = new THREE.MeshStandardMaterial({ color: 0x98694f, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211916, roughness: 0.86 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf1e4d1, roughness: 0.65 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x49382b, roughness: 0.45 });
  const skinShade = new THREE.MeshStandardMaterial({ color: 0x925d45, roughness: 0.9 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x4b2924, roughness: 0.9 });

  function ellipsoid(name, material, position, scale, segments = 12) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(8, segments - 2)), material);
    mesh.name = name;
    mesh.position.set(position[0] * inv, position[1] * inv, position[2] * inv);
    mesh.scale.set(scale[0] * inv, scale[1] * inv, scale[2] * inv);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }

  // Frente local +Z. Primero se crea una base ovalada que cubre frente, mejillas y mandíbula.
  // Los rasgos quedan ligeramente por delante de la piel para evitar que se oculten dentro de la malla.
  ellipsoid('Face_Skin_Base', faceSkin, [0, 0.092, 0.052], [0.073, 0.105, 0.038], 20);
  ellipsoid('Face_Cheek_Left', faceSkin, [-0.047, 0.068, 0.068], [0.029, 0.040, 0.027], 14);
  ellipsoid('Face_Cheek_Right', faceSkin, [0.047, 0.068, 0.068], [0.029, 0.040, 0.027], 14);
  ellipsoid('Face_Brow_Left', dark, [-0.052, 0.145, 0.094], [0.043, 0.012, 0.010]);
  ellipsoid('Face_Brow_Right', dark, [0.052, 0.145, 0.094], [0.043, 0.012, 0.010]);
  for (const x of [-0.047, 0.047]) {
    ellipsoid('Face_Eye_White', eyeWhite, [x, 0.119, 0.096], [0.025, 0.017, 0.012]);
    ellipsoid('Face_Iris', iris, [x, 0.119, 0.108], [0.010, 0.012, 0.006]);
    ellipsoid('Face_Pupil', dark, [x, 0.119, 0.113], [0.005, 0.007, 0.003], 10);
  }
  ellipsoid('Face_Nose', skinShade, [0, 0.091, 0.113], [0.014, 0.029, 0.019]);
  ellipsoid('Face_Mustache_Left', dark, [-0.018, 0.066, 0.104], [0.023, 0.009, 0.012]);
  ellipsoid('Face_Mustache_Right', dark, [0.018, 0.066, 0.104], [0.023, 0.009, 0.012]);
  ellipsoid('Face_Mouth', mouthMat, [0, 0.048, 0.097], [0.018, 0.005, 0.006]);
  // Barba corta integrada sobre el volumen de la barbilla.
  ellipsoid('Face_Beard_Chin', dark, [0, 0.032, 0.083], [0.042, 0.018, 0.009]);
  ellipsoid('Face_Ear_Left', faceSkin, [-0.073, 0.091, 0.048], [0.015, 0.028, 0.018]);
  ellipsoid('Face_Ear_Right', faceSkin, [0.073, 0.091, 0.048], [0.015, 0.028, 0.018]);
  head.add(group);
  return true;
}
