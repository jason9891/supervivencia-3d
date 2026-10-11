# Módulos del proyecto (unión sin sobrescribir)

## Qué hay en main ahora

| Archivo | Rol | Origen |
|---------|-----|--------|
| `map1.js` | Mapa El Regreso (croquis) | trabajo de mapa |
| `course.js` | Movimiento + `freeMap` | mapa |
| `index.html` | Entrada del juego (mapa + personaje) | restaurado; **no** importa combate aún |
| `combat.js` | Reglas de combate, armas, enemigos | `respaldo-combate-patio` |
| `equipment.js` | Visual de equipo sobre huesos | `respaldo-combate-patio` |
| `session.js` | Une course + combat | `respaldo-combate-patio` |
| `banco.js` | Banco de pruebas de equipo | `combate-en-mapa` |
| `combat-addon.js` | UI inventario / muñecos | `combate-en-mapa` |

## Cómo enganchar combate sin tocar el mapa

En `index.html` (solo cuando quieras):

```js
import { createCombatAddon } from './combat-addon.js';
// tras crear scene, camera, player:
const combat = createCombatAddon({ THREE, scene, camera, player, onSwing: () => {} });
// en el bucle:
// if (attackPressed) combat.pressAttack(f, side);
// combat.update(dt);
```

`combat-addon.js` está pensado para **no modificar** el mapa ni el personaje: solo lee posición y añade UI/muñecos.

## Ramas

- `main` — unión modular (este estado)
- `mapa-el-regreso` — solo mapa
- `respaldo-combate-patio` / `combate-en-mapa` / `combate-blade` — historial de combate
- `animaciones-ual` — animaciones personaje

No editar `map1.js` desde ramas de combate ni `combat*.js` desde ramas de mapa.
