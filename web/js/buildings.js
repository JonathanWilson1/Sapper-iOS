// SAPPER — buildings.js
// Generators, ore, the drill, bulkhead hatches, upgrades, rooms, construction sites and placing structures.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- generators: the thing you protect. Each earns ◆; shallow ones earn more but take the shelling.
const GEN_W = 14,
  GEN_H = 7,
  GEN_MAX = 110;
const glowLoss = d => Math.min(0.8, Math.max(0, d - 20) / 200); // THE GLOW: the deeper, the more it saps a generator (never all of it)
function genRate(x, y) {
  const d = Math.max(0, y - surfOrig[Math.max(0, Math.min(W - 1, x | 0))]);
  return 1.2 * (1 - glowLoss(d));
}
// generators packed close together share the same supply line: each one's output is split with its neighbours
const GEN_SPACING = 30;
function crowd(cx, cy, skip) {
  let n = 0;
  for (const o of gens)
    if (o !== skip && Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < GEN_SPACING) n++;
  return n;
}
const genEff = gn =>
  (gn.rate / (1 + crowd(gn.x + gn.w / 2, gn.y + gn.h / 2, gn))) * (gn.oc ? 2 : 1) * (1 + 0.25 * up.gen);
function genAt(x, y) {
  for (const gn of gens) if (x >= gn.x && x < gn.x + gn.w && y >= gn.y && y < gn.y + gn.h) return gn;
  return null;
}
function addGen(x, y) {
  const gn = {
    x,
    y,
    w: GEN_W,
    h: GEN_H,
    hp: 100 + 40 * up.armour,
    max: 100 + 40 * up.armour,
    acc: 0,
    n: 0,
    hit: 0,
    oc: 0,
    cool: 0,
    rate: genRate(x + GEN_W / 2, y + GEN_H),
  };
  gens.push(gn);
  return gn;
}
const OC_TIME = 20 * 60,
  OC_COOL = 30 * 60;
function overcharge(gn) {
  if (gn.oc) return;
  if (gn.cool) {
    toast(`Still cooling — ${Math.ceil(gn.cool / 60)}s`);
    sfx.deny();
    return;
  }
  gn.oc = OC_TIME;
  learn('oc');
  sfx.thunk();
  haptic('medium');
  toast('OVERCHARGED: double output for 20s — watch for fires');
}
function hurtGen(gn, dmg) {
  if (!gn || debugGod) return;
  gn.hp -= dmg;
  gn.hit = 10;
}
function nearestGen(x, y) {
  let best = null,
    bd = 1e9;
  for (const gn of gens) {
    const d = Math.abs(gn.x + gn.w / 2 - x) + Math.abs(gn.y + gn.h / 2 - y) * 0.5;
    if (d < bd) {
      bd = d;
      best = gn;
    }
  }
  return best;
}
function updateGens() {
  for (let k = gens.length - 1; k >= 0; k--) {
    const gn = gens[k];
    if (state === 'menu') {
      gn.hp = gn.max;
      continue;
    }
    if (debugGod && gn.hp < gn.max) gn.hp = gn.max;
    if (gn.hp <= 0) {
      destroyGen(gn);
      continue;
    }
    if (state !== 'play') continue;
    if (gn.oc > 0) {
      // overcharged: double output, but it runs hot — sparks start fires around it and it wears itself down
      if (--gn.oc === 0) {
        gn.cool = OC_COOL;
        toast('Generator back to normal — cooling down');
      }
      gn.hp -= 0.01;
      if (rand() < 0.06) {
        const x = gn.x - 1 + ((rand() * (gn.w + 2)) | 0),
          y = gn.y - 2 + ((rand() * (gn.h + 2)) | 0);
        if (inB(x, y) && g[y * W + x] === E) {
          g[y * W + x] = FIRE;
          hp[y * W + x] = 50 + ((rand() * 60) | 0);
        }
      }
      if (rand() < 0.3)
        particles.push({
          x: gn.x + rand() * gn.w,
          y: gn.y,
          vx: (rand() - 0.5) * 0.4,
          vy: -0.3 - rand() * 0.3,
          life: 25,
          max: 25,
          k: 'spark',
        });
    } else if (gn.cool > 0) gn.cool--;
    gn.acc += genEff(gn) / 60;
    if (gn.acc >= 1) {
      gn.acc -= 1;
      gold += 1;
      if (++gn.n % 5 === 0) popup(gn.x + gn.w / 2, gn.y - 1, '+◆');
    }
    if (tick % 30 === 0) {
      let wet = 0;
      for (let y = gn.y - 1; y <= gn.y + gn.h; y++)
        for (let x = gn.x - 1; x <= gn.x + gn.w; x++) if (inB(x, y) && g[y * W + x] === WATER) wet++;
      if (wet > 3) {
        hurtGen(gn, wet * 0.06);
        if (!updateGens.wt || game.t - updateGens.wt > 8) {
          updateGens.wt = game.t;
          toast('A generator is flooding! Drop a PUMP nearby');
        }
      }
    }
  }
}
function destroyGen(gn) {
  gens.splice(gens.indexOf(gn), 1);
  for (let y = gn.y; y < gn.y + gn.h; y++)
    for (let x = gn.x; x < gn.x + gn.w; x++)
      if (g[y * W + x] === HQ) {
        g[y * W + x] = rand() < 0.6 ? RUBBLE : FIRE;
        hp[y * W + x] = 120;
      }
  explode(gn.x + gn.w / 2, gn.y + 3, 12, { fire: 1 });
  haptic('error');
  if (state === 'play') {
    if (gens.length === 1) {
      banner('LAST GENERATOR', 'LOSE IT AND THE LINE FALLS');
      haptic('heavy');
    } else if (gens.length) toast(`Generator lost! ${gens.length} left — build another`);
    else gameOver();
  }
}

