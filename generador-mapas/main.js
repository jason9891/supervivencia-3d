import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { construirMapa, destruirMapa } from './mapa.js?v=10';
import { montarDecorado, crearPasto } from '../lib-objetos/biblioteca.js';
import { crearRecorrido } from './recorrido.js?v=4';
import { crearObjetosVisor } from './objetos-visor.js?v=3';

const zoneEl = document.getElementById('zone');
const overlay = document.getElementById('overlay');
const overlayHTML = overlay.innerHTML;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8c3d9);
scene.fog = new THREE.FogExp2(0xa8c3d9, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(15, 20, 35);

const controls = new PointerLockControls(camera, document.body);

overlay.addEventListener('click', () => {
    controls.lock();
    overlay.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    if ((rec && rec.pickerAbierto()) || (ov && ov.abierto())) return;
    overlay.style.display = 'flex';
});

const sunLight = new THREE.DirectionalLight(0xfff4e6, 2.5);
sunLight.position.set(30, 60, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.04;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const K_HORA = 'castillo-v20-hora';
const _cSky = { noche: new THREE.Color(0x0a1128), alba: new THREE.Color(0xe8a678), dia: new THREE.Color(0xa8c3d9) };
const _cSol = { alba: new THREE.Color(0xffa65c), dia: new THREE.Color(0xfff4e6), luna: new THREE.Color(0x8fa8ff) };
const _tmp = new THREE.Color();
let horaAct = 12;
function aplicarHora(h) {
    h = ((+h % 24) + 24) % 24; horaAct = h;
    const dia = h >= 6 && h <= 18;
    const f = dia ? (h - 6) / 12 : (((h < 6 ? h + 24 : h) - 18) / 12);
    const ang = f * Math.PI, alt = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang), Math.max(alt, 0.05) , 0.35).normalize();
    if (dia) dir.x = -Math.cos(ang); else dir.x = Math.cos(ang);
    sunLight.position.copy(dir).multiplyScalar(90);
    const calido = 1 - Math.min(1, alt * 2.2);
    if (dia) {
        sunLight.color.copy(_cSol.dia).lerp(_cSol.alba, calido);
        sunLight.intensity = 1.0 + 1.5 * Math.min(1, alt * 1.6);
        ambientLight.intensity = 0.4 + 0.2 * Math.min(1, alt * 1.6);
        _tmp.copy(_cSky.dia).lerp(_cSky.alba, calido * 0.8);
    } else {
        sunLight.color.copy(_cSol.luna);
        sunLight.intensity = 0.25 + 0.35 * alt;
        ambientLight.intensity = 0.12 + 0.08 * alt;
        _tmp.copy(_cSky.noche);
    }
    const borde = dia ? Math.min(1, alt * 12) : 0;
    if (dia) _tmp.lerp(_cSky.noche, 1 - borde);
    scene.background.copy(_tmp); scene.fog.color.copy(_tmp);
    renderer.toneMappingExposure = dia ? 1.2 : 1.0;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
    const txt = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    const ti = document.getElementById('hora-t'), sl = document.getElementById('hora-r');
    if (ti && ti.value !== txt) ti.value = txt; if (sl && +sl.value !== h) sl.value = h;
}
function guardarHora() { try { localStorage.setItem(K_HORA, String(horaAct)); } catch (e) {} }
(function initHora() {
    let h = 12; try { const v = localStorage.getItem(K_HORA); if (v !== null && isFinite(+v)) h = +v; } catch (e) {}
    const ti = document.getElementById('hora-t'), sl = document.getElementById('hora-r');
    if (ti) ti.addEventListener('input', () => { const m = /^(\d{1,2}):(\d{2})/.exec(ti.value); if (m) { aplicarHora(+m[1] + m[2] / 60); guardarHora(); } });
    if (sl) sl.addEventListener('input', () => { aplicarHora(+sl.value); guardarHora(); });
    window.addEventListener('keydown', e => {
        if (e.code === 'BracketLeft' || e.code === 'BracketRight') { aplicarHora(horaAct + (e.code === 'BracketRight' ? 0.5 : -0.5)); guardarHora(); }
    });
    window.addEventListener('storage', e => { if (e.key === K_HORA && e.newValue !== null) aplicarHora(+e.newValue); });
    aplicarHora(h);
})();

