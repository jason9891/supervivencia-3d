# Inventario funcional (armas, armaduras, pociones, llaves y objetos)

Módulos **nuevos**; no modifican `map1.js`, `course.js`, `index.html` ni nada visual del personaje.

| Archivo | Qué hace | ¿Necesita navegador? |
|---|---|---|
| `combat.js` | Reglas: armas, combos, armaduras, pociones, cofres | No |
| `inventario.js` | Qué tienes: piezas, pociones, objetos, banderas del mapa, guardado | No |
| `banco.js` | Banco de pruebas (muñecos, golpe de prueba) sobre el inventario | No |
| `combat-addon.js` | Botón INVENTARIO, panel, barras, números de daño | Sí |

Pruebas: `node tests/inventario.test.mjs`, `node tests/banco.test.mjs`, `node tests/addon.smoke.mjs`.

## Dónde se prueba

- `combat-lab.html`: arena plana con el mismo personaje y controles del juego, más el inventario. Se abre con el botón **COMBATE · PRUEBAS** de `index.html`; el botón **VOLVER AL JUEGO** regresa.
- No usa `map1.js` y solo lee el personaje (no cambia su modelo ni su aspecto).
- Para llevarlo al mapa más adelante, hay que añadir 4 líneas en `index.html`:
  1. `import { createCombatAddon } from './combat-addon.js';`
  2. Tras `player.facing = Math.PI;`: `const combat = createCombatAddon({ THREE, scene, camera, player, onSwing: () => playAttackAnim(), getFlags: () => ({ llave: hasKey, nota: pageRead, comida: foodTaken }) });`
  3. Renombra `attack()` a `playAttackAnim()` y añade un `attack()` que calcule `f` y `side` de `keys` y llame a `combat.pressAttack(f, side)`.
  4. En `animate()`, tras `updateStat();`: `combat.update(dt);`

## Comportamiento
- **Objetos del mapa** (llave, notas, comida) aparecen en OBJETOS al activarse su bandera. No se guardan: el mapa se reinicia al recargar, y las banderas vuelven a darlos una vez.
- **Lo conseguido** (`combat.give({ weapon:['hacha'], armor:{casco:['malla']}, potions:{vida:2}, items:{comida:1} })`) sí se guarda en `localStorage`. Sin `localStorage` funciona igual, solo que no guarda.
- **Modo pruebas** (activo por defecto, hasta que el castillo tenga cofres): todo desbloqueado. Al desactivarlo vuelves a lo que de verdad tienes.
- Teclas: `I` abre/cierra, `Esc` cierra, `1/2/3` beben vida/energía/furia.

## Pendiente / decisiones tuyas
- La comida cura 25 (valor inventado, en `ITEMS`).
- La armadura no ralentiza ni hay botón de bloqueo.
- No probado en navegador real: solo con DOM y three simulados.

## Animación de los golpes (`swing-style.js`)

- **Tres golpes, tres dinámicas, pausa, y se repiten.** La animación depende del PASO en la cadena, no de la dirección: golpe 1 = tajo de derecha a izquierda (`Sword_Regular_A`), golpe 2 = contra-tajo de vuelta (`Sword_Regular_B`), golpe 3 = estocada pesada con avance largo (`Sword_Regular_C`). Tras el 3.º hay una pausa de 0.5 s en la que no se encola otro golpe; si dejas pasar más de 0.6 s entre golpes, la cadena también vuelve al 1. Las flechas (▲, ◀▶, ●) solo matizan: ▲ avanza más, ◀▶ gira más el torso.
- **Sincronía:** el clip se acelera para que su impacto (medido en cada clip) caiga cuando el juego aplica el daño; los clips largos empiezan poco antes del impacto. Los combos (Torbellino, etc.) siguen dependiendo de la secuencia de direcciones; Torbellino da una vuelta completa.
- **Clips:** `UAL2_Standard.glb` (Quaternius, CC0) está en `assets/characters/ual/` y se carga solo. Sin él, los tres pasos usan `Sword_Attack` pero con posturas distintas. Tabla de clips: `STEP_CLIPS`.
- **Guardia, golpe recibido, beber y morir** (`combat-lab.html`): GUARDIA o tecla K (mantener) usa `Idle_Shield_Loop`, camina a media velocidad y gasta energía al bloquear; golpe bloqueado = `Sword_Block`, sin guardia = `Hit_Chest`, guardia rota = `Hit_Knockback`, beber/comer = `Consume`, 0 de vida = `Death01` hasta Restablecer. El addon avisa con `onAction`.
- **BEBER** (botón o tecla Q): bebe la poción que haga falta (vida, energía o furia); si no hace falta ninguna, reproduce la animación igual como prueba.
- **INTERACTUAR** (botón o tecla E): un solo botón para todo lo que se pueda tocar. En el laboratorio hay un cofre (`Chest_Open`, da hacha, cota de malla y una poción), una llave (`PickUp_Table`) y una puerta que solo abre con esa llave (`Interact`). Añadir otro objeto son unas líneas con `addProp(nombre, x, z, dibujo, { prompt, act })`.
- Las flechas eligen el tipo de golpe; si hay un muñeco a menos de 6 m, el personaje se orienta hacia él.
- Clips aún sin usar: `Shield_Dash`, `Melee_Hook`, `Sword_Heavy_Combo`.

