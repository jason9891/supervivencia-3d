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
export const AIR_BOOST_WALK = 1.15; // impulso horizontal extra al saltar caminando
export const AIR_BOOST_RUN = 1.3;   // impulso horizontal extra al saltar corriendo
export const MIN_AIR_STEER = 0.9;   // control mínimo en el aire si saltas desde parado

// Huecos crecientes. Saltando caminando se alcanzan ~1.7 m; saltando en carrera ~3.5 m.
export const GAPS = [1.2, 2.0, 2.4, 2.8, 3.1];

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
    avx: 0, avz: 0,           // velocidad horizontal en el aire (inercia)
    checkpoint: { x: 0, z: spawnZ },
    best: 0, falls: 0,
  };
}

// input: { f, side, speed, running, jump, canMove }
// devuelve eventos: { jumped, landed, fell, reachedGoal }
export function stepPlayer(p, course, input, dt) {
  const ev = { jumped: false, landed: false, fell: false, reachedGoal: false };
  const { f = 0, side = 0, speed = WALK_SPEED, running = false, jump = false, canMove = true } = input;

  const len = Math.hypot(side, f);
  const hasInput = canMove && len > 0;
  const dx = hasInput ? side / len : 0;
  const dz = hasInput ? -f / len : 0;
  const prevGrounded = p.grounded;

  if (jump) p.jumpBuffer = JUMP_BUFFER;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  // 1) Despegue (con margen antes y después del borde). Conserva el impulso de la carrera.
  let tookOff = false;
  if (p.jumpBuffer > 0 && (p.grounded || (p.coyote > 0 && !p.jumping))) {
    const boost = running ? AIR_BOOST_RUN : AIR_BOOST_WALK;
    p.avx = dx * speed * boost;
    p.avz = dz * speed * boost;
    p.vy = JUMP_V;
    p.y += 0.001;
    p.grounded = false;
    p.jumping = true;
    p.coyote = 0;
    p.airTime = 0;
    p.jumpBuffer = 0;
    tookOff = true;
    ev.jumped = true;
  }

  // 2) Movimiento horizontal.
  if (p.grounded) {
    p.x += dx * speed * dt;
    p.z += dz * speed * dt;
  } else {
    if (hasInput) {
      // En el aire se puede girar, pero la velocidad se mantiene (no se frena el salto).
      const air = Math.max(Math.hypot(p.avx, p.avz), MIN_AIR_STEER);
      p.avx = dx * air;
      p.avz = dz * air;
    }
    p.x += p.avx * dt;
    p.z += p.avz * dt;
  }
  if (hasInput) p.facing = Math.atan2(dx, dz);

  // 3) ¿Hay suelo bajo los pies?
  const supported = onPlatform(course, p.x, p.z);
  if (supported && p.vy <= 0 && p.y <= 0 && p.y > -0.35) {
    p.y = 0; p.vy = 0;
    p.grounded = true;
    p.coyote = COYOTE;
    p.airTime = 0;
    p.jumping = false;
    p.avx = 0; p.avz = 0;
    if (!prevGrounded) ev.landed = true;
    const idx = segmentIndex(course, p.x, p.z);
    if (idx > p.best) p.best = idx;
    const seg = course.segments[idx];
    p.checkpoint = { x: 0, z: seg.a - 1.5 };
    if (idx === course.segments.length - 1) ev.reachedGoal = true;
  } else {
    if (prevGrounded && !tookOff) {
      // Salió del borde sin saltar: conserva la velocidad que llevaba.
      p.avx = dx * speed;
      p.avz = dz * speed;
    }
    p.grounded = false;
    p.coyote = Math.max(0, p.coyote - dt);
    p.airTime += dt;
  }

  // 4) Gravedad.
  if (!p.grounded) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
  }

  // 5) Caída al barranco: reaparecer en el último punto seguro.
  if (p.y < FALL_LIMIT) {
    p.x = p.checkpoint.x; p.z = p.checkpoint.z;
    p.y = 0; p.vy = 0; p.avx = 0; p.avz = 0;
    p.grounded = true; p.jumping = false; p.airTime = 0; p.coyote = COYOTE;
    p.facing = Math.PI;
    p.falls++;
    ev.fell = true;
  }
  return ev;
}
