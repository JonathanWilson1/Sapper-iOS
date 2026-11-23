const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(400); await p.click('#startBtn'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const d=drills[0];
    // sand pocket right beside the drill's path
    for (let y=d.y+8;y<d.y+18;y++) for (let x=d.x+DRILL_W;x<d.x+DRILL_W+8;x++) g[y*W+x]=2;
    pressDrill(d); pressDrill(d); window.__sapper.fast(600);
    let sandIn=0; for (let y=d.y-40;y<d.y;y++) for (let x=d.x;x<d.x+DRILL_W;x++) if (g[y*W+x]===2) sandIn++;
    cam.y = d.y-60; return {depth:d.y, sandIn}; });
  console.log(JSON.stringify(r));
  await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/sapper-out/lining.png' });
  const rr = await p.evaluate(() => { let n=0; while (state==='play' && n<60*900) { window.__sapper.fast(60); n+=60; } return game.t.toFixed(0); });
  console.log('idle survival', rr, 'ERRORS', errs);
  await b.close();
})();
