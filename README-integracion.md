# Supervivencia 3D · Mapa 1 "El Regreso" · Guía de integración

Esta guía explica **dónde** va cada archivo, **cómo** subirlo sin romper el juego y **qué falta** por conectar.
Sitio publicado: https://jason9891.github.io/supervivencia-3d/

---

## 1. Convenciones

- **Ejes:** +X este · +Z norte · Y altura. Unidades en metros.
- **Alturas:** nivel 0 = `y 0` (inicio y rampa) · nivel 1 = `y 6` (plaza, corredor, patio) · piso 2 del módulo = `y 11.5` · muros de la plaza = 5 m (`y 6 a 11`) · muros del módulo = 10.5 m (`y 6 a 16.5`).
- **Solidez:** lo que bloquea al jugador se registra con `addWall(minX, maxX, minZ, maxZ, minY, maxY)`. Sin `minY/maxY` bloquea a cualquier altura.
- **Dónde se puede caminar:** `addPlatform(minX, maxX, minZ, maxZ, y)` (pisos, escalones, pasarelas) y las rampas de `map-ramps.js`.
- **Textura ≠ solidez:** la textura es solo apariencia. Un objeto es sólido solo si se registra con `addWall`. Los comestibles y la utilería pequeña no lo son a propósito.

---

## 2. Dónde va cada archivo

Todos los archivos `.js` van **en la raíz del repositorio**, junto a `index.html`, con el nombre **exacto** (minúsculas, guiones, extensión `.js`; GitHub distingue mayúsculas).

| Archivo | Qué hace | Estado |
|---|---|---|
| `map1.js` | Arma el mapa: pisos, muros, reja del corredor, establo, utilería. Contiene la física (`WALLS`, `PLATFORMS`, `getGroundHeight`, `resolveWallCollisions`). | ✅ Entregado (v3 + recinto) |
| `natural-ramp.js` | Inicio, rampa y descanso: terreno, pasto, rocas, acantilado y muros de contención. | ✅ Entregado (v3) |
| `props-medieval.js` | Texturas y materiales compartidos, cofre, mesa, silla, antorcha. | ⚠️ Versión vieja en el repo. Pendiente actualizar (madera con menos líneas, cofre hueco, banca, comestibles) |
| `map-ramps.js` | Física de la rampa. | ⏺ No se toca |
| `modulo2.js` | Módulo de dos pisos. | ⏳ Pendiente (diseño validado en la prueba del módulo) |
| `props-plaza.js` | Mercado y utilería de la plaza. | ⏳ Pendiente (diseño validado) |
| `props-castillo.js` | Torre 2, palanca, puerta, pasarela, puente levadizo, entrada al castillo. | ⏳ Pendiente (diseño validado) |
| `diagnostico.html` | Página de comprobación (no es parte del juego). | ✅ Ya subida |
| Archivo principal del juego | Bucle, personaje, cámara, interacción. | ❓ No lo he visto |

**Dependencias:** `map1.js` importa `natural-ramp.js`, `props-medieval.js`, `map-ramps.js` y `modulo2.js`. Si falta uno, el navegador no ejecuta nada del juego (ni botones ni personaje).

---

## 3. Cómo subir cambios (GitHub desde el celular)

1. **Respaldo:** abre `map1.js` → copia su contenido → *Add file → Create new file* → nombre `respaldo-map1.js` → pega → *Commit changes*.
2. **Archivos nuevos primero** (`natural-ramp.js`, `props-*.js`): *Add file → Create new file*, escribe el nombre exacto, pega el contenido, *Commit changes*.
3. **Archivos existentes:** ábrelo → menú ⋯ → *Edit file* → selecciona todo → pega → *Commit changes*.
4. **`map1.js` va al final**, cuando ya existan los módulos que importa.
5. Espera 1 o 2 minutos a que GitHub Pages publique. Recarga sin caché.
6. Abre `…/diagnostico.html`. Debe decir `OK` en todos los archivos, en los módulos y en `buildMap1 se ejecutó sin errores`.
7. Abre el juego.

Si algo falla, restaura `respaldo-map1.js` en `map1.js` y revisa la tabla de la sección 8.

---

## 4. Qué debe hacer el archivo principal

`map1.js` se usa igual que antes. El archivo principal tiene que:

- Llamar `buildMap1(scene)` una vez y guardar lo que devuelve (`mapData`).
- **Cada frame**, con el objeto del jugador (`x, y, z, vy, grounded, jumping, coyote, airTime`): `resolveGround(player)` y `resolveWallCollisions(player)`.
- Usar `distanceToPage / Key / Lever / Food(x, y, z)` para las interacciones.
- Usar `tryUnlockTowerDoor(mapData, hasKey)` para la puerta de la torre.

`map1.js` ya hace por su cuenta, con un reloj propio: el parpadeo de antorchas, el viento del pasto, y la caída de la reja del corredor.

**Reja del corredor:** cae sola cuando el jugador cruza `x = 36.5` viniendo de la rampa (`checkGateTrigger`, dentro de `resolveWallCollisions`). `closePassageGate(mapData)` ya no la dispara al tocarla: se ignora hasta que el jugador la haya pasado.

**Constantes al inicio de `map1.js`:**
- `USE_STONE_WALLS`: `false` conserva las paredes naranja de tu diseño; `true` las pasa a piedra.
- `RAMP_DETAIL`: `1` en escritorio, `0.5` en celulares lentos (menos pasto y rocas).

