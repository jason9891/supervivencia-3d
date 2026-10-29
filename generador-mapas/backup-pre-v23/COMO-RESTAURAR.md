# Respaldo pre-v23 (modelo por vértices)

**Commit de origen:** `0ec5568c9ac3a74a18c7aad615eb3d01804acbb7`

Última versión estable **antes** de la reconstrucción solo-por-celdas (v23).

## Restaurar (opción A — desde este commit en GitHub)

Descarga los archivos del commit:

```
https://github.com/jason9891/supervivencia-3d/tree/0ec5568c9ac3a74a18c7aad615eb3d01804acbb7/generador-mapas
```

O con curl:

```bash
COMMIT=0ec5568c9ac3a74a18c7aad615eb3d01804acbb7
BASE=https://raw.githubusercontent.com/jason9891/supervivencia-3d/$COMMIT/generador-mapas
for f in editor.js editor.html celdas.js mapa.js main.js index.html README.md; do
  curl -sL "$BASE/$f" -o "generador-mapas/$f"
done
```

## Restaurar (opción B — archivos en esta carpeta)

Si están los `.js` / `.html` copiados aquí:

```bash
cp generador-mapas/backup-pre-v23/editor.js generador-mapas/
cp generador-mapas/backup-pre-v23/editor.html generador-mapas/
cp generador-mapas/backup-pre-v23/celdas.js generador-mapas/
cp generador-mapas/backup-pre-v23/mapa.js generador-mapas/
cp generador-mapas/backup-pre-v23/main.js generador-mapas/
cp generador-mapas/backup-pre-v23/index.html generador-mapas/
```

Luego hard refresh del navegador.

## Qué era esta versión

- Muros con grosor **4 celdas** (T=0.4), centrados en líneas/vértices
- Editor completo funcional (suelo, muro, poly, puertas, etc.)
- Clave localStorage: `castillo-v20`
