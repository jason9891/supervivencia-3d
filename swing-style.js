// swing-style.js — cómo se VE cada golpe: clip, velocidad, giro del cuerpo y avance.
// Sin three.js: se prueba en Node. Solo describe; la página aplica el resultado al personaje.
//
// Problema que resuelve: con un solo clip de espada, tres golpes seguidos se ven idénticos y el clip
// (1.5 s) dura más que el golpe del juego (0.55 s). Aquí cada golpe cambia de postura según su
// dirección y su lugar en la cadena, y el clip se acelera para que el impacto caiga en el instante
// en que el juego aplica el daño.

// Los golpes se animan por su PASO en la cadena, no por la dirección: 1 → 2 → 3, pausa, y vuelve a 1.
export const STEPS = 3;
export const CHAIN_GAP = 0.6;   // s sin atacar tras un golpe para que la cadena se reinicie en el paso 1
export const STEP3_PAUSE = 0.5; // s de recuperación obligada tras el tercer golpe

// Clip de cada paso (nombres normalizados), en orden de preferencia. 'sword attack' es de UAL1; el resto de UAL2.
export const STEP_CLIPS = {
  1: ['sword regular a', 'sword attack'],
  2: ['sword regular b', 'sword attack'],
  3: ['sword regular c', 'sword attack'],
};

// Paso siguiente: continúa si el golpe anterior terminó hace poco; si no, empieza en 1. Tras el 3 vuelve a 1.
export function advanceStep(state, now) {
  const fresh = now - state.endedAt > CHAIN_GAP;
  state.step = fresh || state.step >= STEPS ? 1 : state.step + 1;
  return state.step;
}

// Segundo del clip donde cae el golpe (pico de velocidad del brazo derecho, medido en cada clip).
export const STRIKE_AT = {
  'sword attack': 0.4, 'sword regular a': 0.25, 'sword regular b': 0.25, 'sword regular c': 0.65,
  'sword dash': 0.32, 'sword regular combo': 0.25, 'sword heavy combo': 2.55, 'melee hook': 0.25,
};
export const LEAD = 0.35; // segundos de preparación del clip que se conservan antes del impacto

export function pickClip(step, has) {
  return (STEP_CLIPS[step] || STEP_CLIPS[1]).find(has) || null;
}

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

// Estilo de un golpe. `a` = fi.attack de combat.js; `step` = 1..3. La dirección (▲, ◀▶, ●) solo lo matiza.
//   paso 1: tajo de derecha a izquierda · paso 2: contra-tajo de vuelta · paso 3: estocada pesada con avance largo
export function swingStyle(a, step = 1) {
  const combo = a.combo ? a.combo.name : null;
  const base = a.data.lunge || 0;
  const s = { type: a.type, step, dur: a.dur, hit: a.hit, lunge: base, yaw: 0, roll: 0, pitch: 0, spin: 0, speed: 1, pop: 1 };
  if (step === 1) { s.yaw = 0.8;  s.roll = 0.16;  s.pitch = 0.05; s.lunge = base * 0.8; s.speed = 1.1; }
  if (step === 2) { s.yaw = -0.8; s.roll = -0.16; s.pitch = 0.05; s.lunge = base * 0.8; s.speed = 1.15; }
  if (step === 3) { s.yaw = 0; s.pitch = 0.38; s.lunge = Math.max(base, 0.6) * 1.7; s.speed = 0.9; s.pop = 1.06; }
  if (a.type === 'forward') s.lunge *= 1.25;
  if (a.type === 'side') s.yaw *= 1.15;
  if (a.type === 'neutral') s.pitch -= 0.1;
  if (combo) { s.lunge *= 1.2; s.pop = Math.max(s.pop, 1.08); if (combo === 'Torbellino') { s.spin = Math.PI * 2; s.yaw = 0; } }
  return s;
}

// Velocidad de reproducción para que el impacto del clip caiga en `a.hit` (segundos de juego).
export function playbackRate(strikeTime, a, style) {
  return Math.max(0.5, Math.min(3, (strikeTime / Math.max(0.05, a.hit)) * style.speed));
}

// Ventana del clip: en clips largos (combos de 3-4 s) se empieza poco antes del impacto en vez de acelerar todo.
//   start = segundo del clip donde se empieza; rate = velocidad para que el impacto caiga en a.hit.
export function clipWindow(strikeTime, a, style) {
  const start = Math.max(0, strikeTime - LEAD);
  const rate = Math.max(0.5, Math.min(3, ((strikeTime - start) / Math.max(0.05, a.hit)) * style.speed));
  return { start, rate };
}

// Postura del cuerpo en el instante `t` (s desde que empezó el golpe).
//   Antes del impacto se carga hacia el lado contrario; en el impacto se llega al máximo; después se recupera.
export function swingPose(style, t) {
  const p = clamp01(t / style.dur), ph = clamp01(style.hit / style.dur);
  let k;
  if (p < ph) k = -0.35 * Math.sin(Math.PI * clamp01(p / ph)) + smooth(p / ph); // carga y empuje
  else k = 1 - smooth((p - ph) / (1 - ph));                                      // recuperación
  const advance = smooth(p / ph) * style.lunge;  // metros avanzados hasta el impacto (acumulado)
  return { yaw: style.yaw * k + style.spin * smooth(p), roll: style.roll * k, pitch: style.pitch * k, advance, scale: 1 + (style.pop - 1) * k };
}
