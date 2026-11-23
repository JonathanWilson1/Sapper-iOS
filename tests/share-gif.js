const { chromium, webkit } = require('playwright-core');
(async () => {
  for (const [name, bt, opts] of [['chrome', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }], ['webkit', webkit, {}]]) {
    const b = await bt.launch(opts);
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
    await p.evaluate(()=>localStorage.setItem('sapper.tut','1'));
    await p.waitForTimeout(300); await p.click('#startBtn');
    await p.evaluate(()=>{ cam.y = gens[0].y-50; for (let k=0;k<5;k++) setTimeout(()=>{ const s=spawnShell('heavy', gens[0].x+7); s.vx=0; }, k*700); });
    await p.waitForTimeout(6000);
    await p.evaluate(()=>{ game.meteors=52; game.raids=10; game.kills=31; for (const gn of [...gens]) gn.hp=-1; });
    const t0 = Date.now();
    await p.waitForFunction(()=>!!window.__sapper.gifBlob, null, { timeout: 60000 });
    const info = await p.evaluate(async ()=>{ const b=window.__sapper.gifBlob; const buf=new Uint8Array(await b.arrayBuffer()); let frames=0; for (let i=0;i<buf.length-1;i++) if (buf[i]===0x21&&buf[i+1]===0xF9) frames++;
      const img=new Image(); img.src=URL.createObjectURL(b); await img.decode(); return { kb: Math.round(b.size/1024), w: img.naturalWidth, h: img.naturalHeight, frames, b64: btoa(String.fromCharCode(...buf.subarray(0,0))) }; });
    console.log(name, 'gif', JSON.stringify({kb:info.kb, w:info.w, h:info.h, frames:info.frames}), 'built in ~', (Date.now()-t0)/1000, 's (incl 1.8s death delay)', 'ERRORS', errs);
    if (name==='chrome') { const data = await p.evaluate(async()=>{ const b=window.__sapper.gifBlob; const buf=new Uint8Array(await b.arrayBuffer()); let s=''; for (const x of buf) s+=String.fromCharCode(x); return btoa(s); }); require('fs').writeFileSync('/tmp/sapper-out/share.gif', Buffer.from(data,'base64')); }
    await b.close();
  }
})();
