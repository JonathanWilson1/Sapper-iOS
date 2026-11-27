// SAPPER — debug.js
// Debug menu, plus wiring for every menu button.
// Loaded as a plain <script> in the order listed in index.html; all files share one global scope.
'use strict';

// ---------- debug menu (pause → Debug): fire any event, cheat, inspect
let debugGod = false;
const DEBUG = [
  ['Events'],
  ...EVENTS.map(e => [e.id.toUpperCase(), () => e.run()]),
  [
    'GIANT METEOR',
    () => {
      banner('GIANT METEOR', "IT'S GOING TO LEAVE A HOLE");
      schedule(2.5, () => spawnShell('giant', pickX()));
    },
  ],
  [
    'BUNKER BUSTER',
    () => {
      banner('BUNKER BUSTER', 'DEBUG');
      const sh = spawnShell('buster', pickX());
      sh.pen = 80;
    },
  ],
  ['1 TUNNELLER', () => spawnTunneller(rand() < 0.5 ? -1 : 1)],
  [
    '5 RAIDERS',
    () => {
      for (let k = 0; k < 5; k++) spawnSoldier(k % 2 ? 1 : -1);
    },
  ],
  ['Cheats'],
  [
    '+500 GOLD',
    () => {
      gold += 500;
    },
  ],
  [
    'HEAL ALL',
    () => {
      for (const gn of gens) gn.hp = gn.max;
    },
  ],
  [
    () => 'GOD MODE: ' + (debugGod ? 'ON' : 'OFF'),
    () => {
      debugGod = !debugGod;
    },
  ],
  [
    'SKIP +60s',
    () => {
      game.t += 60;
      game.nextEvent = Math.min(game.nextEvent, game.t + 1);
    },
  ],
  [
    'NEXT EVENT NOW',
    () => {
      game.nextEvent = game.t;
    },
  ],
  [
    'KILL ENEMIES',
    () => {
      for (const s2 of soldiers) s2.hp = 0;
    },
  ],
  [
    'REVEAL TUNNELS',
    () => {
      secret.fill(0);
      for (const s2 of soldiers) if (s2.tun) s2.revealed = true;
    },
  ],
  [
    'FLOOD HERE',
    () => {
      const cx = Math.floor(cam.x + (viewRows() * cv.width) / cv.height / 2),
        cy = Math.floor(cam.y + 10);
      for (let y = cy; y < cy + 8; y++)
        for (let x = cx - 10; x < cx + 10; x++) if (inB(x, y) && g[y * W + x] === E) g[y * W + x] = WATER;
    },
  ],
  [
    'CLEAR MARKS',
    () => {
      mark.fill(0);
      zone.fill(0);
    },
  ],
  [
    'MAX UPGRADES',
    () => {
      for (const u of UPGRADES) up[u.id] = u.costs.length;
    },
  ],
  [
    'LOSE NOW',
    () => {
      for (const gn of [...gens]) gn.hp = -1;
      debugGod = false;
    },
  ],
];
function openDebug() {
  show('pause', false);
  show('debugScr', true);
  $('debugList').innerHTML = DEBUG.map((d, k) =>
    d.length === 1
      ? `<h3>${d[0].toUpperCase()}</h3>`
      : `<button data-dbg="${k}">${typeof d[0] === 'function' ? d[0]() : d[0]}</button>`
  ).join('');
}

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  show('pause', true);
}
function resume() {
  state = 'play';
  show('pause', false);
  last = performance.now();
}
function toMenu() {
  debugGod = false;
  if (net.on) netReset();
  if (checkForUpdate.pending) {
    location.reload();
    return;
  }
  ['over', 'pause', 'help', 'hud', 'tray', 'mini', 'tut', 'upg', 'roomsScr', 'debugScr'].forEach(s =>
    show(s, false)
  );
  show('menu', true);
  updateBest();
  startDemo();
  resize();
}
function updateBest() {
  const b = game.best,
    bs = +(localStorage.getItem('sapper.bestScore') || 0);
  $('bestStat').textContent = b ? `BEST SCORE ${bs.toLocaleString()} · HELD ${fmtT(b)}` : '';
  const ds = +(localStorage.getItem('sapper.daily.' + todayKey()) || 0);
  $('dailyStat').textContent =
    `TODAY (${todayLabel()}): ` + (ds ? `BEST ${ds.toLocaleString()}` : 'NOT PLAYED YET');
}
$('startBtn').onclick = () => startGame();
$('campBtn').onclick = () => startGame({ tutorial: true });
$('tutSkip').onclick = () => {
  endTutorial(false);
  toast('Tutorial skipped — good luck');
};
$('shareBtn').onclick = shareScore;
$('upgClose').onclick = () => {
  show('upg', false);
  state = 'play';
  last = performance.now();
  tut.sawUpg = true;
};
$('warBtn').onclick = () => {
  show('menu', false);
  show('warScr', true);
  $('warName').value = localStorage.getItem('sapper.name') || '';
  warStatus('');
  warLobby();
};
$('warName').addEventListener('change', () =>
  localStorage.setItem('sapper.name', $('warName').value.trim().toUpperCase())
);
$('warHost').onclick = () => {
  localStorage.setItem('sapper.name', myName());
  netHost();
};
$('warJoin').onclick = () => {
  localStorage.setItem('sapper.name', myName());
  netJoin();
};
$('warStart').onclick = netStartWar;
$('warBack').onclick = () => {
  netReset();
  show('warScr', false);
  show('menu', true);
};
$('warTabs').addEventListener('pointerdown', e => {
  const b = e.target.closest('button[data-page]');
  if (!b) return;
  e.preventDefault();
  if (!(state === 'spectate' && b.dataset.page === 'me')) setView(b.dataset.page);
});
$('atkTray').addEventListener('pointerdown', e => {
  const it = e.target.closest('.item[data-atk]');
  if (!it) return;
  e.preventDefault();
  sfx.init();
  it.classList.add('press');
  setTimeout(() => it.classList.remove('press'), 180);
  sendAttack(it.dataset.atk);
});
$('spectBtn').onclick = () => {
  show('over', false);
  state = 'spectate';
  const first = net.order.find(id => id !== net.myId);
  if (first) setView(first);
};
$('debugBtn').onclick = openDebug;
$('debugClose').onclick = () => {
  show('debugScr', false);
  show('pause', true);
};
$('debugList').addEventListener('click', e => {
  const b = e.target.closest('button[data-dbg]');
  if (!b) return;
  DEBUG[+b.dataset.dbg][1]();
  show('debugScr', false);
  resume();
  toast('Debug: ' + b.textContent);
});
$('roomList').addEventListener('click', e => {
  const b = e.target.closest('button[data-room]');
  if (b) chooseRoom(b.dataset.room);
});
$('roomClose').onclick = () => {
  show('roomsScr', false);
  state = 'play';
  last = performance.now();
};
$('dailyBtn').onclick = () => startGame({ daily: true });
$('upgList').addEventListener('click', e => {
  const b = e.target.closest('button[data-up]');
  if (b) buyUpgrade(b.dataset.up);
});
$('helpBtn').onclick = () => {
  show('menu', false);
  show('help', true);
};
$('helpBack').onclick = () => {
  show('help', false);
  if (state === 'menu') show('menu', true);
  else show('pause', true);
};
$('soundBtn').onclick = () => {
  sfx.init();
  sfx.setOn(!sfx.on);
  $('soundBtn').textContent = 'Sound: ' + (sfx.on ? 'On' : 'Off');
};
$('soundBtn').textContent = 'Sound: ' + (sfx.on ? 'On' : 'Off');
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = () => startGame();
$('quitBtn').onclick = toMenu;
$('againBtn').onclick = () => startGame();
$('overMenuBtn').onclick = toMenu;
$('menu').addEventListener('pointerdown', () => sfx.init());
