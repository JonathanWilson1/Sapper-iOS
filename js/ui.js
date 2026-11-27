// SAPPER — ui.js
// Synthesised sound, HUD and tray, touch/mouse input.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- sound (WebAudio, synthesized)
const sfx = {
  ctx: null,
  master: null,
  noise: null,
  on: localStorage.getItem('sapper.mute') !== '1',
  raining: false,
  rainNode: null,
  lastMg: 0,
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    const comp = c.createDynamicsCompressor();
    comp.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = this.on ? 0.7 : 0;
    this.master.connect(comp);
    const len = c.sampleRate * 2,
      b = c.createBuffer(1, len, c.sampleRate),
      d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.6 + last * 3;
    }
    this.noise = b;
    const drone = c.createBufferSource();
    drone.buffer = b;
    drone.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;
    const gd = c.createGain();
    gd.gain.value = 0.25;
    drone.connect(lp);
    lp.connect(gd);
    gd.connect(this.master);
    drone.start();
  },
  setOn(v) {
    this.on = v;
    localStorage.setItem('sapper.mute', v ? '0' : '1');
    if (this.master) this.master.gain.value = v ? 0.7 : 0;
  },
  nz(dur, type, freq, vol, q = 1) {
    const c = this.ctx;
    if (!c) return;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const gn = c.createGain();
    const t = c.currentTime;
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(gn);
    gn.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
    return f;
  },
  boom(r, vol) {
    const c = this.ctx;
    if (!c) return;
    const f = this.nz(0.4 + r * 0.06, 'lowpass', 300 + r * 40, Math.min(1, 0.25 + r * 0.05) * vol);
    if (f) f.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.5 + r * 0.05);
    const o = c.createOscillator(),
      gn = c.createGain(),
      t = c.currentTime;
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    gn.gain.setValueAtTime(0.5 * vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
  },
  whistle(low) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(),
      gn = c.createGain(),
      t = c.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(low ? 700 : 1500 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(low ? 160 : 420, t + 1.1);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(0.035, t + 0.3);
    gn.gain.linearRampToValueAtTime(0.0001, t + 1.15);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t);
    o.stop(t + 1.2);
  },
  mg() {
    if (!this.ctx || this.ctx.currentTime - this.lastMg < 0.07) return;
    this.lastMg = this.ctx.currentTime;
    this.nz(0.06, 'highpass', 900, 0.18);
  },
  dig() {
    this.nz(0.05, 'bandpass', 500 + Math.random() * 400, 0.08, 2);
  },
  coin() {
    const c = this.ctx;
    if (!c || Math.random() < 0.6) return;
    const o = c.createOscillator(),
      gn = c.createGain(),
      t = c.currentTime;
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1320, t + 0.05);
    gn.gain.setValueAtTime(0.03, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  },
  crumble() {
    if (!this.ctx || this.ctx.currentTime - (this.lastCr || 0) < 0.25) return;
    this.lastCr = this.ctx.currentTime;
    this.nz(0.35, 'lowpass', 220, 0.25);
  },
  tick() {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(),
      gn = c.createGain(),
      t = c.currentTime;
    o.type = 'square';
    o.frequency.value = 1800;
    gn.gain.setValueAtTime(0.04, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t);
    o.stop(t + 0.05);
  },
  thunk() {
    this.nz(0.12, 'lowpass', 400, 0.35);
  },
  deny() {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(),
      gn = c.createGain(),
      t = c.currentTime;
    o.type = 'square';
    o.frequency.value = 110;
    gn.gain.setValueAtTime(0.05, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(gn);
    gn.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  },
  rain(on) {
    const c = this.ctx;
    this.raining = on;
    if (!c) return;
    if (on && !this.rainNode) {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2500;
      f.Q.value = 0.4;
      const gn = c.createGain();
      gn.gain.value = 0.12;
      s.connect(f);
      f.connect(gn);
      gn.connect(this.master);
      s.start();
      this.rainNode = { s, gn };
    }
    if (!on && this.rainNode) {
      const n = this.rainNode;
      n.gn.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => n.s.stop(), 1100);
      this.rainNode = null;
    }
  },
};
function haptic(kind) {
  try {
    window.webkit.messageHandlers.haptic.postMessage(kind);
  } catch (e) {}
}

