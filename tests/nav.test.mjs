import { findPath, lineClear, nextWaypoint } from '../nav.js';
let fails = 0; const check = (n, ok, x = '') => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (x ? ' ' + x : '')); if (!ok) fails++; };
const R = 0.4;
const mk = (boxes) => (x, z) => boxes.some((w) => x > w.minX - R && x < w.maxX + R && z > w.minZ - R && z < w.maxZ + R);
const walk = (path, blocked, sx, sz) => { let ok = true, x = sx, z = sz, len = 0; for (const p of path) { if (!lineClear(x, z, p.x, p.z, blocked)) ok = false; len += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; } return { ok, len, end: { x, z } }; };

// mesa en medio
let b = mk([{ minX: 25, maxX: 27, minZ: 57, maxZ: 58 }]);
let p = findPath(26, 52, 26, 62, b);
let w = walk(p, b, 26, 52);
check('rodea una mesa: el camino existe, no cruza el obstáculo y llega a la meta', !!p && w.ok && Math.hypot(w.end.x - 26, w.end.z - 62) < 0.5, `(${p && p.length} puntos, ${w.len.toFixed(1)} m)`);
check('sin obstáculos el camino es la línea recta', (() => { const q = findPath(0, 0, 10, 0, mk([])); return q && q.length === 1 && Math.abs(q[0].x - 10) < 1e-6; })());
// pared larga con una puerta
b = mk([{ minX: -20, maxX: 4, minZ: 5, maxZ: 5.5 }, { minX: 6, maxX: 30, minZ: 5, maxZ: 5.5 }]);
p = findPath(0, 0, 0, 10, b); w = walk(p, b, 0, 0);
check('pasa por la puerta de una pared larga', !!p && w.ok && p.some((q) => q.x > 3 && q.x < 7), `(${w.len.toFixed(1)} m)`);
// sin salida: encerrado
b = mk([{ minX: -3, maxX: 3, minZ: 5, maxZ: 5.5 }, { minX: -3, maxX: -2.5, minZ: -3, maxZ: 5.5 }, { minX: 2.5, maxX: 3, minZ: -3, maxZ: 5.5 }, { minX: -3, maxX: 3, minZ: -3, maxZ: -2.5 }]);
p = findPath(0, 0, 0, 12, b, { pad: 3 });
check('si no hay camino devuelve lo más cerca posible (no se cuelga) o null', p === null || walk(p, b, 0, 0).ok);
// meta dentro de un obstáculo
b = mk([{ minX: 4, maxX: 6, minZ: 4, maxZ: 6 }]);
p = findPath(0, 0, 5, 5, b); check('meta dentro de un obstáculo: va a la casilla libre más cercana', !!p && walk(p, b, 0, 0).ok);
// nextWaypoint
const path = [{ x: 0.1, z: 0 }, { x: 3, z: 0 }]; check('nextWaypoint salta los puntos ya alcanzados', nextWaypoint(path, 0, 0).x === 3 && path.length === 1);
// rendimiento
const big = mk(Array.from({ length: 150 }, (_, i) => ({ minX: (i * 7) % 60, maxX: ((i * 7) % 60) + 1, minZ: (i * 13) % 40, maxZ: ((i * 13) % 40) + 1 })));
const t0 = performance.now(); for (let i = 0; i < 20; i++) findPath(0, 0, 40, 30, big); const ms = (performance.now() - t0) / 20;
check('un plan con 150 obstáculos tarda poco', ms < 25, `(${ms.toFixed(1)} ms)`);
console.log(fails ? fails + ' FALLARON' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
