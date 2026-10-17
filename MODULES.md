# Módulos del proyecto (unión sin sobrescribir)

## Estado de main

| Archivo | En main | Origen |
|---------|---------|--------|
| `map1.js` | sí (croquis) | mapa — **no sobrescribir** |
| `course.js` | sí (`freeMap`) | mapa — **no sobrescribir** |
| `index.html` | sí (mapa + UAL) | restaurado — **no sobrescribir** desde combate |
| `equipment.js` | sí | `respaldo-combate-patio` |
| `banco.js` | sí | `combate-en-mapa` |
| `combat.js` | sí | `respaldo-combate-patio` |
| `session.js` | en rama | `respaldo-combate-patio` |
| `combat-addon.js` | sí | `combate-en-mapa` + inventario |
| `inventario.js` | sí | `inventario-funcional` |
| `hero.js` | sí | humano CC0 + animaciones UAL + medidas del cuerpo |
| `equipment-lab.html` | sí | taller de equipo (usa `hero.js` y `equipment.js`) |
| `swing-style.js` | sí | postura y clip de cada golpe |
| `combat-lab.html` | sí | página de pruebas de combate (botón en `index.html`) |

## Completar la unión (solo archivos nuevos, sin tocar mapa)

En tu máquina:

```bash
git checkout main
git pull
# Copia módulos de combate SIN cambiar index ni map1:
git checkout respaldo-combate-patio -- combat.js session.js
git checkout combate-en-mapa -- combat-addon.js
git add combat.js session.js combat-addon.js
git commit -m "Add remaining combat modules (no index/map overwrite)"
git push
```

## Enganchar combate cuando quieras (opcional)

`combat-addon.js` no modifica el mapa ni el personaje: solo lee posición y añade UI.

```js
import { createCombatAddon } from './combat-addon.js';
const combat = createCombatAddon({ THREE, scene, camera, player, onSwing: () => {} });
// en el bucle: combat.pressAttack(f, side); combat.update(dt);
```

## Ramas

| Rama | Uso |
|------|-----|
| `main` | unión estable |
| `mapa-el-regreso` | solo mapa |
| `respaldo-combate-patio` | combate + patio |
| `combate-en-mapa` | combate + addon |
| `animaciones-ual` | personaje / animaciones |

**Regla:** no editar `map1.js` desde ramas de combate; no editar `combat*.js` / `equipment.js` desde ramas de mapa.

## Añadido: movimiento y armas

| Archivo | Qué hace |
|---|---|
| `locomotion.js` | Elige la animación de movimiento (retroceso, correr, salto en 3 fases, aterrizaje) y el giro suave. Lo usan `index.html` y `combat-lab.html`. Pruebas: `tests/locomotion.test.mjs`. |
| `assets/weapons/` | 16 GLB CC0 de Quaternius (12 armas + escudos) con `CREDITS.md`; los usa `equipment.js`. |

## Añadido: desmembramiento del monstruo (solo `enemy-lab.html`)

| Archivo | Qué hace |
|---|---|
| `dismember-core.js` | Reglas puras: reparte la malla por pesos de hueso, lazos del corte, tapa de carne y cuerpo rígido con suelo para la pieza suelta. |
| `dismember.js` | `createDismember({model, mesh}).sever('Head' \| 'LeftArm' \| 'RightArm')`: corta la malla real, deja la pieza con física y sangre; `restore()` lo deshace. |
| `tools/gen-monster-death.py` | Además de las 5 muertes: `deathArmR/L` (se corta el brazo que cae al piso), `deathDecap` (de bruces) y `deathDecapBack` (de espaldas). El clip lleva `sever` (parte, instante, dirección). |
| `assets/anims/monster-hull.json` | Volumen de colisión del monstruo que usa el generador. |
| `tests/dismember.test.mjs` | `THREE_DIR=$PWD/node_modules/three node tests/dismember.test.mjs` prueba con la malla real: sin suelo atravesado, pieza fuera del cuerpo con varias semillas, revivir restaura. |

No toca `map1.js`, `course.js` ni los módulos visuales del héroe.
