// SAPPER — multiplayer.js
// Trench War: lobby, peer-to-peer messages, rival pages, attacks.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- TRENCH WAR: 2-4 players on their own phones (PeerJS / WebRTC; the host relays)
// Each phone runs its own bunker on the same map. Phones swap status, a low-res snapshot of each bunker (so you can
// swipe over and watch the damage) and attacks bought with gold.
const net = {
  sentFull: false,
  on: false,
  host: false,
  peer: null,
  conns: [],
  code: '',
  myId: '',
  started: false,
  view: 'me',
  players: Object.create(null),
  order: [],
  alive: true,
  rv: { x: 0, y: 0, vy: 0 },
};
const ATTACKS = [
  { id: 'barrage', name: 'BARRAGE', cost: 60, label: 'AN ARTILLERY BARRAGE' },
  { id: 'raid', name: 'RAID', cost: 80, label: 'A RAIDING PARTY' },
  { id: 'tunnel', name: 'TUNNEL', cost: 90, label: 'TUNNELLERS' },
  { id: 'heavy', name: 'HEAVY', cost: 130, label: 'THE HEAVY GUNS' },
  { id: 'driller', name: 'DRILL BOMB', cost: 150, label: 'A DRILLER BOMB' },
  { id: 'meteor', name: 'METEOR', cost: 220, label: 'A METEOR' },
];
// anything a peer sends is untrusted: names are reduced to plain letters/digits before they're shown anywhere
const validId = id =>
  typeof id === 'string' &&
  id.length > 0 &&
  id.length <= 64 &&
  !['__proto__', 'constructor', 'prototype'].includes(id);
const hasPlayer = id => validId(id) && Object.prototype.hasOwnProperty.call(net.players, id);
// a bunker snapshot's entity lists: arrays of small number tuples, capped, or the whole snapshot is dropped
function cleanEnt(e) {
  if (!e || typeof e !== 'object') return null;
  const out = {};
  const spec = {
    gens: 7,
    rooms: 6,
    diggers: 5,
    medics: 4,
    soldiers: 4,
    shells: 3,
    flashes: 5,
    pumps: 2,
    mgs: 3,
    drills: 3,
    doors: 4,
  };
  for (const k in spec) {
    const arr = Array.isArray(e[k]) ? e[k] : [];
    out[k] = arr.slice(0, 256).map(t => {
      const a = Array.isArray(t) ? t.slice(0, spec[k]).map(v => Number(v) | 0) : [];
      while (a.length < spec[k]) a.push(0);
      return a;
    });
  }
  for (const f of out.flashes) {
    f[2] = Math.max(0, Math.min(f[2], 60));
  }
  for (const gn of out.gens) {
    gn[2] = Math.max(1, Math.min(gn[2], 40));
    gn[3] = Math.max(1, Math.min(gn[3], 40));
    gn[5] = Math.max(1, gn[5]);
  }
  for (const r of out.rooms) {
    r[3] = Math.max(1, Math.min(r[3], 40));
    r[4] = Math.max(1, Math.min(r[4], 40));
  }
  for (const d of out.doors) d[2] = Math.max(1, Math.min(d[2], 12));
  return out;
}
// the network serializer needs a plain object, not the null-prototype map
const rosterOut = () =>
  Object.fromEntries(
    Object.entries(net.players).map(([id, p]) => [id, { name: cleanName(p.name), alive: p.alive !== false }])
  );
const cleanName = n =>
  String(n || '?')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 10) || '?';
const myName = () =>
  ($('warName').value || localStorage.getItem('sapper.name') || 'SAPPER').toUpperCase().slice(0, 10);
