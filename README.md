# Supervivencia 3D

Prototipo de supervivencia 3D para móviles, ejecutable en el navegador y pensado para probarse desde Safari en iPhone.

## Cómo probarlo

1. Activa GitHub Pages en **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. Cuando termine la publicación, abre: https://jason9891.github.io/supervivencia-3d/

## Controles

- Mueve al personaje con el joystick táctil; en ordenador también puedes usar WASD o flechas.
- **ATACAR** (o tecla J) lanza el ataque de espada; **ARMA** (o tecla E) alterna la postura con espada. **CORRER** (o Shift) hace sprint.
- Acércate a un árbol o una piedra y pulsa **RECOGER**.
- Reúne 3 de madera y 2 piedras para fabricar un hacha.
- Salud, hambre y sed cambian durante la partida.

## Notas

- El personaje y sus 43 animaciones son de Quaternius (Universal Animation Library, CC0), en `assets/characters/ual/`.
- Prototipo inicial: el terreno, los árboles, las piedras y el personaje se generan con Three.js.
- Requiere conexión a internet para cargar Three.js desde jsDelivr.
- No contiene compras ni servicios de pago.