// ---------- UI
const $ = id => document.getElementById(id);
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.style.opacity = 0), 2600);
}
const ICONS = {
  room: ['...##...', '..####..', '.######.', '##.##.##', '##.##.##', '########', '##....##', '##....##'],
  upg: ['...#....', '..###...', '.#####..', '###.###.', '...#....', '...#....', '...#....', '........'],
  repair: ['........', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........'],
};
function drawIcon(cvs, id) {
  const c = cvs.getContext('2d');
  c.clearRect(0, 0, 16, 12);
  const mat = { prop: TIMBER, bags: BAGS, concrete: CONC, lamp: LAMP, pump: PUMP, mg: MG }[id];
  if (ICONS[id]) {
    c.fillStyle = id === 'upg' ? '#e6bf4a' : id === 'room' ? '#d8d0bc' : '#c0503a';
    ICONS[id].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') c.fillRect(x + 4, y + 2, 1, 1);
      })
    );
    return;
  }
  const col = (t, v) => `rgb(${palR[t * 8 + v]},${palG[t * 8 + v]},${palB[t * 8 + v]})`;
  if (id === 'prop') {
    for (let x = 2; x < 14; x++) {
      c.fillStyle = col(TIMBER, (x * 3) & 7);
      c.fillRect(x, 2, 1, 2);
    }
    for (let y = 4; y < 11; y++) {
      c.fillStyle = col(TIMBER, y & 7);
      c.fillRect(2, y, 1, 1);
      c.fillRect(13, y, 1, 1);
    }
  } else if (id === 'lamp') {
    c.fillStyle = '#555';
    c.fillRect(7, 0, 1, 5);
    c.fillStyle = '#ffe196';
    c.fillRect(6, 5, 3, 3);
    c.fillStyle = '#ffe19633';
    c.fillRect(3, 4, 9, 7);
  } else if (id === 'mg') {
    for (let y = 6; y < 11; y++)
      for (let x = 3; x < 13; x++) {
        c.fillStyle = col(BAGS, (x + y) & 7);
        c.fillRect(x, y, 1, 1);
      }
    c.fillStyle = '#1d211b';
    c.fillRect(7, 4, 6, 1);
    c.fillRect(6, 5, 3, 1);
  } else if (id === 'drill') {
    c.fillStyle = '#5a5c60';
    c.fillRect(5, 0, 6, 1);
    c.fillRect(7, 1, 2, 3);
    for (let y = 4; y < 9; y++)
      for (let x = 6; x < 10; x++) {
        c.fillStyle = (x + y) & 3 ? '#4e5056' : '#aa8c28';
        c.fillRect(x, y, 1, 1);
      }
    c.fillStyle = '#c9cdd2';
    c.fillRect(7, 9, 2, 1);
    c.fillRect(7.5, 10, 1, 2);
  } else if (id === 'gen') {
    for (let y = 4; y < 11; y++)
      for (let x = 1; x < 15; x++) {
        c.fillStyle = col(HQ, (x * y) & 7);
        c.fillRect(x, y, 1, 1);
      }
    c.fillStyle = '#232822';
    c.fillRect(3, 6, 4, 4);
    c.fillStyle = '#a9b39a';
    c.fillRect(4, 7, 2, 2);
    c.fillStyle = '#ffe9a8';
    c.fillRect(9, 6, 1, 1);
    c.fillRect(11, 6, 1, 1);
    c.fillStyle = '#2a2420';
    c.fillRect(12, 1, 2, 3);
  } else if (id === 'pump') {
    for (let y = 3; y < 10; y++)
      for (let x = 4; x < 12; x++) {
        c.fillStyle = col(PUMP, (x * y) & 7);
        c.fillRect(x, y, 1, 1);
      }
    c.fillStyle = '#9fb7c8';
    c.fillRect(7, 5, 2, 2);
    c.fillStyle = '#3a6a90';
    c.fillRect(12, 8, 3, 1);
  } else {
    const h = id === 'bags' ? 5 : 7;
    for (let y = 0; y < h; y++)
      for (let x = 1; x < 15; x++) {
        let v = (x * 5 + y * 3) & 7;
        c.fillStyle = col(mat, v);
        if (id === 'bags' && ((x + ((y & 1) << 1)) & 3) === 0) c.fillStyle = '#5a4c34';
        c.fillRect(x, 11 - h + y, 1, 1);
      }
  }
}
function buildTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  for (const it of ITEMS) {
    const el = document.createElement('div');
    el.className = 'item';
    el.dataset.id = it.id;
    const ic = document.createElement('canvas');
    ic.width = 16;
    ic.height = 12;
    drawIcon(ic, it.id);
    el.append(ic);
    const b = document.createElement('b');
    b.textContent = it.name;
    el.append(b);
    const i = document.createElement('i');
    i.textContent =
      it.kind === 'draw' ? 'DRAW' : it.id === 'upg' ? 'SHOP' : it.id === 'room' ? 'BUILD' : '◆' + it.cost;
    el.append(i);
    tray.append(el);
  }
}
function refreshTray() {
  for (const el of $('tray').children) {
    const it = ITEM[el.dataset.id];
    el.classList.toggle('poor', it.cost > gold);
    el.classList.toggle('sel', it.kind === 'draw' && drawMode);
  }
}
function updateHUD() {
  const t = Math.floor(game.t);
  $('timeStat').textContent =
    String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  $('goldStat').textContent = '◆ ' + gold;
  const tot = gens.reduce((a, gn) => a + Math.max(0, gn.hp), 0),
    mx = gens.reduce((a, gn) => a + gn.max, 0) || 1,
    weak = gens.reduce((a, gn) => Math.min(a, gn.hp / gn.max), 1);
  $('hqFill').style.width = (tot / mx) * 100 + '%';
  $('hqBar').classList.toggle('hurt', weak < 0.35);
  const rate = gens.reduce((a, gn) => a + genEff(gn), 0) * 60;
  $('hqText').textContent = `GEN ${gens.length} · ${Math.round(rate)}◆/m`;
  refreshTray();
}

