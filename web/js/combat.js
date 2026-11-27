// SAPPER — combat.js
// Shells and meteors, raiders and enemy tunnellers, pumps and MG nests, particles.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- shells / meteors
const isMet = k => k === 'meteor' || k === 'giant';
function spawnShell(kind, x) {
  const K = {
    light: { r: 6, pen: 0 },
    howitzer: { r: 9, pen: 4 },
    heavy: { r: 13, pen: 9 },
    meteor: { r: 32, pen: 22 },
    giant: { r: 50, pen: 34 },
    buster: { r: 22, pen: 40 },
  }[kind];
  const s = {
    kind,
    x,
    y: -170 - rand() * 40,
    vx: (rand() - 0.5) * 0.25,
    vy: 1.1,
    r: K.r,
    pen: K.pen + Math.floor(game.intensity - 1),
    whistled: false,
  };
  if (isMet(kind)) {
    s.vx = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.4);
    s.x = x - s.vx * 150;
    s.vy = 1.4;
    s.y = -160;
  }
  shells.push(s);
  return s;
}
function updateShells() {
  for (let k = shells.length - 1; k >= 0; k--) {
    const s = shells[k];
    if (s.burrow) {
      // driller bomb: chew straight down, then blow
      s.spin = (s.spin || 0) + 1;
      if (s.spin % 3 === 0) {
        const nx = Math.floor(s.x),
          ny = Math.floor(s.y) + 1;
        let stop = ny >= H - 3 || s.y >= s.digTo;
        for (const x of [nx - 1, nx, nx + 1])
          if (inB(x, ny)) {
            const t = g[ny * W + x];
            if (t === CONC || t === HQ || t === ROOM || t === BED || t === DOOR) stop = true;
          }
        if (stop) {
          shells.splice(k, 1);
          explode(s.x, s.y, s.r, { fire: 0.4, shell: true });
          continue;
        }
        for (const x of [nx - 1, nx, nx + 1])
          if (inB(x, ny)) {
            const i = ny * W + x;
            if (DIGT[g[i]] || g[i] === WATER || g[i] === TIMBER) {
              g[i] = E;
              hp[i] = 0;
            }
          }
        s.y += 1;
        if (rand() < 0.6)
          particles.push({
            x: s.x,
            y: s.y - 2,
            vx: (rand() - 0.5) * 0.4,
            vy: -0.2 - rand() * 0.2,
            life: 20,
            max: 20,
            k: 'spark',
            dirt: 1,
          });
        if (s.spin % 12 === 0 && Math.abs(s.y - (cam.y + viewRows() / 2)) < viewRows()) sfx.dig();
      }
      continue;
    }
    s.vy += isMet(s.kind) ? 0.01 : 0.025;
    if (!s.whistled && s.y > cam.y - 60 && s.kind !== 'meteor') {
      s.whistled = true;
      sfx.whistle(s.kind === 'buster');
    }
    if (s.kind === 'giant')
      for (let q = 0; q < 3; q++)
        particles.push({
          x: s.x + (rand() - 0.5) * 5,
          y: s.y + (rand() - 0.5) * 5,
          vx: -s.vx * 0.2 + (rand() - 0.5) * 0.3,
          vy: -s.vy * 0.2,
          life: 45,
          max: 45,
          k: 'spark',
        });
    if (isMet(s.kind) && rand() < 0.9)
      particles.push({
        x: s.x,
        y: s.y,
        vx: -s.vx * 0.2 + (rand() - 0.5) * 0.2,
        vy: -s.vy * 0.2,
        life: 30,
        max: 30,
        k: 'spark',
      });
    const n = Math.ceil(Math.hypot(s.vx, s.vy) * 2);
    let dead = false;
    for (let j = 0; j < n && !dead; j++) {
      s.x += s.vx / n;
      s.y += s.vy / n;
      if (s.x < 0 || s.x >= W || s.y >= H) {
        dead = true;
        break;
      }
      const cx = Math.floor(s.x),
        cy = Math.floor(s.y);
      if (cy < 0) continue;
      const t = g[cy * W + cx];
      if (SOLID[t]) {
        if (s.pen > 0 && !s.breached && (t === SOIL || t === GRASS || t === SAND || t === RUBBLE)) {
          s.pen -= 1;
          s.vy *= 0.93;
          continue;
        }
        if (s.kind === 'buster' && s.pen > 0 && t !== BED && !(s.breached && t !== CONC)) {
          if (t === CONC) s.breached = true;
          s.pen -= Math.max(1, RES[t]);
          s.vy *= 0.95;
          continue;
        } // punches through the slab, then goes off on whatever it was protecting
        if (s.kind === 'driller') {
          s.burrow = true;
          s.x = Math.floor(s.x) + 0.5;
          s.y = Math.floor(s.y);
          break;
        }
        if (isMet(s.kind) && state === 'play') game.meteors++;
        explode(s.x, s.y, s.r, {
          fire: isMet(s.kind) ? 1.5 : s.kind === 'heavy' || s.kind === 'buster' ? 0.3 : 0.12,
          shell: !isMet(s.kind),
        });
        dead = true;
      } else if (soldiers.some(o => Math.abs(o.x - s.x) < 1.2 && s.y > o.y - 4 && s.y < o.y + 1)) {
        explode(s.x, s.y, s.r, { fire: 0.1 });
        dead = true;
      }
    }
    if (dead) shells.splice(k, 1);
  }
}

