// SAPPER — core.js
// Constants, cell materials, world arrays, seeded noise, palette and map generation (including the starting base).
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

const BUILD = 'dev'; // stamped by scripts/deploy.sh
// =====================================================================
//  SAPPER — falling-sand bunker survival.  Single file, no network.
// =====================================================================
const W = 192,
  H = 440;
const OX = (W - 128) / 2; // base layout offset (layout was designed at 128 wide)
const VIEWW = 112,
  ZMIN = VIEWW / W; // cells visible across the screen at zoom 1
const E = 0,
  SOIL = 1,
  SAND = 2,
  ROCK = 3,
  WATER = 4,
  TIMBER = 5,
  BAGS = 6,
  CONC = 7,
  GOLD = 8,
  RUBBLE = 9,
  FIRE = 10,
  HQ = 11,
  PUMP = 12,
  MG = 13,
  BED = 14,
  GRASS = 15,
  LAMP = 16;
const DRILL = 17,
  ROOM = 18,
  DOOR = 19;
const NT = 20;
const SOLID = new Uint8Array(NT).fill(1);
SOLID[E] = 0;
SOLID[WATER] = 0;
SOLID[FIRE] = 0;
//            E  SOIL SAND ROCK WATR TIMB BAGS CONC GOLD RUBB FIRE HQ  PUMP MG   BED GRAS LAMP
const RES = [0, 1, 0.8, 2.5, 0.4, 1.5, 3.5, 6, 2.5, 0.6, 0, 5, 3, 3, 99, 1, 0.5, 3, 3, 4];
const HARD = [0, 0, 0, 2.5, 0, 1, 2.5, 5.5, 2.5, 0, 0, 99, 3, 3, 999, 0, 0, 2, 2.5, 4];
const DIGT = [0, 3, 2, 22, 0, 0, 0, 25, 4, 2, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0];
const SUPPORTS = new Uint8Array(NT);
SUPPORTS[TIMBER] = 1;
SUPPORTS[CONC] = 1;
SUPPORTS[BAGS] = 1;
SUPPORTS[HQ] = 1;
SUPPORTS[ROOM] = 1;
SUPPORTS[PUMP] = 1;

// ---------- world state
const g = new Uint8Array(W * H); // material
const hp = new Uint8Array(W * H); // dig progress / fire life
const sh = new Uint8Array(W * H); // per-cell shade noise
const st = new Uint8Array(W * H); // updated-this-tick stamp
const bgc = new Uint8Array(W * H); // back wall: 0 sky,1 soil,2 rock,3 sand
const sup = new Uint8Array(W * H);
const prop = new Uint8Array(W * H);
const secret = new Uint8Array(W * H); // enemy tunnel cells the player hasn't discovered yet (drawn as earth)
const ladder = new Uint8Array(W * H); // 1 = rail, 2 = rung: the ladder the drill leaves down its shaft
const PROPBG = 99; // ceiling support map
const hbuf = new Uint8Array(W * H);
const surfOrig = new Int16Array(W);
const SKY = 44;

let tick = 0,
  stampV = 1;
let gens = [],
  drills = [],
  rooms = [],
  pumps = [],
  mgs = [],
  soldiers = [],
  shells = [],
  particles = [],
  flashes = [],
  tracers = [],
  popups = [],
  flares = [],
  timers = [];
let shake = 0,
  gold = 0,
  rainUntil = 0,
  demo = true;
const game = {
  t: 0,
  best: +(localStorage.getItem('sapper.best') || 0),
  mined: 0,
  kills: 0,
  nextEvent: 22,
  harassAt: 40,
  intensity: 1,
  events: 0,
};
let state = 'menu';
const rand = Math.random;
const idx = (x, y) => y * W + x;
const inB = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

