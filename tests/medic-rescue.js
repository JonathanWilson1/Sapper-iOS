const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300); await p.click('#startBtn');
  const r = await p.evaluate(()=>{ game.nextEvent=1e9; game.harassAt=1e9; gold=999; const gn=gens[0];
    // dig a gallery under the chamber, put a hospital in it
    const y0=gn.y+GEN_H+1; for (let y=y0;y<y0+8;y++) for (let x=gn.x-30;x<gn.x+30;x++) g[y*W+x]=E; for (let x=gn.x-31;x<gn.x+31;x++) g[(y0+8)*W+x]=CONC;
    const ok = place('hospital', gn.x-20, y0+4, true);
    // send a miner out into the gallery, then knock it down
    window.__sapper.fast(60*9);
    const d = diggers[0]; d.x=gn.x+20; d.y=y0+7; d.fx=d.x; d.fy=d.y; d.hp=0; window.__sapper.fast(2);
    const log=[`placed:${ok}`, `down:${d.down}`];
    for (let t=0;t<40;t++) { window.__sapper.fast(30); if (d.carried && !log.includes('carried')) log.push('carried'); if (d.healing && !log.includes('healing')) log.push('healing'); if (!d.down) { log.push('revived at '+(t*0.5)+'s'); break; } }
    return { log, medics: medics.length, alive: diggers.includes(d) };
  });
  console.log(JSON.stringify(r));
  // no hospital: bleeds out after 45s
  const r2 = await p.evaluate(()=>{ rooms = rooms.filter(r=>r.kind!=='hospital'); const d=diggers[1]; d.hp=0; window.__sapper.fast(2); const down=d.down; window.__sapper.fast(60*46); return { down, stillThere: diggers.includes(d) }; });
  console.log(JSON.stringify(r2), 'ERRORS', errs);
  await b.close();
})();
