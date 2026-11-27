const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///Users/jonathanwilson/Developer/Sapper-iOS/web/index.html');
  await p.evaluate(()=>localStorage.setItem('sapper.tut','1')); await p.evaluate(()=>localStorage.setItem('sapper.debug','1')); await p.reload(); await p.waitForTimeout(300); await p.click('#startBtn'); await p.waitForTimeout(300);
  await p.click('#pauseBtn'); await p.click('#debugBtn'); await p.waitForTimeout(200);
  await p.screenshot({ path:'/tmp/sapper-out/debug.png' });
  const n = await p.locator('#debugList button').count();
  const names=[];
  for (let k=0;k<n;k++) {
    const label = await p.locator('#debugList button').nth(k).innerText();
    if (/LOSE/.test(label)) continue;
    await p.locator('#debugList button').nth(k).click(); names.push(label);
    await p.evaluate(()=>window.__sapper.fast(240));
    await p.click('#pauseBtn'); await p.click('#debugBtn');
  }
  console.log('fired', names.length, 'buttons; state', await p.evaluate(()=>window.__sapper.state), 'god', await p.evaluate(()=>debugGod), 'ERRORS', errs);
  await b.close();
})();