// ---------- ore: worth ◆4 near the surface rising to ◆10 deep down, with the odd big nugget
function mineOre(x, y) {
  const d = Math.max(0, y - surfOrig[x]);
  let v = Math.round(5 + 10 * Math.min(1, d / 250));
  if (roomNear('mine', x, y, 30)) v = Math.round(v * 1.5);
  if (rand() < 0.03) {
    v = 40;
    popup(x, y, 'NUGGET +40');
    sfx.coin();
    sfx.coin();
  } else if (rand() < 0.3) popup(x, y, '+' + v);
  gold += v;
  game.mined += v;
  sfx.coin();
}

// ---------- drills: tap to bore a 3-wide shaft straight down
const DRILL_STEP = 20,
  DRILL_COST = 10,
  DRILL_W = 6;
function drillAt(w) {
  return drills.find(d => w.x >= d.x - 1.5 && w.x < d.x + DRILL_W + 1.5 && w.y >= d.y - 4 && w.y < d.y + 5.5);
}
function airdropDrill() {
  if (drills.length || state !== 'play') return;
  const gn = gens[0];
  const x = gn ? Math.max(4, Math.min(W - 10, gn.x + GEN_W + 6)) : W / 2;
  if (place('drill', x, Math.max(2, surfaceAt(x | 0) - 6), true)) {
    banner('DRILL DELIVERED', 'PARACHUTED IN AT THE SURFACE');
    const d = drills[drills.length - 1];
    cam.y = d.y - viewRows() * 0.4;
    clampCam();
  }
}
// ---------- bulkheads: hatches across the drill shaft that open for miners and medics, and shut out water
let doors = [];
function updateDoors() {
  if (tick % 4) return;
  for (let k = doors.length - 1; k >= 0; k--) {
    const dr = doors[k];
    if (!dr.open && [...Array(dr.w).keys()].some(c => g[dr.y * W + dr.x + c] !== DOOR)) {
      doors.splice(k, 1);
      continue;
    } // blown open: gone
    const near = p => p.x >= dr.x - 1 && p.x <= dr.x + dr.w && Math.abs(p.y - dr.y) <= 4;
    const want = diggers.some(d => !d.down && near(d)) || medics.some(near);
    if (want && !dr.open) {
      dr.open = true;
      for (let c = 0; c < dr.w; c++) {
        const i = dr.y * W + dr.x + c;
        if (g[i] === DOOR) g[i] = E;
      }
      if (Math.abs(dr.y - (cam.y + viewRows() / 2)) < viewRows()) sfx.tick();
    } else if (!want && dr.open) {
      let blocked = false;
      for (let c = 0; c < dr.w; c++) {
        const t = g[dr.y * W + dr.x + c];
        if (SOLID[t]) blocked = true;
      } // rubble in the way: stay open
      if (!blocked) {
        dr.open = false;
        for (let c = 0; c < dr.w; c++) {
          const i = dr.y * W + dr.x + c;
          g[i] = DOOR;
          hp[i] = 0;
        }
        if (Math.abs(dr.y - (cam.y + viewRows() / 2)) < viewRows()) sfx.thunk();
      }
    }
  }
}
// hints the player has already acted on, remembered across games
const learned = JSON.parse(localStorage.getItem('sapper.learned') || '{}');
function learn(k) {
  if (!learned[k]) {
    learned[k] = true;
    localStorage.setItem('sapper.learned', JSON.stringify(learned));
  }
}
function pressDrill(d) {
  if (gold < DRILL_COST) {
    toast('Not enough gold to run the drill');
    sfx.deny();
    return;
  }
  gold -= DRILL_COST;
  d.rem += DRILL_STEP + 10 * up.drill;
  game.drillTaps++;
  learn('drill');
  sfx.thunk();
  haptic('light');
}
function updateDrills() {
  for (let k = drills.length - 1; k >= 0; k--) {
    const d = drills[k];
    if (g[idx(d.x, d.y)] !== DRILL) {
      drills.splice(k, 1);
      if (!drills.length && state === 'play') {
        toast('Drill lost — a replacement is on its way');
        schedule(15, airdropDrill);
      }
      continue;
    }
    if (!d.rem) continue;
    const by = d.y + 4;
    if (by >= H) {
      d.rem = 0;
      continue;
    }
    let hard = false,
      block = false;
    for (let c = 0; c < DRILL_W; c++) {
      const t = g[by * W + d.x + c];
      if (t === BED || t === HQ || t === CONC || t === DRILL || t === MG || t === PUMP || t === ROOM)
        block = true;
      if (t === ROCK || t === GOLD) hard = true;
    }
    if (block) {
      d.rem = 0;
      toast("Drill hit something it can't bore through");
      continue;
    }
    d.spin = (d.spin || 0) + 1;
    if (++d.work < (hard ? 10 - 3 * up.drill : Math.max(1, 3 - up.drill))) continue;
    d.work = 0;
    for (let c = 0; c < DRILL_W; c++) {
      const i = by * W + d.x + c;
      if (g[i] === GOLD) mineOre(d.x + c, by);
      g[i] = DRILL;
      hp[i] = 0;
      prop[i] = 0;
      g[d.y * W + d.x + c] = E;
      if (rand() < 0.4)
        particles.push({
          x: d.x + c + 0.5,
          y: by,
          vx: (rand() - 0.5) * 0.5,
          vy: -0.3 - rand() * 0.3,
          life: 25,
          max: 25,
          k: 'spark',
          dirt: 1,
        });
    }
    // shore the shaft behind it: posts down both walls, a cross-brace every 8 rows
    const ty = d.y;
    prop[ty * W + d.x] = 1;
    prop[ty * W + d.x + DRILL_W - 1] = 1;
    {
      const lx = d.x + (DRILL_W >> 1) - 1;
      ladder[ty * W + lx] = 1;
      ladder[ty * W + lx + 3] = 1;
      if (ty % 2) {
        ladder[ty * W + lx + 1] = 2;
        ladder[ty * W + lx + 2] = 2;
      }
    } // rails with a rung every other row
    if ((d.depth = (d.depth || 0) + 1) % 8 === 0)
      for (let c = 0; c < DRILL_W; c++) prop[ty * W + d.x + c] = 1;
    if (d.depth % 16 === 12) {
      doors.push({ x: d.x, y: ty, w: DRILL_W, open: false });
      for (let c = 0; c < DRILL_W; c++) {
        g[ty * W + d.x + c] = DOOR;
        hp[ty * W + d.x + c] = 0;
      }
    } // a bulkhead hatch
    // solid timber lining on the outside of both walls so loose ground and water can't run in sideways
    // ...except a 2-row gap every 10 rows, so you can dig side galleries off the shaft
    for (const lx of [d.x - 1, d.x + DRILL_W])
      for (const ly of [ty, by])
        if (inB(lx, ly) && ly % 10 >= 2) {
          const li = ly * W + lx,
            lt = g[li];
          if (lt === E || lt === SOIL || lt === GRASS || lt === SAND || lt === RUBBLE || lt === WATER) {
            g[li] = TIMBER;
            hp[li] = 0;
          }
        }
    d.y++;
    d.rem--;
    if (d.rem % 4 === 0) sfx.dig();
    queueRockCheck(d.x + DRILL_W / 2, by, 5);
  }
}

