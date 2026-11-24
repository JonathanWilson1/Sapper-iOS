const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const mk = async (name) => { const ctx = await b.newContext(); const p = await ctx.newPage(); await p.goto('http://localhost:8799/index.html'); await p.evaluate(n=>{ localStorage.setItem('sapper.tut','1'); localStorage.setItem('sapper.name', n); }, name); await p.reload(); await p.waitForTimeout(400); return p; };
  const host = await mk('JON'), a = await mk('DAVE');
  await host.click('#warBtn'); await host.click('#warHost'); await host.waitForFunction(() => window.__sapper.net.code, null, { timeout: 20000 });
  const code1 = await host.evaluate(() => window.__sapper.net.code); await host.click('#warHost'); await host.waitForTimeout(500);
  const code2 = await host.evaluate(() => window.__sapper.net.code);
  await a.click('#warBtn'); await a.fill('#warCode', code1); await a.click('#warJoin'); await a.click('#warJoin'); await a.waitForTimeout(3000); await a.click('#warJoin'); await a.waitForTimeout(1000);
  console.log('host twice keeps code:', code1===code2, '| players at host:', await host.evaluate(() => Object.values(window.__sapper.net.players).map(p=>p.name).join(',')));
  await b.close();
})();