// ---------- seeded noise for generation
let seed = 1;
function hash2(ix, iy, s) {
  let h = (ix * 374761393 + iy * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s),
    b = hash2(xi + 1, yi, s),
    c = hash2(xi, yi + 1, s),
    d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, o = 3) {
  let a = 0.5,
    f = 1,
    t = 0,
    n = 0;
  for (let k = 0; k < o; k++) {
    t += a * vnoise(x * f, y * f, s + k * 31);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return t / n;
}
function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- palette
const PAL = {
  // base rgb, variance
  [SOIL]: [74, 52, 36, 14],
  [SAND]: [170, 140, 86, 16],
  [ROCK]: [86, 86, 92, 14],
  [WATER]: [36, 84, 132, 12],
  [TIMBER]: [116, 80, 44, 16],
  [BAGS]: [132, 116, 78, 12],
  [CONC]: [120, 116, 106, 10],
  [GOLD]: [214, 168, 44, 26],
  [RUBBLE]: [96, 76, 58, 16],
  [HQ]: [64, 72, 58, 8],
  [PUMP]: [68, 80, 92, 8],
  [MG]: [58, 62, 54, 8],
  [BED]: [24, 22, 26, 6],
  [GRASS]: [72, 80, 38, 12],
  [LAMP]: [255, 224, 150, 0],
  [DRILL]: [78, 80, 86, 8],
  [ROOM]: [92, 82, 62, 8],
  [DOOR]: [96, 100, 104, 6],
  [FIRE]: [255, 140, 40, 0],
};
const palR = new Uint8Array(NT * 8),
  palG = new Uint8Array(NT * 8),
  palB = new Uint8Array(NT * 8);
for (const k in PAL) {
  const [r, gg, b, v] = PAL[k];
  for (let s = 0; s < 8; s++) {
    const o = ((s - 3.5) / 3.5) * v;
    palR[k * 8 + s] = Math.max(0, Math.min(255, r + o));
    palG[k * 8 + s] = Math.max(0, Math.min(255, gg + o * 0.9));
    palB[k * 8 + s] = Math.max(0, Math.min(255, b + o * 0.8));
  }
}
const WALL = [
  [0, 0, 0],
  [36, 25, 18],
  [36, 36, 40],
  [64, 52, 34],
];

// sky with distant silhouettes (no-man's-land)
const SKYROWS = SKY + 12;
const skyR = new Uint8Array(W * SKYROWS),
  skyG = new Uint8Array(W * SKYROWS),
  skyB = new Uint8Array(W * SKYROWS);
function buildSky(s) {
  const r = mulberry(s * 7 + 3);
  for (let y = 0; y < SKYROWS; y++) {
    const t = Math.min(1, y / (SKY - 4));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const n = fbm(x * 0.07, y * 0.18, s + 900, 2) * 14;
      skyR[i] = 10 + t * t * 48 + n;
      skyG[i] = 9 + t * t * 24 + n * 0.6;
      skyB[i] = 15 + t * 10 + n * 0.5;
    }
  }
  for (let k = 0; k < 14; k++) {
    const i = ((r() * (SKY - 18)) | 0) * W + ((r() * W) | 0);
    skyR[i] = skyG[i] = skyB[i] = 60 + r() * 50;
  } // few stars through the smoke
  const hill = x => SKY - 7 + fbm(x * 0.05, 0, s + 400, 2) * 6 - 2;
  for (let x = 0; x < W; x++)
    for (let y = Math.floor(hill(x)); y < SKYROWS; y++) {
      const i = y * W + x;
      skyR[i] = 24;
      skyG[i] = 18;
      skyB[i] = 16;
    }
  for (let k = 0; k < 5; k++) {
    // dead trees
    const tx = 4 + ((r() * (W - 8)) | 0),
      base = Math.floor(hill(tx)),
      th = 6 + ((r() * 8) | 0);
    for (let y = base - th; y < base; y++) {
      const i = y * W + tx;
      skyR[i] = 17;
      skyG[i] = 13;
      skyB[i] = 12;
    }
    for (let b = 0; b < 3; b++) {
      const by = base - th + 2 + ((r() * (th - 3)) | 0),
        d = r() < 0.5 ? -1 : 1,
        bl = 1 + ((r() * 3) | 0);
      for (let j = 1; j <= bl; j++) {
        const i = (by - j + 1) * W + tx + d * j;
        if (i > 0) {
          skyR[i] = 17;
          skyG[i] = 13;
          skyB[i] = 12;
        }
      }
    }
  }
  for (let x = 2; x < W; x += 9 + ((r() * 5) | 0)) {
    // wire pickets
    const base = Math.floor(hill(x));
    for (let y = base - 3; y < base; y++) {
      const i = y * W + x;
      skyR[i] = 20;
      skyG[i] = 16;
      skyB[i] = 14;
    }
  }
}

// ---------- world generation
function genWorld(s) {
  seed = s;
  g.fill(0);
  hp.fill(0);
  prop.fill(0);
  secret.fill(0);
  mark.fill(0);
  zone.fill(0);
  ladder.fill(0);
  bgc.fill(0);
  st.fill(0);
  const r = mulberry(s);
  buildSky(s);
  for (let x = 0; x < W; x++) surfOrig[x] = SKY + Math.round((fbm(x * 0.04, 3.3, s, 2) - 0.5) * 6);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      sh[i] = (r() * 255) | 0;
      const d = y - surfOrig[x];
      if (d < 0) continue;
      let t = SOIL,
        wall = 1;
      if (d < 2) t = GRASS;
      const rocky = Math.min(1, Math.max(0, (d - 25) / 220));
      if (d > 6 && fbm(x * 0.07, y * 0.07, s + 11) + rocky * 0.55 > 0.78) {
        t = ROCK;
        wall = 2;
      }
      if (d > 12 && t === SOIL && fbm(x * 0.09, y * 0.13, s + 23) > 0.7) {
        t = SAND;
        wall = 3;
      }
      if (d > 85 && fbm(x * 0.08, y * 0.1, s + 37) > 0.76) {
        t = WATER;
        wall = 1;
      }
      if (t === ROCK && fbm(x * 0.22, y * 0.22, s + 51) > 0.79 - d * 0.00025) t = GOLD;
      if (t === SOIL && d > 40 && r() < 0.0015) t = GOLD;
      if (
        y > H / 2 &&
        (t === SOIL || t === ROCK) &&
        fbm(x * 0.16, y * 0.16, s + 77) > 0.8 - (y - H / 2) * 0.0004
      )
        t = GOLD; // richer seams in the deep half
      if (y >= H - 3 - ((hash2(x, 0, s) * 3) | 0)) {
        t = BED;
        wall = 2;
      }
      g[i] = t;
      bgc[i] = wall;
    }
}

