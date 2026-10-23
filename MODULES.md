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
El héroe del juego es `personaje_1` (Tripo) con las animaciones de siempre (UAL). `python3 tools/bake-hero.py` (tras `node tools/gen-hero-manifest.mjs`) genera `assets/characters/hero/personaje_1.glb`: el personaje a 1.82 m con los clips de `assets/characters/ual/` retargeteados a sus huesos `mixamorig…` (rotaciones en el mundo respecto al reposo; caderas escaladas a su altura), con los mismos nombres (`Idle_Loop`, `Walk_Loop`, `Sword_Attack`…). `loadHeroFbx()` lo carga y `index-app.js` lo usa igual que al humano anterior; si falta el GLB cae al humano anterior. `python3 tools/bake-hero.py mixamo` hace el GLB con las animaciones Mixamo (`personaje_1-mixamo.glb`, con duración y momento de golpe por clip); esas animaciones se ven en `hero-lab.html`. Como no existe la textura original, `tools/hero-paint.js` pinta una propia al hornear: rasteriza la malla en su atlas UV y colorea cada píxel según su posición 3D (piel, pelo, barba, cejas, ojos, boca, cinturón, short de tela, botas, muñequeras). Ojo: la malla en pose de enlace mira a +X con los brazos a lo largo de Z, por eso `bodyColor` remapea los ejes. Para usar una textura real: subir la imagen a `assets/characters/hero/` y volver a hornear.

## clips-lab.html / clips-lab.js / retarget.js — lab de animaciones de `sera_limpio`
Personaje: `assets/characters/hero/sera_limpio.glb`, horneado por `python3 tools/bake-sera.py [triángulos]` desde `sera_limpio.fbx` (1.4 M de vértices → 45 000 triángulos con el simplificador de meshoptimizer en `tools/vendor/`, esqueleto `mixamorig` en metros, textura original a 2048, sin animaciones).
El lab junta todas las animaciones del repo: UAL 1, UAL 2 y Jordan (lista en `assets/characters/clips-catalog.json`, se regenera con `tools/gen-clips-catalog.py`; se retargetean con `retarget.js`) y las FBX de Mixamo de `assets/characters/hero` (lista en `manifest.json`, `node tools/gen-hero-manifest.mjs`). Cada una se previsualiza sobre el personaje; se marcan con ☑ las que se usarán (pestaña ★: renombrar), «EN SITIO» quita el desplazamiento de caderas, «Zancada» alarga el paso en caminar/correr. **CREAR GLB** descarga `sera_limpio-anim.glb` con solo esos clips ya fijos (se sube a `assets/characters/hero/`). GUARDAR/CARGAR guardan la selección en JSON; también queda en el navegador.
`retarget.js`: `UalRetargeter` (giros en el mundo respecto al reposo, caderas escaladas a su altura) y `mixamoClip` (FBX Mixamo en cm → m, sin escala ni posiciones de otros huesos).

## armor-wear.js + armadura-sera.glb — armadura por conjuntos
`assets/characters/hero/armadura.glb` (16 piezas sueltas de otra escala, subidas por el usuario) se hornea con `python3 tools/bake-armor.py` en `armadura-sera.glb`: cada pieza se ajusta a su zona del cuerpo de `sera_limpio` (tabla `FIT` en `tools/bake-armor.html`), se empuja hacia afuera si queda bajo la piel (margen 2.2 cm, suavizado) y recibe los pesos de piel del vértice más cercano del cuerpo, así que se dobla con cualquier animación. Cuatro conjuntos: **casco** (3), **pechera** (0 + gorjal 11, 12), **brazos** (hombreras 10/13, brazos 14/15, antebrazos 4/5) y **piernas** (muslos 1/2, espinillas 7/9 y botas 6/8). Si cambia el personaje o la armadura, se vuelve a correr el bake.
`armor-wear.js`: `loadArmor(THREE, GLTFLoader, MeshoptDecoder, hero)` engancha las piezas a los huesos del héroe (por nombre) y devuelve `{ wear(set, bool), toggle(set), isWorn(set), all(bool) }`; el estado se recuerda en el navegador. En el juego aparece el botón **ARMADURA** (arriba a la izquierda) con casco / pechera / brazos / piernas / poner todo / quitar todo, solo con el héroe nuevo. `clips-lab.html` también trae los 4 botones para ver las animaciones con armadura.

### Armadura 2 (armadura_2.glb → armadura2-sera.glb)
`python3 tools/bake-armor.py armadura_2` hornea el caballero completo en T (5 piezas: pechera, piernas, 2 brazos, casco) con un ajuste uniforme a sera_limpio, simplificado a ~137k triángulos y con piel. `armor-wear.js` la usa por defecto (`ARMOR_URL`); la anterior sigue como `armadura-sera.glb`. Al llevar armadura, el cuerpo bajo cada conjunto se encoge 14 mm y se tiñe de tela (`under`/`setShrink`).
`armor-wear.js` también oculta la piel por partes (`BODY_PARTS`: cabeza, torso, brazos, antebrazos, manos, muslos, piernas, pies): `hidePart/togglePart/autoHide/hideAllBody`, guardado en localStorage `armor-hide-v1` (lo que se elige en clips-lab vale también en el juego). clips-lab tiene los botones OCULTAR PIEL, TODA la armadura y el deslizador ENCOGER CUERPO.

### Grupos de animación (clip-categories.js)
Cada clip del héroe es **básica** (siempre activa: idle, caminar, correr, saltar), **ataque** (se encadena en combo) o **mapa** (la dispara el mapa). clips-lab los asigna (botón de grupo en la pestaña ★, filtro TODOS/BÁSICA/ATAQUE/MAPA) y los escribe como sufijo del nombre (` [ataque]`, ` [mapa]`) en `sera_limpio-anim.glb`. `hero-fbx.js` los lee y devuelve `categories`, `combo` (clips de ataque en orden) y `triggers`; `index-app.js` encadena el combo con ATACAR y expone `window.playTrigger('nombre')` para los disparadores del mapa. Un GLB sin grupos sigue funcionando como antes.
`armor-wear.js`, ocultar piel automático: con **pechera** desaparece el torso, con **brazos** brazos y antebrazos, con **piernas** muslos, piernas y pies; las manos y la cabeza (rostro por la visera) siempre se ven. En clips-lab se puede ocultar más a mano (`armor-hide-v2`). Además comprime los brillos horneados de las texturas (`GLARE`, `setGlare`) que con la luz fuerte del juego se quemaban.
