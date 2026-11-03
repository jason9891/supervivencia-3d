# texturas-pack — 47 texturas y 15 temas para Supervivencia 3D

Imágenes sin costuras (se repiten sin que se note el borde), hechas por código, listas para usar con `texturas.js`.
Las 8 que ya tenías se conservan tal cual; hay **39 nuevas**: 9 muros, 8 pisos, 4 cubiertas, 7 materiales y 11 calcomanías/estandartes.

## Qué hay

| Archivo | Para qué sirve |
|---|---|
| `tex/` | Las 47 imágenes. Las repetibles son JPG de 512 px (las de material, 256 px); las calcomanías y estandartes son PNG con transparencia. |
| `texturas.js` | Cargador actualizado: catálogo completo, 15 temas y `opcionesDeMapa` para aplicarlos a tu plano. |
| `catalogo.json` | La misma lista en formato de datos (id, archivo, medida, uso, temas). |
| `muestrario.html` | Ábrelo para verlas todas. Tocando una se ve repetida 3 × 3, para revisar si se nota la costura. |
| `mapa_decorado.html`, `decorado.json` | Versiones actualizadas del visor y del ejemplo (ya aplican los temas). |

## Cómo ponerlo en `lib-objetos/`

1. Copia `tex/` (reemplaza o mezcla con la que ya tienes), `texturas.js`, `mapa_decorado.html` y `decorado.json` encima de los de `lib-objetos/`.
2. En `decorado.json` elige el tema de cada sala:

```json
{
  "temaDefecto": "castillo",
  "salas": { "Patio Libre": { "tema": "mercado" }, "Establo": { "tema": "establo" } },
  "muros": { "idDeUnMuroLibre": "ruinas" }
}
```

3. En tu visor: `construirMapa(scene, mapa, tx.opcionesDeMapa(mapa, decorado))`, con `const tx = crearTexturas(THREE, { base: './tex/' })`.
   Si una imagen falta, esa superficie queda con su color base.

Para una superficie suelta: `tx.aplicar(material, 'muro_sillar')`. Para una calcomanía:
`const g = tx.crearCalcomania('decal_sangre'); tx.pegar(g, {x, y, z}, {x: 0, y: 0, z: 1}); scene.add(g);`

## Temas

| tema | nombre | muro | piso | techo |
|---|---|---|---|---|
| `armeria` | Armería | `muro_armeria` | `piso_armeria` | (el piso) |
| `capilla` | Capilla | `muro_capilla` | `piso_capilla` | (el piso) |
| `castillo` | Gran castillo | `muro_castillo` | `piso_losa` | (el piso) |
| `sillar` | Sillar y adoquín | `muro_sillar` | `piso_adoquin` | (el piso) |
| `mamposteria` | Casa rústica de piedra | `muro_mamposteria` | `piso_tierra` | (el piso) |
| `ladrillo` | Taller de ladrillo | `muro_ladrillo` | `piso_losa` | `cubierta_teja` |
| `taberna` | Taberna | `muro_adobe` | `piso_tablas` | `piso_tablas` |
| `establo` | Establo | `muro_madera` | `piso_paja` | `piso_tablas` |
| `mercado` | Mercado | `muro_adobe` | `piso_adoquin` | (el piso) |
| `cueva` | Cueva / mina | `roca_cueva` | `piso_tierra` | (el piso) |
| `ruinas` | Ruinas | `muro_ruina` | `piso_losa` | (el piso) |
| `musgoso` | Patio viejo con musgo | `muro_musgo` | `piso_adoquin` | (el piso) |
| `salon` | Salón noble | `muro_castillo` | `piso_damero` | (el piso) |
| `jardin` | Jardín | `muro_mamposteria` | `piso_pasto` | (el piso) |
| `patio` | Patio de barro | `muro_sillar` | `piso_barro` | (el piso) |

Se pueden añadir los tuyos: `crearTexturas(THREE, { temas: { miTema: { muro: 'muro_sillar', piso: 'piso_losa' } } })`.

## Texturas

### Muro

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `muro_sillar` | Sillar de piedra | cada 3 m | Muros de castillo, plazas |
| `muro_castillo` | Gran sillería oscura | cada 4 m | Murallas, torres, salones |
| `muro_mamposteria` | Mampostería irregular | cada 3 m | Casas rústicas, muros viejos |
| `muro_ladrillo` | Ladrillo cocido | cada 2 m | Hornos, casas, talleres |
| `muro_adobe` | Revoque de adobe | cada 3 m | Tabernas, casas, mercado |
| `muro_madera` | Tablones verticales | cada 2 m | Establos, cabañas, cercos |
| `roca_cueva` | Roca natural | cada 5 m | Cuevas, minas, acantilados |
| `muro_musgo` | Sillar con musgo | cada 3 m | Ruinas húmedas, patios viejos |
| `muro_ruina` | Muro en ruinas | cada 3 m | Ruinas, edificios abandonados |
| `muro_armeria` | Muro de armería | cada 4 m | Armería |
| `muro_capilla` | Muro de capilla | cada 4 m | Capilla |

