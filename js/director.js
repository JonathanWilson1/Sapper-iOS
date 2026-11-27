// SAPPER — director.js
// Boot Camp tutorial and the attack director (which threat comes next, and when).
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- boot camp: a guided first game you can skip
const tut = { on: false, i: 0, t0: 0, moved: 0 };
const TUT = [
  {
    text: 'That machine is your <em>GENERATOR</em>. Protect it — if every generator is destroyed, you lose. Now use <em>two fingers</em> to scroll around and <em>pinch</em> to zoom. Take a look around your bunker.',
    done: () => tut.moved > 60,
  },
  {
    text: "<em>One finger marks earth to dig.</em> Drag over the earth by the ring — miners come out of the Miners' Hut and dig it for you.",
    done: () => game.dug >= 60,
    mark: () => ({ x: gens[0].x - 6, y: gens[0].y + GEN_H + 3 }),
  },
  {
    text: 'Bright yellow specks are <em>gold ore</em>. Mark the vein to the right of the chamber and let the miners bring it in.',
    done: () => game.mined >= 25,
    mark: () => ({ x: gens[0].x + 38, y: gens[0].y + 3 }),
  },
  {
    text: 'Wide tunnels cave in. Drag a <em>PROP</em> up out of the tray and drop it into your tunnel.',
    done: () => game.props >= 1,
  },
  {
    text: 'Tap the <em>DRILL</em> to bore 20 cells straight down for ◆10. It mines any ore it passes.',
    done: () => game.drillTaps >= 1,
    mark: () => drills[0] && { x: drills[0].x + 3, y: drills[0].y + 2 },
  },
  {
    text: 'Generators earn ◆. Tap <em>ROOM → GENERATOR</em> and tap open space 30+ cells from your first one. Your miners build it.',
    done: () => gens.length >= 2,
    start: () => {
      gold = Math.max(gold, 140);
    },
  },
  {
    text: 'Tap <em>CONCRETE</em> and draw a roof over a generator with one finger. Tap it again to go back to digging.',
    done: () => game.concrete >= 40,
    start: () => {
      gold = Math.max(gold, 60);
    },
  },
  {
    text: "Tap <em>UPGRADE</em> in the tray to see upgrades — better shovels, drill bits, dynamos. Close it when you're done.",
    done: () => tut.sawUpg,
  },
  {
    text: 'Here come the guns. Earth and concrete soak up the blasts — hold on!',
    done: () => game.t - tut.t0 > 14,
    start: () => {
      for (let k = 0; k < 6; k++) schedule(2 + k * 1.2, () => spawnShell('light', pickX()));
    },
  },
];
function startTutorialStep() {
  const st = TUT[tut.i];
  tut.t0 = game.t;
  if (st.start) st.start();
  $('tutStep').textContent = `BOOT CAMP ${tut.i + 1}/${TUT.length}`;
  $('tutText').innerHTML = st.text;
}
function updateTutorial() {
  for (let k = timers.length - 1; k >= 0; k--)
    if (game.t >= timers[k].at) {
      const f = timers[k].fn;
      timers.splice(k, 1);
      f();
    }
  if (tut.i < TUT.length && TUT[tut.i].done()) {
    sfx.coin();
    haptic('light');
    tut.i++;
    if (tut.i < TUT.length) startTutorialStep();
    else endTutorial(true);
  }
}
function endTutorial(done) {
  tut.on = false;
  show('tut', false);
  localStorage.setItem('sapper.tut', '1');
  if (done) {
    banner('BOOT CAMP COMPLETE', 'NOW HOLD THE LINE');
    gold += 50;
  }
  game.nextEvent = game.t + 40;
  game.harassAt = game.t + 60;
  game.tOffset = game.t;
}

// ---------- director: events over time
function schedule(delay, fn) {
  timers.push({ at: game.t + delay, fn });
}
function banner(title, sub) {
  const b = document.getElementById('banner');
  b.textContent = title;
  if (sub) {
    const sm = document.createElement('small');
    sm.textContent = sub;
    b.append(sm);
  }
  b.style.opacity = 1;
  clearTimeout(banner.t);
  banner.t = setTimeout(() => (b.style.opacity = 0), 2800);
}
// shells only land over the player's works: columns weighted by structures and dug-out space beneath them
let colW = null,
  colWTick = -1e9;