---

## 5. Mapa de coordenadas (referencia)

| Zona | Coordenadas |
|---|---|
| Aparición del jugador | `(6.5, 0, 3)` |
| Zona de arranque | x 0 a 13.5, z 0 a 9, y 0 |
| Rampa | centro `x 6.75`, z 9 a 66, sube de y 0 a 6, mitad de ancho 5.5 |
| Descanso | x 0 a 13.5, z 66 a 72, y 6 |
| Corredor | x 13.5 a 67.5, z 63 a 72. Reja en `x = 34`, disparo en `x = 36.5`. Paso a la plaza en x 54.8 a 67.3 |
| Plaza | x 13.5 a 67.5, z 0 a 63 |
| Pozo y puestos | pozo `(40, 28)`; comida `(33, 28)`; telas `(40, 36)`; armas `(47, 28)` |
| Establo | x 13.9 a 53.8, z 45 a 63. Entrada de 4 m en x 46.5 a 50.5. Tabique bajo en `x = 35.85` con paso en z 45.6 a 49 |
| Módulo de dos pisos | x 67.8 a 89.5, z 1.7 a 52.8. Puerta en el muro oeste z 18 a 24. Escaleras x 82 a 88, z 8 a 18 |
| Piso 2 | y 11.5, desde z 18 |
| Pasarela rota | x 82.5 a 87.5, z 52.8 a 63. Hueco de salto z 56.6 a 59.6 |
| Patio | x 67.5 a 90, z 52.8 a 63, y 6 |
| Torre 2 | x 80.5 a 90, z 63 a 72. Puerta con llave en `x 84 a 86` (cara sur, y 11.5). Palanca en `(85, 11.5, 71.35)`. Salida a nivel del suelo por el muro oeste |
| Puente levadizo | hoja de 5.2 m en `x 75.15 a 80.35`, bisagra en `z = 72`, cae hacia el norte |
| Entrada al castillo | descanso en z 78 a 84, fin del mapa |

---

## 6. Flujo del nivel

Inicio → rampa → corredor (la reja cae atrás) → plaza y mercado → establo (opcional) → módulo (página y llave en el despacho) → escaleras → piso 2 → pasarela rota (saltar el hueco) → puerta de la torre 2 (con llave) → palanca → la hoja del puente cae → escalera de la torre → paso entre las torres → puente levadizo → castillo (fin del mapa).

---

## 7. Qué falta y qué necesito de tu archivo principal

**Tandas pendientes**
1. **Plaza y establo:** `props-medieval.js` actualizado, `props-plaza.js`, y en `map1.js` los muros bajos de madera del establo, la banca con comestibles y el mercado.
2. **Módulo, torre y castillo:** `modulo2.js` nuevo, `props-castillo.js`, y ampliar el mapa más allá de `z = 72`.

**Lo que no puedo ver y hace falta para la tanda 2** (pégame estas partes del archivo principal):
- Las líneas con `portcullis`, `leverArm` y `towerDoor`: cómo abre el rastrillo hoy y cómo quita su colisión.
- Cómo guarda el inventario (página, llave, comida) y cómo recoge objetos. Los comestibles nuevos (manzanas y setas) necesitan engancharse ahí.
- Cómo se configuran luces y sombras. El mapa es de día: luz hemisférica, luz solar con sombras (`renderer.shadowMap.enabled = true`) y fondo de cielo.
- Cómo está definido el límite del mapa (`MAP.maxZ = 72`) y qué pasa al terminar el nivel.
- La versión de Three.js que usa tu `importmap`.

Si agregas una cinemática: ponla en un archivo aparte. Si mueve al personaje por código, la reja del corredor puede dispararse en mitad de la escena. Si vuelve a llamar `buildMap1`, las antorchas anteriores quedan en una lista interna (fuga pequeña).

---

## 8. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El juego no abre, sin botones ni personaje | Falta un archivo importado, o el nombre está mal | Abre `diagnostico.html`: la línea `FALTA` dice cuál es |
| `Importing a module script failed` | Archivo con nombre distinto (`.json`, mayúsculas, espacios) | Renómbralo: *Edit file* y cambia el nombre |
| `diagnostico.html` marca error en un módulo | Error dentro del archivo | Mándame la captura |
| El pasto no se mueve | Tu versión de Three.js trata distinto los shaders | Avísame con tu versión |
| Va lento en el celular | Pasto y rocas | `RAMP_DETAIL = 0.5` |
| El personaje queda atrapado | Muro de contención mal ubicado | Dime el lugar y lo corrijo |
| La reja cae al tocarla | El archivo principal llama a `closePassageGate` y no está tu `map1.js` nuevo | Confirma que `map1.js` es la versión v3 |

---

## 9. Páginas de prueba (solo diseño, no van al repositorio)

Sirven para validar antes de pasar a código.

- Pasto y recinto: https://claude.ai/artifact/6qSJdCrc5nBZMGSxCvxSfX
- Objetos (castillo y cofres): https://claude.ai/artifact/Myie8Lu78kYrG2KAoxfCya
- Establo: https://claude.ai/artifact/Qm8Ws1wwPSPvskXkkg364N
- Plaza: https://claude.ai/artifact/LfJtu2Y1eVuLgDSEGiJfSd
- Módulo de dos pisos y torre: https://claude.ai/artifact/24FRFLmQvWugWAW41sJ5d6
