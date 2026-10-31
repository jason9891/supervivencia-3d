/* biblioteca.js — punto de entrada único.
 *
 *   import { montarDecorado, construirMapa, crearObjeto, registrarTodo } from './lib-objetos/biblioteca.js';
 *   registrarTodo();                                   // registra todos los lotes de objetos (una vez)
 *   const root = construirMapa(scene, mapa);           // el plano del editor
 *   const dec  = montarDecorado(scene, root, mapa, decorado);
 *   // en el bucle: dec.anim(tiempo, camera.position);   al tocar: dec.clic(raycaster)
 */
export * from './mapa.js';
export * from './texturas.js';
export * from './piedras.js';
export * from './objetos.js';
export * from './objetos_pro.js';
export * from './objetos_lote2.js';
export * from './objetos_lote3.js';
export * from './objetos_lote4.js';
export * from './objetos_lote5.js';
export * from './decorado.js';
