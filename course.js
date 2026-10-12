// course.js — camino lineal con barrancos y física de salto.
// freeMap: true (o gaps===0) desactiva HALF_WIDTH y el suelo del curso;
// el mapa usa resolveGround / plataformas propias.
// freeMap: adelante = +Z (croquis eje-x). Curso lineal histórico: adelante = -Z.

export const HALF_WIDTH = 2.2;
export const GRAVITY = 12;
export const JUMP_V = 5.1;
export const COYOTE = 0.12;
export const JUMP_BUFFER = 0.12;
export const FALL_LIMIT = -8;
export const WALK_SPEED = 1.8;
export const RUN_SPEED = 3.2;
export const AIR_BOOST_WALK = 1.15;
export const AIR_BOOST_RUN = 1.3;
export const MIN_AIR_STEER = 0.9;

export const GAPS = [1.2, 2.0, 2.4, 2.8, 3.1];

export function buildCourse(gaps = GAPS) {
  const segments = [{ a: 4, b: -6 }];
  let z = -6;
  for (const gap of gaps) {
    const a = z - gap;
    const b = a - 5;
    segments.push({ a, b });
    z = b;
  }
  const last = segments[segments.length - 1];
  last.b = last.a - 10;
  return { segments, gaps: gaps.length, freeMap: false };
}

function isFreeMap(course) {
  return !!(course && (course.freeMap || course.gaps === 0));
}

export function segmentIndex(course, x, z) {
  if (!isFreeMap(course) && Math.abs(x) > HALF_WIDTH) return -1;
  return course.segments.findIndex(s => z <= s.a && z >= s.b);
}

export function onPlatform(course, x, z) {
  if (isFreeMap(course)) return false;
  return segmentIndex(course, x, z) !== -1;
}

export function createPlayer(course) {
  const s0 = course.segments[0];
  const free = isFreeMap(course);
  const spawnZ = free ? (s0?.a ?? 0) - 2 : Math.min(0, s0.a - 1);
  return {
    x: 0, y: 0, z: spawnZ, vy: 0,
    facing: free ? 0 : Math.PI,
    grounded: true, jumping: false,
    coyote: COYOTE, airTime: 0, jumpBuffer: 0,
    avx: 0, avz: 0,
    checkpoint: { x: 0, z: spawnZ },
    best: 0, falls: 0,
  };
}

export function stepPlayer(p, course, input, dt) {
  const ev = { jumped: false, landed: false, fell: false, reachedGoal: false };
  const { f = 0, side = 0, speed = WALK_SPEED, running = false, jump = false, canMove = true } = input;
  const freeMap = isFreeMap(course);

  const len = Math.hypot(side, f);
  const hasInput = canMove && len > 0;
  const dx = hasInput ? side / len : 0;
  // freeMap (croquis): flecha arriba = +Z. Curso lineal: flecha arriba = -Z.
  const dz = hasInput ? (freeMap ? f / len : -f / len) : 0;
  const prevGrounded = p.grounded;

  if (jump) p.jumpBuffer = JUMP_BUFFER;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

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

  if (p.grounded) {
    p.x += dx * speed * dt;
    p.z += dz * speed * dt;
  } else {
    if (hasInput) {
      const air = Math.max(Math.hypot(p.avx, p.avz), MIN_AIR_STEER);
      p.avx = dx * air;
      p.avz = dz * air;
    }
    p.x += p.avx * dt;
    p.z += p.avz * dt;
  }
  if (hasInput) p.facing = Math.atan2(dx, dz);

  if (freeMap) {
    if (!p.grounded) {
      p.coyote = Math.max(0, p.coyote - dt);
      p.airTime += dt;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
    } else {
      p.coyote = COYOTE;
      p.airTime = 0;
      p.jumping = false;
      p.avx = 0;
      p.avz = 0;
    }
    if (p.y < FALL_LIMIT) {
      p.x = p.checkpoint.x;
      p.z = p.checkpoint.z;
      p.y = 0;
      p.vy = 0;
      p.avx = 0;
      p.avz = 0;
      p.grounded = true;
      p.jumping = false;
      p.airTime = 0;
      p.coyote = COYOTE;
      p.facing = 0;
      p.falls++;
      ev.fell = true;
    }
    return ev;
  }

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
      p.avx = dx * speed;
      p.avz = dz * speed;
    }
    p.grounded = false;
    p.coyote = Math.max(0, p.coyote - dt);
    p.airTime += dt;
  }

  if (!p.grounded) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
  }

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