// ---------- upgrades
const up = { atk: 0, shovel: 0, drill: 0, gen: 0, armour: 0, mg: 0, pump: 0 };
const UPGRADES = [
  { id: 'shovel', name: 'SHARPER SHOVELS', desc: 'Your miners dig 40% faster', costs: [60, 140, 260] },
  { id: 'drill', name: 'DRILL BITS', desc: '+10 depth per tap, bores faster', costs: [80, 180] },
  { id: 'gen', name: 'TUNED DYNAMOS', desc: 'All generators +25% output', costs: [120, 240, 400] },
  { id: 'armour', name: 'STEEL PLATING', desc: 'Generators +40 strength, fully repaired', costs: [120, 260] },
  { id: 'mg', name: 'BELT FEED', desc: 'MG nests fire twice as fast', costs: [100] },
  { id: 'pump', name: 'BIG PUMPS', desc: 'Pumps drain twice as fast, further', costs: [80] },
  {
    id: 'atk',
    name: 'WAR FOOTING',
    desc: 'Trench War only: your attacks hit harder — more shells, bigger blasts, more raiders',
    costs: [100, 220, 400],
    war: true,
  },
];
function buyUpgrade(id) {
  const u = UPGRADES.find(u => u.id === id),
    lv = up[id],
    cost = u.costs[lv];
  if (cost === undefined) return;
  if (gold < cost) {
    sfx.deny();
    toast('Not enough gold');
    return;
  }
  gold -= cost;
  up[id]++;
  sfx.thunk();
  haptic('medium');
  if (id === 'armour')
    for (const gn of gens) {
      gn.max += 40;
      gn.hp = gn.max;
    }
  renderUpgrades();
}
function renderUpgrades() {
  $('upgGold').textContent = '◆ ' + gold;
  $('upgList').innerHTML = UPGRADES.filter(u => !u.war || game.war)
    .map(u => {
      const lv = up[u.id],
        cost = u.costs[lv];
      return (
        `<div class="uprow"><div><b>${u.name}</b><small>${u.desc}</small><div class="pips">${'■'.repeat(lv)}${'□'.repeat(u.costs.length - lv)}</div></div>` +
        (cost === undefined
          ? '<button disabled>MAX</button>'
          : `<button data-up="${u.id}" ${gold < cost ? 'style="opacity:.5"' : ''}>◆${cost}</button>`) +
        '</div>'
      );
    })
    .join('');
}
function openUpgrades() {
  if (state !== 'play') return;
  state = 'paused';
  renderUpgrades();
  show('upg', true);
}

