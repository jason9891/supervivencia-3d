# rocas/ — colección de rocas y formaciones de piedra

Todo por código, con semilla (la misma semilla da siempre la misma roca; cambia `semilla` para otra parecida).
Se registra sola con `registrarTodo()` y aparece en el catálogo bajo el grupo **rocas** (`CATALOGO[tipo].grupo === 'rocas'`).

| tipo | qué es | parámetros principales |
|---|---|---|
| `roca_redonda` | canto rodado, liso | `w` `d` `h` `musgo` |
| `roca_larga` | alargada, como un tronco de piedra, algo curvada | `w` (largo) `d` `h` `deform` |
| `roca_ancha` | baja y ancha, tipo laja gruesa | `w` `d` `h` `deform` |
| `roca_deformada` | abultada, retorcida, irregular | `w` `d` `h` `deform` |
| `roca_angular` | de aristas, como de cantera | `w` `d` `h` `facetas` |
| `laja` | plancha delgada, se puede inclinar | `w` `d` `h` (grosor) `inclin` |
| `menhir` | piedra alta y afilada, algo inclinada | `w` `d` `h` `inclin` |
| `columnas_basalto` | columnas hexagonales de distinta altura | `n` `r` `h` |
| `estalagmita` | punta de roca (cuevas) | `r` `h` |
| `trilito` | dos menhires y un dintel (dolmen) | `w` `h` |
| `pila_lajas` | lajas apiladas | `w` `n` |
| `cantos` | muchas piedras pequeñas esparcidas | `n` `r` `area` |
| `penasco` | roca grande con otras al pie | `r` `musgo` |
| `roca_hendida` | roca partida con grieta | `w` `h` `grieta` |

Todas aceptan `semilla`; casi todas `musgo` (0–1). Para añadir una forma nueva: escribe su constructor en `rocas.js`
(usa `masa({...})` para rocas deformadas o `geoLaja` para planchas) y añádela a `DEFS_ROCAS` y `HUELLAS`.
En el editor y el visor (`generador-mapas`) salen en el grupo «🪨 Rocas».
