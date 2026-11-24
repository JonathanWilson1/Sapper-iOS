// A dig area under a sand pocket: sand pours in as miners dig; the area should still end up cleared.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300); await p.click('#startBtn');
  const r = await p.evaluate(() => { game.nextEvent=1e9; game.harassAt=1e9; const gn=gens[0];
    const x0=gn.x-14, y0=gn.y+GEN_H-1;           // the chamber floor and below
    for (let y=y0+6;y<y0+14;y++) for (let x=x0-4;x<x0+16;x++) g[y*W+x]=SOIL;
    for (let y=y0+14;y<y0+20;y++) for (let x=x0-2;x<x0+14;x++) g[y*W+x]=SAND;   // (below the area: irrelevant)
    for (let y=y0-1;y<y0+1;y++) for (let x=x0+2;x<x0+10;x++) g[y*W+x]=SAND;     // sand right on top of the dig area's edge
    // mark the area by "painting" the brush across it
    for (let y=y0+2;y<y0+8;y+=5) for (let x=x0;x<x0+12;x+=5) { digAt={x:x+.5,y:y+.5}; markErase=false; applyDig(); }
    digAt=null;
    window.__sapper.fast(60*60);
    let loose=0, left=0; for (let y=y0;y<y0+10;y++) for (let x=x0-2;x<x0+14;x++) { const i=y*W+x; if (zone[i]) { if (g[i]===SAND||g[i]===RUBBLE) loose++; if (mark[i]) left++; } }
    return { looseLeftInArea: loose, marksLeft: left, dug: game.dug };
  });
  console.log(JSON.stringify(r), 'ERRORS', errs);
  await b.close();
})();
