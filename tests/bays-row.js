const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300); await p.click('#startBtn');
  const r = await p.evaluate(()=>{ game.nextEvent=1e9; game.harassAt=1e9; gold=5000; const gn=gens[0];
    const ids=['hospital','pump','listen','mine']; const res=[];
    let x = gn.x + 40; for (const id of ids) { res.push(place(id, x, gn.y+5)); x += 19; }
    window.__sapper.fast(60*150);
    return { res, sites: sites.length, rooms: rooms.map(r=>[r.kind,r.x,r.y,r.w,r.h]), pumps: pumps.map(p2=>[p2.x,p2.y]) }; });
  console.log(JSON.stringify(r));
  await p.evaluate(()=>{ cam.zoom=1.4; resize(); const gn=gens[0]; cam.x=gn.x+20; cam.y=gn.y-14; clampCam(); });
  await p.waitForTimeout(500); await p.screenshot({ path:'/tmp/sapper-out/bays.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
