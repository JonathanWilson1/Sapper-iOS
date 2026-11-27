// SAPPER — render.js
// Camera, the world renderer and lighting, entity drawing, overlays, the minimap.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- camera
const cam = { x: 0, y: 0, vx: 0, vy: 0, zoom: 1 };
const cv = document.getElementById('c'),
  ctx = cv.getContext('2d');
let dpr = 1,
  scale = 4,
  trayPx = 0;
function viewRows() {
  return cv.height / scale;
}
function clampCam() {
  const max = H - (cv.height - trayPx) / scale + 2;
  cam.y = Math.max(-14, Math.min(max, cam.y));
  cam.x = Math.max(0, Math.min(W - cv.width / scale, cam.x));
}
function zoomAt(z, ax, ay) {
  z = Math.max(ZMIN, Math.min(3.5, z));
  const wx = cam.x + (ax * dpr) / scale,
    wy = cam.y + (ay * dpr) / scale;
  cam.zoom = z;
  scale = (cv.width / VIEWW) * z;
  cam.x = wx - (ax * dpr) / scale;
  cam.y = wy - (ay * dpr) / scale;
  clampCam();
}
function resize() {
  dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  scale = (cv.width / VIEWW) * cam.zoom;
  const tray = !$('tray').hidden ? $('tray') : !$('atkTray').hidden ? $('atkTray') : null;
  trayPx = tray ? tray.offsetHeight * dpr : 0;
  clampCam();
}
addEventListener('resize', resize);

// ---------- rendering
const off = document.createElement('canvas'),
  octx = off.getContext('2d');
let img = null,
  buf = null,
  light = null;
