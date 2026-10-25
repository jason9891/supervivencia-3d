// locomotion.js — qué animación de movimiento toca en cada momento (lógica pura, sin three.js; la parte que usa el mixer recibe THREE).
// Los clips son los de UAL (nombres normalizados: 'walk loop', 'jog fwd loop', 'jump start'...). UAL Standard no trae clips de
// retroceso ni laterales: el retroceso reproduce 'walk loop' al revés (rate negativo) y el desplazamiento lateral gira al personaje.

export const BACK_SPEED = 0.7;          // al retroceder se va más lento que al caminar (y nunca corriendo)
export const AIR = {
  START_AT: 0.06,                       // Jump_Start parte agachado en el segundo 0; se entra ya en el impulso
  START_RATE: 1.6,
  LOOP_AFTER: 0.26,                     // s en el aire antes de pasar a Jump_Loop (la pose extendida)
  LAND_RATE: 2.2,                       // Jump_Land dura 1.27 s: acelerado queda en ~0.58 s
  LAND_SPAN: 0.5,                       // s tras aterrizar en los que se ve la recepción (solo si no hay movimiento)
};
// Cadencia de los pasos: Walk_Loop (1.33 s por ciclo) recorre 2.4 m a WALK_SPEED 1.8 → sin deslizar. Al revés a BACK_SPEED hay que ir más lento.
export const BACK_RATE = -BACK_SPEED;

// ¿Intención de retroceder? `fwd`/`strafe` relativos a la cámara (teclas o joystick). Con joystick "tanque" (`tank`) el personaje ya mira
// hacia donde apunta, así que atrás es siempre retroceso; con teclas solo si el personaje mira (±60°) en sentido contrario al movimiento.
export function backpedal({ fwd = 0, strafe = 0, facing = 0, tank = false }) {
  if (fwd >= -0.25 || Math.abs(strafe) > 0.2) return false;
  if (tank) return true;
  return Math.cos(facing) > 0.5;        // freeMap: la cámara mira hacia +Z y 'atrás' es -Z
}

