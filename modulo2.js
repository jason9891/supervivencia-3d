// modulo2.js — Oficina del consejero (2 ambientes + piso 2 → torres)
// BASE editable: ajusta MOD2 bounds / huecos y se refleja en map1 y en modulo2-lab.
// +X este · +Z norte · Y altura

import * as THREE from 'three';

export const LEVEL1_Y = 6;
export const LEVEL2_Y = 11.5;
export const WALL_H = 5.0;

/** Límites del módulo en el rectángulo del mapa (croquis este). */
export const MOD2 = {
  minX: 68.2,
  maxX: 89.2,
  minZ: 2.0,
  maxZ: 52.5,
  // Puerta plaza → módulo (en muro oeste x≈67.5)
  doorPlaza: { z0: 18, z1: 24 },
  // Tabique entre ambiente A (sur) y B (norte)
  partitionZ: 30,
  // Hueco tabique A↔B
  doorAB: { x0: 74, x1: 80 },
  // Gradas en ambiente A (sur), suben hacia +Z
  stairs: { x0: 82, x1: 88, z0: 8, z1: 18 },
};

export const MOD2_SPAWNS = {
  entrance: { x: 70, y: LEVEL1_Y, z: 21 },
  office: { x: 76, y: LEVEL1_Y, z: 12 },
  hall: { x: 76, y: LEVEL1_Y, z: 40 },
  floor2: { x: 78, y: LEVEL2_Y, z: 40 },
};

/**
 * Construye el módulo 2 dentro de scene.
 */
export function buildModule2(scene, helpers = {}) {
  const mat = (c, r = 0.86, m = 0) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const dark = mat(0x4a5048, 0.88);
  const wood = mat(0x6b4a32, 0.85);
  const stone = mat(0x6a7068, 0.9);
  const orangeW = mat(0xc47a28, 0.75);
  const paper = mat(0xf0e6d0, 0.6);
  const gold = mat(0xc9a227, 0.4, 0.6);

  const addWall = helpers.addWall || (() => {});
  const addPlatform = helpers.addPlatform || (() => {});

  function box(w, h, d, material, x, y, z, solid = false) {
    if (helpers.box) return helpers.box(w, h, d, material, x, y, z, solid);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return mesh;
  }

  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.35, 0.25 + y * 0.04);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  function wallBox(minX, maxX, minZ, maxZ, material = orangeW) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w < 0.15 || d < 0.15) return null;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    return box(w, WALL_H, d, material, cx, LEVEL1_Y + WALL_H / 2, cz, true);
  }

  const { minX, maxX, minZ, maxZ, doorPlaza, partitionZ, doorAB, stairs } = MOD2;
  const midX = (minX + maxX) / 2;

  // ── Suelos nivel 1 (dos ambientes) ──
  pad(maxX - minX, partitionZ - minZ - 0.5, LEVEL1_Y, midX, (minZ + partitionZ) / 2, stone);
  pad(maxX - minX, maxZ - partitionZ - 0.5, LEVEL1_Y, midX, (partitionZ + maxZ) / 2, dark);

  // ── Muro oeste plaza|módulo CON hueco puerta ──
  wallBox(minX - 0.4, minX + 0.4, minZ, doorPlaza.z0);
  wallBox(minX - 0.4, minX + 0.4, doorPlaza.z1, maxZ);
  box(0.35, 3.2, 0.35, wood, minX, LEVEL1_Y + 1.5, doorPlaza.z0);
  box(0.35, 3.2, 0.35, wood, minX, LEVEL1_Y + 1.5, doorPlaza.z1);

  wallBox(maxX - 0.5, maxX + 0.3, minZ, maxZ);
  wallBox(minX, maxX, minZ - 0.3, minZ + 0.4);
  wallBox(minX, maxX, maxZ - 0.4, maxZ + 0.3);

  wallBox(minX, doorAB.x0, partitionZ - 0.4, partitionZ + 0.4);
  wallBox(doorAB.x1, maxX, partitionZ - 0.4, partitionZ + 0.4);

  // ── Gradas: visual + plataformas. NO solid (bloqueaban el paso). ──
  const steps = 12;
  const rise = LEVEL2_Y - LEVEL1_Y;
  const stepH = rise / steps;
  const stepD = (stairs.z1 - stairs.z0) / steps;
  const stepW = stairs.x1 - stairs.x0;
  const sx = (stairs.x0 + stairs.x1) / 2;
  for (let i = 0; i < steps; i++) {
    const yTop = LEVEL1_Y + (i + 1) * stepH;
    const z = stairs.z0 + (i + 0.5) * stepD;
    box(stepW, Math.max(0.12, stepH * 0.9), stepD * 0.92, stone, sx, yTop - stepH * 0.45, z, false);
    addPlatform(stairs.x0 - 0.15, stairs.x1 + 0.15, z - stepD * 0.55, z + stepD * 0.55, yTop);
  }
  addPlatform(stairs.x0 - 0.2, stairs.x1 + 0.2, stairs.z1 - 0.3, stairs.z1 + 1.2, LEVEL2_Y);

  // ── Piso 2 ──
  pad(maxX - minX - 1, maxZ - minZ - 2, LEVEL2_Y, midX, (minZ + maxZ) / 2 + 2, wood);
  box(0.25, 1.1, stairs.z1 - stairs.z0 + 2, wood, stairs.x0 - 0.15, LEVEL2_Y + 0.55, (stairs.z0 + stairs.z1) / 2 + 1);

  // La pasarela rota, la puerta y las torres las arma torres.js (diseño de prueba_modulo.html).

  const pagePos = new THREE.Vector3(76, LEVEL1_Y + 1.05, 10);
  const keyPos = new THREE.Vector3(78, LEVEL1_Y + 1.02, 14);
  const pageMesh = box(0.45, 0.03, 0.55, paper, pagePos.x, pagePos.y, pagePos.z);
  const keyMesh = box(0.28, 0.08, 0.12, gold, keyPos.x, keyPos.y, keyPos.z);
  box(2.2, 0.12, 1.0, wood, 76, LEVEL1_Y + 0.7, 11, true);
  box(0.15, 0.7, 0.15, wood, 75.2, LEVEL1_Y + 0.35, 10.6, true);
  box(0.15, 0.7, 0.15, wood, 76.8, LEVEL1_Y + 0.35, 11.4, true);

  return {
    pageMesh,
    keyMesh,
    pagePos,
    keyPos,
    mod2: { ...MOD2 },
    level2Y: LEVEL2_Y,
  };
}