const LS_KEY = 'castillo-v20';
let mapaData = null, decorado = null, pastos = [];

function leerLocal() {
    try {
        const s = localStorage.getItem(LS_KEY);
        const j = s ? JSON.parse(s) : null;
        return j && Array.isArray(j.rooms) ? j : null;
    } catch (e) { return null; }
}

const LS_TEX = LS_KEY + '-tex', LS_REF = LS_KEY + '-ref', LS_TOBJ = LS_KEY + '-texobj';
let ultimoJson = null, rec = null, ov = null;
function leerExtra(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

const hashId = (s) => { let h = 7; String(s).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 9973; }); return h + 1; };
function montarPasto(json) {
    pastos.forEach(p => { scene.remove(p.root); p.dispose(); }); pastos = [];
    (json.rooms || []).forEach(r => {
        if (r.type === 'escalera' || (r.points && r.points.length > 2) || r.x0 === undefined) return;
        const slot = r.type === 'rampa' ? 'rampa' : 'piso';
        const to = json.texobj && json.texobj[r.id];
        const c = to ? to.pasto : (r.pasto && r.pasto.d > 0 ? r.pasto : (json.texturas && json.texturas[slot] && json.texturas[slot].pasto));
        if (!c) return;
        const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1), cara = 0.15;
        let altura = () => (r.y || 0) + cara, eje = (x1 - x0) >= (z1 - z0) ? 'x' : 'z';
        if (r.type === 'rampa') {
            const y2 = r.y2 != null ? r.y2 : (r.y || 0) + 3, dir = r.dir || '+x', alongX = dir.includes('x'), a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, fwd = dir[0] === '+';
            const yA = (fwd ? r.y : y2) + cara, yB = (fwd ? y2 : r.y) + cara;
            altura = (x, z) => { const t = ((alongX ? x : z) - a0) / (a1 - a0 || 1); return yA + (yB - yA) * t; };
            eje = alongX ? 'x' : 'z';
        }
        const lado = r.type === 'rampa' && !(r.lat === 0);
        const cfg = Object.assign({ sem: hashId(r.id) }, c);
        const g = crearPasto(cfg, { x0, x1, z0, z1 }, altura, { ejeCamino: eje, mx: lado && eje === 'z' ? 0.15 : 0, mz: lado && eje === 'x' ? 0.15 : 0, bordeEje: r.type === 'rampa' ? eje : undefined });
        scene.add(g.root); pastos.push(g);
    });
}

function jsonCompleto(json) {
    return { ...json, texturas: leerExtra(LS_TEX) || json.texturas, ref: leerExtra(LS_REF) || json.ref, texobj: leerExtra(LS_TOBJ) || json.texobj };
}

function montarObjetos(json) {
    montarPasto(json);
    if (decorado) { decorado.quitar(); decorado = null; }
    if (!Array.isArray(json.objetos) || !json.objetos.length) return;
    try {
        decorado = montarDecorado(scene, mapaData, json, { objetos: json.objetos, enlaces: json.enlaces || [] });
        json.objetos.forEach(d => {
            const ob = d.id && decorado.porId[d.id]; if (!ob) return;
            ob.root.userData.objId = d.id;
            if (d.escala > 0 && d.escala !== 1) ob.root.scale.setScalar(d.escala);
        });
    } catch (err) { console.error('❌ Error en los objetos:', err); }
}