// ---------- soldiers (raiders)
const passable = (x, y) => x >= 0 && x < W && (y < 0 || (y < H && !SOLID[g[y * W + x]]));
function colFree(x, y) {
  for (let k = 0; k < 4; k++) if (!passable(x, y - k)) return false;
  return true;
}
function surfaceAt(x) {
  for (let y = 0; y < H - 1; y++) if (SOLID[g[y * W + x]]) return y - 1;
  return H - 2;
}
function spawnSoldier(side) {
  const x = side < 0 ? 1 : W - 2;
  const y = surfaceAt(x);
  soldiers.push({
    x: x + 0.5,
    y,
    fy: 0,
    vy: 0,
    hp: 3,
    dir: side < 0 ? 1 : -1,
    work: 0,
    anim: rand() * 10,
    atk: 0,
  });
}
function nearHQ(cx, cy) {
  for (let y = cy - 4; y <= cy + 1; y++)
    for (let x = cx - 2; x <= cx + 2; x++) if (inB(x, y) && g[y * W + x] === HQ) return true;
  return false;
}
function workOn(s, x, y) {
  if (!inB(x, y)) return;
  const i = y * W + x,
    t = g[i];
  if (t === HQ) {
    hurtGen(genAt(x, y), 0.012);
    s.atk = 6;
    return;
  }
  const need = {
    [SOIL]: 14,
    [GRASS]: 14,
    [SAND]: 8,
    [RUBBLE]: 8,
    [ROCK]: 110,
    [GOLD]: 100,
    [TIMBER]: 50,
    [BAGS]: 70,
    [CONC]: 260,
    [PUMP]: 90,
    [MG]: 90,
    [LAMP]: 20,
    [DRILL]: 90,
    [ROOM]: 90,
  }[t];
  if (!need) return;
  s.work++;
  s.atk = 4;
  if (s.work >= need) {
    g[i] = E;
    hp[i] = 0;
    s.work = 0;
  }
}
function spawnTunneller(side) {
  const gn = gens.length ? gens[(drand() * gens.length) | 0] : null;
  if (!gn) return;
  const y = gn.y + gn.h - 1,
    x = side < 0 ? 1.5 : W - 1.5;
  soldiers.push({
    tun: true,
    x,
    y,
    fy: 0,
    vy: 0,
    hp: 3,
    dir: side < 0 ? 1 : -1,
    work: 0,
    anim: 0,
    atk: 0,
    target: gn,
    carved: [],
    revealed: false,
    fuse: 0,
    speed: 45,
  });
}
// enemy tunnellers dig a hidden gallery toward a generator and plant a mine; a listening post reveals them
function updateTunneller(s) {
  s.anim += 0.1;
  if (s.hp <= 0) {
    gold += 30;
    game.kills++;
    game.tunnellersStopped = (game.tunnellersStopped || 0) + 1;
    popup(s.x, s.y - 4, '+30');
    if (state === 'play') toast('Enemy tunneller stopped  +◆30');
    for (const i of s.carved) secret[i] = 0;
    return true;
  }
  if (!gens.includes(s.target)) s.target = nearestGen(s.x, s.y);
  const gn = s.target;
  if (!gn) return true;
  const heard = roomNear('listen', s.x, s.y, 90);
  if (heard && !s.revealed) {
    s.revealed = true;
    if (state === 'play') {
      banner('TUNNELLER DETECTED', 'DIG INTO THEIR GALLERY TO STOP THEM');
      haptic('medium');
    }
  }
  if (s.revealed && tick % 20 === 0) for (const i of s.carved) secret[i] = 0;
  if (s.fuse > 0) {
    if (s.revealed && tick % 15 === 0) sfx.tick();
    if (--s.fuse === 0) {
      for (const i of s.carved) secret[i] = 0;
      explode(s.x, s.y - 1, 16, { fire: 0.5 });
      if (state === 'play') toast('An enemy mine went off!');
      return true;
    }
    return false;
  }
  const gx = gn.x + gn.w / 2;
  s.dir = Math.sign(gx - s.x) || s.dir;
  if (Math.abs(gx - s.x) < gn.w / 2 + 3) {
    s.fuse = 6 * 60;
    if (s.revealed && state === 'play') banner('MINE PLANTED', '6 SECONDS — STOP THEM');
    return false;
  }
  if (s.revealed && tick % 40 === 0) sfx.dig();
  if (++s.work < s.speed) return false;
  s.work = 0;
  const nx = Math.floor(s.x) + s.dir;
  let hard = false;
  for (let k = 0; k < 3; k++) {
    const yy = s.y - k;
    if (!inB(nx, yy)) continue;
    const i = yy * W + nx,
      t = g[i];
    if (t === CONC || t === HQ || t === ROOM || t === BED || t === DRILL) {
      s.fuse = 6 * 60;
      if (s.revealed && state === 'play') banner('MINE PLANTED', '6 SECONDS — STOP THEM');
      return false;
    }
    if (t === ROCK || t === GOLD) hard = true;
    if (t !== E && t !== WATER) {
      g[i] = E;
      hp[i] = 0;
      prop[i] = 0;
      if (!s.revealed) secret[i] = 1;
      s.carved.push(i);
    }
  }
  if (hard) s.work = -s.speed * 2;
  s.x = nx + 0.5;
  return false;
}
function updateSoldiers() {
  for (let k = soldiers.length - 1; k >= 0; k--) {
    const s = soldiers[k];
    if (s.tun) {
      if (updateTunneller(s)) soldiers.splice(k, 1);
      continue;
    }
    s.anim += 0.15;
    if (s.atk > 0) s.atk--;
    let cx = Math.floor(s.x),
      cy = s.y;
    if (!passable(cx, cy - 1) || !passable(cx, cy - 2)) s.hp -= 0.1; // buried
    if (inB(cx, cy - 3) && g[(cy - 3) * W + cx] === WATER) s.hp -= 0.012; // drowning
    if (inB(cx, cy - 1) && g[(cy - 1) * W + cx] === FIRE) s.hp -= 0.05;
    if (s.hp <= 0) {
      for (let n = 0; n < 8; n++)
        particles.push({
          x: s.x,
          y: s.y - 2,
          vx: (rand() - 0.5) * 0.4,
          vy: -rand() * 0.4,
          life: 40,
          max: 40,
          k: 'gib',
        });
      soldiers.splice(k, 1);
      gold += 3;
      game.kills++;
      popup(s.x, s.y - 5, '+3');
      continue;
    }
    if (passable(cx, cy + 1)) {
      // falling
      s.vy = Math.min(s.vy + 0.04, 1);
      s.fy += s.vy;
      while (s.fy >= 1) {
        if (passable(cx, s.y + 1)) {
          s.y++;
          s.fy -= 1;
        } else {
          s.fy = 0;
          s.vy = 0;
          break;
        }
      }
      if (s.y >= H - 2) s.hp = 0;
      continue;
    }
    s.vy = 0;
    s.fy = 0;
    if (nearHQ(cx, cy)) {
      for (let y = cy - 4; y <= cy + 1; y++)
        for (let x = cx - 2; x <= cx + 2; x++)
          if (inB(x, y) && g[y * W + x] === HQ) {
            hurtGen(genAt(x, y), 0.012 / 5);
          }
      s.atk = 6;
      continue;
    }
    const tg = nearestGen(s.x, s.y);
    if (!tg) continue;
    const tx = tg.x + tg.w / 2;
    let dir = Math.abs(tx - s.x) < 1.5 ? 0 : Math.sign(tx - s.x);
    if (dir === 0) {
      workOn(s, cx, cy + 1);
      continue;
    } // sap straight down toward the post
    s.dir = dir;
    const nx = Math.floor(s.x + dir * 0.11);
    if (nx === cx) {
      s.x += dir * 0.11;
      continue;
    }
    if (colFree(nx, cy)) {
      s.x += dir * 0.11;
      s.work = 0;
    } else if (colFree(nx, cy - 1) && passable(cx, cy - 4)) {
      s.y--;
      s.x += dir * 0.11;
    } else {
      for (let kk = 0; kk < 4; kk++)
        if (!passable(nx, cy - kk)) {
          workOn(s, nx, cy - kk);
          break;
        }
    }
  }
}

