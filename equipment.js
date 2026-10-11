// equipment.js — dibuja armas, escudos y armaduras sobre los huesos del personaje (usa three.js).
// Las piezas son originales (formas simples). Los ids vienen de combat.js.
// Ejes de los huesos del esqueleto UAL: +Y va a lo largo del hueso hacia el hijo; en las manos, el arma sale por +Z.

const TIER = {
  cuero: { color: 0x6b4a2f, metal: 0.0, rough: 0.9 },
  malla: { color: 0x9aa0a6, metal: 0.6, rough: 0.45 },
  placas: { color: 0x6e747c, metal: 0.75, rough: 0.35 },
};

export function createEquipment(THREE) {
  const cache = {};
  const mat = (key, color, metal = 0, rough = 0.7) =>
    cache[key] ?? (cache[key] = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
  const steel = () => mat('steel', 0xb4bcc4, 0.8, 0.35);
  const wood = () => mat('wood', 0x5a3d25, 0, 0.85);
  const leather = () => mat('leather', 0x3b2a1d, 0, 0.9);
  const gold = () => mat('gold', 0xc9a14a, 0.7, 0.4);
  const dark = () => mat('dark', 0x23262b, 0.3, 0.6);
  const tier = (t) => mat('tier-' + t, TIER[t].color, TIER[t].metal, TIER[t].rough);

  const place = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
  const cyl = (r, h, m, x, y, z, rx = 0, rz = 0) => {
    const o = place(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m), x, y, z);
    o.rotation.set(rx, 0, rz);
    return o;
  };
  const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = place(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m), x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };
  const group = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };

  const WEAPON = {
    espada: () => group(
      box(0.035, 0.035, 0.2, leather()), box(0.26, 0.03, 0.04, steel(), 0, 0, 0.11),
      box(0.07, 0.014, 0.8, steel(), 0, 0, 0.51), ball(0.035, gold(), 0, 0, -0.11)),
    hacha: () => group(
      cyl(0.022, 0.95, wood(), 0, 0, 0.32, Math.PI / 2),
      box(0.2, 0.035, 0.18, steel(), 0.1, 0, 0.74), box(0.02, 0.02, 0.1, steel(), 0, 0, 0.88)),
    maza: () => group(
      cyl(0.026, 0.9, wood(), 0, 0, 0.3, Math.PI / 2),
      box(0.14, 0.14, 0.2, steel(), 0, 0, 0.78), box(0.26, 0.04, 0.05, steel(), 0, 0, 0.78),
      box(0.04, 0.26, 0.05, steel(), 0, 0, 0.78)),
  };

  const SHIELD = {
    rodela: () => group(cyl(0.2, 0.04, wood(), -0.1, 0.14, 0, 0, Math.PI / 2), ball(0.05, gold(), -0.125, 0.14, 0)),
    escudo: () => group(cyl(0.28, 0.045, steel(), -0.1, 0.14, 0, 0, Math.PI / 2), ball(0.06, gold(), -0.13, 0.14, 0)),
    torre: () => group(box(0.05, 0.64, 0.42, steel(), -0.1, 0.16, 0), box(0.06, 0.5, 0.05, gold(), -0.13, 0.16, 0)),
  };

  const HELM = {
    cuero: () => {
      const d = ball(0.125, tier('cuero'), 0, 0.12, 0.005, 1, 1, 1.08);
      d.geometry = new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
      return group(d);
    },
    malla: () => {
      const d = ball(0.13, tier('malla'), 0, 0.12, 0.005, 1, 1, 1.08);
      d.geometry = new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
      return group(d, box(0.02, 0.1, 0.02, tier('malla'), 0, 0.1, 0.125));
    },
    placas: () => {
      const d = ball(0.14, tier('placas'), 0, 0.12, 0.005, 1, 1.05, 1.1);
      d.geometry = new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.7);
      return group(d, box(0.2, 0.05, 0.03, dark(), 0, 0.1, 0.14), box(0.02, 0.06, 0.22, tier('placas'), 0, 0.27, 0));
    },
  };

  const CHEST = {
    cuero: () => group(box(0.4, 0.32, 0.24, tier('cuero'), 0, 0.1, 0.01)),
    malla: () => group(box(0.43, 0.36, 0.26, tier('malla'), 0, 0.1, 0.01), box(0.44, 0.04, 0.27, leather(), 0, -0.04, 0.01)),
    placas: () => group(
      box(0.46, 0.4, 0.28, tier('placas'), 0, 0.1, 0.01),
      ball(0.09, tier('placas'), 0.27, 0.22, 0, 1, 0.8, 1), ball(0.09, tier('placas'), -0.27, 0.22, 0, 1, 0.8, 1)),
  };

  const THIGH = {
    malla: () => group(cyl(0.078, 0.3, tier('malla'), 0, 0.2, 0)),
    placas: () => group(cyl(0.085, 0.3, tier('placas'), 0, 0.2, 0), ball(0.075, tier('placas'), 0, 0.4, 0.03)),
  };
  const CALF = {
    cuero: () => group(cyl(0.058, 0.34, tier('cuero'), 0, 0.22, 0)),
    malla: () => group(cyl(0.062, 0.34, tier('malla'), 0, 0.22, 0)),
    placas: () => group(cyl(0.068, 0.34, tier('placas'), 0, 0.22, 0)),
  };

  function apply(model, eq, store) {
    for (const n of store.nodes || []) n.parent.remove(n.obj);
    store.nodes = [];
    const put = (boneName, obj) => {
      const b = model.getObjectByName(boneName);
      if (!b || !obj) return;
      obj.traverse?.(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      b.add(obj);
      store.nodes.push({ parent: b, obj });
    };
    put('hand_r', WEAPON[eq.weapon]?.());
    put('lowerarm_l', SHIELD[eq.escudo]?.());
    put('Head', HELM[eq.casco]?.());
    put('spine_02', CHEST[eq.pechera]?.());
    for (const side of ['l', 'r']) {
      put('thigh_' + side, THIGH[eq.grebas]?.());
      put('calf_' + side, CALF[eq.grebas]?.());
    }
  }

  return { apply };
}

export function tintModel(model, color) {
  model.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = list.map((m, i) => {
      const c = m.clone ? m.clone() : m;
      const isMain = m.name ? m.name === 'M_Main' : i === 0;
      if (isMain && c.color && c.color.set) c.color.set(color);
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
  });
}
