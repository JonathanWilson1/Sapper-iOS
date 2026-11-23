const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto('https://jonathanwilson1.github.io/Sapper-iOS/');
  await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(1500);
  console.log('offline reload title:', await p.title(), '| game running:', await p.evaluate(()=>!!window.__sapper && window.__sapper.tick>0));
  await b.close();
})();
