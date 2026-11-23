const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1'));
  await p.waitForTimeout(400);
  console.log('menu daily:', await p.locator('#dailyStat').innerText());
  // daily determinism: same world twice
  const h = async () => p.evaluate(()=>{ let x=0; for (let i=0;i<g.length;i+=7) x=(x*31+g[i])|0; return x; });
  await p.tap('#dailyBtn'); await p.waitForTimeout(200); const h1 = await h(); const ev1 = await p.evaluate(()=>{ const o=[]; for (let k=0;k<5;k++) o.push(drand().toFixed(4)); return o.join(','); });
  await p.evaluate(()=>startGame({daily:true})); const h2 = await h(); const ev2 = await p.evaluate(()=>{ const o=[]; for (let k=0;k<5;k++) o.push(drand().toFixed(4)); return o.join(','); });
  console.log('daily same world', h1===h2, 'same attack rng', ev1===ev2, 'daily=', await p.evaluate(()=>game.daily));
  // rooms: open picker via tray, choose hospital, tap in chamber
  await p.evaluate(()=>{ gold=500; cam.y = gens[0].y-50; }); await p.waitForTimeout(100);
  await p.locator('.item[data-id=room]').tap(); await p.waitForTimeout(150);
  await p.locator('button[data-room=hospital]').tap(); await p.waitForTimeout(100);
  const q = await p.evaluate(()=>({x:gens[0].x-12, y:gens[0].y+2, cx:cam.x, cy:cam.y, z:cam.zoom}));
  const S=390/112*q.z; await p.touchscreen.tap((q.x-q.cx)*S, (q.y-q.cy)*S); await p.waitForTimeout(100);
  console.log('rooms', JSON.stringify(await p.evaluate(()=>rooms.map(r=>r.kind))), 'gold', await p.evaluate(()=>gold));
  // hospital heals
  const heal = await p.evaluate(()=>{ gens[0].hp=50; window.__sapper.fast(600); return gens[0].hp.toFixed(1); });
  console.log('gen hp after 10s with hospital (from 50):', heal);
  // mine head bonus
  const ore = await p.evaluate(()=>{ rooms.push({kind:'mine', x:10, y:300, w:8, h:5}); const a=gold; mineOre(14,302); const b1=gold-a; rooms.pop(); return b1; });
  console.log('ore with mine head at depth', ore);
  // tunneller hidden, then revealed by listening post, then dug out
  const tn = await p.evaluate(()=>{ spawnTunneller(-1); const s=soldiers[soldiers.length-1]; window.__sapper.fast(45*25); const hidden=window.__sapper.secretCount;
    place('listen', s.x+5, s.y-1, true); rooms.push({kind:'listen', x:Math.floor(s.x)+3, y:s.y-3, w:3, h:3}); window.__sapper.fast(30); const rev = s.revealed, after=window.__sapper.secretCount;
    const k0=game.kills; digAt={x:s.x, y:s.y-1}; window.__sapper.fast(2); digAt=null; return {hiddenCells:hidden, revealed:rev, secretAfter:after, killed: game.kills-k0}; });
  console.log('tunneller', JSON.stringify(tn));
  // tunneller reaches generator and blows mine if ignored
  const mine = await p.evaluate(()=>{ const hp0=gens[0].hp; spawnTunneller(1); window.__sapper.fast(60*90); return {hpLost:(hp0-(gens[0]?gens[0].hp:0)).toFixed(0), gens:gens.length}; });
  console.log('unopposed tunneller', JSON.stringify(mine));
  // sapper drawn while digging
  await p.evaluate(()=>{ cam.y=gens[0].y-50; }); 
  console.log('ERRORS', errs);
  await b.close();
})();
