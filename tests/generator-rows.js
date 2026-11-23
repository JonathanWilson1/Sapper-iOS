const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300); await p.click('#startBtn'); await p.waitForTimeout(200);
  const r = await p.evaluate(()=>{ game.nextEvent=1e9; game.harassAt=1e9; gold=2000; const gn=gens[0];
    // three generators into solid earth in a row below the chamber, tapped roughly
    const y = gn.y + GEN_H + 6;   // just below the floor
    const a=place('gen', gn.x-14+1, y+1), b2=place('gen', gn.x+2, y-1), c=place('gen', gn.x+17, y+2);
    const xs = sites.map(s=>[s.x0,s.y0,s.y1]);
    window.__sapper.fast(60*90);
    return { placed:[a,b2,c], sites:xs, left:sites.length, gens:gens.length, rows: gens.slice(1).map(g2=>[g2.x,g2.y]) };
  });
  console.log(JSON.stringify(r));
  await p.evaluate(()=>{ cam.zoom=2; resize(); const gn=gens[0]; cam.x=gn.x-26; cam.y=gn.y-8; clampCam(); });
  await p.waitForTimeout(500);
  await p.screenshot({ path:'/tmp/sapper-out/genrow.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
