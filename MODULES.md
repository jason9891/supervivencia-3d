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

| `corpse.js` | El cadáver es sólido: huella (x, z) sacada de la malla ya caída; `pushOut` aparta al jugador y a otros monstruos (se puede saltar por encima). La conecta `enemy-runtime.js`, así que vale en el juego y en el laboratorio. Pruebas: `tests/corpse.test.mjs`. |

| `nav.js` | Ruta A* local para el monstruo: rodea paredes y mesas en vez de empujar contra ellas. Pruebas: `tests/nav.test.mjs`. |

En `enemy-runtime.js`: barra de objetivo estilo Blade (solo aparece al pelear), encaramiento automático al atacar y al quedarte quieto cerca, y los muros se respetan por altura (como `resolveWallCollisions` del mapa).

| `props-mundo.js` | Objetos del mundo: mercado de la plaza (comida, telas, armas, herrero), interior del establo (pesebres, paja, carreta), despacho, sala y piso 2 del módulo, almenas y antorchas de las torres. Se llama después de `buildMap1` desde `index-app.js` y registra su colisión en `WALLS`; no edita `map1.js`. |

No toca `map1.js`, `course.js` ni los módulos visuales del héroe.

## torres.js
Torre 2 hueca (planta baja, escalera, sala alta), puerta con llave (x 84-86, y 11.5), palanca, puente levadizo (bisagra z=72), pasarela rota del módulo (x 82.5-87.5) y entrada al castillo. Portado de `prueba_modulo.html`. `buildTowers()` lo llama `map1.js`; expone `unlock()` (`tryUnlockTowerDoor`) y `pull()` (`pullLever`). Las paredes usan piedra (`USE_STONE_WALLS = true`).

## hero-lab.html / hero-lab.js
Visor de animaciones FBX (Mixamo) sobre `assets/characters/hero/personaje_1.fbx`. Lee `assets/characters/hero/manifest.json` (se regenera con `node tools/gen-hero-manifest.mjs` al agregar FBX). Agrupa por tipo, pausa/bucle/velocidad/línea de tiempo, movimiento raíz ON/OFF, esqueleto, «cargar todas» y «+ agregar FBX» desde el dispositivo. Las posiciones de caderas se reescalan a la altura del modelo. El FBX apunta a una textura externa (`Color_94217cb0-…`): si se sube una imagen a esa carpeta y se corre el generador, se aplica sola.

## hero-fbx.js + tools/bake-hero.*
El héroe del juego es ahora `personaje_1` con las animaciones Mixamo «sword and shield». `python3 tools/bake-hero.py` (tras `node tools/gen-hero-manifest.mjs`) convierte los FBX de `assets/characters/hero/` en `personaje_1.glb` (metros, 1.82 m, sin desplazamiento de raíz, sin la subida de caderas del salto) y `personaje_1.meta.json` (duración, momento del golpe y velocidad de cada clip). `loadHeroFbx()` los carga y crea alias para `locomotion.js` (`idle loop`, `walk loop`, `walk back`, `jog fwd loop`, `jump start`…). En `index-app.js`: pasos ajustados a la velocidad del juego, caminar atrás con su propio clip, guardia con ARMA y combo de ataque (`COMBO`) cuyo impacto cae en el `hit` de cada clip. Si falta el GLB se usa el humano anterior. Listos pero sin usar aún: death, impact, block, crouch, strafe, turn, casting, power up, sheath.
