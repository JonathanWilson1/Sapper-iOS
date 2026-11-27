// SAPPER — flow.js
// Starting, pausing, losing and returning to the menu.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- game flow
function show(id, on) {
  $(id).hidden = !on;
}
function resetEntities() {
  gens = [];
  drills = [];
  rooms = [];
  roomPending = null;
  diggers = [];
  medics = [];
  sites = [];
  doors = [];
  claimed.clear();
  pumps = [];
  mgs = [];
  bodies.length = 0;
  rockChecks.length = 0;
  soldiers = [];
  shells = [];
  particles = [];
  flashes = [];
  tracers = [];
  popups = [];
  flares = [];
  timers = [];
  rainUntil = 0;
  shake = 0;
}
function startDemo() {
  demo = true;
  state = 'menu';
  resetEntities();
  genWorld((Math.random() * 1e9) | 0);
  buildBase(true);
  game.t = 0;
  cam.y = -10;
  cam.x = 0;
  cam.zoom = 1;
  demoStart = tick;
}
let demoStart = 0;
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
const dailySeed = key => {
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e9;
};
let drand = Math.random; // drives the attack schedule; seeded on daily runs so everyone faces the same order
function startGame(opts = {}) {
  if (opts instanceof Event) opts = {};
  sfx.init();
  sfx.rain(false);
  demo = false;
  resetEntities();
  game.daily = opts.daily ? todayKey() : null;
  game.war = !!opts.war;
  checkWinner.done = false;
  if (!opts.war && net.on) netReset();
  const sd = opts.war ? opts.seed : game.daily ? dailySeed(game.daily) : (Math.random() * 1e9) | 0;
  drand = game.daily || opts.war ? mulberry(sd ^ 0x5eed) : Math.random;
  genWorld(sd);
  buildBase(false);
  Object.assign(game, {
    t: 0,
    tOffset: 0,
    mined: 0,
    kills: 0,
    nextEvent: 40,
    harassAt: 60,
    intensity: 1,
    events: 0,
    meteors: 0,
    raids: 0,
    barrages: 0,
    dug: 0,
    props: 0,
    drillTaps: 0,
    concrete: 0,
  });
  for (const k in up) up[k] = 0;
  for (const r of ROOMDEFS) ITEM[r.id].cost = ITEM[r.id].base;
  resetCapture();
  gifJob++;
  gifBlob = null;
  tut.on = !opts.daily && !opts.war && (!!opts.tutorial || localStorage.getItem('sapper.tut') !== '1');
  tut.i = 0;
  tut.moved = 0;
  tut.sawUpg = false;
  gold = 140;
  ITEM.gen.cost = 100;
  drawMode = false;
  state = 'play';
  ['menu', 'help', 'over', 'pause'].forEach(s => show(s, false));
  show('hud', true);
  show('tray', true);
  show('mini', true);
  cam.zoom = 1;
  cam.x = 0;
  buildTray();
  resize();
  cam.y = 0;
  cam.vy = 0;
  cam.x = gens[0].x + GEN_W / 2 - cv.width / scale / 2;
  clampCam();
  const tips = [
    [1, 'Two fingers scroll & pinch. Your GENERATOR earns ◆ — keep it running.'],
    [7, 'One finger marks earth to dig — your miners do the digging. Gold ore pays ◆.'],
    [14, 'Unbraced ceilings crumble. Drag a PROP from the tray into a tunnel.'],
    [13, 'Tap a DRILL to bore 20 deeper for ◆10. Ore is worth more the deeper it is.'],
    [33, 'Tap a GENERATOR to overcharge it: double ◆ for 20s, but it sparks fires.'],
    [20, 'More GENERATORs = more ◆. Shallow pays best, but that is where shells land.'],
    [26, 'Earth and CONCRETE absorb blasts.'],
  ];
  if (!opts.war && !tut.on) banner('PROTECT YOUR GENERATORS', 'LOSE THEM ALL AND THE LINE FALLS');
  if (tut.on) {
    show('tut', true);
    startTutorialStep();
  } else {
    show('tut', false);
    if (!opts.war) for (const [t, msg] of tips) schedule(t, () => toast(msg));
  }
}
function gameOver() {
  state = 'dying';
  if (net.on && net.started) {
    net.alive = false;
    netSend({ t: 'dead' });
    checkWinner();
    if (net.view !== 'me') setView('me');
  }
  haptic('error');
  $('banner').style.opacity = 0;
  $('toast').style.opacity = 0;
  show('tut', false);
  tut.on = false;
  const t = Math.floor(game.t),
    best = Math.max(game.best, t);
  game.best = best;
  localStorage.setItem('sapper.best', best);
  const sc = scoreOf(),
    bk = game.daily ? 'sapper.daily.' + game.daily : 'sapper.bestScore',
    bestScore = Math.max(+(localStorage.getItem(bk) || 0), sc),
    isBest = sc >= bestScore && sc > 0;
  localStorage.setItem(bk, bestScore);
  setTimeout(() => {
    const snap = document.createElement('canvas');
    snap.width = cv.width;
    snap.height = cv.height;
    snap.getContext('2d').drawImage(cv, 0, 0);
    state = 'over';
    sfx.rain(false);
    $('overStats').innerHTML =
      (game.daily ? `<p><em>DAILY CHALLENGE · ${todayLabel()}</em></p>` : '') +
      `<div class="bigscore">${sc.toLocaleString()}</div><p>${isBest ? '<em>NEW BEST' + (game.daily ? ' TODAY' : ' SCORE') + '</em>' : 'BEST ' + (game.daily ? 'TODAY ' : '') + bestScore.toLocaleString()}</p>` +
      `<p>HELD FOR <em>${fmtT(t)}</em></p><p><em>${game.meteors}</em> METEOR STRIKES · <em>${game.raids}</em> RAIDS · <em>${game.barrages}</em> BARRAGES</p><p><em>${game.kills}</em> RAIDERS STOPPED · <em>◆${game.mined.toLocaleString()}</em> MINED</p>`;
    buildShareCard(snap, sc, t);
    buildShareGif(sc, t);
    show('over', true);
    show('tray', false);
    show('hud', false);
    show('mini', false);
    show('spectBtn', net.on && net.started);
    show('atkTray', false);
  }, 1800);
}
const fmtT = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function scoreOf() {
  return (
    Math.floor(game.t) * 5 +
    game.events * 100 +
    game.kills * 25 +
    game.meteors * 150 +
    Math.floor(game.mined / 2)
  );
}