function reconstruir(json, origen) {
    ultimoJson = json;
    json = jsonCompleto(json);
    try {
        if (decorado) { decorado.quitar(); decorado = null; }
        if (mapaData) destruirMapa(scene, mapaData);
        mapaData = construirMapa(scene, json);
        montarObjetos(json);
        console.log(`✅ Mapa construido desde ${origen}`);
        if (rec) { rec.actualizarSolidos(); }
    } catch (error) {
        console.error('❌ Error construyendo el mapa:', error);
        overlay.innerHTML = `<h1 style="color:red;">Error construyendo el mapa</h1><p>${error.message}</p>`;
        overlay.style.display = 'flex';
    }
}

async function cargarMapa() {
    const forzarArchivo = new URLSearchParams(location.search).get('src') === 'file';
    const local = forzarArchivo ? null : leerLocal();
    if (local) { reconstruir(local, 'el editor (localStorage)'); return; }

    try {
        const response = await fetch('./mapa.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('No se encontró mapa.json');
        reconstruir(await response.json(), 'mapa.json');
    } catch (error) {
        console.error('❌ Error cargando el mapa:', error);
        overlay.innerHTML = `<h1 style="color:red;">Error cargando el mapa</h1><p>${error.message}</p>`;
    }
}

rec = crearRecorrido({
    camera, controls, overlay,
    mapa: () => mapaData, deco: () => decorado, ref: () => (leerExtra(LS_REF) || (ultimoJson && ultimoJson.ref)),
    leer: leerExtra, guardar: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } },
    reconstruir: () => { if (ultimoJson) reconstruir(ultimoJson, 'el visor (textura)'); },
    LS_TEX, LS_TOBJ,
    apuntaObjeto: () => !!(ov && ov.apuntaObjeto()),
    reconstruirPasto: () => { if (ultimoJson) montarPasto(jsonCompleto(ultimoJson)); },
});
ov = crearObjetosVisor({
    camera, controls, overlay, scene,
    json: () => ultimoJson, mapa: () => mapaData, deco: () => decorado,
    guardar: () => { try { localStorage.setItem(LS_KEY, JSON.stringify(ultimoJson)); } catch (e) { console.warn(e); } },
    remontar: () => { if (ultimoJson) { montarObjetos(jsonCompleto(ultimoJson)); rec.actualizarSolidos(); } },
});
window.__ov = ov; window.__deco = () => decorado;
window.__rec = rec;
cargarMapa();

window.addEventListener('storage', (e) => {
    if (![LS_KEY, LS_TEX, LS_REF, LS_TOBJ].includes(e.key)) return;
    if (new URLSearchParams(location.search).get('src') === 'file') return;
    const j = leerLocal();
    if (j) reconstruir(j, 'el editor (actualización en vivo)');
});

const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyL') cargarMapa();
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
window.addEventListener('mousedown', () => {
    if (!controls.isLocked || !decorado) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    decorado.clic(raycaster);
});

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const speed = (keys['ShiftLeft'] ? 50 : 20) * dt;

    rec.update(dt, keys, clock.elapsedTime);
    ov.update(clock.elapsedTime);
    if (controls.isLocked && rec.activo()) {
        zoneEl.textContent = `A PIE · X:${camera.position.x.toFixed(1)} Y:${camera.position.y.toFixed(1)} Z:${camera.position.z.toFixed(1)} · G volar · T textura`;
    } else if (controls.isLocked) {
        let moverZ = 0, moverX = 0, moverY = 0;
        if (keys['KeyW']) moverZ += 1;
        if (keys['KeyS']) moverZ -= 1;
        if (keys['KeyD']) moverX += 1;
        if (keys['KeyA']) moverX -= 1;
        if (keys['Space']) moverY += 1;
        if (keys['ControlLeft']) moverY -= 1;

        controls.moveForward(moverZ * speed);
        controls.moveRight(moverX * speed);
        controls.getObject().position.y += moverY * speed;

        zoneEl.textContent = `VOLANDO · X:${camera.position.x.toFixed(1)} Y:${camera.position.y.toFixed(1)} Z:${camera.position.z.toFixed(1)} · G caminar · T textura`;
    }
    if (decorado) decorado.anim(clock.elapsedTime, camera.position);
    pastos.forEach(p => p.anim(clock.elapsedTime));
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