// ---------- pumps & machine guns
function updateMachines() {
  for (let k = pumps.length - 1; k >= 0; k--) {
    const p = pumps[k];
    if (g[idx(p.x, p.y)] !== PUMP) {
      pumps.splice(k, 1);
      continue;
    }
    if (tick % 3) continue;
    const cand = [];
    const R = up.pump ? 15 : 11,
      px = p.x + 2,
      py = p.y + 1;
    for (let y = py - R; y <= py + R; y++)
      for (let x = px - R; x <= px + R; x++)
        if (inB(x, y) && g[y * W + x] === WATER && (x - px) ** 2 + (y - py) ** 2 <= R * R)
          cand.push(y * W + x);
    if (cand.length) p.spin += 0.4;
    for (let n = 0; n < (up.pump ? 8 : 4) && cand.length; n++) {
      const j = cand.splice((rand() * cand.length) | 0, 1)[0];
      g[j] = E;
    }
  }
  for (let k = mgs.length - 1; k >= 0; k--) {
    const m = mgs[k];
    if (g[idx(m.x, m.y)] !== MG) {
      mgs.splice(k, 1);
      continue;
    }
    if (m.flash > 0) m.flash--;
    if (--m.cool > 0) continue;
    const mx = m.x + 2.5,
      my = m.y - 0.5;
    let best = null,
      bd = 48;
    for (const s of soldiers) {
      const d = Math.hypot(s.x - mx, s.y - 2 - my);
      if (d < bd && los(mx, my, s.x, s.y - 2)) {
        bd = d;
        best = s;
      }
    }
    if (!best) {
      m.cool = 10;
      continue;
    }
    m.ang = Math.atan2(best.y - 2 - my, best.x - mx);
    m.cool = up.mg ? 3 : 7;
    m.flash = 3;
    const hit = rand() < 0.55;
    if (hit) best.hp -= 1;
    tracers.push({
      x1: mx,
      y1: my,
      x2: best.x + (hit ? 0 : (rand() - 0.5) * 4),
      y2: best.y - 2 + (hit ? 0 : (rand() - 0.5) * 4),
      life: 4,
    });
    sfx.mg();
  }
}
function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  for (let s = 2; s < d - 1; s++) {
    const x = Math.floor(x0 + ((x1 - x0) * s) / d),
      y = Math.floor(y0 + ((y1 - y0) * s) / d);
    if (inB(x, y)) {
      const t = g[y * W + x];
      if (SOLID[t] && t !== MG) return false;
    }
  }
  return true;
}

