// combat-addon.js — inventario y banco de pruebas de armas, armaduras, pociones y combos.
// Se engancha a la página con muy pocas líneas ([combate] en index.html) y NO toca el mapa
// ni el personaje: solo lee la posición del jugador y añade su propia interfaz y muñecos.
// La lógica está en banco.js / combat.js (sin three.js, probada con Node).
import * as B from './banco.js';
import * as I from './inventario.js';
import * as C from './combat.js';

const CSS = `
#cmb-btn{position:fixed;z-index:25;top:calc(env(safe-area-inset-top) + 58px);right:12px;padding:9px 13px;border:1px solid #c4a574;border-radius:10px;background:#2a241cdd;color:#f3d7a0;font:bold 12px system-ui;letter-spacing:.06em;touch-action:manipulation}
#cmb-hud{position:fixed;z-index:20;top:calc(env(safe-area-inset-top) + 58px);left:12px;width:150px;pointer-events:none;font:bold 11px system-ui;color:#e8dfce;text-shadow:0 1px 3px #000}
#cmb-hud .bar{height:9px;border:1px solid #000a;background:#000a;border-radius:5px;overflow:hidden;margin-bottom:4px}
#cmb-hud .bar i{display:block;height:100%;width:100%}
#cmb-hud .hp i{background:#c0392b}#cmb-hud .st i{background:#4aa56a}
#cmb-hud .txt{margin-top:2px;letter-spacing:.04em}
#cmb-toast{position:fixed;z-index:30;top:28%;left:0;right:0;text-align:center;pointer-events:none;font:bold 20px system-ui;color:#f3d7a0;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .2s}
.cmb-pop{position:fixed;z-index:30;pointer-events:none;font:bold 18px system-ui;color:#fff;text-shadow:0 2px 3px #000;transform:translate(-50%,-50%);animation:cmbrise .9s ease-out forwards}
.cmb-pop.combo{color:#f3d7a0;font-size:24px}.cmb-pop.kill{color:#ff7a66;font-size:22px}
@keyframes cmbrise{from{opacity:1;margin-top:0}to{opacity:0;margin-top:-48px}}
.cmb-dbar{position:fixed;z-index:21;width:64px;height:7px;background:#000a;border:1px solid #000a;border-radius:4px;transform:translate(-50%,-50%);pointer-events:none;display:none;overflow:hidden}
.cmb-dbar i{display:block;height:100%;width:100%;background:#d9a441}
#cmb-panel{position:fixed;z-index:45;inset:0;display:none;align-items:center;justify-content:center;background:#000b;padding:10px}
#cmb-panel .box{width:min(94vw,410px);max-height:90vh;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;background:#1a1814f2;border:1px solid #c4a574;border-radius:12px;padding:14px 16px;color:#e8dfce;font:13px/1.4 system-ui}
#cmb-panel .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
#cmb-panel .hd b{color:#f3d7a0;letter-spacing:.06em;font-size:14px}
#cmb-panel h4{margin:14px 0 6px;color:#f3d7a0;font-size:12px;letter-spacing:.1em;border-bottom:1px solid #c4a57455;padding-bottom:3px}
#cmb-panel button{touch-action:manipulation;border:1px solid #c4a574;border-radius:8px;background:#2a241c;color:#f3d7a0;font:bold 12px system-ui;padding:8px 10px;margin:2px 3px 2px 0}
#cmb-panel .row{display:flex;align-items:center;gap:6px;margin:3px 0}
#cmb-panel .row .lb{width:62px;color:#b9ad96;font-size:11px;letter-spacing:.06em}
#cmb-panel .row .nm{flex:1;text-align:center}
#cmb-panel .row button{width:38px;margin:0}
#cmb-panel .stats{margin-top:6px;color:#e8dfce}
#cmb-panel .atk,#cmb-panel .cmbo{margin:3px 0}
#cmb-panel .cmbo b{color:#f3d7a0}
#cmb-panel .note{color:#b9ad96;font-size:12px;margin-top:6px}
#cmb-panel .msg{min-height:18px;color:#f3d7a0;margin-top:6px}
#cmb-panel .log{margin-top:6px;padding:8px;background:#0006;border-radius:8px}
`;

