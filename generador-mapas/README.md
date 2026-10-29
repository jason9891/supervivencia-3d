# Generador de mapas (v22)

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
