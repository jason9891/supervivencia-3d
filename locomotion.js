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
export function stepLoco(s, { grounded, moving, running, back }, dt, has = () => true) {
  const was = s.grounded;
  s.grounded = grounded;
  if (!grounded) { s.airTime = was ? 0 : s.airTime + dt; s.sinceLand = 1e9; }
  else { if (!was) { s.sinceLand = 0; s.landedFrom = s.airTime; } else s.sinceLand += dt; s.airTime = 0; }
  const pick = (name, extra = {}) => ({ key: name + (extra.rate < 0 ? '-rev' : ''), name, rate: 1, ...extra });
  const first = (...names) => names.find(n => has(n));
  const walk = first('walk loop', 'walk formal loop', 'walk') ?? first('idle loop', 'idle');
  const run = first('jog fwd loop', 'sprint loop', 'run') ?? walk;
  const idle = first('idle loop', 'idle standing', 'idle') ?? walk;

  if (!grounded) {
    if (s.airTime < AIR.LOOP_AFTER && has('jump start')) return pick('jump start', { rate: AIR.START_RATE, start: AIR.START_AT, once: true });
    return pick(first('jump loop') ?? idle);
  }
  if (moving) {
    if (back) return pick(walk, { rate: BACK_RATE });
    return pick(running ? run : walk);
  }
  if (s.sinceLand < AIR.LAND_SPAN && s.landedFrom > 0.2 && has('jump land')) return pick('jump land', { rate: AIR.LAND_RATE, once: true });
  return pick(idle);
}

// Aplica la elección al mixer. `host.active` es la acción que está sonando (la comparte el resto del código del laboratorio o del juego).
export function createLoco(THREE, mixer, clips, host, fade = 0.15) {
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
      if (host.active === a && key === p.key) return true;   // ya suena así
      if (host.active && host.active !== a) host.active.fadeOut(p.once ? 0.06 : fade);
      a.reset();
      a.setLoop(p.once ? THREE.LoopOnce : THREE.LoopRepeat, p.once ? 1 : Infinity);
      a.clampWhenFinished = !!p.once;
      a.setEffectiveTimeScale(p.rate);
      if (p.rate < 0) a.time = a.getClip().duration;       // al revés se parte del final del ciclo
      else if (p.start) a.time = p.start;
      a.fadeIn(p.once ? 0.05 : fade).play();
      host.active = a; key = p.key;
      return true;
    },
  };
}
