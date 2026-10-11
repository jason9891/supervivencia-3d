# Supervivencia 3D

Prototipo de acción 3D para móviles, ejecutable en el navegador y pensado para probarse desde Safari en iPhone. Combate por dirección con combos, armas, armaduras por pieza, escudos y pociones, en un camino de barrancos con guardianes y un portal final.

## Cómo probarlo

1. Activa GitHub Pages en **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. Cuando termine la publicación, abre: https://jason9891.github.io/supervivencia-3d/

## Objetivo

1. Cruza los 5 barrancos del camino.
2. Derrota a los 6 enemigos (soldados caídos y guardianes). El portal final está sellado mientras quede alguno vivo.
3. Cruza el portal dorado.

Los cofres de cada plataforma se abren al acercarte, pero solo cuando ya no queda ningún enemigo vivo en esa plataforma.

## Controles

| Acción | Pantalla | Teclado |
|---|---|---|
| Moverse | flechas de la izquierda | WASD o flechas |
| Correr | doble toque en una flecha, o **CORRER** | doble toque en W, o Shift |
| Saltar | **SALTAR** | barra espaciadora |
| Atacar | **ATACAR** | J |
| Guardia (mantener) | **BLOQUEAR** | K |
| Pociones | **VIDA**, **ENERGÍA**, **FURIA** | 1, 2, 3 |
| Cambiar equipo | **EQUIPO** | I o Tab |

- **Saltar corriendo** conserva el impulso: ~3,5 m de alcance, frente a ~1,7 m caminando. La armadura frena al caminar pero no acorta el salto.
- Si caes a un barranco, reapareces al inicio de la última plataforma.

## Combate

- **El golpe depende de la dirección que mantienes al pulsar ATACAR:** ▲ adelante = estocada larga, ↔ hacia un lado = tajo amplio, quieto = golpe alto.
- **Combos:** encadenar ciertos golpes activa un combo con más daño. Por ejemplo, con la espada: lado → lado → adelante = *Cruz y estocada*; golpe alto → lado → lado = *Torbellino*.
- **Armas:** espada (rápida), hacha (media) y maza (lenta y pesada, aturde).
- **Armadura por pieza:** casco, pechera, grebas y escudo, en tres niveles (cuero, malla, placas; el escudo va de rodela a escudo torre). Más defensa significa más peso: menos velocidad y menos recuperación de energía.
- **Guardia:** el escudo bloquea una parte del daño de frente y gasta energía; sin escudo bloqueas con el arma, menos. Si te quedas sin energía, se rompe la guardia.
- **Pociones:** vida, energía y furia (más daño durante un tiempo).

## Notas

- El personaje y sus 43 animaciones son de Quaternius (Universal Animation Library, CC0), en `assets/characters/ual/`.
- Las armas y armaduras se dibujan con formas simples propias sobre el esqueleto del personaje.
- Requiere conexión a internet para cargar Three.js desde jsDelivr.
- No contiene compras ni servicios de pago.

## Estructura y pruebas

La lógica no depende de three.js y se prueba con Node sin navegador:

- `course.js`: camino, barrancos, salto y movimiento.
- `combat.js`: armas, combos, armaduras, pociones, cofres y enemigos.
- `session.js`: une movimiento y combate; objetivo, cofres, muerte y victoria.
- `equipment.js`: dibujo del equipo sobre el personaje.
- `index.html`: escena, controles táctiles, interfaz y animaciones.

```
node tests/course.test.mjs    # camino y salto
node tests/session.test.mjs   # combate, equipo, cofres y objetivo
node tests/bot.test.mjs       # un jugador simulado completa el juego
```