// ---------- rooms: dig a space, drop one in; each works on its own
const BAY_W = GEN_W + 4,
  BAY_H = GEN_H + 5; // every building sits in the same timber bay
const ROOMDEFS = [
  { id: 'gen', name: 'GENERATOR', desc: 'Earns ◆. Keep them 30+ cells apart; shallow pays most', cost: 100 },
  { id: 'pump', name: 'PUMP', desc: 'Drains floodwater nearby', cost: 40 },
  { id: 'miners', name: "MINERS' HUT", desc: '6 more miners to dig what you mark', cost: 100 },
  {
    id: 'hospital',
    name: 'FIELD HOSPITAL',
    desc: 'A medic carries wounded miners in and treats them. Also patches up nearby generators',
    cost: 80,
  },
  { id: 'mine', name: 'MINE HEAD', desc: 'Ore dug within 30 cells pays 50% more', cost: 90 },
  { id: 'magazine', name: 'MAGAZINE', desc: 'Pays ◆40 every wave — explodes if hit', cost: 50 },
  { id: 'listen', name: 'LISTENING POST', desc: 'Hears enemy tunnellers within 90 cells', cost: 40 },
];
for (const r of ROOMDEFS) {
  r.w = BAY_W;
  r.h = BAY_H;
}
let roomPending = null;
function openRooms() {
  if (state !== 'play') return;
  state = 'paused';
  $('roomGold').textContent = '◆ ' + gold;
  $('roomList').innerHTML = ROOMDEFS.map(
    r =>
      `<div class="uprow"><div><b>${r.name}</b><small>${r.desc}</small></div><button data-room="${r.id}" ${gold < ITEM[r.id].cost ? 'style="opacity:.5"' : ''}>◆${ITEM[r.id].cost}</button></div>`
  ).join('');
  show('roomsScr', true);
}
function chooseRoom(id) {
  show('roomsScr', false);
  state = 'play';
  last = performance.now();
  if (gold < ITEM[id].cost) {
    toast('Not enough gold');
    sfx.deny();
    return;
  }
  roomPending = id;
  toast(`Tap open space in a tunnel to place the ${ITEM[id].name}`);
}
const roomNear = (kind, x, y, r) =>
  rooms.some(o => o.kind === kind && Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y) < r);
