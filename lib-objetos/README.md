# lib-objetos — biblioteca de objetos, mecanismos y decorado para Supervivencia 3D

Todo se dibuja con código (texturas incluidas), sin modelos externos. Los objetos son piezas con tamaño ajustable,
nivel de detalle alto y pocas mallas cada una. El plano del editor **no se modifica**: lo que añades va en `decorado.json`.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `biblioteca.js` | Punto de entrada único (reexporta todo lo demás). |
| `mapa.js` | Construye el plano del editor. Los muros y pisos llevan etiqueta (`userData.dueno` y `superficie`). |
| `texturas.js` | Cargador de imágenes de `tex/` por tema (muro/piso de armería y capilla, calcomanías). |
| `piedras.js` | Convierte muros lisos en muros de piedras apiladas (`cubrirMuros`). |
| `objetos.js` | Base: texturas por código, fuego, catálogo, `crearObjeto`, `poblar`, `colocar`. Mesa, silla, banca, barril, caja, estante, armas, altar, vela, candelabro, brasero, antorchas. |
| `objetos_pro.js` | Nivel 2 (biselado, relieve, desgaste) de mesa/banca/barril/caja + mercado y establo: puesto, cajón de fruta, saco, canasta, carreta, pesebre, abrevadero, fardo, horca, cubo, poste de amarre. |
| `objetos_lote2.js` | Taburete, tinaja, leña, rastrillo, pala, silla de montar, balanza, ristra, quesos, farol, tocón con hacha. |
| `objetos_lote3.js` | Entorno y mecanismos: roca, rocal, parche de tierra, parche de pasto, reja levadiza, puerta-puente levadizo, palanca. |
| `objetos_lote4.js` | Estructuras de bloques: muro (curvo, almenado, con arco, con brecha, en ruinas), torre redonda, columna, puente de piedra y de madera (completos o rotos). |
| `objetos_lote5.js` | Techos (2, 1 o 4 aguas; teja, paja, tablillas, pizarra) y cornisa de piedra. |
| `decorado.js` | `montarDecorado`: lee `decorado.json` y coloca todo sobre el plano. |
| `decorado.json` | Ejemplo del archivo de decorado (comentado con `_ayuda`). |
| `mapa_decorado.html` | Visor local: plano del editor + decorado, con panel de salas. |
| `tex/` | Imágenes 256/512 px para `texturas.js`. |
| `ejemplos/` | Páginas autónomas (llevan su propio código): `galeria_objetos.html`, `prueba_entrada.html`, `prueba_pasadizo.html`, `prueba_cuartos.html`, `lab_detalle.html`. |

## Requisitos

- **Three.js r152 o más nuevo** (se probó con la r160). Usa `colorSpace`, `mergeGeometries` y `RoundedBoxGeometry`.
- Un servidor local (los módulos ES no cargan desde `file://`), por ejemplo el `localhost:8080` que ya usas.
- El importmap de la página debe incluir **dos** rutas, no solo `three`:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
```

Si el juego trae su propio Three, apunta ambas rutas a esa misma versión (los addons deben ser de la misma versión).

## Inicio rápido

1. Copia la carpeta `lib-objetos/` a tu repositorio.
2. Abre `http://localhost:8080/lib-objetos/mapa_decorado.html`. Lee `mapa.json` si lo pones en la carpeta; si no, toma el plano que el editor guardó en el navegador.
   El panel muestra todas las salas con su nombre/id: esas son las claves para `decorado.json`.
3. Edita `decorado.json` (qué va en cada sala) y pulsa **Recargar**.

En tu propio visor:

```js
import { construirMapa, montarDecorado } from './lib-objetos/biblioteca.js';
const root = construirMapa(scene, mapa);
const decorado = await (await fetch('lib-objetos/decorado.json')).json();
const dec = montarDecorado(scene, root, mapa, decorado);
// bucle:  dec.anim(tiempoEnSegundos, camera.position);
// toque:  dec.clic(raycaster);        // acciona palancas, rejas y puentes
// dec.info → tabla de salas: pedidos / colocados / sin sitio
```

