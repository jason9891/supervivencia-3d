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