function updateRooms() {
  for (let k = rooms.length - 1; k >= 0; k--) {
    const r = rooms[k];
    if (g[idx(r.x, r.y)] !== ROOM) {
      rooms.splice(k, 1);
      if (r.kind === 'magazine') {
        explode(r.x + r.w / 2, r.y + r.h / 2, 20, { fire: 1 });
        if (state === 'play') toast('The magazine went up!');
      } else if (state === 'play') toast(`${ITEM[r.kind].name} destroyed`);
      continue;
    }
    if (state !== 'play') continue;
    if (r.kind === 'hospital' && tick % 30 === 0)
      for (const gn of gens)
        if (
          Math.hypot(gn.x + gn.w / 2 - r.x - r.w / 2, gn.y + gn.h / 2 - r.y - r.h / 2) < 40 &&
          gn.hp < gn.max
        ) {
          gn.hp = Math.min(gn.max, gn.hp + 0.6);
          if (tick % 180 === 0) popup(gn.x + gn.w / 2, gn.y - 1, '+HP');
        }
  }
}

// ---------- structures / stamps
const ITEMS = [
  { id: 'prop', name: 'PROP', cost: 10, kind: 'stamp' },
  { id: 'concrete', name: 'CONCRETE', cost: 1, kind: 'draw' },
  { id: 'mg', name: 'MG', cost: 60, kind: 'stamp' },
  { id: 'room', name: 'ROOM', cost: 0, kind: 'action' },
  { id: 'upg', name: 'UPGRADE', cost: 0, kind: 'action' },
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
for (const r of ROOMDEFS) ITEM[r.id] = { ...r, kind: 'room', base: r.cost };
const free = (x, y) => inB(x, y) && !SOLID[g[idx(x, y)]];

function propCells(cx, cy) {
  if (!free(cx, cy)) return null;
  let top = cy;
  while (top > cy - 16 && top > 0 && free(cx, top - 1)) top--;
  const ceil = top > cy - 16 && top > 0;
  let bot = cy;
  while (bot < cy + 16 && bot < H - 1 && free(cx, bot + 1)) bot++;
  const floor = bot < cy + 16;
  if (!ceil && !floor) return null;
  if (!ceil) top = bot - 8;
  if (!floor) bot = top + 9;
  let L = cx;
  while (L > cx - 12 && L > 0 && free(L - 1, top)) L--;
  let R = cx;
  while (R < cx + 12 && R < W - 1 && free(R + 1, top)) R++;
  if (!ceil || R - L > 22 || R - L < 2) {
    L = Math.max(0, cx - 4);
    R = Math.min(W - 1, cx + 4);
  }
  const out = [];
  for (let x = L; x <= R; x++) {
    out.push([x, top, PROPBG]);
    out.push([x, top + 1, PROPBG]);
  }
  for (let y = top + 2; y <= bot; y++) {
    out.push([L, y, PROPBG]);
    out.push([R, y, PROPBG]);
  }
  if (bot - top >= 4) out.push([(L + R) >> 1, top + 2, LAMP]); // every prop hangs a lamp from its beam
  return out;
}
function rectCells(cx, cy, w, h, t) {
  const out = [];
  const x0 = Math.round(cx - w / 2),
    y0 = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([x0 + x, y0 + y, t]);
  return out;
}
// drop a block straight down until it lands, so releasing it over open air just works
function dropRect(cx, cy, w, h, t) {
  let best = rectCells(cx, cy, w, h, t);
  for (let k = 0; k < 48; k++) {
    const cs = rectCells(cx, cy + k, w, h, t);
    if (cs.some(c => !free(c[0], c[1]))) break;
    best = cs;
    const by = cs[0][1] + h;
    if (cs.slice(-w).some(c => !free(c[0], by))) break;
  }
  return best;
}
// footprints of everything built or being built, for snapping new sites into rows
function footprints() {
  const f = [];
  // `floor` is the row people stand on: under a room, or the concrete pad of a generator bay
  for (const r of rooms)
    f.push(
      r.bay
        ? { x0: r.x - 1, y0: r.y - 2, x1: r.x + r.w, y1: r.y + r.h, floor: r.y + r.h }
        : { x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1, floor: r.y + r.h }
    );
  for (const gn of gens)
    f.push({ x0: gn.x - 2, y0: gn.y - 4, x1: gn.x + gn.w + 1, y1: gn.y + gn.h, floor: gn.y + gn.h });
  for (const st of sites) f.push({ x0: st.x0, y0: st.y0, x1: st.x1, y1: st.y1, floor: st.y1 });
  return f;
}
// a construction site can be laid over open space or solid earth; the miners dig it out first
function siteStamp(id, cx, cy) {
  const d = ITEM[id],
    w = d.w,
    h = d.h,
    t = id === 'gen' ? HQ : id === 'pump' ? PUMP : ROOM;
  let x0 = Math.round(cx - w / 2),
    y0 = Math.round(cy - h / 2),
    snapped = false;
  const fp = footprints();
  // line up floors with the nearest neighbour that's roughly level
  const myFloor = h - 1;
  let best = null,
    bd = 1e9; // every bay stands on its own concrete pad (bottom row)
  for (const nb of fp)
    if (Math.abs(y0 + myFloor - nb.floor) <= 3) {
      const gap = x0 > nb.x1 ? x0 - nb.x1 : nb.x0 > x0 + w - 1 ? nb.x0 - (x0 + w - 1) : 0;
      if (gap < 40 && gap < bd) {
        bd = gap;
        best = nb;
      }
    }
  if (best) {
    y0 = best.floor - myFloor;
    snapped = true;
  }
  for (const nb of fp)
    if (y0 <= nb.y1 && y0 + h - 1 >= nb.y0) {
      // butt up against neighbours
      if (Math.abs(x0 - (nb.x1 + 1)) <= 3) {
        x0 = nb.x1 + 1;
        snapped = true;
        break;
      }
      if (Math.abs(x0 + w - 1 - (nb.x0 - 1)) <= 3) {
        x0 = nb.x0 - w;
        snapped = true;
        break;
      }
    }
  // dropped into open air: let it fall to the floor like before
  const clearAt = yy => {
    for (let y = yy; y < yy + h; y++)
      for (let x = x0; x < x0 + w; x++) if (!inB(x, y) || SOLID[g[y * W + x]]) return false;
    return true;
  };
  const floorAt = yy => {
    for (let x = x0; x < x0 + w; x++) if (inB(x, yy + h) && SOLID[g[(yy + h) * W + x]]) return true;
    return false;
  };
  if (!snapped && clearAt(y0) && !floorAt(y0))
    for (let k = 1; k < 48; k++) {
      if (!clearAt(y0 + k)) break;
      if (floorAt(y0 + k)) {
        y0 += k;
        break;
      }
    }
  const cells = [];
  let ok = true,
    solid = 0,
    onSite = false,
    below = false;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      let ct = t;
      if (id === 'gen') {
        // posts and a two-row beam round the edge, an open bay, the dynamo, a concrete pad
        const lx = x - x0,
          ly = y - y0;
        ct =
          ly === h - 1
            ? CONC
            : ly < 2 || lx === 0 || lx === w - 1
              ? PROPBG
              : lx >= 2 && lx < w - 2 && ly >= h - 1 - GEN_H
                ? HQ
                : E; // headroom between beam and engine, like the starting chamber
      } else {
        // same bay for everything else: the room fills the inside; a pump sits in the middle on the pad
        const lx = x - x0,
          ly = y - y0;
        ct =
          ly === h - 1
            ? CONC
            : ly < 2 || lx === 0 || lx === w - 1
              ? PROPBG
              : id === 'pump'
                ? lx >= w / 2 - 2 && lx < w / 2 + 2 && ly >= h - 4
                  ? PUMP
                  : E
                : ROOM;
      }
      const c = [x, y, ct];
      if (!inB(x, y)) {
        c.ok = false;
        ok = false;
        cells.push(c);
        continue;
      }
      const tt = g[y * W + x];
      c.ok = !SOLID[tt] || DIGT[tt] > 0;
      if (siteCovers(x, y)) {
        c.ok = false;
        onSite = true;
      }
      if (!c.ok) ok = false;
      if (SOLID[tt]) solid++;
      if (y === y0 + h - 1 && inB(x, y + 1) && SOLID[g[(y + 1) * W + x]]) below = true;
      cells.push(c);
    }
  return { cells, ok: ok && (solid > 0 || below), onSite, snapped };
}
function stampFor(id, cx, cy, asSite) {
  cx = Math.floor(cx);
  cy = Math.floor(cy);
  if (asSite && BUILT.has(id)) return siteStamp(id, cx, cy);
  let cells,
    needAll = false;
  switch (id) {
    case 'prop':
      cells = propCells(cx, cy);
      if (!cells) return { cells: [], ok: false };
      break;
    case 'bags':
      cells = dropRect(cx, cy, 9, 3, BAGS);
      break;
    case 'concrete':
      cells = dropRect(cx, cy, 10, 4, CONC);
      break;
    case 'lamp':
      cells = [[cx, cy, LAMP]];
      needAll = true;
      break;
    case 'pump':
      cells = dropRect(cx, cy, 4, 3, PUMP);
      needAll = true;
      break;
    case 'mg':
      cells = dropRect(cx, cy, 5, 2, MG);
      needAll = true;
      break;
    case 'drill':
      cells = dropRect(cx, cy, DRILL_W, 4, DRILL);
      needAll = true;
      break;
    case 'gen':
      cells = dropRect(cx, cy, GEN_W, GEN_H, HQ);
      needAll = true;
      break;
    case 'miners':
    case 'hospital':
    case 'mine':
    case 'magazine':
    case 'listen': {
      const d = ITEM[id];
      cells = dropRect(cx, cy, d.w, d.h, ROOM);
      needAll = true;
      break;
    }
    default:
      return { cells: [], ok: false };
  }
  const set = new Set(cells.map(c => c[1] * W + c[0]));
  let placeable = 0,
    anchored = false;
  for (const c of cells) {
    c.ok = free(c[0], c[1]);
    if (!c.ok) continue;
    placeable++;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = c[0] + dx,
        ny = c[1] + dy;
      if (inB(nx, ny) && !set.has(ny * W + nx) && (SOLID[g[idx(nx, ny)]] || prop[idx(nx, ny)]))
        anchored = true;
    }
  }
  if (cells.some(c => siteCovers(c[0], c[1]))) return { cells, ok: false, onSite: true };
  const ok = anchored && (needAll ? placeable === cells.length : placeable >= cells.length * 0.5);
  if (id === 'gen' && genRate(cells[0][0] + GEN_W / 2, cells[0][1] + GEN_H) <= 0)
    return { cells, ok: false, tooDeep: true };
  return { cells, ok };
}
// Generators, pumps and rooms are built by your miners: placing one lays out a construction site
const BUILT = new Set(['gen', 'pump', 'miners', 'hospital', 'mine', 'magazine', 'listen']);
const BUILD_TIME = { gen: 12, pump: 5, listen: 4 }; // miner-seconds of work; other rooms take 10
let sites = [];
const siteCovers = (x, y) => sites.some(st => x >= st.x0 && x <= st.x1 && y >= st.y0 && y <= st.y1);
function commitStructure(id, cells) {
  for (const c of cells) {
    const i = idx(c[0], c[1]),
      t = g[i];
    if (c[2] === E) continue;
    if (c[2] === PROPBG) {
      if (!SOLID[t]) prop[i] = 1;
    } else if (t === E || t === WATER || t === FIRE || t === RUBBLE || t === SAND) setCell(c[0], c[1], c[2]);
  }
  const c = cells[0],
    it = ITEM[id];
  if (id === 'pump') {
    const m = cells.find(q => q[2] === PUMP) || c;
    pumps.push({ x: m[0], y: m[1], spin: 0 });
  }
  if (id === 'mg') mgs.push({ x: c[0], y: c[1], cool: 0, ang: -Math.PI / 2, flash: 0 });
  if (id === 'gen') {
    const m = cells.find(q => q[2] === HQ) || c;
    addGen(m[0], m[1]);
  }
  if (id === 'drill') drills.push({ x: c[0], y: c[1], rem: 0, work: 0 });
  if (it && it.kind === 'room' && id !== 'gen' && id !== 'pump') {
    const rc = cells.filter(q => q[2] === ROOM);
    const src = rc.length ? rc : cells;
    let x0 = 1e9,
      y0 = 1e9,
      x1 = -1,
      y1 = -1;
    for (const q of src) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
    rooms.push({
      kind: id,
      x: x0,
      y: y0,
      w: x1 - x0 + 1,
      h: y1 - y0 + 1,
      fresh: id === 'miners',
      bay: rc.length > 0 && rc.length < cells.length,
    });
  }
}
// board up the gap between a new room and the tunnel ceiling so tunnels stay neat
function backfillAbove(cells) {
  let x0 = 1e9,
    x1 = -1,
    y0 = 1e9;
  for (const c of cells) {
    x0 = Math.min(x0, c[0]);
    x1 = Math.max(x1, c[0]);
    y0 = Math.min(y0, c[1]);
  }
  for (let x = x0; x <= x1; x++) {
    const run = [];
    for (let y = y0 - 1; y >= Math.max(0, y0 - 10); y--) {
      const i = y * W + x;
      if (g[i] === E) {
        run.push(i);
        continue;
      }
      if (SOLID[g[i]])
        for (const j of run) {
          g[j] = TIMBER;
          hp[j] = 0;
          prop[j] = 0;
        }
      break;
    }
  }
}
// a site buried in solid earth gets an access passage marked from the nearest open space
function connectSite(st) {
  const fp = new Set(st.cells.map(c => idx(c[0], c[1])));
  for (const i of fp) {
    const x = i % W;
    for (const n of [i - 1, i + 1, i - W, i + W])
      if (n >= 0 && n < W * H && !fp.has(n) && Math.abs((n % W) - x) <= 1 && walkable(n)) return;
  } // already touches open space
  bfsGen++;
  const q = [];
  for (const i of fp) {
    bfsSeen[i] = bfsGen;
    bfsPrev[i] = -1;
    q.push(i);
  }
  for (let qi = 0; qi < q.length && qi < 20000; qi++) {
    const c = q[qi],
      cx = c % W;
    for (const n of [c - W, c - 1, c + 1, c + W]) {
      if (n < 0 || n >= W * H) continue;
      if ((n === c - 1 && cx === 0) || (n === c + 1 && cx === W - 1)) continue;
      if (bfsSeen[n] === bfsGen) continue;
      bfsSeen[n] = bfsGen;
      bfsPrev[n] = c;
      if (walkable(n)) {
        for (let p = c; p !== -1 && !fp.has(p); p = bfsPrev[p]) {
          mark[p] = 1;
          if (p - W >= 0 && DIGT[g[p - W]] && !fp.has(p - W)) mark[p - W] = 1;
        }
        return;
      } // a 2-tall passage
      if (DIGT[g[n]]) q.push(n);
    }
  }
}
function finishSite(st) {
  sites.splice(sites.indexOf(st), 1);
  commitStructure(st.id, st.cells);
  if (st.id !== 'listen') backfillAbove(st.cells);
  for (const d of diggers)
    if (d.site === st) {
      d.site = null;
      d.digging = false;
    }
  const it = ITEM[st.id];
  sfx.thunk();
  haptic('medium');
  if (state === 'play') {
    if (st.id === 'gen') {
      const gn = gens[gens.length - 1],
        n = crowd(gn.x + gn.w / 2, gn.y + gn.h / 2, gn);
      toast(
        `Generator online: +${Math.round(genEff(gn) * 60)} ◆/min` +
          (n ? ` (crowded — space them ${GEN_SPACING}+ apart)` : '')
      );
    } else toast(`${it.name} built`);
  }
}
function place(id, cx, cy, freeOfCharge) {
  const it = ITEM[id];
  if (!freeOfCharge && gold < it.cost) {
    toast('Not enough gold — dig for ore ◆');
    sfx.deny();
    return false;
  }
  const s = stampFor(id, cx, cy, !freeOfCharge);
  if (!s.ok) {
    if (!freeOfCharge) {
      toast(
        s.onSite
          ? 'Something is already being built there'
          : id === 'prop'
            ? 'Drop props inside a tunnel or on solid ground'
            : 'Needs open space touching solid ground'
      );
      sfx.deny();
    }
    return false;
  }
  const cells = s.cells.filter(c => c.ok);
  if (freeOfCharge) {
    commitStructure(id, cells);
    return true;
  }
  gold -= it.cost;
  sfx.thunk();
  haptic('light');
  if (BUILT.has(id)) {
    let x0 = 1e9,
      x1 = -1,
      y0 = 1e9,
      y1 = -1;
    for (const c of cells) {
      x0 = Math.min(x0, c[0]);
      x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]);
      y1 = Math.max(y1, c[1]);
    }
    sites.push({ id, cells, x0, x1, y0, y1, work: 0, need: BUILD_TIME[id] || 10, clear: false });
    for (const c of cells) {
      const i = idx(c[0], c[1]);
      if (SOLID[g[i]] && DIGT[g[i]]) mark[i] = 1;
    } // the footprint is dug out first
    connectSite(sites[sites.length - 1]);
    for (const c of cells) if (c[1] <= y0 + 1 || c[0] === x0 || c[0] === x1) prop[idx(c[0], c[1])] = 1; // temporary shoring: holds the roof while it's dug out
    it.cost += id === 'gen' ? 30 : id === 'pump' ? 0 : id === 'listen' ? 20 : 40;
    toast(
      cells.some(c => SOLID[g[idx(c[0], c[1])]])
        ? `${it.name}: miners will dig out the site, then build it`
        : `${it.name}: site marked — your miners will build it`
    );
    return true;
  }
  commitStructure(id, cells);
  if (id === 'prop') game.props++;
  return true;
}
function doAction(id) {
  const it = ITEM[id];
  if (id === 'upg') {
    openUpgrades();
    return;
  }
  if (id === 'room') {
    if (roomPending) {
      roomPending = null;
      toast('Room placement cancelled');
      return;
    }
    openRooms();
    return;
  }
  if (gold < it.cost) {
    toast('Not enough gold');
    sfx.deny();
    return;
  }
  if (id === 'repair') {
    const gn = gens.reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a), gens[0]);
    if (!gn || gn.hp >= gn.max) {
      toast('Generators are at full strength');
      return;
    }
    gn.hp = Math.min(gn.max, gn.hp + 40);
    gold -= it.cost;
    toast('Most damaged generator patched +40');
    sfx.thunk();
  }
  haptic('medium');
}
