const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.waitForTimeout(300);
  await p.click('#startBtn'); await p.waitForTimeout(300);
  console.log('huts', JSON.stringify(await p.evaluate(()=>rooms.map(r=>r.kind))), 'diggers', await p.evaluate(()=>diggers.length));
  await p.evaluate(()=>{ game.nextEvent=1e9; game.harassAt=1e9; cam.y=gens[0].y-40; });
  await p.waitForTimeout(100);
  const q = await p.evaluate(()=>({x:gens[0].x-12, y:gens[0].y+GEN_H+2, cx:cam.x, cy:cam.y, z:cam.zoom}));
  const S=390/112*q.z; const cdp = await p.context().newCDPSession(p);
  const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((v,i)=>({x:v[0],y:v[1],id:i}))});
  const X=(q.x-q.cx)*S, Y=(q.y-q.cy)*S;
  await T('touchStart',[[X,Y]]); await p.waitForTimeout(120); for (let k=1;k<=30;k++){ await T('touchMove',[[X+k*4,Y+k*1.5]]); await p.waitForTimeout(20);} await T('touchEnd',[]);
  const m0 = await p.evaluate(()=>mark.reduce((a,v)=>a+v,0));
  const r = await p.evaluate(()=>{ const d0=game.dug; window.__sapper.fast(60*12); return {dug:game.dug-d0, marksLeft:mark.reduce((a,v)=>a+v,0), busy:diggers.filter(d=>d.target>=0).length}; });
  console.log('marked', m0, JSON.stringify(r));
  await p.screenshot({ path:'/tmp/sapper-out/miners.png' });
  // gold vein: mark it, check gold comes in
  const gr = await p.evaluate(()=>{ const g0=gold, gn=gens[0]; for (let y=gn.y-2;y<gn.y+GEN_H+1;y++) for (let x=gn.x+32;x<gn.x+44;x++) if (DIGT[g[y*W+x]]) mark[y*W+x]=1; window.__sapper.fast(60*20); return gold-g0; });
  console.log('gold gained from marked vein (20s, incl gen income)', gr);
  // unreachable marks -> hint, no crash
  await p.evaluate(()=>{ for (let y=300;y<305;y++) for (let x=10;x<15;x++) mark[y*W+x]=1; window.__sapper.fast(60*5); });
  // erase marks by dragging over marked earth
  console.log('ERRORS', errs);
  await b.close();
})();
