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
- **Doble toque** en una flecha (o en W) y mantenerla = correr; también sirve el botón **CORRER** o Shift.
- **SALTAR** (o barra espaciadora) cruza los barrancos: saltando caminando se alcanzan ~1,7 m y **saltando en carrera ~3,5 m**, porque el salto conserva el impulso de la carrera. El primer barranco se cruza caminando; los demás requieren correr. Si caes, reapareces al inicio de la última plataforma. En la parte superior ves el progreso.
- Los botones de pantalla no seleccionan texto al mantenerlos pulsados.
- Acércate a un árbol o una piedra y pulsa **RECOGER**.
- Reúne 3 de madera y 2 piedras para fabricar un hacha.
- Salud, hambre y sed cambian durante la partida.

## Inventario y banco de pruebas de combate

Botón **INVENTARIO** (arriba a la derecha, o tecla **I**). No modifica el mapa ni el personaje: solo agrega su propia interfaz y un muñeco de entrenamiento.

- **Equipo:** arma (espada, hacha, maza), casco, pechera, grebas y escudo, en tres niveles. Muestra defensa, peso, velocidad y bloqueo.
- **Golpes y combos** del arma elegida. El golpe depende de lo que mantengas al pulsar **ATACAR**: ▲ adelante = estocada, ↔ a un lado = tajo, quieto = golpe alto. Si encadenas golpes sin esperar se activan los combos (por ejemplo, con la espada: lado → lado → adelante = *Cruz y estocada*).
- **Pociones** de vida, energía y furia (teclas 1, 2 y 3 fuera del inventario).
- **Banco de pruebas:** coloca un muñeco de paja o uno blindado frente a ti, golpéalo y mira el daño flotante, la energía y los combos. También puedes recibir un *golpe de prueba* para ver cuánto reduce el daño tu armadura.

Cómo está enganchado: `index.html` tiene cuatro líneas marcadas con `[combate]` (el `import`, la creación del addon, el cuerpo de `attack()` y `combat.update(dt)`). Todo lo demás vive en archivos propios:

- `combat.js`: reglas de armas, combos, armaduras, pociones y daño.
- `banco.js`: lógica del banco de pruebas (sin three.js).
- `combat-addon.js`: interfaz y muñecos (la única parte que toca three.js).

```
node tests/banco.test.mjs   # armas, combos, armadura, pociones y muñecos
```

## Notas

- El personaje y sus 43 animaciones son de Quaternius (Universal Animation Library, CC0), en `assets/characters/ual/`.
- Prototipo inicial: el terreno, los árboles, las piedras y el personaje se generan con Three.js.
- Requiere conexión a internet para cargar Three.js desde jsDelivr.
- No contiene compras ni servicios de pago.
- La lógica del camino y del salto está en `course.js` y se puede probar sin navegador: `node tests/course.test.mjs`.