function columnWeights() {
  if (colW && tick - colWTick < 60) return colW;
  const raw = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = SKY; y < H; y++) {
      const i = y * W + x,
        t = g[i];
      if (t === HQ || t === ROOM) n += 3;
      else if (t === CONC || t === TIMBER || t === PUMP || t === MG || t === DRILL || t === LAMP || prop[i])
        n += 1;
      else if (t === E && y > surfOrig[x] + 2) n += 0.5;
    }
    raw[x] = n;
  }
  colW = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let a = 0;
    for (let k = -5; k <= 5; k++) {
      const xx = x + k;
      if (xx >= 0 && xx < W) a += raw[xx];
    }
    colW[x] = a;
  } // spread a little either side
  colWTick = tick;
  return colW;
}
function pickX() {
  const w = columnWeights();
  let tot = 0;
  for (let x = 0; x < W; x++) tot += w[x];
  if (tot <= 0) return 2 + rand() * (W - 4);
  let r = rand() * tot;
  for (let x = 0; x < W; x++) {
    r -= w[x];
    if (r <= 0) return x + rand();
  }
  return W / 2;
}
function maybeBuster() {
  let best = -1,
    bestN = 0;
  const cnt = [];
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = SKY; y < H; y++) if (g[y * W + x] === CONC) n++;
    cnt.push(n);
    if (n > bestN) bestN = n;
  }
  const cols = cnt.map((n, x) => (n === bestN ? x : -1)).filter(x => x >= 0);
  best = cols[cols.length >> 1]; // middle of the thickest slab
  if (bestN < 8) return; // only answers really thick concrete
  schedule(3 + rand() * 3, () => {
    banner('BUNKER BUSTER', "CONCRETE WON'T SAVE YOU");
    const sh = spawnShell('buster', best + 0.5);
    sh.vx = 0;
    sh.pen = 30 + bestN * 6;
  });
}
const EVENTS = [
  {
    id: 'barrage',
    w: 5,
    after: 0,
    run() {
      banner('ARTILLERY INBOUND', 'GET UNDER COVER');
      game.barrages++;
      const n = 6 + Math.round(game.intensity * 3);
      for (let k = 0; k < n; k++)
        schedule(2 + rand() * 6, () => spawnShell(rand() < 0.25 ? 'howitzer' : 'light', pickX()));
      maybeBuster();
    },
  },
  {
    id: 'heavy',
    w: 2,
    after: 150,
    run() {
      banner('HEAVY GUNS', 'DEEP PENETRATING SHELLS');
      game.barrages++;
      const n = 2 + Math.round(game.intensity);
      for (let k = 0; k < n; k++) schedule(2.5 + k * 1.6 + rand(), () => spawnShell('heavy', pickX()));
      maybeBuster();
    },
  },
  {
    id: 'rain',
    w: 2,
    after: 90,
    run() {
      banner('STORM FRONT', 'FLOODING LIKELY — PUMPS READY');
      rainUntil = game.t + 14 + game.intensity * 3;
      sfx.rain(true);
    },
  },
  {
    id: 'raid',
    w: 3,
    after: 110,
    run() {
      banner('ENEMY RAID', 'INFANTRY ADVANCING');
      game.raids++;
      const n = 2 + Math.round(game.intensity * 1.6);
      for (let k = 0; k < n; k++) schedule(2 + k * 1.4, () => spawnSoldier(rand() < 0.5 ? -1 : 1));
    },
  },
  {
    id: 'tremor',
    w: 1,
    after: 180,
    run() {
      banner('TREMOR', 'SHORE UP YOUR TUNNELS');
      schedule(2, tremor);
    },
  },
  {
    id: 'tunnel',
    w: 2,
    after: 150,
    run() {
      game.tunnels = (game.tunnels || 0) + 1;
      const heard = rooms.some(r => r.kind === 'listen');
      banner(
        'FAINT DIGGING',
        heard ? 'YOUR LISTENING POST IS ON IT' : 'BUILD A LISTENING POST (ROOM) TO FIND THEM'
      );
      const n = 1 + Math.floor(game.intensity / 2);
      for (let k = 0; k < n; k++) schedule(1 + k * 5, () => spawnTunneller(drand() < 0.5 ? -1 : 1));
    },
  },
  {
    id: 'meteor',
    w: 1,
    after: 240,
    run() {
      banner('SOMETHING IN THE SKY', 'METEOR STRIKE');
      schedule(2.5, () => spawnShell('meteor', pickX()));
    },
  },
];
function tremor() {
  shake = 16;
  sfx.boom(14, 0.6);
  haptic('heavy');
  for (let n = 0; n < 2500; n++) {
    const x = (rand() * W) | 0,
      y = SKY + ((rand() * (H - SKY - 4)) | 0),
      i = y * W + x;
    if ((g[i] === SOIL || g[i] === GRASS) && !SOLID[g[i + W]] && rand() < (sup[i] ? 0.15 : 0.8))
      g[i] = RUBBLE;
  }
}
function updateDirector() {
  if (tut.on) {
    updateTutorial();
    return;
  }
  if (game.war) {
    for (let k = timers.length - 1; k >= 0; k--)
      if (game.t >= timers[k].at) {
        const f = timers[k].fn;
        timers.splice(k, 1);
        f();
      }
    return;
  }
  game.intensity = 1 + game.t / 110;
  for (let k = timers.length - 1; k >= 0; k--)
    if (game.t >= timers[k].at) {
      const f = timers[k].fn;
      timers.splice(k, 1);
      f();
    }
  if (game.t >= game.harassAt) {
    spawnShell(game.t > 200 && rand() < 0.3 ? 'howitzer' : 'light', pickX());
    game.harassAt = game.t + Math.max(1.3, 6.5 - game.t / 45) * (0.6 + drand() * 0.8) * (game.war ? 1.6 : 1);
  }
  if (game.t >= game.nextEvent) {
    const pool = EVENTS.filter(e => game.t >= e.after);
    let tw = pool.reduce((a, e) => a + e.w, 0),
      r = drand() * tw,
      ev = pool[0];
    for (const e of pool) {
      r -= e.w;
      if (r <= 0) {
        ev = e;
        break;
      }
    }
    ev.run();
    game.events++;
    for (const r of rooms)
      if (r.kind === 'magazine') {
        gold += 40;
        popup(r.x + r.w / 2, r.y - 1, '+40');
      }
    if (game.events === 5 || (game.events > 5 && game.events % 6 === 5))
      schedule(6, () => {
        banner('GIANT METEOR', "IT'S GOING TO LEAVE A HOLE");
        schedule(2.5, () => spawnShell('giant', pickX()));
      });
    if (game.events > 1) {
      gold += 15;
      schedule(9, () => toast('Held the line  +15 ◆'));
    }
    game.nextEvent = game.t + (Math.max(15, 38 - game.t / 12) + drand() * 6) * (game.war ? 1.6 : 1);
  }
  if (game.t < rainUntil) rainTick(2 + game.intensity);
  else if (sfx.raining) sfx.rain(false);
  if (rand() < 0.25) {
    const x = (rand() * W) | 0,
      y = Math.floor(cam.y + rand() * viewRows());
    if (y > SKY + 100 && inB(x, y) && g[y * W + x] === E && bgc[y * W + x])
      particles.push({ x: x + 0.5, y, vx: (rand() - 0.5) * 0.03, vy: -0.03, life: 120, max: 120, k: 'glow' });
  }
  if (rand() < 0.002)
    flares.push({ x: 10 + rand() * (W - 20), y: 4 + rand() * 10, vx: (rand() - 0.5) * 0.03, life: 900 });
}
function rainTick(rate) {
  for (let n = 0; n < rate; n++) {
    const x = (rand() * W) | 0;
    if (g[x] === E && rand() < 0.35) {
      g[x] = WATER;
      sh[x] = (rand() * 255) | 0;
    }
  }
  if (particles.length < 1400)
    for (let n = 0; n < 2; n++)
      particles.push({
        x: rand() * W,
        y: cam.y - 2 + rand() * 4,
        vx: -0.15,
        vy: 2.2,
        life: 200,
        max: 200,
        k: 'rain',
      });
}
function updateDemo() {
  game.intensity = 2;
  if (tick % 28 === 0) spawnShell(rand() < 0.2 ? 'heavy' : rand() < 0.5 ? 'howitzer' : 'light', pickX());
  if (tick % 900 === 300) for (let k = 0; k < 4; k++) spawnSoldier(k % 2 ? 1 : -1);
  if (tick % 1500 === 700) rainUntil = game.t + 8;
  if (game.t < rainUntil) rainTick(3);
  if (tick % 2400 === 2000) spawnShell('meteor', pickX());
  if (rand() < 0.004)
    flares.push({ x: 10 + rand() * (W - 20), y: 4 + rand() * 10, vx: (rand() - 0.5) * 0.03, life: 900 });
  for (let k = timers.length - 1; k >= 0; k--)
    if (game.t >= timers[k].at) {
      const f = timers[k].fn;
      timers.splice(k, 1);
      f();
    }
}
