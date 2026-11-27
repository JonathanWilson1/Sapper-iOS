// SAPPER — main.js
// Title art, the main loop, the test hook and start-up.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- title art: pixel text, rusted
(function drawTitle() {
  const t = $('title'),
    sc = document.createElement('canvas');
  sc.width = 96;
  sc.height = 22;
  const c = sc.getContext('2d');
  c.font = '900 19px ui-monospace,Menlo,"Courier New",monospace';
  c.textBaseline = 'top';
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.fillText('SAPPER', 48, 2);
  const d = c.getImageData(0, 0, 96, 22).data;
  t.width = 96;
  t.height = 26;
  const tc = t.getContext('2d');
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 96; x++)
      if (d[(y * 96 + x) * 4 + 3] > 110) {
        tc.fillStyle = '#000';
        tc.fillRect(x + 1, y + 2, 1, 1);
      }
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 96; x++)
      if (d[(y * 96 + x) * 4 + 3] > 110) {
        const n = hash2(x, y, 7);
        const k = y / 22;
        const r = 200 - k * 90 + n * 30,
          gg = 150 - k * 90 + n * 20,
          b = 70 - k * 40;
        tc.fillStyle = n < 0.07 ? '#3a2416' : `rgb(${r | 0},${gg | 0},${b | 0})`;
        tc.fillRect(x, y, 1, 1);
      }
})();

// ---------- main loop
let last = performance.now(),
  acc = 0,
  frameN = 0;
function update() {
  stepSim();
  if (tick % 10 === 0) computeSupport();
  if (tick % 6 === 0) processRockChecks();
  updateBodies();
  updateShells();
  updateSoldiers();
  updateMachines();
  updateParticles();
  updateGens();
  updateDrills();
  updateRooms();
  updateMedics();
  updateDoors();
  updateDiggers();
  netTick();
  if (state === 'play') {
    game.t += 1 / 60;
    applyDig();
    updateDirector();
  } else if (state === 'menu') {
    game.t += 1 / 60;
    updateDemo();
    if (tick - demoStart > 60 * 75) startDemo();
  } else if (state === 'dying') game.t += 1 / 60;
  shake *= 0.88;
  if (shake < 0.2) shake = 0;
}
// A bug in one frame shouldn't freeze the game: report it once, keep the loop running.
function frame(now) {
  requestAnimationFrame(frame);
  try {
    frameBody(now);
  } catch (err) {
    console.error(err);
    if (!frame.reported) {
      frame.reported = true;
      toast('Something went wrong — if the game misbehaves, go back to the menu');
    }
  }
}
function frameBody(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state === 'spectate') {
    /* only watching rivals */
  }
  if (state === 'play' || state === 'menu' || state === 'dying') {
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 3) {
      update();
      acc -= 1 / 60;
      n++;
    }
    if (n === 3) acc = 0;
  }
  if (state === 'menu') {
    const g0 = gens[0] || { x: W / 2, y: 80, w: 0 };
    cam.x = Math.max(0, g0.x + g0.w / 2 - cv.width / scale / 2);
    const tgt = Math.max(
      -10,
      (g0.y + 20 - viewRows() * 0.55) * (0.5 - 0.5 * Math.cos((tick - demoStart) / 700))
    );
    cam.y += (tgt - cam.y) * 0.02;
  } else if (state === 'play' && pointers.size === 0) {
    cam.y += cam.vy;
    cam.x += cam.vx;
    cam.vy *= 0.92;
    cam.vx *= 0.92;
    if (Math.abs(cam.vy) < 0.01) cam.vy = 0;
    if (Math.abs(cam.vx) < 0.01) cam.vx = 0;
    clampCam();
  }
  if (gesture === 'pending' && pointers.size === 1 && performance.now() - pendingAt > 70) {
    gesture = drawMode ? 'draw' : 'dig';
    if (gesture === 'dig') {
      const p0 = [...pointers.values()][0],
        w0 = toWorld(p0.x, p0.y),
        x0 = Math.floor(w0.x),
        y0 = Math.floor(w0.y);
      markErase = inB(x0, y0) && !!mark[y0 * W + x0];
    }
  }
  if (gesture === 'draw') {
    const p = [...pointers.values()][0];
    if (p) {
      drawAt = toWorld(p.x, p.y);
      paintConcrete(drawAt);
    }
  }
  if (gesture === 'dig') {
    const p = [...pointers.values()][0];
    if (p) digAt = toWorld(p.x, p.y);
  }
  capThis = (state === 'play' || state === 'dying') && now - lastCapAt >= 120; // a steady ~8 fps whatever the screen's refresh rate; these frames skip text labels
  render();
  if (capThis) {
    lastCapAt = now;
    captureFrame();
  }
  if (state === 'play' && net.on && frameN % 20 === 0) refreshTabs();
  if (state === 'play') {
    updateHUD();
    if (++frameN % 12 === 0) renderMini();
  }
}
window.__sapper = {
  queueRock: queueRockCheck,
  fast(n) {
    for (let k = 0; k < n; k++) update();
  },
  get soldiers() {
    return soldiers;
  },
  get state() {
    return state;
  },
  game,
  get gens() {
    return gens;
  },
  net,
  netTick,
  onNet,
  rleEncode,
  rleDecode,
  get doors() {
    return doors;
  },
  get sites() {
    return sites;
  },
  get diggers() {
    return diggers;
  },
  mark,
  get rooms() {
    return rooms;
  },
  spawnTunneller,
  get secretCount() {
    return secret.reduce((a, v) => a + v, 0);
  },
  get daily() {
    return game.daily;
  },
  tut,
  up,
  get shareText() {
    return shareText;
  },
  get gifBlob() {
    return gifBlob;
  },
  get drills() {
    return drills;
  },
  pressDrill,
  g,
  startGame,
  place,
  spawnShell,
  spawnSoldier,
  explode,
  get gold() {
    return gold;
  },
  set gold(v) {
    gold = v;
  },
  cam,
  get tick() {
    return tick;
  },
};
$('buildStat').textContent =
  'BUILD ' + (BUILD === 'dev' ? 'DEV' : BUILD.slice(4, 8) + '-' + BUILD.slice(8, 12));
if (/[?&]debug\b/.test(location.search)) localStorage.setItem('sapper.debug', '1');
show('debugBtn', localStorage.getItem('sapper.debug') === '1');
updateBest();
startDemo();
resize();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:')
  navigator.serviceWorker.register('sw.js').catch(() => {});
// Home-screen apps on iOS resume instead of reloading, so look for a newer build whenever the game comes back to the front
async function checkForUpdate() {
  if (location.protocol !== 'https:' || !navigator.onLine) return;
  try {
    const txt = await (await fetch('./js/core.js', { cache: 'no-store' })).text(); // the build id lives in core.js
    const m = txt.match(/const BUILD = '([^']+)'/);
    if (!m || m[1] === BUILD) return;
    if (state === 'menu' || state === 'over') location.reload();
    else {
      checkForUpdate.pending = true;
      toast('New version ready — it loads when you return to the menu');
    }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkForUpdate();
});
setTimeout(checkForUpdate, 3000);
