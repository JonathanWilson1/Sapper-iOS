const { webkit, devices } = require('playwright-core');
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('https://jonathanwilson1.github.io/Sapper-iOS/?v='+Date.now());
  await p.waitForTimeout(3000);
  console.log('tick', await p.evaluate(()=>window.__sapper && window.__sapper.tick));
  await p.tap('#startBtn'); await p.waitForTimeout(1500);
  console.log('state', await p.evaluate(()=>window.__sapper && window.__sapper.state), 'ERRORS', errs);
  await p.screenshot({ path: '/tmp/sapper-out/wk.png' });
  await b.close();
})();
