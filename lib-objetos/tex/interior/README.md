# Texturas de interior — cocina, muebles e interiores

29 imágenes nuevas de 512 px, **sin costuras** (se repiten sin que se note el borde), hechas por código como las de `lib-objetos/tex/`. Están registradas en `lib-objetos/catalogo.json` y en el `MANIFIESTO` de `lib-objetos/texturas.js`, así que salen solas en el editor de mapas (🎨 Texturas) y en el visor (tecla **T**), en tres grupos nuevos.

## 🍳 Cocina

| id | qué es | m por repetición |
|---|---|---|
| `cocina_azulejo_blanco` | Azulejo blanco tipo metro | 0.8 |
| `cocina_azulejo_damero` | Damero blanco y negro | 1.6 |
| `cocina_azulejo_azul` | Azulejo azul estampado | 1.0 |
| `cocina_azulejo_terracota` | Baldosa de terracota | 1.2 |
| `cocina_hexagonal` | Mosaico hexagonal | 1.3 |
| `cocina_baldosa_beige` | Baldosa beige grande | 1.5 |
| `cocina_encimera_granito` | Encimera de granito | 1.0 |
| `cocina_encimera_marmol` | Encimera de mármol blanco | 2.0 |
| `cocina_acero` | Acero inoxidable cepillado | 0.8 |

## 🪑 Muebles

| id | qué es | m por repetición |
|---|---|---|
| `mueble_roble` | Madera de roble | 1.0 |
| `mueble_nogal` | Madera de nogal | 1.0 |
| `mueble_pino` | Pino con nudos | 1.0 |
| `mueble_cerezo` | Madera de cerezo | 1.0 |
| `mueble_laca_blanca` | Madera lacada blanca | 1.0 |
| `mueble_tapiz_rojo` | Tapiz rojo a rayas | 0.5 |
| `mueble_lino` | Lino natural | 0.5 |
| `mueble_terciopelo_verde` | Terciopelo verde | 0.6 |
| `mueble_cuero_negro` | Cuero negro granulado | 0.5 |
| `mueble_capitone` | Cuero capitoné burdeos | 0.9 |

## 🏠 Interiores

| id | qué es | m por repetición |
|---|---|---|
| `interior_papel_damasco` | Papel damasco burdeos | 1.0 |
| `interior_papel_rayas` | Papel de rayas | 1.0 |
| `interior_papel_floral` | Papel floral | 1.0 |
| `interior_pintura_crema` | Pintura crema | 2.0 |
| `interior_parquet` | Parquet de tablas | 2.0 |
| `interior_alfombra_persa` | Alfombra persa | 2.4 |
| `interior_marmol_negro` | Mármol negro con vetas doradas | 2.5 |
| `interior_laton` | Latón cepillado | 0.8 |
| `interior_corcho` | Corcho | 0.6 |
| `interior_lambri` | Lambrín de madera | 2.0 |

«m por repetición» es lo que cubre una copia de la imagen; se puede cambiar en el editor (campo *m/repetición*) o en el visor.

## Cómo usarlas

- **Editor** (`generador-mapas/editor.html`): 🎨 Texturas → en cada superficie, el selector «Biblioteca…» ahora trae los grupos *Cocina*, *Muebles* e *Interiores*.
- **Visor** (`generador-mapas/index.html`): apunta a una pieza y pulsa **T**; elige «Solo esta pieza» o «Todos los…».
- **Otros visores** (`lib-objetos/texturas.js`): `tx.aplicar(material, 'cocina_azulejo_blanco')` (con `base: './tex/'` el cargador encuentra `interior/…`).

## Cambiarlas o añadir más

`generar_interior.py` genera todas (necesita `numpy` y `Pillow`): cada textura es una función corta con sus colores. Edita una y vuelve a correr `python3 generar_interior.py`. Para añadir una nueva: crea su función, añade una línea a la lista `TEXTURAS` y registra la entrada en `catalogo.json` (`"archivo": "interior/<id>.jpg"`, `"grupo": "cocina" | "mueble" | "interior"`); `python3 generar_interior.py --catalogo` imprime las entradas listas para pegar.

## Notas

- Se comprobó que el editor las lista y las guarda, y que no se ven costuras al repetirlas 2 × 2. No se probaron aún sobre los muros y pisos del visor 3D en un navegador: la escala (`m por repetición`) puede necesitar ajuste según cómo se vean.
- Las texturas son para superficies del plano (muros, pisos, techos, rampas, escaleras, puertas). Los objetos de `objetos*.js` (mesas, barriles…) siguen usando sus propias texturas dibujadas por código.
