// SAPPER — physics.js
// The falling-sand simulation: ceiling support, the per-cell automaton (sand, water, soil, fire), falling rock bodies and explosions.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- support map (box dilation of support materials)
const SUPR = 6;
function computeSupport() {
  for (let y = 0; y < H; y++) {
    let c = 0;
    const row = y * W;
    for (let x = -SUPR; x < W; x++) {
      const a = x + SUPR;
      if (a < W && (SUPPORTS[g[row + a]] || prop[row + a])) c++;
      const b = x - SUPR - 1;
      if (b >= 0 && (SUPPORTS[g[row + b]] || prop[row + b])) c--;
      if (x >= 0) hbuf[row + x] = c > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = -SUPR; y < H; y++) {
      const a = y + SUPR;
      if (a < H && hbuf[a * W + x]) c++;
      const b = y - SUPR - 1;
      if (b >= 0 && hbuf[b * W + x]) c--;
      if (y >= 0) sup[y * W + x] = c > 0 ? 1 : 0;
    }
  }
}

// ---------- cellular automaton
function swap(i, j) {
  const t = g[i];
  g[i] = g[j];
  g[j] = t;
  const h = hp[i];
  hp[i] = hp[j];
  hp[j] = h;
  const s = sh[i];
  sh[i] = sh[j];
  sh[j] = s;
  st[j] = stampV;
  st[i] = stampV;
}
const fallInto = t => t === E || t === WATER || t === FIRE;
function stepSim() {
  tick++;
  stampV = (tick % 250) + 1;
  for (let y = H - 2; y >= 0; y--) {
    const ltr = ((y + tick) & 1) === 0;
    for (let k = 0; k < W; k++) {
      const x = ltr ? k : W - 1 - k,
        i = y * W + x,
        t = g[i];
      if (t === E || st[i] === stampV) continue;
      switch (t) {
        case SAND:
        case RUBBLE: {
          const j = i + W,
            b = g[j];
          if (fallInto(b)) {
            if (b === FIRE) g[j] = E;
            swap(i, j);
            break;
          }
          if (t === RUBBLE && rand() < 0.4) break;
          const d = rand() < 0.5 ? -1 : 1;
          if (x + d >= 0 && x + d < W && fallInto(g[j + d]) && !SOLID[g[i + d]]) {
            swap(i, j + d);
            break;
          }
          if (x - d >= 0 && x - d < W && fallInto(g[j - d]) && !SOLID[g[i - d]]) {
            swap(i, j - d);
          }
          break;
        }
        case WATER: {
          const j = i + W,
            b = g[j];
          if (b === E || b === FIRE) {
            g[j] = E;
            swap(i, j);
            break;
          }
          {
            // seeps into porous ground below and beside it, so floods drain away over time
            const por = t2 => t2 === SOIL || t2 === SAND || t2 === GRASS || t2 === RUBBLE;
            const n =
              (por(b) ? 2 : 0) + (x > 0 && por(g[i - 1]) ? 1 : 0) + (x < W - 1 && por(g[i + 1]) ? 1 : 0);
            if (n && rand() < 0.0012 * n) {
              g[i] = E;
              break;
            }
          }
          const d = rand() < 0.5 ? -1 : 1;
          if (x + d >= 0 && x + d < W && g[j + d] === E) {
            swap(i, j + d);
            break;
          }
          if (x - d >= 0 && x - d < W && g[j - d] === E) {
            swap(i, j - d);
            break;
          }
          let moved = false;
          for (const dd of [d, -d]) {
            let tx = -1;
            for (let n = 1; n <= 6; n++) {
              const nx = x + dd * n;
              if (nx < 0 || nx >= W || g[i + dd * n] !== E) break;
              tx = i + dd * n;
              if (g[tx + W] === E) break;
            }
            if (tx >= 0) {
              swap(i, tx);
              moved = true;
              break;
            }
          }
          break;
        }
        case SOIL:
        case GRASS: {
          const b = g[i + W];
          if ((b === E || b === WATER) && !sup[i]) {
            // the wider the open span beneath, the faster the ceiling gives way
            const j = i + W;
            let l = 0,
              r = 0;
            while (l < 30 && x - l - 1 >= 0 && !SOLID[g[j - l - 1]]) l++;
            while (r < 30 && x + r + 1 < W && !SOLID[g[j + r + 1]]) r++;
            const span = l + r + 1;
            let p = span <= 5 ? 0.00015 : Math.min(0.03, 0.00015 * Math.pow(span / 5, 3));
            const above = y > 0 ? g[i - W] : E;
            if (above === E || above === WATER) p = Math.max(p, 0.012);
            if ((x === 0 || !SOLID[g[i - 1]]) && (x === W - 1 || !SOLID[g[i + 1]])) p = 0.25;
            if (rand() < p) {
              g[i] = RUBBLE;
              for (let k = 1; k <= 4 && y - k >= 0; k++) {
                const u = i - k * W;
                if ((g[u] === SOIL || g[u] === GRASS) && !sup[u] && rand() < 0.7) g[u] = RUBBLE;
                else break;
              }
              if (span > 8 && rand() < 0.3) {
                sfx.crumble();
                particles.push({ x: x + 0.5, y: y + 1, vx: 0, vy: 0.02, life: 60, max: 60, k: 'smoke' });
              }
            }
          }
          break;
        }
        case ROCK:
        case GOLD: {
          if (tick % 8 === 0 && !SOLID[g[i + W]] && rand() < 0.2) {
            let n = 0;
            if (y > 0 && SOLID[g[i - W]]) n++;
            if (x > 0 && SOLID[g[i - 1]]) n++;
            if (x < W - 1 && SOLID[g[i + 1]]) n++;
            if (n === 0) {
              if (t === GOLD && state === 'play') {
                g[i] = E;
                mineOre(x, y);
              } else g[i] = RUBBLE;
            } // loose ore is banked, not lost
          }
          break;
        }
        case FIRE: {
          prop[i] = 0;
          if (hp[i] > 0) hp[i]--;
          if (hp[i] === 0) {
            g[i] = E;
            break;
          }
          if (rand() < 0.02)
            particles.push({
              x: x + 0.5,
              y: y,
              vx: (rand() - 0.5) * 0.05,
              vy: -0.08 - rand() * 0.05,
              life: 90,
              max: 90,
              k: 'smoke',
            });
          const nb = [i - 1, i + 1, i - W, i + W];
          for (const n of nb) {
            if (n < 0 || n >= W * H) continue;
            const tn = g[n];
            if (tn === WATER) {
              g[i] = E;
              break;
            }
            if (prop[n] && tn === E && rand() < 0.01) {
              g[n] = FIRE;
              hp[n] = 150;
              prop[n] = 0;
            }
            if (
              (tn === TIMBER && rand() < 0.012) ||
              (tn === GRASS && rand() < 0.003) ||
              (tn === BAGS && rand() < 0.0015)
            ) {
              g[n] = FIRE;
              hp[n] = tn === TIMBER ? 200 : 90;
            }
          }
          break;
        }
      }
    }
  }
}

