// SAPPER — miners.js
// Dig orders (marking), miners and their pathfinding, medics, construction work.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- digging
let digAt = null,
  digSoundT = 0;
// ---------- dig orders: your finger marks earth, miners from the Miners' Hut walk over and dig it
const mark = new Uint8Array(W * H);
const zone = new Uint8Array(W * H); // areas you've asked to be dug out: anything loose that falls back in gets dug again
let markErase = false;
function applyDig() {
  // paints (or erases) dig marks under the finger
  if (!digAt) return;
  const cx = Math.floor(digAt.x),
    cy = Math.floor(digAt.y);
  let n = 0; // a square 5×5 brush, snapped to the grid, so marked areas have straight edges
  for (let y = cy - 2; y <= cy + 2; y++)
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (!inB(x, y)) continue;
      const i = y * W + x;
      if (markErase) {
        if (mark[i] || zone[i]) {
          mark[i] = 0;
          zone[i] = 0;
          n++;
        }
      } else {
        if (!zone[i]) n++;
        zone[i] = 1;
        if (DIGT[g[i]]) mark[i] = 1;
      }
    }
  if (n && tick - digSoundT > 8) {
    digSoundT = tick;
    sfx.tick();
  }
}
// remove one cell of earth (shared by miners)
function digCell(i) {
  const t = g[i],
    x = i % W,
    y = (i / W) | 0;
  g[i] = E;
  hp[i] = 0;
  mark[i] = 0;
  game.dug++;
  if (x > 0) secret[i - 1] = 0;
  if (x < W - 1) secret[i + 1] = 0;
  if (y > 0) secret[i - W] = 0;
  if (y < H - 1) secret[i + W] = 0;
  if (tick % 6 === 0 || isRock(t)) queueRockCheck(x, y, 4);
  if (t === GOLD) mineOre(x, y);
  if (rand() < 0.4)
    particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: (rand() - 0.5) * 0.3,
      vy: -rand() * 0.3,
      life: 20,
      max: 20,
      k: 'spark',
      dirt: 1,
    });
  if (tick - digSoundT > 5) {
    digSoundT = tick;
    sfx.dig();
  }
  for (const s2 of soldiers)
    if (s2.tun && Math.hypot(s2.x - x, s2.y - 1 - y) < 3) {
      s2.hp = 0;
      s2.revealed = true;
    }
}
const DIGGERS_PER_HUT = 6;
let diggers = [];
const walkable = i => {
  const t = g[i];
  return !SOLID[t] || t === ROOM || t === HQ || t === DOOR;
}; // bulkheads open for your people
const bfsSeen = new Uint32Array(W * H),
  bfsPrev = new Int32Array(W * H);
