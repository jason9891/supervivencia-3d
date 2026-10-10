// course.js — camino lineal con barrancos y física de salto.
// No depende de three.js: se puede probar con Node sin navegador.
// Convención: el camino avanza hacia -Z; A/D mueven en X.

export const HALF_WIDTH = 2.2;   // medio ancho del camino (m)
export const GRAVITY = 12;       // m/s²
export const JUMP_V = 5.1;       // velocidad inicial del salto (m/s)
export const COYOTE = 0.12;      // margen para saltar justo después de salir del borde (s)
export const JUMP_BUFFER = 0.12; // margen para registrar el salto un poco antes de aterrizar (s)
export const FALL_LIMIT = -8;    // por debajo de esta altura se reaparece
export const WALK_SPEED = 1.8;
export const RUN_SPEED = 3.2;

// Huecos crecientes. Con salto en carrera se alcanzan ~2.7 m; caminando ~1.5 m.
export const GAPS = [1.0, 1.4, 1.8, 2.0, 2.2];

export function buildCourse(gaps = GAPS) {
  const segments = [{ a: 4, b: -6 }]; // a = borde de entrada (z mayor), b = borde de salida (z menor)
  let z = -6;
  for (const gap of gaps) {
    const a = z - gap;
    const b = a - 5;
    segments.push({ a, b });
    z = b;
  }
  // Plataforma final, más larga, con la meta.
  const last = segments[segments.length - 1];
  last.b = last.a - 10;
  return { segments, gaps: gaps.length };
}

export function segmentIndex(course, x, z) {
  if (Math.abs(x) > HALF_WIDTH) return -1;
  return course.segments.findIndex(s => z <= s.a && z >= s.b);
}

export function onPlatform(course, x, z) {
  return segmentIndex(course, x, z) !== -1;
}

export function createPlayer(course) {
  const s0 = course.segments[0];
  const spawnZ = Math.min(0, s0.a - 1);
  return {
    x: 0, y: 0, z: spawnZ, vy: 0,
    facing: Math.PI,          // mirando hacia -Z
    grounded: true, jumping: false,
    coyote: COYOTE, airTime: 0, jumpBuffer: 0,
    checkpoint: { x: 0, z: spawnZ },
    best: 0, falls: 0,
  };
}

// input: { f, side, speed, jump, canMove }
// devuelve eventos: { jumped, landed, fell, reachedGoal }
export function stepPlayer(p, course, input, dt) {
  const ev = { jumped: false, landed: false, fell: false, reachedGoal: false };
  const { f = 0, side = 0, speed = WALK_SPEED, jump = false, canMove = true } = input;

  // Movimiento horizontal (también en el aire).
  if (canMove && (f || side)) {
    const len = Math.hypot(side, f);
    const dx = side / len, dz = -f / len;
    p.x += dx * speed * dt;
    p.z += dz * speed * dt;
    p.facing = Math.atan2(dx, dz);
  }

  if (jump) p.jumpBuffer = JUMP_BUFFER;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  // ¿Hay suelo bajo los pies?
  const supported = onPlatform(course, p.x, p.z);
  const wasGrounded = p.grounded;
  if (supported && p.vy <= 0 && p.y <= 0 && p.y > -0.35) {
    p.y = 0; p.vy = 0;
    p.grounded = true;
    p.coyote = COYOTE;
    p.airTime = 0;
    p.jumping = false;
    if (!wasGrounded) ev.landed = true;
    const idx = segmentIndex(course, p.x, p.z);
    if (idx > p.best) p.best = idx;
    const seg = course.segments[idx];
    p.checkpoint = { x: 0, z: seg.a - 1.5 };
    if (idx === course.segments.length - 1) ev.reachedGoal = true;
  } else {
    p.grounded = false;
    p.coyote = Math.max(0, p.coyote - dt);
    p.airTime += dt;
  }

  // Salto (con margen antes y después del borde).
  if (p.jumpBuffer > 0 && (p.grounded || (p.coyote > 0 && !p.jumping))) {
    p.vy = JUMP_V;
    p.y += 0.001;
    p.grounded = false;
    p.jumping = true;
    p.coyote = 0;
    p.airTime = 0;
    p.jumpBuffer = 0;
    ev.jumped = true;
  }

  // Gravedad.
  if (!p.grounded) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
  }

  // Caída al barranco: reaparecer en el último punto seguro.
  if (p.y < FALL_LIMIT) {
    p.x = p.checkpoint.x; p.z = p.checkpoint.z;
    p.y = 0; p.vy = 0;
    p.grounded = true; p.jumping = false; p.airTime = 0; p.coyote = COYOTE;
    p.facing = Math.PI;
    p.falls++;
    ev.fell = true;
  }
  return ev;
}
