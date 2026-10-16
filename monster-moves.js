// monster-moves.js — carga los clips realistas del monstruo (assets/anims/monster-*.json) y la mandíbula, y los engancha a mixamo-procedural.
// Los clips los genera tools/gen-monster-walk.py (caminata) y tools/gen-monster-moves.py (carrera y 3 golpes) sobre el esqueleto real.
import { RigEditor } from './rig-edit.js';

const BASE = './assets/anims/';
const WALK_SPEED_MS = 0.374;   // m/s (a la escala 2.69) que recorre monster-walk.json a rate 1: 2·S/(STANCE·T)·2.69 con S=0.05, STANCE=0.6, T=1.2
let cache = null;

export function loadMonsterClips(base = BASE) {
  if (!cache) {
    const get = (f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
    cache = Promise.all([get('monster-walk.json'), get('monster-run.json'), get('monster-attack.json'), get('monster-death.json').catch(() => ({ clips: {} }))]).then(([w, r, a, d]) => {
      const out = { ...a.clips, ...r.clips, ...d.clips, walk: { ...w.clips.walk, speed: WALK_SPEED_MS } };
      return out;
    }).catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** Equipa `anim` (createMixamoProcedural) con los clips y la mandíbula. Si algo falla, el monstruo sigue con las animaciones procedurales. */
export async function equipMonster(anim, model, base) {
  try { anim.useClips(await loadMonsterClips(base)); } catch (e) { console.warn('monster clips', e); return false; }
  try {
    let mesh = null; model.traverse((o) => { if (!mesh && o.isSkinnedMesh) mesh = o; });
    if (mesh) anim.attachJaw(new RigEditor(model, mesh, anim.bones).build());
  } catch (e) { console.warn('monster jaw', e); }
  return true;
}