const SLOT_ORDER = ['weapon', ...C.SLOTS];

// getFlags (opcional): función que devuelve las banderas del mapa, p. ej. { llave: hasKey, nota: pageRead, comida: foodTaken }.
//   El inventario las convierte en objetos (llave, notas, comida). Solo se LEE el estado; el mapa no se modifica.
// storage (opcional): por defecto localStorage del navegador; el inventario se guarda solo.
// onAction (opcional): avisa de acciones que la página puede animar: { type:'drink', kind } | { type:'eat' } | { type:'hurt', blocked, guardBroken, killed }.
export function createCombatAddon({ THREE, scene, camera, player, onSwing, onAction, getFlags, storage }) {
  if (storage === undefined) { try { storage = window.localStorage; } catch { storage = null; } }
  const inv = I.load(storage, { testMode: true });
  const bench = B.createBanco(inv);
  const persist = () => I.save(inv, storage);
  const emit = e => { try { if (onAction) onAction(e); } catch { /* la animación nunca debe romper el combate */ } };
  let panelOpen = false;
  let msg = '';
  let lastAttack = null;
  let dummyMesh = null;
  let toastT = 0;

  // --- Interfaz ---------------------------------------------------------------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = (tag, id) => { const e = document.createElement(tag); if (id) e.id = id; document.body.appendChild(e); return e; };

  const btn = el('button', 'cmb-btn'); btn.textContent = 'INVENTARIO';
  const hud = el('div', 'cmb-hud');
  const sub = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; };
  const hpFill = sub('i', '', sub('div', 'bar hp', hud));
  const stFill = sub('i', '', sub('div', 'bar st', hud));
  const hudTxt = sub('div', 'txt', hud);
  const toast = el('div', 'cmb-toast');
  const panel = el('div', 'cmb-panel');
  const dbar = el('div'); dbar.className = 'cmb-dbar';
  const dbarFill = sub('i', '', dbar);

  function say(text) { msg = text; if (panelOpen) renderPanel(); }
  function showToast(text) { toast.textContent = text; toast.style.opacity = '1'; toastT = 1.4; }

  function renderPanel() {
    const st = B.currentStats(bench);
    const w = B.describeWeapon(bench);
    const rows = SLOT_ORDER.map(slot => `
      <div class="row"><span class="lb">${C.SLOT_LABEL[slot]}</span>
        <button data-act="prev" data-slot="${slot}">◀</button>
        <span class="nm">${C.itemName(slot, bench.equip[slot])}</span>
        <button data-act="next" data-slot="${slot}">▶</button></div>`).join('');
    const atks = w.attacks.map(a => `<div class="atk">${a.icon} <b>${a.name}</b> — daño ${a.dmg} · alcance ${a.reach} · energía ${a.stamina}${a.stagger ? ' · aturde' : ''}</div>`).join('');
    const cmbs = w.combos.map(c => `<div class="cmbo">${c.seq} &nbsp;<b>${c.name}</b> ×${c.mult}${c.stagger ? ' · aturde' : ''}</div>`).join('');
    const p = bench.potions, s = bench.stats;
    const items = I.listItems(inv);
    const objs = items.length
      ? items.map(it => `<div class="atk"><b>${it.name}</b>${it.count > 1 ? ' ×' + it.count : ''} — ${it.desc}${it.kind === 'consumible' ? ' <button data-act="item" data-id="' + it.id + '">Usar</button>' : ''}</div>`).join('')
      : '<div class="note">Aún no has encontrado llaves ni otros objetos.</div>';
    const last = s.last ? `Último golpe: ${s.last.attackName} · ${s.last.damage}${s.last.combo ? ' · combo ' + s.last.combo + ' ×' + s.last.mult.toFixed(1) : ''}` : 'Aún no has golpeado al muñeco.';
    panel.innerHTML = `<div class="box">
      <div class="hd"><b>INVENTARIO · PRUEBAS</b><button data-act="close">✕ Cerrar</button></div>
      <h4>EQUIPO${inv.testMode ? ' · MODO PRUEBAS' : ''}</h4>${rows}
      <div class="stats">Defensa <b>${st.defense}</b> · Peso <b>${st.weight}</b> · Velocidad ×${st.speedMul.toFixed(2)} · Bloqueo ${Math.round(st.blockFrac * 100)}%</div>
      <h4>GOLPES Y COMBOS · ${w.name.toUpperCase()}</h4>${atks}
      <div style="margin-top:6px">${cmbs}</div>
      <div class="note">El golpe depende de lo que mantengas al pulsar ATACAR: ▲ adelante, ↔ a un lado, ● quieto. Encadena los golpes sin esperar para activar un combo.</div>
      <h4>OBJETOS</h4>${objs}
      <h4>POCIONES</h4>
      <button data-act="potion" data-kind="vida">VIDA ×${p.vida}</button><button data-act="potion" data-kind="energia">ENERGÍA ×${p.energia}</button><button data-act="potion" data-kind="furia">FURIA ×${p.furia}</button>${inv.testMode ? '<button data-act="refill">Recargar</button>' : ''}
      <h4>BANCO DE PRUEBAS</h4>
      <button data-act="dummy" data-kind="paja">Muñeco de paja</button><button data-act="dummy" data-kind="blindado">Muñeco blindado</button><button data-act="nodummy">Quitar muñeco</button>
      <button data-act="testhit">Recibir golpe de prueba (${B.TEST_HIT})</button><button data-act="restore">Restablecer</button>
      <button data-act="testmode">Modo pruebas: ${inv.testMode ? 'SÍ (todo desbloqueado)' : 'NO (solo lo que tienes)'}</button>
      <div class="msg">${msg}</div>
      <div class="log">${last}<br>Total: ${s.hits} golpes · ${s.damage} de daño · ${s.combos} combos · ${s.kills} derrotas</div>
    </div>`;
  }

  function setPanel(open) {
    panelOpen = open;
    panel.style.display = open ? 'flex' : 'none';
    if (open) renderPanel();
  }

  function handleAction(t) {
    const act = t.dataset.act;
    if (act === 'close') return setPanel(false);
    if (act === 'prev' || act === 'next') {
      B.cycle(bench, t.dataset.slot, act === 'next' ? 1 : -1);
      msg = '';
    } else if (act === 'potion') {
      const r = B.usePotion(bench, t.dataset.kind);
      msg = r.ok ? 'Bebiste: ' + r.msg : r.msg;
      if (r.ok) emit({ type: 'drink', kind: t.dataset.kind });
    } else if (act === 'item') {
      const r = B.useItem(bench, t.dataset.id);
      msg = r.ok ? 'Usaste: ' + r.msg : r.msg;
      if (r.ok) emit({ type: 'eat' });
    } else if (act === 'testmode') {
      I.setTestMode(inv, !inv.testMode);
      bench.fighter.weapon = C.WEAPONS[inv.equip.weapon];
      msg = inv.testMode ? 'Modo pruebas: todo desbloqueado' : 'Solo tienes lo que has conseguido';
    } else if (act === 'refill') {
      B.refillPotions(bench); msg = 'Pociones recargadas';
    } else if (act === 'dummy') {
      placeDummy(t.dataset.kind); msg = 'Muñeco colocado frente a ti. Cierra el inventario y ataca.';
    } else if (act === 'nodummy') {
      removeDummy(); msg = 'Muñeco retirado';
    } else if (act === 'testhit') {
      const r = B.testHit(bench);
      msg = r ? `Golpe de ${r.raw}: recibes ${r.taken}` + (r.blocked ? ' (bloqueado)' : '') + (r.guardBroken ? ' · ¡guardia rota!' : '') + (r.killed ? ' · caes a 0' : '') : 'Estás caído: pulsa Restablecer';
      if (r) emit({ type: 'hurt', blocked: r.blocked, guardBroken: r.guardBroken, killed: r.killed });
    } else if (act === 'restore') {
      B.restore(bench); msg = 'Vida y energía restablecidas';
    }
    persist();
    renderPanel();
  }
  panel.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (t) handleAction(t);
    else if (e.target === panel) setPanel(false);
  });
  btn.addEventListener('click', () => setPanel(!panelOpen));
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'i' || k === 'tab') { if (k === 'tab') e.preventDefault(); if (!e.repeat) setPanel(!panelOpen); }
    else if (k === 'escape' && panelOpen) setPanel(false);
    else if (!panelOpen && ['1', '2', '3'].includes(k)) {
      drink(['vida', 'energia', 'furia'][+k - 1]);
    }
  });

  // --- Muñeco de pruebas (se añade a la escena; no toca el mapa) ----------------
  function buildDummy(kind) {
    const g = new THREE.Group();
    const straw = kind === 'blindado' ? 0x59616c : 0x8a6d3b;
    const wood = 0x5a4026;
    const mat = (c, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: m });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(new THREE.CylinderGeometry(0.4, 0.46, 0.14, 14), mat(wood), 0, 0.07, 0);
    add(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), mat(wood), 0, 0.8, 0);
    add(new THREE.BoxGeometry(0.5, 0.62, 0.26), mat(straw, kind === 'blindado' ? 0.7 : 0), 0, 1.15, 0);
    add(new THREE.SphereGeometry(0.18, 12, 10), mat(straw, kind === 'blindado' ? 0.7 : 0), 0, 1.62, 0);
    add(new THREE.BoxGeometry(1.15, 0.11, 0.11), mat(wood), 0, 1.35, 0);
    return g;
  }
  function placeDummy(kind) {
    removeDummy();
    const x = player.x + Math.sin(player.facing) * 1.8, z = player.z + Math.cos(player.facing) * 1.8;
    const d = B.placeDummy(bench, kind, x, z, player.y || 0);
    dummyMesh = buildDummy(kind);
    dummyMesh.position.set(d.x, d.y, d.z);
    // El muñeco mira hacia el jugador.
    dummyMesh.rotation.y = player.facing + Math.PI;
    scene.add(dummyMesh);
  }
  function removeDummy() {
    if (dummyMesh) { scene.remove(dummyMesh); dummyMesh = null; }
    B.clearDummies(bench);
    dbar.style.display = 'none';
  }

  // --- Proyección 3D → pantalla (barras y números flotantes) ---------------------
  const tmp = new THREE.Vector3();
  function toScreen(x, y, z) {
    tmp.set(x, y, z).project(camera);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight };
  }
  function pop(text, cls, x, y, z) {
    const s = toScreen(x, y, z); if (!s) return;
    const d = document.createElement('div');
    d.className = 'cmb-pop' + (cls ? ' ' + cls : '');
    d.textContent = text; d.style.left = s.x + 'px'; d.style.top = s.y + 'px';
    document.body.appendChild(d);
    setTimeout(() => { if (d.remove) d.remove(); }, 950);
  }

  // --- Animación del personaje: el combate avisa cuando empieza cada golpe -------
  function watchSwing() {
    const a = bench.fighter.attack;
    if (a && a !== lastAttack && onSwing) onSwing(a);
    lastAttack = a;
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'hit') {
        const d = e.dummy;
        const kill = e.result.killed;
        const txt = e.attack.combo ? e.attack.combo.name + ' · ' + e.result.damage : String(e.result.damage);
        pop(txt, kill ? 'kill' : (e.attack.combo ? 'combo' : ''), d.x, d.y + 1.9, d.z);
      } else if (e.type === 'combo') {
        showToast('COMBO: ' + e.name + ' ×' + e.mult.toFixed(1));
      } else if (e.type === 'dummyDown') {
        showToast(e.dummy.name + ' derrotado');
      } else if (e.type === 'miss') {
        pop('¡falla!', '', player.x, (player.y || 0) + 1.9, player.z);
      }
    }
    if (events.length && panelOpen) renderPanel();
  }

  // --- API para la página -----------------------------------------------------------
  function pressAttack(f, side) {
    if (panelOpen) return false;
    B.syncPlayer(bench, player);
    const r = B.pressAttack(bench, f, side);
    watchSwing();
    return r.started;
  }

  // Beber una poción (teclas 1/2/3 o botón de la página). Devuelve { ok, msg }.
  function drink(kind) {
    const r = B.usePotion(bench, kind);
    showToast(r.ok ? 'Bebiste: ' + r.msg : r.msg);
    if (r.ok) { persist(); emit({ type: 'drink', kind }); if (panelOpen) renderPanel(); }
    return r;
  }

  // Guardia: mantener = bloquear (reduce el daño frontal a cambio de energía). Devuelve si quedó activa.
  function setBlock(on) {
    if (panelOpen) on = false;
    C.setBlocking(bench.fighter, on);
    return bench.fighter.blocking;
  }

  // Botín desde el código (cofres, enemigos, misiones): give({ weapon:['hacha'], armor:{ casco:['malla'] }, potions:{ vida:2 }, items:{ comida:1 } })
  function give(loot) {
    const got = I.give(inv, loot);
    if (got.length) { showToast('Obtuviste: ' + got.join(', ')); persist(); if (panelOpen) renderPanel(); }
    return got;
  }

  function update(dt) {
    if (getFlags) {
      const got = I.syncFlags(inv, getFlags());
      if (got.length) { showToast('Obtuviste: ' + got.join(', ')); persist(); if (panelOpen) renderPanel(); }
    }
    B.syncPlayer(bench, player);
    if (bench.fighter.blocking && bench.fighter.stamina <= 0) bench.fighter.blocking = false;
    handleEvents(B.update(bench, dt));
    watchSwing();

    // Muñeco: posición, golpe recibido, derrota.
    const d = bench.dummies[0];
    if (d && dummyMesh) {
      dummyMesh.position.set(d.x, d.y, d.z);
      dummyMesh.rotation.z = d.hurtT > 0 ? Math.sin(d.hurtT * 60) * 0.18 * (d.hurtT / 0.3) : 0;
      dummyMesh.rotation.x = d.dead ? -Math.min(1, d.deadT / 0.35) * 1.4 : 0;
      const s = toScreen(d.x, d.y + 2.05, d.z);
      if (s && !d.dead) {
        dbar.style.display = 'block'; dbar.style.left = s.x + 'px'; dbar.style.top = s.y + 'px';
        dbarFill.style.width = Math.max(0, d.hp / d.maxHp * 100) + '%';
      } else dbar.style.display = 'none';
    }

    // Barras del jugador.
    const f = bench.fighter;
    hpFill.style.width = Math.max(0, f.hp / f.maxHp * 100) + '%';
    stFill.style.width = Math.max(0, f.stamina / C.MAX_STAMINA * 100) + '%';
    const p = bench.potions;
    hudTxt.textContent = C.WEAPONS[bench.equip.weapon].name.toUpperCase() + (f.blocking ? ' · GUARDIA' : '') + (f.fury > 0 ? ' · FURIA' : '') + ' · V' + p.vida + ' E' + p.energia + ' F' + p.furia;

    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.opacity = '0'; }
  }

  return { pressAttack, setBlock, drink, toast: showToast, update, give, bench, inventory: inv, setPanel, get panelOpen() { return panelOpen; } };
}