function setCell(x, y, t) {
  if (!inB(x, y)) return;
  const i = idx(x, y);
  g[i] = t;
  hp[i] = 0;
}
function fillRect(x0, y0, w, h, t) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setCell(x, y, t);
}

function buildBase(isDemo) {
  const O = OX,
    gx = 58 + O,
    fy = surfOrig[gx + 7] + 26;
  // clear hazards around the base zone
  for (let y = SKY; y < fy + 8; y++)
    for (let x = 26 + O; x < 104 + O; x++) {
      const i = idx(x, y);
      if (y >= surfOrig[x]) {
        if (g[i] === WATER || g[i] === SAND) g[i] = SOIL;
        if (g[i] === ROCK && y < fy + 3 && x < 92 + O) g[i] = SOIL;
        bgc[i] = 1;
      }
    }
  // surface trench + parapet
  for (let x = 26 + O; x < 56 + O; x++) {
    const s0 = surfOrig[x];
    for (let y = s0; y < s0 + 5; y++) setCell(x, y, E);
  }
  const bag = (x, w) => {
    const s0 = Math.min(...Array.from({ length: w }, (_, k) => surfOrig[x + k]));
    fillRect(x, s0 - 2, w, 2, BAGS);
  };
  bag(21 + O, 6);
  bag(55 + O, 6);
  // shaft down from the trench
  const s34 = surfOrig[34 + O];
  fillRect(34 + O, s34 + 4, 7, fy - s34 - 4, E);
  for (let y = s34 + 8; y < fy - 12; y += 8) {
    setCell(33 + O, y, TIMBER);
    setCell(41 + O, y, TIMBER);
  }
  // generator chamber: timber bracing, concrete pad under the generator
  fillRect(34 + O, fy - 11, 56, 11, E);
  fillRect(gx - 2, fy, GEN_W + 4, 2, CONC);
  fillRect(gx, fy - GEN_H, GEN_W, GEN_H, HQ);
  addGen(gx, fy - GEN_H);
  const frame = (L, R, top, bot, posts) => {
    const mark = (x, y) => {
      if (inB(x, y)) prop[idx(x, y)] = 1;
    };
    for (let x = L; x <= R; x++) {
      mark(x, top);
      mark(x, top + 1);
    }
    for (const p of posts) for (let y = top + 2; y <= bot; y++) mark(p, y);
  };
  frame(41 + O, 89 + O, fy - 11, fy - 1, [41 + O, 52 + O, 77 + O, 89 + O]);
  place('lamp', 47 + O, fy - 9, true);
  place('lamp', 84 + O, fy - 9, true);
  place('lamp', 34 + O, s34 + 12, true);
  place('drill', 83 + O, fy - 2, true); // lands between the right-hand posts
  fillRect(41 + O, fy - 7, 16, 7, ROOM);
  rooms.push({ kind: 'miners', x: 41 + O, y: fy - 7, w: 16, h: 7, fresh: true }); // the starting crew lives between the shaft and the generator
  // a gold vein to teach mining, just off the chamber
  for (let y = fy - 8; y < fy; y++)
    for (let x = 90 + O; x < 102 + O; x++)
      if (hash2(x, y, seed + 5) < 0.55) setCell(x, y, hash2(x, y, seed + 6) < 0.45 ? GOLD : ROCK);
  if (isDemo) {
    place('mg', 47 + O, surfOrig[47 + O] + 4, true);
    place('pump', 46 + O, fy - 2, true);
    drills[drills.length - 1].rem = 90;
    const g2x = 120 + O,
      f2 = surfOrig[g2x + 7] + 16;
    fillRect(g2x - 4, f2 - 10, GEN_W + 8, 10, E);
    frame(g2x - 4, g2x + GEN_W + 3, f2 - 10, f2 - 1, [g2x - 4, g2x + GEN_W + 3]);
    fillRect(g2x, f2 - GEN_H, GEN_W, GEN_H, HQ);
    addGen(g2x, f2 - GEN_H);
    place('lamp', g2x + GEN_W + 1, f2 - 8, true);
  }
  computeSupport();
}