### Piso

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `piso_adoquin` | Adoquines | cada 2 m | Calles, plazas, patios |
| `piso_losa` | Losas irregulares | cada 3 m | Interiores de castillo, capillas, patios |
| `piso_tierra` | Tierra con piedritas | cada 3 m | Caminos, establos, patios de tierra |
| `piso_tablas` | Tablas de madera | cada 2 m | Tabernas, casas, puentes |
| `piso_paja` | Paja suelta | cada 2 m | Establos, graneros, jergones |
| `piso_pasto` | Pasto corto | cada 2 m | Jardines, praderas, bordes de camino |
| `piso_barro` | Barro con charcos | cada 3 m | Caminos lluviosos, corrales |
| `piso_damero` | Damero de mármol | cada 4 m | Salones, capillas nobles |
| `piso_armeria` | Piso de armería | cada 4 m | Armería |
| `piso_capilla` | Piso de capilla | cada 4 m | Capilla |

### Cubierta

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `cubierta_teja` | Teja de barro | cada 1.5 m | Techos de casas, establos, mercado |
| `cubierta_pizarra` | Pizarra | cada 1.5 m | Techos de castillo, torres |
| `cubierta_paja` | Paja de techar | cada 2 m | Techos rústicos, establos |
| `cubierta_tablillas` | Tablillas de madera | cada 1.5 m | Techos de cabañas, tabernas |

### Material

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `hierro` | Hierro forjado | cada 1 m | Rejas, herrajes, aros |
| `hierro_oxidado` | Hierro oxidado | cada 1 m | Cadenas, rejas viejas, clavos |
| `madera_oscura` | Madera oscura | cada 1 m | Vigas, muebles, puertas |
| `madera_clara` | Madera clara | cada 1 m | Cajas, bancas, tablas nuevas |
| `cuero` | Cuero | cada 0.5 m | Sillas de montar, correas, bolsas |
| `arpillera` | Arpillera | cada 0.5 m | Sacos, toldos, trapos |
| `mimbre` | Mimbre trenzado | cada 0.5 m | Canastas, cestos, cercos |

### Decal

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `decal_sangre` | Mancha de sangre | 1.5 × 1.5 m | Suelos y muros de mazmorra |
| `decal_hollin` | Hollín | 1.2 × 2.4 m | Sobre antorchas, chimeneas, braseros |
| `decal_telarana` | Telaraña (esquina) | 1.0 × 1.0 m | Esquinas de techos y rincones |
| `decal_gotera` | Mancha de humedad | 1.2 × 2.4 m | Muros bajo techos, cerca de goteras |
| `decal_hojas` | Hojas secas | 1.5 × 1.5 m | Esquinas del suelo, bajo árboles |
| `decal_grieta_grande` | Grieta grande ramificada | 3.0 × 3.0 m | Muros agrietados, suelos rotos |
| `decal_grieta` | Grieta | 2.0 × 2.0 m | Muros |
| `decal_runa` | Runa | 1.5 × 1.5 m | Muros y suelos de capilla |
| `decal_moho` | Moho | 2.5 × 2.5 m | Muros húmedos |

### Estandarte

| id | qué es | medida | dónde usarla |
|---|---|---|---|
| `estandarte_azul` | Estandarte azul con sol | 1.2 × 2.4 m | Colgado en muros de salones y patios |
| `estandarte_verde` | Estandarte verde con cruz | 1.2 × 2.4 m | Colgado en muros de salones y patios |
| `estandarte_negro` | Estandarte negro con espadas | 1.2 × 2.4 m | Colgado en muros de salones y patios |
| `estandarte_blanco` | Estandarte blanco con cruz roja | 1.2 × 2.4 m | Colgado en muros de salones y patios |
| `estandarte_torre` | Estandarte granate con torre | 1.2 × 2.4 m | Colgado en muros de salones y patios |
| `estandarte_rojo` | Estandarte rojo | 1.5 × 3.0 m | Salones |

## Notas

- El tamaño “cada N m” es cuánto cubre una repetición. `mapa.js` ya entrega las UV en metros, así que se aplica solo.
- Los objetos de `objetos*.js` (mesas, barriles, techos...) llevan sus propias texturas dibujadas por código; estas imágenes son para muros, pisos y calcomanías del plano.
- Por qué JPG: son opacas y pesan unas 5 veces menos que PNG. El total del paquete son unos 7 MB.
- Para sumar texturas nuevas: guarda la imagen en `tex/` y añade una línea en `MANIFIESTO` de `texturas.js` (`src`, `tipo`, `tile` o `w`/`h`).
- **No comprobado:** las imágenes se revisaron en una hoja de contacto; no se probaron aún sobre los muros y pisos de tu plano en un navegador. La escala (`tile`) puede necesitar ajuste según cómo se vea.

## Texturas de interior (cocina, muebles, interiores)

Otras 29 texturas repetibles viven en `tex/interior/` (grupos `cocina`, `mueble` e `interior` del catálogo): azulejos, encimeras, maderas de mueble, tapicerías, papeles pintados, parquet, alfombra, mármol negro, latón, corcho y lambrín. Lista completa, medidas y cómo regenerarlas o añadir más: [`tex/interior/README.md`](tex/interior/README.md).
