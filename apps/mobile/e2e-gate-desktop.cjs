/** Desktop-leg gate runner — fresh browser per viewport for resilience. */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = 'http://localhost:8090';

(async () => {
  const vp = { name: 'desktop-1280x800', width: 1280, height: 800 };
  let failures = 0;
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  console.log(`===== ${vp.name} =====`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const shot1 = `e2e-artifacts/gate-${vp.name}-today.png`;
  await page.screenshot({ path: shot1 });

  const btn = page.locator('text=Start setup').first();
  const visible = await btn.isVisible().catch(() => false);
  console.log(`[gate] "Start setup" visible at desktop size: ${visible}`);
  if (!visible) failures++;

  if (visible) {
    await btn.click();
    await page.waitForTimeout(2000);
    const landed = /onboarding/i.test(page.url());
    const persona = await page.evaluate(() => /persona|learner|class|board/i.test(document.body.innerText));
    console.log(`[gate] tap → url=${page.url()} persona-content=${persona}`);
    if (!landed) failures++;
    await page.screenshot({ path: `e2e-artifacts/gate-${vp.name}-onboarding.png` });
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  console.log(`[gate] horizontal overflow px: ${overflow}`);
  if (overflow > 2) failures++;
  console.log(`[gate] page errors: ${errors.length ? errors.slice(0, 2).join(' | ') : 'none'}`);

  await ctx.close();
  await browser.close();
  console.log(failures === 0 ? 'DESKTOP LEG: ALL PASS' : `DESKTOP LEG: ${failures} FAILURE(S)`);
})();
