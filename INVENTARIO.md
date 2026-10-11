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