// ---------- input
const pointers = new Map();
let roomGhost = null,
  drillTap = null,
  pendingAt = 0,
  gesture = null,
  ghostPos = null,
  dragItem = null,
  lastPan = 0,
  pinch = null;
function pinchState() {
  const ps = [...pointers.values()],
    a = ps[0],
    b = ps[1] || ps[0];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}
function toWorld(cx, cy) {
  return { x: cam.x + (cx * dpr) / scale, y: cam.y + (cy * dpr) / scale };
}
const PAINT_R = 1.6,
  PAINT_COST = 0.5; // ◆ per cell of drawn concrete
let drawMode = false,
  drawAt = null,
  paintLast = null,
  paintAcc = 0,
  paintN = 0;
function paintConcrete(p) {
  const from = paintLast || p,
    n = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 0.7));
  for (let k = 0; k <= n; k++) {
    const cx = from.x + ((p.x - from.x) * k) / n,
      cy = from.y + ((p.y - from.y) * k) / n;
    for (let y = Math.floor(cy - PAINT_R); y <= cy + PAINT_R; y++)
      for (let x = Math.floor(cx - PAINT_R); x <= cx + PAINT_R; x++) {
        if (!free(x, y) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > PAINT_R * PAINT_R) continue;
        if (paintAcc + PAINT_COST >= 1 && gold < 1) {
          if (!paintConcrete.warned) {
            paintConcrete.warned = true;
            toast('Out of gold');
            sfx.deny();
          }
          paintLast = p;
          return;
        }
        paintAcc += PAINT_COST;
        if (paintAcc >= 1) {
          paintAcc -= 1;
          gold -= 1;
        }
        setCell(x, y, CONC);
        game.concrete++;
        if (++paintN % 8 === 0) sfx.dig();
      }
  }
  paintLast = p;
}
function ghost() {
  if (state !== 'play' || !ghostPos || !dragItem || !dragItem.active || dragItem.id === 'concrete')
    return null;
  return stampFor(dragItem.id, ghostPos.x, ghostPos.y);
}
function canDigNear(w) {
  const R = 3.2;
  for (let y = Math.floor(w.y - R); y <= w.y + R; y++)
    for (let x = Math.floor(w.x - R); x <= w.x + R; x++) {
      if (!inB(x, y) || (x + 0.5 - w.x) ** 2 + (y + 0.5 - w.y) ** 2 > R * R) continue;
      const i = y * W + x;
      if (!DIGT[g[i]]) continue;
      if (
        (x > 0 && !SOLID[g[i - 1]]) ||
        (x < W - 1 && !SOLID[g[i + 1]]) ||
        (y > 0 && !SOLID[g[i - W]]) ||
        (y < H - 1 && !SOLID[g[i + W]])
      )
        return true;
    }
  return false;
}
const trayTop = () => innerHeight - $('tray').offsetHeight;
const roomGhostFrom = e => toWorld(e.clientX, e.clientY - (e.pointerType === 'touch' ? 80 : 0)); // rooms are big: float the preview well above the finger
function ghostFrom(e) {
  const off = e.pointerType === 'touch' ? 44 : 0;
  return toWorld(e.clientX, e.clientY - off);
}
const rivalView = () => net.on && net.started && net.view !== 'me';
let swipe = null;
cv.addEventListener('pointerdown', e => {
  if (
    rivalView() ||
    (net.on && net.started && (e.clientX < 26 || e.clientX > innerWidth - 26) && state === 'play')
  ) {
    swipe = {
      x: e.clientX,
      y: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      t: performance.now(),
      id: e.pointerId,
      edge: !rivalView(),
    };
    return;
  }
  if (state !== 'play') return;
  sfx.init();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  cam.vy = 0;
  cam.vx = 0;
  if (pointers.size >= 2) {
    gesture = 'pan2';
    digAt = null;
    drawAt = null;
    paintLast = null;
    pinch = pinchState();
    return;
  }
  const w = toWorld(e.clientX, e.clientY);
  if (roomPending) {
    gesture = 'room';
    roomGhost = roomGhostFrom(e);
    drillTap = { sx: e.clientX, sy: e.clientY };
    return;
  }
  const dr = drillAt(w);
  if (dr) {
    gesture = 'drill';
    drillTap = { d: dr, sx: e.clientX, sy: e.clientY };
    return;
  }
  const gt = genAt(Math.floor(w.x), Math.floor(w.y));
  if (gt) {
    gesture = 'gen';
    drillTap = { gn: gt, sx: e.clientX, sy: e.clientY };
    return;
  }
  gesture = 'pending';
  pendingAt = performance.now(); // becomes a dig unless a second finger lands quickly
});
addEventListener('pointermove', e => {
  if (swipe && e.pointerId === swipe.id) {
    if (!swipe.edge) {
      const dy = ((e.clientY - swipe.ly) * dpr) / (cv.width / VIEWW);
      net.rv.y -= dy;
      net.rv.vy = -dy;
    }
    swipe.lx = e.clientX;
    swipe.ly = e.clientY;
    return;
  }
  if (dragItem) {
    if (dragItem.noDrag || e.pointerId !== dragItem.pid) return;
    if (!dragItem.active && Math.hypot(e.clientX - dragItem.sx, e.clientY - dragItem.sy) > 5)
      dragItem.active = true;
    if (dragItem.active) {
      ghostPos = e.clientY < trayTop() - 4 ? ghostFrom(e) : null;
      if (dragItem.id === 'concrete') {
        if (ghostPos) paintConcrete(ghostPos);
        else paintLast = null;
      }
    }
    return;
  }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = ((e.clientX - p.x) * dpr) / scale,
    dy = ((e.clientY - p.y) * dpr) / scale;
  p.x = e.clientX;
  p.y = e.clientY;
  if (gesture === 'pan') {
    cam.x -= dx;
    cam.y -= dy;
    cam.vx = -dx;
    cam.vy = -dy;
    lastPan = performance.now();
    clampCam();
  } else if (gesture === 'pan2') {
    if (pointers.size < 2) {
      pinch = null;
      return;
    }
    const n = pinchState();
    if (pinch) {
      tut.moved += Math.abs(n.x - pinch.x) + Math.abs(n.y - pinch.y) + Math.abs(n.d - pinch.d);
      const wx = cam.x + (pinch.x * dpr) / scale,
        wy = cam.y + (pinch.y * dpr) / scale;
      cam.zoom = Math.max(ZMIN, Math.min(3.5, (cam.zoom * n.d) / pinch.d));
      scale = (cv.width / VIEWW) * cam.zoom;
      cam.x = wx - (n.x * dpr) / scale;
      cam.y = wy - (n.y * dpr) / scale;
      clampCam();
    }
    pinch = n;
  } else if (gesture === 'dig') digAt = toWorld(e.clientX, e.clientY);
  else if (gesture === 'room') roomGhost = roomGhostFrom(e);
});
function endPointer(e) {
  if (swipe && e.pointerId === swipe.id) {
    const dx = e.clientX - swipe.x,
      dy = e.clientY - swipe.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) pageStep(dx < 0 ? 1 : -1);
    swipe = null;
    return;
  }
  if (dragItem) {
    if (e.pointerId !== dragItem.pid) return;
    if (dragItem.active) {
      if (dragItem.id === 'concrete') {
        paintLast = null;
        paintConcrete.warned = false;
        if (paintN) haptic('light');
        paintN = 0;
      } else if (e.type === 'pointerup' && ghostPos) place(dragItem.id, ghostPos.x, ghostPos.y);
    } else if (e.type === 'pointerup') {
      const it = ITEM[dragItem.id];
      if (it.kind === 'action') doAction(it.id);
      else if (it.kind === 'draw') {
        drawMode = !drawMode;
        refreshTray();
        toast(
          drawMode
            ? 'CONCRETE ON — one finger draws walls. Tap it again to dig.'
            : 'CONCRETE OFF — one finger digs.'
        );
      } else toast(`Drag ${it.name} out of the tray and drop it`);
    }
    dragItem = null;
    ghostPos = null;
    return;
  }
  if (!pointers.has(e.pointerId)) return;
  if (
    (gesture === 'drill' || gesture === 'gen') &&
    pointers.size === 1 &&
    e.type === 'pointerup' &&
    drillTap
  ) {
    const p = pointers.get(e.pointerId);
    if (Math.hypot(p.x - drillTap.sx, p.y - drillTap.sy) < 16) {
      if (drillTap.d) pressDrill(drillTap.d);
      else overcharge(drillTap.gn);
    }
  }
  if (gesture === 'room' && pointers.size === 1 && e.type === 'pointerup' && roomGhost) {
    if (place(roomPending, roomGhost.x, roomGhost.y)) roomPending = null;
  }
  pointers.delete(e.pointerId);
  pinch = null;
  if (gesture === 'draw') {
    paintLast = null;
    paintConcrete.warned = false;
    drawAt = null;
    if (paintN) haptic('light');
    paintN = 0;
  }
  if (pointers.size === 0) {
    if (performance.now() - lastPan > 80) {
      cam.vy = 0;
      cam.vx = 0;
    }
    gesture = null;
    digAt = null;
  }
}
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
$('tray').addEventListener('pointerdown', e => {
  const el = e.target.closest('.item');
  if (!el || state !== 'play') return;
  e.preventDefault();
  if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  sfx.init();
  dragItem = { id: el.dataset.id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, active: false };
  if (ITEM[el.dataset.id].kind === 'action') dragItem.noDrag = true;
});
cv.addEventListener(
  'wheel',
  e => {
    if (state !== 'play') return;
    e.preventDefault();
    tut.moved += Math.abs(e.deltaY) / 4;
    if (e.ctrlKey) zoomAt(cam.zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    else {
      cam.x += ((e.deltaX * dpr) / scale) * 0.5;
      cam.y += ((e.deltaY * dpr) / scale) * 0.5;
      clampCam();
    }
  },
  { passive: false }
);
document.addEventListener(
  'touchmove',
  e => {
    if (!e.target.closest('.card')) e.preventDefault();
  },
  { passive: false }
);
document.addEventListener('gesturestart', e => e.preventDefault());
mini.addEventListener('pointerdown', e => {
  const r = mini.getBoundingClientRect();
  const jump = ev => {
    cam.y = ((ev.clientY - r.top) / r.height) * H - viewRows() / 2;
    cam.vy = 0;
    clampCam();
  };
  jump(e);
  const mv = ev => jump(ev),
    up = () => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
    };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
  e.stopPropagation();
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && state === 'play') pause();
  if (e.key === 'Escape' && state === 'paused') resume();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play') pause();
});