function addLight(lx, ly, rad, inten, y0, rows) {
  const r2 = rad * rad;
  for (let y = Math.max(y0, Math.floor(ly - rad)); y <= Math.min(y0 + rows - 1, ly + rad); y++) {
    const rr = (y - y0) * W,
      dy = (y - ly) * (y - ly);
    for (let x = Math.max(0, Math.floor(lx - rad)); x <= Math.min(W - 1, lx + rad); x++) {
      const f = 1 - ((x - lx) * (x - lx) + dy) / r2;
      if (f > 0) light[rr + x] += f * f * inten;
    }
  }
}
function render() {
  if (net.on && net.started && net.view !== 'me') {
    renderRival();
    return;
  }
  renderWorld();
}
function renderWorld() {
  const s = scale,
    rows = Math.ceil(cv.height / s) + 2;
  if (!img || img.height !== rows) {
    off.width = W;
    off.height = rows;
    img = octx.createImageData(W, rows);
    buf = new Uint32Array(img.data.buffer);
    light = new Float32Array(W * rows);
  }
  const y0 = Math.floor(cam.y);
  light.fill(0);
  // light sources
  let fires = 0;
  for (let y = Math.max(0, y0 - 14); y < Math.min(H, y0 + rows + 14); y++)
    for (let x = 0; x < W; x++) {
      const t = g[y * W + x];
      if (t === LAMP) addLight(x + 0.5, y + 0.5, 13, 0.6, y0, rows);
      else if (t === FIRE && fires < 160 && ((x + y) & 1) === 0) {
        fires++;
        addLight(x + 0.5, y + 0.5, 6, 0.35 + rand() * 0.15, y0, rows);
      }
    }
  for (const gn of gens) addLight(gn.x + gn.w / 2, gn.y + 3, 20, 0.9, y0, rows);
  for (const f of flashes) addLight(f.x, f.y, f.r, (1.8 * f.life) / f.max, y0, rows);
  for (const f of flares) addLight(f.x, f.y, 46, 0.55, y0, rows);
  for (const m of mgs) if (m.flash) addLight(m.x + 2.5, m.y, 10, 0.8, y0, rows);
  for (const d of diggers) if (!d.down) addLight(d.fx + 0.5, d.fy - 3, 8, 0.4, y0, rows); // helmet lamps
  for (const m of medics) addLight(m.fx + 0.5, m.fy - 3, 6, 0.3, y0, rows);
  for (const sh2 of shells) if (isMet(sh2.kind)) addLight(sh2.x, sh2.y, 16, 1.2, y0, rows);
  const tk = tick;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r,
      rr = r * W;
    const amb = y < SKY + 6 ? 0.78 : Math.max(0.34, 0.66 - (y - SKY - 6) * 0.0016); // gets darker with depth, but never too dark to read
    for (let x = 0; x < W; x++) {
      let R,
        G,
        B,
        L = light[rr + x],
        lit;
      if (y < 0 || y >= H) {
        if (y < 0) {
          const si = x;
          R = skyR[si];
          G = skyG[si];
          B = skyB[si];
        } else {
          R = G = B = 0;
        }
        lit = 1 + L;
      } else {
        const i = y * W + x,
          t = g[i],
          v = sh[i] & 7;
        if (t === E && secret[i]) {
          R = palR[SOIL * 8 + v];
          G = palG[SOIL * 8 + v];
          B = palB[SOIL * 8 + v];
          lit = amb + L;
        } else if (t === E) {
          const w = bgc[i];
          if (ladder[i]) {
            const rung = ladder[i] === 2;
            R = rung ? 112 : 132;
            G = rung ? 80 : 94;
            B = rung ? 46 : 54;
            lit = amb + L;
          } else if (prop[i]) {
            const pv = (x * 3 + y) % 7 === 0;
            R = palR[TIMBER * 8 + v] - (pv ? 22 : 0);
            G = palG[TIMBER * 8 + v] - (pv ? 18 : 0);
            B = palB[TIMBER * 8 + v] - (pv ? 12 : 0);
            lit = amb + L;
          } else if (w === 0) {
            const si = Math.min(y, SKYROWS - 1) * W + x;
            R = skyR[si];
            G = skyG[si];
            B = skyB[si];
            lit = 1 + L * 0.6;
          } else {
            const c = WALL[w],
              o = (v - 3.5) * 1.6;
            R = c[0] + o;
            G = c[1] + o;
            B = c[2] + o;
            lit = amb * 0.7 + L;
          }
        } else if (t === FIRE) {
          const f = (sh[i] + tk * 7) & 31;
          R = 255;
          G = 90 + f * 4;
          B = 20 + (f > 24 ? 80 : 0);
          lit = 1;
        } else if (t === WATER) {
          const sv = ((sh[i] >> 3) + (tk >> 3)) & 7;
          R = palR[WATER * 8 + sv];
          G = palG[WATER * 8 + sv];
          B = palB[WATER * 8 + sv];
          if (y > 0 && g[i - W] === E) {
            R += 30;
            G += 40;
            B += 40;
          }
          if (prop[i]) {
            R = (R + palR[TIMBER * 8 + v]) / 2;
            G = (G + palG[TIMBER * 8 + v]) / 2;
            B = (B + palB[TIMBER * 8 + v]) / 2;
          }
          lit = amb + L;
        } else if (t === LAMP) {
          R = 255;
          G = 226;
          B = 150;
          lit = 1.2;
        } else {
          R = palR[t * 8 + v];
          G = palG[t * 8 + v];
          B = palB[t * 8 + v];
          lit = amb + L;
          if (mark[i]) {
            const hatch = ((x + y + (tk >> 3)) & 3) === 0;
            R = R * 0.55 + (hatch ? 150 : 95);
            G = G * 0.55 + (hatch ? 120 : 75);
            B = B * 0.55 + 20;
            lit = Math.max(lit, 0.75);
          }
          if (t === GOLD) {
            lit = Math.max(lit, 0.55);
            if ((sh[i] * 7 + (tk >> 2)) % 97 === 0) {
              R = G = 255;
              B = 220;
            }
          } else if (t === BAGS) {
            if (((x + ((y & 1) << 1)) & 3) === 0) {
              R -= 28;
              G -= 26;
              B -= 20;
            }
          } else if (t === TIMBER) {
            if ((x * 3 + y) % 7 === 0) {
              R -= 22;
              G -= 18;
              B -= 12;
            }
          } else if (t === DOOR) {
            if ((x + y) % 3 === 0) {
              R += 40;
              G += 40;
              B += 40;
            }
            if (y > 0 && g[i - W] !== DOOR) {
              R -= 20;
              G -= 20;
              B -= 20;
            }
            lit = Math.max(lit, 0.5);
          } else if (t === DRILL) {
            if (((x + y) & 3) === 0) {
              R = 170;
              G = 140;
              B = 40;
            }
          } else if (t === CONC) {
            if ((x + y * 5) % 11 === 0) {
              R -= 16;
              G -= 16;
              B -= 16;
            }
          } else if (t === GRASS && y > 0 && g[i - W] === E && v & 1) {
            R += 18;
            G += 22;
          } else if (t === HQ) {
            const gn = genAt(x, y);
            if (gn && gn.hit > 0) R += 60;
          }
          if (y > 0 && !SOLID[g[i - W]] && t !== GRASS) {
            R += 10;
            G += 8;
            B += 6;
          } // top edge highlight
        }
      }
      if (lit > 1.7) lit = 1.7;
      if (y > SKY + 60) {
        const gl = Math.min(1, (y - SKY - 60) / 260);
        G += gl * 18 * (1 + Math.sin(x * 0.3 + y * 0.2 + tick * 0.03) * 0.3);
        R -= gl * 6;
      }
      R = R * lit + L * 22;
      G = G * lit + L * 10;
      B = B * lit * 0.9;
      buf[rr + x] =
        0xff000000 |
        ((B > 255 ? 255 : B < 0 ? 0 : B) << 16) |
        ((G > 255 ? 255 : G < 0 ? 0 : G) << 8) |
        (R > 255 ? 255 : R < 0 ? 0 : R);
    }
  }
  octx.putImageData(img, 0, 0);
  const sx = shake ? (rand() - 0.5) * shake * dpr : 0,
    sy = shake ? (rand() - 0.5) * shake * dpr : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const oy = -(cam.y - y0) * s + sy;
  ctx.drawImage(off, 0, 0, W, rows, sx - cam.x * s, oy, W * s, rows * s);
  ctx.save();
  ctx.translate(sx - cam.x * s, sy - cam.y * s);
  drawEntities(s);
  ctx.restore();
  drawOverlayUI(s);
  if (!capThis) drawLoupe();
}
function px(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.floor(x * scale), Math.floor(y * scale), Math.ceil(w * scale), Math.ceil(h * scale));
}
// dug-earth back wall, a shade darker than the tunnels: rooms are just widened bits of the tunnel system
function earthWall(x0, y0, w, h, hurt) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const v = inB(x, y) ? sh[y * W + x] & 7 : 3,
        o = (v - 3.5) * 2.2;
      ctx.fillStyle = hurt
        ? `rgb(${(60 + o) | 0},${(26 + o) | 0},${(18 + o) | 0})`
        : `rgb(${(30 + o) | 0},${(21 + o) | 0},${(15 + o) | 0})`;
      ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
    }
}
function drawEntities(s) {
  // generators: a timber-framed engine room with the dynamo inside
  for (const gn of gens) {
    const { x, y, w, h } = gn,
      fl = y + h - 1,
      hurt = gn.hit > 0;
    earthWall(x, y, w, h, hurt); // bare earth behind it
    px(x, y, w, 1, '#7a5531');
    px(x, y, 1, h, '#7a5531');
    px(x + w - 1, y, 1, h, '#7a5531'); // timber frame
    px(x + 1, y + 1, 0.6, 0.6, '#5a3e22');
    px(x + w - 1.6, y + 1, 0.6, 0.6, '#5a3e22'); // braces
    px(x, fl, w, 1, '#1c1712'); // floor
    px(x + w / 2 - 0.3, y + 1, 0.6, 0.6, (tick >> 5) % 9 ? '#ffe196' : '#c8a860'); // lamp
    px(x + 2, y + 2, 8, h - 3, '#3a4436');
    px(x + 2, y + 2, 8, 0.5, '#55604a'); // engine block
    const a = tick * (gn.oc ? 0.3 : 0.15),
      cx = x + 4.5,
      cy = y + 4;
    px(cx - 1.8, cy - 1.8, 3.6, 3.6, '#1a1e18');
    for (let k = 0; k < 4; k++)
      px(
        cx + Math.cos(a + k * 1.57) * 1.3 - 0.3,
        cy + Math.sin(a + k * 1.57) * 1.3 - 0.3,
        0.7,
        0.7,
        '#a9b39a'
      ); // flywheel
    for (let k = 0; k < 3; k++)
      px(x + 7 + k * 0.9, y + 3, 0.6, 0.6, (tick >> 4) % 3 === k ? '#ffe9a8' : '#7a6a3a'); // gauges
    px(
      x + 7,
      y + 4.4,
      2.6,
      0.6,
      gn.oc
        ? (tick >> 2) & 1
          ? '#ffb040'
          : '#ff6020'
        : gn.hp / gn.max < 0.35
          ? (tick >> 3) & 1
            ? '#e04a30'
            : '#5a1a10'
          : '#6f8a4a'
    );
    px(x + 11, y + 3, 1.2, h - 4, '#4a4a50');
    px(x + 11.2, y + 2.4, 0.8, 0.6, '#c8a040'); // fuel drum
    px(x + w - 3, y - 3, 1, 4, '#3a3630'); // exhaust up through the beam
    if (state === 'play' && !capThis) {
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(Math.max(14 * dpr, s * 3))}px ui-monospace,Menlo,monospace`;
      const t = gn.oc
        ? `⚡ ${Math.ceil(gn.oc / 60)}s`
        : gn.cool
          ? `${Math.ceil(gn.cool / 60)}s`
          : learned.oc
            ? ''
            : 'TAP ⚡'; // hint vanishes once you've used it
      ctx.fillStyle = '#000a';
      ctx.fillText(t, (x + w / 2) * s + 1, (y - 5) * s + 1);
      ctx.fillStyle = gn.oc ? '#ffb040' : gn.cool ? '#8a8a80' : '#f0d68a';
      ctx.fillText(t, (x + w / 2) * s, (y - 5) * s);
    }
    if (state !== 'over' && tick % 9 === 0)
      particles.push({ x: x + w - 2.5, y: y - 3, vx: 0.02, vy: -0.06, life: 120, max: 120, k: 'smoke' });
    if (gn.hit > 0) gn.hit--;
  }
  // rooms: lit interiors with little people at work
  for (const r of rooms) {
    const { x, y, w, h } = r,
      fl = y + h - 1;
    earthWall(x, y, w, h, false);
    px(x, fl, w, 1, '#1c1712'); // bare earth walls, trodden floor
    px(x + w / 2, y + 1, 1, 1, (tick >> 5) % 9 ? '#ffe196' : '#c8a860'); // hanging lamp
    if (r.kind === 'miners') {
      for (let k = 0; k < 2; k++) {
        px(x + 2, y + 2 + k * 2, 5, 0.7, '#6a5032');
        px(x + 2, y + 1.5 + k * 2, 5, 0.5, '#a89a78');
      }
      for (let k = 0; k < 3; k++) {
        px(x + w - 3 - k * 1.6, y + 2, 0.4, 3, '#6a5030');
        px(x + w - 3.6 - k * 1.6, y + 2, 1.6, 0.5, '#b0b4b8');
      }
      px(x + 8, fl - 1, 2, 1, '#4a4a50');
      const crew = diggers.filter(d => d.hut === r).length;
      for (let k = 0; k < DIGGERS_PER_HUT; k++)
        px(x + 8 + k * 1.1, y + 1.4, 0.7, 0.7, k < crew ? '#9fd07a' : '#5a2a20');
      continue;
    }
    if (!r.people)
      r.people = [0, 1, 2].map(k => ({ x: 2 + k * 5, dir: k % 2 ? -1 : 1, wait: k * 40, carry: false }));
    if (r.kind === 'listen') {
      px(x + 2, fl - 2, 6, 0.6, '#6a5032');
      px(x + 2.5, fl - 1.4, 0.4, 1.4, '#4a3a26');
      px(x + 7, fl - 1.4, 0.4, 1.4, '#4a3a26'); // desk
      px(x + 4, fl - 3, 2, 1, '#3a3834');
      px(x + 4.5, fl - 3.6, 1, 0.6, '#9a8a60'); // geophone set
      px(x + 9, fl - 3, 1, 1, '#c8a07a');
      px(x + 8.8, fl - 3.3, 1.4, 0.4, '#2a2826');
      px(x + 9, fl - 2, 1, 2, '#6b6a3e'); // operator with headphones
      for (let k = 0; k < 3; k++)
        px(x + 12 + k * 0.8, y + 3 + (((tick >> 3) + k) % 3) * 0.3, 0.5, 2 - k * 0.4, '#7ee06a'); // trace on the scope
      if (soldiers.some(s2 => s2.tun && s2.revealed) && (tick >> 3) & 1)
        px(x + w - 3, y + 2, 1, 1, '#ff4030');
    } else if (r.kind === 'hospital') {
      px(x + 2, y + 1.5, 3, 1.6, '#d8d0bc');
      px(x + 3, y + 1.6, 1, 1.4, '#b8302a');
      px(x + 2.6, y + 2, 1.8, 0.6, '#b8302a'); // red cross banner
      for (let k = 0; k < 3; k++) {
        const bx = x + 6 + k * 3.3;
        px(bx, fl - 1, 3, 1, '#d8d0bc');
        px(bx, fl, 0.6, 1, '#5a5040');
        px(bx + 2.4, fl, 0.6, 1, '#5a5040');
        px(bx + 0.2, fl - 1.6, 0.9, 0.8, '#c8a07a');
      } // beds + patients
    } else if (r.kind === 'mine') {
      px(x + 1, fl - 0.4, w - 2, 0.4, '#6a6a70'); // rails
      const a = tick * 0.08;
      px(x + 2, y + 1, 3, 3, '#3a3028');
      px(x + 3.5 + Math.cos(a) * 1.2 - 0.5, y + 2.5 + Math.sin(a) * 1.2 - 0.5, 1, 1, '#c9cdd2'); // winch wheel
      for (let k = 0; k < 5; k++)
        px(x + w - 3 + (k % 3) * 0.7, fl - 1 - (k > 2 ? 1 : 0), 0.8, 0.8, '#d4a62a'); // ore pile
    } else if (r.kind === 'magazine') {
      for (let k = 0; k < 4; k++) {
        const cx2 = x + w - 3 - k * 2.2,
          cy2 = fl - 2 - (k === 3 ? 2 : 0);
        px(cx2, cy2, 2, 2, '#6a5532');
        px(cx2, cy2, 2, 0.4, '#3a2e1c');
        px(cx2 + 0.7, cy2 + 0.8, 0.6, 0.6, '#b8302a');
      } // crates
      for (let k = 0; k < 4; k++) {
        px(x + 2 + k * 1.2, fl - 2, 0.8, 2, '#8a8a90');
        px(x + 2 + k * 1.2, fl - 2, 0.8, 0.6, '#c8a040');
      } // shells
    }
    // workers walk the room, stop for a moment at each end, then turn round
    for (const p of r.people) {
      if (p.wait > 0) p.wait--;
      else {
        p.x += p.dir * 0.05;
        if (p.x < 1.6 || p.x > w - 2.6) {
          p.dir *= -1;
          p.wait = 40 + ((rand() * 60) | 0);
          p.carry = !p.carry;
        }
      }
      const wx = x + p.x,
        step = (tick >> 3) & 1 && !p.wait,
        coat = r.kind === 'hospital' ? '#e8e2d0' : r.kind === 'mine' ? '#5a5040' : '#6b6a3e';
      px(wx, fl - 3, 1, 1, r.kind === 'mine' ? '#3a3a3a' : '#c8a07a');
      if (r.kind === 'mine') px(wx + (p.dir > 0 ? 0.6 : -0.2), fl - 3, 0.6, 0.5, '#ffe060'); // head / lamp helmet
      px(wx, fl - 2, 1, 1, coat);
      if (r.kind === 'hospital') px(wx + 0.3, fl - 1.9, 0.4, 0.4, '#b8302a');
      px(wx + (step ? 0.5 : 0), fl - 1, 0.5, 1, '#2a241c');
      px(wx + (step ? 0 : 0.5), fl - 1, 0.5, 1, '#3a3226');
      if (p.carry && r.kind === 'magazine') px(wx + (p.dir > 0 ? 0.8 : -0.8), fl - 2.4, 1, 1, '#6a5532');
      if (p.carry && r.kind === 'mine') {
        px(wx + (p.dir > 0 ? 1 : -2), fl - 1.6, 1.6, 1, '#4a4a50');
        px(wx + (p.dir > 0 ? 1.2 : -1.8), fl - 1.9, 1.2, 0.4, '#d4a62a');
      }
    }
  }
  // construction sites: scaffold outline, hatched plan and a progress bar
  for (const st of sites) {
    for (const c of st.cells) {
      ctx.fillStyle = (c[0] + c[1]) & 1 ? 'rgba(230,190,90,.30)' : 'rgba(230,190,90,.16)';
      ctx.fillRect(c[0] * s, c[1] * s, s, s);
    }
    ctx.strokeStyle = '#e6bf4acc';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.setLineDash([s, s]);
    ctx.strokeRect(st.x0 * s, st.y0 * s, (st.x1 - st.x0 + 1) * s, (st.y1 - st.y0 + 1) * s);
    ctx.setLineDash([]);
    const f = Math.min(1, st.work / st.need);
    px(st.x0, st.y0 - 1.6, st.x1 - st.x0 + 1, 0.8, '#1a1410');
    px(st.x0, st.y0 - 1.6, (st.x1 - st.x0 + 1) * f, 0.8, st.clear ? '#9fd07a' : '#e6bf4a');
    if (!st.clear && state === 'play' && !capThis) {
      ctx.font = `bold ${Math.round(Math.max(11 * dpr, s * 2.2))}px ui-monospace,Menlo,monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e6bf4a';
      ctx.fillText('DIGGING OUT', ((st.x0 + st.x1 + 1) / 2) * s, (st.y0 - 2.4) * s);
    }
  }
  // ghost for a room waiting to be placed
  if (roomPending && roomGhost) {
    const st = stampFor(roomPending, roomGhost.x, roomGhost.y, true);
    for (const c of st.cells) {
      ctx.fillStyle = st.ok ? 'rgba(120,220,120,.55)' : 'rgba(220,80,60,.55)';
      ctx.fillRect(c[0] * s, c[1] * s, s, s);
    }
    if (roomPending === 'gen' && st.cells.length) genLabel(st.cells[0], s);
    if (st.snapped && st.cells.length) {
      ctx.strokeStyle = '#9fd07a';
      ctx.lineWidth = Math.max(1, dpr);
      const c0 = st.cells[0],
        c1 = st.cells[st.cells.length - 1];
      ctx.strokeRect(c0[0] * s, c0[1] * s, (c1[0] - c0[0] + 1) * s, (c1[1] - c0[1] + 1) * s);
    }
  }
  // miners: slim figures in tin hats, about five cells tall
  for (const d of diggers)
    if (d.down && !d.carried && !d.healing) {
      const x = d.fx - 0.6,
        y = d.fy + 1;
      px(x, y - 0.8, 2.6, 0.8, '#7a6a42');
      px(x + 2.4, y - 1, 0.9, 0.9, '#c8a07a');
      px(x + 2.4, y - 1.2, 1, 0.4, '#5c5a36'); // lying flat
      if (rooms.some(r => r.kind === 'hospital') && (tick >> 4) & 1) {
        px(x + 1.1, y - 2.6, 0.4, 1.2, '#e04040');
        px(x + 0.7, y - 2.2, 1.2, 0.4, '#e04040');
      }
    }
  for (const m of medics) {
    if (g[m.y * W + m.x] === ROOM && !m.path.length && !m.body) continue; // resting inside the hospital
    const x = m.fx,
      y = m.fy + 1,
      st = m.path.length ? (m.anim | 0) & 1 : 0;
    px(x + 0.2, y - 4.5, 0.9, 0.8, '#c8a07a');
    px(x - 0.1, y - 5, 1.5, 0.5, '#e8e2d0');
    px(x + 0.1, y - 3.7, 1.1, 1.9, '#e8e2d0');
    px(x + 0.45, y - 3.3, 0.4, 1, '#c03030');
    px(x + 0.25, y - 3, 0.8, 0.4, '#c03030');
    px(x + 0.15 + st * 0.25, y - 1.8, 0.45, 1.8, '#4a4a48');
    px(x + 0.7 - st * 0.25, y - 1.8, 0.45, 1.8, '#3a3a38');
    if (m.carrying) {
      px(x - 0.8, y - 6.1, 3, 0.8, '#7a6a42');
      px(x + 2, y - 6.3, 0.8, 0.8, '#c8a07a');
    } // casualty over the shoulders
  }
  for (const d of diggers) {
    if (d.down) continue;
    const inHut = g[d.y * W + d.x] === ROOM;
    if (inHut && !d.digging && !d.path.length) continue; // resting inside
    const climbing = !d.digging && d.path.length && Math.abs(d.fy - d.y) > 0.05 && Math.abs(d.fx - d.x) < 0.2;
    const x = d.fx,
      y = d.fy + 1,
      f = d.dir > 0,
      sw = d.digging ? (tick >> 2) & 1 : 0,
      st = !d.digging && d.path.length ? (d.anim | 0) & 1 : 0;
    px(x - 0.15, y - 5, 1.6, 0.5, '#5c5a36');
    px(x + 0.25, y - 5.3, 0.8, 0.4, '#5c5a36'); // tin hat
    px(x + 0.2, y - 4.5, 0.9, 0.8, '#c8a07a'); // face
    if (!climbing) px(x + (f ? 0.85 : 0.2), y - 4.3, 0.25, 0.25, '#2a2018'); // eye (back of the head when climbing)
    px(x + 0.1, y - 3.7, 1.1, 1.9, '#7a6a42');
    px(x + 0.1, y - 2.1, 1.1, 0.3, '#4a3e28'); // tunic, belt
    if (climbing) {
      const c = (d.anim | 0) & 1;
      px(x - 0.2, y - 3.6 + c * 0.5, 0.35, 0.9, '#7a6a42');
      px(x + 1.15, y - 3.1 - c * 0.5, 0.35, 0.9, '#7a6a42');
      px(x + 0.15, y - 1.8, 0.45, 1.8 - c * 0.4, '#4a3e28');
      px(x + 0.7, y - 1.8, 0.45, 1.4 + c * 0.4, '#3e3422');
      continue;
    }
    px(x + 0.15 + st * 0.25, y - 1.8, 0.45, 1.8, '#4a3e28');
    px(x + 0.7 - st * 0.25, y - 1.8, 0.45, 1.8, '#3e3422'); // legs
    const hx = f ? x + 1.2 : x - 0.45;
    px(hx, y - 3.8 + sw * 0.7, 0.35, 2, '#6a5030'); // pick shaft
    px(hx + (f ? -0.3 : -0.6), y - 4.1 + sw * 1.4, 1.2, 0.4, '#b0b4b8'); // pick head
  }
  for (const dr of doors)
    if (dr.open) {
      px(dr.x, dr.y - 1.5, 0.5, 2, '#7a7e84');
      px(dr.x + dr.w - 0.5, dr.y - 1.5, 0.5, 2, '#7a7e84');
    }
  // drills: rig, spinning bit, status
  ctx.textAlign = 'center';
  for (const d of drills) {
    px(d.x + 1, d.y - 3, 1, 3, '#3a3c40');
    px(d.x + DRILL_W - 2, d.y - 3, 1, 3, '#3a3c40');
    px(d.x, d.y - 3, DRILL_W, 1, '#5a5c60');
    const sp = d.rem ? ((d.spin || 0) >> 1) & 1 : 0;
    for (let c = 0; c < DRILL_W; c += 2) px(d.x + c + sp, d.y + 4, 1, 1, '#c9cdd2');
    if (state === 'play' && !capThis) {
      ctx.font = `bold ${Math.round(Math.max(14 * dpr, s * 3))}px ui-monospace,Menlo,monospace`;
      ctx.fillStyle = '#000a';
      const t = d.rem ? `▼${d.rem}` : learned.drill ? '' : `DRILL ◆${DRILL_COST}`;
      ctx.fillText(t, (d.x + DRILL_W / 2) * s + 1, (d.y - 4) * s + 1);
      ctx.fillStyle = d.rem ? '#9fd07a' : '#f0d68a';
      ctx.fillText(t, (d.x + DRILL_W / 2) * s, (d.y - 4) * s);
    }
  }
  for (const p of pumps) {
    px(p.x + 1, p.y, 2, 3, '#2a3440');
    const a = p.spin;
    px(p.x + 1.5 + Math.cos(a) * 0.8, p.y + 1 + Math.sin(a) * 0.8, 1, 1, '#9fb7c8');
  }
  for (const m of mgs) {
    const mx = m.x + 2.5,
      my = m.y - 0.2;
    for (let k = 0; k < 4; k++) px(mx + Math.cos(m.ang) * k, my + Math.sin(m.ang) * k, 1, 1, '#1d211b');
    if (m.flash) px(mx + Math.cos(m.ang) * 4.5 - 0.5, my + Math.sin(m.ang) * 4.5 - 0.5, 2, 2, '#ffd36a');
  }
  for (const sd of soldiers) {
    if (sd.tun) {
      if (!sd.revealed) continue;
      const x = Math.floor(sd.x),
        y = sd.y,
        sw = ((sd.anim * 4) | 0) & 1;
      px(x, y - 3, 2, 1, '#2c2a26');
      px(x, y - 2, 2, 1, '#45463c');
      px(x, y - 1, 2, 1, '#3c3d34');
      px(x, y, 2, 1, '#26251f');
      px(x + (sd.dir > 0 ? 2 : -1), y - 2 + sw, 1, 1, '#9a9a9a');
      if (sd.fuse) {
        px(x + (sd.dir > 0 ? -2 : 3), y, 1, 1, (tick >> 3) & 1 ? '#ff3020' : '#601010');
      }
      continue;
    }
    const x = Math.floor(sd.x),
      y = sd.y,
      walk = (sd.anim | 0) & 1;
    px(x, y - 3, 2, 1, '#3d4436');
    px(x, y - 2, 2, 1, '#5c6650');
    px(x + (sd.dir > 0 ? 1 : 0), y - 2, 1, 1, '#b8906a');
    px(x, y - 1, 2, 1, '#55604a');
    px(x + walk, y, 1, 1, '#2c3226');
    px(x + 1 - walk, y, 1, 1, '#3a4232');
    px(x + (sd.dir > 0 ? 2 : -1), y - 2 + (sd.atk ? 1 : 0), 1, 1, '#888');
  }
  for (const sh2 of shells) {
    if (sh2.kind === 'giant') {
      px(sh2.x - 3, sh2.y - 3, 7, 7, '#c0501e');
      px(sh2.x - 2, sh2.y - 2, 5, 5, '#ffd27a');
      px(sh2.x - 1, sh2.y - 1, 2, 2, '#fff');
    } else if (isMet(sh2.kind)) {
      px(sh2.x - 1, sh2.y - 1, 3, 3, '#ffd27a');
      px(sh2.x, sh2.y, 1, 1, '#fff');
    } else if (sh2.kind === 'driller') {
      px(sh2.x - 1, sh2.y - 3, 2, 3, '#4a4c52');
      px(sh2.x - 0.5 + (((sh2.spin || 0) >> 1) & 1) * 0.5, sh2.y, 1, 1, '#e6bf4a');
    } else if (sh2.kind === 'buster') {
      px(sh2.x - 0.5, sh2.y - 3, 2, 3, '#1e1c1a');
      px(sh2.x - 0.5, sh2.y, 2, 1, '#c0402a');
    } else {
      px(sh2.x, sh2.y - 1, 1, 2, '#2a2622');
    }
  }
  for (const t of tracers) {
    ctx.strokeStyle = '#ffd36acc';
    ctx.lineWidth = Math.max(1, scale * 0.35);
    ctx.beginPath();
    ctx.moveTo(t.x1 * s, t.y1 * s);
    ctx.lineTo(t.x2 * s, t.y2 * s);
    ctx.stroke();
  }
  for (const p of particles) {
    const a = p.life / p.max;
    if (p.k === 'smoke') {
      const sz = 1 + (1 - a) * 3;
      ctx.fillStyle = `rgba(40,36,32,${a * 0.45})`;
      ctx.fillRect((p.x - sz / 2) * s, (p.y - sz / 2) * s, sz * s, sz * s);
    } else if (p.k === 'spark') px(p.x, p.y, 1, 1, p.dirt ? '#5a4632' : a > 0.5 ? '#ffe08a' : '#e0642a');
    else if (p.k === 'rain') {
      ctx.fillStyle = '#8aa6c066';
      ctx.fillRect(p.x * s, p.y * s, Math.max(1, s * 0.3), s * 1.6);
    } else if (p.k === 'gib') px(p.x, p.y, 1, 1, '#5c6650');
    else if (p.k === 'glow') {
      ctx.fillStyle = `rgba(120,240,110,${a * 0.7})`;
      ctx.fillRect(p.x * s, p.y * s, Math.max(1, s * 0.6), Math.max(1, s * 0.6));
    } else px(p.x, p.y, 1, 1, p.t === SAND ? '#a88a58' : '#6a5440');
  }
  for (const f of flares) {
    px(f.x, f.y, 1, 1, '#fff6d0');
  }
  ctx.font = `bold ${Math.round(Math.max(14 * dpr, scale * 3.5))}px ui-monospace,Menlo,monospace`;
  ctx.textAlign = 'center';
  if (!capThis)
    for (const p of popups) {
      ctx.fillStyle = `rgba(240,200,80,${p.life / 60})`;
      ctx.fillText(p.txt, p.x * s, p.y * s);
    }
  // ghost
  const gh = ghost();
  if (drawAt && state === 'play') {
    ctx.strokeStyle = '#e8d6a0cc';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.arc(drawAt.x * s, drawAt.y * s, PAINT_R * s, 0, 6.29);
    ctx.stroke();
  }
  if (dragItem && dragItem.active && dragItem.id === 'concrete' && ghostPos) {
    ctx.strokeStyle = '#e8d6a0cc';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.arc(ghostPos.x * s, ghostPos.y * s, PAINT_R * s, 0, 6.29);
    ctx.stroke();
  }
  if (gh && !gh.cells.length && ghostPos) {
    ctx.strokeStyle = 'rgba(220,80,60,.8)';
    ctx.lineWidth = Math.max(1, dpr);
    const gx = Math.floor(ghostPos.x) * s,
      gy = Math.floor(ghostPos.y) * s;
    ctx.strokeRect(gx - 4 * s, gy - 4 * s, 9 * s, 9 * s);
    ctx.beginPath();
    ctx.moveTo(gx - 4 * s, gy - 4 * s);
    ctx.lineTo(gx + 5 * s, gy + 5 * s);
    ctx.moveTo(gx + 5 * s, gy - 4 * s);
    ctx.lineTo(gx - 4 * s, gy + 5 * s);
    ctx.stroke();
  }
  if (gh)
    for (const c of gh.cells) {
      ctx.fillStyle = !c.ok ? 'rgba(200,60,40,.35)' : gh.ok ? 'rgba(120,220,120,.55)' : 'rgba(220,80,60,.55)';
      ctx.fillRect(c[0] * s, c[1] * s, s, s);
    }
  if (gh && dragItem && dragItem.id === 'gen' && ghostPos) genLabel(gh.cells[0], s);
  if (tut.on && TUT[tut.i] && TUT[tut.i].mark) {
    const m = TUT[tut.i].mark();
    if (m) {
      const pr = 4 + Math.sin(tick * 0.15) * 1.5;
      ctx.strokeStyle = '#f0d68a';
      ctx.lineWidth = Math.max(2, dpr * 1.5);
      ctx.beginPath();
      ctx.arc(m.x * s, m.y * s, pr * s, 0, 6.29);
      ctx.stroke();
    }
  }
  if (digAt && state === 'play') {
    ctx.strokeStyle = '#e8d6a088';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.strokeRect((Math.floor(digAt.x) - 2) * s, (Math.floor(digAt.y) - 2) * s, 5 * s, 5 * s);
  }
}
function drawLoupe() {
  if (!(gesture === 'dig' || gesture === 'draw') || state !== 'play') return;
  const p = [...pointers.values()][0];
  if (!p) return;
  const R = 58 * dpr,
    Z = 2.4,
    fx = p.x * dpr,
    fy = p.y * dpr;
  let cx = Math.max(R + 6, Math.min(cv.width - R - 6, fx)),
    cy = fy - 120 * dpr;
  if (cy - R < 64 * dpr) cy = fy + 120 * dpr; // too close to the top: show it under the finger
  const src = (2 * R) / Z;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.29);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, fx - src / 2, fy - src / 2, src, src, cx - R, cy - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.strokeStyle = '#c8a24a';
  ctx.lineWidth = 3 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 6.29);
  ctx.stroke();
  ctx.strokeStyle = '#0008';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 2 * dpr, 0, 6.29);
  ctx.stroke();
}
function genLabel(c0, s) {
  const fw = ITEM.gen.w,
    fh = ITEM.gen.h;
  const n = crowd(c0[0] + fw / 2, c0[1] + fh / 2, null),
    r = genRate(c0[0] + fw / 2, c0[1] + fh) / (1 + n),
    lx = c0[0] + fw / 2,
    ly = c0[1] - 2;
  const gl = glowLoss(Math.max(0, c0[1] + GEN_H - surfOrig[Math.max(0, Math.min(W - 1, c0[0] + 7))]));
  ctx.textAlign = 'center'; // called inside the world-space transform
  if (gl > 0.05) {
    ctx.font = `bold ${Math.round(Math.max(13 * dpr, s * 3))}px ui-monospace,Menlo,monospace`;
    ctx.fillStyle = '#7ee06a';
    ctx.fillText(`GLOW −${Math.round(gl * 100)}%`, lx * s, (ly + GEN_H + 6) * s);
  }
  ctx.font = `bold ${Math.round(Math.max(15 * dpr, s * 3.5))}px ui-monospace,Menlo,monospace`;
  if (n) {
    ctx.fillStyle = '#e05a40';
    ctx.fillText(`CROWDED ÷${n + 1}`, lx * s, (ly - 4) * s);
  }
  ctx.fillStyle = '#000a';
  ctx.fillText(`+${Math.round(r * 60)} ◆/min`, lx * s + 1, ly * s + 1);
  ctx.fillStyle = '#f0d68a';
  ctx.fillText(`+${Math.round(r * 60)} ◆/min`, lx * s, ly * s);
}
function drawOverlayUI(s) {
  // incoming shell markers at the top edge
  if (state === 'play')
    for (const sh2 of shells)
      if (sh2.y < cam.y) {
        const x = (sh2.x - cam.x) * s;
        const y = 70 * dpr;
        ctx.fillStyle = (tick >> 2) & 1 ? '#e04a30' : '#ffb060';
        ctx.beginPath();
        ctx.moveTo(x - 5 * dpr, y);
        ctx.lineTo(x + 5 * dpr, y);
        ctx.lineTo(x, y + 7 * dpr);
        ctx.fill();
      }
}