function netSend(msg, except) {
  if (!msg.from) msg.from = net.myId; // relayed messages keep their original sender
  for (const c of net.conns)
    if (c.open && c !== except) {
      try {
        c.send(msg);
      } catch (e) {}
    }
}
function warStatus(t) {
  $('warStatus').textContent = t;
}
function warLobby() {
  const box = $('warPlayers');
  box.textContent = '';
  if (net.code) {
    const c = document.createElement('div');
    c.className = 'code';
    c.textContent = net.code;
    box.append(c);
  }
  for (const [id, p] of Object.entries(net.players)) {
    const d = document.createElement('div');
    d.textContent = (id === net.myId ? '★ ' : '') + cleanName(p.name);
    box.append(d);
  }
  $('warStart').hidden = !(net.host && Object.keys(net.players).length >= 2 && !net.started);
}
function netReset() {
  try {
    net.peer && net.peer.destroy();
  } catch (e) {}
  Object.assign(net, {
    sentFull: false,
    on: false,
    host: false,
    peer: null,
    conns: [],
    code: '',
    myId: '',
    started: false,
    view: 'me',
    players: Object.create(null),
    order: [],
    alive: true,
  });
  show('warTabs', false);
  show('atkTray', false);
  show('spectBtn', false);
  document.body.classList.remove('war');
}
function netHost() {
  if (net.on && net.host) {
    warStatus(net.code ? "You're already hosting — share this code:" : 'Setting up…');
    return;
  }
  if (net.on && !net.host) {
    warStatus("You've already joined a game");
    return;
  }
  if (!window.Peer) {
    warStatus('Multiplayer needs a connection the first time — open the game online once.');
    return;
  }
  netReset();
  net.on = true;
  net.host = true;
  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[(Math.random() * 24) | 0]).join('');
  warStatus('Setting up…');
  const peer = (net.peer = new Peer('sapper-war-' + code));
  peer.on('open', id => {
    net.myId = id;
    net.code = code;
    net.players[id] = { name: myName(), alive: true };
    warStatus('Tell your mates this code:');
    warLobby();
  });
  peer.on('connection', c => {
    net.conns.push(c);
    c.on('data', m => onNet(m, c));
    c.on('close', () => playerLeft(c.peer));
  });
  peer.on('error', e => {
    warStatus(e.type === 'unavailable-id' ? 'Code clash — tap Host again' : 'Network problem: ' + e.type);
  });
}
function netJoin() {
  if (net.on && net.host) {
    warStatus("You're hosting — your mates join you");
    return;
  }
  if (net.on && !net.host) {
    warStatus(net.code ? 'Already in the lobby' : 'Connecting…');
    return;
  }
  if (!window.Peer) {
    warStatus('Multiplayer needs a connection the first time — open the game online once.');
    return;
  }
  const code = $('warCode').value.trim().toUpperCase();
  if (code.length !== 4) {
    warStatus('Enter the 4-letter code');
    return;
  }
  netReset();
  net.on = true;
  warStatus('Connecting…');
  const peer = (net.peer = new Peer());
  peer.on('open', id => {
    net.myId = id;
    net.players[id] = { name: myName(), alive: true };
    const c = peer.connect('sapper-war-' + code, { reliable: true });
    net.conns = [c];
    c.on('open', () => {
      net.code = code;
      warStatus('In the lobby — waiting for the host to start');
      netSend({ t: 'hello', name: myName() });
      warLobby();
    });
    c.on('data', m => onNet(m, c));
    c.on('close', () => {
      if (net.on) {
        toast('Lost connection to the host');
        warStatus('Disconnected');
      }
    });
  });
  peer.on('error', e =>
    warStatus(e.type === 'peer-unavailable' ? 'No game with that code' : 'Network problem: ' + e.type)
  );
}
function playerLeft(id) {
  const p = net.players[id];
  if (!p) return;
  if (!net.started) {
    delete net.players[id];
    net.conns = net.conns.filter(c => c.peer !== id);
    if (net.host) netSend({ t: 'lobby', players: rosterOut(), full: true });
    warLobby();
    return;
  }
  p.alive = false;
  p.left = true;
  if (net.started) {
    toast(`${p.name} left the war`);
    checkWinner();
  }
  warLobby();
  if (net.host) netSend({ t: 'left', id });
}
function onNet(m, conn) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
  if (net.host && ['hello', 'lobby', 'start', 'left'].includes(m.t) && m.t !== 'hello') return; // only the host may announce the lobby or start
  if (!net.host && conn && conn.peer !== 'sapper-war-' + net.code) return; // joiners only listen to the host
  if (net.host && conn) m.from = conn.peer; // a joiner can't pretend to be someone else
  if (net.host && conn && m.t !== 'hello') netSend(m, conn); // host relays everything else to the other players
  if (!validId(m.from)) return;
  const p = hasPlayer(m.from) ? net.players[m.from] : (net.players[m.from] = { name: '?', alive: true });
  switch (m.t) {
    case 'hello':
      p.name = cleanName(m.name);
      if (net.host) {
        netSend({ t: 'lobby', players: rosterOut(), full: true });
      }
      warLobby();
      break;
    case 'lobby':
      if (m.full)
        for (const id of Object.keys(net.players))
          if (id !== net.myId && !(m.players && Object.prototype.hasOwnProperty.call(m.players, id)))
            delete net.players[id];
      for (const id of Object.keys(m.players || {})) {
        if (!validId(id)) continue;
        const q = m.players[id] || {};
        net.players[id] = Object.assign(net.players[id] || {}, {
          name: cleanName(q.name),
          alive: q.alive !== false,
        });
      }
      warLobby();
      break;
    case 'left':
      if (hasPlayer(m.id)) playerLeft(m.id);
      break;
    case 'start':
      if (net.started) break;
      for (const id of Object.keys(m.players || {})) {
        if (!validId(id)) continue;
        const q = m.players[id] || {};
        net.players[id] = Object.assign(net.players[id] || {}, { name: cleanName(q.name), alive: true });
      }
      beginWar(Number(m.seed) | 0);
      break;
    case 'status':
      Object.assign(p, {
        gens: Number(m.gens) | 0,
        gold: Number(m.gold) | 0,
        hp: Number(m.hp) | 0,
        t: Number(m.time) | 0,
      });
      refreshTabs();
      break;
    case 'snap': {
      const rows = Number(m.rows) | 0,
        ent = cleanEnt(m.ent);
      const rle =
        m.rle instanceof ArrayBuffer
          ? new Uint8Array(m.rle)
          : ArrayBuffer.isView(m.rle)
            ? new Uint8Array(m.rle.buffer, m.rle.byteOffset, m.rle.byteLength)
            : null;
      if (!(rows > 0 && rows <= H) || !ent || !rle || rle.length > 2 * W * H) break;
      if (!p.grid) p.grid = new Uint8Array(W * H);
      p.grid.set(rleDecode(rle, W * rows), 0);
      p.view = viewFromEnt(ent, p.view);
      p.snap = { rows, at: performance.now() };
      break;
    }
    case 'attack':
      if (!ATTACKS.some(a => a.id === m.kind)) break;
      if (performance.now() - (p.lastAtk || 0) < 2000) break;
      p.lastAtk = performance.now(); /* same reload limit as the sender's guns */
      if (m.to === net.myId && state === 'play')
        incomingAttack(m.kind, p.name, Math.max(0, Math.min(3, Number(m.lv) | 0)));
      else if (m.to !== net.myId && hasPlayer(m.to)) {
        const tp = net.players[m.to];
        if (tp && state === 'play')
          toast(
            `${p.name} sent ${ATTACKS.find(a => a.id === m.kind).name} at ${m.to === net.myId ? 'you' : tp.name}`
          );
      }
      break;
    case 'dead':
      p.alive = false;
      p.gens = 0;
      toast(`${p.name}'s line has fallen!`);
      refreshTabs();
      checkWinner();
      break;
  }
}
function netStartWar() {
  const seed = (Math.random() * 1e9) | 0;
  net.started = true;
  netSend({ t: 'start', seed, players: rosterOut() });
  beginWar(seed);
}
function beginWar(seed) {
  net.started = true;
  net.alive = true;
  net.order = [net.myId, ...Object.keys(net.players).filter(id => id !== net.myId)];
  show('warScr', false);
  startGame({ war: true, seed });
  show('warTabs', true);
  document.body.classList.add('war');
  buildAtkTray();
  setView('me');
  banner('PROTECT YOUR GENERATORS', 'LAST GENERATOR STANDING WINS');
  schedule(3.5, () => banner('TRENCH WAR', 'SWIPE LEFT & RIGHT TO VISIT YOUR RIVALS'));
}
// ---- pages: your bunker plus one page per rival
function setView(id) {
  net.view = id;
  const mine = id === 'me';
  show('tray', mine && state === 'play');
  show('mini', mine && state === 'play');
  show('atkTray', !mine && net.alive && state === 'play');
  if (!mine) {
    const p = net.players[id],
      vg = p && p.view ? p.view.gens : [];
    const gx = vg.length ? vg.reduce((a, gn) => a + gn.x + gn.w / 2, 0) / vg.length : W / 2,
      gy = vg.length ? vg[0].y : 60;
    net.rv.x = Math.max(0, Math.min(W - VIEWW, gx - VIEWW / 2));
    net.rv.y = gy - 40;
    net.rv.vy = 0;
  }
  resize();
  refreshTabs();
}
function pageStep(dir) {
  const pages = ['me', ...net.order.filter(id => id !== net.myId)];
  let i = pages.indexOf(net.view);
  i = (i + dir + pages.length) % pages.length;
  if (state === 'spectate' && pages[i] === 'me') i = (i + dir + pages.length) % pages.length;
  setView(pages[i]);
}
function refreshTabs() {
  if (!net.on || !net.started) return;
  const pages = ['me', ...net.order.filter(id => id !== net.myId)];
  // update the tab buttons in place: rebuilding them a few times a second ate taps that landed mid-rebuild
  const tabs = $('warTabs');
  for (const b of [...tabs.children]) if (!pages.includes(b.dataset.page)) b.remove();
  for (const id of pages) {
    const p = id === 'me' ? null : net.players[id];
    if (id !== 'me' && !p) continue;
    const name = id === 'me' ? 'YOU' : cleanName(p.name),
      dead = id === 'me' ? !net.alive : !p.alive;
    const info = id === 'me' ? `${gens.length}⚙` : dead ? '☠' : `${p.gens ?? '?'}⚙ ◆${p.gold ?? '?'}`;
    let b = [...tabs.children].find(x => x.dataset.page === id);
    if (!b) {
      b = document.createElement('button');
      b.dataset.page = id;
      b.append(document.createElement('span'), document.createElement('br'), document.createElement('span'));
      tabs.append(b);
    }
    const cls = (net.view === id ? 'on ' : '') + (dead ? 'dead' : '');
    if (b.className !== cls) b.className = cls;
    if (b.children[0].textContent !== name) b.children[0].textContent = name;
    if (b.children[2].textContent !== info) b.children[2].textContent = info;
  }
}
function buildAtkTray() {
  $('atkTray').innerHTML = ATTACKS.map(
    a => `<div class="item" data-atk="${a.id}"><b style="font-size:12px">${a.name}</b><i>◆${a.cost}</i></div>`
  ).join('');
}
function sendAttack(kind) {
  const a = ATTACKS.find(x => x.id === kind),
    target = net.view,
    tp = net.players[target];
  if (!tp || !tp.alive || state !== 'play') return;
  if (gold < a.cost) {
    toast('Not enough gold');
    sfx.deny();
    return;
  }
  if ((sendAttack.cool || 0) > performance.now()) {
    toast('Guns reloading…');
    return;
  }
  gold -= a.cost;
  sendAttack.cool = performance.now() + 2500;
  netSend({ t: 'attack', to: target, kind, lv: up.atk });
  game.sent = (game.sent || 0) + 1;
  sfx.boom(6, 0.5);
  haptic('heavy');
  toast(`${a.name} away — watch ${tp.name}'s bunker`);
}
function incomingAttack(kind, from, lv = 0) {
  const a = ATTACKS.find(x => x.id === kind);
  if (!a) return;
  banner(`${from} SENT ${a.label}`, lv ? `INCOMING — WAR FOOTING LEVEL ${lv}!` : 'INCOMING!');
  haptic('heavy');
  game.hitsTaken = (game.hitsTaken || 0) + 1;
  const big = sh2 => {
    sh2.r += lv * 1.5;
    sh2.pen += lv * 2;
  }; // War Footing: each level makes every shell hit harder
  if (kind === 'barrage')
    for (let k = 0; k < 9 + lv * 4; k++)
      schedule(2 + rand() * 5, () => big(spawnShell(rand() < 0.3 ? 'howitzer' : 'light', pickX())));
  if (kind === 'heavy')
    for (let k = 0; k < 4 + lv; k++) schedule(2.5 + k * 1.4, () => big(spawnShell('heavy', pickX())));
  if (kind === 'raid') {
    game.raids++;
    for (let k = 0; k < 6 + lv * 3; k++) schedule(1 + k * 1.2, () => spawnSoldier(rand() < 0.5 ? -1 : 1));
  }
  if (kind === 'tunnel')
    for (let k = 0; k < 2 + lv; k++) schedule(1 + k * 4, () => spawnTunneller(rand() < 0.5 ? -1 : 1));
  if (kind === 'driller')
    schedule(2.5, () => {
      const gn = gens[(rand() * gens.length) | 0];
      if (!gn) return;
      const sh2 = spawnShell('light', Math.max(2, Math.min(W - 3, gn.x + gn.w / 2 + (rand() - 0.5) * 24))); // lands somewhere near a generator, not dead on
      sh2.kind = 'driller';
      sh2.vx = 0;
      sh2.r = 13 + lv * 1.5;
      sh2.digTo = gn.y + gn.h / 2 + (rand() - 0.5) * 12; // and stops somewhere around its depth
    });
  if (kind === 'meteor')
    schedule(2.5, () => {
      const m2 = spawnShell('meteor', pickX());
      m2.r += lv * 5;
      m2.pen += lv * 3;
    });
}
function checkWinner() {
  if (!net.started) return;
  const alive = [
    ...(net.alive ? [net.myId] : []),
    ...Object.keys(net.players).filter(id => id !== net.myId && net.players[id].alive),
  ];
  if (alive.length === 1 && !checkWinner.done) {
    checkWinner.done = true;
    const w = alive[0] === net.myId ? 'YOU' : net.players[alive[0]].name;
    banner(
      w === 'YOU' ? 'YOU WIN THE WAR' : `${w} WINS THE WAR`,
      w === 'YOU' ? 'LAST GENERATOR STANDING' : 'BETTER LUCK NEXT TIME'
    );
    if (w === 'YOU') {
      haptic('heavy');
      sfx.coin();
    }
  }
}
// ---- snapshots: run-length encoded cells of your bunker, sent twice a second
function rleEncode(a) {
  const out = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let n = 1;
    while (i + n < a.length && a[i + n] === v && n < 255) n++;
    out.push(v, n);
    i += n;
  }
  return new Uint8Array(out);
}
function rleDecode(r, len) {
  const a = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i + 1 < r.length; i += 2) {
    a.fill(r[i], p, Math.min(len, p + r[i + 1]));
    p += r[i + 1];
  }
  return a;
}
const PROPCODE = 200;
const LADCODE = 201,
  RUNGCODE = 202,
  ROOMKINDS = ['miners', 'hospital', 'mine', 'magazine', 'listen'],
  SHELLKINDS = ['light', 'howitzer', 'heavy', 'meteor', 'giant', 'buster', 'driller'];
