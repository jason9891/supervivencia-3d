// swing-style.js — cómo se VE cada golpe: clip, velocidad, giro del cuerpo y avance.
// Sin three.js: se prueba en Node. Solo describe; la página aplica el resultado al personaje.
//
// Problema que resuelve: con un solo clip de espada, tres golpes seguidos se ven idénticos y el clip
// (1.5 s) dura más que el golpe del juego (0.55 s). Aquí cada golpe cambia de postura según su
// dirección y su lugar en la cadena, y el clip se acelera para que el impacto caiga en el instante
// en que el juego aplica el daño.

// Clips por orden de preferencia (nombres normalizados). El primero que exista se usa.
// 'sword attack' viene en UAL1 (incluido). Los demás vienen en UAL2 Standard (CC0, opcional).
export const CLIPS = {
  forward: ['sword dash', 'sword attack'],
  side:    [['sword regular a', 'sword attack'], ['sword regular a combo', 'sword attack'], ['melee hook', 'sword attack']],
  neutral: ['sword regular a combob', 'sword attack'],
  finisher: ['ninjump slash', 'melee hook', 'sword attack'],
};

// Segundo del clip donde cae el golpe, si no se puede medir en el propio clip.
export const STRIKE_AT = { 'sword attack': 0.4 };

export function clipCandidates(type, chainLen, isCombo) {
  if (isCombo) return CLIPS.finisher;
  const c = CLIPS[type];
  if (type === 'side') return c[Math.min(Math.max(chainLen, 1), c.length) - 1];
  return c;
}

// Elige el primer clip disponible. `has(name)` dice si existe.
export function pickClip(type, chainLen, isCombo, has) {
  return clipCandidates(type, chainLen, isCombo).find(has) || null;
}

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

// Estilo de un golpe. `a` = fi.attack de combat.js; `chainLen` = golpes encadenados hasta ahora.
export function swingStyle(a, chainLen = 1) {
  const dir = chainLen % 2 === 0 ? -1 : 1; // los tajos alternan de lado
  const combo = a.combo ? a.combo.name : null;
  const s = { type: a.type, dur: a.dur, hit: a.hit, lunge: a.data.lunge || 0, yaw: 0, roll: 0, pitch: 0, spin: 0, speed: 1, pop: 1 };
  if (a.type === 'side')    { s.yaw = 0.7 * dir; s.roll = 0.14 * dir; s.pitch = 0.05; s.speed = 1.1; }
  if (a.type === 'forward') { s.pitch = 0.22; s.yaw = 0.08 * dir; s.speed = 1.0; }
  if (a.type === 'neutral') { s.pitch = -0.2; s.roll = 0; s.speed = 0.95; }   // se echa hacia atrás y cae con el golpe alto
  if (combo) { s.lunge *= 1.3; s.pop = 1.08; s.speed *= 0.92; if (combo === 'Torbellino') { s.spin = Math.PI * 2; s.yaw = 0; } }
  return s;
}

// Velocidad de reproducción para que el impacto del clip caiga en `a.hit` (segundos de juego).
export function playbackRate(strikeTime, a, style) {
  return Math.max(0.5, Math.min(3, (strikeTime / Math.max(0.05, a.hit)) * style.speed));
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