// Giro visual suave hacia `target` por el camino más corto (la lógica del juego no cambia, solo cómo se ve).
export function smoothYaw(cur, target, dt, rate = 16) {
  let d = ((target - cur + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const k = 1 - Math.exp(-rate * dt);
  return cur + d * k;
}

export function createLocoState() { return { grounded: true, airTime: 0, sinceLand: 1e9, landedFrom: 0 }; }

// Avanza el estado un frame y devuelve la animación pedida: { key, name, rate, start?, once? }.
// names: { idle, walk, run, jumpStart, jumpLoop, jumpLand } (nombres normalizados; alguno puede faltar → se cae al siguiente).
export function stepLoco(s, { grounded, moving, running, back, strafe = 0 }, dt, has = () => true, moves = null) {   // moves = { idle, walk, run, jumpStart, jumpLoop, jumpLand } (hero-moves.js); sin él, la búsqueda por nombres de siempre
  const was = s.grounded;
  s.grounded = grounded;
  if (was && !grounded) s.jumpKind = (moving && running) ? 'jumpRun' : 'jumpStand';   // tipo de salto: se decide al despegar
  if (!grounded) { s.airTime = was ? 0 : s.airTime + dt; s.sinceLand = 1e9; }
  else { if (!was) { s.sinceLand = 0; s.landedFrom = s.airTime; } else s.sinceLand += dt; s.airTime = 0; }
  const pick = (name, extra = {}) => ({ key: name + (extra.rate < 0 ? '-rev' : ''), name, rate: 1, ...extra });
  const first = (...names) => names.find(n => has(n));
  const mv = moves || {};
  const walk = mv.walk ?? first('walk loop', 'walk formal loop', 'walk') ?? first('idle loop', 'idle');
  const run = mv.run ?? first('jog fwd loop', 'sprint loop', 'run') ?? walk;
  const idle = mv.idle ?? first('idle loop', 'idle standing', 'idle') ?? walk;
  const jStart = mv.jumpStart ?? 'jump start', jLoop = mv.jumpLoop ?? 'jump loop', jLand = mv.jumpLand ?? 'jump land';

  const rt = mv.rates || {}, R = (role, d = 1) => rt[role] ?? d;
  const wholeJump = mv[s.jumpKind || 'jumpStand'];               // salto de un solo clip (Mixamo); si no, los 3 tiempos de UAL: jump start → jump loop → jump land
  if (!grounded) {
    if (wholeJump) return pick(wholeJump, { rate: R(s.jumpKind || 'jumpStand'), once: true });
    if (s.airTime < AIR.LOOP_AFTER && has(jStart)) return pick(jStart, { rate: AIR.START_RATE, start: AIR.START_AT, once: true });
    // Preferir jump loop; si no hay, idle (nunca dejar el mixer sin clip → evita pose en T / brazos abiertos).
    return pick(first(jLoop, jStart) ?? idle);
  }
  if (moving) {
    if (strafe && !back) {                                          // encarando (lock): paso lateral con su clip (derecha = +1)
      const role = (running ? 'strafeRun' : 'strafe') + (strafe > 0 ? 'R' : 'L');
      if (mv[role]) return pick(mv[role], { rate: R(role) });
    }
    if (back) {                                                     // retroceso: clip propio (caminando o corriendo) o el de caminar al revés
      if (running && mv.backRun) return pick(mv.backRun, { rate: R('backRun') });
      if (mv.back) return pick(mv.back, { rate: R('back') });
      return has('walk back') ? pick('walk back') : pick(walk, { rate: BACK_RATE });
    }
    const role = running ? 'run' : 'walk';
    return pick(running ? run : walk, { rate: R(role) });
  }
  if (!wholeJump && s.sinceLand < AIR.LAND_SPAN && s.landedFrom > 0.2 && has(jLand)) return pick(jLand, { rate: AIR.LAND_RATE, once: true });
  return pick(idle);
}

/**
 * Cambia de animación sin dejar el esqueleto a peso 0 (evita el flash de pose en T / brazos abiertos).
 * Usa crossFadeTo cuando hay una acción previa, de modo que la suma de pesos se mantiene ~1.
 * `host.active` es la acción que está sonando.
 */
export function switchAction(THREE, host, next, {
  fade = 0.12,
  once = false,
  rate = 1,
  start = null,
  reverse = false,
} = {}) {
  if (!next) return false;
  // Misma acción en curso: en bucles solo actualiza velocidad; en one-shot (ataques) SIEMPRE reinicia
  // (si no, el 2.º golpe no resetea el clip y el evento "finished" no vuelve a dispararse → personaje atorado).
  if (host.active === next && !once) {
    next.setEffectiveTimeScale(rate);
    next.enabled = true;
    if (typeof next.getEffectiveWeight === 'function' && next.getEffectiveWeight() < 0.99) next.setEffectiveWeight(1);
    return true;
  }
  if (host.active === next && once) {
    next.enabled = true;
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.setEffectiveTimeScale(rate);
    next.reset();
    if (reverse) next.time = next.getClip().duration;
    else if (start != null) next.time = start;
    next.setEffectiveWeight(1);
    next.play();
    host.active = next;
    return true;
  }

  next.enabled = true;
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = !!once;
  next.setEffectiveTimeScale(rate);

  const prev = host.active && host.active !== next ? host.active : null;

  if (prev) {
    // Arranca el nuevo sin pasar por peso 0: crossFadeTo reparte los pesos entre prev y next.
    if (reverse) next.time = next.getClip().duration;
    else if (start != null) next.time = start;
    else next.time = 0;
    next.paused = false;
    next.play();
    // Si prev ya estaba en peso bajo, sube next de inmediato para no dejar hueco.
    const pw = typeof prev.getEffectiveWeight === 'function' ? prev.getEffectiveWeight() : 1;
    if (pw < 0.05) {
      next.setEffectiveWeight(1);
      prev.setEffectiveWeight(0);
      prev.stop();
    } else {
      try {
        prev.crossFadeTo(next, fade, false);
      } catch (e) {
        next.setEffectiveWeight(1);
        prev.fadeOut(fade);
      }
    }
  } else {
    next.reset();
    if (reverse) next.time = next.getClip().duration;
    else if (start != null) next.time = start;
    next.setEffectiveWeight(1);
    next.play();
  }

  host.active = next;
  return true;
}

// Aplica la elección al mixer. `host.active` es la acción que está sonando (la comparte el resto del código del laboratorio o del juego).
export function createLoco(THREE, mixer, clips, host, fade = 0.12) {
  const cache = new Map();
  const actionOf = name => {
    const clip = clips.get ? clips.get(name) : clips[name];
    if (!clip) return null;
    let a = cache.get(name); if (!a) { a = mixer.clipAction(clip); cache.set(name, a); }
    return a;
  };
  let key = '';
  return {
    actionOf,
    reset() { key = ''; },
    apply(p) {
      const a = actionOf(p.name); if (!a) return false;
      if (host.active === a && key === p.key) {
        a.setEffectiveTimeScale(p.rate);
        // Por si otra animación (ataque, one-shot) bajó el peso y luego volvimos aquí.
        if (typeof a.getEffectiveWeight === 'function' && a.getEffectiveWeight() < 0.5) a.setEffectiveWeight(1);
        return true;
      }
      const ok = switchAction(THREE, host, a, {
        fade: p.once ? 0.08 : fade,
        once: !!p.once,
        rate: p.rate,
        start: p.start != null ? p.start : null,
        reverse: p.rate < 0,
      });
      if (ok) key = p.key;
      return ok;
    },
  };
}