function netTick() {
  if (!net.on || !net.started) return;
  if (tick % 30 === 0)
    netSend({
      t: 'status',
      gens: gens.length,
      gold,
      hp: Math.round(gens.reduce((a, gn) => a + Math.max(0, gn.hp), 0)),
      time: Math.floor(game.t),
    });
  if (tick % 30 === 15 && net.alive) {
    let deep = SKY + 70;
    for (const o of [...gens, ...rooms, ...diggers, ...drills]) deep = Math.max(deep, o.y + (o.h || 4) + 30);
    const full = !net.sentFull || tick % 300 === 15;
    net.sentFull = true;
    const rows = full ? H : Math.min(H, deep),
      cells = new Uint8Array(W * rows);
    for (let i = 0; i < W * rows; i++) {
      const t = g[i];
      cells[i] =
        t !== E
          ? t
          : secret[i]
            ? SOIL
            : prop[i]
              ? PROPCODE
              : ladder[i] === 1
                ? LADCODE
                : ladder[i] === 2
                  ? RUNGCODE
                  : E;
    }
    const ent = {
      gens: gens.map(gn => [gn.x, gn.y, gn.w, gn.h, Math.round(gn.hp), gn.max, gn.oc ? 1 : 0]),
      rooms: rooms.map(r => [ROOMKINDS.indexOf(r.kind), r.x, r.y, r.w, r.h, r.bay ? 1 : 0]),
      diggers: diggers.map(d => [d.x, d.y, d.dir, d.digging ? 1 : 0, d.down ? 1 : 0]),
      medics: medics.map(m => [m.x, m.y, m.dir, m.carrying ? 1 : 0]),
      soldiers: soldiers
        .filter(s2 => !s2.tun || s2.revealed)
        .map(s2 => [Math.floor(s2.x), s2.y, s2.dir, s2.tun ? 1 : 0]),
      shells: shells.map(s2 => [Math.round(s2.x), Math.round(s2.y), SHELLKINDS.indexOf(s2.kind)]),
      flashes: flashes.map(f => [Math.round(f.x), Math.round(f.y), Math.round(f.r), f.life, f.max]),
      pumps: pumps.map(q => [q.x, q.y]),
      mgs: mgs.map(m => [m.x, m.y, Math.round(m.ang * 100)]),
      drills: drills.map(d => [d.x, d.y, d.rem]),
      doors: doors.map(d => [d.x, d.y, d.w, d.open ? 1 : 0]),
    };
    netSend({ t: 'snap', y0: 0, rows, rle: rleEncode(cells).buffer, ent });
  }
}
// turn a received entity list into the same kinds of objects the renderer draws for your own bunker
function viewFromEnt(e, old) {
  const v = {
    gens: e.gens.map(a => ({
      x: a[0],
      y: a[1],
      w: a[2] || GEN_W,
      h: a[3] || GEN_H,
      hp: a[4],
      max: a[5],
      oc: a[6] ? 1 : 0,
      cool: 0,
      hit: 0,
    })),
    rooms: e.rooms
      .filter(a => ROOMKINDS[a[0]])
      .map(a => ({ kind: ROOMKINDS[a[0]], x: a[1], y: a[2], w: a[3], h: a[4], bay: !!a[5] })),
    diggers: e.diggers.map(a => ({
      x: a[0],
      y: a[1],
      fx: a[0],
      fy: a[1],
      dir: a[2] >= 0 ? 1 : -1,
      digging: !!a[3],
      down: !!a[4],
      path: a[3] ? [] : [0],
      anim: 0,
    })),
    medics: e.medics.map(a => ({
      x: a[0],
      y: a[1],
      fx: a[0],
      fy: a[1],
      dir: a[2] >= 0 ? 1 : -1,
      carrying: !!a[3],
      path: [0],
      body: null,
      anim: 0,
    })),
    soldiers: e.soldiers.map(a => ({
      x: a[0] + 0.5,
      y: a[1],
      dir: a[2] >= 0 ? 1 : -1,
      tun: !!a[3],
      revealed: true,
      anim: 0,
      atk: 0,
      fuse: 0,
    })),
    shells: e.shells.map(a => ({ x: a[0], y: a[1], kind: SHELLKINDS[a[2]] || 'light' })),
    flashes: e.flashes.map(a => ({
      x: a[0],
      y: a[1],
      r: a[2],
      life: Math.max(1, a[3]),
      max: Math.max(1, a[4]),
    })),
    pumps: e.pumps.map(a => ({ x: a[0], y: a[1], spin: 0 })),
    mgs: e.mgs.map(a => ({ x: a[0], y: a[1], ang: a[2] / 100, flash: 0, cool: 0 })),
    drills: e.drills.map(a => ({ x: a[0], y: a[1], rem: a[2], spin: 0 })),
    doors: e.doors.map(a => ({ x: a[0], y: a[1], w: a[2], open: !!a[3] })),
  };
  if (old) {
    // keep animation state so workers and miners glide instead of jumping
    v.rooms.forEach((r, k) => {
      if (old.rooms[k] && old.rooms[k].kind === r.kind) r.people = old.rooms[k].people;
    });
    v.diggers.forEach((d, k) => {
      if (old.diggers[k]) {
        d.fx = old.diggers[k].fx;
        d.fy = old.diggers[k].fy;
      }
    });
    v.medics.forEach((m, k) => {
      if (old.medics[k]) {
        m.fx = old.medics[k].fx;
        m.fy = old.medics[k].fy;
      }
    });
  }
  return v;
}
// ---- drawing a rival's bunker from their snapshot (whole map width, scroll up and down)
const stash = {
  g: new Uint8Array(W * H),
  prop: new Uint8Array(W * H),
  ladder: new Uint8Array(W * H),
  secret: new Uint8Array(W * H),
  mark: new Uint8Array(W * H),
};
function renderRival() {
  const p = net.players[net.view];
  if (!p || !p.grid || !p.view) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#cdb98a';
    ctx.font = `bold ${16 * dpr}px ui-monospace,Menlo,monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`Waiting for ${p ? p.name : '?'}'s bunker…`, cv.width / 2, cv.height / 2);
    return;
  }
  // borrow the world: park your own cells and entities, load theirs, draw, then put everything back
  stash.g.set(g);
  stash.prop.set(prop);
  stash.ladder.set(ladder);
  stash.secret.set(secret);
  stash.mark.set(mark);
  const pg = p.grid;
  for (let i = 0; i < W * H; i++) {
    const c = pg[i];
    if (c === PROPCODE) {
      g[i] = E;
      prop[i] = 1;
      ladder[i] = 0;
    } else if (c === LADCODE || c === RUNGCODE) {
      g[i] = E;
      prop[i] = 0;
      ladder[i] = c === LADCODE ? 1 : 2;
    } else {
      g[i] = c < NT ? c : SOIL;
      prop[i] = 0;
      ladder[i] = 0;
    }
  }
  secret.fill(0);
  mark.fill(0);
  const v = p.view;
  for (const d of v.diggers) {
    d.fx += (d.x - d.fx) * 0.25;
    d.fy += (d.y - d.fy) * 0.25;
    d.anim += 0.2;
  }
  for (const m of v.medics) {
    m.fx += (m.x - m.fx) * 0.25;
    m.fy += (m.y - m.fy) * 0.25;
    m.anim += 0.2;
  }
  const sv = {
    gens,
    rooms,
    diggers,
    medics,
    soldiers,
    shells,
    flashes,
    particles,
    popups,
    tracers,
    pumps,
    mgs,
    drills,
    doors,
    sites,
    roomPending,
    digAt,
    drawAt,
    capThis,
    cx: cam.x,
    cy: cam.y,
    cz: cam.zoom,
    scale,
  };
  gens = v.gens;
  rooms = v.rooms;
  diggers = v.diggers;
  medics = v.medics;
  soldiers = v.soldiers;
  shells = v.shells;
  flashes = v.flashes;
  pumps = v.pumps;
  mgs = v.mgs;
  drills = v.drills;
  doors = v.doors;
  particles = [];
  popups = [];
  tracers = [];
  sites = [];
  roomPending = null;
  digAt = null;
  drawAt = null;
  capThis = true;
  const rv = net.rv;
  rv.y += rv.vy;
  rv.vy *= 0.92;
  cam.zoom = 1;
  scale = cv.width / VIEWW;
  cam.x = rv.x;
  cam.y = rv.y;
  clampCam();
  rv.y = cam.y;
  try {
    renderWorld();
  } finally {
    g.set(stash.g);
    prop.set(stash.prop);
    ladder.set(stash.ladder);
    secret.set(stash.secret);
    mark.set(stash.mark);
    ({
      gens,
      rooms,
      diggers,
      medics,
      soldiers,
      shells,
      flashes,
      particles,
      popups,
      tracers,
      pumps,
      mgs,
      drills,
      doors,
      sites,
      roomPending,
      digAt,
      drawAt,
      capThis,
    } = sv);
    cam.x = sv.cx;
    cam.y = sv.cy;
    cam.zoom = sv.cz;
    scale = sv.scale;
  }
  ctx.fillStyle = '#000a';
  ctx.fillRect(0, cv.height - trayPx - 28 * dpr, cv.width, 28 * dpr);
  ctx.fillStyle = '#f0d68a';
  ctx.font = `bold ${13 * dpr}px ui-monospace,Menlo,monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${p.name}'S BUNKER  ·  ${p.gens ?? '?'} GENERATORS  ·  ◆${p.gold ?? '?'}${p.alive ? '' : '  ·  FALLEN'}`,
    cv.width / 2,
    cv.height - trayPx - 9 * dpr
  );
}
