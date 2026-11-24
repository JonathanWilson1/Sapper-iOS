// Three players on one machine: host + 2 joiners via PeerJS, start, check snapshots arrive and an attack lands.
const { chromium } = require('playwright-core');
const URL = process.env.SAPPER_URL || 'http://localhost:8799/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errs = [];
  const mk = async (name) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name+': '+e.message)); await p.goto(URL); await p.evaluate(n=>{ localStorage.setItem('sapper.tut','1'); localStorage.setItem('sapper.name', n); }, name); await p.reload(); await p.waitForTimeout(500); return p; };
  const host = await mk('JON'), a = await mk('DAVE'), c = await mk('MIKE');
  await host.click('#warBtn'); await host.click('#warHost');
  await host.waitForFunction(() => window.__sapper.net.code, null, { timeout: 20000 });
  const code = await host.evaluate(() => window.__sapper.net.code);
  for (const p of [a, c]) { await p.click('#warBtn'); await p.fill('#warCode', code); await p.click('#warJoin'); }
  await host.waitForFunction(() => Object.keys(window.__sapper.net.players).length === 3, null, { timeout: 20000 });
  console.log('lobby code', code, 'players', await host.evaluate(() => Object.values(window.__sapper.net.players).map(p=>p.name).join(',')));
  await host.click('#warStart');
  await a.waitForFunction(() => window.__sapper.state === 'play', null, { timeout: 10000 });
  for (let k=0;k<6;k++) { for (const p of [host,a,c]) await p.evaluate(()=>window.__sapper.fast(30)); await host.waitForTimeout(300); }   // headless pauses background tabs: tick them by hand
  const snaps = await a.evaluate(() => Object.values(window.__sapper.net.players).filter(p=>p.snap).map(p=>p.name+':'+p.snap.rows));
  console.log('Dave has snapshots of', snaps.join(' '));
  const same = await Promise.all([host, a, c].map(p => p.evaluate(() => { let x=0; const g=window.__sapper.g; for (let i=0;i<g.length;i+=97) x=(x*31+g[i])|0; return x; })));
  console.log('same map on all three:', same[0]===same[1] && same[1]===same[2]);
  // Dave swipes to Jon's page and sends a barrage
  await a.evaluate(() => { window.__sapper.gold = 500; });
  await a.mouse.move(300, 400); await a.mouse.down(); await a.mouse.move(10, 400, { steps: 6 }); await a.mouse.up();   // edge swipe from the right? use tabs instead if needed
  const hostId = await a.evaluate(() => Object.keys(window.__sapper.net.players).find(id => window.__sapper.net.players[id].name==='JON'));
  await a.click(`#warTabs button[data-page="${hostId}"]`);
  await a.waitForTimeout(800);
  await a.screenshot({ path: '/tmp/sapper-out/war-rival.png' });
  await a.click('#atkTray .item[data-atk="barrage"]');
  await host.waitForTimeout(1500);
  console.log('Jon got hit:', await host.evaluate(() => (window.__sapper.game.hitsTaken||0)));
  await host.waitForTimeout(6000);
  await a.screenshot({ path: '/tmp/sapper-out/war-impact.png' });
  // Mike loses -> others told
  await c.evaluate(() => { for (const gn of [...window.__sapper.gens]) gn.hp = -1; window.__sapper.fast(5); });
  await host.waitForTimeout(2000);
  console.log('Jon sees Mike dead:', await host.evaluate(() => Object.values(window.__sapper.net.players).find(p=>p.name==='MIKE').alive === false));
  await host.screenshot({ path: '/tmp/sapper-out/war-host.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