## decorado.json

```json
{
  "variante": 0,
  "salas": {
    "Patio Libre": {
      "semilla": 3,
      "pedidos": [ { "tipo": "puesto", "n": 3, "modo": "pared", "params": { "w": [2, 3] } } ],
      "techo": { "aguas": 0, "cubierta": 0, "alt": 2.2 }
    }
  },
  "objetos": [ { "id": "reja1", "tipo": "reja", "x": 40, "y": 7, "z": 12, "giro": 90, "params": { "w": 3 } } ],
  "enlaces": [ { "palanca": "pal1", "acciona": [ { "id": "reja1", "on": "abrir", "off": "soltar" } ] } ],
  "piedras": { "tam": 0.9, "salas": ["Patio Libre"] }
}
```

- **Clave de sala**: id o nombre de la sala del editor. Si dos salas comparten nombre, las dos se decoran igual; usa el id para distinguirlas.
- **pedido**: `tipo`, `n`, `modo` (`pared`, `centro`, `esquina`), `params` (número fijo o `[min, max]` al azar), `sillas` (solo mesas).
  Las puertas, escaleras y huecos del plano se respetan solos. La misma `semilla` da siempre la misma distribución.
- **objetos sueltos**: `x, y, z` y `giro` en grados. `y` = altura del suelo de la sala (la Y del editor); se le suma el grosor de la losa. `alto` suma altura extra (para colgar algo en una pared). `"activo": false` lo ignora.
- **techo**: pone un techo a la medida de la sala sobre sus muros y oculta la losa plana del editor. `"sinTecho": true` solo quita la losa.
- **piedras**: muros de piedra en las salas indicadas (sin `salas`, en todos). Pesa en castillos grandes: úsalo por sala.
- Los campos que empiezan con `_` se ignoran.

## Crear un objeto suelto

```js
import { registrarTodo, crearObjeto } from './lib-objetos/biblioteca.js';
registrarTodo();
const mesa = crearObjeto('mesa', { w: 2.4, d: 0.9 });   // cualquier tamaño dentro del rango
scene.add(mesa.root);                                    // en el bucle: mesa.anim(t)
```

`CATALOGO` lista todos los tipos y sus parámetros `[mínimo, máximo, por defecto, paso]`. `galeria_objetos.html` los muestra con deslizadores.
Origen de cada objeto: centro de su huella, en el suelo; frente = +z. Si tiene llama, `obj.anchor` marca el punto donde poner una luz real.

## Mecanismos

`reja`, `puente_levadizo` y `palanca` tienen estado: `abrir()`, `cerrar()`, `soltar()` (cae con rebote), `alternar()`, `estado()` (0..1).
Una palanca acciona varios: `palanca.conectar(on => { reja.abrir(); puente.abrir(); })`.
Cada malla lleva `userData.mecanismo`, así que sirve un `Raycaster`.

## Rendimiento

- Cada objeto se funde en una malla por material; 40 copias de un objeto de nivel 2 corrieron con fluidez en el iPhone de prueba.
- Las luces reales son costosas: `montarDecorado` usa solo las 4 llamas más cercanas a la cámara (`{ luces: n }` para cambiarlo).
- Una torre de 20 m son ~800 piezas (~10 mil triángulos); un techo de 10 × 6 m, ~1.100 piezas.
- Pasto y piedritas usan instancias; el pasto se mueve con un sombreador de viento.

## Lo que NO está comprobado

La lógica (colocación, estados de los mecanismos, parámetros extremos, sintaxis) se probó con un Three simulado.
**Nada se vio todavía en un navegador por quien lo escribió**: pueden aparecer huecos entre bloques, escalas raras, texturas
demasiado regulares o diferencias con tu versión de Three. Cualquier cosa así se corrige ajustando el lote correspondiente.
