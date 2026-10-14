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
export const WALK_SPEED = 2.2;
export const RUN_SPEED = 6.0; // base rápida; la armadura la bajará luego

export function createPlayer(course) {
  const free = !!(course.freeMap || course.gaps === 0);
  return {
    x: 0,
    y: 0,
    z: free ? 0 : 2,
    vy: 0,
    facing: 0,
    grounded: true,
    coyote: 0,
    jumpBuf: 0,
    checkpoint: { x: 0, z: free ? 0 : 2 },
    best: 0,
    freeMap: free,
  };
}

function segAt(course, z) {
  for (const s of course.segments) if (z >= s.b && z <= s.a) return s;
  return null;
}

export function onPath(course, x, z) {
  if (course.freeMap || course.gaps === 0) return true;
  if (!segAt(course, z)) return false;
  return Math.abs(x) <= HALF_WIDTH;
}

export function nearestGroundY(course, x, z) {
  if (course.freeMap || course.gaps === 0) return 0;
  const s = segAt(course, z);
  if (!s) return null;
  if (Math.abs(x) > HALF_WIDTH) return null;
  return 0;
}

export function stepPlayer(p, course, input, dt) {
  const { f = 0, side = 0, speed = WALK_SPEED, running = false, jump = false, canMove = true } = input;
  if (jump) p.jumpBuf = JUMP_BUFFER;
  if (p.jumpBuf > 0) p.jumpBuf -= dt;

  const hasInput = canMove && (Math.abs(f) > 0.01 || Math.abs(side) > 0.01);
  let mx = 0, mz = 0;
  if (hasInput) {
    if (p.freeMap) {
      // Adelante del croquis = +Z
      const len = Math.hypot(f, side) || 1;
      const ff = f / len, ss = side / len;
      // facing 0 mira +Z; side positivo = derecha local
      mx = Math.sin(p.facing) * ff + Math.cos(p.facing) * ss;
      mz = Math.cos(p.facing) * ff - Math.sin(p.facing) * ss;
      if (Math.abs(f) > 0.05 || Math.abs(side) > 0.05) {
        // no reescribir facing aquí si el caller lo bloquea (tank controls)
      }
    } else {
      mx = side;
      mz = -f; // curso histórico: adelante = -Z
    }
    const sp = speed * (running ? 1 : 1);
    p.x += mx * sp * dt;
    p.z += mz * sp * dt;
  }

  if (!p.freeMap && !course.freeMap) {
    if (Math.abs(p.x) > HALF_WIDTH) p.x = Math.sign(p.x) * HALF_WIDTH;
  }

  const prevGrounded = p.grounded;
  let tookOff = false;
  if (p.grounded) {
    p.coyote = COYOTE;
  } else {
    p.coyote -= dt;
    p.vy -= GRAVITY * dt;
  }

  if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) {
    p.vy = JUMP_V;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    tookOff = true;
  }

  if (!p.grounded) {
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  } else {
    if (prevGrounded && !tookOff) {
      p.y = 0;
      p.vy = 0;
    }
  }

  if (p.y < FALL_LIMIT) {
    p.x = p.checkpoint.x;
    p.z = p.checkpoint.z;
    p.y = 0;
    p.vy = 0;
    p.grounded = true;
  }

  return p;
}