// ---------- minimap
const mini = document.getElementById('mini'),
  mctx = mini.getContext('2d'),
  mimg = mctx.createImageData(W / 4, 110),
  mbuf = new Uint32Array(mimg.data.buffer);
function renderMini() {
  for (let my = 0; my < 110; my++)
    for (let mx = 0; mx < W / 4; mx++) {
      const t = g[(my * 4 + 1) * W + mx * 4 + 1];
      let R, G, B;
      if (t === E) {
        const w = bgc[(my * 4 + 1) * W + mx * 4 + 1];
        R = w ? 20 : 30;
        G = w ? 14 : 24;
        B = w ? 10 : 30;
      } else {
        R = palR[t * 8 + 3];
        G = palG[t * 8 + 3];
        B = palB[t * 8 + 3];
      }
      if (t === WATER) {
        R = 50;
        G = 110;
        B = 170;
      }
      mbuf[my * (W / 4) + mx] = 0xff000000 | (B << 16) | (G << 8) | R;
    }
  mctx.putImageData(mimg, 0, 0);
  mctx.fillStyle = '#e04a30';
  for (const gn of gens) mctx.fillRect(gn.x / 4, gn.y / 4, gn.w / 4, 2);
  mctx.fillStyle = '#6ff';
  for (const d of drills) mctx.fillRect(d.x / 4, d.y / 4, 2, 2);
  mctx.fillStyle = '#ff4';
  for (const s of soldiers) mctx.fillRect((s.x / 4) | 0, (s.y / 4 - 1) | 0, 1, 1);
  mctx.strokeStyle = '#e8d6a0';
  mctx.lineWidth = 1;
  mctx.strokeRect(
    cam.x / 4 + 0.5,
    cam.y / 4 + 0.5,
    cv.width / scale / 4 - 1,
    (cv.height - trayPx) / scale / 4
  );
}