// ---------- particles
function updateParticles() {
  for (let k = particles.length - 1; k >= 0; k--) {
    const p = particles[k];
    p.life--;
    if (p.k === 'smoke') {
      p.x += p.vx + 0.01;
      p.y += p.vy;
      p.vy *= 0.995;
    } else if (p.k === 'glow') {
      p.x += p.vx;
      p.y += p.vy;
    } else if (p.k === 'spark') {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.vx *= 0.96;
    } else if (p.k === 'rain') {
      p.y += p.vy;
      p.x += p.vx;
      const cx = Math.floor(p.x),
        cy = Math.floor(p.y);
      if (inB(cx, cy) && SOLID[g[cy * W + cx]]) p.life = 0;
    } else {
      // debris / gib
      const ox = p.x,
        oy = p.y;
      p.vy += 0.03;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      const cx = Math.floor(p.x),
        cy = Math.floor(p.y);
      if (cx < 0 || cx >= W || cy >= H) {
        p.life = 0;
      } else if (cy >= 0 && SOLID[g[cy * W + cx]]) {
        if (p.k === 'debris') {
          const ax = Math.floor(ox),
            ay = Math.floor(oy);
          if (inB(ax, ay) && g[ay * W + ax] === E) {
            g[ay * W + ax] = p.t;
            sh[ay * W + ax] = (rand() * 255) | 0;
          }
        }
        p.life = 0;
      }
    }
    if (p.life <= 0) particles.splice(k, 1);
  }
  for (let k = flashes.length - 1; k >= 0; k--) if (--flashes[k].life <= 0) flashes.splice(k, 1);
  for (let k = tracers.length - 1; k >= 0; k--) if (--tracers[k].life <= 0) tracers.splice(k, 1);
  for (let k = popups.length - 1; k >= 0; k--) {
    popups[k].y -= 0.08;
    if (--popups[k].life <= 0) popups.splice(k, 1);
  }
  for (let k = flares.length - 1; k >= 0; k--) {
    const f = flares[k];
    f.y += 0.05;
    f.x += f.vx;
    if (--f.life <= 0) flares.splice(k, 1);
  }
}
function popup(x, y, txt) {
  popups.push({ x, y, txt, life: 60 });
}
