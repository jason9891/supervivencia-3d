import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { construirMapa, destruirMapa } from './mapa.js?v=22';
import { montarDecorado, crearPasto } from '../lib-objetos/biblioteca.js';
import { crearRecorrido } from './recorrido.js?v=5';
import { crearObjetosVisor } from './objetos-visor.js?v=3';

const zoneEl = document.getElementById('zone');
const overlay = document.getElementById('overlay');
const overlayHTML = overlay.innerHTML;