## Personaje humano y equipo visible

- **El humano** (`assets/characters/hero/night-striker.glb`, Quaternius CC0, con textura, pelo y ojos) sustituye al maniquí amarillo en `combat-lab.html` y en `equipment-lab.html`. Comparte esqueleto y pose con UAL, así que las animaciones de combate se aplican por nombre de hueso. Si el modelo no carga, se usa el maniquí como respaldo. Créditos en `assets/characters/hero/CREDITS.md`.
- **`hero.js`** carga el humano y los clips (`loadHero`), lo deja a 1.82 m (`fitModel`) y adapta las animaciones (`adaptClips`): conserva las rotaciones y las traslaciones de `root`/`pelvis` escaladas a su cadera, y descarta las traslaciones de los demás huesos para que el humano mantenga sus propias proporciones. Contiene además las medidas del cuerpo (`PROFILES`).
- **`equipment.js`** dibuja las piezas del juego sobre los huesos y ahora se ajusta al cuerpo según `PROFILES`: el casco envuelve la cabeza con un margen de 1-4 cm, el peto sigue el torso, las grebas siguen el muslo y la pantorrilla, las hombreras van en el hueso del brazo y el arma se sujeta por el centro de la palma con el eje de los nudillos (comprobado en los clips de espada: la hoja apunta adelante y arriba en `Sword_Regular_A`).
- **`equipment-lab.html`** (antes dependía de una URL externa y de `esm.sh`) es ahora un taller que usa lo mismo que el juego: elige arma, casco, pechera, grebas y escudo (con las piezas y cifras de `combat.js`), presets, vistas de cabeza y mano, y todas las animaciones, incluido un COMBO 1-2-3 con la pausa. La versión anterior sigue en el historial de git (commit `7e3a144`).
- Para llevar el humano al juego en `index.html`: sustituir la carga de `UAL1_Standard.glb` por `loadHero(THREE, GLTFLoader)` y usar `info.model` y `info.clips` en `setupLocomotion`; es un cambio en el personaje del mapa, por eso no está hecho.

## Armas y escudos con modelo (Quaternius, CC0)
`equipment.js` usa los GLB de `assets/weapons/` (ver su `CREDITS.md`): `createEquipment(...).loadModels(GLTFLoader)` los carga y redibuja; los que fallen se sustituyen por las formas simples. Mapa: `WEAPON_MODEL` y `SHIELD_MODEL`. Las armaduras (casco, peto, grebas) siguen siendo piezas procedurales: este pack no las trae.

## Todas las armas (12)
`combat.js` define 12 armas (espada, hacha, maza + daga, daga curva, espada larga, mandoble, claymore, hacha de mano, hacha de guerra, martillo de guerra, lanza), cada una con sus 3 golpes y combos, y `equipment.js` las dibuja con los GLB de `assets/weapons/`. En modo pruebas están todas desbloqueadas; el panel INVENTARIO tiene una fila "TODAS LAS ARMAS" para equipar cualquiera con un toque (`banco.pick`).

## Movimiento (`locomotion.js`)
Lógica pura y probada (`tests/locomotion.test.mjs`) que usan `index.html` y `combat-lab.html`:
- Retroceso: si solo se pulsa atrás (o joystick hacia atrás) el personaje no se da la vuelta; reproduce `Walk_Loop` al revés (UAL Standard no trae clips de retroceso) a 0.7× de velocidad y sin correr.
- Correr usa `Jog_Fwd_Loop` (3.0 m por ciclo a RUN_SPEED); caminar `Walk_Loop` (2.4 m por ciclo a WALK_SPEED, sin deslizar).
- Salto: `Jump_Start` acelerado (entra ya en el impulso) → `Jump_Loop` en el aire → `Jump_Land` acelerado solo si aterrizas quieto tras un salto largo; si sigues corriendo, continúa el trote.
- Giro visual suave (`smoothYaw`); la lógica sigue usando `player.facing`.
- En el laboratorio CORRER es interruptor, para poder correr y saltar con el pulgar libre.
No hay clips laterales en UAL Standard: al moverse de lado el personaje gira hacia esa dirección.
