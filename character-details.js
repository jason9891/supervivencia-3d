import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export const CHARACTER_DETAILS_VERSION = '1.3-3d-features';

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
  // Rasgos con volumen; no se usa textura facial ni un plano rectangular.
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

  // Posición elevada con respecto al hueso: en las pruebas anteriores el rostro quedó demasiado bajo.
  // Frente local +Z; cada rasgo es un objeto 3D separado.
  ellipsoid('Face_Brow_Left', dark, [-0.052, 0.145, 0.078], [0.043, 0.012, 0.012]);
  ellipsoid('Face_Brow_Right', dark, [0.052, 0.145, 0.078], [0.043, 0.012, 0.012]);
  for (const x of [-0.047, 0.047]) {
    ellipsoid('Face_Eye_White', eyeWhite, [x, 0.119, 0.082], [0.025, 0.017, 0.012]);
    ellipsoid('Face_Iris', iris, [x, 0.119, 0.093], [0.010, 0.012, 0.006]);
    ellipsoid('Face_Pupil', dark, [x, 0.119, 0.098], [0.005, 0.007, 0.003], 10);
  }
  ellipsoid('Face_Nose', skinShade, [0, 0.091, 0.094], [0.014, 0.029, 0.018]);
  ellipsoid('Face_Mustache_Left', dark, [-0.018, 0.066, 0.087], [0.023, 0.009, 0.012]);
  ellipsoid('Face_Mustache_Right', dark, [0.018, 0.066, 0.087], [0.023, 0.009, 0.012]);
  ellipsoid('Face_Mouth', mouthMat, [0, 0.048, 0.081], [0.018, 0.005, 0.006]);
  // Barba corta en pequeños volúmenes, sin cubrir todo el rostro.
  ellipsoid('Face_Beard_Chin', dark, [0, 0.032, 0.064], [0.042, 0.018, 0.009]);
  head.add(group);
  return true;
}
