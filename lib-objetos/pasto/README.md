# Pasto (semilla configurable)

`crearPasto(cfg, rect, altura, opc)` genera hojas finas y curvas (InstancedMesh) con viento proporcional a la altura de cada hoja: el pasto corto casi no se mueve, el alto ondula.

Opciones (`cfg`): tam (m), var (%), hoja (cm), arqueo, lean (°), dens (hojas/m²), suave (borde), viento, vel, dir (°), turb, matiz, clar, seco, brillo, camino (ancho de sendero, m), crece, sem.

Se asigna como textura (🎨 del editor o selector del recorrido, por pieza o por tipo) y se ajusta con `formularioPasto`. También existe el objeto `semilla_pasto` (grupo «Pasto»). Presets en `catalogo.json`.
