export const CHARACTER_DETAILS_VERSION = '1.1-front-axis';

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const cleanName = value => (value || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Detalle facial aislado. No modifica materiales, malla original, rig ni animaciones.
 * Solo crea un plano facial en el lado frontal local +Z; nunca duplica la cara en varias direcciones.
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

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');

  // Rostro completo, con fondo opaco para que no se duplique el dibujo al transparentar.
  c.fillStyle = '#b98260';
  c.beginPath(); c.ellipse(256, 274, 174, 215, 0, 0, Math.PI * 2); c.fill();

  // Pelo corto oscuro.
  c.fillStyle = '#211916';
  c.beginPath();
  c.moveTo(75, 222); c.quadraticCurveTo(55, 35, 256, 38);
  c.quadraticCurveTo(456, 35, 437, 222);
  c.lineTo(389, 170); c.quadraticCurveTo(320, 130, 256, 157);
  c.quadraticCurveTo(176, 130, 123, 179); c.closePath(); c.fill();
  c.fillRect(76, 183, 34, 137); c.fillRect(402, 183, 34, 137);

  // Cejas.
  c.strokeStyle = '#30211c'; c.lineWidth = 17; c.lineCap = 'round';
  c.beginPath(); c.moveTo(132, 220); c.quadraticCurveTo(177, 199, 216, 221); c.stroke();
  c.beginPath(); c.moveTo(296, 221); c.quadraticCurveTo(340, 199, 380, 220); c.stroke();

  // Ojos.
  for (const x of [176, 337]) {
    c.fillStyle = '#f4e6d3'; c.beginPath(); c.ellipse(x, 252, 34, 18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#49382b'; c.beginPath(); c.arc(x, 252, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#171514'; c.beginPath(); c.arc(x, 252, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff4df'; c.beginPath(); c.arc(x - 4, 247, 3.5, 0, Math.PI * 2); c.fill();
  }

  // Nariz, bigote, boca y barba corta.
  c.fillStyle = '#925d45'; c.beginPath();
  c.moveTo(256, 263); c.lineTo(232, 328);
  c.quadraticCurveTo(256, 344, 280, 328); c.closePath(); c.fill();
  c.fillStyle = '#392923'; c.beginPath();
  c.moveTo(200, 354); c.quadraticCurveTo(230, 367, 256, 354);
  c.quadraticCurveTo(282, 367, 312, 354); c.quadraticCurveTo(290, 390, 256, 382);
  c.quadraticCurveTo(222, 390, 200, 354); c.fill();
  c.fillStyle = '#6f4035'; c.beginPath();
  c.moveTo(222, 379); c.quadraticCurveTo(256, 393, 290, 379);
  c.quadraticCurveTo(256, 405, 222, 379); c.fill();
  c.fillStyle = '#352722'; c.beginPath();
  c.moveTo(91, 339); c.quadraticCurveTo(119, 428, 194, 455);
  c.quadraticCurveTo(256, 479, 318, 455); c.quadraticCurveTo(393, 428, 421, 339);
  c.quadraticCurveTo(362, 388, 308, 390); c.quadraticCurveTo(256, 412, 204, 390);
  c.quadraticCurveTo(150, 388, 91, 339); c.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const inv = 1 / Math.max(modelScale, 0.0001);
  const width = 0.19 * inv, height = 0.22 * inv;
  const geometry = new THREE.PlaneGeometry(width, height, 8, 8);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (width * 0.5);
    pos.setZ(i, 0.008 * inv * (1 - u * u));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    map: texture, side: THREE.DoubleSide, depthTest: true, depthWrite: false,
    toneMapped: false
  });
  const face = new THREE.Mesh(geometry, material);
  face.name = 'CharacterFaceDetails';
  face.position.set(0, 0.105 * inv, 0.115 * inv);
  face.rotation.y = 0;
  face.renderOrder = 5;
  face.frustumCulled = false;
  head.add(face);
  return true;
}
