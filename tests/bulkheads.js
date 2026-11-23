const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300); await p.click('#startBtn');
  const r = await p.evaluate(()=>{ game.nextEvent=1e9; game.harassAt=1e9; gold=999; const d=drills[0];
    for (let k=0;k<3;k++) pressDrill(d); window.__sapper.fast(60*20);
    const doorsMade = doors.length;
    // flood above the first door: water should sit on it
    const dr = doors[0]; for (let y=dr.y-6;y<dr.y;y++) for (let x=dr.x;x<dr.x+dr.w;x++) if (g[y*W+x]===E) g[y*W+x]=WATER;
    window.__sapper.fast(120); let below=0; for (let y=dr.y+1;y<dr.y+10;y++) for (let x=dr.x;x<dr.x+dr.w;x++) if (g[y*W+x]===WATER) below++;
    // mark ore beyond the bottom so miners go down through the doors
    const bx=d.x+DRILL_W, by=d.y; for (let y=by-3;y<by;y++) for (let x=bx;x<bx+6;x++) { if (g[y*W+x]===TIMBER) g[y*W+x]=SOIL; mark[y*W+x]=1; }
    let opened=false; for (let t=0;t<60*30;t+=10) { window.__sapper.fast(10); if (dr.open) { opened=true; break; } }
    return { doorsMade, waterLeakedBelow: below, openedForMiner: opened };
  });
  console.log(JSON.stringify(r));
  await p.evaluate(()=>{ cam.zoom=2.2; resize(); const dr=doors[0]; cam.x=dr.x-20; cam.y=dr.y-30; clampCam(); });
  await p.waitForTimeout(400); await p.screenshot({ path:'/tmp/sapper-out/door.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