// ---------- rigid rock bodies: a rock blob falls as one piece once <20% of its underside rests on anything
const rockChecks = [],
  bodies = [],
  rmark = new Uint32Array(W * H);
let rgen = 0;
const isRock = t => t === ROCK || t === GOLD;
function queueRockCheck(x, y, r) {
  rockChecks.push([x | 0, y | 0, r]);
}
function processRockChecks() {
  if (!rockChecks.length) return;
  rgen++;
  for (const [cx, cy, r] of rockChecks.splice(0)) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (!inB(x, y)) continue;
        const i = y * W + x;
        if (!isRock(g[i]) || rmark[i] === rgen) continue;
        // flood fill the blob (capped: big strata count as anchored bedrock)
        const cells = [i];
        rmark[i] = rgen;
        let big = false;
        for (let k = 0; k < cells.length; k++) {
          const c = cells[k],
            cx2 = c % W;
          for (const n of [c - 1, c + 1, c - W, c + W]) {
            if (n < 0 || n >= W * H) continue;
            if ((n === c - 1 && cx2 === 0) || (n === c + 1 && cx2 === W - 1)) continue;
            if (isRock(g[n]) && rmark[n] !== rgen) {
              rmark[n] = rgen;
              cells.push(n);
              if (cells.length > 900) {
                big = true;
                break;
              }
            }
          }
          if (big) break;
        }
        if (big) continue;
        const set = new Set(cells);
        let bottom = 0;
        const holds = [];
        for (const c of cells) {
          const j = c + W;
          if (j >= W * H) {
            bottom++;
            holds.push(-1);
            continue;
          }
          if (set.has(j)) continue;
          bottom++;
          if (SOLID[g[j]]) holds.push(j);
        }
        if (!bottom || holds.length / bottom >= 0.2) continue;
        // the last slivers of soft ground get crushed; anything hard (rock, concrete, timber...) still holds it
        const soft = t => t === SOIL || t === GRASS || t === SAND || t === RUBBLE;
        if (holds.some(j => j < 0 || !soft(g[j]))) continue;
        for (const j of holds) {
          particles.push({
            x: (j % W) + 0.5,
            y: ((j / W) | 0) + 0.5,
            vx: (rand() - 0.5) * 0.4,
            vy: -0.1,
            life: 60,
            max: 60,
            k: 'debris',
            t: RUBBLE,
          });
          g[j] = E;
        }
        bodies.push({ cells, set, vy: 0, fy: 0 });
      }
  }
}
function updateBodies() {
  for (let k = bodies.length - 1; k >= 0; k--) {
    const b = bodies[k];
    b.vy = Math.min(b.vy + 0.06, 2);
    b.fy += b.vy;
    let landed = false;
    while (b.fy >= 1 && !landed) {
      b.fy -= 1;
      for (const c of b.cells) {
        const j = c + W;
        if (j >= W * H || (!b.set.has(j) && SOLID[g[j]])) {
          landed = true;
          break;
        }
      }
      if (landed) break;
      b.cells.sort((a, c) => c - a); // bottom rows first, so each cell drops into the space below it
      for (const c of b.cells) {
        const j = c + W;
        let t = g[c];
        g[c] = g[j];
        g[j] = t;
        t = sh[c];
        sh[c] = sh[j];
        sh[j] = t;
        hp[c] = 0;
        hp[j] = 0;
      }
      b.cells = b.cells.map(c => c + W);
      b.set = new Set(b.cells);
    }
    if (landed) {
      bodies.splice(k, 1);
      const n = b.cells.length,
        c0 = b.cells[0],
        x = c0 % W,
        y = (c0 / W) | 0;
      if (b.vy > 0.5) {
        for (const c of b.cells) {
          const j = c + W;
          if (j < W * H && !b.set.has(j)) {
            if (g[j] === HQ) hurtGen(genAt(j % W, (j / W) | 0), n * 0.04);
            else if (
              g[j] === TIMBER ||
              g[j] === LAMP ||
              g[j] === PUMP ||
              g[j] === MG ||
              g[j] === DRILL ||
              g[j] === ROOM
            )
              g[j] = RUBBLE;
          }
        }
        const near = 1 - Math.min(1, Math.abs(y - (cam.y + viewRows() / 2)) / viewRows());
        shake = Math.min(12, shake + Math.sqrt(n) * 0.5 * Math.max(0.2, near));
        sfx.boom(Math.min(10, 2 + Math.sqrt(n) * 0.6), Math.max(0.15, near) * 0.7);
        if (near > 0.4) haptic(n > 80 ? 'heavy' : 'medium');
        for (let q = 0; q < Math.min(30, n / 3); q++)
          particles.push({
            x: x + (rand() - 0.5) * 8,
            y: y,
            vx: (rand() - 0.5) * 0.2,
            vy: -0.05 - rand() * 0.1,
            life: 100,
            max: 100,
            k: 'smoke',
          });
      }
      queueRockCheck(x, y, 6);
    }
  }
}

