# Generador de mapas (v23)

Editor 2D + visor 3D de planos con cuadrícula de **10 cm**.

## Cambio principal v22
- **Muros de 1 celda** de grosor (antes 4 celdas).
- Todo trabaja en **ocupación de celdas**, no en vértices.
- El puntero se guía al **centro del cuadrado**.
- Salas de celda a celda.
- Se mantiene la lógica anti-solapamiento (sin parpadeo).

## Archivos

| Archivo | Descripción |
|---------|-------------|
| [`editor.html`](editor.html) | **Editor 2D**: diseña el mapa |
| `editor.js` | Código del editor |
| [`index.html`](index.html) | **Visor 3D**: recorre el mapa |
| `main.js` | Lógica del visor 3D |
| `mapa.js` | Construcción 3D desde el JSON |
| `celdas.js` | Lógica compartida de celdas / muros |

## Cómo usarlo

1. Sirve la carpeta (necesario para los módulos ES del visor):

```bash
npx serve .
```

2. Abre `editor.html` y dibuja el mapa. Se guarda solo en `localStorage` (clave `castillo-v20`).
3. Abre `index.html` **desde el mismo servidor y puerto** para verlo en 3D. Si dejas el visor abierto en otra pestaña, se actualiza solo cuando guardas en el editor.
4. En el visor: clic para entrar · WASD mover · Shift correr · Espacio/Ctrl subir y bajar · R recargar mapa.

## Guardar y compartir mapas

- En el editor, **💾 JSON** copia el mapa, **⬇️** lo descarga y **📂** importa uno.
- Si guardas un archivo como `mapa.json` junto a `index.html`, el visor lo usa cuando no hay datos del editor en el navegador. Con `?src=file` en la URL se fuerza a usar solo `mapa.json`.

## Estado v23.4
- `mapa.js` (visor 3D) ya NO depende de una copia en internet: vive en este repo y construye muros de sala, muros de trazo, bloques y puertas desde la misma ocupación de celdas que el editor (`celdas.js`), en una sola malla. Los muros de sala arrancan sobre la losa (sin parpadeo en la base) y el dintel de las puertas es una sola pieza.
- La puerta toma la dirección del muro donde la colocas (antes salía cruzada en muros de trazo y de sala).
- `_historial/`: archivos intermedios de las versiones v22/v23 (no se usan). `backup-pre-v23/`: cómo volver a la versión anterior.

## v23.4 · todo en celdas (0 vértices)
- `editor-extras.js`: panel de propiedades y diseñador de puertas con medidas y posiciones en **celdas** (ancho/alto/alféizar/marco de la puerta, celda X/Z, celdas inicial/final de una sala, alto de muros y bloques). Solo el nivel Y se sigue dando en metros.
- Herramienta Bloques: el alto también va en celdas.

- generador-mapas: la rampa es un prisma inclinado con extremos cortados en vertical (empieza en Y y termina en Y final, grosor vertical constante). Visor v=6.
- generador-mapas: rampas con muros laterales (1 celda de grosor, alto configurable en 'Muros laterales', 0 = sin) que siguen la pendiente y acaban en corte vertical. Visor v=7.

## v23.6 · Personaje de referencia y texturas
- **🧍 Personaje** (editor): clic o arrastre en el plano coloca una figura de 1,75 m (altura editable) en el nivel Y activo; se ve en el plano y en el visor 3D para comparar escalas.
- **🎨 Texturas** (editor): una imagen por superficie (muros/bloques, pisos, techos, rampas, escaleras, puertas) con «metros por repetición». El visor la proyecta en coordenadas de mundo, así la escala se mantiene en cualquier pieza. Las imágenes se reducen a 512 px.
- Se guardan aparte del mapa (`castillo-v20-ref`, `castillo-v20-tex`) y se incluyen en el JSON exportado como `ref` y `texturas`.

## v23.7 · Herramienta «🪑 Objeto» (lib-objetos)
- Elige un tipo del catálogo de `lib-objetos` (mesa, puesto, barril, reja, palanca, torre, techos…) y haz clic en el plano para colocarlo. Clic sobre uno existente = seleccionarlo; arrastrar = mover; **R** = girar 15° (Mayús+R al revés); Supr = eliminar.
- El panel permite X, Z, Y, giro, altura extra y los parámetros propios del objeto (ancho, fondo, alto…). Duplicar y eliminar incluidos.
- Se guardan en `data.objetos` (mismo formato que «objetos» de `decorado.json`): entran en deshacer/rehacer y en el JSON exportado. El visor 3D los dibuja con `montarDecorado` y las palancas/rejas/puentes se accionan con clic apuntando con la mira.
- Para el decorado por pedidos (`salas`, `techo`, `piedras`) sigue valiendo `lib-objetos/decorado.json`.
- **Enlaces palanca → mecanismos**: al seleccionar una Palanca, el panel lista las rejas y puentes levadizos del plano con casillas para marcar cuáles acciona (líneas amarillas punteadas en el plano). Se guardan en `data.enlaces` (formato de `decorado.json`) y se limpian solos si borras un objeto. En el visor, clic apuntando a la palanca abre/cierra todo lo enlazado.
- **Biblioteca de texturas**: en 🎨 Texturas cada superficie tiene un selector «Biblioteca…» con las 31 texturas repetibles de `lib-objetos/tex/` (muros, pisos, cubiertas, materiales) y su medida por defecto; sigue pudiendo subir una imagen propia. Las elegidas de la biblioteca se guardan como ruta, no como imagen, así que no ocupan almacenamiento.

## v23.8 · Recorrido a pie y textura por pieza (visor)
- **G** alterna entre *volar* y *caminar*. Al caminar entras donde dejaste al 🧍 Personaje (si no lo hay, donde estás), a la altura de sus ojos, con gravedad, salto (Espacio), correr (Mayús) y **colisiones**: muros, bloques, pisos, rampas, escaleras y objetos no se traspasan. Se suben escalones de hasta 0,4 m y rampas.
- La mira (círculo en el centro) indica la pieza apuntada. **T** abre el selector de la biblioteca de texturas: «Solo esta pieza» (se guarda por id en `castillo-v20-texobj`) o «Todos los muros/pisos/…» (cambia la ranura general, la misma de 🎨 Texturas del editor). «Quitar textura» la deshace.
- Los bloques se pintan uno a uno (cada bloque es una celda): para muros hechos de bloques conviene «Todos los …». Se exporta como `texobj` en el JSON.

## v23.9 · Objetos desde el visor
- **O** abre el catálogo (con buscador) y pone el objeto donde apuntas, con el frente mirando hacia ti. **E** selecciona el objeto apuntado (se marca con un recuadro rosa; E otra vez lo suelta).
- Con un objeto seleccionado: **R** / **Mayús+R** gira 15°, **+ / −** cambia el tamaño (escala sus medidas propias —ancho, fondo, alto, radio…— dentro de sus límites; si no tiene, usa una escala general `escala` de 0,3 a 4), **M** lo mueve siguiendo la mira (clic = soltar), **P** abre un panel con valores exactos (X, Z, Y, giro, altura extra, escala y todos sus parámetros, duplicar, eliminar) y **Supr** lo borra.
- El visor guarda en el mismo mapa (`data.objetos`) y el editor abierto en otra pestaña se actualiza solo. «Recargar el mapa» pasó de **R** a **L**.
- Si el mapa venía de `mapa.json` y no del editor, la primera edición crea una copia local en el navegador que pasa a tener prioridad.