let bfsGen = 0;
const claimed = new Set();
// breadth-first search through open space (miners can climb) to the nearest marked earth nobody else has claimed
function findSiteJob(d) {
  // walk to any open cell on or right next to a construction site
  bfsGen++;
  const start = d.y * W + d.x,
    q = [start];
  bfsSeen[start] = bfsGen;
  bfsPrev[start] = -1;
  for (let qi = 0; qi < q.length && qi < 40000; qi++) {
    const c = q[qi],
      cx = c % W,
      cy = (c / W) | 0;
    const st = sites.find(
      t => t.clear && cx >= t.x0 - 1 && cx <= t.x1 + 1 && cy >= t.y0 - 1 && cy <= t.y1 + 1
    );
    if (st) {
      const path = [];
      for (let p = c; p !== -1 && p !== start; p = bfsPrev[p]) path.push(p);
      return { site: st, path: path.reverse() };
    }
    for (const n of [c - 1, c + 1, c - W, c + W]) {
      if (n < 0 || n >= W * H) continue;
      if ((n === c - 1 && cx === 0) || (n === c + 1 && cx === W - 1)) continue;
      if (bfsSeen[n] === bfsGen || !walkable(n)) continue;
      bfsSeen[n] = bfsGen;
      bfsPrev[n] = c;
      q.push(n);
    }
  }
  return null;
}
function findJob(d) {
  bfsGen++;
  const start = d.y * W + d.x,
    q = [start];
  bfsSeen[start] = bfsGen;
  bfsPrev[start] = -1;
  for (let qi = 0; qi < q.length && qi < 40000; qi++) {
    const c = q[qi],
      cx = c % W;
    for (const n of [c - 1, c + 1, c - W, c + W]) {
      if (n < 0 || n >= W * H) continue;
      if ((n === c - 1 && cx === 0) || (n === c + 1 && cx === W - 1)) continue;
      if (mark[n] && DIGT[g[n]] && !claimed.has(n)) {
        const path = [];
        for (let p = c; p !== -1 && p !== start; p = bfsPrev[p]) path.push(p);
        path.reverse();
        return { target: n, path };
      }
      if (bfsSeen[n] === bfsGen || !walkable(n)) continue;
      bfsSeen[n] = bfsGen;
      bfsPrev[n] = c;
      q.push(n);
    }
  }
  return null;
}
// ---------- medics: one per field hospital, they fetch downed miners and carry them back
let medics = [];
function bfsPath(sx, sy, goal) {
  // shortest walk through open space to cell `goal`
  bfsGen++;
  const start = sy * W + sx,
    q = [start];
  bfsSeen[start] = bfsGen;
  bfsPrev[start] = -1;
  if (start === goal) return [];
  for (let qi = 0; qi < q.length && qi < 40000; qi++) {
    const c = q[qi],
      cx = c % W;
    for (const n of [c - 1, c + 1, c - W, c + W]) {
      if (n < 0 || n >= W * H) continue;
      if ((n === c - 1 && cx === 0) || (n === c + 1 && cx === W - 1)) continue;
      if (bfsSeen[n] === bfsGen || !walkable(n)) continue;
      bfsSeen[n] = bfsGen;
      bfsPrev[n] = c;
      if (n === goal) {
        const path = [];
        for (let p = n; p !== start; p = bfsPrev[p]) path.push(p);
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}
function updateMedics() {
  for (const r of rooms)
    if (r.kind === 'hospital' && !medics.some(m => m.hosp === r)) {
      r.medicCD = (r.medicCD || 0) + 1;
      if (r.medicCD > 60 * 8) {
        r.medicCD = 0;
        medics.push({
          hosp: r,
          x: r.x + 3,
          y: r.y + r.h - 1,
          fx: r.x + 3,
          fy: r.y + r.h - 1,
          path: [],
          body: null,
          carrying: false,
          work: 0,
          dir: 1,
          anim: 0,
          wait: 0,
        });
      }
    }
  for (let k = medics.length - 1; k >= 0; k--) {
    const m = medics[k],
      b = m.body;
    if (m.dead || !rooms.includes(m.hosp)) {
      // lost: drop whoever they were carrying where they stand
      if (b) {
        b.carried = false;
        b.assigned = null;
        b.x = m.x;
        b.y = m.y;
      }
      medics.splice(k, 1);
      if (m.dead) m.hosp.medicCD = 0;
      continue;
    }
    m.anim += 0.2;
    m.fx += (m.x - m.fx) * 0.35;
    m.fy += (m.y - m.fy) * 0.35;
    if (b && (b.dead || !diggers.includes(b))) {
      m.body = null;
      m.carrying = false;
      m.path = [];
    }
    if (!m.body) {
      if (m.wait > 0) {
        m.wait--;
        continue;
      }
      let best = null,
        bd = 1e9;
      for (const d of diggers)
        if (d.down && !d.carried && !d.healing && !d.assigned) {
          const dd = Math.abs(d.x - m.x) + Math.abs(d.y - m.y);
          if (dd < bd) {
            bd = dd;
            best = d;
          }
        }
      if (!best) {
        m.wait = 20;
        if (m.y !== m.hosp.y + m.hosp.h - 1 || Math.abs(m.x - (m.hosp.x + 3)) > 1) {
          const p = bfsPath(m.x, m.y, (m.hosp.y + m.hosp.h - 1) * W + m.hosp.x + 3);
          if (p) m.path = p;
        }
      } else {
        const p = bfsPath(m.x, m.y, best.y * W + best.x);
        if (p) {
          m.body = best;
          best.assigned = m;
          m.path = p;
        } else m.wait = 40;
      }
    }
    if (m.path.length) {
      if (++m.work >= (m.carrying ? 6 : 4)) {
        m.work = 0;
        const n = m.path.shift();
        if (!walkable(n)) {
          m.path = [];
          if (m.body && !m.carrying) {
            m.body.assigned = null;
            m.body = null;
          }
          continue;
        }
        m.dir = n % W > m.x ? 1 : n % W < m.x ? -1 : m.dir;
        m.x = n % W;
        m.y = (n / W) | 0;
      }
      if (m.carrying && m.body) {
        m.body.x = m.x;
        m.body.y = m.y;
        m.body.fx = m.fx;
        m.body.fy = m.fy;
      }
      continue;
    }
    if (m.body && !m.carrying) {
      // reached them: pick up and head home
      m.carrying = true;
      m.body.carried = true;
      sfx.thunk();
      const p = bfsPath(m.x, m.y, (m.hosp.y + m.hosp.h - 1) * W + m.hosp.x + 3);
      m.path = p || [];
      if (!p) {
        m.carrying = false;
        m.body.carried = false;
        m.body.assigned = null;
        m.body = null;
        m.wait = 60;
      }
    } else if (m.body && m.carrying) {
      // back at the hospital: hand over for treatment
      m.body.carried = false;
      m.body.healing = 8 * 60;
      m.body.healAt = m.hosp;
      m.body = null;
      m.carrying = false;
      game.rescued = (game.rescued || 0) + 1;
      if (state === 'play') toast('Medic brought a miner in — treating now');
    }
  }
}
function spawnDigger(hut) {
  diggers.push({
    hut,
    x: hut.x + 2,
    y: hut.y + hut.h - 1,
    fx: hut.x + 2,
    fy: hut.y + hut.h - 1,
    path: [],
    target: -1,
    work: 0,
    wait: (rand() * 30) | 0,
    hp: 1,
    dir: 1,
    anim: 0,
    digging: false,
  });
}
function updateSites() {
  if (tick % 20) return;
  // sand or rubble that slid into a dig area is dug out again instead of sealing it off
  for (let i = 0; i < W * H; i++)
    if (zone[i] && !mark[i]) {
      const t = g[i];
      if (t === SAND || t === RUBBLE) mark[i] = 1;
    }
  for (const st of sites) {
    let clear = true;
    for (const c of st.cells) {
      const i = idx(c[0], c[1]);
      if (SOLID[g[i]]) {
        clear = false;
        if (DIGT[g[i]]) mark[i] = 1;
      }
    }
    st.clear = clear;
  }
}
function updateDiggers() {
  updateSites();
  // huts keep their crews topped up
  for (const r of rooms)
    if (r.kind === 'miners') {
      const crew = diggers.filter(d => d.hut === r).length;
      if (crew < DIGGERS_PER_HUT) {
        r.respawn = (r.respawn || 0) + 1;
        if (r.respawn > (r.fresh ? 1 : 60 * 20)) {
          r.respawn = 0;
          spawnDigger(r);
          if (crew + 1 >= DIGGERS_PER_HUT) r.fresh = false;
        }
      }
    }
  const speed = 1 + 0.4 * up.shovel;
  let idle = 0;
  for (let k = diggers.length - 1; k >= 0; k--) {
    const d = diggers[k],
      i = d.y * W + d.x;
    if (d.down) {
      // wounded: wait for a medic, heal in hospital, or bleed out
      if (d.dead || (!d.carried && !d.healing && --d.downT <= 0)) {
        if (d.assigned) d.assigned.body = null;
        diggers.splice(k, 1);
        if (state === 'play') toast(d.dead ? 'A wounded miner was killed' : "A wounded miner didn't make it");
        continue;
      }
      if (d.healing && --d.healing <= 0) {
        const h = d.healAt;
        d.down = false;
        d.healing = 0;
        d.hp = 1;
        d.assigned = null;
        if (h) {
          d.x = h.x + 3;
          d.y = h.y + h.h - 1;
          d.fx = d.x;
          d.fy = d.y;
        }
        if (state === 'play') toast('Miner patched up and back to work');
      }
      continue;
    }
    d.anim += 0.2;
    if (!walkable(i)) {
      // buried by a fall: scramble out to the nearest open cell, upward first
      let out = -1;
      for (let rr = 1; rr <= 4 && out < 0; rr++)
        for (const [dx, dy] of [
          [0, -rr],
          [-rr, 0],
          [rr, 0],
          [-rr, -rr],
          [rr, -rr],
          [0, rr],
        ]) {
          const nx = d.x + dx,
            ny = d.y + dy;
          if (inB(nx, ny) && walkable(ny * W + nx)) {
            out = ny * W + nx;
            break;
          }
        }
      if (out >= 0) {
        d.x = out % W;
        d.y = (out / W) | 0;
        if (d.target >= 0) claimed.delete(d.target);
        d.target = -1;
        d.path = [];
      } else d.hp -= 0.02;
    }
    if (g[i] === WATER) d.hp -= 0.004; // drowning
    if (g[i] === FIRE) d.hp -= 0.03;
    if (d.hp <= 0) {
      // knocked down, not dead: they lie there until a medic comes
      if (d.target >= 0) claimed.delete(d.target);
      d.target = -1;
      d.path = [];
      d.digging = false;
      d.down = true;
      d.downT = 45 * 60;
      d.hp = 1;
      d.assigned = null;
      d.carried = false;
      d.healing = 0;
      for (let n = 0; n < 4; n++)
        particles.push({
          x: d.x + 0.5,
          y: d.y,
          vx: (rand() - 0.5) * 0.4,
          vy: -rand() * 0.4,
          life: 30,
          max: 30,
          k: 'gib',
        });
      if (state === 'play')
        toast(
          rooms.some(r => r.kind === 'hospital')
            ? 'Miner down! A medic is on the way'
            : 'Miner down! Build a FIELD HOSPITAL to save them'
        );
      continue;
    }
    d.fx += (d.x - d.fx) * 0.35;
    d.fy += (d.y - d.fy) * 0.35;
    // job still valid?
    if (d.site && !sites.includes(d.site)) {
      d.site = null;
      d.path = [];
      d.digging = false;
    }
    if (d.target >= 0 && !(mark[d.target] && DIGT[g[d.target]])) {
      claimed.delete(d.target);
      d.target = -1;
      d.path = [];
      d.digging = false;
    }
    if (d.target < 0 && !d.site) {
      d.digging = false;
      if (d.wait > 0) {
        d.wait--;
        idle++;
        continue;
      }
      const job = (sites.length && findSiteJob(d)) || findJob(d);
      if (!job) {
        d.wait = 30;
        idle++;
        continue;
      }
      if (job.site) {
        d.site = job.site;
        d.path = job.path;
      } else {
        d.target = job.target;
        d.path = job.path;
        claimed.add(job.target);
      }
    }
    if (d.path.length) {
      // walk (and climb) toward the job
      if (++d.work >= 5) {
        d.work = 0;
        const n = d.path.shift();
        if (!walkable(n)) {
          if (d.site) d.site = null;
          else {
            claimed.delete(d.target);
            d.target = -1;
          }
          d.path = [];
          continue;
        }
        d.dir = n % W > d.x ? 1 : n % W < d.x ? -1 : d.dir;
        d.x = n % W;
        d.y = (n / W) | 0;
      }
      d.digging = false;
      continue;
    }
    if (d.site) {
      // on site: hammer away
      const st = d.site;
      d.digging = true;
      d.dir = (st.x0 + st.x1) / 2 >= d.x ? 1 : -1;
      st.work += speed / 60;
      if (tick % 24 === 0) sfx.tick();
      if (st.work >= st.need) finishSite(st);
      continue;
    }
    // next to the marked cell: dig it
    d.digging = true;
    d.dir = d.target % W >= d.x ? 1 : -1;
    d.work += speed;
    if (d.work >= DIGT[g[d.target]] * 4) {
      d.work = 0;
      const t = d.target;
      claimed.delete(t);
      d.target = -1;
      digCell(t);
      // grab a neighbouring mark straight away without a new search
      for (const n of [d.y * W + d.x - 1, d.y * W + d.x + 1, d.y * W + d.x - W, d.y * W + d.x + W])
        if (n >= 0 && n < W * H && mark[n] && DIGT[g[n]] && !claimed.has(n)) {
          d.target = n;
          claimed.add(n);
          break;
        }
    }
  }
  if (!diggers.some(d => !d.down))
    for (const st of [...sites]) {
      st.work += 0.25 / 60;
      if (st.work >= st.need) {
        for (const c of st.cells) {
          const i = idx(c[0], c[1]);
          if (DIGT[g[i]]) {
            g[i] = E;
            mark[i] = 0;
          }
        }
        finishSite(st);
      }
    }
  // gentle nudge if work is marked but nobody can reach it
  if (
    state === 'play' &&
    diggers.length &&
    idle === diggers.filter(d => !d.down).length &&
    idle > 0 &&
    tick % 60 === 0
  ) {
    let any = false;
    for (let i = 0; i < mark.length; i += 3)
      if (mark[i]) {
        any = true;
        break;
      }
    if (any && game.t - (updateDiggers.hinted || -99) > 25) {
      updateDiggers.hinted = game.t;
      toast("Your miners can't reach that — mark earth that touches open space");
    }
  }
}