// ---------- explosions & damage
function explode(x, y, r, opt = {}) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    R = Math.ceil(r) + 2;
  const genHit = new Map();
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const cx = xi + dx,
        cy = yi + dy;
      if (!inB(cx, cy)) continue;
      const i = cy * W + cx,
        t = g[i];
      let acc = 0;
      for (let s = 1; s < d; s++) {
        const px = Math.round(xi + (dx * s) / d),
          py = Math.round(yi + (dy * s) / d);
        if (inB(px, py)) acc += RES[g[py * W + px]];
        if (acc > r) break;
      }
      const e = r - d - acc;
      if (e > 1) ladder[i] = 0;
      if (e > 1 && prop[i]) {
        prop[i] = 0;
        if (t === E && rand() < 0.15) {
          g[i] = FIRE;
          hp[i] = 80;
          continue;
        }
      }
      if (t === HQ) {
        const gn = genAt(cx, cy);
        if (gn && e > (genHit.get(gn) || 0)) genHit.set(gn, e);
        continue;
      }
      if (e <= 0) {
        if (e > -2.5 && (t === SOIL || t === GRASS) && rand() < 0.5) g[i] = RUBBLE;
        continue;
      }
      if (t === E) {
        if (opt.fire && rand() < opt.fire * 0.06) {
          g[i] = FIRE;
          hp[i] = (30 + rand() * 60) | 0;
        }
        continue;
      }
      const soft = t === SOIL || t === GRASS || t === RUBBLE;
      if (opt.shell && soft) {
        // artillery on earth: a 20% smaller hole; of it 40% stays ground, 40% becomes loose soil (some thrown skyward), 20% is gone
        if (d > r * 0.8 || e <= 0) continue;
        const k = rand();
        if (k < 0.4) continue; // half of what would have turned to sand just stays put as ground
        if (k < 0.8) {
          if (rand() < 0.3 && particles.length < 1400) {
            const a = Math.atan2(dy - 2, dx) - 0.3 + rand() * 0.6,
              sp = 0.35 + e * 0.09 * rand();
            particles.push({
              x: cx + 0.5,
              y: cy + 0.5,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 0.5,
              life: 150,
              max: 150,
              k: 'debris',
              t: RUBBLE,
            });
            g[i] = E;
          } else {
            g[i] = RUBBLE;
            sh[i] = (rand() * 255) | 0;
          }
        } else g[i] = E;
        hp[i] = 0;
        continue;
      }
      if (e > HARD[t]) {
        if (
          (t === SOIL || t === GRASS || t === SAND || t === RUBBLE || t === ROCK) &&
          rand() < 0.1 &&
          particles.length < 1400
        ) {
          const a = Math.atan2(dy - 1.5, dx),
            sp = 0.25 + e * 0.08 * rand();
          particles.push({
            x: cx + 0.5,
            y: cy + 0.5,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 0.3,
            life: 120,
            max: 120,
            k: 'debris',
            t: t === SAND ? SAND : RUBBLE,
            c: t,
          });
        }
        if (t === TIMBER && rand() < 0.3) {
          g[i] = FIRE;
          hp[i] = 120;
        } else if (opt.fire && rand() < opt.fire * 0.05) {
          g[i] = FIRE;
          hp[i] = (40 + rand() * 80) | 0;
        } else {
          g[i] = E;
          hp[i] = 0;
        }
      }
    }
  queueRockCheck(x, y, R + 3);
  for (const [gn, e] of genHit) {
    hurtGen(gn, e * 1.7);
    haptic('heavy');
  }
  for (const s of soldiers) if (Math.hypot(s.x - x, s.y - 2 - y) < r * 1.25) s.hp = 0;
  for (const d of diggers)
    if (Math.hypot(d.x - x, d.y - y) < r * 1.1) {
      if (d.down) {
        if (!d.carried && !d.healing) d.dead = true;
      } else d.hp = 0;
    }
  for (const m of medics) if (Math.hypot(m.x - x, m.y - y) < r * 1.1) m.dead = true;
  flashes.push({ x, y, r: r * 3.2, life: 14, max: 14 });
  for (let k = 0; k < r * 1.5; k++)
    particles.push({
      x: x + (rand() - 0.5) * r,
      y: y + (rand() - 0.5) * r * 0.6,
      vx: (rand() - 0.5) * 0.15,
      vy: -0.05 - rand() * 0.12,
      life: 120 + rand() * 120,
      max: 240,
      k: 'smoke',
    });
  for (let k = 0; k < r * 2; k++) {
    const a = rand() * 6.28,
      sp = 0.3 + rand() * 0.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.3,
      life: 20 + rand() * 20,
      max: 40,
      k: 'spark',
    });
  }
  const near = 1 - Math.min(1, Math.abs(y - (cam.y + viewRows() / 2)) / (viewRows() * 1.2));
  shake = Math.min(14, shake + r * 0.7 * Math.max(0.2, near));
  sfx.boom(r, Math.max(0.15, near));
  if (near > 0.5 && r > 8) haptic(r > 13 ? 'heavy' : 'medium');
}
